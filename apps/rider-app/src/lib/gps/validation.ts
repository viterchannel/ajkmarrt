/**
 * Pakistan geographic hard bounding box — mirrors the server-side constants
 * in gpsSpoof.ts so the client rejects out-of-region pings before sending.
 */
export const PAKISTAN_BBOX = {
  LAT_MIN: 23.5,
  LAT_MAX: 37.1,
  LON_MIN: 60.8,
  LON_MAX: 77.8,
} as const;

export interface GpsPing {
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isMockProvider?: boolean;
}

export interface GpsValidationResult {
  valid: boolean;
  reason: string;
  suspicious: boolean;
  suspicionReason?: string;
}

interface AuditEntry {
  timestamp: number;
  reason: string;
  lat: number;
  lng: number;
}

let _maxSpeedKmh = 200;
const MIN_ACCURACY_M = 0.5;
/* L-07: Allow 1 single-outlier GPS jump (e.g. multipath in cities) before
   hard-rejecting. Consecutive violations still trigger the impossible-speed
   gate. Counter resets on any valid-speed ping. */
let _consecutiveSpeedViolations = 0;
const SPEED_VIOLATION_GRACE = 1;
const MAX_FUTURE_SECONDS = 5;
const MAX_AUDIT_ENTRIES = 100;

let _maxFutureSeconds = MAX_FUTURE_SECONDS;

/**
 * Override the GPS impossible-speed threshold from platform config.
 * Falls back to 200 km/h when platform config has not yet loaded.
 */
export function setMaxSpeedKmh(value: number): void {
  if (Number.isFinite(value) && value > 0) _maxSpeedKmh = value;
}

/**
 * Override the maximum allowed clock-ahead offset for GPS timestamps.
 * Defaults to 5 seconds; increase if server/device clock drift is observed.
 */
export function setMaxFutureSeconds(value: number): void {
  if (Number.isFinite(value) && value >= 0) _maxFutureSeconds = value;
}

const _auditLog: AuditEntry[] = [];

export function getGpsAuditLog(): readonly AuditEntry[] {
  return _auditLog;
}

function recordRejection(reason: string, lat: number, lng: number, suspicious = false): void {
  if (_auditLog.length >= MAX_AUDIT_ENTRIES) _auditLog.shift();
  _auditLog.push({
    timestamp: Date.now(),
    reason: suspicious ? `[suspicious] ${reason}` : reason,
    lat,
    lng,
  });
}

function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let _geofencePolygon: Array<[number, number]> | null = null;

export function setGeofencePolygon(polygon: Array<[number, number]> | null): void {
  _geofencePolygon = polygon;
}

function isInsidePolygon(lat: number, lng: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const lat_i = polygon[i]![0],
      lng_i = polygon[i]![1];
    const lat_j = polygon[j]![0],
      lng_j = polygon[j]![1];
    /* Ray-casting: longitude is the horizontal (X) axis, latitude is vertical (Y).
       Straddle test uses latitude; intersection formula solves for longitude. */
    const intersect =
      (lat_i > lat) !== (lat_j > lat) &&
      lng < ((lng_j - lng_i) * (lat - lat_i)) / (lat_j - lat_i) + lng_i;
    if (intersect) inside = !inside;
  }
  return inside;
}

const STALE_PING_THRESHOLD_MS = 30_000;

