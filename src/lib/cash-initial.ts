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
