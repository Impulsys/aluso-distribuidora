// Caja diaria: cierre con arqueo por denominación.
// El doc vive en cashClosings/{YYYY-MM-DD} (mismo que la caja inicial).
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { dayKey, type DailyCashInitial } from "./cash-initial";
import { logActivity } from "./bitacora";
import { formatARS } from "./format";
import type { DailyExpense, SupplierPayment } from "./types";

/** Etiqueta de fecha corta (DD/MM/AAAA) para los detalles de bitácora. */
function fechaDia(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR");
}

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

/**
 * ¿El pago a proveedor salió con BILLETES de la caja?
 *
 * Todas las vías menos "transferencia" usan plata física (depósito bancario en
 * efectivo, agencia/financiera, efectivo). Antes solo se restaba via==="efectivo"
 * y por eso la caja daba "falta plata" al pagar un camión con billetes.
 */
export function pagoUsaEfectivo(p: SupplierPayment): boolean {
  if (p.via) return p.via !== "transferencia";
  return (p.formaPago ?? "efectivo") === "efectivo"; // pagos viejos sin `via`
}

/**
 * Efectivo que TIENE QUE haber en la caja al cerrar el día.
 *
 * ÚNICA fórmula de la app: la usan el cierre de Caja y el reporte del día. Antes
 * cada pantalla calculaba lo suyo (Reportes ni siquiera restaba los pagos a
 * proveedores) y daban números distintos para el mismo día.
 */
export function efectivoEsperadoDelDia(args: {
  cajaInicial: number;
  ventaEfectivo: number;
  gastos: DailyExpense[];
  pagos: SupplierPayment[];
}): number {
  const gastosEfectivo = args.gastos
    .filter((g) => g.formaPago === "efectivo")
    .reduce((s, g) => s + g.monto, 0);
  const pagosEfectivo = args.pagos
    .filter(pagoUsaEfectivo)
    .reduce((s, p) => s + p.monto, 0);
  // Sin clamp: si da negativo, es que falta plata y hay que verlo, no esconderlo.
  return args.cajaInicial + args.ventaEfectivo - gastosEfectivo - pagosEfectivo;
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
  // ARRASTRE: la plata contada queda como CAJA INICIAL del día siguiente.
  // Sin esto, la caja del día siguiente arrancaba en $0 y el efectivo contado
  // daba siempre "SOBRA" (la plata del día anterior no estaba contemplada).
  // Si depositan esa plata, ajustan la caja inicial a mano.
  const sigRef = doc(db, "cashClosings", dayKey(dayTs + 86_400_000));
  const sigSnap = await getDoc(sigRef);
  if (!sigSnap.exists() || !sigSnap.data()?.cerrado) {
    const sig = new Date(dayTs + 86_400_000);
    sig.setHours(0, 0, 0, 0);
    await setDoc(
      sigRef,
      { fecha: sig.getTime(), cajaInicial: contado },
      { merge: true }
    );
  }

  logActivity("Cerró la caja", {
    detalle: `${fechaDia(dayTs)} · contado ${formatARS(contado)} · dif. ${formatARS(
      contado - input.efectivoEsperado
    )}`,
    entidad: "caja",
    entidadId: dayKey(dayTs),
  });
}

/**
 * Guarda el arqueo EN PROGRESO (autosave). Sin esto, los billetes vivían solo
 * en memoria y se perdían al cambiar de pestaña o recargar → la caja se cerraba
 * en $0. No marca la caja como cerrada.
 */
export async function guardarArqueoParcial(
  dayTs: number,
  arqueo: Record<string, number>
): Promise<void> {
  const d = new Date(dayTs);
  d.setHours(0, 0, 0, 0);
  await setDoc(
    doc(db, "cashClosings", dayKey(dayTs)),
    { fecha: d.getTime(), arqueo },
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
  logActivity("Reabrió la caja", {
    detalle: fechaDia(dayTs),
    entidad: "caja",
    entidadId: dayKey(dayTs),
  });
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
