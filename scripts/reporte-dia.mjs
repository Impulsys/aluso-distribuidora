// SOLO LECTURA. Reporte del día: qué se vendió (unidades y plata) + stock.
//   node scripts/reporte-dia.mjs 2026-07-16
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const key = process.argv[2];
const [y, m, d] = key.split("-").map(Number);
const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
const end = start + 86_400_000;

const [remSnap, prodSnap, truckSnap] = await Promise.all([
  db.collection("remitos").where("fecha", ">=", start).where("fecha", "<", end).get(),
  db.collection("products").get(),
  db.collection("trucks").get(),
]);

const prods = new Map();
prodSnap.docs.forEach((p) => prods.set(p.id, p.data()));

// Recepciones de camión del día (entran al stock) — para el stock inicial.
const recibidoHoy = new Map();
truckSnap.docs.forEach((t) => {
  const tr = t.data();
  if (!(tr.fechaIngreso >= start && tr.fechaIngreso < end)) return;
  (tr.carga ?? []).forEach((c) => {
    recibidoHoy.set(c.productId, (recibidoHoy.get(c.productId) ?? 0) + (c.cantidadUnidades || 0));
  });
});

const remitos = remSnap.docs.map((x) => x.data());
const vivos = remitos.filter((r) => !r.anulado);
const anulados = remitos.filter((r) => r.anulado);

// Agrupado por producto
const porProd = new Map();
vivos.forEach((r) =>
  (r.items ?? []).forEach((it) => {
    const cur = porProd.get(it.productId) ?? { nombre: it.nombre, u: 0, plata: 0 };
    cur.u += it.cantidad || 0;
    cur.plata += (it.cantidad || 0) * (it.precioVenta || 0);
    porProd.set(it.productId, cur);
  })
);

const cobradoEfectivo = vivos
  .filter((r) => (r.formaPago ?? "efectivo") === "efectivo")
  .reduce((s, r) => s + (r.total || 0), 0);
const cobradoTransf = vivos
  .filter((r) => r.formaPago === "transferencia")
  .reduce((s, r) => s + (r.total || 0), 0);
const cobradoCheque = vivos
  .filter((r) => r.formaPago === "cheque")
  .reduce((s, r) => s + (r.total || 0), 0);
const totalUnidades = [...porProd.values()].reduce((s, p) => s + p.u, 0);

console.log(`\n${"=".repeat(96)}`);
console.log(`REPORTE DEL DIA  ${key}`);
console.log(`${"=".repeat(96)}\n`);
console.log(`  ${vivos.length} ventas (remitos) · ${totalUnidades} unidades vendidas`);
if (anulados.length) console.log(`  ${anulados.length} anulado(s): ${anulados.map((a) => a.numero).join(", ")}`);
console.log(`\n  COBRADO`);
console.log(`    Efectivo (va a la caja) ${ars(cobradoEfectivo).padStart(16)}`);
if (cobradoTransf) console.log(`    Transferencia (banco)   ${ars(cobradoTransf).padStart(16)}`);
if (cobradoCheque) console.log(`    Cheque (a cobrar)       ${ars(cobradoCheque).padStart(16)}`);
console.log(`    ${"-".repeat(38)}`);
console.log(`    TOTAL VENDIDO           ${ars(cobradoEfectivo + cobradoTransf + cobradoCheque).padStart(16)}`);

console.log(`\n\n  DETALLE POR PRODUCTO (stock inicial = final + vendido − recibido hoy)\n`);
console.log(
  `  ${"Producto".padEnd(42)} ${"Vend.".padStart(6)} ${"Plata".padStart(14)} ${"St.ini".padStart(7)} ${"St.fin".padStart(7)}`
);
console.log(`  ${"-".repeat(92)}`);

const filas = [...porProd.entries()]
  .map(([id, v]) => {
    const stockFinal = prods.get(id)?.stock ?? 0;
    const recib = recibidoHoy.get(id) ?? 0;
    return { ...v, stockFinal, stockInicial: stockFinal + v.u - recib };
  })
  .sort((a, b) => b.u - a.u);

for (const f of filas) {
  console.log(
    `  ${f.nombre.slice(0, 42).padEnd(42)} ${String(f.u).padStart(6)} ${ars(f.plata).padStart(14)} ${String(f.stockInicial).padStart(7)} ${String(f.stockFinal).padStart(7)}`
  );
}
console.log(`  ${"-".repeat(92)}`);
console.log(`  ${"TOTAL".padEnd(42)} ${String(totalUnidades).padStart(6)} ${ars(cobradoEfectivo + cobradoTransf + cobradoCheque).padStart(14)}\n`);
process.exit(0);
