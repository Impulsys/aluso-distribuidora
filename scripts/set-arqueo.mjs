// Escribe el ARQUEO de un día tal cual (pares denominación:cantidad) y
// recalcula contado y diferencia. NO toca ventas, gastos ni pagos.
//
//   node scripts/set-arqueo.mjs 2026-07-16 1000:1900 2000:2000 10000:2000 20000:1300 --aplicar
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const totalArqueo = (a) =>
  Object.entries(a).reduce((s, [d, c]) => s + Number(d) * (Number(c) || 0), 0);

const args = process.argv.slice(2);
const key = args.shift();
const aplicar = args.includes("--aplicar");
const pares = args.filter((a) => a.includes(":"));
if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key) || pares.length === 0) {
  console.error("Uso: node scripts/set-arqueo.mjs YYYY-MM-DD 1000:10 20000:5 [--aplicar]");
  process.exit(1);
}

const arqueo = {};
for (const p of pares) {
  const [den, cant] = p.split(":").map(Number);
  if (!Number.isFinite(den) || !Number.isFinite(cant)) {
    console.error(`Par inválido: ${p}`);
    process.exit(1);
  }
  arqueo[String(den)] = cant;
}

const ref = db.collection("cashClosings").doc(key);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`${key}: no existe el cierre.`);
  process.exit(1);
}
const c = snap.data();
const contado = totalArqueo(arqueo);
const esperado = c.efectivoEsperado ?? 0;
const diferencia = contado - esperado;

const linea = (a) =>
  Object.entries(a)
    .filter(([, v]) => Number(v) > 0)
    .sort((x, z) => Number(z[0]) - Number(x[0]))
    .map(([d, v]) => `${v}x${ars(d)}`)
    .join(", ");

console.log(`\n${key}`);
console.log(`  ANTES   ${linea(c.arqueo ?? {})} → contado ${ars(c.efectivoContado)} · dif ${ars(c.diferencia)}`);
console.log(`  DESPUES ${linea(arqueo)} → contado ${ars(contado)} · dif ${ars(diferencia)}`);
if (!aplicar) {
  console.log(`\n  → simulación. Agregá --aplicar para escribir.\n`);
  process.exit(0);
}
await ref.update({ arqueo, efectivoContado: contado, diferencia });
console.log(`\n  ✓ aplicado.\n`);
process.exit(0);
