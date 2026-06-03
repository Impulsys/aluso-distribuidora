// Factura en ticket de 80mm (impresora térmica). Lleva tipo A/B/C y, en A,
// neto/IVA discriminado. PDF = "Guardar como PDF".
import type { Factura } from "./types";
import {
  ars,
  esc,
  fechaCorta,
  ticketDoc,
  ticketHeader,
  abrirTicket,
} from "./ticket";

export function facturaHTML(f: Factura, opts: { autoprint?: boolean } = {}): string {
  const items = f.items
    .map(
      (it) => `
      <div class="it">
        <div class="n">${esc(it.nombre)}</div>
        <div class="d">
          <span>${it.cantidad} x ${ars(it.precioVenta)}</span>
          <span>${ars(it.precioVenta * it.cantidad)}</span>
        </div>
      </div>`
    )
    .join("");

  const totales =
    f.tipo === "A"
      ? `<div class="row small"><span>Neto gravado</span><span>${ars(
          f.neto
        )}</span></div>
         <div class="row small"><span>IVA 21%</span><span>${ars(f.iva)}</span></div>
         <div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>`
      : `<div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>`;

  const cliente = f.consumidorFinal
    ? "Consumidor Final"
    : `${esc(f.razonSocial || "—")}${f.cuit ? ` · CUIT ${esc(f.cuit)}` : ""}`;

  const cae = f.cae
    ? `<div class="row small"><span>CAE</span><span>${esc(f.cae)}</span></div>${
        f.caeVto
          ? `<div class="row small"><span>Vto CAE</span><span>${fechaCorta(
              f.caeVto
            )}</span></div>`
          : ""
      }`
    : `<p class="nota">Comprobante interno · pendiente de CAE (AFIP)</p>`;

  const nro = f.numero ? `N° ${esc(f.numero)}` : "Interno";

  const inner = `
  ${ticketHeader()}
  <div class="doc">FACTURA ${esc(f.tipo)} · ${nro}</div>
  <div class="row small"><span>Fecha</span><span>${fechaCorta(f.fecha)}</span></div>
  <div class="row small"><span>Cliente</span><span>${cliente}</span></div>
  <div class="row small"><span>Remito</span><span>${esc(f.remitoNumero)}</span></div>
  <div class="hr"></div>
  ${items}
  <div class="hr"></div>
  ${totales}
  <div class="hr"></div>
  ${cae}
  <p class="nota">${
    f.cae
      ? "Comprobante autorizado por AFIP."
      : "Documento interno. La emisión electrónica AFIP se habilita más adelante."
  }</p>`;

  return ticketDoc(`Factura ${f.tipo} ${f.numero || ""}`, inner, opts);
}

/** Abre la ventana de la factura y dispara el diálogo de impresión. */
export function printFactura(f: Factura): void {
  abrirTicket(facturaHTML(f, { autoprint: true }));
}

/** Abre la factura para verla (sin forzar impresión). */
export function openFactura(f: Factura): void {
  abrirTicket(facturaHTML(f, { autoprint: false }));
}
