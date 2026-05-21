// Procesa el Excel maestro + carpeta de fotos del cliente,
// copia las imágenes a public/productos y emite src/data/productos.ts
import { createRequire } from "node:module";
import {
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// ===== rutas =====
const CLIENT = "_cliente";
const XLSX_PATH = path.join(
  CLIENT,
  "Descripcion de producto",
  "codigos, titulos y descripciones .xlsx"
);
const PHOTOS_DIRS = [
  path.join(CLIENT, "Fotos 1000x1000", "Catálogo doncella"),
  path.join(CLIENT, "Fotos 1000x1000", "Catálogo Nonisec"),
];
const LOGOS_DIR = path.join(CLIENT, "LOGOS");
const OUT_PRODUCTS = "public/productos";
const OUT_BRAND = "public/brand";
const OUT_TS = "src/data/productos.ts";

// ===== utils =====
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// EAN normalizer: a Excel cell may show "7.79094E+12" (number).
// Photo filenames carry the full digits — used as fallback to match.
function ean(v) {
  if (v == null) return "";
  let s = String(v).trim();
  if (/E\+?\d+/i.test(s)) {
    // scientific → number → 13-digit string (best effort)
    const n = Number(s);
    if (Number.isFinite(n)) s = Math.round(n).toString();
  }
  return s.replace(/[^0-9]/g, "");
}

// ===== 1) Leer Excel preservando valor crudo de la celda EAN =====
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
const sh = wb.Sheets[wb.SheetNames[0]];
// rango
const range = XLSX.utils.decode_range(sh["!ref"]);
const rows = [];
for (let r = range.s.r; r <= range.e.r; r++) {
  const row = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sh[XLSX.utils.encode_cell({ r, c })];
    row.push(cell ? (cell.v != null ? cell.v : "") : "");
  }
  rows.push(row);
}

// ===== 2) Recorrer filas: detectar headers de sección y productos =====
let currentMarca = ""; // "doncella" | "nonisec"
let currentCategoria = "";
const productos = [];

const detectMarca = (txt) => {
  const t = txt.toUpperCase();
  if (t.includes("NONISEC")) return "nonisec";
  if (t.includes("DONCELLA")) return "doncella";
  return "";
};
const cleanCategoria = (txt) =>
  txt
    .replace(/línea/gi, "")
    .replace(/linea/gi, "")
    .replace(/nonisec/gi, "")
    .replace(/doncella/gi, "")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Normaliza categoría + corrige marca cuando el header del Excel quedó mal.
// Devuelve { marca, categoria } finales.
function normalize(rawCat, marca) {
  const c = String(rawCat || "")
    .trim()
    .replace(/^-+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/babylook/i.test(c)) return { marca: "doncella", categoria: "Babylook" };
  if (/^general$/i.test(c) && marca === "nonisec")
    return { marca: "nonisec", categoria: "Anatómico" };
  if (/aposit/i.test(c)) return { marca, categoria: "Apósitos incontinencia" };
  if (/incontinencia\s*fem/i.test(c))
    return { marca: "doncella", categoria: "Incontinencia femenina" };
  if (/protectores\s*mamarios/i.test(c))
    return { marca: "doncella", categoria: "Protectores mamarios" };
  if (/protectores\s*diarios/i.test(c))
    return { marca: "doncella", categoria: "Protectores diarios" };
  if (/toallas\s*femeninas/i.test(c))
    return { marca: "doncella", categoria: "Toallas femeninas" };
  if (/algod/i.test(c)) return { marca: "doncella", categoria: "Algodón" };
  if (/hisop/i.test(c)) return { marca: "doncella", categoria: "Hisopos" };
  if (/accesor/i.test(c)) return { marca, categoria: "Accesorios" };
  if (/adulto\s*recto/i.test(c))
    return { marca: "nonisec", categoria: "Adulto recto" };
  if (/refuerza/i.test(c))
    return { marca: "nonisec", categoria: "Refuerza pañal" };
  if (/ropa\s*interior/i.test(c))
    return { marca: "nonisec", categoria: "Ropa interior" };
  if (/zale/i.test(c)) return { marca: "nonisec", categoria: "Zaleas" };
  if (/higiene/i.test(c))
    return { marca, categoria: "Higiene personal" };
  // Default: capitaliza primera letra
  const titled = c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : "General";
  return { marca, categoria: titled };
}

