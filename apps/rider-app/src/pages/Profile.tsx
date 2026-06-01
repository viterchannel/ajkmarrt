import { createLogger } from "@/lib/logger";
import { ConfigFeatureGate } from "@/components/ConfigFeatureGate";
import { maskCnic } from "@/lib/cnicMask";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFcP, UpdateRiderProfileRequest } from "@workspace/api-zod";
import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  AlertTriangle,
  Award,
  BarChart2,
  Bell,
  Bike,
  Camera,
  CheckCircle,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  HelpCircle,
  XCircle,
  FileText,
  Home,
  Info,
  Landmark,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCcw,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Truck,
  Upload,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ProfileFooter } from "../components/profile/ProfileFooter";
import { InfoRow, SavedCheckmark, SkeletonProfile } from "../components/profile/ProfileHelpers";
import { ProfilePenaltyHistory } from "../components/profile/ProfilePenaltyHistory";
import { getRiderTier, getInitials } from "../components/home/HomeHeader";
import { ProfileReviews } from "../components/profile/ProfileReviews";
import { ProfileSettings } from "../components/profile/ProfileSettings";
import { SafeImage } from "../components/ui/SafeImage";
import { api } from "../lib/api";
import { useAuth } from "../lib/rider-auth";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";
import { useTheme } from "../lib/useTheme";
import { BANKS, CITIES_FALLBACK, VEHICLE_LABELS } from "../lib/constants";
const log = createLogger("[Profile]");

const fc = (n: string | number | null | undefined, currencySymbol = "Rs.") =>
  _sharedFcP(n != null ? String(n) : (n as null | undefined), currencySymbol);

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const VEHICLES_FALLBACK: Array<{ key: string; label: string }> = [
  { key: "bike",      label: "Bike / Motorcycle" },
  { key: "car",       label: "Car" },
  { key: "rickshaw",  label: "Rickshaw / QingQi" },
  { key: "van",       label: "Van" },
  { key: "bicycle",   label: "Bicycle" },
  { key: "on_foot",   label: "On Foot" },
];

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

const INPUT =
  "w-full bg-[#2A2A2A] border border-white/[0.10] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition-all";
const SELECT =
  "w-full bg-[#2A2A2A] border border-white/[0.10] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 appearance-none transition-all";
const LABEL = "text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block";

type EditSection = "personal" | "vehicle" | "bank" | null;

/** Profile payload shape — use shared type from @workspace/api-zod. */
type ProfilePayload = UpdateRiderProfileRequest;

