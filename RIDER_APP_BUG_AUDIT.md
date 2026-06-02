# 🔴 RIDER APP COMPLETE BUG AUDIT REPORT

**Date**: June 2, 2026  
**Scope**: Full deep audit (Frontend/UI/UX, Backend Integration, Auth, Data, Performance, Routes, Real-time, Mobile)  
**Total Bugs Found**: 25 (5 Critical/High, 13 Medium, 3 Low/Minor)

---

## 📊 SEVERITY BREAKDOWN

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 1 | URGENT FIX |
| 🔴 High | 11 | NEEDS FIX |
| 🟡 Medium | 10 | NEEDS FIX |
| 🟠 Low | 3 | LOW PRIORITY |

---

## 🚨 TOP 5 CRITICAL ISSUES (MUST FIX FIRST)

### 1. **#7: Token Refresh Race Condition in Socket** (CRITICAL)
- **File**: `src/lib/socket.tsx` (L250-280)
- **Severity**: 🔴 **CRITICAL**
- **Impact**: Real-time messages lost during token refresh
- **Issue**: Both callback AND polling interval (5s) trigger socket reconnects simultaneously
- **Problematic Code**:
```typescript
const handleTokenRefresh = () => {
  const freshToken = api.getToken();
  if (!freshToken) return;
  writeSocketAuth({ ...readSocketAuth(), token: freshToken });
  s.disconnect();
  s.connect(); // First reconnect
};

const tokenRefreshInterval = setInterval(() => {
  const freshToken = api.getToken();
  const current = readSocketAuth().token;
  if (freshToken && freshToken !== current) {
    writeSocketAuth({ ...readSocketAuth(), token: freshToken });
    s.disconnect();
    s.connect(); // Second reconnect - RACE CONDITION
  }
}, 5_000);
```
- **Fix Required**: Remove polling interval, use only callback-based refresh
- **Data Loss Risk**: HIGH - Ride requests, approvals, location acks missed

---

### 2. **#24: Double-Click Race on Order Accept** (HIGH)
- **File**: `src/components/home/useHomeData.ts` (L600-650)
- **Severity**: 🔴 **HIGH**
- **Impact**: Orders accepted twice, server validation errors
- **Issue**: No immediate UI disabled state before API call
- **Problematic Code**:
```typescript
const onAcceptOrder = (id: string) => {
  // No immediate loading state!
  acceptOrderMut.mutate({ id }); // First click triggers API
  // Button still clickable during API call (2-3s latency)
  // User double-clicks → second API call fires
};
```
- **Fix Required**: Immediately disable button on first click, use optimistic update
- **Business Impact**: CRITICAL - Duplicate order acceptance, inventory issues

---

### 3. **#15: Socket Message Ordering Race** (HIGH)
- **File**: `src/lib/socket.tsx` (L270-290)
- **Severity**: 🔴 **HIGH**
- **Impact**: Lost ride requests, stale data shown to rider
- **Issue**: Socket messages processed before sync API completes
- **Problematic Code**:
```typescript
s.on("connect", () => {
  setConnected(true);
  syncQueue().catch((err) => log.warn({ err }, "syncQueue failed"));
  
  // No await - socket:new_order messages come in immediately
  void api.getRequests().then((data) => {
    qc.setQueryData(["rider-requests"], data);
  });
  
  // Messages processed here before REST data arrives
  s.on("admin:chat", (raw: unknown) => {
    // May be out-of-order with REST API data
    setAdminChatMessages((prev) => [...prev, newMsg]);
  });
});
```
- **Fix Required**: Wait for sync before setting connection status, queue socket messages during sync
- **Data Loss Risk**: HIGH - Ride requests dropped

---

### 4. **#10: GPS Queue IndexedDB Dead Connection** (HIGH)
- **File**: `src/lib/gpsQueue.ts` (L95-150)
- **Severity**: 🔴 **HIGH**
- **Impact**: GPS locations not persisted, tracking data lost on app restart
- **Issue**: Cached DB promise never resets when browser closes DB externally
- **Problematic Code**:
```typescript
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise; // DEAD CONNECTION RISK
  
  db.onversionchange = () => {
    db.close();
    _dbPromise = null; // Only resets on version change
    // Missing: db.onclose handler
  };
}
```
- **Fix Required**: Add `db.onclose` handler, implement retry with backoff
- **Data Loss Risk**: HIGH - All GPS pings lost if DB unexpectedly closes

