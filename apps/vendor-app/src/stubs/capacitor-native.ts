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
