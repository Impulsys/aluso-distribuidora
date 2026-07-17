// Dos correcciones puntuales pedidas por Federico (16/07/2026):
//   1. Borra el pago de prueba de $10.000.000 (10/06, cargado por el programador)
//      que le restaba deuda a Lenterdit.
//   2. Pasa el Remito B (sin factura) del camión del 3/7 de Lenterdit a Tinsa.
//
//   node scripts/arreglar-cuentas-proveedor.mjs             → simula
//   node scripts/arreglar-cuentas-proveedor.mjs --aplicar   → escribe
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const aplicar = process.argv.includes("--aplicar");

const PAGO_PRUEBA = "JnEdt7DxZxiy00i00nya"; // $10.000.000 · 10/06 · axelfaber@gmail.com
const TINSA = "lxFLmSmZSvPwkldEiqZM";
const LENTERDIT = "ZSTr74dnW4FoICjPFtel";

const saldo = async (etiqueta) => {
  const [c, p] = await Promise.all([
    db.collection("purchases").get(),
    db.collection("supplierPayments").get(),
  ]);
  console.log(`\n  ${etiqueta}`);
  for (const [id, nombre] of [[LENTERDIT, "Lenterdit"], [TINSA, "Tinsa"]]) {
    const comprado = c.docs.map((x) => x.data()).filter((x) => x.proveedorId === id).reduce((s, x) => s + (x.monto || 0), 0);
    const pagado = p.docs.map((x) => x.data()).filter((x) => x.proveedorId === id).reduce((s, x) => s + (x.monto || 0), 0);
    console.log(`    ${nombre.padEnd(11)} comprado ${ars(comprado).padStart(16)} · pagado ${ars(pagado).padStart(14)} · DEUDA ${ars(comprado - pagado).padStart(16)}`);
  }
};

await saldo("ANTES:");

// ---- 1) Pago de prueba ----
const pago = await db.collection("supplierPayments").doc(PAGO_PRUEBA).get();
console.log(`\n  1) Pago de prueba ${PAGO_PRUEBA}`);
if (!pago.exists) console.log(`     ya no existe — nada que borrar.`);
else {
  const v = pago.data();
  console.log(`     ${ars(v.monto)} · ${new Date(v.fecha).toLocaleDateString("es-AR")} · via ${v.via} · cuenta ${v.depositoCuenta}`);
  console.log(`     → BORRAR`);
  if (aplicar) {
    await pago.ref.delete();
    console.log(`     ✓ borrado`);
  }
}

// ---- 2) Remito B → Tinsa ----
const compras = await db.collection("purchases").where("modalidad", "==", "B").get();
console.log(`\n  2) Comprobantes B (sin factura) que están en Lenterdit`);
const aMover = compras.docs.filter((d) => d.data().proveedorId === LENTERDIT);
if (!aMover.length) console.log(`     ninguno — nada que mover.`);
for (const d of aMover) {
  const v = d.data();
  console.log(`     ${v.numero} · ${ars(v.monto)} · camión ${v.camionNombre ?? "—"}`);
  console.log(`     → Lenterdit → Tinsa`);
  if (aplicar) {
    await d.ref.update({ proveedorId: TINSA, proveedorNombre: "Tinsa" });
    console.log(`     ✓ movido`);
  }
}

if (aplicar) await saldo("DESPUÉS:");
else console.log(`\n  → simulación. Agregá --aplicar para escribir.`);
console.log();
process.exit(0);
