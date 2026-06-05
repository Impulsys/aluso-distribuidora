// Gestión de usuarios desde el panel (solo superadmin).
// Estas operaciones requieren privilegios de servidor (Admin SDK), así que
// llaman a Cloud Functions vía httpsCallable — ver functions/src/index.ts.
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { logActivity } from "./bitacora";
import { ROLE_LABELS, type Role } from "./types";

// Dominio sintético: las cuentas creadas por usuario son `usuario@dlanoa.com`.
// Debe coincidir con USER_DOMAIN en functions/src/index.ts y con el login.
export const USER_DOMAIN = "dlanoa.com";

/** "vendedor1" → "vendedor1@dlanoa.com". Un email completo se deja igual. */
export function usernameToEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${v.toLowerCase()}@${USER_DOMAIN}`;
}

/** "vendedor1@dlanoa.com" → "vendedor1". Otros emails se devuelven igual. */
export function emailToUsername(email: string): string {
  return email.endsWith(`@${USER_DOMAIN}`)
    ? email.slice(0, -(USER_DOMAIN.length + 1))
    : email;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  password: string;
  role: Role;
}

const createUserFn = httpsCallable<CreateUserInput, { uid: string }>(
  functions,
  "adminCreateUser"
);

const setPasswordFn = httpsCallable<
  { uid: string; newPassword: string },
  { ok: boolean }
>(functions, "adminSetPassword");

const deleteUserFn = httpsCallable<{ uid: string }, { ok: boolean }>(
  functions,
  "adminDeleteUser"
);

/** Crea un usuario (Auth + perfil). Devuelve el uid. Lanza Error con mensaje legible. */
export async function adminCreateUser(input: CreateUserInput): Promise<string> {
  const res = await createUserFn(input);
  logActivity("Creó usuario", {
    detalle: `${input.displayName} (${input.username}) · ${ROLE_LABELS[input.role]}`,
    entidad: "usuario",
    entidadId: res.data.uid,
  });
  return res.data.uid;
}

/** Cambia la contraseña de un usuario existente. */
export async function adminSetPassword(
  uid: string,
  newPassword: string
): Promise<void> {
  await setPasswordFn({ uid, newPassword });
  logActivity("Cambió contraseña de usuario", {
    entidad: "usuario",
    entidadId: uid,
  });
}

/** Elimina un usuario (cuenta de Auth + perfil en Firestore). */
export async function adminDeleteUser(uid: string): Promise<void> {
  await deleteUserFn({ uid });
  logActivity("Eliminó usuario", { entidad: "usuario", entidadId: uid });
}
