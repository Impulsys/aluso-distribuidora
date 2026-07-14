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
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requestCAE, buildAfipQrUrl, fechaHoyAfip, type IvaEntry } from "./afip";

initializeApp();

// ===== Config AFIP (producción) — Distribuidora Los Amigos =====
const AFIP_CUIT = 20250642114;
const AFIP_PTO_VENTA = 6;
const AFIP_CERT = defineSecret("AFIP_CERT"); // .crt en base64
const AFIP_KEY = defineSecret("AFIP_KEY"); // .key en base64

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

// ============================================================================
//  FACTURACIÓN ELECTRÓNICA AFIP
// ============================================================================

/**
 * Quien factura debe ser socio o superadmin. Un `vendedor` NO puede emitir
 * comprobantes fiscales reales (las reglas de Firestore tampoco lo dejan
 * escribir remitos, pero esta función usa el Admin SDK y las saltea).
 */
async function assertStaff(request: CallableRequest): Promise<void> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Necesitás iniciar sesión.");
  const snap = await getFirestore().collection("users").doc(uid).get();
  const role = snap.data()?.role;
  if (!["socio", "superadmin"].includes(role)) {
    throw new HttpsError("permission-denied", "No tenés permiso para facturar.");
  }
}

function condicionIvaReceptorId(cond: string | undefined, tipo: "A" | "B"): number {
  switch (cond) {
    case "responsable_inscripto":
      return 1;
    case "exento":
      return 4;
    case "monotributo":
      return 6;
    case "consumidor_final":
      return 5;
    default:
      return tipo === "A" ? 1 : 5; // A → RI · B → Consumidor Final
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Emite una factura electrónica (A o B) a partir de un remito.
 * data: { remitoId, tipo: 'A'|'B', clienteCuit?, clienteCondicionIva?, clienteNombre? }
 */
export const emitirFactura = onCall(
  // AFIP (WSAA + WSFE + verificación) tarda: con el timeout default de 60s la
  // función moría DESPUÉS de obtener el CAE y el reintento emitía otro.
  { secrets: [AFIP_CERT, AFIP_KEY], timeoutSeconds: 300 },
  async (request) => {
    await assertStaff(request);
    const db = getFirestore();
    const data = request.data ?? {};

    const tipo = data.tipo === "A" ? "A" : "B";
    const remitoId = String(data.remitoId ?? "");
    if (!remitoId) throw new HttpsError("invalid-argument", "Falta el remito.");

    // Cargar remito
    const remRef = db.collection("remitos").doc(remitoId);
    const remSnap = await remRef.get();
    if (!remSnap.exists) throw new HttpsError("not-found", "No existe el remito.");
    const remito = remSnap.data() as any;

    // NO facturar una venta anulada (sería un CAE real por una venta que no existe).
    if (remito.anulado) {
      throw new HttpsError(
        "failed-precondition",
        "La venta está ANULADA: no se puede facturar."
      );
    }

    // Idempotencia: si ya tiene factura emitida, devolverla.
    if (remito.facturaId) {
      const f = await db.collection("facturas").doc(remito.facturaId).get();
      if (f.exists && f.data()?.estado === "emitida") {
        return { id: f.id, ...f.data(), yaExistia: true };
      }
      if (f.exists && f.data()?.estado === "emitiendo") {
        throw new HttpsError(
          "already-exists",
          "Ya hay una emisión en curso para este remito. Verificá en AFIP si el comprobante salió antes de reintentar (para no emitir dos veces)."
        );
      }
    }

    // Redondear a 2 decimales: un total con basura de punto flotante
    // (ej. 3704.9700000000003) hace que AFIP RECHACE el comprobante.
    const total = r2(Number(remito.total) || 0);
    if (total <= 0)
      throw new HttpsError("failed-precondition", "El remito no tiene importe válido.");

    // Documento del receptor
    const cuitDigits = String(data.clienteCuit ?? "").replace(/\D/g, "");
    let docTipo = 99;
    let docNro = 0;
    if (cuitDigits.length === 11) {
      docTipo = 80;
      docNro = Number(cuitDigits);
    } else if (cuitDigits.length === 7 || cuitDigits.length === 8) {
      docTipo = 96;
      docNro = Number(cuitDigits);
    }
    if (tipo === "A" && docTipo !== 80) {
      throw new HttpsError(
        "invalid-argument",
        "La Factura A requiere el CUIT del cliente (11 dígitos)."
      );
    }
    if (docNro === AFIP_CUIT) {
      throw new HttpsError(
        "invalid-argument",
        "El CUIT del cliente no puede ser el del emisor."
      );
    }

    // Importes (IVA 21% incluido en el total)
    const neto = r2(total / 1.21);
    const iva = r2(total - neto);
    const ivaArray: IvaEntry[] = [{ Id: 5, BaseImp: neto, Importe: iva }];

    const certPem = Buffer.from(AFIP_CERT.value(), "base64").toString("utf8");
    const keyPem = Buffer.from(AFIP_KEY.value(), "base64").toString("utf8");
    const fechaStr = fechaHoyAfip();

    // RESERVA ATÓMICA antes de pegarle a AFIP. Si dos pestañas/equipos facturan
    // el mismo remito a la vez, solo una pasa. Y si la función muere después de
    // obtener el CAE, el remito queda "en emisión" y el reintento NO emite otro.
    const facturaRef = db.collection("facturas").doc();
    await db.runTransaction(async (tx) => {
      const s = await tx.get(remRef);
      if (!s.exists) throw new HttpsError("not-found", "No existe el remito.");
      const r = s.data() as any;
      if (r.anulado)
        throw new HttpsError("failed-precondition", "La venta está ANULADA.");
      if (r.facturaId)
        throw new HttpsError(
          "already-exists",
          "Este remito ya tiene una factura (o una emisión en curso)."
        );
      tx.set(facturaRef, {
        remitoId,
        remitoNumero: remito.numero ?? "",
        tipo,
        estado: "emitiendo",
        createdBy: request.auth?.uid ?? null,
        createdAt: Date.now(),
      });
      tx.set(remRef, { facturaId: facturaRef.id }, { merge: true });
    });

    let cae;
    try {
      cae = await requestCAE({
        certPem,
        keyPem,
        cuit: AFIP_CUIT,
        puntoVenta: AFIP_PTO_VENTA,
        tipoComprobante: tipo === "A" ? 1 : 6,
        importeNeto: neto,
        importeIVA: iva,
        importeTotal: total,
        ivaArray,
        docTipo,
        docNro,
        condicionIvaReceptorId: condicionIvaReceptorId(
          data.clienteCondicionIva,
          tipo
        ),
        fechaStr,
      });
    } catch (e) {
      // AFIP rechazó o falló ANTES de dar el CAE → liberar la reserva para que
      // se pueda reintentar (borramos la factura provisoria y el facturaId).
      await facturaRef.delete().catch(() => undefined);
      await remRef
        .set({ facturaId: FieldValue.delete() }, { merge: true })
        .catch(() => undefined);
      throw new HttpsError("internal", (e as Error).message);
    }

    const numeroFmt = `${String(AFIP_PTO_VENTA).padStart(4, "0")}-${String(
      cae.numero
    ).padStart(8, "0")}`;
    const fechaISO = `${fechaStr.slice(0, 4)}-${fechaStr.slice(
      4,
      6
    )}-${fechaStr.slice(6, 8)}`;
    const qrUrl = buildAfipQrUrl({
      fecha: fechaISO,
      cuit: AFIP_CUIT,
      ptoVta: AFIP_PTO_VENTA,
      tipoCmp: tipo === "A" ? 1 : 6,
      nroCmp: cae.numero,
      importe: total,
      tipoDocRec: docTipo,
      nroDocRec: docNro,
      cae: cae.cae,
    });

    // Persistir la factura
    const facturaDoc = {
      remitoId,
      remitoNumero: remito.numero ?? "",
      tipo,
      consumidorFinal: docTipo === 99,
      cuit: docTipo === 80 ? String(docNro) : null,
      razonSocial: data.clienteNombre?.trim() || null,
      items: remito.items ?? [],
      neto,
      iva,
      total,
      puntoVenta: AFIP_PTO_VENTA,
      numero: numeroFmt,
      cae: cae.cae,
      caeVto: cae.caeVto,
      qrUrl,
      verification: cae.verification,
      verificationDetail: cae.verificationDetail ?? null,
      estado: "emitida",
      createdBy: request.auth?.uid ?? null,
      createdAt: Date.now(),
      fecha: Date.now(),
    };
    // Escribimos SOBRE la reserva (el remito ya apunta a este facturaRef).
    await facturaRef.set(facturaDoc);

    return { id: facturaRef.id, ...facturaDoc };
  }
);
