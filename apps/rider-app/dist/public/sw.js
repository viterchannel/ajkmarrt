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
    "revision": "cdde1b0527e0a2fc8279a1542b16ebbe"
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
    "revision": "c5319f266abd941d8e8599bf7aba144e"
  }, {
    "url": "fonts/plus-jakarta-sans-latin.woff2",
    "revision": "7660bd9909fb097989b19471a75f1b7a"
  }, {
    "url": "fonts/plus-jakarta-sans-latin-ext.woff2",
    "revision": "341687eeeb6afd29502e2277d9762c7e"
  }, {
    "url": "assets/zap-CEAwLRau.js",
    "revision": null
  }, {
    "url": "assets/web-Bgqud8s8.js",
    "revision": null
  }, {
    "url": "assets/wallet-2T-Ei0bw.js",
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
    "url": "assets/validate-B7eyP__T.js",
    "revision": null
  }, {
    "url": "assets/utensils-crossed-DJV92U6a.js",
    "revision": null
  }, {
    "url": "assets/user-x-CbPFVbMD.js",
    "revision": null
  }, {
    "url": "assets/useTheme-C8S3KFv2.js",
    "revision": null
  }, {
    "url": "assets/useFeatureGate-BcoNRsUA.js",
    "revision": null
  }, {
    "url": "assets/ur-BvOs4mA7.js",
    "revision": null
  }, {
    "url": "assets/truck-CIXH-g8H.js",
    "revision": null
  }, {
    "url": "assets/trash-2-BZ51_Hbd.js",
    "revision": null
  }, {
    "url": "assets/timer-B9Sz8vwf.js",
    "revision": null
  }, {
    "url": "assets/target-DfB72l0J.js",
    "revision": null
  }, {
    "url": "assets/star-ZMHGKYJs.js",
    "revision": null
  }, {
    "url": "assets/sparkles-CY6riQ3p.js",
    "revision": null
  }, {
    "url": "assets/smartphone-swphntOk.js",
    "revision": null
  }, {
    "url": "assets/shopping-cart-DNH41vWV.js",
    "revision": null
  }, {
    "url": "assets/shield-check-DxvRC0XP.js",
    "revision": null
  }, {
    "url": "assets/shield-P_beSCM5.js",
    "revision": null
  }, {
    "url": "assets/roman-DnxyWXCT.js",
    "revision": null
  }, {
    "url": "assets/rideUtils-hk8xxeSu.js",
    "revision": null
  }, {
    "url": "assets/phone-Bb3xUP1t.js",
    "revision": null
  }, {
    "url": "assets/pencil-Davij47G.js",
    "revision": null
  }, {
    "url": "assets/package-DNU-BLyQ.js",
    "revision": null
  }, {
    "url": "assets/not-found-B5s1DRsy.js",
    "revision": null
  }, {
    "url": "assets/navigation-CRj5F0s4.js",
    "revision": null
  }, {
    "url": "assets/message-square-Dvtsy-AB.js",
    "revision": null
  }, {
    "url": "assets/message-circle-D5IdqeJq.js",
    "revision": null
  }, {
    "url": "assets/log-out-DCFhCAJ4.js",
    "revision": null
  }, {
    "url": "assets/loader-circle-DBc5VY-M.js",
    "revision": null
  }, {
    "url": "assets/leafletIconFix-DK_VcLxF.js",
    "revision": null
  }, {
    "url": "assets/leaflet-CIGW-MKW.css",
    "revision": null
  }, {
    "url": "assets/info-D9aEFo0X.js",
    "revision": null
  }, {
    "url": "assets/index-C5-1WHS8.js",
    "revision": null
  }, {
    "url": "assets/index-Bxc5ohv7.js",
    "revision": null
  }, {
    "url": "assets/index-BhrRrXSP.css",
    "revision": null
  }, {
    "url": "assets/index-BThPbPG7.js",
    "revision": null
  }, {
    "url": "assets/index-BFhQATD9.js",
    "revision": null
  }, {
    "url": "assets/globe-Dr-nfGwp.js",
    "revision": null
  }, {
    "url": "assets/eye-Cu4tcrR5.js",
    "revision": null
  }, {
    "url": "assets/credit-card-BI9h5Fic.js",
    "revision": null
  }, {
    "url": "assets/clock-BiprEOL3.js",
    "revision": null
  }, {
    "url": "assets/clipboard-list-ZHnkFhqY.js",
    "revision": null
  }, {
    "url": "assets/circle-alert-DXfbPhE8.js",
    "revision": null
  }, {
    "url": "assets/chevron-up-Df7GkzwQ.js",
    "revision": null
  }, {
    "url": "assets/chevron-right-HK9YzcCr.js",
    "revision": null
  }, {
    "url": "assets/chevron-down-VyIqYIM_.js",
    "revision": null
  }, {
    "url": "assets/check-check-BhlexncC.js",
    "revision": null
  }, {
    "url": "assets/check-BBIAsgO4.js",
    "revision": null
  }, {
    "url": "assets/chart-column-BhHVpJSs.js",
    "revision": null
  }, {
    "url": "assets/car-np-M0b8K.js",
    "revision": null
  }, {
    "url": "assets/capacitor-native-CRt26s-D.js",
    "revision": null
  }, {
    "url": "assets/capacitor-browser-Da-m3BWE.js",
    "revision": null
  }, {
    "url": "assets/bike-CNMAkLIf.js",
    "revision": null
  }, {
    "url": "assets/ban-CYi778ov.js",
    "revision": null
  }, {
    "url": "assets/arrow-left-Cu8Wh7P8.js",
    "revision": null
  }, {
    "url": "assets/accordion-J7A_Znge.js",
    "revision": null
  }, {
    "url": "assets/Wallet-hyl6Fdkd.js",
    "revision": null
  }, {
    "url": "assets/VanDriver-BPhfi6Qc.js",
    "revision": null
  }, {
    "url": "assets/SplashScreen-B-aIrS8i.js",
    "revision": null
  }, {
    "url": "assets/Settings-CUbhvmp8.js",
    "revision": null
  }, {
    "url": "assets/SecuritySettings-B3NFXZvk.js",
    "revision": null
  }, {
    "url": "assets/Reviews-D0-o0xbK.js",
    "revision": null
  }, {
    "url": "assets/Register-BXYo_bTY.js",
    "revision": null
  }, {
    "url": "assets/PullToRefresh-BQt41zbO.js",
    "revision": null
  }, {
    "url": "assets/Profile-BvJCsZc6.js",
    "revision": null
  }, {
    "url": "assets/PhoneInput-Z0NNefIi.js",
    "revision": null
  }, {
    "url": "assets/PenaltyHistory-DFzGIzor.js",
    "revision": null
  }, {
    "url": "assets/PasswordInput-DTnEjW6H.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-BzqrHSMx.js",
    "revision": null
  }, {
    "url": "assets/Notifications-CDJ9Azcq.js",
    "revision": null
  }, {
    "url": "assets/MiniMapImpl-Bnjodpw5.js",
    "revision": null
  }, {
    "url": "assets/LoginHistory-CGa5EcmS.js",
    "revision": null
  }, {
    "url": "assets/Login-B8ihhlw6.js",
    "revision": null
  }, {
    "url": "assets/JoinSelect-DreWUL4g.js",
    "revision": null
  }, {
    "url": "assets/Home-B2yaEr_q.js",
    "revision": null
  }, {
    "url": "assets/History-CfL492_i.js",
    "revision": null
  }, {
    "url": "assets/Help-BVaM9i1S.js",
    "revision": null
  }, {
    "url": "assets/GuestLanding-CDR-Vk1g.js",
    "revision": null
  }, {
    "url": "assets/GuestDashboard-4SwA3VAn.js",
    "revision": null
  }, {
    "url": "assets/ForgotUsername-DxeB84zX.js",
    "revision": null
  }, {
    "url": "assets/ForgotPassword-a9JCSEJF.js",
    "revision": null
  }, {
    "url": "assets/ErrorState-BEdcAcoH.js",
    "revision": null
  }, {
    "url": "assets/EarningsSummary-Ck169tEI.js",
    "revision": null
  }, {
    "url": "assets/Earnings-C7XsktTj.js",
    "revision": null
  }, {
    "url": "assets/ConfigFeatureGate-DY0EDUw9.js",
    "revision": null
  }, {
    "url": "assets/Chat-CI_mxKTU.js",
    "revision": null
  }, {
    "url": "assets/ActiveHelpersLeaflet-B_-Kfu2M.js",
    "revision": null
  }, {
    "url": "assets/Active-Cbbhb9ru.js",
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
