/**
 * Saldo de la cuenta corriente de un fletero. Módulo PURO (no toca Firestore ni
 * UI): las escrituras están en lib/fletes.ts.
 *
 * Regla: saldo = cargos − pagos. El `cargo` es un flete que el fletero te cobró
 * (deuda tuya); el `pago` es lo que le pagaste. No se usa max(0): si le pagaste
 * de más, el saldo queda NEGATIVO (a favor tuyo) y se ve — no se tapa.
 */
import type { Fletero, MovimientoFlete } from "./types";

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface SaldoFletero {
  fleteroId: string;
  cargos: number; // total que te cobraron
  pagos: number; // total que le pagaste
  saldo: number; // lo que le debés (cargos − pagos)
  movimientos: number; // cantidad de movimientos
}

/** Saldo de UN fletero a partir de sus movimientos. */
export function saldoFletero(
  fleteroId: string,
  movs: MovimientoFlete[]
): SaldoFletero {
  let cargos = 0;
  let pagos = 0;
  let n = 0;
  for (const m of movs) {
    if (m.fleteroId !== fleteroId) continue;
    n += 1;
    if (m.tipo === "cargo") cargos += m.monto;
    else pagos += m.monto;
  }
  return {
    fleteroId,
    cargos: r2(cargos),
    pagos: r2(pagos),
    saldo: r2(cargos - pagos),
    movimientos: n,
  };
}

/** Saldo de cada fletero (para el listado). Ordena por deuda descendente. */
export function saldosPorFletero(
  fleteros: Fletero[],
  movs: MovimientoFlete[]
): (SaldoFletero & { nombre: string })[] {
  return fleteros
    .map((f) => ({ ...saldoFletero(f.id, movs), nombre: f.nombre }))
    .sort((a, b) => b.saldo - a.saldo);
}

/** Deuda total con todos los fletes (suma de saldos positivos y negativos). */
export function deudaTotalFletes(
  fleteros: Fletero[],
  movs: MovimientoFlete[]
): number {
  return r2(
    saldosPorFletero(fleteros, movs).reduce((s, f) => s + f.saldo, 0)
  );
}
