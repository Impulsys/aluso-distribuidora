// Base compartida para comprobantes en impresora térmica de 80mm.
// Remito, factura y reporte de caja usan este formato/ancho.

export const EMPRESA = {
  nombre: "Distribuidora Los Amigos",
  subtitulo: "NOA · Distribuidora mayorista",
  tel: "+54 9 11 2759-7572",
  email: "distribuidoralosamigosnoa@gmail.com",
};

export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ars(n: number): string {
  return "$ " + (n || 0).toLocaleString("es-AR");
}

export function fechaCorta(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Estilos del ticket de 80mm (ancho real ~72mm de contenido).
const TICKET_CSS = `
  * { box-sizing: border-box; }
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; }
  body { width: 80mm; padding: 4mm 3mm 8mm; color: #000;
         font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.35; }
  h1 { font-size: 14px; margin: 0; text-align: center; }
  .sub { text-align: center; font-size: 10px; color: #222; }
  .doc { text-align: center; font-weight: 800; font-size: 14px; margin: 6px 0 2px; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .small { font-size: 10px; color: #333; }
  .it { margin-top: 4px; }
  .it .n { font-weight: 600; }
  .it .d { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: #222; }
  .total { font-size: 16px; font-weight: 800; margin-top: 2px; }
  .center { text-align: center; }
  .nota { margin-top: 8px; text-align: center; font-size: 9px; color: #555; }
  .firma { margin-top: 24px; border-top: 1px solid #000; padding-top: 3px;
           text-align: center; font-size: 10px; color: #444; }
  .toolbar { position: fixed; top: 8px; right: 8px; display: flex; gap: 6px; }
  .toolbar button { cursor: pointer; border: 0; border-radius: 8px; padding: 8px 12px;
                    font-size: 12px; font-weight: 700; }
  .toolbar .pr { background: #006081; color: #fff; }
  .toolbar .cl { background: #e2e8f0; color: #1e293b; }
  @media print { .toolbar { display: none !important; } }
`;

/** Arma el documento HTML completo del ticket (con toolbar y autoprint opcional). */
export function ticketDoc(
  title: string,
  inner: string,
  opts: { autoprint?: boolean } = {}
): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>${TICKET_CSS}</style></head>
<body>
  <div class="toolbar">
    <button class="pr" onclick="window.print()">🖨️ Imprimir / PDF</button>
    <button class="cl" onclick="window.close()">Cerrar</button>
  </div>
  ${inner}
  ${
    opts.autoprint
      ? `<script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>`
      : ""
  }
</body></html>`;
}

export function abrirTicket(html: string): void {
  // Ventana angosta tipo ticket.
  const w = window.open("", "_blank", "width=380,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

/** Encabezado común (empresa). */
export function ticketHeader(): string {
  return `
  <h1>${EMPRESA.nombre}</h1>
  <div class="sub">${EMPRESA.subtitulo}</div>
  <div class="sub">Tel: ${EMPRESA.tel}</div>`;
}
