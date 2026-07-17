// Genera el reporte imprimible (HTML) de ventas y stock, remito por remito.
//   node scripts/reporte-html.mjs > reporte.html
// SOLO LECTURA sobre Firestore.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const num = (n) => Number(n || 0).toLocaleString("es-AR");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const [remSnap, prodSnap, truckSnap] = await Promise.all([
  db.collection("remitos").get(),
  db.collection("products").get(),
  db.collection("trucks").get(),
]);

const prods = new Map();
prodSnap.docs.forEach((p) => prods.set(p.id, { ...p.data(), id: p.id }));

const remitos = remSnap.docs.map((x) => x.data()).sort((a, b) => a.fecha - b.fecha);

const recep = [];
truckSnap.docs.forEach((t) => {
  const tr = t.data();
  if (!tr.fechaIngreso) return;
  (tr.carga ?? []).forEach((c) =>
    recep.push({ fecha: tr.fechaIngreso, productId: c.productId, u: c.cantidadUnidades || 0 })
  );
});
recep.sort((a, b) => a.fecha - b.fecha);

// Volumen por producto → nos quedamos con los reales (los de prueba tienen < 100 u.)
const vol = new Map();
const nombres = new Map();
remitos
  .filter((r) => !r.anulado)
  .forEach((r) =>
    (r.items ?? []).forEach((it) => {
      vol.set(it.productId, (vol.get(it.productId) ?? 0) + it.cantidad);
      nombres.set(it.productId, it.nombre);
    })
  );
const cols = [...vol.entries()]
  .filter(([, u]) => u >= 100)
  .sort((a, b) => b[1] - a[1])
  .map(([id]) => id);

const corto = (n) =>
  n
    .replace(/TOALLA DONCELLA /i, "Doncella ")
    .replace(/ CLASICA 50x8/i, "")
    .replace(/ACEITE MEZCLA FINCA DEL LAZO 4 x 5 LITROS/i, "Aceite Finca del Lazo")
    .replace(/ S\/D$/, " s/d")
    .replace(/ C\/D$/, " c/d")
    .trim();

// Stock al inicio de todo = stock de hoy + vendido − recibido
const stock = new Map();
prods.forEach((p, id) => stock.set(id, p.stock ?? 0));
remitos
  .filter((r) => !r.anulado)
  .forEach((r) => (r.items ?? []).forEach((it) => stock.set(it.productId, (stock.get(it.productId) ?? 0) + it.cantidad)));
recep.forEach((x) => stock.set(x.productId, (stock.get(x.productId) ?? 0) - x.u));

const DESDE = new Date(2026, 6, 7).getTime(); // uso real del sistema
const stockInicial = new Map();

const dias = [];
let recIdx = 0;
let curKey = null;

for (const r of remitos) {
  while (recIdx < recep.length && recep[recIdx].fecha <= r.fecha) {
    const x = recep[recIdx++];
    stock.set(x.productId, (stock.get(x.productId) ?? 0) + x.u);
  }
  const vend = new Map();
  if (!r.anulado) {
    for (const it of r.items ?? []) {
      vend.set(it.productId, (vend.get(it.productId) ?? 0) + it.cantidad);
      stock.set(it.productId, (stock.get(it.productId) ?? 0) - it.cantidad);
    }
  }
  if (r.fecha < DESDE) continue;
  if (stockInicial.size === 0) cols.forEach((id) => stockInicial.set(id, (stock.get(id) ?? 0) + (vend.get(id) ?? 0)));

  const d = new Date(r.fecha);
  const p = (n) => String(n).padStart(2, "0");
  const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (key !== curKey) {
    curKey = key;
    dias.push({
      key,
      titulo: d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }),
      filas: [],
      unidades: 0,
      importe: 0,
      anulados: 0,
    });
  }
  const dd = dias[dias.length - 1];
  const u = [...vend.values()].reduce((s, x) => s + x, 0);
  if (r.anulado) dd.anulados++;
  else {
    dd.unidades += u;
    dd.importe += r.total || 0;
  }
  dd.filas.push({
    numero: r.numero,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
    anulado: !!r.anulado,
    total: r.total || 0,
    cliente: r.clienteNombre ?? "",
    cols: cols.map((id) => ({ vend: vend.get(id) ?? 0, stock: stock.get(id) ?? 0 })),
  });
}

