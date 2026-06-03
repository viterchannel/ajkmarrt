import { createLogger } from "@/lib/logger";
import { useEffect, useState } from "react";
const log = createLogger("[queueManager]");

export type ActionType =
  | "accept_order"
  | "accept_ride"
  | "update_order"
  | "update_ride"
  | "complete_trip"
  | "board_passenger"
  | "withdraw";

export interface QueuedAction {
  id: string;
  type: ActionType;
  entityId: string;
  payload: Record<string, unknown>;
  retryCount: number;
  createdAt: number;
}

/* In-memory fallback array used when IndexedDB is unavailable (e.g. private
   browsing on some browsers, or during IDB initialisation failures). The queue
   is ephemeral — it survives page-level state but not a hard reload. Callers
   receive the same action ID so retry logic is consistent. */
const _memQueue: QueuedAction[] = [];

const DB_NAME = "ajkmart_action_queue";
const STORE = "actions";
/* DB version 2 adds the dead_letter object store.
   Version bump triggers onupgradeneeded where we create it if absent. */
const DB_VER = 2;
const DL_STORE = "dead_letter";

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      /* v1: main action queue */
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      /* v2: dead-letter store for permanently-failed actions */
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(DL_STORE)) {
        db.createObjectStore(DL_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => {
        _dbPromise = null;
      };
      db.onversionchange = () => {
        try {
          db.close();
        } catch (err) {
          log.warn("[queueManager] db.close failed:", err);
        }
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

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueAction(
  type: ActionType,
  entityId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const action: QueuedAction = {
    id: generateId(),
    type,
    entityId,
    payload,
    retryCount: 0,
    createdAt: Date.now(),
  };
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(action);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifyListeners();
  } catch (err) {
    /* IndexedDB unavailable (private browsing, quota exceeded, etc.) — fall back
       to localStorage, then in-memory queue as last resort. */
    log.warn("[queueManager] IndexedDB write failed — attempting localStorage fallback:", err);
    
    let persisted = false;
    try {
      /* Try to persist to localStorage as a more reliable fallback than ephemeral memory */
      if (typeof localStorage !== "undefined") {
        const existingStr = localStorage.getItem("ajkm:action-queue-fallback");
        const existing = existingStr ? JSON.parse(existingStr) as QueuedAction[] : [];
        existing.push(action);
        localStorage.setItem("ajkm:action-queue-fallback", JSON.stringify(existing));
        persisted = true;
        log.info("[queueManager] Action persisted to localStorage fallback:", { actionId: action.id });
      }
    } catch (storageErr) {
      log.warn("[queueManager] localStorage fallback also failed — using in-memory only:", storageErr);
    }
    
    if (!persisted) {
      /* Last resort: in-memory queue (ephemeral, won't survive reload) */
      _memQueue.push(action);
    }
    
    /* Dispatch a browser event so UI components can surface a warning toast
       without coupling this non-React module to any component tree. */
    try {
      window.dispatchEvent(
        new CustomEvent("ajkm:queue-persistence-failed", {
          detail: { 
            actionType: action.type, 
            actionId: action.id,
            persisted
          },
        })
      );
    } catch {
      /* window may be unavailable in SSR/test contexts — ignore */
    }
    notifyListeners();
  }
  return action.id;
}

async function getAll(): Promise<QueuedAction[]> {
  try {
    const db = await openDB();
    const all = await new Promise<QueuedAction[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as QueuedAction[]);
      req.onerror = () => reject(req.error);
    });
    /* Sort strictly FIFO by creation time so status transitions replay in the
       correct order (e.g. accepted → in_transit → completed, never reversed). */
    /* Merge in any actions that fell back to in-memory storage */
    const merged = [...all, ..._memQueue.filter((m) => !all.some((a) => a.id === m.id))];
    return merged.sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) {
    log.warn("[queueManager] IndexedDB read failed — checking localStorage fallback:", err);
    
    /* Try to load from localStorage fallback */
    let storageFallback: QueuedAction[] = [];
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("ajkm:action-queue-fallback");
        if (stored) {
          storageFallback = JSON.parse(stored) as QueuedAction[];
          log.info("[queueManager] Loaded actions from localStorage fallback:", { count: storageFallback.length });
        }
      }
    } catch (storageErr) {
      log.warn("[queueManager] localStorage fallback read also failed:", storageErr);
    }
    
    /* Merge storage fallback with in-memory queue, removing duplicates */
    const merged = [
      ...storageFallback,
      ..._memQueue.filter((m) => !storageFallback.some((a) => a.id === m.id))
    ];
    return merged.sort((a, b) => a.createdAt - b.createdAt);
  }
}

