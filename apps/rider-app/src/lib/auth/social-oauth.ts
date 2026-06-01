/* Social OAuth SDK loaders — extracted so LoginScreen stays a thin wrapper */

type GsiAccounts = {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      prompt: (n: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
    };
  };
};

export async function googleOneTap(clientId: string): Promise<string> {
  const w = window as unknown as { google?: GsiAccounts };
  if (!w.google) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error("Failed to load Google SDK"));
      document.head.appendChild(s);
    });
  }
  const g = (window as unknown as { google: GsiAccounts }).google;
  return new Promise((resolve, reject) => {
    g.accounts.id.initialize({ client_id: clientId, callback: (r) => resolve(r.credential) });
    g.accounts.id.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment())
        reject(new Error("Google sign-in cancelled or not displayed"));
    });
  });
}

type FbSDK = {
  init: (cfg: { appId: string; version: string }) => void;
  login: (cb: (r: { authResponse?: { accessToken: string }; status: string }) => void) => void;
};

export async function facebookLogin(appId: string): Promise<string> {
  const w = window as unknown as { FB?: FbSDK };
  if (!w.FB) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error("Failed to load Facebook SDK"));
      document.head.appendChild(s);
    });
  }
  const FB = (window as unknown as { FB: FbSDK }).FB;
  FB.init({ appId, version: "v18.0" });
  return new Promise((resolve, reject) => {
    FB.login((r) => {
      if (r.authResponse?.accessToken) resolve(r.authResponse.accessToken);
      else reject(new Error("Facebook login cancelled"));
    });
  });
}
