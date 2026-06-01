// Caja diaria: cierre con arqueo por denominación.
// El doc vive en cashClosings/{YYYY-MM-DD} (mismo que la caja inicial).
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { dayKey, type DailyCashInitial } from "./cash-initial";

// Billetes ARS (de mayor a menor) para el arqueo.
export const DENOMINACIONES = [
  20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10,
] as const;

/** Suma del arqueo: Σ cantidad × denominación. */
export function totalArqueo(arqueo: Record<string, number>): number {
  return Object.entries(arqueo).reduce(
    (s, [denom, cant]) => s + Number(denom) * (Number(cant) || 0),
    0
  );
}

export interface CierreInput {
  arqueo: Record<string, number>;
  efectivoEsperado: number;
  cerradoPor?: string;
}

/** Cierra la caja del día: guarda arqueo, contado, esperado, diferencia y bloquea. */
export async function cerrarCaja(
  dayTs: number,
  input: CierreInput
): Promise<void> {
  const d = new Date(dayTs);
  d.setHours(0, 0, 0, 0);
  const contado = totalArqueo(input.arqueo);
  await setDoc(
    doc(db, "cashClosings", dayKey(dayTs)),
    {
      fecha: d.getTime(),
      arqueo: input.arqueo,
      efectivoContado: contado,
      efectivoEsperado: input.efectivoEsperado,
      diferencia: contado - input.efectivoEsperado,
      cerrado: true,
      cerradoPor: input.cerradoPor ?? null,
      cerradoAt: Date.now(),
    },
    { merge: true }
  );
}

/** Reabre la caja de un día (vuelve a editable). */
export async function reabrirCaja(dayTs: number): Promise<void> {
  await setDoc(
    doc(db, "cashClosings", dayKey(dayTs)),
    { cerrado: false },
    { merge: true }
  );
}

/** Suscripción al doc de caja de un día (caja inicial + cierre). */
export function subscribeCierre(
  dayTs: number,
  cb: (data: DailyCashInitial | null) => void
): () => void {
  return onSnapshot(doc(db, "cashClosings", dayKey(dayTs)), (snap) => {
    cb(snap.exists() ? (snap.data() as DailyCashInitial) : null);
  });
}

/** Lee el cierre de un día (one-shot). */
export async function getCierre(
  dayTs: number
): Promise<DailyCashInitial | null> {
  const snap = await getDoc(doc(db, "cashClosings", dayKey(dayTs)));
  return snap.exists() ? (snap.data() as DailyCashInitial) : null;
}
