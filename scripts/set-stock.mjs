// Carga rápida de stock: pone stock = STOCK en TODOS los productos del seed.
//   node scripts/set-stock.mjs           → 100 a todo
//   node scripts/set-stock.mjs 50        → 50 a todo
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const STOCK = Number(process.argv[2]) || 100;

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
console.log(`${ids.length} productos · stock = ${STOCK}`);

let batch = db.batch();
let n = 0;
for (const id of ids) {
  batch.set(db.collection("products").doc(id), { stock: STOCK }, { merge: true });
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`Listo: stock = ${STOCK} en ${n} productos.`);
process.exit(0);
