/**
 * Cloud Functions — gestión de usuarios para ALUSO DISTRIBUIDORA.
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
import axios from "axios";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requestCAE, buildAfipQrUrl, fechaHoyAfip, type IvaEntry } from "./afip";

initializeApp();

// ===== Config AFIP (producción) — ALUSO DISTRIBUIDORA =====
// ⚠️ Acá había `AFIP_CUIT = 20250642114` y `AFIP_PTO_VENTA = 6` HARDCODEADOS,
//    que son el CUIT y el punto de venta de Distribuidora Los Amigos NOA (el
//    proyecto del que se clonó esto), pese a que el comentario decía ALUSO.
//    Con eso, emitirFactura de ALUSO emitía comprobantes electrónicos contra el
//    CUIT de OTRA empresa en ARCA.
//    Ahora son secretos: si no están cargados, la función aborta y no factura.
//    Cargar cuando el cliente devuelva el formulario y tenga su certificado:
//      firebase functions:secrets:set AFIP_CUIT       --project aluso-distribuidora
//      firebase functions:secrets:set AFIP_PTO_VENTA  --project aluso-distribuidora
//      firebase functions:secrets:set AFIP_CERT       --project aluso-distribuidora
//      firebase functions:secrets:set AFIP_KEY        --project aluso-distribuidora
const AFIP_CUIT = defineSecret("AFIP_CUIT");
const AFIP_PTO_VENTA = defineSecret("AFIP_PTO_VENTA");
const AFIP_CERT = defineSecret("AFIP_CERT"); // .crt en base64
const AFIP_KEY = defineSecret("AFIP_KEY"); // .key en base64

// Debe coincidir con el dominio sintético usado en el login del front
// (src/lib/userAdmin.ts). Era `dlanoa.com`, de Los Amigos NOA.
const USER_DOMAIN = "alusodistribuidora.web.app";
const ROLES = [
  "cliente",
  "vendedor",
  "socio",
  "superadmin",
  "contador",
  "deposito",
] as const;
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
  {
    secrets: [AFIP_CERT, AFIP_KEY, AFIP_CUIT, AFIP_PTO_VENTA],
    timeoutSeconds: 300,
  },
  async (request) => {
    await assertStaff(request);
    const db = getFirestore();
    const data = request.data ?? {};

    // Identidad fiscal de ALUSO. Antes venía hardcodeada con la de Los Amigos
    // NOA; si no está cargada se corta ACÁ, antes de tocar ARCA, en vez de
    // emitir un comprobante a nombre de otra empresa.
    const afipCuit = Number(AFIP_CUIT.value());
    const afipPtoVenta = Number(AFIP_PTO_VENTA.value());
    if (!Number.isInteger(afipCuit) || String(afipCuit).length !== 11) {
      throw new HttpsError(
        "failed-precondition",
        "Facturación sin configurar: falta el CUIT de ALUSO (secreto AFIP_CUIT). " +
          "No se emitió ningún comprobante."
      );
    }
    if (!Number.isInteger(afipPtoVenta) || afipPtoVenta <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Facturación sin configurar: falta el punto de venta (secreto AFIP_PTO_VENTA). " +
          "No se emitió ningún comprobante."
      );
    }
    // El certificado se valida ACÁ y no donde se usa: más abajo hay una reserva
    // atómica del número de comprobante, así que fallar después de reservar
    // QUEMA un número de la numeración fiscal. Con los secretos en "PENDIENTE"
    // esto pasaba en cada intento.
    const certPem = Buffer.from(AFIP_CERT.value(), "base64").toString("utf8");
    const keyPem = Buffer.from(AFIP_KEY.value(), "base64").toString("utf8");
    if (!certPem.includes("BEGIN CERTIFICATE") || !keyPem.includes("PRIVATE KEY")) {
      throw new HttpsError(
        "failed-precondition",
        "Facturación sin configurar: falta el certificado digital de ARCA " +
          "(secretos AFIP_CERT / AFIP_KEY, en base64). No se emitió ningún " +
          "comprobante ni se consumió numeración."
      );
    }

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
    if (docNro === afipCuit) {
      throw new HttpsError(
        "invalid-argument",
        "El CUIT del cliente no puede ser el del emisor."
      );
    }

    // Importes (IVA 21% incluido en el total)
    const neto = r2(total / 1.21);
    const iva = r2(total - neto);
    const ivaArray: IvaEntry[] = [{ Id: 5, BaseImp: neto, Importe: iva }];

    // certPem y keyPem ya se leyeron y validaron arriba, antes de la reserva.
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
        cuit: afipCuit,
        puntoVenta: afipPtoVenta,
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

    const numeroFmt = `${String(afipPtoVenta).padStart(4, "0")}-${String(
      cae.numero
    ).padStart(8, "0")}`;
    const fechaISO = `${fechaStr.slice(0, 4)}-${fechaStr.slice(
      4,
      6
    )}-${fechaStr.slice(6, 8)}`;
    const qrUrl = buildAfipQrUrl({
      fecha: fechaISO,
      cuit: afipCuit,
      ptoVta: afipPtoVenta,
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
      puntoVenta: afipPtoVenta,
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

/**
 * Emite una NOTA DE CRÉDITO o DÉBITO asociada a una factura ya emitida.
 * En AFIP no existe "anular": una factura se revierte con una Nota de Crédito
 * (total o parcial). La Nota de Débito suma un cargo. Ambas apuntan a la factura
 * original (CbtesAsoc, obligatorio).
 * data: { facturaId, clase: 'credito'|'debito', total?, motivo? }
 *   - total ausente en crédito = anula el TOTAL de la factura.
 */
