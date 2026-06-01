// Documento imprimible (institucional) de una FACTURA. Distinto del remito:
// lleva tipo (A/B/C), neto/IVA discriminado y, cuando AFIP esté activo, el CAE.
import type { Factura } from "./types";

const EMPRESA = {
  nombre: "Distribuidora Los Amigos",
  subtitulo: "NOA · Distribuidora mayorista",
  tel: "+54 9 11 2759-7572",
  email: "distribuidoralosamigosnoa@gmail.com",
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function ars(n: number): string {
  return "$ " + (n || 0).toLocaleString("es-AR");
}
function fecha(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function facturaHTML(f: Factura): string {
  const filas = f.items
    .map(
      (it, i) => `
      <tr class="${i % 2 ? "alt" : ""}">
        <td class="c">${it.cantidad}</td>
        <td>${esc(it.nombre)}</td>
        <td class="r">${ars(it.precioVenta)}</td>
        <td class="r">${ars(it.precioVenta * it.cantidad)}</td>
      </tr>`
    )
    .join("");

  // Totales: la A discrimina IVA; B/C van con total final.
  const totales =
    f.tipo === "A"
      ? `
      <div class="row"><span>Neto gravado</span><span>${ars(f.neto)}</span></div>
      <div class="row"><span>IVA 21%</span><span>${ars(f.iva)}</span></div>
      <div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>`
      : `<div class="row total"><span>TOTAL</span><span>${ars(f.total)}</span></div>`;

  const cliente = f.consumidorFinal
    ? "Consumidor Final"
    : `${esc(f.razonSocial || "—")}${f.cuit ? ` · CUIT ${esc(f.cuit)}` : ""}`;

  const cae = f.cae
    ? `<div class="cae"><b>CAE:</b> ${esc(f.cae)}${
        f.caeVto ? ` · <b>Vto:</b> ${fecha(f.caeVto)}` : ""
      }</div>`
    : `<div class="cae pend">Comprobante interno · pendiente de CAE (AFIP)</div>`;

  const nro = f.numero ? `N° ${esc(f.numero)}` : "Comprobante interno";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Factura ${esc(f.tipo)} ${esc(f.numero || "")}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
         border-bottom: 3px solid #006081; padding-bottom: 16px; position: relative; }
  .empresa h1 { margin: 0; font-size: 22px; color: #006081; }
  .empresa p { margin: 2px 0; font-size: 12px; color: #64748b; }
  .doc { text-align: right; }
  .doc .tipo { display: inline-block; border: 2px solid #006081; color: #006081;
               border-radius: 8px; width: 54px; height: 54px; line-height: 50px;
               font-size: 30px; font-weight: 800; text-align: center; }
  .doc .lbl { font-size: 11px; color: #64748b; letter-spacing: 1px; }
  .doc .num { margin-top: 6px; font-size: 15px; font-weight: 700; }
  .doc .fecha { font-size: 12px; color: #64748b; }
  .cliente { margin: 18px 0 8px; font-size: 14px; }
  .cliente b { color: #006081; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;
          table-layout: fixed; }
  thead th { background: #006081; color: #fff; padding: 8px 10px; text-align: left;
             font-size: 11px; text-transform: uppercase; white-space: nowrap; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th.r, td.r { text-align: right; white-space: nowrap; width: 110px; }
  th.c, td.c { text-align: center; white-space: nowrap; width: 56px; }
  thead th:nth-child(2), tbody td:nth-child(2) { width: auto; white-space: normal; }
  tbody tr.alt { background: #f8fafc; }
  .tot { display: flex; justify-content: flex-end; margin-top: 12px; }
  .tot .box { min-width: 280px; }
  .tot .row { display: flex; justify-content: space-between; padding: 4px 16px;
              font-size: 14px; }
  .tot .row.total { margin-top: 4px; border-top: 2px solid #006081; padding-top: 8px;
                    font-weight: 800; color: #006081; font-size: 20px; }
  .cae { margin-top: 20px; padding: 8px 12px; border: 1px dashed #94a3b8;
         border-radius: 8px; font-size: 12px; }
  .cae.pend { color: #b45309; border-color: #fcd34d; background: #fffbeb; }
  .nota { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; }
</style></head>
<body><div class="wrap">
  <div class="top">
    <div class="empresa">
      <h1>${EMPRESA.nombre}</h1>
      <p>${EMPRESA.subtitulo}</p>
      <p>Tel: ${EMPRESA.tel} · ${EMPRESA.email}</p>
    </div>
    <div class="doc">
      <span class="tipo">${esc(f.tipo)}</span>
      <div class="lbl">FACTURA ${esc(f.tipo)}</div>
      <div class="num">${nro}</div>
      <div class="fecha">Fecha: ${fecha(f.fecha)}</div>
    </div>
  </div>

  <p class="cliente"><b>Cliente:</b> ${cliente}</p>
  <p class="cliente" style="margin-top:0;color:#64748b;font-size:12px;">
    Remito asociado: ${esc(f.remitoNumero)}
  </p>

  <table>
    <thead><tr>
      <th class="c">Cant.</th><th>Descripción</th>
      <th class="r">P. unit.</th><th class="r">Subtotal</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="tot"><div class="box">${totales}</div></div>

  ${cae}

  <p class="nota">${
    f.cae
      ? "Comprobante autorizado por AFIP."
      : "Documento interno. La emisión electrónica AFIP se habilita en una etapa siguiente."
  }</p>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
</body></html>`;
}

/** Abre la ventana de impresión de la factura (uso desde un click directo). */
export function printFactura(f: Factura): void {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(facturaHTML(f));
  w.document.close();
  w.focus();
}
