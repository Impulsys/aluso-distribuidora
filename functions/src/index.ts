/**
 * Cloud Functions — gestión de usuarios para Distribuidora Los Amigos NOA.
 *
 * Estas funciones corren con el Admin SDK (privilegios de servidor), lo único
 * que permite: (a) crear cuentas sin desloguear al admin, y (b) cambiar la
 * contraseña de OTRO usuario — algo imposible desde el SDK web del navegador.
 *
 * Toda llamada exige que el que la invoca sea `superadmin` (verificado contra
 * Firestore `users/{uid}.role`). El front llama estas funciones con httpsCallable.
 */
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

// Debe coincidir con el dominio sintético usado en el login del front.
const USER_DOMAIN = "dlanoa.com";
const ROLES = ["cliente", "vendedor", "socio", "superadmin"] as const;
type Role = (typeof ROLES)[number];

/** Corta la ejecución si quien llama no es un superadmin autenticado. */
async function assertSuperadmin(request: CallableRequest): Promise<void> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Necesitás iniciar sesión.");
  }
  const snap = await getFirestore().collection("users").doc(uid).get();
  if (!snap.exists || snap.data()?.role !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "Solo un superadmin puede gestionar usuarios."
    );
  }
}

/** Normaliza el nombre de usuario (minúsculas, sin espacios). */
function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Valida que la contraseña cumpla el mínimo de Firebase (6 caracteres). */
function assertPassword(pwd: unknown): asserts pwd is string {
  if (typeof pwd !== "string" || pwd.length < 6) {
    throw new HttpsError(
      "invalid-argument",
      "La contraseña debe tener al menos 6 caracteres."
    );
  }
}

/**
 * Crea un usuario (Auth + perfil en Firestore) a partir de un nombre de usuario.
 * data: { username, displayName, password, role }
 */
export const adminCreateUser = onCall(async (request) => {
  await assertSuperadmin(request);

  const data = request.data ?? {};
  const username = normalizeUsername(data.username);
  if (!username || !/^[a-z0-9._-]+$/.test(username)) {
    throw new HttpsError(
      "invalid-argument",
      "Usuario inválido. Usá solo letras, números, punto, guion o guion bajo."
    );
  }
  assertPassword(data.password);
  const role = data.role as Role;
  if (!ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "Rol inválido.");
  }
  const displayName = String(data.displayName ?? "").trim() || username;
  const email = `${username}@${USER_DOMAIN}`;

  let uid: string;
  try {
    const record = await getAuth().createUser({
      email,
      password: data.password,
      displayName,
    });
    uid = record.uid;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Ya existe un usuario con ese nombre.");
    }
    console.error("createUser falló:", err.code, err.message);
    throw new HttpsError(
      "internal",
      `No se pudo crear la cuenta: ${err.code ?? err.message ?? "error desconocido"}`
    );
  }

  // Perfil en Firestore (mismo shape que AppUser en el front).
  try {
    await getFirestore().collection("users").doc(uid).set({
      uid,
      email,
      displayName,
      role,
      createdAt: Date.now(),
    });
  } catch (e) {
    const err = e as { message?: string };
    console.error("Firestore set falló:", err.message);
    throw new HttpsError(
      "internal",
      `Cuenta creada pero falló el perfil: ${err.message ?? "error"}`
    );
  }

  return { uid };
});

/**
 * Cambia la contraseña de un usuario existente.
 * data: { uid, newPassword }
 */
export const adminSetPassword = onCall(async (request) => {
  await assertSuperadmin(request);

  const data = request.data ?? {};
  const uid = data.uid;
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "Falta el identificador del usuario.");
  }
  assertPassword(data.newPassword);

  try {
    await getAuth().updateUser(uid, { password: data.newPassword });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    throw new HttpsError(
      "internal",
      `No se pudo cambiar la contraseña: ${err.code ?? err.message ?? "error"}`
    );
  }

  return { ok: true };
});

/**
 * Elimina un usuario (cuenta de Auth + perfil en Firestore).
 * data: { uid }
 */
export const adminDeleteUser = onCall(async (request) => {
  await assertSuperadmin(request);

  const data = request.data ?? {};
  const uid = data.uid;
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "Falta el identificador del usuario.");
  }
  if (uid === request.auth?.uid) {
    throw new HttpsError(
      "failed-precondition",
      "No podés eliminar tu propia cuenta."
    );
  }

  // Borrar de Auth (si no existe, seguimos para limpiar el perfil igual).
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError(
        "internal",
        `No se pudo eliminar la cuenta: ${err.code ?? err.message ?? "error"}`
      );
    }
  }

  // Borrar el perfil de Firestore.
  try {
    await getFirestore().collection("users").doc(uid).delete();
  } catch (e) {
    const err = e as { message?: string };
    throw new HttpsError(
      "internal",
      `Cuenta borrada pero falló al borrar el perfil: ${err.message ?? "error"}`
    );
  }

  return { ok: true };
});
