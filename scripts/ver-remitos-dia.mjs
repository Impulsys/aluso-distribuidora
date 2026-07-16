// SOLO LECTURA. TODOS los remitos de un día, incluidos los ANULADOS.
//   node scripts/ver-remitos-dia.mjs 2026-07-16
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const h24 = (ts) =>
  new Date(ts).toLocaleString("es-AR", { hourCycle: "h23", timeStyle: "medium", dateStyle: "short" });

const key = process.argv[2];
const [y, m, d] = key.split("-").map(Number);
const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
const end = start + 86_400_000;

const snap = await db
  .collection("remitos")
  .where("fecha", ">=", start)
  .where("fecha", "<", end)
  .get();

const rs = snap.docs
  .map((x) => ({ ...x.data(), id: x.id }))
  .sort((a, b) => a.fecha - b.fecha);

let vivos = 0,
  anulados = 0;
for (const r of rs) {
  const tag = r.anulado ? "ANULADO" : "       ";
  if (r.anulado) anulados += r.total || 0;
  else if ((r.formaPago ?? "efectivo") === "efectivo") vivos += r.total || 0;
  console.log(
    `${tag} ${h24(r.fecha).padEnd(22)} ${(r.numero ?? "").padEnd(11)} ${ars(r.total).padStart(14)}  ${(r.formaPago ?? "efectivo").padEnd(14)} ${r.clienteNombre ?? ""}`
  );
}
console.log(`\n  ${rs.length} remitos en total`);
console.log(`  Efectivo NO anulado: ${ars(vivos)}`);
console.log(`  ANULADOS:            ${ars(anulados)}`);
process.exit(0);
