import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import {
  EXPENSE_LABELS,
  type Check,
  type CheckStatus,
  type DailyExpense,
  type ExpenseType,
  type FormaPago,
} from "./types";

// Firestore rechaza valores undefined → los quitamos antes de escribir.
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

// ==================== GASTOS DIARIOS ====================
export interface NewExpenseInput {
  fecha: number; // ts del día (start-of-day)
  tipo: ExpenseType;
  monto: number;
  formaPago: FormaPago;
  detalle?: string;
  /** Ata la comisión al pago que la generó (ver cuentas.ts → deletePayment). */
  grupoPagoId?: string;
  createdBy?: string;
}

export async function createExpense(
  input: NewExpenseInput
): Promise<string> {
  const ref = await addDoc(
    collection(db, "expenses"),
    clean({ ...input, createdAt: Date.now() })
  );
  logActivity("Registró egreso", {
    detalle: `${EXPENSE_LABELS[input.tipo]} · ${formatARS(input.monto)}`,
    entidad: "egreso",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updateExpense(
  id: string,
  patch: Partial<NewExpenseInput>
): Promise<void> {
  await updateDoc(doc(db, "expenses", id), clean(patch));
  logActivity("Editó egreso", { entidad: "egreso", entidadId: id });
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
  logActivity("Eliminó egreso", { entidad: "egreso", entidadId: id });
}

/** Fecha (ts del día) del egreso más reciente, o null si no hay ninguno. */
export async function getLastExpenseDate(): Promise<number | null> {
  const q = query(
    collection(db, "expenses"),
    orderBy("fecha", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return (snap.docs[0].data() as DailyExpense).fecha ?? null;
}

/**
 * Gastos del rango [start, end). Subscribe en tiempo real.
 */
export function subscribeExpensesRange(
  start: number,
  end: number,
  cb: (xs: DailyExpense[]) => void
): () => void {
  const q = query(
    collection(db, "expenses"),
    where("fecha", ">=", start),
    where("fecha", "<", end)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as DailyExpense), id: d.id }))
        .sort((a, b) => b.fecha - a.fecha)
    );
  });
}

export async function getExpensesForDay(
  dayStart: number,
  dayEnd: number
): Promise<DailyExpense[]> {
  const q = query(
    collection(db, "expenses"),
    where("fecha", ">=", dayStart),
    where("fecha", "<=", dayEnd),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as DailyExpense), id: d.id }));
}

// ==================== CHEQUES ====================
export interface NewCheckInput {
  numero: string;
  banco: string;
  monto: number;
  fechaEmision: number;
  fechaPago: number;
  beneficiario: string;
  notas?: string;
}

export async function createCheck(input: NewCheckInput): Promise<string> {
  const ref = await addDoc(
    collection(db, "checks"),
    clean({ ...input, status: "pendiente" as CheckStatus, createdAt: Date.now() })
  );
  logActivity("Registró cheque", {
    detalle: `Nº ${input.numero} · ${input.banco} · ${formatARS(input.monto)}`,
    entidad: "cheque",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updateCheckStatus(
  id: string,
  status: CheckStatus
): Promise<void> {
  await updateDoc(doc(db, "checks", id), { status });
  logActivity("Cambió estado de cheque", {
    detalle: `→ ${status}`,
    entidad: "cheque",
    entidadId: id,
  });
}

export async function deleteCheck(id: string): Promise<void> {
  await deleteDoc(doc(db, "checks", id));
  logActivity("Eliminó cheque", { entidad: "cheque", entidadId: id });
}

export function subscribeChecks(
  cb: (cheques: Check[]) => void
): () => void {
  const q = query(collection(db, "checks"), orderBy("fechaPago", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Check), id: d.id })));
  });
}

/**
 * Arranque del día de hoy (00:00 local).
 *
 * La fecha de pago del cheque se guarda a las 00:00 de ese día, así que hay que
 * comparar DÍA contra DÍA. Comparando contra `Date.now()`, un cheque que vencía
 * HOY quedaba "vencido" apenas pasaba la medianoche y encima desaparecía del
 * aviso de "próximos a vencer" — justo el día en que hay que ir al banco.
 */
function inicioDeHoy(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Cheques pendientes que vencen HOY o en los próximos `days` días. */
export function chequesProximos(checks: Check[], days = 3): Check[] {
  const hoy = inicioDeHoy();
  const limit = hoy + days * 86_400_000;
  return checks.filter(
    (c) => c.status === "pendiente" && c.fechaPago >= hoy && c.fechaPago <= limit
  );
}

/** Cheques pendientes cuya fecha de pago ya pasó (el de HOY todavía no vence). */
export function chequesVencidos(checks: Check[]): Check[] {
  const hoy = inicioDeHoy();
  return checks.filter((c) => c.status === "pendiente" && c.fechaPago < hoy);
}
