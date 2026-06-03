// Control del interruptor de servicio (config/licencia). SOLO el proveedor
// (con serviceAccountKey.json) puede correrlo — el cliente NO puede tocarlo.
//
//   node scripts/set-licencia.mjs on 15   → habilitado, vence en 15 días (cuota)
//   node scripts/set-licencia.mjs on      → habilitado SIN vencimiento (pagado total)
//   node scripts/set-licencia.mjs off     → bloqueado ya mismo
//   node scripts/set-licencia.mjs estado  → muestra el estado actual
//
// Requiere serviceAccountKey.json en la raíz.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.collection("config").doc("licencia");

const accion = (process.argv[2] || "estado").toLowerCase();
const dias = Number(process.argv[3]);

const fmt = (ts) =>
  ts ? new Date(ts).toLocaleString("es-AR") : "sin vencimiento (permanente)";

if (accion === "estado") {
  const snap = await ref.get();
  console.log("Estado:", snap.exists ? snap.data() : "(sin doc → habilitado)");
  if (snap.exists && snap.data().vencimiento)
    console.log("Vence:", fmt(snap.data().vencimiento));
  process.exit(0);
}

if (accion === "off") {
  await ref.set({ activa: false }, { merge: true });
  console.log("🔒 Servicio BLOQUEADO.");
  process.exit(0);
}

if (accion === "on") {
  const vencimiento = dias > 0 ? Date.now() + dias * 86_400_000 : null;
  await ref.set(
    { activa: true, vencimiento },
    { merge: true }
  );
  console.log(
    `✅ Servicio HABILITADO. ${
      vencimiento ? `Vence: ${fmt(vencimiento)}` : "Sin vencimiento (permanente)."
    }`
  );
  process.exit(0);
}

console.log("Uso: on [días] | off | estado");
process.exit(1);
