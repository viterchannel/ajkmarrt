// generate-android-icons.mjs
//
// Generates all required Android icon + splash-screen PNG assets for
// both rider-app and vendor-app using the `sharp` library (pre-installed).
//
// Usage:
//   node scripts/generate-android-icons.mjs
//
// Outputs (each app):
//   android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
//     ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
//   android/app/src/main/res/drawable-port-{mdpi..xxxhdpi}/splash.png
//   android/app/src/main/res/drawable-land-{mdpi..xxxhdpi}/splash.png

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* ── Brand definitions ──────────────────────────────────────────────────── */
const APPS = [
  {
    name: "rider",
    resDir: path.join(ROOT, "artifacts/rider-app/android/app/src/main/res"),
    bgColor: "#F0B90B",
    fgColor: "#0b0e11",
    splashBg: "#0b0e11",
    splashIcon: "#F0B90B",
    icon: riderIconSvg,
    foreground: riderForegroundSvg,
    splash: (w, h) => splashSvg(w, h, "#0b0e11", "#F0B90B", riderIconSvg),
  },
  {
    name: "vendor",
    resDir: path.join(ROOT, "artifacts/vendor-app/android/app/src/main/res"),
    bgColor: "#1A56DB",
    fgColor: "#ffffff",
    splashBg: "#060A14",
    splashIcon: "#1A56DB",
    icon: vendorIconSvg,
    foreground: vendorForegroundSvg,
    splash: (w, h) => splashSvg(w, h, "#060A14", "#1A56DB", vendorIconSvg),
  },
];

/* ── Mipmap icon sizes ──────────────────────────────────────────────────── */
const MIPMAP_SIZES = [
  { density: "mdpi",    launcher: 48,  foreground: 108 },
  { density: "hdpi",    launcher: 72,  foreground: 162 },
  { density: "xhdpi",   launcher: 96,  foreground: 216 },
  { density: "xxhdpi",  launcher: 144, foreground: 324 },
  { density: "xxxhdpi", launcher: 192, foreground: 432 },
];

/* ── Splash screen sizes ────────────────────────────────────────────────── */
const SPLASH_PORTRAIT = [
  { density: "mdpi",    w: 320,  h: 480  },
  { density: "hdpi",    w: 480,  h: 800  },
  { density: "xhdpi",   w: 720,  h: 1280 },
  { density: "xxhdpi",  w: 960,  h: 1600 },
  { density: "xxxhdpi", w: 1280, h: 1920 },
];
const SPLASH_LANDSCAPE = [
  { density: "mdpi",    w: 480,  h: 320  },
  { density: "hdpi",    w: 800,  h: 480  },
  { density: "xhdpi",   w: 1280, h: 720  },
  { density: "xxhdpi",  w: 1600, h: 960  },
  { density: "xxxhdpi", w: 1920, h: 1280 },
];

