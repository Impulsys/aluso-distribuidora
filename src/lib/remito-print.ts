// Remito en HOJA A4, listo para imprimir o guardar como PDF con el navegador.
// (Antes salía en ticket de 80mm porque venía de Los Amigos; ALUSO usa A4.)
import type { Envio, Remito } from "./types";
import { LOGISTICA_POR_EAN } from "@/data/logistica";
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

/** Bultos de un renglón: cuántas cajas completas son esas unidades. `null` si el
 *  producto no tiene datos de paquetería cargados (no se inventa un número). */
function bultosDe(productId: string, cantidad: number): number | null {
  const d = LOGISTICA_POR_EAN[productId];
  const paq = d?.paqPorBulto || 0;
  return paq > 0 ? Math.ceil(cantidad / paq) : null;
}

/**
 * HOJA DE ARMADO del envío: una sola hoja para el depósito con TODOS los pedidos
 * del envío. Cada pedido palletizado es su propio pallet (no se surte con otro);
 * los "a granel" van listados aparte. Sin precios. Con casilleros para tildar.
 */
export function hojaArmadoHTML(envio: Envio, remitos: Remito[]): string {
  const palletizados = remitos.filter((r) => r.modoDespacho !== "granel");
  const granel = remitos.filter((r) => r.modoDespacho === "granel");

  const tabla = (r: Remito) => {
    const filas = r.items
      .map((it) => {
        const cod = it.codigo
          ? `<span class="cod">${esc(it.codigo)}</span><br>`
          : "";
        const b = bultosDe(it.productId, it.cantidad);
        return `
        <tr>
          <td style="width:30px;text-align:center;color:#889">☐</td>
          <td>${cod}${esc(it.nombre)}</td>
          <td class="num" style="font-weight:700">${it.cantidad}</td>
          <td class="num">${b ?? "—"}</td>
        </tr>`;
      })
      .join("");
    return `
    <table>
      <thead>
        <tr>
          <th style="width:30px">✓</th>
          <th>Descripción</th>
          <th class="num">Unid.</th>
          <th class="num">Bultos</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
  };

  const bloquesPallet = palletizados
    .map(
      (r, i) => `
    <div class="bloque">
      <div class="bloque-tit">
        <span class="pill">📦 Pallet ${i + 1}</span>
        ${esc(r.numero)} · <b>${esc(r.clienteNombre || "Consumidor final")}</b>
      </div>
      ${tabla(r)}
    </div>`
    )
    .join("");

  const bloqueGranel =
    granel.length > 0
      ? `
    <div class="bloque">
      <div class="bloque-tit granel">
        <span class="pill granel">🧺 A granel (sin pallet)</span>
      </div>
      ${granel
        .map(
          (r) => `
        <div class="bloque-tit" style="border:none;margin-top:6px">
          ${esc(r.numero)} · <b>${esc(r.clienteNombre || "Consumidor final")}</b>
        </div>
        ${tabla(r)}`
        )
        .join("")}
    </div>`
      : "";

  const extraCss = `
    .bloque { margin-top: 14px; page-break-inside: avoid; }
    .bloque-tit { font-size: 14px; padding: 6px 0; border-bottom: 2px solid #0a5b7a; margin-bottom: 4px; }
    .bloque-tit.granel { border-color: #c2740a; }
    .pill { display:inline-block; background:#0a5b7a; color:#fff; font-weight:700; font-size:12px;
            padding:2px 8px; border-radius:10px; margin-right:6px; }
    .pill.granel { background:#c2740a; }`;

  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}
    <div class="doc-head">
      <span class="tipo">HOJA DE ARMADO</span>
      <div style="text-align:right">
        <div class="nro">${fechaCorta(envio.fecha)}</div>
        <div class="fecha">${esc(envio.transporte)}</div>
      </div>
    </div>
    <div class="cliente">
      <div><span class="lbl">Pedidos:</span> ${remitos.length}</div>
      <div><span class="lbl">Pallets:</span> ${palletizados.length}${
        granel.length ? ` · ${granel.length} a granel` : ""
      }</div>
    </div>
    ${bloquesPallet}
    ${bloqueGranel}
    <div class="firma">
      <div class="linea">Armó</div>
      <div class="linea">Controló</div>
    </div>
    <p class="nota">
      Documento interno de armado del envío. No es remito ni factura. Sin valores.
    </p>
  </div>
  <style>${extraCss}</style>`;
  return a4Shell(`Hoja de armado ${fechaCorta(envio.fecha)}`, body);
}

/** Abre la ventana del remito, lista para imprimir o guardar como PDF. */
export function printRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}

/** Igual que printRemito (se mantiene por compatibilidad). */
export function openRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}
