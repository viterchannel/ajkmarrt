const DB_NAME = "ajkmart_rider_cache";
const STORE = "snapshots";
const KEY = "dashboard_snapshot";
const RIDE_HISTORY_KEY = "ride_history_snapshot";
const ACTIVE_RIDE_KEY = "active_ride_snapshot";
const DB_VER = 1;

let _dbPromise: Promise<IDBDatabase> | null = null;

function openCacheDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        _dbPromise = null;
      };
      db.onversionchange = () => {
        try { db.close(); } catch { /* ignore */ }
        _dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      _dbPromise = null;
      reject(req.error);
    };
  }).catch((err) => {
    _dbPromise = null;
    throw err;
  });
  return _dbPromise;
}

async function putCacheEntry<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ data, savedAt: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB unavailable — non-critical, skip caching */
  }
}

async function getCacheEntry<T>(key: string): Promise<T | null> {
  try {
    const db = await openCacheDB();
    const result = await new Promise<{ data: T; savedAt: number } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () =>
          resolve(req.result as { data: T; savedAt: number } | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    return result?.data ?? null;
  } catch {
    return null;
  }
}

async function deleteCacheEntry(key: string): Promise<void> {
  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* non-critical */
  }
}

export async function saveDashboardCache<T>(data: T): Promise<void> {
  return putCacheEntry(KEY, data);
}

export async function loadDashboardCache<T>(): Promise<T | null> {
  return getCacheEntry<T>(KEY);
}

export async function clearDashboardCache(): Promise<void> {
  return deleteCacheEntry(KEY);
}

export async function saveRideHistoryCache<T>(data: T): Promise<void> {
  return putCacheEntry(RIDE_HISTORY_KEY, data);
}

export async function loadRideHistoryCache<T>(): Promise<T | null> {
  return getCacheEntry<T>(RIDE_HISTORY_KEY);
}

export async function clearRideHistoryCache(): Promise<void> {
  return deleteCacheEntry(RIDE_HISTORY_KEY);
}

export async function saveActiveRideCache<T>(data: T): Promise<void> {
  return putCacheEntry(ACTIVE_RIDE_KEY, data);
}

export async function loadActiveRideCache<T>(): Promise<T | null> {
  return getCacheEntry<T>(ACTIVE_RIDE_KEY);
}

export async function clearActiveRideCache(): Promise<void> {
  return deleteCacheEntry(ACTIVE_RIDE_KEY);
}
