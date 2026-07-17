// SOLO LECTURA. Resuelve un uid a persona y muestra la bitácora de un día.
//   node scripts/quien-es.mjs <uid> [YYYY-MM-DD]
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const uid = process.argv[2];
const dia = process.argv[3];

if (uid) {
  const u = await db.collection("users").doc(uid).get();
  console.log(`\n=== QUIEN ES ${uid} ===`);
  if (u.exists) {
    const v = u.data();
    console.log(`  users/: ${v.displayName ?? "—"} · ${v.email ?? "—"} · rol ${v.role ?? "—"}`);
  } else console.log("  users/: no figura");
  try {
    const a = await getAuth().getUser(uid);
    console.log(`  Auth:   ${a.email ?? "—"} · ${a.displayName ?? "—"}`);
  } catch {
    console.log("  Auth:   la cuenta ya no existe");
  }
}

if (dia) {
  const [y, m, d] = dia.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const b = await db
    .collection("bitacora")
    .where("ts", ">=", start)
    .where("ts", "<", start + 86_400_000)
    .get();
  console.log(`\n=== BITACORA del ${dia} · ${b.size} eventos ===`);
  b.docs
    .map((x) => x.data())
    .sort((a, z) => a.ts - z.ts)
    .forEach((v) =>
      console.log(
        `  ${new Date(v.ts).toLocaleString("es-AR", { hourCycle: "h23" })}  ${(v.nombre ?? v.email ?? "?").padEnd(18)} ${v.accion}${v.detalle ? ` · ${v.detalle}` : ""}`
      )
    );
}
console.log();
process.exit(0);
