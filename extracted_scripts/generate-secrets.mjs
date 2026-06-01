#!/usr/bin/env node
/**
 * AJKMart — Auto-generate & inject cryptographic secrets
 * Run: node scripts/generate-secrets.mjs
 *
 * This script generates all required secrets and writes them
 * to a .env.local file AND sets them via Replit Secrets API.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Secret definitions ────────────────────────────────────────────────────────
const SECRETS = [
  { key: "JWT_SECRET",                bytes: 64 },
  { key: "ENCRYPTION_MASTER_KEY",     bytes: 32 },
  { key: "TOTP_ENCRYPTION_KEY",       bytes: 32 },
  { key: "TOKEN_HASH_SECRET",         bytes: 32 },
  { key: "HMAC_OTP_SECRET",           bytes: 32 },
  { key: "OTP_HMAC_SECRET",           bytes: 32 },
  { key: "ADMIN_ACCESS_TOKEN_SECRET", bytes: 64 },
  { key: "ADMIN_REFRESH_TOKEN_SECRET",bytes: 64 },
  { key: "ADMIN_CSRF_SECRET",         bytes: 32 },
  { key: "ERROR_REPORT_HMAC_SECRET",  bytes: 32 },
];

// ── Generate values ───────────────────────────────────────────────────────────
const generated = {};
for (const { key, bytes } of SECRETS) {
  generated[key] = crypto.randomBytes(bytes).toString("hex");
}

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║       AJKMart — Cryptographic Secrets Generator                  ║");
console.log("╚══════════════════════════════════════════════════════════════════╝\n");

// ── Write to .env.local ───────────────────────────────────────────────────────
const envLines = Object.entries(generated).map(([k, v]) => `${k}=${v}`).join("\n");
const envPath = path.join(ROOT, ".env.local");
fs.writeFileSync(envPath, envLines + "\n", "utf8");
console.log(`✅  Written to .env.local`);

// ── Try Replit Secrets API ────────────────────────────────────────────────────
const replitToken   = process.env.REPLIT_CLI_TOKEN  || process.env.REPLIT_IDENTITY;
const replId        = process.env.REPL_ID;
const replOwner     = process.env.REPL_OWNER;

let replitApiSuccess = false;

if (replitToken && replId) {
  try {
    const endpoint = `https://replit.com/data/repls/${replOwner}/${replId}/env`;
    const body = JSON.stringify(generated);
    const { default: https } = await import("https");

    await new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const req = https.request(
        { hostname: url.hostname, path: url.pathname, method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${replitToken}`,
                     "Content-Length": Buffer.byteLength(body) } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve(res.statusCode));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
    replitApiSuccess = true;
    console.log("✅  Secrets pushed to Replit Secrets panel via API");
  } catch {
    // Fall through to manual instructions
  }
}

// ── Print generated values ────────────────────────────────────────────────────
console.log("\n┌─────────────────────────────────────────────────────────────────┐");
console.log("│  Generated Secrets — add these to Replit Secrets panel          │");
console.log("│  (Tools → Secrets in the left sidebar)                          │");
console.log("└─────────────────────────────────────────────────────────────────┘\n");

for (const [key, value] of Object.entries(generated)) {
  console.log(`  ${key.padEnd(30)} = ${value}`);
}

if (!replitApiSuccess) {
  console.log("\n⚠️  Automatic injection unavailable — copy the values above into");
  console.log("   Replit Secrets panel, or run:\n");
  console.log("   node scripts/inject-secrets.mjs\n");
} else {
  console.log("\n🎉  All secrets have been set. Restart the workflow to apply them.\n");
}
