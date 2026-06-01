import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "../hooks/use-toast";
import { api } from "../lib/api";
import { errMsg } from "../lib/ui";

// ── Blank form template exported so Products.tsx & any future form can reset to it ──
export const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  category: "",
  unit: "",
  stock: "",
  image: "",
  type: "mart",
  videoUrl: "",
  tags: "",
  isHidden: false,
};

export type FormState = typeof EMPTY_FORM;

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  category?: string | null;
  unit?: string | null;
  stock?: number | null;
  image?: string | null;
  videoUrl?: string | null;
  type?: string | null;
  inStock?: boolean;
  tags?: string[] | null;
  isHidden?: boolean;
  lowStockThreshold?: number | null;
}

interface UseProductFormOptions {
  qc: QueryClient;
  isOnline: boolean;
  maxItems: number;
  totalProductCount: number | null;
  productThresholds: Record<string, number>;
  saveThreshold: (productId: string, value: number | null) => void;
  config: {
    uploads?: {
      maxVideoMb?: number;
      maxVideoDurationSec?: number;
      allowedVideoFormats?: string[];
    };
  };
  enqueueProductAction: (
    action: "create" | "update",
    payload: Record<string, unknown>,
    id?: string
  ) => string | undefined;
  onGateBlocked?: (missing: string[]) => void;
}

