#!/usr/bin/env node
/**
 * AJKMart — Replit Auto-Setup Script
 *
 * Kya karta hai:
 *  1. Cryptographic secrets generate karta hai
 *  2. Root .env file mein likhta hai (API server yahi padhta hai)
 *  3. Existing values preserve karta hai (dobara run par overwrite nahi)
 *
 * Run:
 *   node scripts/setup-replit.mjs
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");

// ── Colors ────────────────────────────────────────────────────────────────────
const G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", B = "\x1b[1m", R = "\x1b[0m";

function info(msg)  { console.log(`${G}[setup]${R} ${msg}`); }
function warn(msg)  { console.log(`${Y}[warn]${R}  ${msg}`); }
function head(msg)  { console.log(`\n${B}${C}━━━  ${msg}  ━━━${R}`); }

// ── Secret definitions ────────────────────────────────────────────────────────
const SECRETS = [
  { key: "JWT_SECRET",                 bytes: 64, desc: "JWT signing key" },
  { key: "ENCRYPTION_MASTER_KEY",      bytes: 32, desc: "AES encryption master key" },
  { key: "TOTP_ENCRYPTION_KEY",        bytes: 32, desc: "TOTP secret encryption key" },
  { key: "TOKEN_HASH_SECRET",          bytes: 32, desc: "Magic link / email verify HMAC" },
  { key: "HMAC_OTP_SECRET",            bytes: 32, desc: "OTP HMAC key" },
  { key: "OTP_HMAC_SECRET",            bytes: 32, desc: "OTP HMAC key (alt)" },
  { key: "ADMIN_ACCESS_TOKEN_SECRET",  bytes: 64, desc: "Admin access JWT key" },
  { key: "ADMIN_REFRESH_TOKEN_SECRET", bytes: 64, desc: "Admin refresh JWT key" },
  { key: "ADMIN_CSRF_SECRET",          bytes: 32, desc: "Admin CSRF token key" },
  { key: "ERROR_REPORT_HMAC_SECRET",   bytes: 32, desc: "Error report HMAC key" },
  { key: "ADMIN_JWT_SECRET",           bytes: 64, desc: "Admin JWT (vault)" },
  { key: "ADMIN_REFRESH_SECRET",       bytes: 64, desc: "Admin refresh JWT (vault)" },
  { key: "ADMIN_SECRET",               bytes: 32, desc: "Admin secret (vault)" },
  { key: "VENDOR_JWT_SECRET",          bytes: 64, desc: "Vendor JWT (vault)" },
  { key: "RIDER_JWT_SECRET",           bytes: 64, desc: "Rider JWT (vault)" },
];

// ── Fixed env vars (non-secret config) ───────────────────────────────────────
const FIXED_VARS = {
  NODE_ENV:             "development",
  ALLOW_DEV_OTP:        "true",
  JWT_ISSUER:           "ajkmart",
  ADMIN_SEED_USERNAME:  "superadmin",
  ADMIN_SEED_EMAIL:     "admin@ajkmart.com",
  ADMIN_SEED_NAME:      "Super Admin",
  ADMIN_SEED_PASSWORD:  "Admin@123",
  VAPID_CONTACT_EMAIL:  "mailto:admin@ajkmart.app",
  VITE_API_PROXY_TARGET:"http://127.0.0.1:5000",
};

// ── Read existing .env ────────────────────────────────────────────────────────
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const existing = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    existing[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1);
  }
  return existing;
}

// ── Write .env ────────────────────────────────────────────────────────────────
function writeEnvFile(filePath, vars) {
  const sections = [
    ["# ── AJKMart Auto-Generated .env ───────────────────────────────────────────", {}],
    ["# ── Cryptographic Secrets ───────────────────────────────────────────────────", Object.fromEntries(SECRETS.map(s => [s.key, vars[s.key]]))],
    ["# ── App Config ──────────────────────────────────────────────────────────────", FIXED_VARS],
  ];

  const lines = [];
  for (const [comment, entries] of sections) {
    lines.push(comment);
    for (const [k, v] of Object.entries(entries)) {
      if (v !== undefined) lines.push(`${k}=${v}`);
    }
    lines.push("");
  }

  // Preserve any extra keys from previous .env (like DATABASE_URL set by Replit)
  const knownKeys = new Set([...SECRETS.map(s => s.key), ...Object.keys(FIXED_VARS)]);
  const extra = Object.entries(vars).filter(([k]) => !knownKeys.has(k));
  if (extra.length > 0) {
    lines.push("# ── Other / User-provided ───────────────────────────────────────────────────");
    for (const [k, v] of extra) lines.push(`${k}=${v}`);
    lines.push("");
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n${B}╔══════════════════════════════════════════════════════════════════╗`);
console.log(`║       AJKMart Replit Setup — Auto Secret Generator               ║`);
console.log(`╚══════════════════════════════════════════════════════════════════╝${R}\n`);

head("Step 1 — Reading existing .env");
const existing = readEnvFile(ENV_FILE);
const existingCount = Object.keys(existing).length;
info(existingCount > 0 ? `Found ${existingCount} existing keys in .env` : "No existing .env found — creating fresh one");

head("Step 2 — Generating missing secrets");
const generated = {};
let newCount = 0;
let skipCount = 0;

for (const { key, bytes, desc } of SECRETS) {
  if (existing[key]) {
    info(`  ${G}SKIP${R}  ${key.padEnd(32)} (already set)`);
    generated[key] = existing[key];
    skipCount++;
  } else {
    const value = crypto.randomBytes(bytes).toString("hex");
    generated[key] = value;
    newCount++;
    info(`  ${C}NEW${R}   ${key.padEnd(32)} ${Y}← ${desc}${R}`);
  }
}

head("Step 3 — Writing .env");
const allVars = { ...existing, ...generated, ...FIXED_VARS };
writeEnvFile(ENV_FILE, allVars);
info(`Written to: ${C}${ENV_FILE}${R}`);
info(`  ${newCount} secrets generated,  ${skipCount} preserved from previous run`);

head("Step 4 — Summary");
if (newCount > 0) {
  console.log(`\n${G}✅  Setup complete!${R}`);
  console.log(`\n   Naye generate kiye gaye secrets (${newCount}):\n`);
  for (const { key } of SECRETS) {
    if (!existing[key]) {
      console.log(`   ${C}${key}${R}`);
    }
  }
} else {
  console.log(`\n${G}✅  .env already configured — koi naya secret generate nahi hua${R}`);
}

console.log(`\n${B}Next steps:${R}`);
console.log(`   1. pnpm install          ← dependencies install karo`);
console.log(`   2. pnpm dev              ← sab services start karo\n`);
console.log(`${Y}Note: DATABASE_URL Replit ne khud set ki hai (Secrets panel mein hai)${R}`);
console.log(`      Agar nahi hai to neon.tech/supabase.com se free PostgreSQL lo\n`);
