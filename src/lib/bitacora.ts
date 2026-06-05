// Bitácora de auditoría: registro INMUTABLE de las acciones del sistema.
// - El actor actual lo setea AuthContext (setBitacoraActor) al cambiar de sesión.
// - logActivity() escribe un evento, salvo que el actor sea el programador
//   (OWNER_EMAIL) — sus pruebas NO ensucian el control interno de los socios.
// - Nunca lanza: si el log falla, la operación de negocio igual sigue.
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
} from "firebase/firestore";
import { db } from "./firebase";
import { OWNER_EMAIL } from "./licencia";
import type { BitacoraEntry, Role } from "./types";

export interface BitacoraActor {
  uid: string;
  email: string;
  nombre: string;
  role: Role;
}

let actor: BitacoraActor | null = null;

/** AuthContext llama esto cuando cambia el usuario logueado. */
export function setBitacoraActor(a: BitacoraActor | null): void {
  actor = a;
}

interface LogOpts {
  detalle?: string;
  entidad?: string;
  entidadId?: string;
}

/**
 * Registra una acción en la bitácora. No-op si no hay actor o si el actor es
 * el programador (OWNER_EMAIL). Silencioso ante errores.
 */
export function logActivity(accion: string, opts: LogOpts = {}): void {
  const a = actor;
  if (!a) return;
  if (a.email && a.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) return;

  const entry: Record<string, unknown> = {
    ts: Date.now(),
    uid: a.uid,
    email: a.email,
    nombre: a.nombre,
    role: a.role,
    accion,
  };
  if (opts.detalle) entry.detalle = opts.detalle;
  if (opts.entidad) entry.entidad = opts.entidad;
  if (opts.entidadId) entry.entidadId = opts.entidadId;

  // Fire-and-forget: no bloquear la operación si el log falla.
  void addDoc(collection(db, "bitacora"), entry).catch((e) => {
    console.error("bitacora:", e);
  });
}

/** Suscripción a la bitácora por rango de fechas (más nuevo primero). */
export function subscribeBitacoraRange(
  start: number,
  end: number,
  cb: (xs: BitacoraEntry[]) => void
): () => void {
  const q = query(
    collection(db, "bitacora"),
    where("ts", ">=", start),
    where("ts", "<", end),
    orderBy("ts", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as BitacoraEntry), id: d.id })));
  });
}

/** Suscripción a los últimos N eventos (para la vista por defecto). */
export function subscribeBitacoraRecent(
  n: number,
  cb: (xs: BitacoraEntry[]) => void
): () => void {
  const q = query(
    collection(db, "bitacora"),
    orderBy("ts", "desc"),
    fbLimit(n)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as BitacoraEntry), id: d.id })));
  });
}