export function validateGpsPing(prev: GpsPing | null, next: GpsPing): GpsValidationResult {
  /* Reset violation counter at the start of every new trip segment so counts
     from a previous ride never bleed into this one. */
  if (prev === null) {
    _consecutiveSpeedViolations = 0;
  }

  const nextTime = new Date(next.timestamp).getTime();
  if (isNaN(nextTime)) {
    const reason = "invalid timestamp";
    recordRejection(reason, next.latitude, next.longitude);
    return { valid: false, reason, suspicious: false };
  }

  /* Null-island fast-reject — (0, 0) is an unambiguous sentinel for a missing
     GPS fix; reject immediately before any bounding-box or polygon check. */
  if (next.latitude === 0 && next.longitude === 0) {
    const reason = "null-island coordinates (0, 0)";
    recordRejection(reason, next.latitude, next.longitude, true);
    return { valid: false, reason: "GPS_NULL_ISLAND", suspicious: true };
  }

  /* Pakistan hard bounding box — mirrors the server-side check in gpsSpoof.ts.
     Reject pings before queuing so out-of-region coordinates never reach the server. */
  if (
    next.latitude < PAKISTAN_BBOX.LAT_MIN ||
    next.latitude > PAKISTAN_BBOX.LAT_MAX ||
    next.longitude < PAKISTAN_BBOX.LON_MIN ||
    next.longitude > PAKISTAN_BBOX.LON_MAX
  ) {
    const reason = `outside service region (lat ${next.latitude.toFixed(4)}, lon ${next.longitude.toFixed(4)})`;
    recordRejection(reason, next.latitude, next.longitude, true);
    return { valid: false, reason: "GPS_OUT_OF_REGION", suspicious: true };
  }

  if (nextTime > Date.now() + _maxFutureSeconds * 1_000) {
    const reason = `future timestamp (${Math.round((nextTime - Date.now()) / 1_000)}s ahead)`;
    recordRejection(reason, next.latitude, next.longitude);
    return { valid: false, reason, suspicious: false };
  }

  if (typeof next.accuracy === "number" && next.accuracy < MIN_ACCURACY_M) {
    const reason = `accuracy too high (${next.accuracy}m — possible spoof)`;
    recordRejection(reason, next.latitude, next.longitude);
    return { valid: false, reason, suspicious: false };
  }

  if (prev) {
    const prevTime = new Date(prev.timestamp).getTime();
    const deltaMs = nextTime - prevTime;
    /* Skip speed check entirely when the interval is < 100 ms — the tiny time
       window produces astronomically high computed speeds from any real GPS jitter
       and would trigger false spoof rejections. */
    if (deltaMs > 0 && deltaMs >= 100) {
      const distM = haversineDistanceM(
        prev.latitude,
        prev.longitude,
        next.latitude,
        next.longitude
      );
      const speedKmh = (distM / deltaMs) * 3_600;
      if (speedKmh > _maxSpeedKmh) {
        _consecutiveSpeedViolations += 1;
        if (_consecutiveSpeedViolations <= SPEED_VIOLATION_GRACE) {
          /* L-07: First outlier grace pass — city multipath, tunnel exit, or
             momentary sensor glitch. Accept the point as suspicious rather than
             hard-rejecting; consecutive violations still trigger the gate. */
          const suspicionReason = `possible GPS jump (${Math.round(speedKmh)} km/h, outlier #${_consecutiveSpeedViolations})`;
          recordRejection(suspicionReason, next.latitude, next.longitude, true);
          return { valid: true, reason: "ok", suspicious: true, suspicionReason };
        }
        const reason = `impossible speed (${Math.round(speedKmh)} km/h — ${_consecutiveSpeedViolations} consecutive violations)`;
        recordRejection(reason, next.latitude, next.longitude);
        return { valid: false, reason, suspicious: false };
      }
      _consecutiveSpeedViolations = 0; // reset on any valid-speed ping
    }
  }

  if (_geofencePolygon && _geofencePolygon.length >= 3) {
    if (!isInsidePolygon(next.latitude, next.longitude, _geofencePolygon)) {
      const reason = "outside configured geofence";
      recordRejection(reason, next.latitude, next.longitude);
      return { valid: false, reason, suspicious: false };
    }
  }

  /* ── Suspicious checks (valid but flagged) ── */

  const ageMs = Date.now() - nextTime;
  if (ageMs > STALE_PING_THRESHOLD_MS) {
    const suspicionReason = `stale ping (${Math.round(ageMs / 1_000)}s old)`;
    recordRejection(suspicionReason, next.latitude, next.longitude, true);
    return { valid: true, reason: "ok", suspicious: true, suspicionReason };
  }

  if (next.isMockProvider === true) {
    const suspicionReason = "mock location provider detected";
    recordRejection(suspicionReason, next.latitude, next.longitude, true);
    return { valid: true, reason: "ok", suspicious: true, suspicionReason };
  }

  return { valid: true, reason: "ok", suspicious: false };
}
