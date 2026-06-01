import { db } from "@workspace/db";
import {
  notificationsTable,
  riderProfilesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { mkdir, writeFile } from "fs/promises";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { generateId } from "../lib/id.js";
import { logger } from "../lib/logger.js";
import {
  sendError,
  sendForbidden,
  sendNotFound,
  sendSuccess,
  sendTooManyRequests,
  sendValidationError,
} from "../lib/response.js";
import {
  anyUserAuth,
  getCachedSettings,
  getClientIp,
} from "../middleware/security.js";
import { validateBody } from "../middleware/validate.js";
import {
  getActiveOtpToken,
  markOtpUsed,
  saveOtpToken,
} from "../modules/otp/otp.store.js";
import { hashOtp } from "./auth/helpers.js";
import { generateSecureOtp } from "../services/password.js";
import { sendOtpSMS } from "../services/sms.js";
import { sendWhatsAppOTP } from "../services/whatsapp.js";
import { sendEmail } from "../services/email.js";
import { awardVerificationBonus } from "../services/verificationBonus.js";

const router: IRouter = Router();

router.use(anyUserAuth);

const KYC_UPLOADS_DIR = path.resolve(process.cwd(), "uploads/kyc");
const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_DOC_SIZE = 5 * 1024 * 1024;

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  },
});

async function saveDocumentFile(userId: string, type: string, buffer: Buffer, mime: string): Promise<string> {
  const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
  const filename = `kycdoc_${userId.slice(-8)}_${type}_${randomUUID().slice(0, 8)}${ext}`;
  await mkdir(KYC_UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(KYC_UPLOADS_DIR, filename), buffer);
  return `/api/uploads/kyc/${filename}`;
}

/* ── POST /verify/phone/send ────────────────────────────────────────────────
   Send OTP to the authenticated user's phone number for verification.
─────────────────────────────────────────────────────────────────────────── */
router.post("/phone/send", async (req, res) => {
  try {
    const userId = req.customerId ?? req.riderId ?? req.vendorId;
    if (!userId) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone, phoneVerified: usersTable.phoneVerified })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }
    if (user.phoneVerified) {
      sendSuccess(res, { alreadyVerified: true, message: "Phone is already verified." });
      return;
    }
    if (!user.phone) {
      sendValidationError(res, "No phone number on this account. Please update your profile first.");
      return;
    }

    const settings = await getCachedSettings();
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const ip = getClientIp(req);

    await saveOtpToken({
      identifier: user.phone,
      identifierType: "phone",
      otpType: "verify_phone",
      otpHash,
      channel: "sms",
      userId,
      ipAddress: ip,
    });

    const smsResult = await sendOtpSMS(user.phone, otp, settings, "en");
    if (settings["integration_whatsapp"] === "on") {
      sendWhatsAppOTP(user.phone, otp, settings, "en").catch((err: Error) =>
        logger.warn({ err: err.message }, "[verify/phone] WhatsApp OTP send failed (non-fatal)")
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && (!smsResult.sent || smsResult.provider === "console")) {
      logger.warn({ phone: user.phone, otp }, "[VERIFY DEV] Phone OTP for testing only");
    }

    sendSuccess(res, {
      message: "OTP sent to your phone number.",
      channel: smsResult.sent ? smsResult.provider : "console",
      ...(process.env.ALLOW_DEV_OTP === "true" && process.env.NODE_ENV === "development"
        ? { devOtp: otp }
        : {}),
    });
  } catch (err) {
    logger.error({ err }, "[verify/phone/send] error");
    sendError(res, "Failed to send OTP. Please try again.", 500);
  }
});

/* ── POST /verify/phone/confirm ──────────────────────────────────────────────
   Validate phone OTP and mark phoneVerified=true.
─────────────────────────────────────────────────────────────────────────── */
const confirmOtpSchema = z.object({ otp: z.string().length(6, "OTP must be 6 digits") });