---

### 5. **#11: Offline Queue Silent Persistence Failures** (HIGH)
- **File**: `src/lib/offline/queueManager.ts` (L50-90)
- **Severity**: 🔴 **HIGH**
- **Impact**: Order updates, delivery confirmations lost
- **Issue**: IndexedDB failures fall back to ephemeral in-memory only, no persistence
- **Problematic Code**:
```typescript
try {
  // IndexedDB write to persistent storage
  await db.transaction(...).objectStore(STORE).put(action);
} catch (err) {
  console.warn("[queueManager] IndexedDB write failed...");
  _memQueue.push(action); // Ephemeral only!
  // App refresh → action lost with no retry
}
```
- **Fix Required**: Implement fallback to localStorage, add retry mechanism
- **Data Loss Risk**: HIGH - Critical order updates lost on quota exceeded

---

## 📋 FULL BUG LIST

### **SECTION 1: FRONTEND/UI/UX ISSUES**

#### BUG #1: Memory Leak in useHomeData (HIGH)
- **File**: `src/components/home/useHomeData.ts` (L240-250)
- **Severity**: 🔴 HIGH
- **Category**: Memory/Lifecycle
- **Issue**: Event listeners registered with `{ once: true }` but cleanup doesn't remove them
- **Problematic Code**:
```typescript
const handler = () => { unlockAudio(); setAudioLocked(false); };
document.addEventListener("click", handler, { once: true });
document.addEventListener("touchstart", handler, { once: true });
return () => {
  clearInterval(soundIntervalRef.current);
  // Missing: document.removeEventListener("click", handler);
  // Missing: document.removeEventListener("touchstart", handler);
};
```
- **Why It's a Bug**: Listeners accumulate over multiple mount/unmount cycles
- **Impact**: Orphaned event handlers, potential performance degradation
- **Fix**: 
```typescript
const handler = () => { unlockAudio(); setAudioLocked(false); };
document.addEventListener("click", handler, { once: true });
document.addEventListener("touchstart", handler, { once: true });
return () => {
  document.removeEventListener("click", handler);
  document.removeEventListener("touchstart", handler);
  if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
};
```

---

#### BUG #2: Modal State Not Reset on Reopen (HIGH)
- **File**: `src/components/wallet/DepositModal.tsx` (L50-80)
- **Severity**: 🔴 HIGH
- **Category**: State Management
- **Issue**: Modal step state persists when closed and reopened
- **Problematic Code**:
```typescript
const [step, setStep] = useState<"amount" | "method" | "details" | "confirm" | "done">("amount");
// No reset when parent unmounts/remounts
// {showDeposit && <DepositModal ...>} → closes in "done" state
// Reopens → still shows "done" screen instead of "amount"
```
- **Why It's a Bug**: UX regression - wrong step shown, user confused about state
- **Impact**: User sees done screen on reopen, can't restart deposit
- **Fix**:
```typescript
const [step, setStep] = useState<"amount" | "method" | "details" | "confirm" | "done">("amount");

useEffect(() => {
  // Reset on unmount/remount
  return () => setStep("amount");
}, []);
```

---

#### BUG #3: useEffect Dependency Issue - OTP Cooldown (MEDIUM)
- **File**: `src/pages/Profile.tsx` (L345-355)
- **Severity**: 🟡 MEDIUM
- **Category**: State Management
- **Issue**: Cooldown effect setup is inefficient
- **Impact**: Minor performance issue
- **Fix**: Already mostly correct, but ensure deps array matches correctly

---

### **SECTION 2: API/BACKEND INTEGRATION**

