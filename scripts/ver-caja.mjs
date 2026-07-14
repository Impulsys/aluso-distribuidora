// SOLO LECTURA. Muestra el estado de los cierres de caja (cashClosings).
//   node scripts/ver-caja.mjs           → últimos 7 días
//   node scripts/ver-caja.mjs 2026-07-14
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + (Number(n) || 0).toLocaleString("es-AR");
const fecha = (ts) => (ts ? new Date(ts).toLocaleString("es-AR") : "—");

const arg = process.argv[2];
const dias = [];
if (arg) {
  dias.push(arg);
} else {
  const hoy = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    const p = (n) => String(n).padStart(2, "0");
    dias.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
}

for (const key of dias) {
  const snap = await db.collection("cashClosings").doc(key).get();
  if (!snap.exists) {
    console.log(`\n${key}  →  (no existe el doc: caja ABIERTA, sin arqueo)`);
    continue;
  }
  const c = snap.data();
  const billetes = Object.entries(c.arqueo ?? {})
    .filter(([, v]) => Number(v) > 0)
    .map(([d, v]) => `${v}x${ars(d)}`)
    .join(", ");
  console.log(`\n${key}`);
  console.log(`  cerrado:          ${c.cerrado ? "SÍ 🔒" : "no (abierta)"}`);
  console.log(`  cerradoAt:        ${fecha(c.cerradoAt)}`);
  console.log(`  cerradoPor:       ${c.cerradoPor ?? "—"}`);
  console.log(`  cajaInicial:      ${ars(c.cajaInicial)}`);
  console.log(`  efectivoEsperado: ${ars(c.efectivoEsperado)}`);
  console.log(`  efectivoContado:  ${ars(c.efectivoContado)}`);
  console.log(`  diferencia:       ${ars(c.diferencia)}`);
  console.log(`  arqueo:           ${billetes || "(vacío)"}`);
}
console.log();
process.exit(0);