router.post("/phone/confirm", validateBody(confirmOtpSchema), async (req, res) => {
  try {
    const userId = req.customerId ?? req.riderId ?? req.vendorId;
    if (!userId) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { otp } = req.body as { otp: string };

    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone, phoneVerified: usersTable.phoneVerified })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }
    if (user.phoneVerified) {
      sendSuccess(res, { alreadyVerified: true, message: "Phone is already verified." });
      return;
    }
    if (!user.phone) {
      sendValidationError(res, "No phone number on this account.");
      return;
    }

    const otpHash = hashOtp(otp);
    const token = await getActiveOtpToken({
      identifier: user.phone,
      identifierType: "phone",
      otpType: "verify_phone",
    });

    if (!token || token.otpHash !== otpHash) {
      sendError(res, "Invalid or expired OTP. Please request a new one.", 400);
      return;
    }

    await markOtpUsed(token.id);

    await db
      .update(usersTable)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    await awardVerificationBonus(userId, "phone");

    sendSuccess(res, { verified: true, message: "Phone number verified successfully." });
  } catch (err) {
    logger.error({ err }, "[verify/phone/confirm] error");
    sendError(res, "Failed to confirm OTP. Please try again.", 500);
  }
});

/* ── POST /verify/email/send ─────────────────────────────────────────────────
   Send OTP to the authenticated user's email address for verification.
─────────────────────────────────────────────────────────────────────────── */
router.post("/email/send", async (req, res) => {
  try {
    const userId = req.customerId ?? req.riderId ?? req.vendorId;
    if (!userId) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, emailVerified: usersTable.emailVerified })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }
    if (user.emailVerified) {
      sendSuccess(res, { alreadyVerified: true, message: "Email is already verified." });
      return;
    }
    if (!user.email) {
      sendValidationError(res, "No email address on this account. Please update your profile first.");
      return;
    }

    const settings = await getCachedSettings();
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const ip = getClientIp(req);

    await saveOtpToken({
      identifier: user.email,
      identifierType: "email",
      otpType: "verify_email",
      otpHash,
      channel: "email",
      userId,
      ipAddress: ip,
    });

    const appName = settings["app_name"] ?? "AJKMart";

    await sendEmail({
      to: user.email,
      subject: `${appName} — Verify your email address`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#1A56DB;margin:0 0 16px;">Verify your email</h2>
          <p style="color:#374151;margin:0 0 16px;">
            Use the code below to verify your email address. It expires in 5 minutes.
          </p>
          <div style="background:#F3F4F6;border-radius:8px;padding:20px;text-align:center;margin:0 0 16px;">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1A56DB;">${otp}</span>
          </div>
          <p style="color:#6B7280;font-size:13px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    sendSuccess(res, { message: "Verification code sent to your email address." });
  } catch (err) {
    logger.error({ err }, "[verify/email/send] error");
    sendError(res, "Failed to send email OTP. Please try again.", 500);
  }
});

/* ── POST /verify/email/confirm ──────────────────────────────────────────────
   Validate email OTP and mark emailVerified=true.
─────────────────────────────────────────────────────────────────────────── */
router.post("/email/confirm", validateBody(confirmOtpSchema), async (req, res) => {
  try {
    const userId = req.customerId ?? req.riderId ?? req.vendorId;
    if (!userId) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { otp } = req.body as { otp: string };

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, emailVerified: usersTable.emailVerified })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }
    if (user.emailVerified) {
      sendSuccess(res, { alreadyVerified: true, message: "Email is already verified." });
      return;
    }
    if (!user.email) {
      sendValidationError(res, "No email address on this account.");
      return;
    }

    const otpHash = hashOtp(otp);
    const token = await getActiveOtpToken({
      identifier: user.email,
      identifierType: "email",
      otpType: "verify_email",
    });

    if (!token || token.otpHash !== otpHash) {
      sendError(res, "Invalid or expired OTP. Please request a new one.", 400);
      return;
    }

    await markOtpUsed(token.id);

    await db
      .update(usersTable)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    await awardVerificationBonus(userId, "email");

    sendSuccess(res, { verified: true, message: "Email address verified successfully." });
  } catch (err) {
    logger.error({ err }, "[verify/email/confirm] error");
    sendError(res, "Failed to confirm OTP. Please try again.", 500);
  }
});