#### BUG #4: Race Condition in LoginHistory Promise.all (HIGH)
- **File**: `src/pages/LoginHistory.tsx` (L260-275)
- **Severity**: 🔴 HIGH
- **Category**: API Integration
- **Issue**: Promise.all doesn't distinguish which API call failed
- **Problematic Code**:
```typescript
Promise.all([
  apiFetch<{ sessions: ActiveSession[] }>("/auth/sessions"),
  apiFetch<{ history: LoginEntry[] }>("/login-history"),
]).then(([sessData, histData]) => {
  if (cancelled) return;
  setSessions(sessData?.sessions ?? []);
  setEntries(histData?.history ?? []);
}).catch((e: unknown) => {
  if (cancelled) return;
  const msg = e instanceof Error ? e.message : "Failed to load data";
  setSessionsError(msg); // Sets same error for both
  setHistoryError(msg);
}).finally(() => {
  if (!cancelled) {
    setSessionsLoading(false); // Both set to false even if one failed
    setHistoryLoading(false);
  }
});
```
- **Why It's a Bug**: User sees both lists as complete even if one API failed
- **Impact**: Confusing error state, one list missing but marked as loaded
- **Fix**:
```typescript
const sessionsPromise = apiFetch<{ sessions: ActiveSession[] }>("/auth/sessions");
const historyPromise = apiFetch<{ history: LoginEntry[] }>("/login-history");

Promise.all([
  sessionsPromise.then(
    (data) => ({ sessions: data?.sessions ?? [], error: null }),
    (err) => ({ sessions: [], error: err instanceof Error ? err.message : "Failed" })
  ),
  historyPromise.then(
    (data) => ({ entries: data?.history ?? [], error: null }),
    (err) => ({ entries: [], error: err instanceof Error ? err.message : "Failed" })
  ),
]).then(([sessResult, histResult]) => {
  if (cancelled) return;
  setSessions(sessResult.sessions);
  setEntries(histResult.entries);
  if (sessResult.error) setSessionsError(sessResult.error);
  if (histResult.error) setHistoryError(histResult.error);
  setSessionsLoading(false);
  setHistoryLoading(false);
});
```

---

#### BUG #5: Missing Error Handling - Chat Audio Playback (MEDIUM)
- **File**: `src/pages/Chat.tsx` (L450-480)
- **Severity**: 🟡 MEDIUM
- **Category**: Error Handling
- **Issue**: Audio play errors only logged, no UI feedback
- **Problematic Code**:
```typescript
remoteAudioRef.current.play().catch((err) => {
  log.warn({ err }, "Remote audio playback failed");
  // User has no idea why they don't hear audio
});
```
- **Why It's a Bug**: Browser autoplay policy violations fail silently
- **Impact**: User can't hear voice messages, no indication of problem
- **Fix**:
```typescript
remoteAudioRef.current.play().catch((err) => {
  log.warn({ err }, "Remote audio playback failed");
  if (err.name === 'NotAllowedError') {
    setAudioError("Enable audio playback to hear voice messages");
    // Show UI button to unlock
  } else {
    toast({ title: "Voice message playback failed", variant: "destructive" });
  }
});
```

---

#### BUG #6: Unhandled Promise Rejection - Photo Upload (MEDIUM)
- **File**: `src/pages/Active.tsx` (L700-780)
- **Severity**: 🟡 MEDIUM
- **Category**: Error Handling
- **Issue**: References undefined `status` variable
- **Problematic Code**:
```typescript
try {
  const photoUrl = await uploadProofPhoto(compressedFile);
  // ...
} catch (err) {
  const isNetworkErr = !status; // `status` is undefined!
  if (isNetworkErr) {
    setProofStagedForRetry(true);
  } else {
    toast({ title: e instanceof Error ? e.message : "Photo upload failed..." });
  }
}
```
- **Why It's a Bug**: Undefined variable check always true, incorrect error path
- **Impact**: Wrong error handling, potential runtime errors
- **Fix**:
```typescript
catch (err) {
  const isNetworkErr = err instanceof Error && err.message.includes('network');
  if (isNetworkErr) {
    setProofStagedForRetry(true);
  } else {
    toast({ 
      title: err instanceof Error ? err.message : "Photo upload failed",
      variant: "destructive"
    });
  }
}
```

---

### **SECTION 3: AUTHENTICATION & SECURITY**

#### BUG #7: Token Refresh Race Condition (CRITICAL) ⭐
- **File**: `src/lib/socket.tsx` (L250-280)
- **Severity**: 🔴 **CRITICAL**
- **Category**: Real-time/Auth
- **Issue**: Two concurrent socket reconnects from callback AND polling interval
- **Why It's a Bug**: Messages lost during double disconnect/reconnect
- **Impact**: CRITICAL - Real-time messages lost (rides, approvals, locations)
- **Fix**:
```typescript
let tokenRefreshPending = false;

const handleTokenRefresh = () => {
  if (tokenRefreshPending) return;
  tokenRefreshPending = true;
  
  const freshToken = api.getToken();
  if (!freshToken) {
    tokenRefreshPending = false;
    return;
  }
  
  writeSocketAuth({ ...readSocketAuth(), token: freshToken });
  s.disconnect();
  s.once('disconnect', () => {
    s.connect();
    tokenRefreshPending = false;
  });
};

registerTokenRefreshCallback(handleTokenRefresh);
// REMOVE the polling interval entirely
```

