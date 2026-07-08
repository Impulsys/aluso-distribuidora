// Remito en ticket de 80mm (impresora térmica). Imprime ORIGINAL y, opcional,
// DUPLICADO. Ítems con "código - nombre". PDF = botón "Guardar como PDF".
import type { Remito } from "./types";
import {
  ars,
  esc,
  fechaCorta,
  horaCorta,
  ticketHeader,
  ticketShell,
  abrirTicket,
} from "./ticket";

function itemsHTML(r: Remito): string {
  return r.items
    .map((it) => {
      const nombre = it.codigo
        ? `${esc(it.codigo)} - ${esc(it.nombre)}`
        : esc(it.nombre);
      return `
      <div class="it">
        <div class="n">${nombre}</div>
        <div class="d">
          <span>Cant. ${it.cantidad} x ${ars(it.precioVenta)}</span>
          <span>${ars(it.precioVenta * it.cantidad)}</span>
        </div>
      </div>`;
    })
    .join("");
}

/** Una copia del remito con su etiqueta (ORIGINAL / DUPLICADO). */
function copia(r: Remito, etiqueta: string): string {
  return `
  ${ticketHeader()}
  <div class="doc">REMITO ${esc(r.numero)}</div>
  <div class="copia">${etiqueta}</div>
  <div class="row small"><span>Fecha</span><span>${fechaCorta(
    r.fecha
  )} ${horaCorta(r.fecha)}</span></div>
  <div class="row small"><span>Cliente</span><span>${esc(
    r.clienteNombre || "Consumidor final"
  )}</span></div>
  <div class="row small"><span>Domicilio</span><span>&nbsp;</span></div>
  ${
    r.formaPago
      ? `<div class="row small"><span>Forma de pago</span><span>${esc(
          r.formaPago
        )}</span></div>`
      : ""
  }
  <div class="hr"></div>
  <div class="row" style="font-weight:800;"><span>Descripción</span><span>Subtotal</span></div>
  <div class="hr"></div>
  ${itemsHTML(r)}
  <div class="hr"></div>
  <div class="row total"><span>TOTAL</span><span>${ars(r.total)}</span></div>
  <div class="firma">Recibí conforme</div>
  <p class="nota">Documento no válido como factura. Comprobante de entrega de mercadería.</p>`;
}

/** HTML del remito: ORIGINAL + DUPLICADO (el duplicado se oculta si elegís "solo original"). */
export function remitoHTML(r: Remito): string {
  const body = `
  <div class="toolbar">
    <button class="pr" onclick="printCopias(2)">🖨️ Original + Duplicado</button>
    <button class="pr" onclick="printCopias(1)">Solo original</button>
    <button class="cl" onclick="window.close()">Cerrar</button>
  </div>
  ${copia(r, "ORIGINAL")}
  <div class="pagebreak copia-dup">${copia(r, "DUPLICADO")}</div>
  <script>
    function printCopias(n){
      document.body.classList.toggle('solo-original', n===1);
      setTimeout(function(){ window.print(); }, 60);
    }
  </script>`;
  return ticketShell(`Remito ${r.numero}`, body);
}

/** Abre la ventana del remito (el usuario elige Original o Original+Duplicado). */
export function printRemito(r: Remito): void {
  abrirTicket(remitoHTML(r));
}

/** Igual que printRemito (se mantiene por compatibilidad). */
export function openRemito(r: Remito): void {
  abrirTicket(remitoHTML(r));
}
