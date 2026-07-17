// SOLO LECTURA. Remito por remito, en orden, mostrando cómo va bajando el stock.
//   node scripts/remitos-stock.mjs              → desde el 07-07 (uso real)
//   node scripts/remitos-stock.mjs 2026-07-16   → solo ese día
//   node scripts/remitos-stock.mjs --md         → tabla markdown
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const md = process.argv.includes("--md");
const soloDia = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const [remSnap, prodSnap, truckSnap] = await Promise.all([
  db.collection("remitos").get(),
  db.collection("products").get(),
  db.collection("trucks").get(),
]);

const prods = new Map();
prodSnap.docs.forEach((p) => prods.set(p.id, { ...p.data(), id: p.id }));

const remitos = remSnap.docs
  .map((x) => x.data())
  .sort((a, b) => a.fecha - b.fecha);

// Productos que realmente se movieron (ignoramos los de prueba viejos).
const usados = new Map();
remitos.forEach((r) =>
  (r.items ?? []).forEach((it) => {
    if (!usados.has(it.productId)) usados.set(it.productId, it.nombre);
  })
);

// Recepciones por camión, en el tiempo.
const recep = [];
truckSnap.docs.forEach((t) => {
  const tr = t.data();
  if (!tr.fechaIngreso) return;
  (tr.carga ?? []).forEach((c) =>
    recep.push({ fecha: tr.fechaIngreso, productId: c.productId, u: c.cantidadUnidades || 0 })
  );
});

// Stock AL INICIO de todo = stock de hoy + todo lo vendido − todo lo recibido.
const stock = new Map();
prods.forEach((p, id) => stock.set(id, p.stock ?? 0));
remitos
  .filter((r) => !r.anulado)
  .forEach((r) =>
    (r.items ?? []).forEach((it) =>
      stock.set(it.productId, (stock.get(it.productId) ?? 0) + it.cantidad)
    )
  );
recep.forEach((x) => stock.set(x.productId, (stock.get(x.productId) ?? 0) - x.u));

// Columnas: los 3 productos reales, por volumen vendido.
const vol = new Map();
remitos
  .filter((r) => !r.anulado)
  .forEach((r) =>
    (r.items ?? []).forEach((it) =>
      vol.set(it.productId, (vol.get(it.productId) ?? 0) + it.cantidad)
    )
  );
const cols = [...usados.entries()]
  .filter(([id]) => (vol.get(id) ?? 0) >= 100) // fuera los de prueba
  .sort((a, b) => (vol.get(b[0]) ?? 0) - (vol.get(a[0]) ?? 0));

const corto = (n) =>
  n
    .replace(/TOALLA DONCELLA /i, "")
    .replace(/ CLASICA 50x8/i, "")
    .replace(/ACEITE MEZCLA FINCA DEL LAZO 4 x 5 LITROS/i, "ACEITE")
    .trim();

const filas = [];
let recIdx = 0;
recep.sort((a, b) => a.fecha - b.fecha);

for (const r of remitos) {
  // Aplicar recepciones anteriores a este remito.
  while (recIdx < recep.length && recep[recIdx].fecha <= r.fecha) {
    const x = recep[recIdx++];
    stock.set(x.productId, (stock.get(x.productId) ?? 0) + x.u);
  }
  const vend = new Map();
  if (!r.anulado) {
    for (const it of r.items ?? []) {
      vend.set(it.productId, (vend.get(it.productId) ?? 0) + it.cantidad);
      stock.set(it.productId, (stock.get(it.productId) ?? 0) - it.cantidad);
    }
  }
  const dia = new Date(r.fecha);
  const p = (n) => String(n).padStart(2, "0");
  const key = `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`;
  if (soloDia && key !== soloDia) continue;
  if (!soloDia && r.fecha < new Date(2026, 6, 7).getTime()) continue;
  filas.push({
    numero: r.numero,
    fecha: `${p(dia.getDate())}/${p(dia.getMonth() + 1)}`,
    hora: `${p(dia.getHours())}:${p(dia.getMinutes())}`,
    anulado: !!r.anulado,
    total: r.anulado ? 0 : r.total || 0,
    cols: cols.map(([id]) => ({ vend: vend.get(id) ?? 0, stock: stock.get(id) ?? 0 })),
  });
}

if (md) {
  const enc = ["Remito", "Fecha", "Hora", ...cols.flatMap(([, n]) => [`${corto(n)} vend.`, `${corto(n)} stock`]), "Importe"];
  console.log(`| ${enc.join(" | ")} |`);
  console.log(`|${enc.map(() => "---").join("|")}|`);
  for (const f of filas) {
    console.log(
      `| ${f.numero}${f.anulado ? " ⛔" : ""} | ${f.fecha} | ${f.hora} | ` +
        f.cols.map((c) => `${c.vend || "—"} | ${c.stock}`).join(" | ") +
        ` | ${f.anulado ? "ANULADO" : ars(f.total)} |`
    );
  }
  process.exit(0);
}

const w = 13;
console.log(`\n${"=".repeat(30 + cols.length * w * 2)}`);
console.log(`REMITOS Y STOCK  ·  ${filas.length} remitos`);
console.log(`${"=".repeat(30 + cols.length * w * 2)}\n`);
let head = `  ${"Remito".padEnd(11)} ${"Fecha".padEnd(6)} ${"Hora".padEnd(6)}`;
for (const [, n] of cols) head += `${(corto(n) + " v/st").padStart(w * 2 - 1)} `;
head += `${"Importe".padStart(14)}`;
console.log(head);
console.log(`  ${"-".repeat(head.length)}`);
for (const f of filas) {
  let l = `  ${(f.numero + (f.anulado ? " X" : "")).padEnd(11)} ${f.fecha.padEnd(6)} ${f.hora.padEnd(6)}`;
  for (const c of f.cols) l += `${String(c.vend || "-").padStart(9)}${String(c.stock).padStart(w * 2 - 10)} `;
  l += `${(f.anulado ? "ANULADO" : ars(f.total)).padStart(14)}`;
  console.log(l);
}
console.log();
process.exit(0);