/* ── SVG templates ──────────────────────────────────────────────────────── */
function riderIconSvg(size) {
  const r = size * 0.2;
  const cx = size / 2;
  const bag = {
    bodyX: size * 0.22, bodyY: size * 0.38,
    bodyW: size * 0.56, bodyH: size * 0.42,
    handleR: size * 0.13,
    handleStroke: Math.max(2, size * 0.055),
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" fill="#F0B90B"/>
  <rect x="${bag.bodyX}" y="${bag.bodyY}" width="${bag.bodyW}" height="${bag.bodyH}"
        rx="${size * 0.05}" fill="#0b0e11"/>
  <path d="M${cx - bag.handleR} ${bag.bodyY} a${bag.handleR} ${bag.handleR} 0 0 1 ${bag.handleR * 2} 0"
        stroke="#0b0e11" stroke-width="${bag.handleStroke}" fill="none" stroke-linecap="round"/>
  <rect x="${cx - size * 0.03}" y="${bag.bodyY + bag.bodyH * 0.25}" width="${size * 0.06}" height="${bag.bodyH * 0.5}"
        rx="${size * 0.01}" fill="#F0B90B"/>
  <rect x="${cx - size * 0.14}" y="${bag.bodyY + bag.bodyH * 0.45}" width="${size * 0.28}" height="${size * 0.05}"
        rx="${size * 0.01}" fill="#F0B90B"/>
</svg>`;
}

function riderForegroundSvg(size) {
  const cx = size / 2;
  const bag = {
    bodyX: size * 0.22, bodyY: size * 0.38,
    bodyW: size * 0.56, bodyH: size * 0.42,
    handleR: size * 0.13,
    handleStroke: Math.max(2, size * 0.055),
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="transparent"/>
  <rect x="${bag.bodyX}" y="${bag.bodyY}" width="${bag.bodyW}" height="${bag.bodyH}"
        rx="${size * 0.05}" fill="#0b0e11"/>
  <path d="M${cx - bag.handleR} ${bag.bodyY} a${bag.handleR} ${bag.handleR} 0 0 1 ${bag.handleR * 2} 0"
        stroke="#0b0e11" stroke-width="${bag.handleStroke}" fill="none" stroke-linecap="round"/>
  <rect x="${cx - size * 0.03}" y="${bag.bodyY + bag.bodyH * 0.25}" width="${size * 0.06}" height="${bag.bodyH * 0.5}"
        rx="${size * 0.01}" fill="#F0B90B"/>
  <rect x="${cx - size * 0.14}" y="${bag.bodyY + bag.bodyH * 0.45}" width="${size * 0.28}" height="${size * 0.05}"
        rx="${size * 0.01}" fill="#F0B90B"/>
</svg>`;
}

function vendorIconSvg(size) {
  const r = size * 0.2;
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" fill="#1A56DB"/>
  <polygon points="${cx},${size * 0.18} ${size * 0.15},${size * 0.50} ${size * 0.85},${size * 0.50}"
           fill="white"/>
  <rect x="${size * 0.18}" y="${size * 0.50}" width="${size * 0.64}" height="${size * 0.32}"
        rx="${size * 0.03}" fill="white"/>
  <rect x="${cx - size * 0.10}" y="${size * 0.60}" width="${size * 0.20}" height="${size * 0.22}"
        rx="${size * 0.03}" fill="#1A56DB"/>
  <rect x="${size * 0.27}" y="${size * 0.57}" width="${size * 0.16}" height="${size * 0.14}"
        rx="${size * 0.02}" fill="#1A56DB"/>
</svg>`;
}

function vendorForegroundSvg(size) {
  const cx = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="transparent"/>
  <polygon points="${cx},${size * 0.18} ${size * 0.15},${size * 0.50} ${size * 0.85},${size * 0.50}"
           fill="white"/>
  <rect x="${size * 0.18}" y="${size * 0.50}" width="${size * 0.64}" height="${size * 0.32}"
        rx="${size * 0.03}" fill="white"/>
  <rect x="${cx - size * 0.10}" y="${size * 0.60}" width="${size * 0.20}" height="${size * 0.22}"
        rx="${size * 0.03}" fill="#1A56DB"/>
  <rect x="${size * 0.27}" y="${size * 0.57}" width="${size * 0.16}" height="${size * 0.14}"
        rx="${size * 0.02}" fill="#1A56DB"/>
</svg>`;
}

function splashSvg(w, h, bg, iconColor, iconFn) {
  const iconSize = Math.min(w, h) * 0.25;
  const cx = w / 2;
  const cy = h / 2;
  const icon = iconFn(iconSize)
    .replace(`xmlns="http://www.w3.org/2000/svg"`, "")
    .replace(`<svg `, `<g transform="translate(${cx - iconSize / 2},${cy - iconSize / 2})"><svg `)
    .replace(/<\/svg>$/, "</svg></g>");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  ${icon}
</svg>`;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height)
    .png()
    .toBuffer();
}

async function writeFile(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  console.log(`  ✓ ${path.relative(ROOT, filePath)}`);
}

/* ── Main ───────────────────────────────────────────────────────────────── */
async function main() {
  const tasks = [];

  for (const app of APPS) {
    console.log(`\n📱 Generating assets for ${app.name}-app…`);

    /* ── Launcher icons ── */
    for (const { density, launcher, foreground } of MIPMAP_SIZES) {
      const mipmapDir = path.join(app.resDir, `mipmap-${density}`);

      /* ic_launcher.png */
      tasks.push(
        svgToPng(app.icon(launcher), launcher, launcher).then((buf) =>
          writeFile(path.join(mipmapDir, "ic_launcher.png"), buf)
        )
      );

      /* ic_launcher_round.png — same icon, sharp will rasterize as-is */
      tasks.push(
        svgToPng(app.icon(launcher), launcher, launcher).then((buf) =>
          writeFile(path.join(mipmapDir, "ic_launcher_round.png"), buf)
        )
      );

      /* ic_launcher_foreground.png — for adaptive icon */
      tasks.push(
        svgToPng(app.foreground(foreground), foreground, foreground).then((buf) =>
          writeFile(path.join(mipmapDir, "ic_launcher_foreground.png"), buf)
        )
      );
    }

    /* ── Portrait splash screens ── */
    for (const { density, w, h } of SPLASH_PORTRAIT) {
      const dir = path.join(app.resDir, `drawable-port-${density}`);
      const svg = app.splash(w, h);
      tasks.push(
        svgToPng(svg, w, h).then((buf) =>
          writeFile(path.join(dir, "splash.png"), buf)
        )
      );
    }

    /* ── Landscape splash screens ── */
    for (const { density, w, h } of SPLASH_LANDSCAPE) {
      const dir = path.join(app.resDir, `drawable-land-${density}`);
      const svg = app.splash(w, h);
      tasks.push(
        svgToPng(svg, w, h).then((buf) =>
          writeFile(path.join(dir, "splash.png"), buf)
        )
      );
    }
  }

  await Promise.all(tasks);
  console.log("\n✅ All assets generated successfully.\n");
}

main().catch((err) => {
  console.error("❌ Asset generation failed:", err);
  process.exit(1);
});
