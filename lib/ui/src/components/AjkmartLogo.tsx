import React from "react";

export interface AjkmartLogoProps {
  variant?: "full" | "compact" | "mark" | "mono";
  size?: number;
  theme?: "light" | "dark";
}

const NAVY = "#0D1B4B";
const ORANGE = "#FF6B00";
const AMBER = "#F59E0B";
const WHITE = "#FFFFFF";
const GOLD = "#F0B90B";

const SERVICE_DOTS = [
  "#00C48C",
  "#FF9500",
  "#FCD34D",
  "#AF52DE",
  "#FF6B35",
  "#5856D6",
];

function CartIcon({ x, y, size, accent }: { x: number; y: number; size: number; accent: string }) {
  const s = size;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id="cartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ORANGE} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <path
        d={`M${s * 0.05},${s * 0.05} L${s * 0.2},${s * 0.05} L${s * 0.35},${s * 0.65} L${s * 0.85},${s * 0.65} L${s * 0.95},${s * 0.25} L${s * 0.25},${s * 0.25}`}
        stroke="url(#cartGrad)"
        strokeWidth={s * 0.08}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={s * 0.42} cy={s * 0.82} r={s * 0.08} fill="url(#cartGrad)" />
      <circle cx={s * 0.75} cy={s * 0.82} r={s * 0.08} fill="url(#cartGrad)" />
    </g>
  );
}

function AJKMark({
  textColor,
  cartAccent,
  dotOpacity = 1,
  markSize,
}: {
  textColor: string;
  cartAccent: string;
  dotOpacity?: number;
  markSize: number;
}) {
  const ms = markSize;
  const letterY = ms * 0.58;
  const fontSize = ms * 0.52;
  const dashX = ms * 0.01;
  const dashW = ms * 0.1;
  const dashH = ms * 0.035;
  const dashGap = ms * 0.055;

  return (
    <g>
      <defs>
        <linearGradient id="ajkCartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ORANGE} />
          <stop offset="100%" stopColor={cartAccent} />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={dashX}
          y={ms * 0.08 + i * dashGap}
          width={dashW * (1 - i * 0.15)}
          height={dashH}
          rx={dashH / 2}
          fill={textColor}
          opacity={0.9 - i * 0.15}
        />
      ))}
      <text
        x={ms * 0.14}
        y={letterY}
        fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        fill={textColor}
        letterSpacing="-1"
      >
        AJK
      </text>
      <CartIcon x={ms * 0.68} y={ms * 0.08} size={ms * 0.3} accent={cartAccent} />
      <g opacity={dotOpacity}>
        {SERVICE_DOTS.map((color, i) => (
          <circle
            key={i}
            cx={ms * 0.14 + i * (ms * 0.13)}
            cy={ms * 0.74}
            r={ms * 0.035}
            fill={color}
          />
        ))}
      </g>
    </g>
  );
}

export function AjkmartLogo({
  variant = "full",
  size = 180,
  theme = "light",
}: AjkmartLogoProps) {
  const isDark = theme === "dark";
  const textColor = isDark ? WHITE : NAVY;
  const cartAccent = isDark ? GOLD : AMBER;
  const taglineColor = isDark ? GOLD : AMBER;

  if (variant === "mark") {
    const s = size;
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="AJKMart"
      >
        <rect width="100" height="100" rx="20" fill={isDark ? "#0b0e11" : NAVY} />
        <defs>
          <linearGradient id="markCartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ORANGE} />
            <stop offset="100%" stopColor={cartAccent} />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={8}
            y={22 + i * 6}
            width={10 - i * 1.5}
            height={3.5}
            rx={1.75}
            fill={WHITE}
            opacity={0.9 - i * 0.15}
          />
        ))}
        <text
          x={20}
          y={64}
          fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
          fontWeight="800"
          fontSize={46}
          fill={WHITE}
          letterSpacing="-2"
        >
          AJK
        </text>
        <path
          d="M72,62 L78,62 L84,78 L94,78 L96,68 L80,68"
          stroke="url(#markCartGrad)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="84" cy="84" r="3" fill="url(#markCartGrad)" />
        <circle cx="93" cy="84" r="3" fill="url(#markCartGrad)" />
      </svg>
    );
  }

  if (variant === "mono") {
    const monoColor = isDark ? WHITE : NAVY;
    const w = size;
    const h = size * 0.55;
    return (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${Math.round(h)}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="AJKMart"
      >
        <text
          x={0}
          y={h * 0.55}
          fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
          fontWeight="800"
          fontSize={h * 0.55}
          fill={monoColor}
          letterSpacing="-1"
        >
          AJKmart
        </text>
      </svg>
    );
  }

  if (variant === "compact") {
    const markW = size * 0.45;
    const markH = size * 0.45;
    const wordW = size * 0.52;
    const totalW = markW + wordW + size * 0.05;
    const totalH = markH;

    return (
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="AJKMart"
      >
        <AJKMark textColor={textColor} cartAccent={cartAccent} markSize={markH} dotOpacity={0.7} />
        <text
          x={markH + size * 0.05}
          y={markH * 0.65}
          fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
          fontWeight="800"
          fontSize={markH * 0.38}
          fill={textColor}
          letterSpacing="-0.5"
        >
          ajkmart
        </text>
      </svg>
    );
  }

  const markH = size * 0.48;
  const wordFontSize = size * 0.16;
  const tagFontSize = size * 0.065;
  const totalH = markH + wordFontSize * 1.4 + tagFontSize * 2.2;
  const totalW = size;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${Math.round(totalH)}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AJKMart — Fast Home Delivery"
    >
      <AJKMark textColor={textColor} cartAccent={cartAccent} markSize={markH} />
      <text
        x={totalW * 0.02}
        y={markH + wordFontSize * 1.25}
        fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
        fontWeight="800"
        fontSize={wordFontSize}
        fill={textColor}
        letterSpacing="-0.5"
      >
        ajkmart
      </text>
      <text
        x={totalW * 0.025}
        y={markH + wordFontSize * 1.25 + tagFontSize * 2}
        fontFamily="'Inter', sans-serif"
        fontWeight="600"
        fontSize={tagFontSize}
        fill={taglineColor}
        letterSpacing="2"
      >
        FAST HOME DELIVERY
      </text>
    </svg>
  );
}

export default AjkmartLogo;
