import { fetchAdminAbsolute } from "@/lib/adminFetcher";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import leafletIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import leafletIconUrl from "leaflet/dist/images/marker-icon.png";
import leafletShadowUrl from "leaflet/dist/images/marker-shadow.png";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  Edit2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: leafletIconUrl,
  iconRetinaUrl: leafletIconRetinaUrl,
  shadowUrl: leafletShadowUrl,
});

type CityStats = {
  city: string;
  totalZones: number;
  activeZones: number;
  appliesToRides: boolean;
  appliesToOrders: boolean;
  appliesToParcel: boolean;
  isActive: boolean;
};

type ServiceZone = {
  id: number;
  name: string;
  city: string;
  lat: string;
  lng: string;
  radiusKm: string;
  isActive: boolean;
  appliesToRides: boolean;
  appliesToOrders: boolean;
  appliesToParcel: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 12, { duration: 0.6 });
  }, [map, lat, lng]);
  return null;
}

function ServiceBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
        active
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-50 text-gray-400 border-gray-200 line-through"
      }`}
    >
      {label}
    </span>
  );
}

type ZoneModalProps = {
  mode: "city" | "area";
  city?: string;
  zone?: ServiceZone;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
};

function ZoneModal({ mode, city, zone, onClose, onSave, isSaving }: ZoneModalProps) {
  const isEdit = !!zone;
  const [name, setName] = useState(zone?.name ?? "");
  const [cityName, setCityName] = useState(zone?.city ?? city ?? "");
  const [latStr, setLatStr] = useState(zone?.lat ?? "");
  const [lngStr, setLngStr] = useState(zone?.lng ?? "");
  const [radiusKm, setRadiusKm] = useState(zone ? parseFloat(zone.radiusKm) : 30);
  const [appliesToRides, setAppliesToRides] = useState(zone?.appliesToRides ?? true);
  const [appliesToOrders, setAppliesToOrders] = useState(zone?.appliesToOrders ?? true);
  const [appliesToParcel, setAppliesToParcel] = useState(zone?.appliesToParcel ?? true);
  const [notes, setNotes] = useState(zone?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const backdropRef = useRef<HTMLDivElement>(null);

  const latNum = parseFloat(latStr);
  const lngNum = parseFloat(lngStr);
  const validLat = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
  const validLng = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180;
  const showMap = validLat && validLng;

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (mode === "area" && !cityName.trim()) e.cityName = "City is required";
    if (!latStr.trim() || !validLat) e.lat = "Valid latitude (-90 to 90)";
    if (!lngStr.trim() || !validLng) e.lng = "Valid longitude (-180 to 180)";
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 5000)
      e.radiusKm = "Radius must be 0.1–5000 km";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim(),
      city: mode === "city" ? name.trim() : cityName.trim(),
      lat: latNum,
      lng: lngNum,
      radiusKm,
      appliesToRides,
      appliesToOrders,
      appliesToParcel,
      notes: notes.trim() || null,
    });
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {mode === "city" ? (
                <Building2 className="w-5 h-5 text-indigo-500" />
              ) : (
                <MapPin className="w-5 h-5 text-blue-500" />
              )}
              {isEdit ? "Edit" : "Add"} {mode === "city" ? "City" : "Area"}
            </h2>
            {city && mode === "area" && (
              <p className="text-xs text-muted-foreground mt-0.5">in {city}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {mode === "city" ? (
            <div>
              <label className="block text-xs font-medium mb-1">
                City Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? "border-red-400" : "border-input"}`}
                placeholder="e.g. Muzaffarabad"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                The city name will be applied to the first area zone you create.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? "border-red-400" : "border-input"}`}
                  placeholder="e.g. Satellite Town"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.cityName ? "border-red-400" : "border-input"}`}
                  placeholder="City name"
                  readOnly={!!city}
                />
                {errors.cityName && <p className="text-xs text-red-500 mt-1">{errors.cityName}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Latitude <span className="text-red-500">*</span>
              </label>
              <input
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lat ? "border-red-400" : "border-input"}`}
                placeholder="33.7294"
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
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lng ? "border-red-400" : "border-input"}`}
                placeholder="73.0931"
                inputMode="decimal"
              />
              {errors.lng && <p className="text-xs text-red-500 mt-1">{errors.lng}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Radius (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0.1}
                max={5000}
                step={0.1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value) || 0)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.radiusKm ? "border-red-400" : "border-input"}`}
              />
              {errors.radiusKm && <p className="text-xs text-red-500 mt-1">{errors.radiusKm}</p>}
            </div>
          </div>

          <div className={`rounded-xl overflow-hidden border transition-all ${showMap ? "h-40" : "h-20 flex items-center justify-center bg-muted/30"}`}>
            {showMap ? (
              <MapContainer
                center={[latNum, lngNum]}
                zoom={12}
                className="h-full w-full"
                scrollWheelZoom={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[latNum, lngNum]} />
                <MapFlyTo lat={latNum} lng={lngNum} />
              </MapContainer>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <MapPin className="w-5 h-5 opacity-30" />
                <p className="text-xs">Enter valid coordinates to preview map</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">Applies To</label>
            <div className="flex gap-3">
              {[
                { key: "appliesToRides", label: "Rides", val: appliesToRides, set: setAppliesToRides },
                { key: "appliesToOrders", label: "Orders", val: appliesToOrders, set: setAppliesToOrders },
                { key: "appliesToParcel", label: "Parcel", val: appliesToParcel, set: setAppliesToParcel },
              ].map(({ key, label, val, set }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => set(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border-input"
              placeholder="Internal notes…"
            />
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
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isSaving ? "Saving…" : isEdit ? "Save Changes" : `Add ${mode === "city" ? "City" : "Area"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DeleteConfirmProps = {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
};

function DeleteConfirm({ label, onConfirm, onCancel, isDeleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold">Confirm Delete</h3>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
          >
            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

type CityEditData = {
  newName: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  appliesToRides: boolean;
  appliesToOrders: boolean;
  appliesToParcel: boolean;
};

type CityEditModalProps = {
  cityStats: CityStats;
  onClose: () => void;
  onSave: (data: CityEditData) => void;
  isSaving: boolean;
};

function CityEditModal({ cityStats, onClose, onSave, isSaving }: CityEditModalProps) {
  const [name, setName] = useState(cityStats.city);
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [radiusKm, setRadiusKm] = useState<number | "">("");
  const [appliesToRides, setAppliesToRides] = useState(cityStats.appliesToRides);
  const [appliesToOrders, setAppliesToOrders] = useState(cityStats.appliesToOrders);
  const [appliesToParcel, setAppliesToParcel] = useState(cityStats.appliesToParcel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const backdropRef = useRef<HTMLDivElement>(null);

  const latNum = parseFloat(latStr);
  const lngNum = parseFloat(lngStr);
  const hasCoords = latStr.trim() !== "" || lngStr.trim() !== "";
  const validLat = !hasCoords || (Number.isFinite(latNum) && latNum >= -90 && latNum <= 90);
  const validLng = !hasCoords || (Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180);
  const showMap = Number.isFinite(latNum) && Number.isFinite(lngNum) && validLat && validLng;

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "City name is required";
    if (hasCoords) {
      if (!Number.isFinite(latNum) || !validLat) e.lat = "Valid latitude (-90 to 90)";
      if (!Number.isFinite(lngNum) || !validLng) e.lng = "Valid longitude (-180 to 180)";
      if (radiusKm !== "" && (!Number.isFinite(Number(radiusKm)) || Number(radiusKm) <= 0 || Number(radiusKm) > 5000))
        e.radiusKm = "Radius must be 0.1–5000 km";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const data: CityEditData = {
      newName: name.trim(),
      appliesToRides,
      appliesToOrders,
      appliesToParcel,
    };
    if (hasCoords && Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      data.lat = latNum;
      data.lng = lngNum;
      if (radiusKm !== "" && Number.isFinite(Number(radiusKm))) data.radiusKm = Number(radiusKm);
    }
    onSave(data);
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            Edit City — {cityStats.city}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
            <XCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              City Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? "border-red-400" : "border-input"}`}
              placeholder="City name"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Renaming applies to all {cityStats.totalZones} zone(s) in this city.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              City Coordinates & Radius
              <span className="text-muted-foreground font-normal ml-1">(optional — leave blank to keep existing)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  value={latStr}
                  onChange={(e) => setLatStr(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lat ? "border-red-400" : "border-input"}`}
                  placeholder="Latitude"
                  inputMode="decimal"
                />
                {errors.lat && <p className="text-xs text-red-500 mt-1">{errors.lat}</p>}
              </div>
              <div>
                <input
                  value={lngStr}
                  onChange={(e) => setLngStr(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.lng ? "border-red-400" : "border-input"}`}
                  placeholder="Longitude"
                  inputMode="decimal"
                />
                {errors.lng && <p className="text-xs text-red-500 mt-1">{errors.lng}</p>}
              </div>
              <div>
                <input
                  type="number"
                  min={0.1}
                  max={5000}
                  step={0.1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value ? parseFloat(e.target.value) : "")}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.radiusKm ? "border-red-400" : "border-input"}`}
                  placeholder="Radius (km)"
                />
                {errors.radiusKm && <p className="text-xs text-red-500 mt-1">{errors.radiusKm}</p>}
              </div>
            </div>
            {hasCoords && (
              <div className={`rounded-xl overflow-hidden border mt-2 transition-all ${showMap ? "h-36" : "h-14 flex items-center justify-center bg-muted/30"}`}>
                {showMap ? (
                  <MapContainer
                    center={[latNum, lngNum]}
                    zoom={11}
                    className="h-full w-full"
                    scrollWheelZoom={false}
                    attributionControl={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[latNum, lngNum]} />
                    <MapFlyTo lat={latNum} lng={lngNum} />
                  </MapContainer>
                ) : (
                  <p className="text-xs text-muted-foreground">Enter valid coordinates to preview</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              If provided, updates coordinates for all {cityStats.totalZones} zone(s) in this city.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">Services</label>
            <div className="flex gap-4">
              {[
                { label: "Rides", val: appliesToRides, set: setAppliesToRides },
                { label: "Orders", val: appliesToOrders, set: setAppliesToOrders },
                { label: "Parcel", val: appliesToParcel, set: setAppliesToParcel },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="rounded" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CitiesAreas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityModal, setCityModal] = useState<{ mode: "add" | "edit"; zone?: ServiceZone } | null>(null);
  const [editCityModal, setEditCityModal] = useState<CityStats | null>(null);
  const [areaModal, setAreaModal] = useState<{ mode: "add" | "edit"; zone?: ServiceZone } | null>(null);
  const [deleteCity, setDeleteCity] = useState<string | null>(null);
  const [deleteArea, setDeleteArea] = useState<ServiceZone | null>(null);

  const { data: cities = [], isLoading: citiesLoading, refetch: refetchCities } = useQuery<CityStats[]>({
    queryKey: ["admin-cities"],
    queryFn: async () => {
      const res = await fetchAdminAbsolute("/api/admin/cities");
      return (res as { data?: CityStats[] }).data ?? (res as CityStats[]);
    },
    refetchInterval: 60_000,
  });

  const { data: allZones = [], isLoading: zonesLoading, refetch: refetchZones } = useQuery<ServiceZone[]>({
    queryKey: ["admin-service-zones"],
    queryFn: async () => {
      const res = await fetchAdminAbsolute("/api/admin/service-zones");
      return (res as { data?: ServiceZone[] }).data ?? (res as ServiceZone[]);
    },
    refetchInterval: 60_000,
  });

  const cityZones = selectedCity
    ? allZones.filter((z) => z.city === selectedCity)
    : [];

  const toggleCityMutation = useMutation({
    mutationFn: async ({ city, isActive }: { city: string; isActive: boolean }) => {
      await fetchAdminAbsolute(`/api/admin/cities/${encodeURIComponent(city)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: (_d, vars) => {
      toast({ title: `${vars.city} ${vars.isActive ? "enabled" : "disabled"}` });
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to update city", description: (err as Error)?.message, variant: "destructive" });
    },
  });

  const deleteCityMutation = useMutation({
    mutationFn: async (city: string) => {
      await fetchAdminAbsolute(`/api/admin/cities/${encodeURIComponent(city)}`, { method: "DELETE" });
    },
    onSuccess: (_d, city) => {
      toast({ title: `City "${city}" deleted` });
      if (selectedCity === city) setSelectedCity(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
      setDeleteCity(null);
    },
    onError: (err: unknown) => {
      const msg = (err as Error)?.message ?? "Failed to delete city";
      toast({ title: "Cannot delete city", description: msg, variant: "destructive" });
      setDeleteCity(null);
    },
  });

  const updateCityMutation = useMutation({
    mutationFn: async ({
      city,
      data,
    }: {
      city: string;
      data: CityEditData;
    }) => {
      await fetchAdminAbsolute(`/api/admin/cities/${encodeURIComponent(city)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return data;
    },
    onSuccess: (data, vars) => {
      toast({ title: `City "${data.newName}" updated` });
      if (selectedCity === vars.city) setSelectedCity(data.newName);
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
      setEditCityModal(null);
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to update city", description: (err as Error)?.message, variant: "destructive" });
    },
  });

  const saveZoneMutation = useMutation({
    mutationFn: async ({ zone, data }: { zone?: ServiceZone; data: Record<string, unknown> }) => {
      if (zone) {
        await fetchAdminAbsolute(`/api/admin/service-zones/${zone.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetchAdminAbsolute("/api/admin/service-zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Zone saved successfully" });
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
      setCityModal(null);
      setAreaModal(null);
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to save zone", description: (err as Error)?.message, variant: "destructive" });
    },
  });

  const toggleZoneMutation = useMutation({
    mutationFn: async ({ zone, isActive }: { zone: ServiceZone; isActive: boolean }) => {
      await fetchAdminAbsolute(`/api/admin/service-zones/${zone.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to update zone", description: (err as Error)?.message, variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (zone: ServiceZone) => {
      await fetchAdminAbsolute(`/api/admin/service-zones/${zone.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Area deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-service-zones"] });
      setDeleteArea(null);
    },
    onError: (err: unknown) => {
      toast({ title: "Failed to delete area", description: (err as Error)?.message, variant: "destructive" });
      setDeleteArea(null);
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Modals */}
      {cityModal && (
        <ZoneModal
          mode="city"
          zone={cityModal.zone}
          onClose={() => setCityModal(null)}
          onSave={(data) => saveZoneMutation.mutate({ zone: cityModal.zone, data })}
          isSaving={saveZoneMutation.isPending}
        />
      )}
      {areaModal && (
        <ZoneModal
          mode="area"
          city={selectedCity ?? undefined}
          zone={areaModal.zone}
          onClose={() => setAreaModal(null)}
          onSave={(data) => saveZoneMutation.mutate({ zone: areaModal.zone, data })}
          isSaving={saveZoneMutation.isPending}
        />
      )}
      {deleteCity && (
        <DeleteConfirm
          label={`Delete all zones in "${deleteCity}"? This cannot be undone.`}
          onConfirm={() => deleteCityMutation.mutate(deleteCity)}
          onCancel={() => setDeleteCity(null)}
          isDeleting={deleteCityMutation.isPending}
        />
      )}
      {deleteArea && (
        <DeleteConfirm
          label={`Delete area "${deleteArea.name}"? This cannot be undone.`}
          onConfirm={() => deleteZoneMutation.mutate(deleteArea)}
          onCancel={() => setDeleteArea(null)}
          isDeleting={deleteZoneMutation.isPending}
        />
      )}
      {editCityModal && (
        <CityEditModal
          cityStats={editCityModal}
          onClose={() => setEditCityModal(null)}
          onSave={(data) => updateCityMutation.mutate({ city: editCityModal.city, data })}
          isSaving={updateCityMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Cities & Areas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage service zones. Changes propagate to Rider, Vendor, and Customer apps in real time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void refetchCities(); void refetchZones(); }}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-muted transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setCityModal({ mode: "add" })}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add City
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Cities Panel */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-500" />
                Cities ({cities.length})
              </h2>
            </div>

            {citiesLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading…
              </div>
            )}

            {!citiesLoading && cities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Building2 className="w-10 h-10 opacity-20" />
                <p className="text-sm">No cities yet</p>
                <button
                  onClick={() => setCityModal({ mode: "add" })}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  + Add your first city
                </button>
              </div>
            )}

            <div className="divide-y">
              {cities.map((c) => (
                <div
                  key={c.city}
                  onClick={() => setSelectedCity(c.city === selectedCity ? null : c.city)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                    selectedCity === c.city
                      ? "bg-indigo-50 dark:bg-indigo-950/30 border-l-2 border-indigo-500"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{c.city}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.isActive ? "ON" : "OFF"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {c.activeZones}/{c.totalZones} zones active
                      </span>
                      <div className="flex gap-1">
                        <ServiceBadge label="Rides" active={c.appliesToRides} />
                        <ServiceBadge label="Orders" active={c.appliesToOrders} />
                        <ServiceBadge label="Parcel" active={c.appliesToParcel} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleCityMutation.mutate({ city: c.city, isActive: !c.isActive })}
                      title={c.isActive ? "Disable city" : "Enable city"}
                      className={`relative h-5 w-10 rounded-full transition-colors flex-shrink-0 ${
                        c.isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          c.isActive ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => setEditCityModal(c)}
                      title="Edit city"
                      className="p-1 rounded-lg hover:bg-muted transition text-muted-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteCity(c.city)}
                      title="Delete city"
                      className="p-1 rounded-lg hover:bg-red-50 hover:text-red-600 transition text-muted-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        selectedCity === c.city ? "rotate-90 text-indigo-500" : ""
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Areas Panel */}
        <div className="lg:col-span-3">
          {!selectedCity ? (
            <div className="rounded-xl border h-full flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <MapPin className="w-12 h-12 opacity-20" />
              <p className="text-base font-medium">Select a city</p>
              <p className="text-sm text-center max-w-xs">
                Click a city on the left to view and manage its areas / neighborhoods.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  Areas in {selectedCity} ({cityZones.length})
                </h2>
                <button
                  onClick={() => setAreaModal({ mode: "add" })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Area
                </button>
              </div>

              {zonesLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading…
                </div>
              )}

              {!zonesLoading && cityZones.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <MapPin className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No areas in {selectedCity}</p>
                  <button
                    onClick={() => setAreaModal({ mode: "add" })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Add first area
                  </button>
                </div>
              )}

              <div className="divide-y">
                {cityZones.map((zone) => (
                  <div key={zone.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{zone.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            zone.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {zone.isActive ? "Active" : "Inactive"}
                        </span>
                        <div className="flex gap-1">
                          <ServiceBadge label="Rides" active={zone.appliesToRides} />
                          <ServiceBadge label="Orders" active={zone.appliesToOrders} />
                          <ServiceBadge label="Parcel" active={zone.appliesToParcel} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {zone.lat}, {zone.lng} · r={zone.radiusKm}km
                        {zone.notes ? ` · ${zone.notes}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleZoneMutation.mutate({ zone, isActive: !zone.isActive })}
                        title={zone.isActive ? "Disable area" : "Enable area"}
                        className={`relative h-5 w-10 rounded-full transition-colors ${
                          zone.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            zone.isActive ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => setAreaModal({ mode: "edit", zone })}
                        title="Edit area"
                        className="p-1 rounded-lg hover:bg-muted transition text-muted-foreground"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteArea(zone)}
                        title="Delete area"
                        className="p-1 rounded-lg hover:bg-red-50 hover:text-red-600 transition text-muted-foreground"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