for (const r of rows) {
  const [c0, c1, c2, c3] = r.map((v) => String(v ?? "").trim());
  // header de sección: col1 con texto y col0 vacío
  if (!c0 && c1 && !c2 && /linea|línea|nonisec|doncella/i.test(c1)) {
    const m = detectMarca(c1);
    if (m) currentMarca = m;
    currentCategoria = cleanCategoria(c1) || "General";
    continue;
  }
  // header de cabecera (EAN | ... )
  if (c0.toUpperCase() === "EAN") continue;
  // producto: tiene EAN y título
  if (c0 && c1) {
    const code = ean(c0);
    const baseMarca = currentMarca || "lenterdit";
    const { marca: finalMarca, categoria: finalCategoria } = normalize(
      currentCategoria,
      baseMarca
    );
    productos.push({
      id: code || slug(c1).slice(0, 30),
      ean: code,
      marca: finalMarca,
      categoria: finalCategoria,
      nombre: c1,
      descripcion: c2,
      keywords: c3,
    });
  }
}

console.log(`Productos extraídos: ${productos.length}`);

// ===== 3) Indexar fotos: por EAN si está en el nombre, si no por slug del nombre del archivo =====
const allPhotos = [];
for (const d of PHOTOS_DIRS) allPhotos.push(...walk(d));
console.log(`Fotos disponibles: ${allPhotos.length}`);

const byEan = new Map();
for (const p of allPhotos) {
  const m = path.basename(p).match(/(\d{12,14})/);
  if (m) {
    const k = m[1];
    if (!byEan.has(k)) byEan.set(k, p);
  }
}
console.log(`Fotos con EAN identificable: ${byEan.size}`);

// ===== 4) Asignar foto a cada producto + copiar =====
if (existsSync(OUT_PRODUCTS)) rmSync(OUT_PRODUCTS, { recursive: true, force: true });
mkdirSync(OUT_PRODUCTS, { recursive: true });
mkdirSync(OUT_BRAND, { recursive: true });

let conFoto = 0;
for (const p of productos) {
  const src = byEan.get(p.ean);
  if (src) {
    const ext = path.extname(src).toLowerCase() || ".jpg";
    const dstName = `${p.id}${ext}`;
    copyFileSync(src, path.join(OUT_PRODUCTS, dstName));
    p.imagen = `/productos/${dstName}`;
    conFoto++;
  } else {
    // placeholder con marca como texto
    const txt = encodeURIComponent(p.marca === "nonisec" ? "Nonisec" : "Doncella");
    p.imagen = `https://placehold.co/600x600/006081/ffffff?text=${txt}`;
  }
}
console.log(`Productos con foto local: ${conFoto}/${productos.length}`);

// ===== 5) Copiar logos =====
const logosToCopy = [
  ["Logo Doncella.png", "doncella.png"],
  ["Logo_Nonisec1.png", "nonisec.png"],
  ["logo lenterdit.png", "lenterdit.png"],
];
for (const [from, to] of logosToCopy) {
  const f = path.join(LOGOS_DIR, from);
  if (existsSync(f)) {
    copyFileSync(f, path.join(OUT_BRAND, to));
    console.log(`Logo: ${to}`);
  }
}

// ===== 6) Emitir productos.ts =====
const lines = [
  `import type { Product } from "@/lib/types";`,
  ``,
  `// Catálogo REAL — datos del cliente (Distribuidora Los Amigos NOA).`,
  `// Generado automáticamente por scripts/build-products.mjs.`,
  `// Marcas: Doncella (femenino / bebé) y Nonisec (adultos / incontinencia), proveedor Lenterdit.`,
  `// precioVenta=0 → la UI muestra "Consultar precio" (Maxi carga los precios reales desde Admin).`,
  ``,
  `export const PRODUCTOS_SEED: Product[] = [`,
];
for (const p of productos) {
  const esc = (s) =>
    String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
  lines.push(
    `  { id: "${p.id}", ean: "${p.ean}", marca: "${p.marca}", categoria: "${esc(
      p.categoria
    )}", nombre: "${esc(p.nombre)}", descripcion: "${esc(
      p.descripcion
    )}", imagen: "${p.imagen}", precioVenta: 0, precioCosto: 0, stock: 0, activo: true },`
  );
}
lines.push(`];`, ``);
writeFileSync(OUT_TS, lines.join("\n"), "utf8");
console.log(`\n→ ${OUT_TS} escrito (${productos.length} productos)`);

// ===== 7) Resumen por categoría =====
const byCat = {};
for (const p of productos) {
  const k = `${p.marca} · ${p.categoria}`;
  byCat[k] = (byCat[k] || 0) + 1;
}
console.log("\nResumen:");
for (const [k, v] of Object.entries(byCat).sort()) console.log(`  ${k}: ${v}`);
