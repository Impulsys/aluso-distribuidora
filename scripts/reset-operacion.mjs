// Limpia los datos de OPERACIÓN de prueba para entregar al cliente.
// Borra: trucks, remitos, facturas, purchases, supplierPayments, expenses,
//        cashClosings, orders.  Resetea el numerador de remitos a 0.
// MANTIENE: products, productCosts, proveedores, users, config/reportes.
//   node scripts/reset-operacion.mjs
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const COLECCIONES = [
  "trucks",
  "remitos",
  "facturas",
  "purchases",
  "supplierPayments",
  "expenses",
  "cashClosings",
  "orders",
];

async function wipe(name) {
  const snap = await db.collection(name).get();
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  return snap.size;
}

for (const c of COLECCIONES) {
  const borrados = await wipe(c);
  console.log(`  ${c}: ${borrados} borrados`);
}

// Resetear el numerador de remitos (primer remito del cliente = R-000001)
await db.collection("config").doc("counters").set({ remitoSeq: 0 }, { merge: true });
console.log("  config/counters: remitoSeq = 0");

console.log("Listo: operación de prueba limpia.");
process.exit(0);