async function removeAction(id: string): Promise<void> {
  /* Always purge from in-memory fallback first — even if IndexedDB succeeds,
     the action may have been written to _memQueue on a previous write failure
     and would otherwise be replayed indefinitely. */
  const memIdx = _memQueue.findIndex((a) => a.id === id);
  if (memIdx !== -1) _memQueue.splice(memIdx, 1);

  /* Also remove from localStorage fallback if present */
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("ajkm:action-queue-fallback");
      if (stored) {
        const queue = (JSON.parse(stored) as QueuedAction[]).filter((a) => a.id !== id);
        if (queue.length > 0) {
          localStorage.setItem("ajkm:action-queue-fallback", JSON.stringify(queue));
        } else {
          localStorage.removeItem("ajkm:action-queue-fallback");
        }
      }
    }
  } catch (storageErr) {
    log.warn("[queueManager] Failed to remove action from localStorage fallback:", storageErr);
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    log.warn("[queueManager] removeAction IndexedDB delete failed:", err);
  }
}

async function bumpRetryCount(action: QueuedAction): Promise<void> {
  /* Write-first: attempt the IndexedDB put before mutating _memQueue so that
     if the IDB write fails both stores remain consistent (neither is updated). */
  const updated: QueuedAction = { ...action, retryCount: action.retryCount + 1 };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    log.warn("[queueManager] bumpRetryCount IndexedDB write failed — _memQueue left unchanged:", err);
    return;
  }

  /* IDB write succeeded — now mirror the update in the in-memory fallback. */
  const memIdx = _memQueue.findIndex((a) => a.id === action.id);
  if (memIdx !== -1) {
    _memQueue[memIdx] = updated;
  }
}

/* ── PermanentQueueError ───────────────────────────────────────────────────────
   Throw this (or a subclass) from the executor to signal that an action has
   failed permanently and must be removed from the queue immediately — no more
   retries.  Use it for HTTP 4xx responses (except 429 rate-limit): the server
   has told us the request is invalid or forbidden and retrying will never help.

   For transient failures (network unreachable, 5xx, 429) simply throw any
   other error; the queue will bump the retry counter and stop the drain so the
   action is replayed on the next sync cycle.

   The `reason` field is stored in IndexedDB under the dead-letter entry so the
   UI can surface a human-readable failure message to the rider. */
export class PermanentQueueError extends Error {
  readonly permanent = true as const;
  constructor(
    public readonly reason: string,
    public readonly httpStatus?: number
  ) {
    super(reason);
    this.name = "PermanentQueueError";
  }
}

/* ── Dead-letter store ─────────────────────────────────────────────────────────
   Actions removed due to a permanent failure are moved to a dead-letter list
   in IndexedDB so they are visible to the rider (and for diagnostics) rather
   than silently evaporating. The UI reads this via useDeadLetterQueue(). */
export interface DeadLetterEntry {
  id: string;
  action: QueuedAction;
  reason: string;
  httpStatus?: number;
  failedAt: number;
}

/* L-06: Retention limits prevent unbounded IndexedDB growth. Entries older
   than DL_TTL_MS are expired; the store never holds more than DL_MAX_ENTRIES. */
const DL_MAX_ENTRIES = 50;
const DL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Write an action to the dead-letter IndexedDB store.
 *  Returns `true` if the write succeeded, `false` if it failed.
 *  Callers MUST check the return value: only remove the action from the
 *  live queue after a confirmed `true` — if the dead-letter write fails
 *  and the action is removed anyway, the work is silently lost. */