---

#### BUG #8: CNIC Format Validation Inconsistency (HIGH)
- **File**: `src/pages/Profile.tsx` (L60-70)
- **Severity**: 🔴 HIGH
- **Category**: Validation
- **Issue**: Client-side formatting doesn't validate checksum
- **Problematic Code**:
```typescript
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  // Returns "00000-0000000-0" as valid, but server rejects
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}
```
- **Why It's a Bug**: Invalid CNIC passes client validation but fails server
- **Impact**: User confusion, unclear error from server
- **Fix**: Use actual CNIC validation from `@workspace/phone-utils`

---

#### BUG #9: SessionStorage Clear Error in Private Browsing (LOW)
- **File**: `src/lib/rider-auth.tsx` (L440-450)
- **Severity**: 🟠 LOW
- **Category**: Data Privacy
- **Issue**: sessionStorage.clear() fails in private mode but error swallowed
- **Impact**: User data not cleared on logout in private browsing
- **Fix**: Track clear failure and use alternative storage

---

### **SECTION 4: DATA & DATABASE**

#### BUG #10: GPS Queue IndexedDB Dead Connection (HIGH)
- **File**: `src/lib/gpsQueue.ts` (L95-150)
- **Severity**: 🔴 HIGH
- **Category**: Data Persistence
- **Issue**: Database promise cached but connection never reset on external close
- **Why It's a Bug**: GPS pings fail silently, no persistence
- **Impact**: HIGH - Tracking data lost on app restart
- **Fix**:
```typescript
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // ... setup ...
    
    req.onsuccess = () => {
      const db = req.result;
      
      db.onversionchange = () => {
        db.close();
        _dbPromise = null;
      };
      
      db.onclose = () => {
        // NEW: Reset on external close
        _dbPromise = null;
      };
      
      resolve(db);
    };
  });
  
  return _dbPromise;
}
```

---

#### BUG #11: Offline Queue Silent IndexedDB Failures (HIGH)
- **File**: `src/lib/offline/queueManager.ts` (L50-90)
- **Severity**: 🔴 HIGH
- **Category**: Data Persistence
- **Issue**: IndexedDB failures fall back to ephemeral in-memory only
- **Why It's a Bug**: Order updates lost on app refresh
- **Impact**: HIGH - Critical updates lost (deliveries, status, income)
- **Fix**: Implement localStorage fallback + retry queue

---

### **SECTION 5: PERFORMANCE**

#### BUG #12: Unnecessary Re-renders in useHomeData (MEDIUM)
- **File**: `src/components/home/useHomeData.ts` (L200-230)
- **Severity**: 🟡 MEDIUM
- **Category**: Performance
- **Issue**: currentIdsSig changes on reorder even if IDs unchanged
- **Problematic Code**:
```typescript
const currentIdsSig = useMemo(() =>
  [...allOrders.map(o => o.id), ...allRides.map(r => r.id)].sort().join(","),
  [allOrders, allRides]
);

useEffect(() => {
  // Processes new requests and handles sound playback
}, [currentIdsSig]); // Triggers on reorder, not just new IDs
```
- **Why It's a Bug**: Sound playback triggers unnecessarily
- **Impact**: Spurious notifications, performance degradation
- **Fix**: Use Set comparison instead of string join

---

#### BUG #13: Closure Stale Reference - useHomeData (MEDIUM)
- **File**: `src/components/home/useHomeData.ts` (L155-175)
- **Severity**: 🟡 MEDIUM
- **Category**: State Management
- **Issue**: useCallback closures over stale `activeData`
- **Problematic Code**:
```typescript
const { data: activeData } = useQuery({...});
const hasActiveTask = !!(activeData?.order || activeData?.ride);

const onAcceptOrder = useCallback(() => {
  // Closes over stale activeData!
}, []); // Empty deps - BUG
```
- **Why It's a Bug**: Callback uses outdated data, incorrect state logic
- **Impact**: Incorrect behavior when accepting offers
- **Fix**:
```typescript
const onAcceptOrder = useCallback(() => {
  // ...
}, [activeData]); // Include in deps
```

