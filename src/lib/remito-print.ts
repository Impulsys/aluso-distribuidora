// Remito en ticket de 80mm (impresora térmica). PDF = "Guardar como PDF".
import type { Remito } from "./types";
import {
  ars,
  esc,
  fechaCorta,
  horaCorta,
  ticketDoc,
  ticketHeader,
  abrirTicket,
} from "./ticket";

export function remitoHTML(r: Remito, opts: { autoprint?: boolean } = {}): string {
  const items = r.items
    .map(
      (it) => `
      <div class="it">
        <div class="n">${esc(it.nombre)}</div>
        <div class="d">
          <span>Cant. ${it.cantidad} x ${ars(it.precioVenta)}</span>
          <span>${ars(it.precioVenta * it.cantidad)}</span>
        </div>
      </div>`
    )
    .join("");

  const inner = `
  ${ticketHeader()}
  <div class="doc">REMITO ${esc(r.numero)}</div>
  <div class="row small"><span>Fecha</span><span>${fechaCorta(r.fecha)}</span></div>
  <div class="row small"><span>Hora</span><span>${horaCorta(r.fecha)}</span></div>
  <div class="row small"><span>Cliente</span><span>${esc(
    r.clienteNombre || "Consumidor final"
  )}</span></div>
  ${
    r.formaPago
      ? `<div class="row small"><span>Forma de pago</span><span>${esc(
          r.formaPago
        )}</span></div>`
      : ""
  }
  <div class="hr"></div>
  <div class="row" style="font-weight:700;"><span>Descripción</span><span>Subtotal</span></div>
  ${items}
  <div class="hr"></div>
  <div class="row total"><span>TOTAL</span><span>${ars(r.total)}</span></div>
  <div class="firma">Recibí conforme</div>
  <p class="nota">Documento no válido como factura. Comprobante de entrega de mercadería.</p>`;

  return ticketDoc(`Remito ${r.numero}`, inner, opts);
}

/** Abre la ventana del remito y dispara el diálogo de impresión. */
export function printRemito(r: Remito): void {
  abrirTicket(remitoHTML(r, { autoprint: true }));
}

/** Abre el remito para verlo (sin forzar impresión; tiene botón Imprimir). */
export function openRemito(r: Remito): void {
  abrirTicket(remitoHTML(r, { autoprint: false }));
}
