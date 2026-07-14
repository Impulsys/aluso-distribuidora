// Reabre la caja de un día (quita el cierre). NO toca ventas, gastos ni pagos.
//   node scripts/reabrir-caja.mjs 2026-07-14
//
// Usar solo si se cerró un día por error. El arqueo cargado se conserva.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const key = process.argv[2];
if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
  console.error("Uso: node scripts/reabrir-caja.mjs YYYY-MM-DD");
  process.exit(1);
}

const ref = db.collection("cashClosings").doc(key);
const snap = await ref.get();
if (!snap.exists) {
  console.log(`${key}: el doc no existe → la caja ya está abierta.`);
  process.exit(0);
}
if (!snap.data()?.cerrado) {
  console.log(`${key}: la caja ya estaba ABIERTA. No se tocó nada.`);
  process.exit(0);
}

await ref.update({
  cerrado: FieldValue.delete(),
  cerradoAt: FieldValue.delete(),
  cerradoPor: FieldValue.delete(),
  efectivoEsperado: FieldValue.delete(),
  efectivoContado: FieldValue.delete(),
  diferencia: FieldValue.delete(),
});

console.log(`${key}: caja REABIERTA. Ya se pueden cargar los billetes.`);
process.exit(0);
