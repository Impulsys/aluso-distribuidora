// Reset del catálogo para entregar al cliente:
//   stock = 100 · precioVenta = 3000 · precioOferta = 0 · activo = true
// en TODOS los productos (los del seed + cualquier producto creado en Firestore).
//   node scripts/reset-catalogo.mjs
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const STOCK = 100;
const PRECIO = 3000;

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// 1) IDs del seed
const src = readFileSync(
  new URL("../src/data/productos.ts", import.meta.url),
  "utf8"
);
const seedIds = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);

// 2) IDs existentes en la colección products (incluye productos nuevos)
const snap = await db.collection("products").get();
const ids = new Set(seedIds);
snap.docs.forEach((d) => ids.add(d.id));

console.log(
  `${ids.size} productos (${seedIds.length} del seed + ${ids.size - seedIds.length} extra) · stock=${STOCK} · precio=$${PRECIO}`
);

let batch = db.batch();
let n = 0;
for (const id of ids) {
  batch.set(
    db.collection("products").doc(id),
    { stock: STOCK, precioVenta: PRECIO, precioOferta: 0, activo: true },
    { merge: true }
  );
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`Listo: ${n} productos con stock=${STOCK} y precio=$${PRECIO}.`);
process.exit(0);