export const emitirNotaAfip = onCall(
  { secrets: [AFIP_CERT, AFIP_KEY, AFIP_CUIT, AFIP_PTO_VENTA], timeoutSeconds: 300 },
  async (request) => {
    await assertStaff(request);
    const db = getFirestore();
    const data = request.data ?? {};

    const afipCuit = Number(AFIP_CUIT.value());
    const afipPtoVenta = Number(AFIP_PTO_VENTA.value());
    if (!Number.isInteger(afipCuit) || String(afipCuit).length !== 11) {
      throw new HttpsError("failed-precondition", "Falta el CUIT de ALUSO (AFIP_CUIT).");
    }
    if (!Number.isInteger(afipPtoVenta) || afipPtoVenta <= 0) {
      throw new HttpsError("failed-precondition", "Falta el punto de venta (AFIP_PTO_VENTA).");
    }
    const certPem = Buffer.from(AFIP_CERT.value(), "base64").toString("utf8");
    const keyPem = Buffer.from(AFIP_KEY.value(), "base64").toString("utf8");
    if (!certPem.includes("BEGIN CERTIFICATE") || !keyPem.includes("PRIVATE KEY")) {
      throw new HttpsError("failed-precondition", "Falta el certificado de ARCA.");
    }

    const clase = data.clase === "debito" ? "debito" : "credito";
    const facturaId = String(data.facturaId ?? "");
    if (!facturaId) throw new HttpsError("invalid-argument", "Falta la factura.");

    const facRef = db.collection("facturas").doc(facturaId);
    const facSnap = await facRef.get();
    if (!facSnap.exists) throw new HttpsError("not-found", "No existe la factura.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fac = facSnap.data() as any;
    if (fac.estado !== "emitida") {
      throw new HttpsError("failed-precondition", "La factura no está emitida.");
    }
    if (fac.esNota) {
      throw new HttpsError("failed-precondition", "No se puede emitir una nota sobre otra nota.");
    }
    if (clase === "credito" && fac.anulada) {
      throw new HttpsError("failed-precondition", "La factura ya fue anulada con una nota de crédito.");
    }

    const tipo = fac.tipo === "A" ? "A" : "B";
    const totalNota = r2(Number(data.total) || Number(fac.total) || 0);
    if (totalNota <= 0) throw new HttpsError("invalid-argument", "Importe inválido.");
    if (clase === "credito" && totalNota > Number(fac.total) + 0.01) {
      throw new HttpsError("invalid-argument", "La nota de crédito no puede superar el total de la factura.");
    }

    const neto = r2(totalNota / 1.21);
    const iva = r2(totalNota - neto);
    const ivaArray: IvaEntry[] = [{ Id: 5, BaseImp: neto, Importe: iva }];

    // Receptor = el de la factura
    const cuitDigits = String(fac.cuit ?? "").replace(/\D/g, "");
    let docTipo = 99;
    let docNro = 0;
    if (cuitDigits.length === 11) {
      docTipo = 80;
      docNro = Number(cuitDigits);
    }

    // Tipo de comprobante: NC A=3 · NC B=8 · ND A=2 · ND B=7
    const cbteTipo =
      clase === "credito" ? (tipo === "A" ? 3 : 8) : (tipo === "A" ? 2 : 7);
    const facTipoCmp = tipo === "A" ? 1 : 6;
    const facNumero = Number(String(fac.numero ?? "").split("-").pop() || 0);
    const facPtoVta = Number(fac.puntoVenta) || afipPtoVenta;
    if (!facNumero) {
      throw new HttpsError("failed-precondition", "No se pudo leer el número de la factura original.");
    }

    const fechaStr = fechaHoyAfip();
    const condRec = fac.consumidorFinal ? 5 : 1;

    // Reserva (estado "emitiendo") para no dejar una nota sin CAE si algo falla.
    const notaRef = db.collection("facturas").doc();
    await notaRef.set({
      esNota: true,
      clase,
      facturaAsociadaId: facturaId,
      tipo,
      estado: "emitiendo",
      createdBy: request.auth?.uid ?? null,
      createdAt: Date.now(),
    });

    let cae;
    try {
      cae = await requestCAE({
        certPem,
        keyPem,
        cuit: afipCuit,
        puntoVenta: afipPtoVenta,
        tipoComprobante: cbteTipo,
        importeNeto: neto,
        importeIVA: iva,
        importeTotal: totalNota,
        ivaArray,
        docTipo,
        docNro,
        condicionIvaReceptorId: condRec,
        fechaStr,
        cbtesAsoc: [{ tipo: facTipoCmp, ptoVenta: facPtoVta, numero: facNumero }],
      });
    } catch (e) {
      await notaRef.delete().catch(() => undefined);
      throw new HttpsError("internal", (e as Error).message);
    }

    const numeroFmt = `${String(afipPtoVenta).padStart(4, "0")}-${String(
      cae.numero
    ).padStart(8, "0")}`;
    const fechaISO = `${fechaStr.slice(0, 4)}-${fechaStr.slice(4, 6)}-${fechaStr.slice(6, 8)}`;
    const qrUrl = buildAfipQrUrl({
      fecha: fechaISO,
      cuit: afipCuit,
      ptoVta: afipPtoVenta,
      tipoCmp: cbteTipo,
      nroCmp: cae.numero,
      importe: totalNota,
      tipoDocRec: docTipo,
      nroDocRec: docNro,
      cae: cae.cae,
    });

    const notaDoc = {
      esNota: true,
      clase, // 'credito' | 'debito'
      cbteTipo,
      facturaAsociadaId: facturaId,
      facturaNumero: fac.numero ?? null,
      remitoId: fac.remitoId ?? null,
      remitoNumero: fac.remitoNumero ?? null,
      tipo,
      consumidorFinal: fac.consumidorFinal ?? docTipo === 99,
      cuit: fac.cuit ?? null,
      razonSocial: fac.razonSocial ?? null,
      items: fac.items ?? [],
      motivo: (data.motivo ?? "").toString().trim() || null,
      neto,
      iva,
      total: totalNota,
      puntoVenta: afipPtoVenta,
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
    await notaRef.set(notaDoc);

    // Marcar la factura original: crédito total la deja ANULADA.
    const esTotal = clase === "credito" && totalNota >= Number(fac.total) - 0.01;
    await facRef.set(
      clase === "credito"
        ? { notaCreditoId: notaRef.id, anulada: esTotal ? true : fac.anulada ?? false }
        : { notaDebitoId: notaRef.id },
      { merge: true }
    );

    return { id: notaRef.id, ...notaDoc };
  }
);


// ==================== IA: leer factura de proveedor por foto ====================
// Recibe una imagen de la factura/remito del proveedor y usa OpenAI (visión)
// para extraer los datos en JSON estructurado. La API key es del CLIENTE: se
// guarda en Firestore `secretos/ia` (lectura denegada al navegador) y solo esta
// función la lee por Admin SDK. El consumo lo paga la cuenta de OpenAI del cliente.
const PROMPT_FACTURA = `Sos un extractor de datos de facturas y remitos de PROVEEDORES argentinos.
Te paso la foto de un comprobante de COMPRA (lo que un proveedor le entrega a la distribuidora).
Devolvé SOLO un JSON con esta forma exacta (sin texto extra):
{
  "proveedor": "razón social del proveedor tal como figura",
  "cuit": "CUIT del proveedor sin guiones, o null",
  "fecha": "AAAA-MM-DD (fecha del comprobante) o null",
  "numero": "número del comprobante tal como figura, o null",
  "tipo": "A" | "B" | "otro",
  "total": número (importe total, punto decimal) o null,
  "items": [
    { "descripcion": "texto", "codigo": "código/SKU si figura o null",
      "cantidad": número, "costoUnitario": número (precio unitario sin IVA si se ve, o el que figure) }
  ]
}
Reglas: si un dato no está o no se lee, poné null (no inventes). Los números sin separador de miles, con punto decimal. Si no hay ítems legibles, devolvé "items": [].`;

export const leerFacturaProveedor = onCall(
  { timeoutSeconds: 120, memory: "512MiB" },
  async (request: CallableRequest) => {
    await assertSuperadmin(request);

    const data = request.data ?? {};
    const imageBase64 = String(data.imageBase64 ?? "");
    const mimeType = String(data.mimeType ?? "image/jpeg");
    if (!imageBase64) {
      throw new HttpsError("invalid-argument", "Falta la imagen.");
    }

    // Clave del cliente (doc secreto, solo lo lee esta función por Admin SDK).
    const secretoSnap = await getFirestore().doc("secretos/ia").get();
    const apiKey = (secretoSnap.data()?.openaiKey as string) ?? "";
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "No hay API key de OpenAI cargada. Cargala en Configuración de IA."
      );
    }
    const cfgSnap = await getFirestore().doc("config/ia").get();
    const model = (cfgSnap.data()?.modelo as string) || "gpt-4o";

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    let content: string;
    try {
      const resp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content:
                "Extraés datos de comprobantes y devolvés SOLO JSON válido.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT_FACTURA },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500,
          temperature: 0,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 90000,
        }
      );
      content = resp.data?.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      console.error("OpenAI falló:", err.response?.status, JSON.stringify(err.response?.data) || err.message);
      const status = err.response?.status;
      if (status === 401) {
        throw new HttpsError("permission-denied", "La API key de OpenAI es inválida o expiró.");
      }
      if (status === 429) {
        throw new HttpsError("resource-exhausted", "OpenAI sin crédito o con límite de uso. Revisá tu cuenta.");
      }
      throw new HttpsError("internal", "No se pudo leer la factura con la IA.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new HttpsError("internal", "La IA no devolvió datos legibles. Probá con otra foto.");
    }
    return parsed;
  }
);

