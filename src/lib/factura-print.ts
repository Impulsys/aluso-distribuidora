// Factura en ticket de 80mm (impresora térmica). Lleva tipo A/B, neto/IVA
// (en A discriminado) y, si está emitida en AFIP, el CAE + QR oficial.
import * as QRCode from "qrcode";
import type { Factura } from "./types";
import { ars, esc, fechaCorta, ticketDoc, ticketHeader, abrirTicket } from "./ticket";

/** "YYYYMMDD" (formato AFIP) → "DD/MM/AAAA". */
function fmtCaeVto(s?: string | null): string {
  if (!s || s.length !== 8) return s ?? "";
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function facturaHTML(
  f: Factura,
  opts: { autoprint?: boolean; qrDataUrl?: string } = {}
): string {
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
    ? `<div class="row small"><span>CAE</span><span>${esc(f.cae)}</span></div>
       <div class="row small"><span>Vto CAE</span><span>${fmtCaeVto(
         f.caeVto
       )}</span></div>`
    : `<p class="nota">Comprobante interno · pendiente de CAE (AFIP)</p>`;

  // QR oficial (solo si está emitida y la verificación no dio mismatch)
  const qr =
    opts.qrDataUrl && f.verification !== "mismatch"
      ? `<div class="center" style="margin-top:8px;">
           <img src="${opts.qrDataUrl}" alt="QR AFIP" style="width:150px;height:150px;" />
         </div>`
      : "";

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
  ${qr}
  <p class="nota">${
    f.cae
      ? "Comprobante autorizado por AFIP."
      : "Documento interno (sin CAE)."
  }</p>`;

  return ticketDoc(`Factura ${f.tipo} ${f.numero || ""}`, inner, opts);
}

/** Genera el data-URL del QR (o "" si no hay). */
async function qrDataUrl(f: Factura): Promise<string> {
  if (!f.qrUrl) return "";
  try {
    return await QRCode.toDataURL(f.qrUrl, { margin: 1, width: 300 });
  } catch {
    return "";
  }
}

/** Abre la factura y dispara impresión. La ventana se abre YA (gesto del click). */
export async function printFactura(f: Factura): Promise<void> {
  const w = window.open("", "_blank", "width=380,height=720");
  const qr = await qrDataUrl(f);
  const html = facturaHTML(f, { autoprint: true, qrDataUrl: qr });
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
  } else {
    abrirTicket(html);
  }
}

/** Abre la factura para verla (sin forzar impresión). */
export async function openFactura(f: Factura): Promise<void> {
  const w = window.open("", "_blank", "width=380,height=720");
  const qr = await qrDataUrl(f);
  const html = facturaHTML(f, { autoprint: false, qrDataUrl: qr });
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
  } else {
    abrirTicket(html);
  }
}