async function pushDeadLetter(action: QueuedAction, err: PermanentQueueError): Promise<boolean> {
  try {
    const db = await openDB();
    /* Ensure the dead-letter store exists — it was added in DB version 2. If
       the store hasn't been created yet (old DB version) we skip silently.
       Returning true here is safe: if the store doesn't exist we can't persist
       the entry, so we allow the caller to remove the action as if it succeeded
       (otherwise it blocks the queue forever on old DB versions). */
    if (!db.objectStoreNames.contains(DL_STORE)) return true;
    const entry: DeadLetterEntry = {
      id: action.id,
      action,
      reason: err.reason,
      httpStatus: err.httpStatus,
      failedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DL_STORE, "readwrite");
      const store = tx.objectStore(DL_STORE);
      /* Prune expired entries and enforce max-size before writing. */
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const all = (getAllReq.result ?? []) as DeadLetterEntry[];
        const cutoff = Date.now() - DL_TTL_MS;
        /* Delete expired */
        all.filter((e) => e.failedAt < cutoff).forEach((e) => store.delete(e.id));
        /* Evict oldest above the cap */
        const fresh = all
          .filter((e) => e.failedAt >= cutoff)
          .sort((a, b) => a.failedAt - b.failedAt);
        while (fresh.length >= DL_MAX_ENTRIES) {
          store.delete(fresh.shift()!.id);
        }
        store.put(entry);
      };
      getAllReq.onerror = () => reject(getAllReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (writeErr) {
    /* IDB write failed — signal failure so the caller keeps the action in
       the live queue (bump retry) rather than silently dropping it. */
    log.warn("[queueManager] pushDeadLetter IDB write failed — action retained in queue:", writeErr);
    return false;
  }
}

/** Clear all pending actions from the queue (e.g. on 401 — stale auth). */
export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifyListeners();
  } catch (err) {
    log.warn("[queueManager] clearQueue failed:", err);
  }
}

export async function getDeadLetterQueue(): Promise<DeadLetterEntry[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(DL_STORE)) return [];
    return await new Promise<DeadLetterEntry[]>((resolve, reject) => {
      const tx = db.transaction(DL_STORE, "readonly");
      const req = tx.objectStore(DL_STORE).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as DeadLetterEntry[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    log.warn("[queueManager] getDeadLetterQueue failed:", err);
    return [];
  }
}

export async function clearDeadLetterEntry(id: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(DL_STORE)) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DL_STORE, "readwrite");
      tx.objectStore(DL_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    log.warn("[queueManager] clearDeadLetterEntry failed:", err);
  }
}

export interface ExecutorResult {
  /** true when the server returned a 2xx response; false for any non-throwing
   *  non-2xx outcome (e.g. the executor resolved without confirming success). */
  ok: boolean;
  /** The HTTP status code, when available. */
  status?: number;
}

type ActionExecutor = (action: QueuedAction) => Promise<ExecutorResult>;

let _executor: ActionExecutor | null = null;
let _syncing = false;
let _lastSync: number | null = null;

/* MAX_RETRIES is a last-resort safety net for unexpected errors that the
   executor did not classify as PermanentQueueError. Under normal operation the
   executor should throw PermanentQueueError for any 4xx response so actions are
   removed on first failure, not after 5 attempts.
   Only truly unclassified errors (unexpected throw shapes, bugs in the executor)
   will exhaust this counter. */
const MAX_RETRIES = 5;

export function registerActionExecutor(fn: ActionExecutor): void {
  _executor = fn;
}

/** Returns the number of actions currently pending in the queue.
 *  Useful for surfacing a "N actions queued" badge in the UI. */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await openDB();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result ?? 0);
      req.onerror = () => reject(tx.error);
    });
  } catch {
    return 0;
  }
}

/** Check if a specific action (type + entityId) is currently queued.
 *  Used by the request card to show a "Queued" badge when the rider
 *  tapped Accept while offline and the action is pending replay. */
export async function isActionQueued(type: ActionType, entityId: string): Promise<boolean> {
  const actions = await getAll();
  return actions.some((a) => a.type === type && a.entityId === entityId);
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  return getAll();
}

type ActionSuccessCallback = (action: QueuedAction) => void;
const _successCallbacks = new Map<ActionType, Set<ActionSuccessCallback>>();

export function subscribeActionSuccess(type: ActionType, fn: ActionSuccessCallback): () => void {
  if (!_successCallbacks.has(type)) _successCallbacks.set(type, new Set());
  _successCallbacks.get(type)!.add(fn);
  return () => {
    _successCallbacks.get(type)?.delete(fn);
  };
}

const _anySuccessCallbacks = new Set<ActionSuccessCallback>();

