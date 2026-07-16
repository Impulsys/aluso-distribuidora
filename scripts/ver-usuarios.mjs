// SOLO LECTURA. Lista los usuarios de la app y su rol.
//   node scripts/ver-usuarios.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection("users").get();
const orden = { superadmin: 0, socio: 1, contador: 2, vendedor: 3 };
snap.docs
  .map((d) => d.data())
  .sort((a, b) => (orden[a.role] ?? 9) - (orden[b.role] ?? 9))
  .forEach((u) => {
    console.log(
      `${(u.role ?? "—").padEnd(11)} ${(u.email ?? "—").padEnd(34)} ${u.displayName ?? ""}`
    );
  });
process.exit(0);
