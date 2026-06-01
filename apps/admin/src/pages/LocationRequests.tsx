import { fetchAdminAbsolute } from "@/lib/adminFetcher";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import leafletIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import leafletIconUrl from "leaflet/dist/images/marker-icon.png";
import leafletShadowUrl from "leaflet/dist/images/marker-shadow.png";
import {
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useLocation } from "wouter";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: leafletIconUrl,
  iconRetinaUrl: leafletIconRetinaUrl,
  shadowUrl: leafletShadowUrl,
});

type LocationRequest = {
  id: number;
  type: "city" | "area";
  rawValue: string;
  correctedValue: string;
  status: "pending" | "approved" | "rejected";
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    Icon: Clock,
  },
  approved: {
    label: "Approved",
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
    Icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300",
    Icon: XCircle,
  },
};

function StatusBadge({ status }: { status: LocationRequest["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 12, { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

type ApproveModalProps = {
  request: LocationRequest;
  onClose: () => void;
  onConfirm: (payload: { id: number; lat: number; lng: number; name: string; city: string; radiusKm: number }) => void;
  isPending: boolean;
};

function ApproveModal({ request, onClose, onConfirm, isPending }: ApproveModalProps) {
  const defaultCity = request.type === "area" ? "" : request.correctedValue;
  const [name, setName] = useState(request.correctedValue);
  const [city, setCity] = useState(defaultCity);
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [radiusKm, setRadiusKm] = useState(30);
  const [errors, setErrors] = useState<{ lat?: string; lng?: string; name?: string; city?: string; radiusKm?: string }>({});
  const backdropRef = useRef<HTMLDivElement>(null);

  const latNum = parseFloat(latStr);
  const lngNum = parseFloat(lngStr);
  const validLat = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
  const validLng = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180;
  const showMap = validLat && validLng;

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!city.trim()) e.city = "City is required";
    if (!latStr.trim() || !validLat) e.lat = "Enter a valid latitude (-90 to 90)";
    if (!lngStr.trim() || !validLng) e.lng = "Enter a valid longitude (-180 to 180)";
    if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 500) e.radiusKm = "Radius must be an integer between 1 and 500";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onConfirm({ id: request.id, lat: latNum, lng: lngNum, name: name.trim(), city: city.trim(), radiusKm });
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Approve Location Request
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set the correct coordinates before adding to service zones.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition p-1 rounded-lg hover:bg-muted"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Zone Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? "border-red-400" : "border-input"}`}
                placeholder="Zone / area name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.city ? "border-red-400" : "border-input"}`}
                placeholder="City"
              />
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Radius (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Math.round(Number(e.target.value)))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.radiusKm ? "border-red-400" : "border-input"}`}
                placeholder="e.g. 30"
              />
              {errors.radiusKm && <p className="text-xs text-red-500 mt-1">{errors.radiusKm}</p>}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>
              <span className="font-semibold">Type:</span>{" "}
              <span className={`uppercase font-bold ${request.type === "city" ? "text-purple-700" : "text-blue-700"}`}>
                {request.type}
              </span>
            </p>
            <p>
              <span className="font-semibold">Original:</span> {request.rawValue}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Latitude <span className="text-red-500">*</span>
              </label>
              <input
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lat ? "border-red-400" : "border-input"}`}
                placeholder="e.g. 33.7294"
                inputMode="decimal"
              />
              {errors.lat && <p className="text-xs text-red-500 mt-1">{errors.lat}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Longitude <span className="text-red-500">*</span>
              </label>
              <input
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lng ? "border-red-400" : "border-input"}`}
                placeholder="e.g. 73.0931"
                inputMode="decimal"
              />
              {errors.lng && <p className="text-xs text-red-500 mt-1">{errors.lng}</p>}
            </div>
          </div>

          <div className={`rounded-xl overflow-hidden border transition-all ${showMap ? "h-52" : "h-28 flex items-center justify-center bg-muted/30"}`}>
            {showMap ? (
              <MapContainer
                center={[latNum, lngNum]}
                zoom={12}
                className="h-full w-full"
                scrollWheelZoom={false}
                zoomControl={true}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[latNum, lngNum]} />
                <MapFlyTo lat={latNum} lng={lngNum} />
              </MapContainer>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <MapPin className="w-7 h-7 opacity-30" />
                <p className="text-xs">Enter valid coordinates to see the map preview</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isPending ? "Approving…" : "Approve & Add to Service Zones"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [approveTarget, setApproveTarget] = useState<LocationRequest | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-location-requests"],
    queryFn: async () => {
      const res = await fetchAdminAbsolute("/api/admin/location-requests");
      return (res as { requests: LocationRequest[] }).requests ?? [];
    },
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: { id: number; lat: number; lng: number; name: string; city: string; radiusKm: number }) => {
      await fetchAdminAbsolute(`/api/admin/location-requests/${payload.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: payload.lat, lng: payload.lng, name: payload.name, city: payload.city, radiusKm: payload.radiusKm }),
      });
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["admin-location-requests"] });
      const prev = queryClient.getQueryData<LocationRequest[]>(["admin-location-requests"]);
      queryClient.setQueryData<LocationRequest[]>(["admin-location-requests"], (old) =>
        (old ?? []).map((r) => (r.id === payload.id ? { ...r, status: "approved" } : r))
      );
      return { prev };
    },
    onSuccess: () => {
      toast({
        title: "Zone added to service zones",
        action: (
          <ToastAction altText="View Service Zones" onClick={() => navigate("/delivery-access")}>
            View Service Zones
          </ToastAction>
        ),
      });
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin-location-requests"], ctx.prev);
    },
    onSettled: () => {
      setApproveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-location-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-location-requests-count"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-access"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetchAdminAbsolute(`/api/admin/location-requests/${id}/reject`, {
        method: "PATCH",
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin-location-requests"] });
      const prev = queryClient.getQueryData<LocationRequest[]>(["admin-location-requests"]);
      queryClient.setQueryData<LocationRequest[]>(["admin-location-requests"], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin-location-requests"], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-location-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-location-requests-count"] });
    },
  });

  const requests = data ?? [];
  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {approveTarget && (
        <ApproveModal
          request={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={(payload) => approveMutation.mutate(payload)}
          isPending={approveMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-500" />
            Location Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review custom city and area entries submitted by users during registration.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-muted transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(["all", "pending", "approved"] as const).map((s) => {
          const cnt =
            s === "all" ? requests.length : requests.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-xl border p-4 text-left transition ${filter === s ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted"}`}
            >
              <p className="text-2xl font-bold">{cnt}</p>
              <p className="text-sm text-muted-foreground capitalize">{s === "all" ? "Total" : s}</p>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading requests…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-red-700 text-sm">
          Failed to load location requests. Please refresh.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <MapPin className="w-12 h-12 opacity-30" />
          <p className="text-lg font-medium">No location requests</p>
          <p className="text-sm">
            {filter === "all"
              ? "When users enter custom cities or areas, they'll appear here."
              : `No ${filter} requests.`}
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Raw Value</th>
                <th className="text-left px-4 py-3 font-medium">Corrected Value</th>
                <th className="text-left px-4 py-3 font-medium">Submitted At</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        req.type === "city"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {req.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{req.rawValue}</td>
                  <td className="px-4 py-3 font-medium">{req.correctedValue}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString("en-PK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3">
                    {req.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setApproveTarget(req)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(req.id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
