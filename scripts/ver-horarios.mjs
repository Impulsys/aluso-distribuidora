// SOLO LECTURA. Horario REAL (ISO + 24h) de los cierres y de los remitos de
// cada día, para entender en qué momento se opera y se cierra la caja.
//   node scripts/ver-horarios.mjs 2026-07-15 2026-07-16
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
  new Date(ts).toLocaleString("es-AR", { hourCycle: "h23", dateStyle: "short", timeStyle: "medium" });

for (const key of process.argv.slice(2)) {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = start + 86_400_000;

  const cierre = await db.collection("cashClosings").doc(key).get();
  console.log(`\n${"=".repeat(70)}\n${key}`);
  if (cierre.exists && cierre.data().cerradoAt) {
    const ts = cierre.data().cerradoAt;
    console.log(`  cerradoAt raw : ${ts}`);
    console.log(`  cerradoAt ISO : ${new Date(ts).toISOString()}  (UTC)`);
    console.log(`  cerradoAt 24h : ${h24(ts)}  (hora de esta PC)`);
  }

  const rem = await db
    .collection("remitos")
    .where("fecha", ">=", start)
    .where("fecha", "<", end)
    .get();
  const rs = rem.docs
    .map((x) => x.data())
    .filter((r) => !r.anulado)
    .sort((a, b) => a.fecha - b.fecha);
  console.log(`\n  ${rs.length} remitos (no anulados):`);
  for (const r of rs) {
    console.log(
      `    ${h24(r.fecha).padEnd(22)} ${(r.numero ?? "").padEnd(12)} ` +
        `${ars(r.total).padStart(14)}  ${(r.formaPago ?? "efectivo").padEnd(14)} ${r.clienteNombre ?? ""}`
    );
  }
}
console.log();
process.exit(0);
