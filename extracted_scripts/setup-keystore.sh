#!/usr/bin/env bash
# setup-keystore.sh — Generate release keystores for AJKMart Rider and Vendor APKs.
#
# Prerequisites: Java JDK 11+ must be installed (Android Studio bundles it).
# Run once on the developer machine / CI server; keep .jks files OUT of git.
#
# Usage:
#   chmod +x scripts/setup-keystore.sh
#   ./scripts/setup-keystore.sh
#
# The script writes:
#   artifacts/rider-app/android/app/rider.jks
#   artifacts/vendor-app/android/app/vendor.jks
#
# Then store the passwords safely (password manager / GitHub Secrets / etc.)
# and set the env vars listed in build.gradle before running Gradle.

set -euo pipefail

RIDER_JKS="artifacts/rider-app/android/app/rider.jks"
VENDOR_JKS="artifacts/vendor-app/android/app/vendor.jks"

echo ""
echo "========================================="
echo " AJKMart — Android Keystore Generator"
echo "========================================="
echo ""

# ── Rider keystore ──────────────────────────────────────────────────────────
if [ -f "$RIDER_JKS" ]; then
  echo "[rider] $RIDER_JKS already exists — skipping."
else
  echo "[rider] Generating keystore …"
  keytool -genkeypair \
    -v \
    -keystore "$RIDER_JKS" \
    -alias ajkmart-rider \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=AJKMart Rider, OU=Mobile, O=AJKMart, L=Muzaffarabad, ST=AJK, C=PK"
  echo "[rider] ✅  $RIDER_JKS created."
fi

# ── Vendor keystore ─────────────────────────────────────────────────────────
if [ -f "$VENDOR_JKS" ]; then
  echo "[vendor] $VENDOR_JKS already exists — skipping."
else
  echo "[vendor] Generating keystore …"
  keytool -genkeypair \
    -v \
    -keystore "$VENDOR_JKS" \
    -alias ajkmart-vendor \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=AJKMart Vendor, OU=Mobile, O=AJKMart, L=Muzaffarabad, ST=AJK, C=PK"
  echo "[vendor] ✅  $VENDOR_JKS created."
fi

echo ""
echo "Next steps:"
echo "  1. Note the passwords you entered above."
echo "  2. Export them as environment variables (or add to CI secrets):"
echo ""
echo "     export RIDER_KEYSTORE_PATH=\$(pwd)/$RIDER_JKS"
echo "     export RIDER_KEYSTORE_PASSWORD=<your-rider-ks-password>"
echo "     export RIDER_KEY_ALIAS=ajkmart-rider"
echo "     export RIDER_KEY_PASSWORD=<your-rider-key-password>"
echo ""
echo "     export VENDOR_KEYSTORE_PATH=\$(pwd)/$VENDOR_JKS"
echo "     export VENDOR_KEYSTORE_PASSWORD=<your-vendor-ks-password>"
echo "     export VENDOR_KEY_ALIAS=ajkmart-vendor"
echo "     export VENDOR_KEY_PASSWORD=<your-vendor-key-password>"
echo ""
echo "  3. Run the build: see .github/workflows/android-build.yml"
echo ""
echo "  ⚠️  NEVER commit .jks files to git."
echo ""
