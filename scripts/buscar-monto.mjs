// SOLO LECTURA. Busca un monto exacto en todas las colecciones de plata y
// muestra quién lo cargó.
//   node scripts/buscar-monto.mjs 10000000
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const h = (ts) => (ts ? new Date(ts).toLocaleString("es-AR", { hourCycle: "h23" }) : "—");
const objetivo = Number(process.argv[2] || 10000000);

const COLS = ["supplierPayments", "dailyExpenses", "purchases", "remitos", "checks"];

for (const c of COLS) {
  const snap = await db.collection(c).get();
  const hits = snap.docs.filter((d) => {
    const v = d.data();
    return Number(v.monto) === objetivo || Number(v.total) === objetivo;
  });
  if (!hits.length) continue;
  console.log(`\n=== ${c.toUpperCase()} · ${hits.length} coincidencia(s) con ${ars(objetivo)} ===`);
  for (const d of hits) {
    const v = d.data();
    console.log(`\n  id:         ${d.id}`);
    console.log(`  fecha:      ${h(v.fecha)}`);
    console.log(`  createdAt:  ${h(v.createdAt)}`);
    console.log(`  monto:      ${ars(v.monto ?? v.total)}`);
    if (v.via) console.log(`  via:        ${v.via}`);
    if (v.formaPago) console.log(`  formaPago:  ${v.formaPago}`);
    if (v.tipo) console.log(`  tipo:       ${v.tipo}`);
    if (v.proveedorNombre) console.log(`  proveedor:  ${v.proveedorNombre}`);
    if (v.depositoCuenta) console.log(`  depósito:   ${v.depositoCuenta} · ${v.depositoTitular ?? ""}`);
    if (v.detalle) console.log(`  detalle:    ${v.detalle}`);
    if (v.notas) console.log(`  notas:      ${v.notas}`);
    console.log(`  createdBy:  ${v.createdBy ?? "*** NO SE GUARDO QUIEN LO HIZO ***"}`);
  }
}
console.log();
process.exit(0);
