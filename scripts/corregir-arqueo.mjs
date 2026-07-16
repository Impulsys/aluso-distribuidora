// Saca del ARQUEO de un día cerrado un monto que se cargó de más, y recalcula
// contado y diferencia. NO toca ventas, gastos ni pagos.
//
//   node scripts/corregir-arqueo.mjs 2026-07-16 7536000            → simula
//   node scripts/corregir-arqueo.mjs 2026-07-16 7536000 --aplicar   → escribe
//
// Descuenta de los billetes más grandes hacia abajo. El TOTAL queda exacto; el
// desglose billete por billete es una reconstrucción (el conteo original de ese
// día no era real). Si aparece el conteo verdadero, cargarlo desde la pantalla.
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

const key = process.argv[2];
const sacar = Number(process.argv[3]);
const aplicar = process.argv.includes("--aplicar");
if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(sacar) || sacar <= 0) {
  console.error("Uso: node scripts/corregir-arqueo.mjs YYYY-MM-DD <monto> [--aplicar]");
  process.exit(1);
}

const ref = db.collection("cashClosings").doc(key);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`${key}: no existe el cierre.`);
  process.exit(1);
}
const c = snap.data();
const arqueo = { ...(c.arqueo ?? {}) };
const contadoAntes = totalArqueo(arqueo);

// Descuento de mayor a menor.
let resto = sacar;
const denoms = Object.keys(arqueo)
  .map(Number)
  .sort((a, b) => b - a);
for (const den of denoms) {
  if (resto <= 0) break;
  const disponibles = Number(arqueo[den]) || 0;
  const quitar = Math.min(disponibles, Math.floor(resto / den));
  if (quitar > 0) {
    arqueo[den] = disponibles - quitar;
    resto -= quitar * den;
  }
}
if (resto !== 0) {
  console.error(`No se pudo descontar exacto: quedaron ${ars(resto)} sin resolver.`);
  process.exit(1);
}

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
console.log(`  ANTES   ${linea(c.arqueo ?? {})}`);
console.log(`          contado ${ars(contadoAntes)} · esperado ${ars(esperado)} · dif ${ars(c.diferencia)}`);
console.log(`  DESPUES ${linea(arqueo)}`);
console.log(`          contado ${ars(contado)} · esperado ${ars(esperado)} · dif ${ars(diferencia)}`);

if (!aplicar) {
  console.log(`\n  → simulación. Agregá --aplicar para escribir.\n`);
  process.exit(0);
}
await ref.update({ arqueo, efectivoContado: contado, diferencia });
console.log(`\n  ✓ aplicado.\n`);
process.exit(0);
