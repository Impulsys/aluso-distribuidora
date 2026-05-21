import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT_DIR = "public/icons";
mkdirSync(OUT_DIR, { recursive: true });

// Diseño del ícono: gradient teal a cyan + "LA" en serif + dot accent
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1ca5c8"/>
      <stop offset="55%" stop-color="#0a8db5"/>
      <stop offset="100%" stop-color="#006081"/>
    </linearGradient>
    <linearGradient id="goldDot" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd8a0"/>
      <stop offset="100%" stop-color="#e6c89f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="112"/>
  <!-- Sparkle dorado decorativo -->
  <text x="100" y="120" font-family="serif" font-size="60" fill="url(#goldDot)" opacity="0.7">✦</text>
  <text x="400" y="440" font-family="serif" font-size="40" fill="url(#goldDot)" opacity="0.55">✦</text>
  <!-- LA letters -->
  <text x="256" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="280" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="-8">LA</text>
  <!-- Subtítulo NOA -->
  <text x="256" y="410" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="4" opacity="0.85">NOA</text>
</svg>`;

writeFileSync(path.join(OUT_DIR, "icon.svg"), svg, "utf8");
console.log("→ icon.svg");

// PNGs en distintos tamaños (PWA + apple touch + favicons)
const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-180.png", size: 180 }, // apple-touch-icon
  { name: "icon-96.png", size: 96 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

const buf = Buffer.from(svg);
for (const { name, size } of SIZES) {
  await sharp(buf).resize(size, size).png().toFile(path.join(OUT_DIR, name));
  console.log(`→ ${name} (${size}x${size})`);
}

// Versión "maskable" para Android — el OS recorta los bordes, así que
// se centra el contenido y se agrega padding (safe zone ~10%).
const maskableSvg = svg.replace(
  'rx="112"',
  'rx="0"'
).replace(
  /<text x="256" y="330"/,
  '<text x="256" y="325" transform="scale(0.78) translate(72,72)"'
).replace(
  /<text x="256" y="410"/,
  '<text x="256" y="410" transform="scale(0.78) translate(72,72)"'
);
await sharp(Buffer.from(maskableSvg))
  .resize(512, 512)
  .png()
  .toFile(path.join(OUT_DIR, "icon-512-maskable.png"));
console.log("→ icon-512-maskable.png");

console.log("\n✓ Íconos generados en public/icons/");
