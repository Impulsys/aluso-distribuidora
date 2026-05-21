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
import type {
  Check,
  CheckStatus,
  DailyExpense,
  ExpenseType,
  FormaPago,
} from "./types";

// ==================== GASTOS DIARIOS ====================
export interface NewExpenseInput {
  fecha: number; // ts del día (start-of-day)
  tipo: ExpenseType;
  monto: number;
  formaPago: FormaPago;
  detalle?: string;
  createdBy?: string;
}

export async function createExpense(
  input: NewExpenseInput
): Promise<string> {
  const ref = await addDoc(collection(db, "expenses"), {
    ...input,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
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
  const ref = await addDoc(collection(db, "checks"), {
    ...input,
    status: "pendiente" as CheckStatus,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateCheckStatus(
  id: string,
  status: CheckStatus
): Promise<void> {
  await updateDoc(doc(db, "checks", id), { status });
}

export async function deleteCheck(id: string): Promise<void> {
  await deleteDoc(doc(db, "checks", id));
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
 * Cheques pendientes que vencen en los próximos `days` días.
 */
export function chequesProximos(checks: Check[], days = 3): Check[] {
  const now = Date.now();
  const limit = now + days * 86_400_000;
  return checks.filter(
    (c) =>
      c.status === "pendiente" &&
      c.fechaPago >= now &&
      c.fechaPago <= limit
  );
}

export function chequesVencidos(checks: Check[]): Check[] {
  const now = Date.now();
  return checks.filter(
    (c) => c.status === "pendiente" && c.fechaPago < now
  );
}
