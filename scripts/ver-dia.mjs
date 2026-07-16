// SOLO LECTURA. Reconstruye el efectivo esperado de un día, movimiento por
// movimiento, y lo compara contra lo que quedó guardado en el cierre.
//   node scripts/ver-dia.mjs 2026-07-15
//   node scripts/ver-dia.mjs            → últimos 4 días
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const hora = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—";

// Mismo criterio que la app: todo pago que no sea transferencia sale con billetes.
const pagoUsaEfectivo = (p) =>
  p.via ? p.via !== "transferencia" : (p.formaPago ?? "efectivo") === "efectivo";

const dias = process.argv.slice(2);
if (dias.length === 0) {
  const hoy = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    const p = (n) => String(n).padStart(2, "0");
    dias.unshift(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
}

for (const key of dias) {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = start + 86_400_000;

  const [remSnap, gasSnap, pagSnap, cierreSnap] = await Promise.all([
    db.collection("remitos").where("fecha", ">=", start).where("fecha", "<", end).get(),
    db.collection("dailyExpenses").where("fecha", ">=", start).where("fecha", "<", end).get(),
    db.collection("supplierPayments").where("fecha", ">=", start).where("fecha", "<", end).get(),
    db.collection("cashClosings").doc(key).get(),
  ]);

  const remitos = remSnap.docs.map((x) => x.data()).filter((r) => !r.anulado);
  const gastos = gasSnap.docs.map((x) => x.data());
  const pagos = pagSnap.docs.map((x) => x.data());
  const c = cierreSnap.exists ? cierreSnap.data() : null;

  const ventaEfectivo = remitos
    .filter((r) => (r.formaPago ?? "efectivo") === "efectivo")
    .reduce((s, r) => s + (r.total || 0), 0);
  const ventaOtras = remitos
    .filter((r) => (r.formaPago ?? "efectivo") !== "efectivo")
    .reduce((s, r) => s + (r.total || 0), 0);
  const gastosEfe = gastos
    .filter((g) => g.formaPago === "efectivo")
    .reduce((s, g) => s + (g.monto || 0), 0);
  const pagosEfe = pagos.filter(pagoUsaEfectivo).reduce((s, p) => s + (p.monto || 0), 0);

  const cajaIni = c?.cajaInicial ?? 0;
  const esperadoCalc = cajaIni + ventaEfectivo - gastosEfe - pagosEfe;

  console.log(`\n${"=".repeat(62)}\n${key}   ${c?.cerrado ? `CERRADA ${hora(c.cerradoAt)} por ${c.cerradoPor ?? "?"}` : "ABIERTA"}`);
  console.log(`  Caja inicial (arrastrada)  ${ars(cajaIni).padStart(16)}`);
  console.log(`  + Ventas en efectivo       ${ars(ventaEfectivo).padStart(16)}   (${remitos.length} remitos)`);
  console.log(`  − Gastos en efectivo       ${ars(gastosEfe).padStart(16)}`);
  console.log(`  − Pagos proveedor billetes ${ars(pagosEfe).padStart(16)}`);
  console.log(`  ${"-".repeat(48)}`);
  console.log(`  = Esperado (recalculado)   ${ars(esperadoCalc).padStart(16)}`);
  if (c?.cerrado) {
    console.log(`    Esperado guardado        ${ars(c.efectivoEsperado).padStart(16)}`);
    console.log(`    CONTADO (billetes)       ${ars(c.efectivoContado).padStart(16)}`);
    console.log(`    Diferencia               ${ars(c.diferencia).padStart(16)}`);
    const sinIni = (c.efectivoContado ?? 0) - (esperadoCalc - cajaIni);
    if (Math.abs((c.diferencia ?? 0) + cajaIni) < 1 && cajaIni > 0) {
      console.log(`    ⚠️  La diferencia es EXACTAMENTE la caja inicial: los ${ars(cajaIni)}`);
      console.log(`        arrastrados NO estaban fisicamente en la caja.`);
    } else if (Math.abs(sinIni) < 1 && cajaIni > 0) {
      console.log(`    ⚠️  Contado = movimientos del dia SIN la caja inicial.`);
    }
  }
  if (ventaOtras > 0) console.log(`  (ventas por transferencia/cheque: ${ars(ventaOtras)} — no van a la caja)`);
}
console.log();
process.exit(0);
