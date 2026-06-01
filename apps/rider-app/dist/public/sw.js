/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "90967e554478930269b741699ce0d184"
  }, {
    "url": "push-sw.js",
    "revision": "86282f42c1d5a9a7a6b5fcd374c51fd8"
  }, {
    "url": "opengraph.svg",
    "revision": "87e12c9a1790080bdfb86a6b5b96741e"
  }, {
    "url": "offline.html",
    "revision": "c8c4c690763ee8e2831ff4d2a5137bca"
  }, {
    "url": "index.html",
    "revision": "7a7e0bbe3eb94762a5d0cb0de01f22ef"
  }, {
    "url": "icon-512.png",
    "revision": "2acff30f03ba48a8a2db472764c7221c"
  }, {
    "url": "icon-192.png",
    "revision": "c1f361c05eecffe2a2fa5ad2e53d981f"
  }, {
    "url": "favicon.svg",
    "revision": "b64fcae29024da8ddd2c62678d35ee7c"
  }, {
    "url": "ajkmart-logo.png",
    "revision": "606fe75cb53f5864ba42ee81d4d478d9"
  }, {
    "url": "fonts/plus-jakarta-sans-latin.woff2",
    "revision": "7660bd9909fb097989b19471a75f1b7a"
  }, {
    "url": "fonts/plus-jakarta-sans-latin-ext.woff2",
    "revision": "341687eeeb6afd29502e2277d9762c7e"
  }, {
    "url": "assets/zap-CmDUPKhn.js",
    "revision": null
  }, {
    "url": "assets/web-CeNna8Va.js",
    "revision": null
  }, {
    "url": "assets/wallet-myHllZhG.js",
    "revision": null
  }, {
    "url": "assets/vendor-socket-DnZMiwN9.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-DPKwYc85.js",
    "revision": null
  }, {
    "url": "assets/vendor-query-BEwrEmM8.js",
    "revision": null
  }, {
    "url": "assets/vendor-leaflet-xVwftxLI.js",
    "revision": null
  }, {
    "url": "assets/validate-CKt8bwDQ.js",
    "revision": null
  }, {
    "url": "assets/utensils-crossed-DGZm-6Jl.js",
    "revision": null
  }, {
    "url": "assets/user-x-CuiOm-lI.js",
    "revision": null
  }, {
    "url": "assets/ur-DE2R2ClM.js",
    "revision": null
  }, {
    "url": "assets/truck-WgfFC1k6.js",
    "revision": null
  }, {
    "url": "assets/trash-2-DMeoU371.js",
    "revision": null
  }, {
    "url": "assets/timer-CICqgCVi.js",
    "revision": null
  }, {
    "url": "assets/target-B1maEBkc.js",
    "revision": null
  }, {
    "url": "assets/star-73mDr-gC.js",
    "revision": null
  }, {
    "url": "assets/sparkles-1gAtZ_bx.js",
    "revision": null
  }, {
    "url": "assets/smartphone-D_Jxr79p.js",
    "revision": null
  }, {
    "url": "assets/shopping-cart-q8cu9pAr.js",
    "revision": null
  }, {
    "url": "assets/shield-check-CKn6sODO.js",
    "revision": null
  }, {
    "url": "assets/shield-Btj-89AH.js",
    "revision": null
  }, {
    "url": "assets/roman-0z5WFTM3.js",
    "revision": null
  }, {
    "url": "assets/rideUtils-BzUBPazj.js",
    "revision": null
  }, {
    "url": "assets/phone-BApFVyfj.js",
    "revision": null
  }, {
    "url": "assets/pencil-vSZiK_Eb.js",
    "revision": null
  }, {
    "url": "assets/package-BKNXyIBw.js",
    "revision": null
  }, {
    "url": "assets/not-found-DyZoXlcg.js",
    "revision": null
  }, {
    "url": "assets/navigation-CKUm4Hyu.js",
    "revision": null
  }, {
    "url": "assets/message-square-fs0LFw34.js",
    "revision": null
  }, {
    "url": "assets/message-circle-DjAs4t1D.js",
    "revision": null
  }, {
    "url": "assets/log-out-xXDCZF2Y.js",
    "revision": null
  }, {
    "url": "assets/loader-circle-CtsWA--c.js",
    "revision": null
  }, {
    "url": "assets/leafletIconFix-DK_VcLxF.js",
    "revision": null
  }, {
    "url": "assets/leaflet-CIGW-MKW.css",
    "revision": null
  }, {
    "url": "assets/landmark-C5c3lXir.js",
    "revision": null
  }, {
    "url": "assets/info-D_oRllhk.js",
    "revision": null
  }, {
    "url": "assets/index-DBpRzyBo.js",
    "revision": null
  }, {
    "url": "assets/index-DAWa00nE.js",
    "revision": null
  }, {
    "url": "assets/index-D5jFSn2x.js",
    "revision": null
  }, {
    "url": "assets/index-BnG909Mb.css",
    "revision": null
  }, {
    "url": "assets/index-BO06KiKD.js",
    "revision": null
  }, {
    "url": "assets/globe-CQihNoMM.js",
    "revision": null
  }, {
    "url": "assets/file-text-DRg_DjTk.js",
    "revision": null
  }, {
    "url": "assets/eye-D0eiqvSN.js",
    "revision": null
  }, {
    "url": "assets/credit-card-CA87qO2Q.js",
    "revision": null
  }, {
    "url": "assets/clock-jTj2Ommz.js",
    "revision": null
  }, {
    "url": "assets/clipboard-list-BjEawV8m.js",
    "revision": null
  }, {
    "url": "assets/circle-alert-BfxzK75h.js",
    "revision": null
  }, {
    "url": "assets/chevron-up-CTkTSHrM.js",
    "revision": null
  }, {
    "url": "assets/chevron-right-C2qk5Evs.js",
    "revision": null
  }, {
    "url": "assets/chevron-down-CRLM7Ne4.js",
    "revision": null
  }, {
    "url": "assets/check-lJJb3r8X.js",
    "revision": null
  }, {
    "url": "assets/check-check-DwQWERao.js",
    "revision": null
  }, {
    "url": "assets/chart-column-CKpQHg3t.js",
    "revision": null
  }, {
    "url": "assets/car-RAfevX10.js",
    "revision": null
  }, {
    "url": "assets/capacitor-native-CRt26s-D.js",
    "revision": null
  }, {
    "url": "assets/capacitor-browser-Da-m3BWE.js",
    "revision": null
  }, {
    "url": "assets/camera-DCuk0dDM.js",
    "revision": null
  }, {
    "url": "assets/bike-CM8PNzAU.js",
    "revision": null
  }, {
    "url": "assets/ban-JD4A1Itv.js",
    "revision": null
  }, {
    "url": "assets/arrow-left-BINCDnlN.js",
    "revision": null
  }, {
    "url": "assets/accordion-BH4zfeej.js",
    "revision": null
  }, {
    "url": "assets/Wallet-X0WJVrj7.js",
    "revision": null
  }, {
    "url": "assets/VanDriver-CZkjV5gh.js",
    "revision": null
  }, {
    "url": "assets/SplashScreen-Caw9eJCK.js",
    "revision": null
  }, {
    "url": "assets/Settings-cAweEcEy.js",
    "revision": null
  }, {
    "url": "assets/SecuritySettings-su8AHnFI.js",
    "revision": null
  }, {
    "url": "assets/Reviews-BJoz1v6U.js",
    "revision": null
  }, {
    "url": "assets/Register-BnBLLtdP.js",
    "revision": null
  }, {
    "url": "assets/PullToRefresh-Vv8_KcLB.js",
    "revision": null
  }, {
    "url": "assets/Profile-CTQ5DACC.js",
    "revision": null
  }, {
    "url": "assets/PhoneInput-5RlUDXWy.js",
    "revision": null
  }, {
    "url": "assets/PenaltyHistory-C2HWBspp.js",
    "revision": null
  }, {
    "url": "assets/PasswordInput-B6HCidmC.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-D7YQgjUg.js",
    "revision": null
  }, {
    "url": "assets/Notifications-C7Bg0hiP.js",
    "revision": null
  }, {
    "url": "assets/MiniMapImpl-hitS1rsc.js",
    "revision": null
  }, {
    "url": "assets/LoginHistory-D8DxMjBc.js",
    "revision": null
  }, {
    "url": "assets/Login-DpQ5CjO3.js",
    "revision": null
  }, {
    "url": "assets/JoinSelect-BebMXdp6.js",
    "revision": null
  }, {
    "url": "assets/Home-BNzRsxcg.js",
    "revision": null
  }, {
    "url": "assets/History-DTefwrC4.js",
    "revision": null
  }, {
    "url": "assets/Help-fHSrh82_.js",
    "revision": null
  }, {
    "url": "assets/GuestLanding-D8-HS4sD.js",
    "revision": null
  }, {
    "url": "assets/GuestDashboard-Da9DTZ0k.js",
    "revision": null
  }, {
    "url": "assets/ForgotUsername-Bhe6VHcL.js",
    "revision": null
  }, {
    "url": "assets/ForgotPassword-a06Gd1yz.js",
    "revision": null
  }, {
    "url": "assets/ErrorState-KcBRJKVj.js",
    "revision": null
  }, {
    "url": "assets/EarningsSummary-CDWk5Dx5.js",
    "revision": null
  }, {
    "url": "assets/Earnings-6PeSZnOW.js",
    "revision": null
  }, {
    "url": "assets/Chat-CBQ-Hug7.js",
    "revision": null
  }, {
    "url": "assets/ActiveHelpersLeaflet-nE1RuZB7.js",
    "revision": null
  }, {
    "url": "assets/Active-88mLFvVH.js",
    "revision": null
  }, {
    "url": "manifest.webmanifest",
    "revision": "916cb1b03a2a58d2746c2e99677547a9"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/rider/index.html"), {
    denylist: [/^\/api\//]
  }));

}));
