// Factura en HOJA A4 (imprimir / guardar PDF con el navegador). Lleva tipo A/B,
// neto/IVA (en A discriminado) y, si está emitida en AFIP, el CAE + QR oficial.
import * as QRCode from "qrcode";
import type { Factura } from "./types";
import { ars, esc, fechaCorta, a4Header, a4Doc, abrirA4 } from "./a4";

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
      <tr>
        <td>${esc(it.nombre)}</td>
        <td class="num">${it.cantidad}</td>
        <td class="num">${ars(it.precioVenta)}</td>
        <td class="num">${ars(it.precioVenta * it.cantidad)}</td>
      </tr>`
    )
    .join("");

  // Factura A: IVA discriminado (neto + IVA + total).
  // Factura B: NO discrimina, pero la Ley 27.743 (Transparencia Fiscal) obliga a
  // mostrar el IVA CONTENIDO en el precio, informativo, debajo del total (no se
  // suma: el cliente paga el total de arriba) + la leyenda del régimen.
  const totales =
    f.tipo === "A"
      ? `<div class="row"><span>Neto gravado</span><span>${ars(f.neto)}</span></div>
         <div class="row"><span>IVA 21%</span><span>${ars(f.iva)}</span></div>
         <div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>`
      : `<div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>
         <div class="row" style="margin-top:8px;color:#555;font-size:11.5px">
           <span>IVA contenido</span><span>${ars(f.iva)}</span>
         </div>`;

  const leyendaTransparencia =
    f.tipo === "A"
      ? ""
      : `<p style="margin-top:14px;border:1px solid #333;border-radius:6px;padding:6px 10px;font-size:10.5px;font-weight:600;color:#333;text-align:center">
           Régimen de Transparencia Fiscal al Consumidor Final (Ley 27.743)
         </p>`;

  const cliente = f.consumidorFinal
    ? "Consumidor Final"
    : esc(f.razonSocial || "—");
  const cuit = f.consumidorFinal ? "—" : esc(f.cuit || "—");

  const nro = f.numero ? `N° ${esc(f.numero)}` : "Interno";

  const cae = f.cae
    ? `<div class="cae">
         <div><span class="lbl">CAE:</span> <b>${esc(f.cae)}</b></div>
         <div><span class="lbl">Vto. CAE:</span> ${fmtCaeVto(f.caeVto)}</div>
       </div>`
    : `<p class="nota">Comprobante interno · pendiente de CAE (AFIP)</p>`;

  const qr =
    opts.qrDataUrl && f.verification !== "mismatch"
      ? `<img src="${opts.qrDataUrl}" alt="QR AFIP" style="width:120px;height:120px;" />`
      : "";

  const inner = `
    ${a4Header()}

    <div class="doc-head">
      <span class="tipo">FACTURA ${esc(f.tipo)}</span>
      <div style="text-align:right">
        <div class="nro">${nro}</div>
        <div class="fecha">${fechaCorta(f.fecha)}</div>
      </div>
    </div>

    <div class="cliente">
      <div><span class="lbl">Cliente:</span> ${cliente}</div>
      <div><span class="lbl">CUIT:</span> ${cuit}</div>
      <div><span class="lbl">Remito:</span> ${esc(f.remitoNumero)}</div>
      <div><span class="lbl">Condición:</span> ${
        f.consumidorFinal ? "Consumidor Final" : "Responsable Inscripto"
      }</div>
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
      <tbody>${items}</tbody>
    </table>

    <div class="totales">${totales}</div>

    ${leyendaTransparencia}

    <div style="margin-top:24px;text-align:center">
      ${qr ? `<div style="margin-bottom:8px">${qr}</div>` : ""}
      <div style="display:inline-block;text-align:center;font-size:12px;line-height:1.7">${cae}</div>
      <p style="margin-top:8px;font-size:11px;color:#555;font-weight:600">${
        f.cae
          ? "Comprobante autorizado por AFIP"
          : "Documento interno (sin CAE de AFIP)"
      }</p>
    </div>`;

  return a4Doc(`Factura ${f.tipo} ${f.numero || ""}`, inner, opts);
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
  const w = window.open("", "_blank", "width=900,height=1000");
  const qr = await qrDataUrl(f);
  const html = facturaHTML(f, { autoprint: true, qrDataUrl: qr });
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
  } else {
    abrirA4(html);
  }
}

/** Abre la factura para verla (sin forzar impresión). */
export async function openFactura(f: Factura): Promise<void> {
  const w = window.open("", "_blank", "width=900,height=1000");
  const qr = await qrDataUrl(f);
  const html = facturaHTML(f, { autoprint: false, qrDataUrl: qr });
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
  } else {
    abrirA4(html);
  }
}