export function useProductForm({
  qc,
  isOnline,
  maxItems,
  totalProductCount,
  productThresholds,
  saveThreshold,
  config,
  enqueueProductAction,
  onGateBlocked,
}: UseProductFormOptions) {
  // ── Toast ──

  // ── Form state ──
  const [showAdd, setShowAdd] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    price?: string;
    category?: string;
  }>({});
  const [videoUploading, setVideoUploading] = useState(false);
  const [editThreshold, setEditThreshold] = useState("");

  // ── Field setter — clears the matching error on change ──
  const f = (k: string, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "name" || k === "price" || k === "category") {
      setFormErrors((prev) => ({ ...prev, [k]: undefined }));
    }
  };

  // ── Client-side validation ──
  const validateForm = (): boolean => {
    const errors: { name?: string; price?: string; category?: string } = {};
    if (!form.name.trim()) errors.name = "Product name is required";
    if (!form.price || Number(form.price) <= 0) errors.price = "A valid price is required";
    if (!form.category) errors.category = "Please select a category";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Video upload config (derived from platform config) ──
  const maxVideoMb = config.uploads?.maxVideoMb ?? 50;
  const maxVideoDurationSec = config.uploads?.maxVideoDurationSec ?? 60;
  const allowedVideoFormats =
    (config.uploads?.allowedVideoFormats ?? []).length > 0
      ? config.uploads!.allowedVideoFormats!.map((fmt) => `video/${fmt}`)
      : ["video/mp4", "video/quicktime", "video/webm"];

  const getVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error("Cannot read video"));
      video.src = URL.createObjectURL(file);
    });

  const handleVideoUpload = async (file: File) => {
    if (file.size > maxVideoMb * 1024 * 1024) {
      toast({ title: `Video must be under ${maxVideoMb}MB` });
      return;
    }
    if (!allowedVideoFormats.includes(file.type)) {
      toast({ title: `Only ${(config.uploads?.allowedVideoFormats ?? ["mp4", "mov", "webm"]).join(", ").toUpperCase()} videos allowed` });
      return;
    }
    try {
      const duration = await getVideoDuration(file);
      if (duration > maxVideoDurationSec) {
        toast({ title: `Video must be ${maxVideoDurationSec} seconds or less (yours is ${Math.ceil(duration)}s)` });
        return;
      }
    } catch {
      toast({ title: "Could not read video file — it may be corrupted or unsupported. Please try a different file." });
      return;
    }
    setVideoUploading(true);
    try {
      const result = await api.uploadVideo(file);
      f("videoUrl", result.url);
      toast({ title: "Video uploaded!" });
    } catch (e: unknown) {
      toast({ title: "Error: " + (e instanceof Error ? e.message : "Video upload failed") });
    }
    setVideoUploading(false);
  };

  // ── Helper: comma-separated tag string → array ──
  const tagsFromForm = (t: string): string[] =>
    t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  // ── Mutations ──

  const hideMut = useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      api.updateProduct(id, { isHidden }),
    onSuccess: (_, { isHidden }) => {
      void qc.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({ title: isHidden ? "Hidden from customers" : "Visible to customers" });
    },
    onError: (e: Error) => toast({ title: "Error: " + errMsg(e) }),
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (!isOnline) {
        const payload = {
          ...form,
          price: Number(form.price),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
          stock: form.stock !== "" ? Number(form.stock) : undefined,
          videoUrl: form.videoUrl || undefined,
          tags: tagsFromForm(form.tags),
          isHidden: form.isHidden,
        };
        const storageMsg = enqueueProductAction("create", payload as Record<string, unknown>);
        if (storageMsg && !storageMsg.startsWith("warn:")) {
          toast({ title: "❌ " + storageMsg, variant: "destructive" });
          return Promise.resolve(null);
        }
        setShowAdd(false);
        setForm({ ...EMPTY_FORM });
        toast({ title: storageMsg ? storageMsg.slice(5) : "Saved offline — will sync when connected" });
        return Promise.resolve(null);
      }
      if (totalProductCount == null)
        throw new Error("Cannot verify product count — please wait and try again.");
      if (totalProductCount >= maxItems)
        throw new Error(
          `Product limit of ${maxItems} reached. Delete existing products to add new ones.`
        );
      return api.createProduct({
        ...form,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        stock: form.stock !== "" ? Number(form.stock) : undefined,
        videoUrl: form.videoUrl || undefined,
        tags: tagsFromForm(form.tags),
        isHidden: form.isHidden,
      });
    },
    onSuccess: (result) => {
      if (result == null) return;
      void qc.invalidateQueries({ queryKey: ["vendor-products"] });
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Product added!" });
    },
    onError: (e: Error) => {
      const blocked = (e as Error & { blocked?: boolean; missingVerifications?: string[] }).blocked;
      const missing = (e as Error & { missingVerifications?: string[] }).missingVerifications;
      if (blocked && onGateBlocked) {
        setShowAdd(false);
        onGateBlocked(missing ?? ["documents_approved"]);
        return;
      }
      toast({ title: "Error: " + errMsg(e) });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      const prodId = editProd?.id;
      if (!prodId) return Promise.resolve(null);
      if (!isOnline) {
        const payload = {
          ...form,
          price: Number(form.price),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
          stock: form.stock !== "" ? Number(form.stock) : null,
          videoUrl: form.videoUrl || null,
          tags: tagsFromForm(form.tags),
          isHidden: form.isHidden,
        };
        const storageMsg = enqueueProductAction(
          "update",
          payload as Record<string, unknown>,
          prodId
        );
        if (storageMsg && !storageMsg.startsWith("warn:")) {
          toast({ title: "❌ " + storageMsg, variant: "destructive" });
          return Promise.resolve(null);
        }
        setEditProd(null);
        setShowAdd(false);
        toast({ title: storageMsg ? storageMsg.slice(5) : "Saved offline — will sync when connected" });
        return Promise.resolve(null);
      }
      const lowStockThresholdVal = editThreshold !== "" ? Number(editThreshold) : null;
      return api.updateProduct(prodId, {
        ...form,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: form.stock !== "" ? Number(form.stock) : null,
        videoUrl: form.videoUrl || null,
        tags: tagsFromForm(form.tags),
        isHidden: form.isHidden,
        lowStockThreshold: lowStockThresholdVal,
      });
    },
    onSuccess: (result) => {
      if (result == null) return;
      if (editProd) {
        if (editThreshold !== "") {
          const t = Number(editThreshold);
          if (!isNaN(t) && t >= 0) saveThreshold(editProd.id, t);
        } else {
          // Threshold was cleared — remove any stale localStorage override
          saveThreshold(editProd.id, null);
        }
      }
      void qc.invalidateQueries({ queryKey: ["vendor-products"] });
      setEditProd(null);
      setShowAdd(false);
      setEditThreshold("");
      toast({ title: "Updated!" });
    },
    onError: (e: Error) => toast({ title: "Error: " + errMsg(e) }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error: " + errMsg(e) }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) =>
      api.updateProduct(id, { inStock }),
    onSuccess: (_, { inStock }) => {
      void qc.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({ title: inStock ? "Marked In Stock" : "Marked Out of Stock" });
    },
    onError: (e: Error) => toast({ title: "Error: " + errMsg(e) }),
  });

  // ── Open / close form ──

  const openEdit = (p: Product) => {
    setEditProd(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      category: p.category || "",
      unit: p.unit || "",
      stock: p.stock != null ? String(p.stock) : "",
      image: p.image || "",
      type: p.type || "mart",
      videoUrl: p.videoUrl || "",
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
      isHidden: !!p.isHidden,
    });
    setEditThreshold(
      p.lowStockThreshold != null
        ? String(p.lowStockThreshold)
        : productThresholds[p.id] != null
          ? String(productThresholds[p.id])
          : ""
    );
    setShowAdd(true);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditProd(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setEditThreshold("");
  };

  return {
    // Form visibility
    showAdd,
    setShowAdd,
    editProd,
    // Form data
    form,
    formErrors,
    videoUploading,
    editThreshold,
    setEditThreshold,
    // Handlers
    f,
    validateForm,
    // Video helpers
    maxVideoMb,
    maxVideoDurationSec,
    allowedVideoFormats,
    handleVideoUpload,
    // Mutations
    hideMut,
    createMut,
    updateMut,
    deleteMut,
    toggleMut,
    // Form actions
    openEdit,
    closeForm,
  };
}
