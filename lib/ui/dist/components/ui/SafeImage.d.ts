export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    fallbackClassName?: string;
}
/**
 * SafeImage — a drop-in <img> replacement for images loaded from external
 * URLs or CDN-backed sources.
 *
 * Behaviours applied automatically:
 * - `crossOrigin="anonymous"` — prevents tainting the canvas and satisfies
 *   CORP requirements on strict CDNs.
 * - `loading="lazy"` (below-fold default) — defer off-screen fetches.
 * - `onError` — swaps the broken image for a neutral `<ImageOff>` icon
 *   so broken avatars / product thumbnails never show empty boxes.
 *
 * Pass `loading="eager"` for above-the-fold hero images.
 */
export declare function SafeImage({ src, alt, className, fallbackClassName, loading, ...rest }: SafeImageProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=SafeImage.d.ts.map