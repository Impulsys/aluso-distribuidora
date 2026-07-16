// Saca el ARRASTRE de un día ya cerrado: pone la caja inicial en $0 y
// recalcula esperado y diferencia con las ventas/gastos/pagos REALES del día.
// Cada día cierra solo — no se arrastra plata del día anterior.
//
//   node scripts/quitar-arrastre.mjs 2026-07-15            → simula (no escribe)
//   node scripts/quitar-arrastre.mjs 2026-07-15 --aplicar  → escribe
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const pagoUsaEfectivo = (p) =>
  p.via ? p.via !== "transferencia" : (p.formaPago ?? "efectivo") === "efectivo";

const key = process.argv[2];
const aplicar = process.argv.includes("--aplicar");
if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
  console.error("Uso: node scripts/quitar-arrastre.mjs YYYY-MM-DD [--aplicar]");
  process.exit(1);
}

const [y, m, d] = key.split("-").map(Number);
const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
const end = start + 86_400_000;

const [remSnap, gasSnap, pagSnap, cierreSnap] = await Promise.all([
  db.collection("remitos").where("fecha", ">=", start).where("fecha", "<", end).get(),
  db.collection("dailyExpenses").where("fecha", ">=", start).where("fecha", "<", end).get(),
  db.collection("supplierPayments").where("fecha", ">=", start).where("fecha", "<", end).get(),
  db.collection("cashClosings").doc(key).get(),
]);
if (!cierreSnap.exists) {
  console.error(`${key}: no existe el cierre.`);
  process.exit(1);
}
const c = cierreSnap.data();

const ventaEfectivo = remSnap.docs
  .map((x) => x.data())
  .filter((r) => !r.anulado && (r.formaPago ?? "efectivo") === "efectivo")
  .reduce((s, r) => s + (r.total || 0), 0);
const gastosEfe = gasSnap.docs
  .map((x) => x.data())
  .filter((g) => g.formaPago === "efectivo")
  .reduce((s, g) => s + (g.monto || 0), 0);
const pagosEfe = pagSnap.docs
  .map((x) => x.data())
  .filter(pagoUsaEfectivo)
  .reduce((s, p) => s + (p.monto || 0), 0);

const esperado = ventaEfectivo - gastosEfe - pagosEfe; // caja inicial = 0
const contado = c.efectivoContado ?? 0;
const diferencia = contado - esperado;

console.log(`\n${key}`);
console.log(`  ANTES   caja inicial ${ars(c.cajaInicial)} · esperado ${ars(c.efectivoEsperado)} · contado ${ars(contado)} · dif ${ars(c.diferencia)}`);
console.log(`  DESPUES caja inicial ${ars(0)} · esperado ${ars(esperado)} · contado ${ars(contado)} · dif ${ars(diferencia)}`);
console.log(`          (ventas efectivo ${ars(ventaEfectivo)} − gastos ${ars(gastosEfe)} − pagos ${ars(pagosEfe)})`);

if (!aplicar) {
  console.log(`\n  → simulación. Agregá --aplicar para escribir.\n`);
  process.exit(0);
}
await cierreSnap.ref.update({
  cajaInicial: 0,
  efectivoEsperado: esperado,
  diferencia,
});
console.log(`\n  ✓ aplicado.\n`);
process.exit(0);
