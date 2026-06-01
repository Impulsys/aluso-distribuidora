// Genera el documento imprimible (institucional) de un remito y lo manda a
// imprimir en una ventana aparte (el usuario elige "Imprimir" o "Guardar PDF").
import type { Remito } from "./types";

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

export function remitoHTML(r: Remito, opts: { autoprint?: boolean } = {}): string {
  const filas = r.items
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

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Remito ${esc(r.numero)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
         border-bottom: 3px solid #006081; padding-bottom: 16px; }
  .empresa h1 { margin: 0; font-size: 22px; color: #006081; }
  .empresa p { margin: 2px 0; font-size: 12px; color: #64748b; }
  .doc { text-align: right; }
  .doc .tag { display: inline-block; border: 2px solid #006081; color: #006081;
              border-radius: 8px; padding: 6px 18px; font-size: 20px; font-weight: 700;
              letter-spacing: 2px; }
  .doc .num { margin-top: 8px; font-size: 16px; font-weight: 700; }
  .doc .fecha { font-size: 12px; color: #64748b; }
  .cliente { margin: 18px 0 8px; font-size: 14px; }
  .cliente b { color: #006081; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;
          table-layout: fixed; }
  thead th { background: #006081; color: #fff; padding: 8px 10px; text-align: left;
             font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
             white-space: nowrap; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0;
             vertical-align: top; }
  /* Números: no se parten (el $ queda pegado al importe) */
  thead th.r, tbody td.r { text-align: right; white-space: nowrap; }
  thead th.c, tbody td.c { text-align: center; white-space: nowrap; }
  /* Anchos de columna: la descripción ocupa el resto */
  th.c, td.c { width: 56px; }
  th.r, td.r { width: 110px; }
  thead th:nth-child(2), tbody td:nth-child(2) { width: auto; white-space: normal; }
  tbody tr.alt { background: #f8fafc; }
  .total { display: flex; justify-content: flex-end; margin-top: 12px; }
  .total .box { min-width: 240px; background: #f0f9ff; border: 1px solid #bae6fd;
                border-radius: 10px; padding: 10px 16px; display: flex;
                justify-content: space-between; align-items: center; }
  .total .box .lbl { font-weight: 700; color: #006081; }
  .total .box .val { font-size: 22px; font-weight: 800; color: #006081; }
  .firmas { display: flex; justify-content: space-between; margin-top: 56px; gap: 40px; }
  .firmas div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px;
                text-align: center; font-size: 11px; color: #64748b; }
  .nota { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; }
  .toolbar { position: fixed; top: 10px; right: 10px; display: flex; gap: 8px; }
  .toolbar button { cursor: pointer; border: 0; border-radius: 8px; padding: 8px 14px;
                    font-size: 13px; font-weight: 700; }
  .toolbar .pr { background: #006081; color: #fff; }
  .toolbar .cl { background: #e2e8f0; color: #1e293b; }
  @media print { .toolbar { display: none !important; } }
</style></head>
<body>
  <div class="toolbar">
    <button class="pr" onclick="window.print()">🖨️ Imprimir / PDF</button>
    <button class="cl" onclick="window.close()">Cerrar</button>
  </div>
  <div class="wrap">
  <div class="top">
    <div class="empresa">
      <h1>${EMPRESA.nombre}</h1>
      <p>${EMPRESA.subtitulo}</p>
      <p>Tel: ${EMPRESA.tel} · ${EMPRESA.email}</p>
    </div>
    <div class="doc">
      <span class="tag">REMITO</span>
      <div class="num">N° ${esc(r.numero)}</div>
      <div class="fecha">Fecha: ${fecha(r.fecha)}</div>
    </div>
  </div>

  <p class="cliente"><b>Cliente:</b> ${esc(r.clienteNombre || "Consumidor final")}</p>
  ${
    r.formaPago
      ? `<p class="cliente" style="margin-top:0;font-size:12px;color:#64748b;"><b>Forma de pago:</b> ${esc(r.formaPago)}</p>`
      : ""
  }

  <table>
    <thead><tr>
      <th class="c">Cant.</th><th>Descripción</th>
      <th class="r">P. unit.</th><th class="r">Subtotal</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="total"><div class="box">
    <span class="lbl">TOTAL</span><span class="val">${ars(r.total)}</span>
  </div></div>

  <div class="firmas">
    <div>Firma y aclaración</div>
    <div>Recibí conforme</div>
  </div>

  <p class="nota">Documento no válido como factura. Comprobante de entrega de mercadería.</p>
</div>
${
  opts.autoprint
    ? `<script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>`
    : ""
}
</body></html>`;
}

function abrirDoc(html: string): void {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

/** Abre la ventana del remito y dispara el diálogo de impresión. */
export function printRemito(r: Remito): void {
  abrirDoc(remitoHTML(r, { autoprint: true }));
}

/** Abre el remito para verlo (sin forzar impresión; tiene botón Imprimir). */
export function openRemito(r: Remito): void {
  abrirDoc(remitoHTML(r, { autoprint: false }));
}
