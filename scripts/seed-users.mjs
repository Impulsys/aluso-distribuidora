// Crea/actualiza los usuarios staff (email+contraseña) y su rol en Firestore.
// Uso: node scripts/seed-users.mjs   (requiere serviceAccountKey.json en la raíz)
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(sa) });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = "987654";
const USERS = [
  { email: "maxi@dlanoa.com", displayName: "Maxi", role: "superadmin" },
  { email: "socios@dlanoa.com", displayName: "Socios", role: "socio" },
  { email: "vendedor@dlanoa.com", displayName: "Vendedor", role: "vendedor" },
];

for (const u of USERS) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(u.email);
    await auth.updateUser(userRecord.uid, {
      password: PASSWORD,
      displayName: u.displayName,
    });
    console.log(`↻ Actualizado: ${u.email}`);
  } catch {
    userRecord = await auth.createUser({
      email: u.email,
      password: PASSWORD,
      displayName: u.displayName,
      emailVerified: true,
    });
    console.log(`+ Creado: ${u.email}`);
  }
  await db.collection("users").doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: Date.now(),
    },
    { merge: true }
  );
  console.log(`  → rol "${u.role}" asignado`);
}

console.log("\nListo. Usuarios staff provisionados.");
process.exit(0);
