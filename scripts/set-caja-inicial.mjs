// Corrige la CAJA INICIAL de un día. NO toca ventas, gastos ni pagos.
//   node scripts/set-caja-inicial.mjs 2026-07-17 0
//
// Usar cuando la plata del día anterior se retiró (banco / caja fuerte) y el
// arrastre dejó un inicial que no corresponde.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const key = process.argv[2];
const monto = Number(process.argv[3]);
if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(monto)) {
  console.error("Uso: node scripts/set-caja-inicial.mjs YYYY-MM-DD <monto>");
  process.exit(1);
}

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const ref = db.collection("cashClosings").doc(key);
const snap = await ref.get();

if (snap.exists && snap.data()?.cerrado) {
  console.error(`${key}: la caja está CERRADA. Reabrila primero.`);
  process.exit(1);
}

const antes = snap.exists ? snap.data()?.cajaInicial ?? 0 : 0;
const [y, m, d] = key.split("-").map(Number);
await ref.set(
  { fecha: new Date(y, m - 1, d, 0, 0, 0, 0).getTime(), cajaInicial: monto },
  { merge: true }
);
console.log(`${key}: caja inicial ${ars(antes)} → ${ars(monto)}`);
process.exit(0);
