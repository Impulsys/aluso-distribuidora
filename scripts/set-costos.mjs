// Carga rápida de precio de costo: pone precioCosto = COSTO en TODOS los
// productos del seed (colección productCosts).
//   node scripts/set-costos.mjs          → 3000 a todo
//   node scripts/set-costos.mjs 2500     → 2500 a todo
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COSTO = Number(process.argv[2]) || 3000;

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const src = readFileSync(
  new URL("../src/data/productos.ts", import.meta.url),
  "utf8"
);
const ids = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
console.log(`${ids.length} productos · precioCosto = $${COSTO}`);

let batch = db.batch();
let n = 0;
for (const id of ids) {
  batch.set(
    db.collection("productCosts").doc(id),
    { precioCosto: COSTO, updatedAt: Date.now() },
    { merge: true }
  );
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`Listo: precioCosto = $${COSTO} en ${n} productos.`);
process.exit(0);
