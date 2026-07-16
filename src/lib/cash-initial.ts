import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Para la "caja inicial" usamos un doc por día en `cashClosings`
 * con id = fecha YYYY-MM-DD (clave determinística para upsert).
 */

export interface DailyCashInitial {
  fecha: number; // timestamp del día (00:00)
  cajaInicial: number;
  updatedBy?: string;
  updatedAt: number;
  // Cierre de caja (arqueo) — se completan al cerrar el día
  arqueo?: Record<string, number>; // denominación → cantidad de billetes
  efectivoContado?: number;
  efectivoEsperado?: number;
  diferencia?: number;
  // Qué se hizo con la plata contada al cerrar: cuánto quedó en el cajón (pasa
  // como caja inicial de mañana) y cuánto se retiró (banco / caja fuerte).
  quedaEnCaja?: number;
  retirado?: number;
  cerrado?: boolean;
  cerradoPor?: string;
  cerradoAt?: number;
}

export function dayKey(dayTs: number): string {
  const d = new Date(dayTs);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function setCashInitial(
  dayTs: number,
  cajaInicial: number,
  updatedBy?: string
): Promise<void> {
  const d = new Date(dayTs);
  d.setHours(0, 0, 0, 0);
  await setDoc(
    doc(db, "cashClosings", dayKey(dayTs)),
    {
      fecha: d.getTime(),
      cajaInicial,
      updatedBy: updatedBy ?? null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/** Todos los cierres/cajas (un doc por día) con su detalle completo. */
export function subscribeCierres(
  cb: (xs: DailyCashInitial[]) => void
): () => void {
  return onSnapshot(collection(db, "cashClosings"), (snap) => {
    cb(snap.docs.map((d) => d.data() as DailyCashInitial));
  });
}

export function subscribeCashInitialRange(
  startTs: number,
  endTs: number,
  cb: (map: Record<string, number>) => void
): () => void {
  const q = query(
    collection(db, "cashClosings"),
    where("fecha", ">=", startTs),
    where("fecha", "<", endTs)
  );
  return onSnapshot(q, (snap) => {
    const map: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as DailyCashInitial;
      if (typeof data.cajaInicial === "number") {
        map[d.id] = data.cajaInicial;
      }
    });
    cb(map);
  });
}
