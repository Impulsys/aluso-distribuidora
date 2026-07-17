// SOLO LECTURA. Estado de cuenta de cada proveedor: comprado, pagado y deuda,
// con el detalle de cada movimiento y quién lo cargó.
//   node scripts/ver-proveedores.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const f = (ts) => (ts ? new Date(ts).toLocaleDateString("es-AR") : "—");

const [provSnap, compSnap, pagoSnap, userSnap] = await Promise.all([
  db.collection("proveedores").get(),
  db.collection("purchases").get(),
  db.collection("supplierPayments").get(),
  db.collection("users").get(),
]);

const quien = new Map();
userSnap.docs.forEach((u) => quien.set(u.id, u.data().displayName ?? u.data().email));

const provs = new Map();
provSnap.docs.forEach((p) => provs.set(p.id, p.data().nombre));

console.log(`\n=== PROVEEDORES (${provSnap.size}) ===`);
provSnap.docs.forEach((p) => console.log(`  ${p.id}  ·  ${p.data().nombre}`));

for (const [id, nombre] of provs) {
  const compras = compSnap.docs.map((x) => x.data()).filter((c) => c.proveedorId === id);
  const pagos = pagoSnap.docs.map((x) => x.data()).filter((c) => c.proveedorId === id);
  const comprado = compras.reduce((s, c) => s + (c.monto || 0), 0);
  const pagado = pagos.reduce((s, c) => s + (c.monto || 0), 0);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`${nombre.toUpperCase()}`);
  console.log(`  Comprado ${ars(comprado)} · Pagado ${ars(pagado)} · DEUDA ${ars(comprado - pagado)}`);

  if (compras.length) {
    console.log(`\n  COMPRAS (${compras.length}):`);
    compras
      .sort((a, b) => a.fecha - b.fecha)
      .forEach((c) =>
        console.log(
          `    ${f(c.fecha)}  ${(c.modalidad ?? "?").padEnd(2)} ${(c.numero ?? "").padEnd(14)} ${ars(c.monto).padStart(16)}  camión: ${c.camionNombre ?? "—"}  · cargó: ${quien.get(c.createdBy) ?? c.createdBy ?? "?"}`
        )
      );
  }
  if (pagos.length) {
    console.log(`\n  PAGOS (${pagos.length}):`);
    pagos
      .sort((a, b) => a.fecha - b.fecha)
      .forEach((p) =>
        console.log(
          `    ${f(p.fecha)}  ${(p.via ?? p.formaPago ?? "?").padEnd(14)} ${ars(p.monto).padStart(16)}  · cargó: ${quien.get(p.createdBy) ?? p.createdBy ?? "?"}`
        )
      );
  }
}
console.log();
process.exit(0);