const totRemitos = dias.reduce((s, d) => s + d.filas.length, 0);
const totAnulados = dias.reduce((s, d) => s + d.anulados, 0);
const totUnidades = dias.reduce((s, d) => s + d.unidades, 0);
const totImporte = dias.reduce((s, d) => s + d.importe, 0);

// ---- Curva de stock por producto (SVG generado, no dibujado a mano) ----
const serie = new Map(cols.map((id) => [id, []]));
dias.forEach((d) =>
  d.filas.forEach((f) => cols.forEach((id, i) => serie.get(id).push(f.cols[i].stock)))
);
const W = 720, H = 150, PAD = 4;
const curva = (id) => {
  const pts = serie.get(id);
  const max = stockInicial.get(id) || 1;
  const dx = (W - PAD * 2) / Math.max(1, pts.length - 1);
  return pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(PAD + i * dx).toFixed(1)},${(H - PAD - (v / max) * (H - PAD * 2)).toFixed(1)}`)
    .join(" ");
};

const TONOS = ["var(--accent)", "var(--accent-2)", "var(--accent-3)"];

const html = `<title>Ventas y stock · Distribuidora Los Amigos NOA</title>
<style>
  :root {
    color-scheme: light dark;
    --paper: #ffffff;
    --ink: #14181c;
    --muted: #68737d;
    --rule: #dde3e7;
    --rule-soft: #eef2f4;
    --accent: #006081;
    --accent-2: #4a7c59;
    --accent-3: #9a6a3c;
    --alert: #a8323d;
    --band: #f4f7f8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #11151a;
      --ink: #e6ebef;
      --muted: #93a0aa;
      --rule: #2a333c;
      --rule-soft: #1c232a;
      --accent: #4bb3d8;
      --accent-2: #7fb98d;
      --accent-3: #d0a06a;
      --alert: #e07a84;
      --band: #171d24;
    }
  }
  :root[data-theme="dark"] {
    --paper: #11151a; --ink: #e6ebef; --muted: #93a0aa; --rule: #2a333c;
    --rule-soft: #1c232a; --accent: #4bb3d8; --accent-2: #7fb98d;
    --accent-3: #d0a06a; --alert: #e07a84; --band: #171d24;
  }
  :root[data-theme="light"] {
    --paper: #ffffff; --ink: #14181c; --muted: #68737d; --rule: #dde3e7;
    --rule-soft: #eef2f4; --accent: #006081; --accent-2: #4a7c59;
    --accent-3: #9a6a3c; --alert: #a8323d; --band: #f4f7f8;
  }

  .doc {
    background: var(--paper);
    color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 28px 64px;
    -webkit-font-smoothing: antialiased;
  }

  .eyebrow {
    font-size: 11px; font-weight: 700; letter-spacing: .16em;
    text-transform: uppercase; color: var(--accent); margin: 0;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 400; font-size: 40px; line-height: 1.1;
    margin: 10px 0 6px; text-wrap: balance; letter-spacing: -.01em;
  }
  .lede { color: var(--muted); margin: 0; font-size: 15px; }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
    background: var(--rule); border: 1px solid var(--rule);
    margin: 28px 0 0; border-radius: 3px; overflow: hidden;
  }
  .stat { background: var(--paper); padding: 14px 16px; }
  .stat dt {
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 4px;
  }
  .stat dd {
    margin: 0; font-size: 22px; font-weight: 600;
    font-variant-numeric: tabular-nums; letter-spacing: -.02em;
  }
  .stat .sub { font-size: 11px; font-weight: 400; color: var(--muted); }

  .chart-wrap { margin: 32px 0 0; }
  .chart-wrap h2, .tabla-wrap h2 {
    font-family: Georgia, serif; font-weight: 400; font-size: 20px;
    margin: 0 0 4px;
  }
  .chart-note { color: var(--muted); font-size: 13px; margin: 0 0 14px; }
  .chart { border: 1px solid var(--rule); border-radius: 3px; padding: 12px; background: var(--paper); }
  .chart svg { display: block; width: 100%; height: auto; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 10px; font-size: 12px; }
  .leyenda span { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); }
  .swatch { width: 14px; height: 3px; border-radius: 2px; }

  .prods { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px; }
  .prod { border: 1px solid var(--rule); border-radius: 3px; padding: 12px 14px; }
  .prod .n { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
  .prod .via { display: flex; align-items: baseline; gap: 8px; font-variant-numeric: tabular-nums; }
  .prod .de { color: var(--muted); font-size: 15px; }
  .prod .fl { color: var(--muted); font-size: 13px; }
  .prod .a { font-size: 21px; font-weight: 700; letter-spacing: -.02em; }
  .prod .a.cero { color: var(--alert); }

  .tabla-wrap { margin-top: 40px; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); text-align: right; padding: 8px 8px; border-bottom: 1.5px solid var(--ink);
    white-space: nowrap; background: var(--paper);
  }
  thead th.l { text-align: left; }
  thead th.grp {
    text-align: center; border-bottom: 1px solid var(--rule);
    padding-bottom: 4px; color: var(--ink); font-size: 10px;
  }
  tbody td { padding: 5px 8px; text-align: right; border-bottom: 1px solid var(--rule-soft); font-variant-numeric: tabular-nums; }
  tbody td.l { text-align: left; }
  .rem { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; letter-spacing: -.02em; }
  .hora { color: var(--muted); font-size: 12px; }
  .st { color: var(--muted); }
  .st.cero { color: var(--alert); font-weight: 700; }
  .vend { font-weight: 600; }
  .nada { color: var(--rule); }
  .imp { font-weight: 600; }

  tr.dia td {
    background: var(--band); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
    padding: 7px 8px; font-weight: 600; font-size: 12px; text-align: left;
    text-transform: capitalize;
  }
  tr.dia .tot { float: right; font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 400; text-transform: none; }
  tr.anul td { color: var(--muted); }
  tr.anul .rem { text-decoration: line-through; }
  .tag {
    font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--alert); border: 1px solid currentColor; border-radius: 2px; padding: 0 4px; margin-left: 6px;
  }
  tfoot td {
    border-top: 1.5px solid var(--ink); padding: 10px 8px; font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  tfoot td.l { text-align: left; }

  .pie { margin-top: 28px; padding-top: 14px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 12px; }

  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    h1 { font-size: 30px; }
    .doc { padding: 24px 16px 40px; }
  }

  @media print {
    @page { size: A4 landscape; margin: 12mm; }
    .doc { max-width: none; padding: 0; font-size: 10px; }
    h1 { font-size: 26px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    tr.dia { break-after: avoid; }
    .chart-wrap { break-inside: avoid; }
    .stat dd { font-size: 17px; }
  }
</style>

<div class="doc">
  <p class="eyebrow">Distribuidora Los Amigos NOA</p>
  <h1>Ventas y stock, remito por remito</h1>
  <p class="lede">Del martes 7 al jueves 16 de julio de 2026 · ${totRemitos} remitos emitidos</p>

  <dl class="stats">
    <div class="stat"><dt>Remitos</dt><dd>${num(totRemitos - totAnulados)} <span class="sub">${totAnulados ? `+ ${totAnulados} anulados` : ""}</span></dd></div>
    <div class="stat"><dt>Unidades vendidas</dt><dd>${num(totUnidades)}</dd></div>
    <div class="stat"><dt>Facturado</dt><dd>${ars(totImporte)}</dd></div>
    <div class="stat"><dt>Días con ventas</dt><dd>${dias.length}</dd></div>
  </dl>

  <section class="chart-wrap">
    <h2>Cómo bajó el stock</h2>
    <p class="chart-note">Cada punto es un remito, en orden. Las dos líneas de toallas terminan en cero.</p>
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Curva de stock por producto">
        <line x1="0" y1="${H - PAD}" x2="${W}" y2="${H - PAD}" stroke="var(--rule)" stroke-width="1" />
        ${cols
          .map(
            (id, i) =>
              `<path d="${curva(id)}" fill="none" stroke="${TONOS[i % 3]}" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`
          )
          .join("\n        ")}
      </svg>
    </div>
    <div class="leyenda">
      ${cols
        .map(
          (id, i) =>
            `<span><i class="swatch" style="background:${TONOS[i % 3]}"></i>${esc(corto(nombres.get(id)))} · ${num(stockInicial.get(id))} → ${num(stock.get(id) ?? 0)}</span>`
        )
        .join("\n      ")}
    </div>

    <div class="prods">
      ${cols
        .map((id) => {
          const fin = stock.get(id) ?? 0;
          return `<div class="prod">
        <div class="n">${esc(corto(nombres.get(id)))}</div>
        <div class="via">
          <span class="de">${num(stockInicial.get(id))}</span>
          <span class="fl">→</span>
          <span class="a${fin === 0 ? " cero" : ""}">${num(fin)}</span>
        </div>
      </div>`;
        })
        .join("\n      ")}
    </div>
  </section>

  <section class="tabla-wrap">
    <h2>Detalle por remito</h2>
    <p class="chart-note">Por cada venta: unidades despachadas y el stock que quedó después.</p>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="l"></th><th></th>
            ${cols.map((id) => `<th class="grp" colspan="2">${esc(corto(nombres.get(id)))}</th>`).join("")}
            <th></th>
          </tr>
          <tr>
            <th class="l">Remito</th>
            <th class="l">Hora</th>
            ${cols.map(() => `<th>Vend.</th><th>Stock</th>`).join("")}
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          ${dias
            .map(
              (d) => `<tr class="dia"><td colspan="${3 + cols.length * 2}">${esc(d.titulo)}
            <span class="tot">${num(d.unidades)} u. · ${ars(d.importe)}${d.anulados ? ` · ${d.anulados} anulado${d.anulados > 1 ? "s" : ""}` : ""}</span></td></tr>
          ${d.filas
            .map(
              (f) => `<tr${f.anulado ? ' class="anul"' : ""}>
            <td class="l"><span class="rem">${esc(f.numero)}</span>${f.anulado ? '<span class="tag">anulado</span>' : ""}</td>
            <td class="l hora">${f.hora}</td>
            ${f.cols
              .map(
                (c) =>
                  `<td class="${c.vend ? "vend" : "nada"}">${c.vend ? num(c.vend) : "·"}</td><td class="st${c.stock === 0 ? " cero" : ""}">${num(c.stock)}</td>`
              )
              .join("")}
            <td class="imp">${f.anulado ? "—" : ars(f.total)}</td>
          </tr>`
            )
            .join("\n          ")}`
            )
            .join("\n          ")}
        </tbody>
        <tfoot>
          <tr>
            <td class="l" colspan="2">Total del período</td>
            ${cols
              .map((id) => `<td>${num(vol.get(id))}</td><td class="st">${num(stock.get(id) ?? 0)}</td>`)
              .join("")}
            <td>${ars(totImporte)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>

  <p class="pie">
    Generado desde el sistema el ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}.
    El stock se reconstruye a partir de los remitos emitidos y las recepciones de mercadería registradas.
  </p>
</div>
`;

process.stdout.write(html);
