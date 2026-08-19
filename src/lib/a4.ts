// Base para comprobantes en HOJA A4 (remito, factura, reportes).
// Reemplaza el formato ticket de 80mm: ALUSO imprime en A4 y lo guarda como
// PDF con el navegador (Imprimir → Guardar como PDF). La misma hoja se ve
// igual en pantalla, impresa y en PDF.
import { EMPRESA, esc } from "./ticket";

export { ars, esc, fechaCorta, horaCorta } from "./ticket";

const A4_CSS = `
  * { box-sizing: border-box;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4; margin: 14mm 14mm 16mm; }
  html, body { margin: 0; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1a1f24;
         font-size: 12px; line-height: 1.45; background: #f3f5f7; }
  /* La "hoja" en pantalla. Al imprimir ocupa el A4 real. */
  .hoja { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 16mm 15mm;
          background: #fff; box-shadow: 0 3px 18px rgba(0,0,0,.12); }

  /* --- Membrete --- */
  .encabezado { display: flex; justify-content: space-between; align-items: flex-start;
                border-bottom: 3px solid #0a5b7a; padding-bottom: 12px; gap: 20px; }
  .marca .logo { display: inline-flex; align-items: center; justify-content: center;
                 width: 54px; height: 54px; border-radius: 12px; background: #0a5b7a;
                 color: #fff; font-weight: 800; font-size: 22px; letter-spacing: 1px; }
  .marca h1 { margin: 6px 0 0; font-size: 22px; color: #0a5b7a; letter-spacing: .5px; }
  .marca .sub { color: #667; font-size: 11px; }
  .fiscal { text-align: right; font-size: 11px; color: #333; line-height: 1.6; }
  .fiscal b { color: #1a1f24; }

  /* --- Título del comprobante --- */
  .doc-head { display: flex; justify-content: space-between; align-items: center;
              margin: 18px 0 4px; }
  .doc-head .tipo { font-size: 20px; font-weight: 800; color: #0a5b7a; letter-spacing: 1px; }
  .doc-head .nro { font-size: 15px; font-weight: 700; }
  .doc-head .fecha { font-size: 12px; color: #555; }

  /* --- Datos del cliente --- */
  .cliente { margin: 10px 0 14px; padding: 10px 12px; background: #f4f8fa;
             border: 1px solid #dbe6ea; border-radius: 8px; display: grid;
             grid-template-columns: 1fr 1fr; gap: 2px 20px; font-size: 12px; }
  .cliente .lbl { color: #667; }

  /* --- Tabla de ítems --- */
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead th { background: #0a5b7a; color: #fff; font-size: 11px; text-transform: uppercase;
             letter-spacing: .4px; padding: 8px 10px; text-align: left; }
  thead th.num { text-align: right; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e6ebee; font-size: 12px; vertical-align: top; }
  tbody td.num { text-align: right; white-space: nowrap; }
  tbody tr:nth-child(even) td { background: #f8fafb; }
  .cod { color: #889; font-size: 11px; }

  /* --- Totales --- */
  .totales { margin-top: 14px; margin-left: auto; width: 46%; font-size: 12.5px; }
  .totales .row { display: flex; justify-content: space-between; padding: 4px 2px; }
  .totales .desc { color: #1a8a4a; }
  .totales .total { border-top: 2px solid #0a5b7a; margin-top: 4px; padding-top: 8px;
                    font-size: 18px; font-weight: 800; color: #0a5b7a; }

  /* --- Reporte: bloques lado a lado --- */
  .bloques { display: flex; gap: 20px; margin-top: 16px; }
  .bloque { flex: 1; }
  .bloque h3 { margin: 0 0 6px; color: #0a5b7a; font-size: 13px; border-bottom: 1px solid #dbe6ea; padding-bottom: 4px; }
  .bloque .row, .totales .row { display: flex; justify-content: space-between; padding: 3px 2px; font-size: 12px; }
  .row.fuerte { font-weight: 700; border-top: 1px solid #e6ebee; margin-top: 3px; padding-top: 5px; }

  /* --- Pie fiscal (factura: CAE + QR) --- */
  .pie-fiscal { display: flex; justify-content: space-between; align-items: center;
                margin-top: 20px; padding-top: 12px; border-top: 1px solid #dbe6ea; gap: 20px; }
  .cae { font-size: 12px; line-height: 1.7; }
  .cae .lbl { color: #667; }
  .pie-fiscal .qr { min-width: 120px; text-align: right; }

  /* --- Pie --- */
  .firma { margin-top: 46px; display: flex; justify-content: space-around; gap: 40px; }
  .firma .linea { flex: 1; max-width: 260px; border-top: 1px solid #333; padding-top: 5px;
                  text-align: center; font-size: 11px; color: #555; }
  .nota { margin-top: 22px; text-align: center; font-size: 10.5px; color: #889; }

  /* --- Barra de acciones (no se imprime) --- */
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; justify-content: center;
             padding: 10px; background: #0a5b7a; }
  .toolbar button { cursor: pointer; border: 0; border-radius: 8px; padding: 9px 16px;
                    font-size: 13px; font-weight: 700; }
  .toolbar .pr { background: #fff; color: #0a5b7a; }
  .toolbar .cl { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.5); }

  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .hoja { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; }
  }
`;

/** Membrete de ALUSO (nombre comercial + datos fiscales de la constancia). */
export function a4Header(): string {
  const E = EMPRESA;
  return `
  <div class="encabezado">
    <div class="marca">
      <img src="https://alusodistribuidora.web.app/logo-comprobante.png"
           alt="${esc(E.nombre)}" style="height:96px;width:auto;display:block;margin-bottom:2px" />
      <h1>${esc(E.nombre)}</h1>
      <div class="sub">${esc(E.subtitulo)}</div>
    </div>
    <div class="fiscal">
      ${E.razonSocial ? `<div><b>${esc(E.razonSocial)}</b></div>` : ""}
      ${E.cuit ? `<div>CUIT ${esc(E.cuit)}</div>` : ""}
      ${E.condicionIva ? `<div>${esc(E.condicionIva)}</div>` : ""}
      ${E.domicilio ? `<div>${esc(E.domicilio)}</div>` : ""}
      ${E.tel ? `<div>${esc(E.tel)}</div>` : ""}
      ${E.email ? `<div>${esc(E.email)}</div>` : ""}
    </div>
  </div>`;
}

/** Barra con los botones de imprimir / cerrar (no sale en la impresión). */
export function a4Toolbar(): string {
  return `
  <div class="toolbar">
    <button class="pr" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="cl" onclick="window.close()">Cerrar</button>
  </div>`;
}

export function a4Shell(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${A4_CSS}</style></head>
<body>${body}</body></html>`;
}

/**
 * Documento A4 completo: barra + hoja + contenido. Si opts.autoprint, dispara
 * la impresión al cargar (para el "imprimir factura" desde el botón).
 */
export function a4Doc(
  title: string,
  inner: string,
  opts: { autoprint?: boolean } = {}
): string {
  const auto = opts.autoprint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>`
    : "";
  return a4Shell(
    title,
    `${a4Toolbar()}<div class="hoja">${inner}</div>${auto}`
  );
}

/** Abre el comprobante A4 en una ventana grande (lista para imprimir/PDF). */
export function abrirA4(html: string): void {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}
