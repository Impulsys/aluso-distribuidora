// Pone el catálogo EN CERO para que el cliente cargue todo de cero:
//   stock = 0 · precioVenta = 0 · precioOferta = 0 · codigo = "" · precioCosto = 0
// Mantiene los productos activos y visibles (nombre/imagen/categoría del seed).
//   node scripts/reset-cero.mjs
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const src = readFileSync(
  new URL("../src/data/productos.ts", import.meta.url),
  "utf8"
);
const seedIds = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);

const snap = await db.collection("products").get();
const ids = new Set(seedIds);
snap.docs.forEach((d) => ids.add(d.id));

console.log(`${ids.size} productos → stock 0, precio 0, costo 0, sin código`);

let batch = db.batch();
let n = 0;
for (const id of ids) {
  batch.set(
    db.collection("products").doc(id),
    { stock: 0, precioVenta: 0, precioOferta: 0, codigo: "" },
    { merge: true }
  );
  batch.set(
    db.collection("productCosts").doc(id),
    { precioCosto: 0, updatedAt: Date.now() },
    { merge: true }
  );
  if (++n % 200 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`Listo: ${n} productos en cero.`);
process.exit(0);