// ==================== IA: análisis de ventas + recomendación de compra ==========
// El servidor calcula los NÚMEROS duros (ventas por producto en el período,
// stock, ingresos) de forma exacta y determinística; la IA aporta el ANÁLISIS y
// las RECOMENDACIONES de compra. Así los datos no se inventan y el costo de IA es
// bajo (se manda un resumen compacto, no los remitos crudos).
export const analizarVentas = onCall(
  { timeoutSeconds: 120, memory: "512MiB" },
  async (request: CallableRequest) => {
    await assertSuperadmin(request);

    const dias = Math.min(365, Math.max(7, Number(request.data?.dias) || 30));
    const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
    const db = getFirestore();

    // Ventas del período (remitos no anulados).
    const remSnap = await db
      .collection("remitos")
      .where("fecha", ">=", desde)
      .get();
    const agg = new Map<string, { nombre: string; unidades: number; ingresos: number }>();
    remSnap.forEach((doc) => {
      const r = doc.data() as {
        anulado?: boolean;
        items?: { productId: string; nombre: string; cantidad: number; precioVenta: number }[];
      };
      if (r.anulado) return;
      for (const it of r.items ?? []) {
        const cur = agg.get(it.productId) ?? { nombre: it.nombre, unidades: 0, ingresos: 0 };
        cur.unidades += Number(it.cantidad) || 0;
        cur.ingresos += (Number(it.cantidad) || 0) * (Number(it.precioVenta) || 0);
        cur.nombre = it.nombre || cur.nombre;
        agg.set(it.productId, cur);
      }
    });

    // Stock actual (para cruzar con lo vendido).
    const prodSnap = await db.collection("products").get();
    const stockPorId = new Map<string, number>();
    prodSnap.forEach((d) => stockPorId.set(d.id, (d.data()?.stock as number) ?? 0));

    const filas = Array.from(agg.entries())
      .map(([id, v]) => ({
        nombre: v.nombre,
        vendidas: Math.round(v.unidades),
        ingresos: Math.round(v.ingresos),
        stock: stockPorId.get(id) ?? 0,
      }))
      .sort((a, b) => b.vendidas - a.vendidas)
      .slice(0, 40);

    const totalVentas = filas.reduce((s, f) => s + f.ingresos, 0);

    if (filas.length === 0) {
      return { periodoDias: dias, masVendidos: [], totalVentas: 0, resumen: "No hubo ventas en el período.", recomendaciones: [], observaciones: [] };
    }

    // IA
    const secretoSnap = await db.doc("secretos/ia").get();
    const apiKey = (secretoSnap.data()?.openaiKey as string) ?? "";
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "No hay API key de OpenAI cargada. Cargala en Configuración de IA.");
    }
    const cfgSnap = await db.doc("config/ia").get();
    const model = (cfgSnap.data()?.modelo as string) || "gpt-4o";

    const tabla = filas
      .map((f) => `${f.nombre} | vendidas ${f.vendidas} | stock ${f.stock} | $${f.ingresos}`)
      .join("\n");
    const prompt = `Sos analista de una DISTRIBUIDORA mayorista. Te paso las ventas de los últimos ${dias} días por producto (unidades vendidas, stock actual, ingresos en $).
Analizá y recomendá QUÉ COMPRAR/REPONER a fin de mes, priorizando: productos que se venden mucho y tienen POCO o NEGATIVO stock, y evitando sobre-stock de lo que no rota.
Datos:
${tabla}

Devolvé SOLO un JSON con esta forma:
{
  "resumen": "2-3 frases sobre cómo vinieron las ventas del período",
  "recomendaciones": [ { "producto": "nombre", "razon": "por qué", "sugerencia": "acción concreta, ej. reponer" } ],
  "observaciones": [ "otras señales útiles, ej. productos estancados" ]
}
Máximo 8 recomendaciones, las más importantes primero.`;

    let content: string;
    try {
      const resp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: "Sos analista de retail y devolvés SOLO JSON válido." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: 0.2,
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 90000 }
      );
      content = resp.data?.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      const err = e as { response?: { status?: number }; message?: string };
      const status = err.response?.status;
      if (status === 401) throw new HttpsError("permission-denied", "La API key de OpenAI es inválida o expiró.");
      if (status === 429) throw new HttpsError("resource-exhausted", "OpenAI sin crédito o con límite de uso.");
      console.error("OpenAI análisis falló:", status, err.message);
      throw new HttpsError("internal", "No se pudo generar el análisis con la IA.");
    }

    let ia: { resumen?: string; recomendaciones?: unknown[]; observaciones?: unknown[] } = {};
    try {
      ia = JSON.parse(content);
    } catch {
      ia = { resumen: content };
    }

    return {
      periodoDias: dias,
      masVendidos: filas.slice(0, 10),
      totalVentas,
      resumen: ia.resumen ?? "",
      recomendaciones: ia.recomendaciones ?? [],
      observaciones: ia.observaciones ?? [],
    };
  }
);