export function subscribeAnyActionSuccess(fn: ActionSuccessCallback): () => void {
  _anySuccessCallbacks.add(fn);
  return () => _anySuccessCallbacks.delete(fn);
}

function notifyActionSuccess(action: QueuedAction): void {
  _successCallbacks.get(action.type)?.forEach((fn) => {
    try {
      fn(action);
    } catch (err) {
      log.warn("[queueManager] notifyActionSuccess callback failed:", err);
    }
  }); // eslint-disable-line no-console
  _anySuccessCallbacks.forEach((fn) => {
    try {
      fn(action);
    } catch (err) {
      log.warn("[queueManager] notifyActionSuccess callback failed:", err);
    }
  }); // eslint-disable-line no-console
}

export async function syncQueue(): Promise<void> {
  if (_syncing || !_executor) return;
  _syncing = true;
  notifyListeners();
  try {
    const actions = await getAll();
    if (actions.length === 0) return;
    /* Process strictly in createdAt order. Stop the drain when any action
       fails — a failed predecessor (e.g. accept_order) must not be skipped,
       because later actions (update_order, complete_trip) depend on it
       having succeeded server-side first. */
    /* BUG3 FIX: Ride/order accepts have a server-side expiry window (~5 min).
       Any queued accept that is older than this TTL will always receive a 4xx
       (order expired / already taken), so we dead-letter it immediately rather
       than letting it block the queue until MAX_RETRIES is exhausted. */
    const ACCEPT_TTL_MS = 5 * 60 * 1000; // 5 minutes

    for (const action of actions) {
      /* TTL guard for accept actions — skip and dead-letter stale accepts */
      const isAccept = action.type === "accept_ride" || action.type === "accept_order";
      if (isAccept && Date.now() - action.createdAt > ACCEPT_TTL_MS) {
        const dlOk = await pushDeadLetter(
          action,
          new PermanentQueueError(
            `Accept action expired after ${ACCEPT_TTL_MS / 60000} minutes in queue — order/ride no longer available`,
            410
          )
        );
        if (dlOk) {
          await removeAction(action.id).catch((err) => {
            log.warn("[queueManager] removeAction failed after TTL expiry dead-letter:", err);
          }); // eslint-disable-line no-console
        }
        continue;
      }

      /* Last-resort guard: if an unclassified error has been retried too many
         times, move it to the dead-letter store so it doesn't block the queue
         forever. Under normal operation the executor throws PermanentQueueError
         for any 4xx so this branch is only hit by unexpected error shapes. */
      if (action.retryCount >= MAX_RETRIES) {
        const dlOk = await pushDeadLetter(
          action,
          new PermanentQueueError(
            `Exceeded max retries (${MAX_RETRIES}) without a permanent error classification`
          )
        );
        if (dlOk) {
          await removeAction(action.id).catch((err) => {
            log.warn("[queueManager] removeAction failed after dead-letter push:", err);
          });
          continue;
        }
        /* Dead-letter write failed — keep action in queue and halt the drain
           so it can be retried on the next sync cycle. */
        log.warn("[queueManager] dead-letter write failed for max-retry action — retaining in queue:", action.id);
        await bumpRetryCount(action).catch((bumpErr) => {
          log.warn("[queueManager] bumpRetryCount failed after dead-letter write failure:", bumpErr);
        });
        break;
      }
      try {
        const result = await _executor(action);
        /* Strict 2xx contract: the executor MUST return { ok: true } to confirm
           the server accepted the request.  Any other outcome — { ok: false },
           or a missing/undefined result (e.g. an executor that forgot to return)
           — is treated as a transient failure.  This prevents silent data loss
           where a non-throwing non-2xx outcome would otherwise remove the
           action from the queue permanently. */
        if (result?.ok !== true) {
          const { status } = result ?? {};
          if (
            typeof status === "number" &&
            status >= 400 &&
            status < 500 &&
            status !== 429
          ) {
            /* Permanent 4xx (not rate-limit): escalate so the action is
               moved to the dead-letter store instead of retried forever. */
            throw new PermanentQueueError(
              `Server rejected action '${action.type}' (HTTP ${status}) — will not retry`,
              status
            );
          }
          /* Transient non-ok (5xx, 429, network, or missing result): bump retry
             counter and halt the drain so the action is replayed next cycle. */
          await bumpRetryCount(action).catch((bumpErr) => {
            log.warn("[queueManager] bumpRetryCount failed after non-ok result:", bumpErr);
          });
          break;
        }
        await removeAction(action.id);
        notifyActionSuccess(action);
      } catch (err) {
        if (err instanceof PermanentQueueError) {
          /* 401 Unauthorized — auth is gone; clear entire queue and abort sync
             to avoid replaying stale actions under an invalid session. */
          if (err.httpStatus === 401) {
            await clearQueue();
            throw new PermanentQueueError("Session expired — queue cleared", 401);
          }
          /* Other permanent server-side rejection (e.g. 4xx): move to dead-letter
             immediately. Also dead-letter any remaining queued actions that share
             the same entityId — they are dependents (e.g. update_ride, complete_trip
             after a failed accept_ride) and will never succeed without the predecessor. */
          const dlOk = await pushDeadLetter(action, err);
          if (!dlOk) {
            /* Dead-letter write failed — keep the action in queue and halt the
               drain so the rider's work is not silently lost.  It will be retried
               on the next sync cycle (and re-classified as permanent again). */
            log.warn("[queueManager] dead-letter write failed for permanent error — retaining action in queue:", action.id);
            await bumpRetryCount(action).catch((bumpErr) => {
              log.warn("[queueManager] bumpRetryCount failed after dead-letter write failure:", bumpErr);
            });
            break;
          }
          await removeAction(action.id).catch((removeErr) => {
            log.warn("[queueManager] removeAction failed after permanent error:", removeErr);
          }); // eslint-disable-line no-console
          /* Dead-letter orphaned dependents sharing the same entityId. We re-read
             the remaining actions from IDB rather than using `actions` (which is a
             snapshot) to avoid operating on stale state if another tab modified
             the queue between iterations. */
          try {
            const remaining = await getAll();
            const orphans = remaining.filter((a) => a.entityId === action.entityId);
            for (const orphan of orphans) {
              const orphanDlOk = await pushDeadLetter(
                orphan,
                new PermanentQueueError(
                  `Cascading failure: preceding action "${action.type}" for entity "${action.entityId}" failed permanently`,
                  err.httpStatus
                )
              );
              if (orphanDlOk) {
                await removeAction(orphan.id).catch((removeErr) => {
                  log.warn("[queueManager] removeAction failed for orphan:", removeErr);
                }); // eslint-disable-line no-console
              } else {
                log.warn("[queueManager] dead-letter write failed for orphan — retaining in queue:", orphan.id);
              }
            }
          } catch (orphanErr) {
            log.warn("[queueManager] failed to dead-letter orphaned dependents:", orphanErr);
          }
          continue;
        }
        /* Transient failure (network unreachable, 5xx, 429): bump retry count
           and halt the drain. The ordering invariant requires that later actions
           (e.g. update_ride) only run after the predecessor succeeds. */
        await bumpRetryCount(action).catch((err) => {
          log.warn("[queueManager] bumpRetryCount failed:", err);
        }); // eslint-disable-line no-console
        break;
      }
    }
    _lastSync = Date.now();
  } finally {
    _syncing = false;
    notifyListeners();
  }
}

type Listener = () => void;
const _listeners = new Set<Listener>();

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

export function subscribeQueueStatus(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function getQueuePendingCount(): Promise<number> {
  const actions = await getAll();
  return actions.length;
}

export function useQueueStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(_lastSync);
  const [syncing, setSyncing] = useState(_syncing);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const count = await getQueuePendingCount();
      if (mounted) {
        setPendingCount(count);
        setLastSync(_lastSync);
        setSyncing(_syncing);
      }
    };
    void refresh();
    const unsub = subscribeQueueStatus(refresh);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { pendingCount, lastSync, syncing };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncQueue().catch((err) => {
      log.warn("[queueManager] notifyActionSuccess callback failed:", err);
    });
  }); // eslint-disable-line no-console
  /* Periodic retry every 30 seconds — covers Android WebViews that skip the
     `online` event, and any OS where the event fires unreliably after roaming. */
  setInterval(() => {
    if (navigator.onLine) {
      syncQueue().catch((err) => {
        log.warn("[queueManager] notifyActionSuccess callback failed:", err);
      });
    } // eslint-disable-line no-console
  }, 30_000);
}
