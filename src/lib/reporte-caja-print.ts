// Reporte diario de caja en ticket de 80mm (se imprime en la térmica de la caja).
import { ars, esc, fechaCorta, ticketDoc, ticketHeader, abrirTicket } from "./ticket";

export interface ReporteCajaData {
  fecha: number;
  ventas: number;
  ventaEfectivo: number;
  ventaTransfer: number;
  ventaCheque: number;
  gastosTotal: number;
  pagosTotal: number;
  disponible: number;
  cajaInicial: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferencia: number | null;
  cerrado: boolean;
  cerradoPor?: string;
}

export function reporteCajaHTML(
  d: ReporteCajaData,
  opts: { autoprint?: boolean } = {}
): string {
  const row = (l: string, v: number) =>
    `<div class="row small"><span>${esc(l)}</span><span>${ars(v)}</span></div>`;

  const inner = `
  ${ticketHeader()}
  <div class="doc">REPORTE DE CAJA</div>
  <div class="row small"><span>Fecha</span><span>${fechaCorta(d.fecha)}</span></div>
  <div class="row small"><span>Estado</span><span>${
    d.cerrado ? "CERRADA" : "Abierta"
  }</span></div>
  ${
    d.cerrado && d.cerradoPor
      ? `<div class="row small"><span>Cerró</span><span>${esc(
          d.cerradoPor
        )}</span></div>`
      : ""
  }
  <div class="hr"></div>
  <div class="n">VENTAS</div>
  ${row("Total ventas", d.ventas)}
  ${row("· Efectivo", d.ventaEfectivo)}
  ${row("· Transferencia", d.ventaTransfer)}
  ${d.ventaCheque > 0 ? row("· Cheque", d.ventaCheque) : ""}
  <div class="hr"></div>
  ${row("Egresos", -d.gastosTotal)}
  ${row("Pagos a proveedores", -d.pagosTotal)}
  <div class="row total"><span>Disponible</span><span>${ars(d.disponible)}</span></div>
  <div class="hr"></div>
  <div class="n">CIERRE</div>
  ${row("Caja inicial", d.cajaInicial)}
  ${row("Efectivo esperado", d.efectivoEsperado)}
  ${d.efectivoContado != null ? row("Efectivo contado", d.efectivoContado) : ""}
  ${
    d.diferencia != null
      ? `<div class="row total"><span>Diferencia</span><span>${ars(
          d.diferencia
        )}</span></div>`
      : ""
  }
  <p class="nota">Generado el ${fechaCorta(Date.now())}</p>`;

  return ticketDoc("Reporte de caja", inner, opts);
}

export function printReporteCaja(d: ReporteCajaData): void {
  abrirTicket(reporteCajaHTML(d, { autoprint: true }));
}
