// Reporte diario de caja en HOJA A4 (imprimir / guardar PDF con el navegador).
import { ars, esc, fechaCorta, a4Header, a4Doc, abrirA4 } from "./a4";

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
  const row = (l: string, v: number, cls = "") =>
    `<div class="row ${cls}"><span>${esc(l)}</span><span>${ars(v)}</span></div>`;

  const inner = `
    ${a4Header()}

    <div class="doc-head">
      <span class="tipo">REPORTE DE CAJA</span>
      <div style="text-align:right">
        <div class="nro">${fechaCorta(d.fecha)}</div>
        <div class="fecha">${d.cerrado ? "CERRADA" : "Abierta"}${
    d.cerrado && d.cerradoPor ? ` · cerró ${esc(d.cerradoPor)}` : ""
  }</div>
      </div>
    </div>

    <div class="bloques">
      <div class="bloque">
        <h3>Ventas</h3>
        ${row("Total ventas", d.ventas, "fuerte")}
        ${row("· Efectivo", d.ventaEfectivo)}
        ${row("· Transferencia", d.ventaTransfer)}
        ${d.ventaCheque > 0 ? row("· Cheque", d.ventaCheque) : ""}
      </div>

      <div class="bloque">
        <h3>Egresos del día</h3>
        ${row("Gastos", -d.gastosTotal)}
        ${row("Pagos a proveedores", -d.pagosTotal)}
        ${row("Disponible", d.disponible, "fuerte")}
      </div>
    </div>

    <div class="totales" style="width:60%;">
      <h3 style="margin:0 0 6px; color:#0a5b7a; font-size:13px;">Cierre</h3>
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
    </div>

    <p class="nota">Generado el ${fechaCorta(Date.now())}</p>`;

  return a4Doc("Reporte de caja", inner, opts);
}

export function printReporteCaja(d: ReporteCajaData): void {
  abrirA4(reporteCajaHTML(d, { autoprint: true }));
}