---

### **SECTION 6: ROUTES & NAVIGATION**

#### BUG #14: Missing Route Parameter Validation (MEDIUM)
- **File**: `src/pages/Profile.tsx` (L300-315)
- **Severity**: 🟡 MEDIUM
- **Category**: Navigation
- **Issue**: Deep link validation doesn't handle invalid sections
- **Problematic Code**:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("section") !== "documents") return; // No other sections handled
  // ...
}, []);
```
- **Why It's a Bug**: Deep links with typos fail silently
- **Impact**: Broken deep links, user goes to wrong section
- **Fix**: Whitelist valid sections and log invalid ones

---

#### BUG #25: RedirectTo Race with Auth Validation (HIGH)
- **File**: `src/App.tsx` (L130-150)
- **Severity**: 🔴 HIGH
- **Category**: Navigation
- **Issue**: Navigation before auth state settles
- **Problematic Code**:
```typescript
function RedirectTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true }); // Immediate, no wait for auth
  }, [to, navigate]);
  return null;
}
```
- **Why It's a Bug**: User briefly sees wrong page before redirect
- **Impact**: Visible UI flicker, brief 404 visible
- **Fix**: Wait for auth context to load before navigating

---

### **SECTION 7: REAL-TIME FEATURES**

#### BUG #15: Socket Message Ordering Race (HIGH)
- **File**: `src/lib/socket.tsx` (L270-290)
- **Severity**: 🔴 HIGH
- **Category**: Real-time
- **Issue**: Socket messages processed before sync completes
- **Why It's a Bug**: Ride requests can be overwritten by REST data
- **Impact**: HIGH - Ride requests dropped
- **Fix**: Queue socket messages during sync, process after

---

#### BUG #16: Admin Chat Persistence No Expiry (MEDIUM)
- **File**: `src/lib/socket.tsx` (L110-140)
- **Severity**: 🟡 MEDIUM
- **Category**: Storage
- **Issue**: Chat messages accumulate indefinitely in localStorage
- **Problematic Code**:
```typescript
const [adminChatMessages, setAdminChatMessages] = useState(() =>
  loadAdminChatMessages()
);

useEffect(() => {
  persistAdminChatMessages(adminChatMessages); // No TTL
}, [adminChatMessages]);
```
- **Why It's a Bug**: localStorage quota exceeded over time
- **Impact**: App slowdown, quota issues
- **Fix**: Add automatic cleanup for messages older than 7 days

---

### **SECTION 8: MOBILE/CAPACITOR**

#### BUG #17: Preferences Plugin Error Swallowing (HIGH)
- **File**: `src/lib/api.ts` (L30-70)
- **Severity**: 🔴 HIGH
- **Category**: Mobile/Storage
- **Issue**: Token persistence failures logged but not reported
- **Problematic Code**:
```typescript
async function preferencesSet(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch (err) {
    log.warn({ key, err }, "[api] preferencesSet failed");
    // Returns undefined - caller doesn't know if save succeeded
  }
}

function sessionSet(value: string): void {
  _inMemoryAccessToken = value;
  preferencesSet(TOKEN_KEY, value).catch((err) => {
    log.warn({ err }, "[api] sessionSet persistence failed");
    // Swallows error - in-memory token exists but not persistent
  });
}
```
- **Why It's a Bug**: Token stored in memory but not persistent on private browsing
- **Impact**: CRITICAL - Users logged out after app restart
- **Fix**:
```typescript
async function preferencesSet(key: string, value: string): Promise<boolean> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
    return true;
  } catch (err) {
    log.error({ key, err }, "[api] preferencesSet failed - token will not persist");
    return false; // Return success/failure
  }
}

