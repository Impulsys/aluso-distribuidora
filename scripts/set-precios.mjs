// Carga rápida de lista de precios: pone precioVenta = PRECIO en TODOS los
// productos del seed (override en Firestore). Uso para pruebas.
//   node scripts/set-precios.mjs            → $3400 a todo
//   node scripts/set-precios.mjs 5000       → $5000 a todo
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PRECIO = Number(process.argv[2]) || 3400;

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Extraer los ids (EAN) del seed de productos
const src = readFileSync(
  new URL("../src/data/productos.ts", import.meta.url),
  "utf8"
);
const ids = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
console.log(`${ids.length} productos · precioVenta = $${PRECIO}`);

let batch = db.batch();
let n = 0;
for (const id of ids) {
  batch.set(
    db.collection("products").doc(id),
    { precioVenta: PRECIO, activo: true },
    { merge: true }
  );
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`Listo: precio cargado en ${n} productos.`);
process.exit(0);
