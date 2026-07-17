// SOLO LECTURA. Busca pagos a proveedor de un día y muestra quién los cargó,
// y qué quedó (o no) en la bitácora de ese momento.
//   node scripts/ver-pago.mjs 2026-07-10
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const h = (ts) => new Date(ts).toLocaleString("es-AR", { hourCycle: "h23" });

const key = process.argv[2] || "2026-07-10";
const [y, m, d] = key.split("-").map(Number);
const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
const end = start + 86_400_000;

const pagos = await db
  .collection("supplierPayments")
  .where("fecha", ">=", start)
  .where("fecha", "<", end)
  .get();

console.log(`\n=== PAGOS A PROVEEDOR del ${key} (${pagos.size}) ===`);
for (const p of pagos.docs) {
  const v = p.data();
  console.log(`\n  id: ${p.id}`);
  console.log(`  monto:      ${ars(v.monto)}`);
  console.log(`  via:        ${v.via ?? "(sin via)"}`);
  console.log(`  formaPago:  ${v.formaPago ?? "—"}`);
  console.log(`  proveedor:  ${v.proveedorNombre ?? v.proveedorId}`);
  console.log(`  createdBy:  ${v.createdBy ?? "❌ NO SE GUARDÓ"}`);
  console.log(`  createdAt:  ${v.createdAt ? h(v.createdAt) : "—"}`);
  console.log(`  notas:      ${v.notas ?? "—"}`);
  console.log(`  depositoCuenta: ${v.depositoCuenta ?? "—"} · titular: ${v.depositoTitular ?? "—"}`);
}

// ¿Quedó algo en la bitácora ese día?
const bit = await db
  .collection("bitacora")
  .where("ts", ">=", start)
  .where("ts", "<", end)
  .get();
console.log(`\n=== BITÁCORA del ${key} (${bit.size} eventos) ===`);
bit.docs
  .map((b) => b.data())
  .sort((a, b) => a.ts - b.ts)
  .forEach((b) => {
    console.log(`  ${h(b.ts)}  ${(b.nombre ?? b.email ?? "?").padEnd(16)} ${b.accion}${b.detalle ? ` · ${b.detalle}` : ""}`);
  });
console.log();
process.exit(0);
