export const PushNotifications = {
  requestPermissions: async () => ({ receive: "denied" }),
  register: async () => {},
  addListener: async () => ({ remove: async () => {} }),
  removeAllListeners: async () => {},
};

export const BiometricAuth = {
  checkBiometry: async () => ({ isAvailable: false }),
  authenticate: async () => {},
};

export const PlayIntegrity = {
  requestIntegrityToken: async (_opts: { nonce: string }) => ({ token: "" }),
};

export const AppAttest = {
  generateKey: async () => "",
  attestKey: async (_opts: { keyId: string; challenge: string }) => ({ attestation: "" }),
};

export const FirebaseCrashlytics = {
  setEnabled: async (_opts: { enabled: boolean }) => {},
  recordException: async (_opts: { message: string }) => {},
  setUserId: async (_opts: { userId: string }) => {},
  log: async (_opts: { message: string }) => {},
  crash: async () => {},
};
