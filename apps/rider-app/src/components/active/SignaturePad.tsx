import { tDual } from "@workspace/i18n";
import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { useLanguage } from "../../lib/useLanguage";

interface SignaturePadProps {
  onConfirm: (dataUrl: string, file: File) => void;
  onCancel: () => void;
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0]!;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setHasStrokes(true);
    lastPosRef.current = getPos(e, canvas);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    const last = lastPosRef.current;
    if (!last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasStrokes(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
      onConfirm(dataUrl, file);
    }, "image/png");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-surface"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-base font-black text-foreground">{T("drawSignature")}</p>
          <p className="text-xs text-muted-foreground">{T("signWithFinger")}</p>
        </div>
        <button
          onClick={onCancel}
          aria-label={T("close")}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
        >
          <X size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="relative flex-1 bg-card p-4">
        <div className="relative h-full overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted shadow-inner">
          {!hasStrokes && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm font-medium text-muted-foreground">{T("drawHere")}</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            aria-label={T("drawSignature")}
            role="img"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-muted mx-8 mt-2" />
      </div>

      <div className="flex gap-3 border-t border-border px-4 py-4">
        <button
          onClick={clear}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-muted py-3.5 text-sm font-bold text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
        >
          <RefreshCw size={15} /> {T("clear")}
        </button>
        <button
          onClick={confirm}
          disabled={!hasStrokes}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
        >
          <Check size={16} /> {T("confirmSignature")}
        </button>
      </div>
    </div>
  );
}