/* ── POST /verify/documents ─────────────────────────────────────────────────
   Upload CNIC front + back documents for manual review.
   Sets documentsSubmitted=true.
─────────────────────────────────────────────────────────────────────────── */
router.post(
  "/documents",
  (docUpload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "licensePhoto", maxCount: 1 },
    { name: "vehiclePhoto", maxCount: 1 },
    { name: "regDoc", maxCount: 1 },
  ]) as unknown as import("express").RequestHandler),
  async (req, res) => {
    try {
      const userId = req.customerId ?? req.riderId ?? req.vendorId;
      const isRider = !!req.riderId;
      if (!userId) {
        sendForbidden(res, "Authentication required");
        return;
      }

      const [user] = await db
        .select({
          id: usersTable.id,
          documentsSubmitted: usersTable.documentsSubmitted,
          documentsApproved: usersTable.documentsApproved,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) {
        sendNotFound(res, "User not found");
        return;
      }
      if (user.documentsApproved) {
        sendSuccess(res, { alreadyApproved: true, message: "Documents are already approved." });
        return;
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const frontFile = files?.["cnicFront"]?.[0];
      const backFile = files?.["cnicBack"]?.[0];
      const licenseFile = files?.["licensePhoto"]?.[0];
      const vehicleFile = files?.["vehiclePhoto"]?.[0];
      const regDocFile = files?.["regDoc"]?.[0];

      /* Require at least one document — individual fields are optional so riders
         can submit whatever photos they have and upload the rest later from Profile. */
      if (!frontFile && !backFile && !licenseFile && !vehicleFile && !regDocFile) {
        sendValidationError(res, "At least one document photo is required");
        return;
      }

      const saveJobs: { key: string; job: Promise<string> }[] = [];
      if (frontFile)  saveJobs.push({ key: "front",   job: saveDocumentFile(userId, "front",   frontFile.buffer,   frontFile.mimetype) });
      if (backFile)   saveJobs.push({ key: "back",    job: saveDocumentFile(userId, "back",    backFile.buffer,    backFile.mimetype) });
      if (licenseFile) saveJobs.push({ key: "license", job: saveDocumentFile(userId, "license", licenseFile.buffer, licenseFile.mimetype) });
      if (vehicleFile) saveJobs.push({ key: "vehicle", job: saveDocumentFile(userId, "vehicle", vehicleFile.buffer, vehicleFile.mimetype) });
      if (regDocFile)  saveJobs.push({ key: "regDoc",  job: saveDocumentFile(userId, "regDoc",  regDocFile.buffer,  regDocFile.mimetype) });

      const savedUrls = await Promise.all(saveJobs.map((j) => j.job));
      const urlMap: Record<string, string> = {};
      saveJobs.forEach((j, i) => { urlMap[j.key] = savedUrls[i]!; });

      const frontUrl    = urlMap["front"];
      const backUrl     = urlMap["back"];
      const licenseUrl  = urlMap["license"];
      const vehicleUrl  = urlMap["vehicle"];
      const regDocUrl   = urlMap["regDoc"];

      await db
        .update(usersTable)
        .set({
          documentsSubmitted: true,
          kycStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      if (regDocUrl) {
        await db
          .update(riderProfilesTable)
          .set({ regDocUrl, updatedAt: new Date() })
          .where(eq(riderProfilesTable.userId, userId));
      }

      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId,
          title: "Documents Submitted",
          body: "Your KYC documents have been submitted for review. We will notify you once reviewed.",
          type: "system",
          icon: "document-text-outline",
        })
        .catch((e: Error) =>
          logger.warn({ err: e.message }, "[verify/documents] notification insert failed")
        );

      sendSuccess(res, {
        submitted: true,
        message: "Documents submitted for review. You will be notified once approved.",
        ...(frontUrl   ? { cnicFrontUrl: frontUrl }          : {}),
        ...(backUrl    ? { cnicBackUrl: backUrl }             : {}),
        ...(licenseUrl ? { licensePhotoUrl: licenseUrl }      : {}),
        ...(vehicleUrl ? { vehiclePhotoUrl: vehicleUrl }      : {}),
        ...(regDocUrl  ? { regDocUrl }                        : {}),
      });
    } catch (err) {
      logger.error({ err }, "[verify/documents] error");
      sendError(res, "Failed to submit documents. Please try again.", 500);
    }
  }
);

export default router;