export default function Profile() {
  const { user, logout, refreshUser, loading: authLoading } = useAuth();
  const { config } = usePlatformConfig();
  const currency = config.platform.currencySymbol ?? "Rs.";
  const riderKeepPct = config.rider?.keepPct ?? config.finance.riderEarningPct ?? 80;

  const { data: notifData } = useQuery({
    queryKey: ["rider-notifs-count"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const unread: number = notifData?.unread || 0;

  const { data: verifStatus, refetch: refetchVerifStatus } = useQuery({
    queryKey: ["rider-verification-status"],
    queryFn: () => api.getVerificationStatus(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  /* Sync auth-state cache when admin has verified phone/email/docs server-side.
     The `user` object is loaded from IndexedDB at startup and may be stale.
     Calling refreshUser() re-fetches getMe() so the rest of the app (feature
     gates, wallet, dashboard) immediately reflects the updated status too.    */
  useEffect(() => {
    if (!verifStatus || !user) return;
    const needsSync =
      (verifStatus.phoneVerified && !user.phoneVerified) ||
      (verifStatus.emailVerified && !user.emailVerified) ||
      (verifStatus.documentsApproved && !(user as any).documentsApproved);
    if (needsSync) void refreshUser?.();
  }, [verifStatus?.phoneVerified, verifStatus?.emailVerified, verifStatus?.documentsApproved]);

  const queryClient = useQueryClient();
  const kycMut = useMutation({
    mutationFn: () => api.requestKycReview(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rider-me"] });
      void queryClient.invalidateQueries({ queryKey: ["rider-verification-status"] });
      void import("@/lib/analytics").then(({ trackEvent: te }) => te("kyc_submitted"));
      toast({ title: T("kycReviewSubmitted") });
    },
    onError: (e: Error) => {
      toast({ title: e.message || T("kycRequestFailed"), variant: "destructive" });
    },
  });

  const { data: citiesData } = useQuery({
    queryKey: ["popular-cities"],
    queryFn: () => api.getPopularCities(),
    staleTime: 5 * 60 * 1000,
  });
  const CITIES: string[] = citiesData?.cities?.length ? citiesData.cities : CITIES_FALLBACK;

  const { data: vehicleTypesData, isLoading: vehicleTypesLoading } = useQuery({
    queryKey: ["vehicle-types"],
    queryFn: () => api.getVehicleTypes(),
    staleTime: 10 * 60 * 1000,
  });
  const VEHICLES: Array<{ key: string; label: string }> =
    vehicleTypesData?.types && vehicleTypesData.types.length > 0
      ? vehicleTypesData.types
      : VEHICLES_FALLBACK;

  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ["rider-banks"],
    queryFn: () =>
      fetch("/api/rider/banks")
        .then((r) => r.json() as Promise<{ success: boolean; data?: { banks: Array<{ value: string; label: string }> } }>)
        .then((json) => json.data ?? { banks: [] }),
    staleTime: 10 * 60 * 1000,
  });
  const BANKS_LIST: Array<{ value: string; label: string }> =
    banksData?.banks && banksData.banks.length > 0
      ? banksData.banks
      : BANKS.map((b) => ({ value: b, label: b }));

  const { data: cancelStatsData } = useQuery({
    queryKey: ["rider-cancel-stats"],
    queryFn: () => api.getCancelStats(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: ignoreStatsData } = useQuery({
    queryKey: ["rider-ignore-stats"],
    queryFn: () => api.getIgnoreStats(),
    staleTime: 2 * 60 * 1000,
  });

  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "vehicle" | "bank">("personal");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [savedSection, setSavedSection] = useState<EditSection>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [docUploading, setDocUploading] = useState<
    "cnic" | "license" | "regDoc" | "vehiclePhoto" | null
  >(null);
  const [docCompressing, setDocCompressing] = useState<
    "cnic" | "license" | "regDoc" | "vehiclePhoto" | null
  >(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cnicDocInputRef = useRef<HTMLInputElement | null>(null);
  const licenseDocInputRef = useRef<HTMLInputElement | null>(null);
  const regDocInputRef = useRef<HTMLInputElement | null>(null);
  const vehiclePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentsSectionRef = useRef<HTMLDivElement | null>(null);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const cnicFrontVerifyRef = useRef<HTMLInputElement | null>(null);
  const cnicBackVerifyRef = useRef<HTMLInputElement | null>(null);
  const licensePhotoVerifyRef = useRef<HTMLInputElement | null>(null);
  const regDocVerifyRef = useRef<HTMLInputElement | null>(null);
  const vehiclePhotoVerifyRef = useRef<HTMLInputElement | null>(null);
  const [cnicFrontFile, setCnicFrontFile] = useState<File | null>(null);
  const [cnicBackFile, setCnicBackFile] = useState<File | null>(null);
  const [licensePhotoFile, setLicensePhotoFile] = useState<File | null>(null);
  const [regDocFile, setRegDocFile] = useState<File | null>(null);
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [verifyDocsUploading, setVerifyDocsUploading] = useState(false);
  const [cnicFrontPreview, setCnicFrontPreview] = useState<string | null>(null);
  const [cnicBackPreview, setCnicBackPreview] = useState<string | null>(null);
  const [licensePhotoPreview, setLicensePhotoPreview] = useState<string | null>(null);
  const [regDocPreview, setRegDocPreview] = useState<string | null>(null);
  const [vehiclePhotoPreview, setVehiclePhotoPreview] = useState<string | null>(null);
  const [docUploadErrors, setDocUploadErrors] = useState<Record<string, string>>({});

  const { language, setLanguage } = useLanguage();
  useTheme();
  const T = (key: TranslationKey) => tDual(key, language);

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [cnic, setCnic] = useState(user?.cnic || "");
  const [city, setCity] = useState(user?.city || "");
  const [address, setAddress] = useState(user?.address || "");
  const [emergency, setEmergency] = useState(user?.emergencyContact || "");

  const [vehicleType, setVehicleType] = useState(user?.vehicleType || "");
  const [vehiclePlate, setVehiclePlate] = useState(user?.vehiclePlate || "");
  const [vehicleRegNo, setVehicleRegNo] = useState(user?.vehicleRegNo || "");
  const [drivingLicense, setDrivingLicense] = useState(user?.drivingLicense || "");

  const [bankName, setBankName] = useState(user?.bankName || "");
  const [bankAccount, setBankAccount] = useState(user?.bankAccount || "");
  const [bankAccountTitle, setBankAccountTitle] = useState(user?.bankAccountTitle || "");

  useEffect(() => {
    requestAnimationFrame(() => setFadeIn(true));
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  /* Deep-link: /profile?section=documents — scroll straight to the KYC
     document upload card so riders arriving from the feature-gate modal
     land exactly where they need to be. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "documents") return;
    const el = documentsSectionRef.current;
    if (!el) return;
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    return () => clearTimeout(t);
  }, []);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (phoneOtpCooldown <= 0) return;
    const t = setTimeout(() => setPhoneOtpCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [phoneOtpCooldown]);

  useEffect(() => {
    if (emailOtpCooldown <= 0) return;
    const t = setTimeout(() => setEmailOtpCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [emailOtpCooldown]);

  const TARGET_SIZE_BYTES = 500 * 1024;

  const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const scaleCanvas = (maxSide: number): HTMLCanvasElement => {
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            if (width >= height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas context unavailable")); return canvas; }
          ctx.drawImage(img, 0, 0, width, height);
          return canvas;
        };

        const tryCompress = (
          canvas: HTMLCanvasElement,
          quality: number,
          qualitySteps: number[],
          onResult: (blob: Blob) => void
        ) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
              if (blob.size <= TARGET_SIZE_BYTES || qualitySteps.length === 0) {
                onResult(blob);
                return;
              }
              const nextQuality = qualitySteps[0]!;
              const remaining = qualitySteps.slice(1);
              tryCompress(canvas, nextQuality, remaining, onResult);
            },
            "image/jpeg",
            quality
          );
        };

        const canvas1200 = scaleCanvas(1200);

        tryCompress(canvas1200, 0.7, [0.6, 0.5, 0.4], (blob1200) => {
          if (blob1200.size <= TARGET_SIZE_BYTES) {
            resolve(blob1200);
            return;
          }
          const canvas800 = scaleCanvas(800);
          tryCompress(canvas800, 0.5, [0.4, 0.3], (blob800) => {
            /* Surface error if still oversized after all compression passes */
            if (blob800.size > maxImageMb * 1024 * 1024) {
              reject(new Error("too_large"));
              return;
            }
            resolve(blob800);
          });
        });
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
      img.src = objectUrl;
    });

  const maxImageMb = config.uploads?.maxImageMb ?? 5;
  const allowedImageFormats =
    (config.uploads?.allowedImageFormats ?? []).length > 0
      ? config.uploads!.allowedImageFormats!.flatMap(
          (f) => [`image/${f}`, f === "jpeg" ? "image/jpg" : null].filter(Boolean) as string[]
        )
      : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
  const ALLOWED_IMAGE_MIME = allowedImageFormats;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_MIME.includes(file.type.toLowerCase())) {
      toast({ title: T("invalidFileType") });
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (file.size > maxImageMb * 1024 * 1024) {
      toast({ title: T("imageTooLarge").replace("{n}", String(maxImageMb)) });
      return;
    }
    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploadRes = await api.uploadFile({
        file: base64,
        filename: file.name,
        mimeType: file.type,
      });
      if (!uploadRes?.url) {
        if (isMountedRef.current) {
          toast({ title: T("uploadFailedNoUrl") });
          setAvatarUploading(false);
        }
        return;
      }
      try {
        await api.updateProfile({ avatar: uploadRes.url });
      } catch {
        if (isMountedRef.current) {
          toast({ title: T("failedSaveProfilePhoto"), variant: "destructive" });
          setAvatarUploading(false);
        }
        if (avatarInputRef.current) avatarInputRef.current.value = "";
        return;
      }
      await refreshUser();
      if (isMountedRef.current) toast({ title: T("profilePhotoUpdated") });
    } catch {
      if (isMountedRef.current) toast({ title: T("failedUploadPhoto"), variant: "destructive" });
    }
    if (isMountedRef.current) setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "cnic" | "license" | "regDoc" | "vehiclePhoto"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploadErrors((prev) => ({ ...prev, [kind]: "" }));
    if (!ALLOWED_IMAGE_MIME.includes(file.type.toLowerCase())) {
      setDocUploadErrors((prev) => ({ ...prev, [kind]: T("invalidFileType") }));
      return;
    }
    if (file.size > maxImageMb * 1024 * 1024) {
      setDocUploadErrors((prev) => ({
        ...prev,
        [kind]: T("documentTooLarge").replace("{n}", String(maxImageMb)),
      }));
      return;
    }
    setDocCompressing(kind);
    let uploadBlob: Blob = file;
    try {
      const compressed = await compressImage(file);
      uploadBlob = compressed;
    } catch (compressErr: unknown) {
      const msg = compressErr instanceof Error ? compressErr.message : "";
      if (msg === "too_large") {
        setDocCompressing(null);
        toast({
          title: "Image too large",
          description: "Please choose a smaller or lower-resolution photo.",
          variant: "destructive",
        });
        return;
      }
      /* other compression failures — fall back to original file */
    } finally {
      setDocCompressing(null);
    }
    setDocUploading(kind);
    try {
      const blobToRead = uploadBlob instanceof File ? uploadBlob : new File([uploadBlob], file.name, { type: "image/jpeg" });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blobToRead);
      });
      const uploadRes = await api.uploadFile({
        file: base64,
        filename: blobToRead.name,
        mimeType: blobToRead.type,
      });
      if (!uploadRes?.url) {
        toast({ title: T("uploadFailedNoUrl") });
        return;
      }
      /* Map each document kind to the appropriate profile field */
      const patch =
        kind === "cnic"
          ? { cnicDocUrl: uploadRes.url }
          : kind === "license"
            ? { licenseDocUrl: uploadRes.url }
            : kind === "regDoc"
              ? { regDocUrl: uploadRes.url }
              : { vehiclePhoto: uploadRes.url };
      await api.updateProfile(patch);
      await refreshUser();
      const labels: Record<typeof kind, string> = {
        cnic: T("cnicPhotoUploaded"),
        license: T("licensePhotoUploaded"),
        regDoc: T("regDocUploaded"),
        vehiclePhoto: T("vehiclePhotoUploaded"),
      };
      toast({ title: labels[kind] });
    } catch {
      toast({ title: T("failedUploadDoc") });
    } finally {
      setDocUploading(null);
      const refs = {
        cnic: cnicDocInputRef,
        license: licenseDocInputRef,
        regDoc: regDocInputRef,
        vehiclePhoto: vehiclePhotoInputRef,
      };
      const ref = refs[kind];
      if (ref.current) ref.current.value = "";
    }
  };

  const startEdit = (section: EditSection) => {
    if (section === "personal") {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setCnic(user?.cnic || "");
      setCity(user?.city || "");
      setAddress(user?.address || "");
      setEmergency(user?.emergencyContact || "");
    } else if (section === "vehicle") {
      setVehicleType(user?.vehicleType || "");
      setVehiclePlate(user?.vehiclePlate || "");
      setVehicleRegNo(user?.vehicleRegNo || "");
      setDrivingLicense(user?.drivingLicense || "");
    } else if (section === "bank") {
      setBankName(user?.bankName || "");
      setBankAccount(user?.bankAccount || "");
      setBankAccountTitle(user?.bankAccountTitle || "");
    }
    if (section) setActiveTab(section);
    setEditing(section);
  };

  /* Explicitly reset fields to current saved values when the user cancels editing.
     Previously only setEditing(null) was called, which relied on the user-change useEffect
     to sync fields — but that effect only runs when the user object itself changes. */
  const cancelEdit = (section: EditSection) => {
    if (section === "personal") {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setCnic(user?.cnic || "");
      setCity(user?.city || "");
      setAddress(user?.address || "");
      setEmergency(user?.emergencyContact || "");
    } else if (section === "vehicle") {
      setVehicleType(user?.vehicleType || "");
      setVehiclePlate(user?.vehiclePlate || "");
      setVehicleRegNo(user?.vehicleRegNo || "");
      setDrivingLicense(user?.drivingLicense || "");
    } else if (section === "bank") {
      setBankName(user?.bankName || "");
      setBankAccount(user?.bankAccount || "");
      setBankAccountTitle(user?.bankAccountTitle || "");
    }
    setEditing(null);
  };

  /* P1: Re-sync form fields when user data updates from server (e.g. after refreshUser).
     The `editing` flag must be in the deps because flipping it from a section
     name back to `null` (e.g. cancelling an edit) needs to reset the form to
     the server values, even if the `user` reference hasn't changed since open.
     Without this, typed-but-cancelled text leaks into the next edit session. */
  useEffect(() => {
    if (!editing) {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setCnic(user?.cnic || "");
      setCity(user?.city || "");
      setAddress(user?.address || "");
      setEmergency(user?.emergencyContact || "");
      setVehicleType(user?.vehicleType || "");
      setVehiclePlate(user?.vehiclePlate || "");
      setVehicleRegNo(user?.vehicleRegNo || "");
      setDrivingLicense(user?.drivingLicense || "");
      setBankName(user?.bankName || "");
      setBankAccount(user?.bankAccount || "");
      setBankAccountTitle(user?.bankAccountTitle || "");
    }
  }, [user, editing]);

  const saveSection = async (section: EditSection) => {
    setSaving(true);
    try {
      const payload: ProfilePayload = {};
      if (section === "personal") {
        if (!name.trim()) {
          toast({ title: T("nameRequired") });
          setSaving(false);
          return;
        }
        if (email && email.trim()) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(email.trim())) {
            toast({ title: T("enterValidEmail"), variant: "destructive" });
            setSaving(false);
            return;
          }
        }
        if (cnic && cnic.trim()) {
          const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
          if (!cnicPattern.test(cnic.trim())) {
            toast({ title: T("cnicFormatError"), variant: "destructive" });
            setSaving(false);
            return;
          }
        }
        /* P2: Only send keys whose trimmed value is non-empty. Backend
           validators commonly accept `null`/missing for optional fields but
           reject `""` (CNIC and email are both like that). Cleared fields
           used to bounce the entire save with a confusing validation error. */
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedCnic = cnic.trim();
        const trimmedAddress = (address ?? "").trim();
        const trimmedEmergency = (emergency ?? "").trim();
        Object.assign(payload, {
          ...(trimmedName ? { name: trimmedName } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          ...(trimmedCnic ? { cnic: trimmedCnic } : {}),
          ...(city ? { city } : {}),
          ...(trimmedAddress ? { address: trimmedAddress } : {}),
          ...(trimmedEmergency ? { emergencyContact: trimmedEmergency } : {}),
        });
      }
      if (section === "vehicle")
        Object.assign(payload, { vehicleType, vehiclePlate, vehicleRegNo, drivingLicense });
      if (section === "bank") {
        if (!bankAccount || bankAccount.trim().length < 8) {
          toast({ title: T("bankAccountRequired") });
          setSaving(false);
          return;
        }
        if (!bankAccountTitle || !bankAccountTitle.trim()) {
          toast({ title: T("bankAccountTitleRequired") });
          setSaving(false);
          return;
        }
        if (!bankName) {
          toast({ title: T("bankNameRequired") });
          setSaving(false);
          return;
        }
        Object.assign(payload, {
          bankName,
          bankAccount: bankAccount.trim(),
          bankAccountTitle: bankAccountTitle.trim(),
        });
      }
      const result = await api.updateProfile(payload as Record<string, unknown>);
      await refreshUser();
      setEditing(null);
      setSavedSection(section);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedSection(null), 3000);
      if (result?.pendingVerification) {
        setPendingVerification(true);
      }
      toast({ title: T("changesSaved") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : T("saveFailedMsg");
      toast({ title: msg, variant: "destructive" });
    }
    setSaving(false);
  };

  const OTP_COOLDOWN_SEC = 60;

  const sendPhoneOtp = async () => {
    if (phoneOtpCooldown > 0) return;
    setPhoneOtpSending(true);
    setPhoneOtpError("");
    try {
      const res = await api.sendPhoneVerifyOtp();
      if (res.alreadyVerified) {
        toast({ title: "Phone is already verified" });
        await refreshUser();
        return;
      }
      setPhoneOtpSent(true);
      setPhoneOtpCooldown(OTP_COOLDOWN_SEC);
      toast({ title: "OTP sent to your phone" });
      if (res.devOtp) setPhoneOtp(res.devOtp);
    } catch (e: unknown) {
      setPhoneOtpError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setPhoneOtpSending(false);
    }
  };

  const confirmPhoneOtp = async () => {
    if (!phoneOtp.trim() || phoneOtp.trim().length !== 6) {
      setPhoneOtpError("Please enter the 6-digit OTP");
      return;
    }
    setPhoneOtpVerifying(true);
    setPhoneOtpError("");
    try {
      await api.confirmPhoneVerifyOtp(phoneOtp.trim());
      toast({ title: "Phone verified successfully!" });
      setPhoneOtpSent(false);
      setPhoneOtp("");
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ["rider-available-features"] });
      void refetchVerifStatus();
    } catch (e: unknown) {
      setPhoneOtpError(e instanceof Error ? e.message : "Invalid or expired OTP");
    } finally {
      setPhoneOtpVerifying(false);
    }
  };

  const sendEmailOtp = async () => {
    if (emailOtpCooldown > 0) return;
    setEmailOtpSending(true);
    setEmailOtpError("");
    try {
      const res = await api.sendEmailVerifyOtp();
      if (res.alreadyVerified) {
        toast({ title: "Email is already verified" });
        await refreshUser();
        return;
      }
      setEmailOtpSent(true);
      setEmailOtpCooldown(OTP_COOLDOWN_SEC);
      toast({ title: "Verification code sent to your email" });
    } catch (e: unknown) {
      setEmailOtpError(e instanceof Error ? e.message : "Failed to send email OTP");
    } finally {
      setEmailOtpSending(false);
    }
  };

  const confirmEmailOtp = async () => {
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setEmailOtpError("Please enter the 6-digit code");
      return;
    }
    setEmailOtpVerifying(true);
    setEmailOtpError("");
    try {
      await api.confirmEmailVerifyOtp(emailOtp.trim());
      toast({ title: "Email verified successfully!" });
      setEmailOtpSent(false);
      setEmailOtp("");
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ["rider-available-features"] });
      void refetchVerifStatus();
    } catch (e: unknown) {
      setEmailOtpError(e instanceof Error ? e.message : "Invalid or expired code");
    } finally {
      setEmailOtpVerifying(false);
    }
  };

  const submitVerifyDocuments = async () => {
    if (!cnicFrontFile || !cnicBackFile) {
      toast({ title: "Please select both CNIC front and back photos", variant: "destructive" });
      return;
    }
    if (!licensePhotoFile) {
      toast({ title: "Please select your driving license photo", variant: "destructive" });
      return;
    }
    setVerifyDocsUploading(true);
    try {
      const fd = new FormData();
      fd.append("cnicFront", cnicFrontFile);
      fd.append("cnicBack", cnicBackFile);
      fd.append("licensePhoto", licensePhotoFile);
      if (vehiclePhotoFile) fd.append("vehiclePhoto", vehiclePhotoFile);
      if (regDocFile) fd.append("regDoc", regDocFile);
      const res = await api.uploadVerifyDocuments(fd);
      if (res.alreadyApproved) {
        toast({ title: "Documents already approved" });
      } else {
        toast({ title: "KYC documents submitted for review!" });
      }
      setCnicFrontFile(null);
      setCnicBackFile(null);
      setLicensePhotoFile(null);
      setRegDocFile(null);
      setVehiclePhotoFile(null);
      if (cnicFrontPreview) { URL.revokeObjectURL(cnicFrontPreview); setCnicFrontPreview(null); }
      if (cnicBackPreview) { URL.revokeObjectURL(cnicBackPreview); setCnicBackPreview(null); }
      if (licensePhotoPreview) { URL.revokeObjectURL(licensePhotoPreview); setLicensePhotoPreview(null); }
      if (regDocPreview) { URL.revokeObjectURL(regDocPreview); setRegDocPreview(null); }
      if (vehiclePhotoPreview) { URL.revokeObjectURL(vehiclePhotoPreview); setVehiclePhotoPreview(null); }
      if (cnicFrontVerifyRef.current) cnicFrontVerifyRef.current.value = "";
      if (cnicBackVerifyRef.current) cnicBackVerifyRef.current.value = "";
      if (licensePhotoVerifyRef.current) licensePhotoVerifyRef.current.value = "";
      if (regDocVerifyRef.current) regDocVerifyRef.current.value = "";
      if (vehiclePhotoVerifyRef.current) vehiclePhotoVerifyRef.current.value = "";
      setDocUploadErrors({});
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ["rider-available-features"] });
      void refetchVerifStatus();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Failed to submit documents", variant: "destructive" });
    } finally {
      setVerifyDocsUploading(false);
    }
  };

  const completionFieldMap: { key: string; label: string; val: unknown }[] = [
    { key: "name", label: T("fullName"), val: editing === "personal" ? name : user?.name },
    { key: "cnic", label: T("cnicNationalId"), val: editing === "personal" ? cnic : user?.cnic },
    { key: "city", label: T("cityLabel"), val: editing === "personal" ? city : user?.city },
    {
      key: "vehicleType",
      label: T("vehicleType"),
      val: editing === "vehicle" ? vehicleType : user?.vehicleType,
    },
    {
      key: "vehiclePlate",
      label: T("vehiclePlate"),
      val: editing === "vehicle" ? vehiclePlate : user?.vehiclePlate,
    },
    {
      key: "bankName",
      label: T("bankDetails"),
      val: editing === "bank" ? bankName : user?.bankName,
    },
  ];
  /* Explicitly check for non-null AND non-empty-string to avoid false positives from empty string fields */
  const completionFilled = completionFieldMap.filter(
    (f) => f.val != null && f.val !== undefined && f.val !== ""
  );
  const completionPct = Math.round((completionFilled.length / completionFieldMap.length) * 100);
  const missingCount = completionFieldMap.length - completionFilled.length;

  const totalDeliveries = user?.stats?.totalDeliveries || 0;
  const totalEarnings = user?.stats?.totalEarnings || 0;
  const rating = user?.stats?.rating ?? 5.0;

  const quickActions = [
    {
      href: "/wallet",
      icon: <Wallet size={24} className="text-brand" />,
      label: T("wallet"),
    },
    {
      href: "/earnings",
      icon: <BarChart2 size={24} className="text-success" />,
      label: T("yourEarnings"),
    },
    {
      href: "/history",
      icon: <ClipboardList size={24} className="text-indigo-400" />,
      label: T("myOrders"),
    },
    {
      href: "/reviews",
      icon: <Star size={24} className="text-warning" />,
      label: "Reviews",
    },
    {
      href: "/help",
      icon: <HelpCircle size={24} className="text-blue-400" />,
      label: "Help & FAQ",
    },
    {
      href: "/settings",
      icon: <Settings size={24} className="text-white/50" />,
      label: "Settings",
    },
  ];

  const handleLogout = () => {
    if (!logoutConfirm) {
      setLogoutConfirm(true);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = setTimeout(() => setLogoutConfirm(false), 4000);
      return;
    }
    // Explicitly clear all client storage layers before the auth-context logout
    // so no stale credentials or session data survive on the device.
    try {
      sessionStorage.clear();
    } catch (err) {
      log.warn("[Profile] sessionStorage.clear failed:", err);
    }
    try {
      localStorage.clear();
    } catch (err) {
      log.warn("[Profile] localStorage.clear failed:", err);
    }
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/preferences")
        .then(({ Preferences }) => {
          Preferences.clear().catch((err: unknown) => {
            log.warn("[Profile] Preferences.clear failed:", err);
          });
        })
        .catch((err: unknown) => {
          log.warn("[Profile] @capacitor/preferences import failed:", err);
        });
    }
    logout();
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      logout("/");
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Failed to delete account. Please try again.", variant: "destructive" });
      throw e;
    }
  };

  const maskAccount = useCallback((acc: string) => {
    if (!acc || acc.length <= 4) return acc || "****";
    return "•••• " + acc.slice(-4);
  }, []);

  if (authLoading) return <SkeletonProfile />;

  return (
    <div
      className={`min-h-screen bg-page-bg transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
    >
      {pendingVerification && (
        <div className="fixed top-4 right-4 left-4 z-40 flex animate-[slideDown_0.3s_ease-out] items-start gap-3 rounded-2xl bg-warning px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-warning/70" />
          <div className="flex-1">
            <p className="font-extrabold">Pending Re-Verification</p>
            <p className="mt-0.5 text-xs leading-relaxed font-medium text-warning/70">
              Your profile changes require admin approval. You cannot go online until your account
              is re-verified.
            </p>
          </div>
          <button
            onClick={() => setPendingVerification(false)}
            className="flex-shrink-0 text-warning/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div
        className="relative border-b border-white/[0.06] bg-page-bg px-5 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="relative mb-2 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-widest text-white/40 uppercase">
              {T("riderProfileSettings")}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {T("myAccountTitle")}
            </h1>
          </div>
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-white transition-colors active:bg-white/[0.08]"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-error text-[9px] font-extrabold text-white shadow-sm">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4 px-4 pb-4">

        {/* ── Avatar section ── */}
        <div className="animate-[slideUp_0.35s_ease-out] flex flex-col items-center py-6">
          <input
            type="file"
            accept="image/*"
            capture="user"
            ref={avatarInputRef}
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative h-20 w-20 flex-shrink-0"
          >
            <div className="h-20 w-20 overflow-hidden rounded-full ring-2 ring-brand/30 ring-offset-2 ring-offset-page-bg">
              {user?.avatar ? (
                <SafeImage
                  src={user.avatar}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand/20">
                  <span className="text-2xl font-extrabold text-brand">
                    {getInitials(user?.name)}
                  </span>
                </div>
              )}
            </div>
            {avatarUploading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : (
              <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-page-bg bg-card-dark shadow">
                <Camera size={11} className="text-white/70" />
              </div>
            )}
          </button>

          <h2 className="mt-3 text-[18px] font-extrabold tracking-tight text-white">
            {user?.name || "Rider"}
          </h2>

          {(() => {
            const tier = getRiderTier(rating);
            return tier.label !== "Standard" ? (
              <span className={`mt-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.cls}`}>
                {tier.label}
              </span>
            ) : null;
          })()}

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/30">
              {user?.isOnline
                ? "Online now"
                : `Last online · ${timeAgo((user as any)?.lastSeen ?? (user as any)?.updatedAt)}`}
            </span>
            {user?.createdAt && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/30">
                Member since{" "}
                {new Date(user.createdAt).toLocaleDateString("en-PK", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="flex flex-row gap-2.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="animate-[slideUp_0.4s_ease-out] flex min-w-[90px] flex-1 flex-col items-center rounded-2xl border border-white/[0.08] bg-card-dark p-3.5"
            style={{ animationDelay: "0ms", animationFillMode: "both" }}
          >
            <Package size={18} className="text-indigo-400" />
            <p className="mt-1.5 text-xl font-extrabold text-white">{totalDeliveries}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/25">
              {T("deliveriesLabel")}
            </p>
          </div>

          <div
            className="animate-[slideUp_0.4s_ease-out] flex min-w-[90px] flex-1 flex-col items-center rounded-2xl border border-white/[0.08] bg-card-dark p-3.5"
            style={{ animationDelay: "60ms", animationFillMode: "both" }}
          >
            <TrendingUp size={18} className="text-success" />
            <p className="mt-1.5 text-xl font-extrabold text-success">{fc(totalEarnings, currency)}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/25">
              {T("earnedStat")}
            </p>
          </div>

          <Link
            href="/wallet"
            className="animate-[slideUp_0.4s_ease-out] flex min-w-[90px] flex-1 flex-col items-center rounded-2xl border border-white/[0.08] bg-card-dark p-3.5 transition-colors active:bg-white/[0.07]"
            style={{ animationDelay: "120ms", animationFillMode: "both" }}
          >
            <Wallet size={18} className="text-brand" />
            <p className="mt-1.5 text-xl font-extrabold text-brand">
              {fc(user?.walletBalance ?? "0", currency)}
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/25">
              {T("walletStat")}
            </p>
          </Link>

          <div
            className="animate-[slideUp_0.4s_ease-out] flex min-w-[90px] flex-1 flex-col items-center rounded-2xl border border-white/[0.08] bg-card-dark p-3.5"
            style={{ animationDelay: "180ms", animationFillMode: "both" }}
          >
            <Star size={18} className="text-warning" />
            <p className="mt-1.5 text-xl font-extrabold text-warning">{rating.toFixed(1)}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/25">
              {T("ratingStat")}
            </p>
          </div>
        </div>

        {/* ── Quality Score Card with SVG ring ── */}
        {(() => {
          const cancelRate = cancelStatsData?.cancelRate ?? 0;
          const acceptanceRate = Math.max(0, 100 - cancelRate);
          const qualityScore = Math.round((acceptanceRate * 0.6) + ((rating / 5) * 100 * 0.4));
          const circumference = 2 * Math.PI * 36;
          const dashOffset = circumference * (1 - qualityScore / 100);
          const ringStroke = qualityScore >= 80 ? "#4CAF50" : qualityScore >= 60 ? "#FF9800" : "#F44336";
          const scoreTextColor = qualityScore >= 80 ? "text-success" : qualityScore >= 60 ? "text-warning" : "text-error";
          const ratingColor = rating >= 4.5 ? "text-success" : rating >= 3.5 ? "text-warning" : "text-error";
          return (
            <div className="animate-[slideUp_0.5s_ease-out] rounded-2xl border border-white/[0.08] bg-card-dark p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                Quality Score
              </p>
              <div className="flex items-center gap-4">
                {/* SVG ring */}
                <div className="relative flex-shrink-0">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle
                      cx="48" cy="48" r="36"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="7"
                    />
                    <circle
                      cx="48" cy="48" r="36"
                      fill="none"
                      stroke={ringStroke}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 48 48)"
                      style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-extrabold leading-none ${scoreTextColor}`}>
                      {qualityScore}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-white/30">
                      score
                    </span>
                  </div>
                </div>
              </div>
              {/* 3-column mini-grid */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2">
                  <CheckCircle size={12} className="text-success mb-1" />
                  <span className="text-[13px] font-extrabold text-success">
                    {acceptanceRate.toFixed(1)}%
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-white/30">Acceptance</span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2">
                  <XCircle size={12} className="text-error mb-1" />
                  <span className="text-[13px] font-extrabold text-error">
                    {cancelRate.toFixed(1)}%
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-white/30">Cancellation</span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2">
                  <Star size={12} className={`mb-1 ${ratingColor}`} />
                  <span className={`text-[13px] font-extrabold ${ratingColor}`}>
                    {rating.toFixed(1)}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-white/30">Rating</span>
                </div>
              </div>
              {(ignoreStatsData?.dailyIgnores ?? 0) > 0 && (
                <p className="mt-3 text-center text-[9px] text-white/25">
                  {ignoreStatsData!.dailyIgnores} request{ignoreStatsData!.dailyIgnores !== 1 ? "s" : ""} ignored today · {ignoreStatsData!.remaining} remaining
                </p>
              )}
            </div>
          );
        })()}

        {completionPct < 100 && (
          <div className="animate-[slideUp_0.55s_ease-out] rounded-3xl border border-warning/30 bg-warning/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-warning">{T("completeProfileLabel")}</p>
              <span className="text-[11px] font-semibold text-warning">
                {missingCount} {T("itemsRemaining")}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-warning/20">
              <div
                className="h-2 rounded-full bg-warning transition-all duration-700"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Quick Actions 3×2 grid ── */}
        <div className="animate-[slideUp_0.6s_ease-out]">
          <p className="mb-2.5 px-0.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
            {T("quickActionsLabel")}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-card-dark p-3.5 transition-transform active:scale-[0.96]"
              >
                {item.icon}
                <span className="text-center text-[11px] font-bold leading-tight text-white/70">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="animate-[slideUp_0.65s_ease-out] overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm">
          <div className="flex border-b border-white/10">
            {(["personal", "vehicle", "bank"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (editing && editing !== tab) setEditing(null);
                }}
                className={`relative flex-1 py-3.5 text-sm font-bold transition-all ${
                  activeTab === tab
                    ? "border-b-2 border-brand text-brand"
                    : "border-b-2 border-transparent text-white/40"
                }`}
              >
                {tab === "personal"
                  ? T("personalTab")
                  : tab === "vehicle"
                    ? T("vehicleTab")
                    : T("bankTab")}
                {savedSection === tab && (
                  <span className="absolute top-1 right-2">
                    <CheckCircle
                      size={12}
                      className="animate-[fadeIn_0.3s_ease-out] text-success"
                    />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="transition-all duration-300">
            {activeTab === "personal" && (
              <div className="animate-[fadeIn_0.25s_ease-out]">
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-white" />
                    <div>
                      <p className="text-[14px] font-bold text-white">
                        {T("personalInformation")}
                      </p>
                      <p className="text-[10px] text-[#B0B0B0]">{T("identityContact")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SavedCheckmark show={savedSection === "personal"} label={T("savedFeedback")} />
                    <button
                      onClick={() =>
                        editing === "personal" ? cancelEdit("personal") : startEdit("personal")
                      }
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        editing === "personal"
                          ? "bg-border-dark text-[#B0B0B0]"
                          : "bg-border-dark text-white active:bg-[#3A3A3A]"
                      }`}
                    >
                      {editing === "personal" ? (
                        <>
                          <span className="text-xs">✕</span> {T("cancel")}
                        </>
                      ) : (
                        <>
                          <Pencil size={12} /> {T("edit")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {editing === "personal" ? (
                  <div className="animate-[slideDown_0.3s_ease-out] space-y-3.5 p-5">
                    <div>
                      <label className={LABEL}>{T("phoneNumber")}</label>
                      <div
                        className={`${INPUT} flex cursor-not-allowed items-center bg-border-dark text-[#B0B0B0] select-none`}
                      >
                        {user?.phone || "—"}
                      </div>
                      <p className="mt-1 text-[10px] text-[#B0B0B0]">
                        Phone number cannot be changed here. Contact support to update it.
                      </p>
                    </div>
                    <div>
                      <label className={LABEL}>{T("fullNameRequired")}</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={T("enterFullName")}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{T("emailAddress")}</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        inputMode="email"
                        placeholder="email@example.com"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{T("cnicNationalId")}</label>
                      <input
                        value={cnic}
                        onChange={(e) => setCnic(formatCnic(e.target.value))}
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="XXXXX-XXXXXXX-X"
                        className={INPUT}
                      />
                      {cnic && !/^\d{5}-\d{7}-\d{1}$/.test(cnic) && (
                        <p className="mt-1 text-[10px] text-error">Format: XXXXX-XXXXXXX-X</p>
                      )}
                    </div>
                    <div>
                      <label className={LABEL}>{T("cityLabel")}</label>
                      <div className="relative">
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={SELECT}
                        >
                          <option value="">{T("selectCity")}</option>
                          {CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]" />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>{T("homeAddress")}</label>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={T("addressPlaceholder")}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{T("emergencyContactLabel")}</label>
                      <input
                        value={emergency}
                        onChange={(e) => setEmergency(e.target.value)}
                        inputMode="tel"
                        placeholder={T("emergencyPlaceholder")}
                        className={INPUT}
                      />
                    </div>
                    <button
                      onClick={() => saveSection("personal")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-black text-black transition-colors active:opacity-90 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <RefreshCcw size={15} className="animate-spin" /> {T("saving")}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} /> {T("saveChangesBtn")}
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="py-1">
                    <InfoRow
                      label={T("fullName")}
                      value={user?.name}
                      empty={T("notSet")}
                      icon={<User size={12} className="text-[#B0B0B0]" />}
                    />
                    <InfoRow
                      label={T("phoneNumber")}
                      value={user?.phone}
                      empty={T("notSet")}
                      icon={<Phone size={12} className="text-blue-500" />}
                    />
                    <InfoRow
                      label={T("emailAddress")}
                      value={user?.email}
                      empty={T("notSet")}
                      icon={<Mail size={12} className="text-purple-500" />}
                    />
                    <InfoRow
                      label={T("cnicNationalId")}
                      value={maskCnic(user?.cnic)}
                      empty={T("notSet")}
                      icon={<FileText size={12} className="text-warning" />}
                    />
                    <InfoRow
                      label={T("cityLabel")}
                      value={user?.city}
                      empty={T("notSet")}
                      icon={<MapPin size={12} className="text-error" />}
                    />
                    <InfoRow
                      label={T("homeAddress")}
                      value={user?.address}
                      empty={T("notSet")}
                      icon={<Home size={12} className="text-success" />}
                    />
                    <InfoRow
                      label={T("emergencyContactLabel")}
                      value={user?.emergencyContact}
                      empty={T("notSet")}
                      icon={<Phone size={12} className="text-warning" />}
                    />

                    {/* Phone OTP Verification */}
                    {user?.phone && (
                      <div className="mx-4 my-3 rounded-2xl border border-white/10 bg-border-dark p-3.5">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-blue-500" />
                            <p className="text-xs font-bold text-[#B0B0B0]">Phone Verification</p>
                          </div>
                          {(verifStatus?.phoneVerified ?? user.phoneVerified) ? (
                            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                              <CheckCircle size={10} /> Verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                              Not verified
                            </span>
                          )}
                        </div>
                        {!(verifStatus?.phoneVerified ?? user.phoneVerified) && (
                          <>
                            {!phoneOtpSent ? (
                              <button
                                onClick={sendPhoneOtp}
                                disabled={phoneOtpSending || phoneOtpCooldown > 0}
                                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                              >
                                {phoneOtpSending ? (
                                  <><RefreshCcw size={12} className="animate-spin" /> Sending…</>
                                ) : phoneOtpCooldown > 0 ? (
                                  <><RefreshCcw size={12} /> Resend in {phoneOtpCooldown}s</>
                                ) : (
                                  <><Shield size={12} /> Verify Phone Number</>
                                )}
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-[#B0B0B0]">Enter the 6-digit OTP sent to {user.phone}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={phoneOtp}
                                    onChange={(e) => { setPhoneOtp(e.target.value.replace(/\D/g, "")); if (phoneOtpError) setPhoneOtpError(""); }}
                                    placeholder="000000"
                                    className="h-10 flex-1 rounded-xl border border-white/10 bg-border-dark px-3 text-center text-sm font-bold tracking-widest focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                  />
                                  <button
                                    onClick={confirmPhoneOtp}
                                    disabled={phoneOtpVerifying || phoneOtp.length !== 6}
                                    className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    {phoneOtpVerifying ? <RefreshCcw size={12} className="animate-spin" /> : "Confirm"}
                                  </button>
                                </div>
                                {phoneOtpCooldown > 0 ? (
                                  <p className="text-[10px] text-[#B0B0B0]">
                                    Resend available in {phoneOtpCooldown}s
                                  </p>
                                ) : (
                                  <button
                                    onClick={() => { setPhoneOtpSent(false); setPhoneOtp(""); setPhoneOtpError(""); }}
                                    className="text-[10px] text-[#B0B0B0] hover:text-[#B0B0B0]"
                                  >
                                    Resend OTP
                                  </button>
                                )}
                              </div>
                            )}
                            {phoneOtpError && (
                              <p className="mt-1.5 text-[10px] font-semibold text-error">{phoneOtpError}</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Email OTP Verification */}
                    <div className="mx-4 my-3 rounded-2xl border border-white/10 bg-border-dark p-3.5">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="text-purple-500" />
                          <p className="text-xs font-bold text-[#B0B0B0]">Email Verification</p>
                        </div>
                        {(verifStatus?.emailVerified ?? user?.emailVerified) ? (
                          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                            <CheckCircle size={10} /> Verified
                          </span>
                        ) : user?.email ? (
                          <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                            Not verified
                          </span>
                        ) : (
                          <span className="rounded-full bg-border-dark px-2.5 py-0.5 text-[10px] text-[#B0B0B0]">
                            No email set
                          </span>
                        )}
                      </div>
                      {!(verifStatus?.emailVerified ?? user?.emailVerified) && user?.email && (
                        <>
                          {!emailOtpSent ? (
                            <button
                              onClick={sendEmailOtp}
                              disabled={emailOtpSending || emailOtpCooldown > 0}
                              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
                            >
                              {emailOtpSending ? (
                                <><RefreshCcw size={12} className="animate-spin" /> Sending…</>
                              ) : emailOtpCooldown > 0 ? (
                                <><RefreshCcw size={12} /> Resend in {emailOtpCooldown}s</>
                              ) : (
                                <><Shield size={12} /> Verify Email Address</>
                              )}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] text-[#B0B0B0]">Enter the 6-digit code sent to {user.email}</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={emailOtp}
                                  onChange={(e) => { setEmailOtp(e.target.value.replace(/\D/g, "")); if (emailOtpError) setEmailOtpError(""); }}
                                  placeholder="000000"
                                  className="h-10 flex-1 rounded-xl border border-white/10 bg-border-dark px-3 text-center text-sm font-bold tracking-widest focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                />
                                <button
                                  onClick={confirmEmailOtp}
                                  disabled={emailOtpVerifying || emailOtp.length !== 6}
                                  className="h-10 rounded-xl bg-purple-600 px-4 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
                                >
                                  {emailOtpVerifying ? <RefreshCcw size={12} className="animate-spin" /> : "Confirm"}
                                </button>
                              </div>
                              {emailOtpCooldown > 0 ? (
                                <p className="text-[10px] text-[#B0B0B0]">
                                  Resend available in {emailOtpCooldown}s
                                </p>
                              ) : (
                                <button
                                  onClick={() => { setEmailOtpSent(false); setEmailOtp(""); setEmailOtpError(""); }}
                                  className="text-[10px] text-[#B0B0B0] hover:text-[#B0B0B0]"
                                >
                                  Resend code
                                </button>
                              )}
                            </div>
                          )}
                          {emailOtpError && (
                            <p className="mt-1.5 text-[10px] font-semibold text-error">{emailOtpError}</p>
                          )}
                        </>
                      )}
                      {!user?.email && (
                        <p className="text-[10px] text-[#B0B0B0]">
                          Add an email address in Edit mode to enable email verification.
                        </p>
                      )}
                    </div>

                    {/* CNIC Provided Status card */}
                    <div className="mx-4 my-3 rounded-2xl border border-white/10 bg-border-dark p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-warning" />
                          <p className="text-xs font-bold text-[#B0B0B0]">CNIC / National ID</p>
                        </div>
                        {user?.cnicProvided ? (
                          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                            <CheckCircle size={10} /> Provided
                          </span>
                        ) : (
                          <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                            Not provided
                          </span>
                        )}
                      </div>
                      {!user?.cnicProvided && (
                        <p className="mt-2 text-[10px] text-[#B0B0B0]">
                          Update your CNIC in Edit mode to complete your profile.
                        </p>
                      )}
                    </div>

                    {/* KYC Verification Status card */}
                    {(() => {
                      const kycStatus =
                        (user as { kycStatus?: string } | null)?.kycStatus ?? "none";
                      const cnicDocUrl = (user as { cnicDocUrl?: string } | null)?.cnicDocUrl;
                      const cnicBackDocUrl = (user as { cnicBackDocUrl?: string } | null)
                        ?.cnicBackDocUrl;
                      const licenseDocUrl = (user as { licenseDocUrl?: string } | null)
                        ?.licenseDocUrl;
                      const vehiclePhotoUrl = user?.vehiclePhoto;
                      const statusConfig = {
                        verified: {
                          bg: "bg-success/10 border-success/30",
                          badge: "bg-green-900/30 text-success",
                          icon: <CheckCircle size={10} className="inline" />,
                          label: "Verified",
                        },
                        pending: {
                          bg: "bg-warning/10 border-warning/30",
                          badge: "bg-warning/15 text-warning",
                          icon: <Clock size={10} className="inline" />,
                          label: "Under Review",
                        },
                        rejected: {
                          bg: "bg-error/10 border-error/30",
                          badge: "bg-error/15 text-error",
                          icon: <XCircle size={10} className="inline" />,
                          label: "Rejected",
                        },
                        none: {
                          bg: "bg-card-dark border-white/10",
                          badge: "bg-border-dark text-[#B0B0B0]",
                          icon: <HelpCircle size={10} className="inline" />,
                          label: "Not Submitted",
                        },
                      }[kycStatus] ?? {
                        bg: "bg-card-dark border-white/10",
                        badge: "bg-border-dark text-[#B0B0B0]",
                        icon: <HelpCircle size={10} className="inline" />,
                        label: kycStatus,
                      };

                      const docs = [
                        { label: "CNIC Front", done: !!cnicDocUrl },
                        { label: "CNIC Back", done: !!cnicBackDocUrl },
                        { label: "License", done: !!licenseDocUrl },
                        { label: "Vehicle", done: !!vehiclePhotoUrl },
                      ];

                      const canRequest = kycStatus === "none" || kycStatus === "rejected";
                      const hasDocs = !!(cnicDocUrl || licenseDocUrl || vehiclePhotoUrl);

                      return (
                        <div className={`mx-4 my-3 rounded-2xl border p-3.5 ${statusConfig.bg}`}>
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield size={14} className="text-[#B0B0B0]" />
                              <p className="text-xs font-bold text-[#B0B0B0]">Verification Status</p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusConfig.badge}`}
                            >
                              {statusConfig.icon} <span className="ml-0.5">{statusConfig.label}</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {docs.map((d) => (
                              <div
                                key={d.label}
                                className={`rounded-xl py-1.5 text-center text-[9px] font-semibold ${
                                  d.done
                                    ? "bg-green-900/30 text-success"
                                    : "bg-border-dark text-[#B0B0B0]"
                                }`}
                              >
                                <div className="mb-0.5 text-sm">{d.done ? <CheckCircle size={12} className="inline" /> : <span className="text-[#B0B0B0]">—</span>}</div>
                                {d.label}
                              </div>
                            ))}
                          </div>
                          {kycStatus === "rejected" && (
                            <p className="mt-2 text-[10px] font-medium text-error">
                              {(user as { rejectionReason?: string } | null)?.rejectionReason
                                ? `Rejected: ${(user as { rejectionReason?: string }).rejectionReason}`
                                : "Your documents were rejected. Please re-upload in the Vehicle tab."}
                            </p>
                          )}
                          {kycStatus === "none" && (
                            <p className="mt-2 text-[10px] text-[#B0B0B0]">
                              Upload your CNIC, driving licence, and vehicle photo to start KYC.
                            </p>
                          )}
                          {canRequest && hasDocs && (
                            <button
                              onClick={() => kycMut.mutate()}
                              disabled={kycMut.isPending}
                              className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                            >
                              {kycMut.isPending ? (
                                <>
                                  <Clock size={12} className="animate-spin" /> Submitting…
                                </>
                              ) : (
                                <>
                                  <Shield size={12} /> Request KYC Review
                                </>
                              )}
                            </button>
                          )}
                          {kycMut.isError && (
                            <p className="mt-1.5 text-center text-[10px] text-error">
                              {(kycMut.error as Error)?.message ?? "Failed to submit KYC request"}
                            </p>
                          )}
                          {kycMut.isSuccess && (
                            <p className="mt-1.5 text-center text-[10px] font-semibold text-blue-400">
                              Request submitted — your documents are under review.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* CNIC Document Upload for progressive verification
                        This div is the scroll target for /profile?section=documents deep link */}
                    <div ref={documentsSectionRef} />
                    {(() => {
                      const docsApproved = !!(verifStatus?.documentsApproved ?? user?.documentsApproved);
                      const docsSubmitted = !!(verifStatus?.documentsSubmitted ?? user?.documentsSubmitted);
                      const kycStatus = verifStatus?.kycStatus ?? (user as { kycStatus?: string } | null)?.kycStatus ?? "none";
                      const rejectionReason = verifStatus?.kycRejectionReason ?? (user as { rejectionReason?: string } | null)?.rejectionReason ?? null;
                      const isRejected = kycStatus === "rejected";

                      /* Structured per-document rejection list — set by admin when rejecting.
                         Keys: "cnic_front" | "cnic_back" | "license" | "vehicle_photo"
                         Falls back to keyword-parsing of rejectionReason text for older rejections
                         that predate the structured field, or if the array is empty. */
                      const kycRejectedDocs: string[] =
                        verifStatus?.kycRejectedDocs ?? (user as { kycRejectedDocs?: string[] | null } | null)?.kycRejectedDocs ?? [];
                      const hasStructured = kycRejectedDocs.length > 0;

                      /* Structured path: direct key lookup — no guessing */
                      const structuredFlagCnic    = kycRejectedDocs.includes("cnic_front") || kycRejectedDocs.includes("cnic_back");
                      const structuredFlagLicense  = kycRejectedDocs.includes("license");
                      const structuredFlagVehicle  = kycRejectedDocs.includes("vehicle_photo");

                      /* Keyword fallback for legacy rejections (pre-structured-field) */
                      const rl = (rejectionReason ?? "").toLowerCase();
                      const mentionsCnic    = rl.includes("cnic") || rl.includes("id card") || rl.includes("national id") || rl.includes("identity");
                      const mentionsLicense = rl.includes("license") || rl.includes("licence") || rl.includes("driving");
                      const mentionsVehicle = rl.includes("vehicle") || rl.includes("car") || rl.includes("bike") || rl.includes("motorcycle");
                      const anyMentioned    = mentionsCnic || mentionsLicense || mentionsVehicle;

                      /* Final flags — structured data wins; falls back to keyword or flag-all */
                      const flagCnic    = isRejected && (hasStructured ? structuredFlagCnic    : (mentionsCnic    || !anyMentioned));
                      const flagLicense = isRejected && (hasStructured ? structuredFlagLicense  : (mentionsLicense || !anyMentioned));
                      const flagVehicle = isRejected && (hasStructured ? structuredFlagVehicle  : (mentionsVehicle || !anyMentioned));

                      if (docsApproved) return null;
                      return (
                        <div className={`mx-4 my-3 rounded-2xl border p-3.5 transition-colors ${isRejected ? "border-error/30 bg-error/10" : "border-white/10 bg-card-dark"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isRejected
                                ? <AlertTriangle size={13} className="text-error" />
                                : <FileText size={13} className="text-indigo-500" />}
                              <p className={`text-xs font-bold ${isRejected ? "text-error" : "text-[#B0B0B0]"}`}>
                                {isRejected ? "Re-upload Documents" : "CNIC Verification"}
                              </p>
                            </div>
                            {isRejected ? (
                              <span className="flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 text-[10px] font-bold text-error">
                                <XCircle size={10} /> Rejected
                              </span>
                            ) : docsSubmitted ? (
                              <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                                <Clock size={10} /> Under Review
                              </span>
                            ) : (
                              <span className="rounded-full bg-border-dark px-2.5 py-0.5 text-[10px] text-[#B0B0B0]">
                                Not submitted
                              </span>
                            )}
                          </div>

                          {/* Rejection reason banner */}
                          {isRejected && (
                            <div className="mb-3 rounded-xl border border-error/30 bg-card-dark px-3 py-2.5">
                              <div className="mb-1 flex items-center gap-1.5">
                                <AlertTriangle size={11} className="flex-shrink-0 text-error" />
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-error">
                                  Reason for Rejection
                                </p>
                              </div>
                              <p className="text-[11px] font-medium leading-snug text-error">
                                {rejectionReason ?? "Your documents did not meet verification requirements. Please re-upload clear, legible photos."}
                              </p>
                              <p className="mt-1.5 text-[9px] text-error">
                                Documents highlighted in orange need to be replaced.
                              </p>
                            </div>
                          )}

                          {docsSubmitted ? (
                            <p className="text-[10px] text-[#B0B0B0]">
                              Your KYC documents are under review. You'll be notified once approved.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {!isRejected && (
                                <p className="text-[10px] text-[#B0B0B0]">
                                  Upload your CNIC (front &amp; back), driving license, and optionally a vehicle photo.
                                </p>
                              )}
                              {/* Hidden file inputs */}
                              <input ref={cnicFrontVerifyRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setDocUploadErrors((prev) => ({ ...prev, cnicFront: "" }));
                                  if (f && !ALLOWED_IMAGE_MIME.includes(f.type.toLowerCase())) {
                                    setDocUploadErrors((prev) => ({ ...prev, cnicFront: T("invalidFileType") }));
                                    return;
                                  }
                                  if (f && f.size > maxImageMb * 1024 * 1024) {
                                    setDocUploadErrors((prev) => ({ ...prev, cnicFront: T("documentTooLarge").replace("{n}", String(maxImageMb)) }));
                                    return;
                                  }
                                  setCnicFrontFile(f);
                                  if (cnicFrontPreview) URL.revokeObjectURL(cnicFrontPreview);
                                  setCnicFrontPreview(f ? URL.createObjectURL(f) : null);
                                }} />
                              <input ref={cnicBackVerifyRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setDocUploadErrors((prev) => ({ ...prev, cnicBack: "" }));
                                  if (f && !ALLOWED_IMAGE_MIME.includes(f.type.toLowerCase())) {
                                    setDocUploadErrors((prev) => ({ ...prev, cnicBack: T("invalidFileType") }));
                                    return;
                                  }
                                  if (f && f.size > maxImageMb * 1024 * 1024) {
                                    setDocUploadErrors((prev) => ({ ...prev, cnicBack: T("documentTooLarge").replace("{n}", String(maxImageMb)) }));
                                    return;
                                  }
                                  setCnicBackFile(f);
                                  if (cnicBackPreview) URL.revokeObjectURL(cnicBackPreview);
                                  setCnicBackPreview(f ? URL.createObjectURL(f) : null);
                                }} />
                              <input ref={licensePhotoVerifyRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setDocUploadErrors((prev) => ({ ...prev, licensePhotoVerify: "" }));
                                  if (f && !ALLOWED_IMAGE_MIME.includes(f.type.toLowerCase())) {
                                    setDocUploadErrors((prev) => ({ ...prev, licensePhotoVerify: T("invalidFileType") }));
                                    return;
                                  }
                                  if (f && f.size > maxImageMb * 1024 * 1024) {
                                    setDocUploadErrors((prev) => ({ ...prev, licensePhotoVerify: T("documentTooLarge").replace("{n}", String(maxImageMb)) }));
                                    return;
                                  }
                                  setLicensePhotoFile(f);
                                  if (licensePhotoPreview) URL.revokeObjectURL(licensePhotoPreview);
                                  setLicensePhotoPreview(f ? URL.createObjectURL(f) : null);
                                }} />
                              <input ref={regDocVerifyRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setDocUploadErrors((prev) => ({ ...prev, regDocVerify: "" }));
                                  if (f && !ALLOWED_IMAGE_MIME.includes(f.type.toLowerCase())) {
                                    setDocUploadErrors((prev) => ({ ...prev, regDocVerify: T("invalidFileType") }));
                                    return;
                                  }
                                  if (f && f.size > maxImageMb * 1024 * 1024) {
                                    setDocUploadErrors((prev) => ({ ...prev, regDocVerify: T("documentTooLarge").replace("{n}", String(maxImageMb)) }));
                                    return;
                                  }
                                  setRegDocFile(f);
                                  if (regDocPreview) URL.revokeObjectURL(regDocPreview);
                                  setRegDocPreview(f ? URL.createObjectURL(f) : null);
                                }} />
                              <input ref={vehiclePhotoVerifyRef} type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setDocUploadErrors((prev) => ({ ...prev, vehiclePhotoVerify: "" }));
                                  if (f && !ALLOWED_IMAGE_MIME.includes(f.type.toLowerCase())) {
                                    setDocUploadErrors((prev) => ({ ...prev, vehiclePhotoVerify: T("invalidFileType") }));
                                    return;
                                  }
                                  if (f && f.size > maxImageMb * 1024 * 1024) {
                                    setDocUploadErrors((prev) => ({ ...prev, vehiclePhotoVerify: T("documentTooLarge").replace("{n}", String(maxImageMb)) }));
                                    return;
                                  }
                                  setVehiclePhotoFile(f);
                                  if (vehiclePhotoPreview) URL.revokeObjectURL(vehiclePhotoPreview);
                                  setVehiclePhotoPreview(f ? URL.createObjectURL(f) : null);
                                }} />

                              {/* CNIC row */}
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <p className={`text-[9px] font-bold uppercase tracking-wider ${flagCnic ? "text-warning" : "text-[#B0B0B0]"}`}>
                                    CNIC <span className="text-error">*</span>
                                  </p>
                                  {flagCnic && !cnicFrontFile && (
                                    <span className="flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[8px] font-bold text-warning">
                                      <AlertTriangle size={7} /> Rejected — re-upload required
                                    </span>
                                  )}
                                </div>
                                {flagCnic && isRejected && (
                                  <p className="mb-1.5 text-[9px] leading-snug text-warning">
                                    {rejectionReason
                                      ? `Rejected: ${rejectionReason}`
                                      : "Your CNIC photos were rejected. Please upload clear, fully visible photos of both sides."}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  {/* CNIC Front */}
                                  <div>
                                    <button type="button" onClick={() => cnicFrontVerifyRef.current?.click()}
                                      className="group relative h-24 w-full overflow-hidden rounded-xl border-2 transition-all active:scale-[0.98]"
                                      style={{
                                        borderStyle: (flagCnic && !cnicFrontFile) ? "solid" : "dashed",
                                        borderColor: cnicFrontPreview ? "#6366f1" : (flagCnic && !cnicFrontFile) ? "#f97316" : "#e5e7eb",
                                        backgroundColor: (flagCnic && !cnicFrontFile) ? "#fff7ed" : undefined,
                                      }}>
                                      {cnicFrontPreview ? (
                                        <>
                                          <img src={cnicFrontPreview} alt="CNIC Front" className="h-full w-full object-cover" />
                                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                            <Camera size={16} className="text-white" />
                                            <span className="text-[10px] font-bold text-white">Change</span>
                                          </div>
                                          <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 py-0.5 text-center text-[9px] font-bold text-white">
                                            Front ✓
                                          </span>
                                        </>
                                      ) : (
                                        <div className={`flex h-full flex-col items-center justify-center gap-1.5 ${flagCnic ? "text-warning group-hover:text-warning" : "text-[#B0B0B0] group-hover:text-indigo-400"}`}>
                                          <Upload size={18} />
                                          <span className="text-[10px] font-semibold">Front Side</span>
                                          {flagCnic && <span className="text-[8px] font-bold text-warning">Tap to replace</span>}
                                        </div>
                                      )}
                                    </button>
                                    {docUploadErrors["cnicFront"] && (
                                      <p className="mt-1 text-xs text-red-500">{docUploadErrors["cnicFront"]}</p>
                                    )}
                                  </div>
                                  {/* CNIC Back */}
                                  <div>
                                    <button type="button" onClick={() => cnicBackVerifyRef.current?.click()}
                                      className="group relative h-24 w-full overflow-hidden rounded-xl border-2 transition-all active:scale-[0.98]"
                                      style={{
                                        borderStyle: (flagCnic && !cnicBackFile) ? "solid" : "dashed",
                                        borderColor: cnicBackPreview ? "#6366f1" : (flagCnic && !cnicBackFile) ? "#f97316" : "#e5e7eb",
                                        backgroundColor: (flagCnic && !cnicBackFile) ? "#fff7ed" : undefined,
                                      }}>
                                      {cnicBackPreview ? (
                                        <>
                                          <img src={cnicBackPreview} alt="CNIC Back" className="h-full w-full object-cover" />
                                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                            <Camera size={16} className="text-white" />
                                            <span className="text-[10px] font-bold text-white">Change</span>
                                          </div>
                                          <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 py-0.5 text-center text-[9px] font-bold text-white">
                                            Back ✓
                                          </span>
                                        </>
                                      ) : (
                                        <div className={`flex h-full flex-col items-center justify-center gap-1.5 ${flagCnic ? "text-warning group-hover:text-warning" : "text-[#B0B0B0] group-hover:text-indigo-400"}`}>
                                          <Upload size={18} />
                                          <span className="text-[10px] font-semibold">Back Side</span>
                                          {flagCnic && <span className="text-[8px] font-bold text-warning">Tap to replace</span>}
                                        </div>
                                      )}
                                    </button>
                                    {docUploadErrors["cnicBack"] && (
                                      <p className="mt-1 text-xs text-red-500">{docUploadErrors["cnicBack"]}</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Driving license */}
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <p className={`text-[9px] font-bold uppercase tracking-wider ${flagLicense ? "text-warning" : "text-[#B0B0B0]"}`}>
                                    Driving License <span className="text-error">*</span>
                                  </p>
                                  {flagLicense && !licensePhotoFile && (
                                    <span className="flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[8px] font-bold text-warning">
                                      <AlertTriangle size={7} /> Rejected — re-upload required
                                    </span>
                                  )}
                                </div>
                                {flagLicense && isRejected && (
                                  <p className="mb-1.5 text-[9px] leading-snug text-warning">
                                    {rejectionReason
                                      ? `Rejected: ${rejectionReason}`
                                      : "Your license photo was rejected. Please upload a clear, legible photo of your driving license."}
                                  </p>
                                )}
                                <button type="button" onClick={() => licensePhotoVerifyRef.current?.click()}
                                  className="group relative h-24 w-full overflow-hidden rounded-xl border-2 transition-all active:scale-[0.98]"
                                  style={{
                                    borderStyle: (flagLicense && !licensePhotoFile) ? "solid" : "dashed",
                                    borderColor: licensePhotoPreview ? "#6366f1" : (flagLicense && !licensePhotoFile) ? "#f97316" : "#e5e7eb",
                                    backgroundColor: (flagLicense && !licensePhotoFile) ? "#fff7ed" : undefined,
                                  }}>
                                  {licensePhotoPreview ? (
                                    <>
                                      <img src={licensePhotoPreview} alt="Driving License" className="h-full w-full object-cover" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                        <Camera size={16} className="text-white" />
                                        <span className="text-[10px] font-bold text-white">Change</span>
                                      </div>
                                      <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 py-0.5 text-center text-[9px] font-bold text-white">
                                        License ✓
                                      </span>
                                    </>
                                  ) : (
                                    <div className={`flex h-full flex-col items-center justify-center gap-1.5 ${flagLicense ? "text-warning group-hover:text-warning" : "text-[#B0B0B0] group-hover:text-indigo-400"}`}>
                                      <Upload size={18} />
                                      <span className="text-[10px] font-semibold">License Photo</span>
                                      {flagLicense && <span className="text-[8px] font-bold text-warning">Tap to replace</span>}
                                    </div>
                                  )}
                                </button>
                                {docUploadErrors["licensePhotoVerify"] && (
                                  <p className="mt-1 text-xs text-red-500">{docUploadErrors["licensePhotoVerify"]}</p>
                                )}
                              </div>

                              {/* Vehicle Registration document */}
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#B0B0B0]">
                                    Vehicle Registration <span className="ml-1 font-normal normal-case text-[#B0B0B0]">(optional)</span>
                                  </p>
                                </div>
                                <button type="button" onClick={() => regDocVerifyRef.current?.click()}
                                  className="group relative h-24 w-full overflow-hidden rounded-xl border-2 border-dashed border-white/20 transition-all active:scale-[0.98]">
                                  {regDocPreview ? (
                                    <>
                                      <img src={regDocPreview} alt="Vehicle Registration" className="h-full w-full object-cover" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                        <Camera size={16} className="text-white" />
                                        <span className="text-[10px] font-bold text-white">Change</span>
                                      </div>
                                      <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 py-0.5 text-center text-[9px] font-bold text-white">
                                        Reg. Doc ✓
                                      </span>
                                    </>
                                  ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[#B0B0B0] group-hover:text-indigo-400">
                                      <Upload size={18} />
                                      <span className="text-[10px] font-semibold">Registration Doc</span>
                                    </div>
                                  )}
                                </button>
                                {docUploadErrors["regDocVerify"] && (
                                  <p className="mt-1 text-xs text-red-500">{docUploadErrors["regDocVerify"]}</p>
                                )}
                              </div>

                              {/* Vehicle photo */}
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5">
                                  <p className={`text-[9px] font-bold uppercase tracking-wider ${flagVehicle ? "text-warning" : "text-[#B0B0B0]"}`}>
                                    Vehicle Photo
                                    {!flagVehicle && <span className="ml-1 font-normal normal-case text-[#B0B0B0]">(optional)</span>}
                                    {flagVehicle && <span className="text-error"> *</span>}
                                  </p>
                                  {flagVehicle && !vehiclePhotoFile && (
                                    <span className="flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[8px] font-bold text-warning">
                                      <AlertTriangle size={7} /> Rejected — re-upload required
                                    </span>
                                  )}
                                </div>
                                {flagVehicle && isRejected && (
                                  <p className="mb-1.5 text-[9px] leading-snug text-warning">
                                    {rejectionReason
                                      ? `Rejected: ${rejectionReason}`
                                      : "Your vehicle photo was rejected. Please upload a clear, unobstructed photo of your vehicle."}
                                  </p>
                                )}
                                <button type="button" onClick={() => vehiclePhotoVerifyRef.current?.click()}
                                  className="group relative h-24 w-full overflow-hidden rounded-xl border-2 transition-all active:scale-[0.98]"
                                  style={{
                                    borderStyle: (flagVehicle && !vehiclePhotoFile) ? "solid" : "dashed",
                                    borderColor: vehiclePhotoPreview ? "#6366f1" : (flagVehicle && !vehiclePhotoFile) ? "#f97316" : "#e5e7eb",
                                    backgroundColor: (flagVehicle && !vehiclePhotoFile) ? "#fff7ed" : undefined,
                                  }}>
                                  {vehiclePhotoPreview ? (
                                    <>
                                      <img src={vehiclePhotoPreview} alt="Vehicle" className="h-full w-full object-cover" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                                        <Camera size={16} className="text-white" />
                                        <span className="text-[10px] font-bold text-white">Change</span>
                                      </div>
                                      <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 py-0.5 text-center text-[9px] font-bold text-white">
                                        Vehicle ✓
                                      </span>
                                    </>
                                  ) : (
                                    <div className={`flex h-full flex-col items-center justify-center gap-1.5 ${flagVehicle ? "text-warning group-hover:text-warning" : "text-[#B0B0B0] group-hover:text-indigo-400"}`}>
                                      <Upload size={18} />
                                      <span className="text-[10px] font-semibold">Vehicle Photo</span>
                                      {flagVehicle && <span className="text-[8px] font-bold text-warning">Tap to replace</span>}
                                    </div>
                                  )}
                                </button>
                                {docUploadErrors["vehiclePhotoVerify"] && (
                                  <p className="mt-1 text-xs text-red-500">{docUploadErrors["vehiclePhotoVerify"]}</p>
                                )}
                              </div>

                              {/* Progress indicators */}
                              {(cnicFrontFile || cnicBackFile || licensePhotoFile || vehiclePhotoFile) && (
                                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 ${isRejected ? "bg-warning/10" : "bg-indigo-500/10"}`}>
                                  {[
                                    { label: "CNIC Front", done: !!cnicFrontFile, flagged: flagCnic },
                                    { label: "CNIC Back", done: !!cnicBackFile, flagged: flagCnic },
                                    { label: "License", done: !!licensePhotoFile, flagged: flagLicense },
                                    { label: "Vehicle", done: !!vehiclePhotoFile, flagged: flagVehicle },
                                  ].map((d) => (
                                    <div key={d.label} className="flex flex-1 flex-col items-center gap-0.5">
                                      <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                        d.done ? "bg-indigo-600 text-white" : d.flagged ? "bg-warning/20 text-warning" : "bg-border-dark text-[#B0B0B0]"
                                      }`}>
                                        {d.done ? "✓" : d.flagged ? "!" : "·"}
                                      </div>
                                      <span className={`text-center text-[8px] font-semibold leading-tight ${
                                        d.done ? "text-indigo-400" : d.flagged ? "text-warning" : "text-[#B0B0B0]"
                                      }`}>
                                        {d.label}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={submitVerifyDocuments}
                                disabled={verifyDocsUploading || !cnicFrontFile || !cnicBackFile || !licensePhotoFile}
                                className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
                                  isRejected ? "bg-warning hover:bg-warning" : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                              >
                                {verifyDocsUploading ? (
                                  <><RefreshCcw size={14} className="animate-spin" /> Uploading &amp; Submitting…</>
                                ) : isRejected ? (
                                  <><RefreshCcw size={14} /> Re-submit for Review</>
                                ) : (
                                  <><Shield size={14} /> Submit for Admin Review</>
                                )}
                              </button>
                              {(!cnicFrontFile || !cnicBackFile || !licensePhotoFile) && (
                                <p className={`text-center text-[9px] ${isRejected ? "text-warning" : "text-[#B0B0B0]"}`}>
                                  {isRejected
                                    ? "Replace the highlighted documents above to re-submit"
                                    : "Add CNIC front, back & license to submit"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {activeTab === "vehicle" && (
              <div className="animate-[fadeIn_0.25s_ease-out]">
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Bike size={15} className="text-white" />
                    <div>
                      <p className="text-[14px] font-bold text-white">{T("vehicleDetails")}</p>
                      <p className="text-[10px] text-[#B0B0B0]">{T("yourDeliveryVehicle")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SavedCheckmark show={savedSection === "vehicle"} label={T("savedFeedback")} />
                    <button
                      onClick={() =>
                        editing === "vehicle" ? cancelEdit("vehicle") : startEdit("vehicle")
                      }
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        editing === "vehicle"
                          ? "bg-border-dark text-[#B0B0B0]"
                          : "bg-border-dark text-white active:bg-[#3A3A3A]"
                      }`}
                    >
                      {editing === "vehicle" ? (
                        <>
                          <span className="text-xs">✕</span> {T("cancel")}
                        </>
                      ) : (
                        <>
                          <Pencil size={12} /> {T("edit")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {editing === "vehicle" ? (
                  <div className="animate-[slideDown_0.3s_ease-out] space-y-3.5 p-5">
                    <div>
                      <label className={LABEL}>{T("vehicleTypeRequired")}</label>
                      <div className="relative">
                        <select
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                          className={SELECT}
                        >
                          <option value="">{vehicleTypesLoading ? "Loading…" : T("selectVehicle")}</option>
                          {VEHICLES.map((v) => (
                            <option key={v.key} value={v.key}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]" />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>{T("vehiclePlateRequired")}</label>
                      <input
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        placeholder="ABC-1234"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Vehicle Registration No.</label>
                      <input
                        value={vehicleRegNo}
                        onChange={(e) => setVehicleRegNo(e.target.value)}
                        placeholder="REG-12345"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Driving License No.</label>
                      <input
                        value={drivingLicense}
                        onChange={(e) => setDrivingLicense(e.target.value)}
                        placeholder="DL-12345678"
                        className={INPUT}
                      />
                    </div>
                    {/* Document photo uploads — CNIC, License, Registration, and Vehicle photos */}
                    <ConfigFeatureGate
                      feature="docUpload"
                      fallback={
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-card-dark/20 px-3.5 py-3">
                          <Lock size={12} className="flex-shrink-0 text-[#B0B0B0]" />
                          <p className="text-[11px] text-[#B0B0B0]">
                            Document upload is currently unavailable
                          </p>
                        </div>
                      }
                    >
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-bold tracking-wider text-[#B0B0B0] uppercase">
                        Document Photos (for verification)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {/* CNIC photo upload */}
                        <div className="relative">
                          <input
                            ref={cnicDocInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleDocUpload(e, "cnic")}
                          />
                          <button
                            type="button"
                            onClick={() => cnicDocInputRef.current?.click()}
                            disabled={docUploading === "cnic" || docCompressing === "cnic"}
                            className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 transition-all active:bg-border-dark disabled:opacity-60"
                          >
                            {docCompressing === "cnic" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-blue-400" />
                                <span className="text-[10px] text-blue-400">Compressing…</span>
                              </>
                            ) : docUploading === "cnic" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-[#B0B0B0]" />
                                <span className="text-[10px] text-[#B0B0B0]">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Camera size={14} className="text-[#B0B0B0]" />
                                <span className="text-[10px] font-semibold text-[#B0B0B0]">
                                  CNIC Photo
                                </span>
                              </>
                            )}
                          </button>
                          {user?.cnicDocUrl && (
                            <CheckCircle
                              size={12}
                              className="absolute top-1 right-1 text-success"
                            />
                          )}
                          {docUploadErrors["cnic"] && (
                            <p className="mt-1 text-xs text-red-500">{docUploadErrors["cnic"]}</p>
                          )}
                        </div>
                        {/* Driving license photo upload */}
                        <div className="relative">
                          <input
                            ref={licenseDocInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleDocUpload(e, "license")}
                          />
                          <button
                            type="button"
                            onClick={() => licenseDocInputRef.current?.click()}
                            disabled={docUploading === "license" || docCompressing === "license"}
                            className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 transition-all active:bg-border-dark disabled:opacity-60"
                          >
                            {docCompressing === "license" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-blue-400" />
                                <span className="text-[10px] text-blue-400">Compressing…</span>
                              </>
                            ) : docUploading === "license" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-[#B0B0B0]" />
                                <span className="text-[10px] text-[#B0B0B0]">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Camera size={14} className="text-[#B0B0B0]" />
                                <span className="text-[10px] font-semibold text-[#B0B0B0]">
                                  License Photo
                                </span>
                              </>
                            )}
                          </button>
                          {user?.licenseDocUrl && (
                            <CheckCircle
                              size={12}
                              className="absolute top-1 right-1 text-success"
                            />
                          )}
                          {docUploadErrors["license"] && (
                            <p className="mt-1 text-xs text-red-500">{docUploadErrors["license"]}</p>
                          )}
                        </div>
                        {/* Vehicle registration document photo upload */}
                        <div className="relative">
                          <input
                            ref={regDocInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleDocUpload(e, "regDoc")}
                          />
                          <button
                            type="button"
                            onClick={() => regDocInputRef.current?.click()}
                            disabled={docUploading === "regDoc" || docCompressing === "regDoc"}
                            className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 transition-all active:bg-border-dark disabled:opacity-60"
                          >
                            {docCompressing === "regDoc" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-blue-400" />
                                <span className="text-[10px] text-blue-400">Compressing…</span>
                              </>
                            ) : docUploading === "regDoc" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-[#B0B0B0]" />
                                <span className="text-[10px] text-[#B0B0B0]">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Camera size={14} className="text-[#B0B0B0]" />
                                <span className="text-[10px] font-semibold text-[#B0B0B0]">
                                  Reg. Document
                                </span>
                              </>
                            )}
                          </button>
                          {user?.regDocUrl && (
                            <CheckCircle
                              size={12}
                              className="absolute top-1 right-1 text-success"
                            />
                          )}
                          {docUploadErrors["regDoc"] && (
                            <p className="mt-1 text-xs text-red-500">{docUploadErrors["regDoc"]}</p>
                          )}
                        </div>
                        {/* Vehicle photo upload */}
                        <div className="relative">
                          <input
                            ref={vehiclePhotoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleDocUpload(e, "vehiclePhoto")}
                          />
                          <button
                            type="button"
                            onClick={() => vehiclePhotoInputRef.current?.click()}
                            disabled={docUploading === "vehiclePhoto" || docCompressing === "vehiclePhoto"}
                            className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/10 transition-all active:bg-border-dark disabled:opacity-60"
                          >
                            {docCompressing === "vehiclePhoto" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-blue-400" />
                                <span className="text-[10px] text-blue-400">Compressing…</span>
                              </>
                            ) : docUploading === "vehiclePhoto" ? (
                              <>
                                <RefreshCcw size={14} className="animate-spin text-[#B0B0B0]" />
                                <span className="text-[10px] text-[#B0B0B0]">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Camera size={14} className="text-[#B0B0B0]" />
                                <span className="text-[10px] font-semibold text-[#B0B0B0]">
                                  Vehicle Photo
                                </span>
                              </>
                            )}
                          </button>
                          {user?.vehiclePhoto && (
                            <CheckCircle
                              size={12}
                              className="absolute top-1 right-1 text-success"
                            />
                          )}
                          {docUploadErrors["vehiclePhoto"] && (
                            <p className="mt-1 text-xs text-red-500">{docUploadErrors["vehiclePhoto"]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    </ConfigFeatureGate>
                    <button
                      onClick={() => saveSection("vehicle")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-black text-black transition-colors active:opacity-90 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <RefreshCcw size={15} className="animate-spin" /> {T("saving")}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} /> {T("saveChangesBtn")}
                        </>
                      )}
                    </button>
                  </div>
                ) : user?.vehicleType ? (
                  <div className="p-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-white">
                      <div className="absolute top-0 right-0 h-20 w-20 translate-x-1/2 -translate-y-1/2 rounded-full bg-card-dark/5" />
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wider text-[#B0B0B0] uppercase">
                          {T("registeredVehicle")}
                        </span>
                        <Bike size={18} className="text-success" />
                      </div>
                      <p className="mb-1 text-xl font-extrabold tracking-wide">
                        {user.vehiclePlate || "---"}
                      </p>
                      <p className="text-sm font-medium text-[#B0B0B0]">{user.vehicleType}</p>
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#B0B0B0]">{T("plateNumber")}</span>
                          <span className="flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                            <CheckCircle size={9} /> {T("activeVerified")}
                          </span>
                        </div>
                        {user.vehicleRegNo && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#B0B0B0]">Reg. No.</span>
                            <span className="text-[10px] font-medium text-[#B0B0B0]">
                              {user.vehicleRegNo}
                            </span>
                          </div>
                        )}
                        {user.drivingLicense && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#B0B0B0]">License</span>
                            <span className="text-[10px] font-medium text-[#B0B0B0]">
                              {user.drivingLicense}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-border-dark">
                      <Bike size={28} className="text-[#B0B0B0]" />
                    </div>
                    <p className="text-sm font-bold text-[#B0B0B0]">{T("noVehicle")}</p>
                    <p className="mt-1 text-xs text-[#B0B0B0]">{T("addVehicleInfo")}</p>
                    <button
                      onClick={() => startEdit("vehicle")}
                      className="mt-3 rounded-xl bg-border-dark px-5 py-2 text-sm font-bold text-white transition-colors active:bg-[#3A3A3A]"
                    >
                      + {T("addVehicle")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "bank" && (
              <div className="animate-[fadeIn_0.25s_ease-out]">
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Landmark size={15} className="text-white" />
                    <div>
                      <p className="text-[14px] font-bold text-white">{T("bankDetails")}</p>
                      <p className="text-[10px] text-[#B0B0B0]">{T("withdrawalAccount")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SavedCheckmark show={savedSection === "bank"} label={T("savedFeedback")} />
                    <button
                      onClick={() => (editing === "bank" ? cancelEdit("bank") : startEdit("bank"))}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        editing === "bank"
                          ? "bg-border-dark text-[#B0B0B0]"
                          : "bg-border-dark text-white active:bg-[#3A3A3A]"
                      }`}
                    >
                      {editing === "bank" ? (
                        <>
                          <span className="text-xs">✕</span> {T("cancel")}
                        </>
                      ) : (
                        <>
                          <Pencil size={12} /> {T("edit")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {editing === "bank" ? (
                  <div className="animate-[slideDown_0.3s_ease-out] space-y-3.5 p-5">
                    <div>
                      <label className={LABEL}>{T("selectBank")}</label>
                      <div className="relative">
                        <select
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className={SELECT}
                        >
                          <option value="">{banksLoading ? "Loading…" : T("selectBank")}</option>
                          {BANKS_LIST.map((b) => (
                            <option key={b.value} value={b.value}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]" />
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>{T("accountNoRequired")}</label>
                      <input
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        inputMode="numeric"
                        placeholder={T("bankAccPlaceholder")}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>{T("accountTitle")} *</label>
                      <input
                        value={bankAccountTitle}
                        onChange={(e) => setBankAccountTitle(e.target.value)}
                        placeholder={T("enterFullName")}
                        className={INPUT}
                      />
                    </div>
                    <div className="flex gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                      <p className="text-xs font-medium text-warning">{T("bankMobileWallet")}</p>
                    </div>
                    <button
                      onClick={() => saveSection("bank")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-black text-black transition-colors active:opacity-90 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <RefreshCcw size={15} className="animate-spin" /> {T("saving")}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} /> {T("saveChangesBtn")}
                        </>
                      )}
                    </button>
                  </div>
                ) : user?.bankName ? (
                  <div className="p-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-4 text-white">
                      <div className="absolute top-0 right-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-card-dark/5" />
                      <div className="absolute bottom-0 left-0 h-16 w-16 -translate-x-1/2 translate-y-1/2 rounded-full bg-card-dark/5" />
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wider text-[#B0B0B0] uppercase">
                          {T("paymentAccount")}
                        </span>
                        <CreditCard size={18} className="text-success" />
                      </div>
                      <p className="mb-1 font-mono text-lg font-bold tracking-wider">
                        {maskAccount(user.bankAccount || "")}
                      </p>
                      <p className="text-sm font-medium text-[#B0B0B0]">{user.bankName}</p>
                      {user.bankAccountTitle && (
                        <p className="mt-1 text-xs text-[#B0B0B0]">{user.bankAccountTitle}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3">
                        <span className="text-[10px] text-[#B0B0B0]">{T("accountTitle")}</span>
                        <span className="flex items-center gap-1 rounded-full bg-card-dark/15 px-2 py-0.5 text-[10px] font-bold text-white">
                          <CheckCircle size={9} /> {T("activeVerified")}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-border-dark">
                      <Landmark size={28} className="text-[#B0B0B0]" />
                    </div>
                    <p className="text-sm font-bold text-[#B0B0B0]">{T("noWithdrawalAccount")}</p>
                    <p className="mt-1 text-xs text-[#B0B0B0]">{T("addVehicleInfo")}</p>
                    <button
                      onClick={() => startEdit("bank")}
                      className="mt-3 rounded-xl bg-border-dark px-5 py-2 text-sm font-bold text-white transition-colors active:bg-[#3A3A3A]"
                    >
                      + {T("addAccount")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ProfileSettings
          language={language}
          setLanguage={setLanguage}
          unread={unread}
          onDeleteAccount={handleDeleteAccount}
        />

        <div className="animate-[slideUp_0.75s_ease-out] overflow-hidden rounded-3xl bg-card-dark">
          <button
            onClick={() => setPayoutOpen(!payoutOpen)}
            className="flex w-full items-center justify-between px-5 py-4 transition-colors active:bg-card-dark"
          >
            <p className="flex items-center gap-2 text-[15px] font-bold text-white">
              <Info size={15} className="text-white/50" /> {T("payoutPolicyLabel")}
            </p>
            <ChevronDown
              size={18}
              className={`text-white/50 transition-transform duration-300 ${payoutOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${payoutOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="space-y-2.5 px-5 pb-4">
              {[
                {
                  icon: <CheckCircle size={13} />,
                  text: T("payoutEarningsPct")
                    .replace("{keepPct}", String(riderKeepPct))
                    .replace("{feePct}", String(100 - riderKeepPct)),
                },
                {
                  icon: <CreditCard size={13} />,
                  text: T("payoutMinWithdrawal").replace(
                    "{amount}",
                    String(config.rider?.minPayout ?? 500)
                  ),
                },
                { icon: <Clock size={13} />, text: T("payoutProcessingTime") },
                { icon: <Lock size={13} />, text: T("payoutVerificationReq") },
              ].map((p, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-white/60">
                  <span className="mt-0.5 text-success">{p.icon}</span>
                  <span className="font-medium">{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProfilePenaltyHistory currency={currency} />

        <ProfileReviews language={language} currency={currency} />

        <button
          onClick={handleLogout}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-3xl text-sm font-bold transition-all duration-300 ${
            logoutConfirm
              ? "bg-error text-white shadow-md active:bg-error/90"
              : "border-2 border-error/30 text-error active:bg-error/10"
          }`}
        >
          <LogOut size={16} />
          {logoutConfirm ? T("tapAgainLogout") : T("logoutFromDevice")}
        </button>

        <ProfileFooter config={config} language={language} />
      </div>
    </div>
  );
}
