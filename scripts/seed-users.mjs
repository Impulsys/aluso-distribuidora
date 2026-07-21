// Crea/actualiza los usuarios staff (email+contraseña) y su rol en Firestore.
// Uso: node scripts/seed-users.mjs   (requiere serviceAccountKey.json en la raíz)
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));

// 🛑 Candado de proyecto. La llave que había acá era la de
// `distribuidora-los-amigos-noa` (OTRO cliente, en producción): este script le
// habría creado/pisado usuarios. Si la llave no es la de ALUSO, no arranca.
const PROYECTO_ESPERADO = "aluso-distribuidora";
if (sa.project_id !== PROYECTO_ESPERADO) {
  console.error(
    `\n🛑 ABORTADO: serviceAccountKey.json es del proyecto "${sa.project_id}",\n` +
      `   y este script solo puede correr contra "${PROYECTO_ESPERADO}".\n` +
      `   Bajá la llave de ALUSO desde:\n` +
      `   https://console.firebase.google.com/project/${PROYECTO_ESPERADO}/settings/serviceaccounts/adminsdk\n`
  );
  process.exit(1);
}

initializeApp({ credential: cert(sa) });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = "987654";
const USERS = [
  { email: "axel@alusodistribuidora.web.app", displayName: "Axel", role: "superadmin" },
  { email: "socios@alusodistribuidora.web.app", displayName: "Socios", role: "socio" },
  { email: "vendedor@alusodistribuidora.web.app", displayName: "Vendedor", role: "vendedor" },
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
