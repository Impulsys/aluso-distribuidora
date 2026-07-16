// Define la contraseña de un usuario. Firebase guarda un HASH: la contraseña
// vieja no se puede leer, solo reemplazar.
//   node scripts/set-password.mjs axelfaber@gmail.com "miClaveNueva"
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/set-password.mjs <email> "<contraseña>"');
  process.exit(1);
}
if (password.length < 6) {
  console.error("La contraseña debe tener al menos 6 caracteres.");
  process.exit(1);
}

const auth = getAuth();
const u = await auth.getUserByEmail(email);
await auth.updateUser(u.uid, { password });
console.log(`✓ Contraseña actualizada para ${email}`);
process.exit(0);
