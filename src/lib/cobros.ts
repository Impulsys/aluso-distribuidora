/**
 * Cobros / Cuenta corriente de clientes.
 *
 * ALUSO fía: entrega el remito y el cliente paga después. Mientras un remito no
 * esté COBRADO cuenta como deuda del cliente. Al registrar el cobro se marca el
 * remito con `cobrado:true` y `fechaCobro` = cuándo entró la plata.
 *
 * Esa fecha es la que manda para la comisión del vendedor: la comisión se paga
 * sobre lo COBRADO en el período, no sobre lo vendido. Si vendió el 30 y se
 * cobró el 12 del mes siguiente, esa comisión cae en el mes siguiente.
 *
 * Este módulo es PURO (no lee Firestore ni toca UI): solo calcula deuda a partir
 * de los remitos. Las escrituras que marcan/desmarcan el cobro viven en
 * `ventas.ts` (marcarCobrado / desmarcarCobrado), porque ahí está el acceso a
 * Firestore y la bitácora.
 */
import type { Cliente, Remito } from "./types";

/** Un remito cuenta como venta viva si no está anulado. */
function esVentaViva(r: Remito): boolean {
  return !r.anulado;
}

/**
 * ¿El pedido ya se ENTREGÓ? La deuda del cliente arranca cuando se entrega, no
 * cuando se hace el remito (pedido de Anabela).
 *  - Venta directa del local (sin envío asignado): se entrega en el momento → sí.
 *  - Venta con flete: cuenta recién cuando el envío se marca "entregado".
 * `estadoLogistica` ausente = venta directa; "entregado" = despachado y entregado.
 * Cualquier otro estado (pendiente/asignado/preparación/listo) = todavía no.
 */
export function esEntregado(r: Remito): boolean {
  return r.estadoLogistica == null || r.estadoLogistica === "entregado";
}

/** Un remito pesa como deuda si es venta viva y NO está cobrado. */
export function esDeuda(r: Remito): boolean {
  return esVentaViva(r) && !r.cobrado;
}

export interface SaldoCliente {
  clienteId: string;
  nombre: string;
  /** Total facturado vivo (cobrado + pendiente). */
  vendido: number;
  cobrado: number;
  /** Lo que debe: vendido - cobrado. */
  deuda: number;
  /** Cantidad de remitos pendientes de cobro. */
  pendientes: number;
  /** Fecha del remito impago más viejo (para ver quién está atrasado). */
  masViejoPendiente?: number;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Total del remito NETO de devoluciones: lo que realmente debe el cliente. */
export function totalNetoRemito(r: Remito): number {
  const devuelto = (r.devoluciones ?? []).reduce((s, d) => s + (d.monto || 0), 0);
  return r2(Math.max(0, r.total - devuelto));
}

/**
 * Deuda por cliente a partir de los remitos. Agrupa por `clienteId` (o, si el
 * remito viejo no tiene id, por nombre normalizado). Devuelve solo clientes con
 * movimiento, ordenados por deuda descendente.
 */
export function deudaPorCliente(
  remitos: Remito[],
  clientes: Cliente[] = []
): SaldoCliente[] {
  const nombrePorId = new Map(clientes.map((c) => [c.id, c.nombre]));
  const acc = new Map<string, SaldoCliente>();

  for (const r of remitos) {
    if (!esVentaViva(r)) continue;
    // La deuda cuenta desde la ENTREGA: un pedido con flete que todavía no se
    // entregó no pesa como deuda hasta que se marca el envío como entregado.
    if (!esEntregado(r)) continue;
    // Clave: id del CRM si lo hay; si no, el nombre (remitos previos al CRM).
    const key = r.clienteId || `nombre:${(r.clienteNombre || "").trim().toLowerCase()}`;
    if (key === "nombre:") continue; // venta sin cliente identificable: no es cta cte
    const nombre =
      (r.clienteId && nombrePorId.get(r.clienteId)) ||
      r.clienteNombre ||
      "Sin nombre";

    const cur =
      acc.get(key) ??
      ({
        clienteId: r.clienteId || key,
        nombre,
        vendido: 0,
        cobrado: 0,
        deuda: 0,
        pendientes: 0,
      } as SaldoCliente);

    const totalRemito = totalNetoRemito(r); // descuenta devoluciones
    cur.vendido = r2(cur.vendido + totalRemito);
    if (r.cobrado) {
      cur.cobrado = r2(cur.cobrado + totalRemito);
    } else {
      cur.pendientes += 1;
      if (cur.masViejoPendiente == null || r.fecha < cur.masViejoPendiente) {
        cur.masViejoPendiente = r.fecha;
      }
    }
    cur.deuda = r2(cur.vendido - cur.cobrado);
    acc.set(key, cur);
  }

  return [...acc.values()].sort((a, b) => b.deuda - a.deuda);
}