// ==================== IA: chat (conversar sobre el análisis / negocio) ==========
// Chat libre con la IA. Se le pasa un `contexto` (ej. el resumen de ventas que ya
// se calculó en analizarVentas) para que responda sobre el negocio con datos reales.
export const chatIA = onCall(
  { timeoutSeconds: 120, memory: "256MiB" },
  async (request: CallableRequest) => {
    await assertSuperadmin(request);

    const data = request.data ?? {};
    const contexto = String(data.contexto ?? "").slice(0, 8000);
    const mensajes = Array.isArray(data.messages) ? data.messages : [];
    const conv = mensajes
      .filter(
        (m: unknown) =>
          m &&
          typeof (m as { content?: unknown }).content === "string" &&
          ["user", "assistant"].includes((m as { role?: string }).role ?? "")
      )
      .slice(-16)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: String(m.content).slice(0, 4000),
      }));
    if (conv.length === 0) {
      throw new HttpsError("invalid-argument", "No hay mensaje para responder.");
    }

    const db = getFirestore();
    const secretoSnap = await db.doc("secretos/ia").get();
    const apiKey = (secretoSnap.data()?.openaiKey as string) ?? "";
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "No hay API key de OpenAI cargada.");
    }
    const cfgSnap = await db.doc("config/ia").get();
    const model = (cfgSnap.data()?.modelo as string) || "gpt-4o";

    const system =
      "Sos el asistente de análisis de una distribuidora mayorista (ALUSO). " +
      "Respondés en español, claro y concreto, sobre sus ventas, stock y decisiones de compra. " +
      "Usá los datos del contexto; si algo no está en el contexto, decilo en vez de inventar." +
      (contexto ? `\n\nCONTEXTO (datos reales del negocio):\n${contexto}` : "");

    let content: string;
    try {
      const resp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [{ role: "system", content: system }, ...conv],
          max_tokens: 900,
          temperature: 0.4,
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 90000 }
      );
      content = resp.data?.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      const err = e as { response?: { status?: number }; message?: string };
      const status = err.response?.status;
      if (status === 401) throw new HttpsError("permission-denied", "La API key de OpenAI es inválida o expiró.");
      if (status === 429) throw new HttpsError("resource-exhausted", "OpenAI sin crédito o con límite de uso.");
      console.error("OpenAI chat falló:", status, err.message);
      throw new HttpsError("internal", "No se pudo responder.");
    }

    return { reply: content };
  }
);