async function sessionSet(value: string): Promise<void> {
  _inMemoryAccessToken = value;
  const persisted = await preferencesSet(TOKEN_KEY, value);
  if (!persisted) {
    log.warn("Token not persisted - app restart will require re-login");
  }
}
```

---

#### BUG #18: Missing Capacitor Plugin Initialization Check (MEDIUM)
- **File**: `src/lib/api.ts` (L50-80)
- **Severity**: 🟡 MEDIUM
- **Category**: Mobile/Init
- **Issue**: Preferences used before Capacitor initializes
- **Problematic Code**:
```typescript
const { Preferences } = await import("@capacitor/preferences");
await Preferences.set({ key, value }); // May fail if plugin not ready
```
- **Why It's a Bug**: First-load token persistence can fail
- **Impact**: Users forced to re-login on first app launch
- **Fix**:
```typescript
async function waitForCapacitor(): Promise<void> {
  if (typeof (window as any).Capacitor === 'undefined') {
    return; // Not using Capacitor
  }
  
  const { App } = await import("@capacitor/app");
  await new Promise(resolve => {
    const checkReady = () => {
      if ((window as any).Capacitor?.ready) {
        resolve(undefined);
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}

// Call at app startup
await waitForCapacitor();
```

---

### **SECTION 9: FORM VALIDATION**

#### BUG #19: IBAN Validation Case Sensitivity (HIGH)
- **File**: `src/components/wallet/DepositModal.tsx` (L180-210)
- **Severity**: 🔴 HIGH
- **Category**: Validation
- **Issue**: IBAN regex requires uppercase but users paste lowercase
- **Problematic Code**:
```typescript
if (selectedMethod?.id === "bank") {
  const cleaned = senderAcNo.replace(/[\s-]/g, "");
  const isIban = /^PK\d{2}[A-Z]{4}\d{16}$/i.test(cleaned);
  // Regex has /i flag for case-insensitive but bank code must be uppercase SCBL
  const isAccountNo = /^\d{8,20}$/.test(cleaned);
  if (!isIban && !isAccountNo) {
    setErr(T("validIbanHint"));
    return;
  }
}
```
- **Why It's a Bug**: Valid IBANs pasted in lowercase rejected
- **Impact**: Valid IBANs rejected, user must manually type
- **Fix**:
```typescript
const cleaned = senderAcNo.replace(/[\s-]/g, "").toUpperCase();
const isIban = /^PK\d{2}[A-Z]{4}\d{16}$/.test(cleaned);
```

---

#### BUG #20: Phone Number Input XSS Risk (LOW)
- **File**: `src/pages/LoginHistory.tsx` (L240-260)
- **Severity**: 🟠 LOW
- **Category**: Security
- **Issue**: No input validation on phone numbers
- **Impact**: Low-Medium XSS if input echoed without escaping
- **Fix**: Add input validation and proper escaping on display

---

### **SECTION 10: STATE MANAGEMENT**

#### BUG #21: Offline Queue Infinite Retry (MEDIUM)
- **File**: `src/lib/offline/queueManager.ts` (L200-250)
- **Severity**: 🟡 MEDIUM
- **Category**: Performance
- **Issue**: No max retry count or backoff decay
- **Problematic Code**: Action retried indefinitely if API endpoint broken
- **Impact**: Battery drain, network traffic spike
- **Fix**: Add MAX_RETRIES + exponential backoff

---

#### BUG #22: Profile Edit Section State Not Validated (MEDIUM)
- **File**: `src/pages/Profile.tsx` (L250-270)
- **Severity**: 🟡 MEDIUM
- **Category**: State Management
- **Issue**: Editing state accepts any value, no validation
- **Problematic Code**:
```typescript
type EditSection = "personal" | "vehicle" | "bank" | null;
const [editing, setEditing] = useState<EditSection>(null);

const goToEditSection = (section: any) => {
  setEditing(section); // No validation
};
```
- **Why It's a Bug**: Typo shows empty form
- **Impact**: UI crash or empty form
- **Fix**:
```typescript
const goToEditSection = (section: unknown) => {
  if (typeof section !== 'string' || !['personal', 'vehicle', 'bank'].includes(section)) {
    console.warn('[Profile] Invalid edit section:', section);
    return;
  }
  setEditing(section as EditSection);
};
```

---

#### BUG #23: RideOTP Modal - Error Not Cleared on Retry (MEDIUM)
- **File**: `src/pages/Active.tsx` (L400-430)
- **Severity**: 🟡 MEDIUM
- **Category**: UX
- **Issue**: OTP error text persists when user retries
- **Problematic Code**: No `onChange` handler clears `otpError`
- **Impact**: User confused about state
- **Fix**:
```typescript
<OTPInput
  value={otp}
  onChange={(newOtp) => {
    setOtp(newOtp);
    if (otpError) setOtpError(null); // Clear error on input
  }}
/>
```

---

#### BUG #24: Double-Click Accept Order (HIGH)
- **File**: `src/components/home/useHomeData.ts` (L600-650)
- **Severity**: 🔴 HIGH
- **Category**: Race Condition
- **Issue**: Accept button doesn't disable immediately
- **Why It's a Bug**: User can double-click, two API calls fire
- **Impact**: CRITICAL - Order accepted twice
- **Fix**:
```typescript
const onAcceptOrder = useCallback((id: string) => {
  // Optimistic update + immediate disable
  setIsAcceptingId(id);
  
  acceptOrderMut.mutate({ id }, {
    onSuccess: () => {
      setIsAcceptingId(null);
      // Toast success
    },
    onError: () => {
      setIsAcceptingId(null);
      // Toast error
    }
  });
}, [acceptOrderMut]);

// In JSX
<button 
  onClick={() => onAcceptOrder(order.id)}
  disabled={isAcceptingId === order.id}
>
  {isAcceptingId === order.id ? "Accepting..." : "Accept"}
</button>
```

---

## 🔧 FIX PRIORITY ROADMAP

### Phase 1: CRITICAL FIXES (Must do first)
1. ✅ **BUG #7**: Token Refresh Race (remove polling interval)
2. ✅ **BUG #24**: Double-Click Accept (add optimistic disable)
3. ✅ **BUG #15**: Socket Message Ordering (queue during sync)
4. ✅ **BUG #10**: GPS Queue Dead Connection (add onclose handler)
5. ✅ **BUG #11**: Offline Queue Silent Failures (localStorage fallback)

### Phase 2: HIGH PRIORITY FIXES
6. ✅ **BUG #1**: Memory Leak Cleanup
7. ✅ **BUG #3**: Modal State Reset
8. ✅ **BUG #4**: Promise.all Error Handling
9. ✅ **BUG #8**: CNIC Validation
10. ✅ **BUG #17**: Preferences Error Handling
11. ✅ **BUG #19**: IBAN Case Sensitivity
12. ✅ **BUG #25**: Auth Navigation Race

### Phase 3: MEDIUM PRIORITY FIXES
13. ✅ **BUG #5**: Chat Audio Error UI
14. ✅ **BUG #6**: Photo Upload Error Variable
15. ✅ **BUG #12**: Re-render Optimization
16. ✅ **BUG #13**: Closure Stale Reference
17. ✅ **BUG #14**: Route Param Validation
18. ✅ **BUG #16**: Chat Message Expiry
19. ✅ **BUG #18**: Capacitor Init Check
20. ✅ **BUG #21**: Queue Retry Limits
21. ✅ **BUG #22**: Edit Section Validation
22. ✅ **BUG #23**: OTP Error Clearing

### Phase 4: LOW PRIORITY FIXES
23. ✅ **BUG #9**: SessionStorage Error
24. ✅ **BUG #20**: Phone Validation XSS

---

## 📊 IMPACT SUMMARY

| Impact | Count | Examples |
|--------|-------|----------|
| Data Loss | 5 | GPS queue, offline queue, socket messages, chat, token |
| UX Regression | 7 | Modal state, double-click, errors not cleared, navigation flicker |
| Performance | 4 | Re-renders, event accumulation, queue retries, storage |
| Security | 3 | XSS, token persistence, CNIC validation |
| Reliability | 6 | API race conditions, socket ordering, auth race |

---

## ✅ TESTING STRATEGY

### Unit Tests Needed
- Token refresh callback deduplication
- IBAN/CNIC validation edge cases
- Modal state reset on mount/unmount
- Offline queue fallback mechanisms

### Integration Tests Needed
- Socket reconnect with pending requests
- Accept order double-click prevention
- GPS queue persistence after DB close
- API error handling in Promise.all scenarios

### E2E Tests Needed
- Full ride acceptance flow (no double-click)
- Token refresh during active ride
- Offline to online transition
- Chat persistence and cleanup

---

**Report Generated**: June 2, 2026  
**Total Bugs**: 25 (1 Critical, 11 High, 10 Medium, 3 Low)  
**Estimated Fix Time**: 40-60 hours  
**Risk Level**: 🔴 HIGH (5+ critical data loss risks)
