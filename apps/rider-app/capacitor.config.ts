import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Capacitor configuration for AJKMart Rider Android APK.
 *
 * APK build sequence:
 *   1. pnpm --filter @workspace/rider-app build:cap   — Vite build with BASE_PATH=/
 *   2. pnpm --filter @workspace/rider-app cap:sync    — sync web assets to Android project
 *   3. Open android/ in Android Studio and generate the signed APK
 *
 * Set VITE_API_BASE_URL (e.g. https://api.ajkmart.com) in the .env.capacitor
 * file or as a CI environment variable before running build:cap so REST calls
 * and the socket.io connection resolve correctly inside the native WebView.
 *
 * FCM setup (Android):
 *   Place google-services.json (downloaded from the Firebase Console) in
 *   android/app/google-services.json before syncing/building.
 *
 * FCM setup (iOS / APNs):
 *   Place GoogleService-Info.plist in ios/App/App/GoogleService-Info.plist.
 *   Then upload your APNs auth key to the Firebase Console →
 *   Project Settings → Cloud Messaging → iOS app configuration.
 *   The Firebase Admin SDK routes FCM messages to APNs automatically.
 */
const config: CapacitorConfig = {
  appId: "com.ajkmart.rider",
  appName: "AJKMart Rider",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#0b0e11",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    /* ── SSL/TLS Certificate Pinning ────────────────────────────────────────
       Certificate pinning is enforced at the OS/WebView layer, not via a
       Capacitor plugin, so it applies to ALL network traffic from the app —
       including CapacitorHttp, fetch(), XMLHttpRequest, and socket.io.

       Android implementation
       ─────────────────────
       See android/app/src/main/res/xml/network_security_config.xml
       The <application> tag in AndroidManifest.xml references this file via
       android:networkSecurityConfig="@xml/network_security_config".
       Replace the placeholder SHA-256 SPKI fingerprints in that file with
       the real fingerprints from your production certificate before building.

       iOS implementation
       ──────────────────
       Add NSAppTransportSecurity → NSPinnedDomains to ios/App/App/Info.plist:

         <key>NSAppTransportSecurity</key>
         <dict>
           <key>NSPinnedDomains</key>
           <dict>
             <key>api.ajkmart.com</key>
             <dict>
               <key>NSIncludesSubdomains</key><true/>
               <key>NSPinnedLeafIdentities</key>
               <array>
                 <dict>
                   <key>SPKI-SHA256-BASE64</key>
                   <string>REPLACE_WITH_REAL_SHA256_SPKI_FINGERPRINT</string>
                 </dict>
               </array>
             </dict>
           </dict>
         </dict>

       In web/dev mode pinning is a no-op (runs in a browser, not a WebView
       governed by the native network security config).                        */
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
