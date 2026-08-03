// Remito en HOJA A4, listo para imprimir o guardar como PDF con el navegador.
// (Antes salía en ticket de 80mm porque venía de Los Amigos; ALUSO usa A4.)
import type { Remito } from "./types";
import {
  ars,
  esc,
  fechaCorta,
  horaCorta,
  a4Header,
  a4Toolbar,
  a4Shell,
  abrirA4,
} from "./a4";

function itemsHTML(r: Remito): string {
  return r.items
    .map((it) => {
      const cod = it.codigo ? `<span class="cod">${esc(it.codigo)}</span><br>` : "";
      return `
      <tr>
        <td>${cod}${esc(it.nombre)}</td>
        <td class="num">${it.cantidad}</td>
        <td class="num">${ars(it.precioVenta)}</td>
        <td class="num">${ars(it.precioVenta * it.cantidad)}</td>
      </tr>`;
    })
    .join("");
}

function totalesHTML(r: Remito): string {
  const hayDesc = r.descuentos && r.descuentos.length > 0;
  const filasDesc = hayDesc
    ? `<div class="row"><span>Subtotal</span><span>${ars(
        r.subtotal ?? r.total
      )}</span></div>` +
      r.descuentos!
        .map(
          (d) =>
            `<div class="row desc"><span>${esc(d.concepto)} (${d.pct}%)</span><span>${ars(
              d.monto
            )}</span></div>`
        )
        .join("")
    : "";
  return `
  <div class="totales">
    ${filasDesc}
    <div class="row total"><span>TOTAL</span><span>${ars(r.total)}</span></div>
  </div>`;
}

export function remitoHTML(r: Remito): string {
  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}

    <div class="doc-head">
      <span class="tipo">REMITO</span>
      <div style="text-align:right">
        <div class="nro">N° ${esc(r.numero)}</div>
        <div class="fecha">${fechaCorta(r.fecha)} · ${horaCorta(r.fecha)}</div>
      </div>
    </div>

    <div class="cliente">
      <div><span class="lbl">Cliente:</span> ${esc(
        r.clienteNombre || "Consumidor final"
      )}</div>
      <div><span class="lbl">CUIT:</span> ${esc(r.clienteCuit || "—")}</div>
      <div><span class="lbl">Forma de pago:</span> ${esc(
        r.formaPago || "—"
      )}</div>
      <div><span class="lbl">Comprobante:</span> ${esc(r.numero)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="num">Cant.</th>
          <th class="num">P. Unitario</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHTML(r)}</tbody>
    </table>

    ${totalesHTML(r)}

    <div class="firma">
      <div class="linea">Entregó</div>
      <div class="linea">Recibí conforme</div>
    </div>

    <p class="nota">
      Documento no válido como factura. Comprobante de entrega de mercadería.
    </p>
  </div>`;
  return a4Shell(`Remito ${r.numero}`, body);
}

/**
 * PROFORMA: el mismo remito pero SIN PRECIOS, para que el depósito arme el
 * pedido sin ver importes (pedido de Luciano). Solo código, descripción y
 * cantidad, con un casillero para tildar lo armado.
 */
export function proformaHTML(r: Remito): string {
  const items = r.items
    .map((it) => {
      const cod = it.codigo ? `<span class="cod">${esc(it.codigo)}</span><br>` : "";
      return `
      <tr>
        <td style="width:34px;text-align:center;color:#889">☐</td>
        <td>${cod}${esc(it.nombre)}</td>
        <td class="num" style="font-size:15px;font-weight:700">${it.cantidad}</td>
      </tr>`;
    })
    .join("");

  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}
    <div class="doc-head">
      <span class="tipo">ORDEN DE ARMADO</span>
      <div style="text-align:right">
        <div class="nro">N° ${esc(r.numero)}</div>
        <div class="fecha">${fechaCorta(r.fecha)}</div>
      </div>
    </div>
    <div class="cliente">
      <div><span class="lbl">Cliente:</span> ${esc(
        r.clienteNombre || "Consumidor final"
      )}</div>
      <div><span class="lbl">Pedido:</span> ${esc(r.numero)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:34px">✓</th>
          <th>Descripción</th>
          <th class="num">Cantidad</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <div class="firma">
      <div class="linea">Armó el pedido</div>
      <div class="linea">Controló</div>
    </div>
    <p class="nota">
      Documento interno de armado. No es remito ni factura. Sin valores.
    </p>
  </div>`;
  return a4Shell(`Proforma ${r.numero}`, body);
}

/** Abre la ventana del remito, lista para imprimir o guardar como PDF. */
export function printRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}

/** Igual que printRemito (se mantiene por compatibilidad). */
export function openRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}
