// Reporte PDF de VENTAS y STOCK día por día, con el branding de la distribuidora.
// Para mandarle al cliente.
//   node scripts/reporte-pdf.mjs                → al Escritorio
//   node scripts/reporte-pdf.mjs "C:/ruta.pdf"
//
// SOLO LECTURA sobre Firestore.
import { readFileSync, createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const OUT =
  process.argv[2] ||
  "C:/Users/Axel/Desktop/Los Amigos NOA - Ventas y Stock.pdf";
const LOGO = new URL("../public/icons/icon-192.png", import.meta.url);

// Branding real de la app
const TEAL = "#006081";
const TEAL_CLARO = "#e6f1f5";
const TINTA = "#14181c";
const GRIS = "#68737d";
const REGLA = "#dde3e7";
const ROJO = "#a8323d";
const BANDA = "#f4f7f8";

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const num = (n) => Number(n || 0).toLocaleString("es-AR");

// ==================== DATOS ====================
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

// OJO: las fuentes estándar del PDF (Helvetica) solo tienen Latin-1. Cualquier
// caracter fuera de ahí (−, →, ✓) sale como basura tipo `"&`. Solo ASCII/Latin-1.
const corto = (n) =>
  n
    .replace(/TOALLA DONCELLA /i, "Doncella ")
    .replace(/ CLASICA 50x8/i, "")
    .replace(/ACEITE MEZCLA FINCA DEL LAZO 4 x 5 LITROS/i, "Aceite Finca del Lazo")
    .replace(/ S\/D$/i, " s/d")
    .replace(/ C\/D$/i, " c/d")
    .trim();

// Nombre corto para los encabezados de columna (si no, se montan entre ellos).
const cortito = (n) =>
  n
    .replace(/TOALLA DONCELLA /i, "")
    .replace(/ CLASICA 50x8/i, "")
    .replace(/ACEITE MEZCLA FINCA DEL LAZO 4 x 5 LITROS/i, "ACEITE")
    .replace(/ S\/D$/i, " s/d")
    .replace(/ C\/D$/i, " c/d")
    .trim();

// Stock al inicio de todo
const stock = new Map();
prods.forEach((p, id) => stock.set(id, p.stock ?? 0));
remitos
  .filter((r) => !r.anulado)
  .forEach((r) =>
    (r.items ?? []).forEach((it) => stock.set(it.productId, (stock.get(it.productId) ?? 0) + it.cantidad))
  );
recep.forEach((x) => stock.set(x.productId, (stock.get(x.productId) ?? 0) - x.u));

const DESDE = new Date(2026, 6, 7).getTime();
const stockInicialGlobal = new Map();
const dias = [];
let recIdx = 0;
let curKey = null;

for (const r of remitos) {
  while (recIdx < recep.length && recep[recIdx].fecha <= r.fecha) {
    const x = recep[recIdx++];
    stock.set(x.productId, (stock.get(x.productId) ?? 0) + x.u);
    if (r.fecha >= DESDE && dias.length) {
      const dd = dias[dias.length - 1];
      dd.recibido.set(x.productId, (dd.recibido.get(x.productId) ?? 0) + x.u);
    }
  }
  const vend = new Map();
  if (!r.anulado) {
    for (const it of r.items ?? []) {
      vend.set(it.productId, (vend.get(it.productId) ?? 0) + it.cantidad);
      stock.set(it.productId, (stock.get(it.productId) ?? 0) - it.cantidad);
    }
  }
  if (r.fecha < DESDE) continue;
  if (stockInicialGlobal.size === 0)
    cols.forEach((id) => stockInicialGlobal.set(id, (stock.get(id) ?? 0) + (vend.get(id) ?? 0)));

  const d = new Date(r.fecha);
  const p = (n) => String(n).padStart(2, "0");
  const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (key !== curKey) {
    curKey = key;
    dias.push({
      key,
      titulo: d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }),
      remitos: 0,
      anulados: 0,
      unidades: 0,
      efectivo: 0,
      otros: 0,
      prod: new Map(),
      recibido: new Map(),
      stockIni: new Map(),
      stockFin: new Map(),
      tickets: [],
    });
  }
  const dd = dias[dias.length - 1];
  const uTicket = [...vend.values()].reduce((s, x) => s + x, 0);
  if (r.anulado) dd.anulados++;
  else {
    dd.remitos++;
    const fp = r.formaPago ?? "efectivo";
    if (fp === "efectivo") dd.efectivo += r.total || 0;
    else dd.otros += r.total || 0;
    vend.forEach((u, id) => {
      dd.unidades += u;
      const cur = dd.prod.get(id) ?? { u: 0, plata: 0 };
      cur.u += u;
      const it = (r.items ?? []).find((x) => x.productId === id);
      cur.plata += u * (it?.precioVenta || 0);
      dd.prod.set(id, cur);
    });
  }
  // Cada ticket: qué se llevó de cada producto y con qué stock quedó DESPUÉS.
  // Así se ve el stock bajando ticket por ticket desde el inicial del día.
  dd.tickets.push({
    numero: r.numero ?? "",
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
    cliente: r.clienteNombre ?? "",
    unidades: uTicket,
    renglones: (r.items ?? []).length,
    formaPago: r.formaPago ?? "efectivo",
    total: r.total || 0,
    anulado: !!r.anulado,
    cols: cols.map((id) => ({ vend: vend.get(id) ?? 0, stock: stock.get(id) ?? 0 })),
  });
  // Stock ANTES del primer ticket del día = el inicial cargado de ese día.
  if (dd.tickets.length === 1)
    cols.forEach((id) => dd.stockIni.set(id, (stock.get(id) ?? 0) + (vend.get(id) ?? 0)));
  cols.forEach((id) => dd.stockFin.set(id, stock.get(id) ?? 0));
}

const totUnidades = dias.reduce((s, d) => s + d.unidades, 0);
const totEfectivo = dias.reduce((s, d) => s + d.efectivo, 0);
const totOtros = dias.reduce((s, d) => s + d.otros, 0);
const totRemitos = dias.reduce((s, d) => s + d.remitos, 0);

// ==================== PDF ====================
// Paginamos a mano (controlamos la `y` en todo el documento). Sin este margen
// en 0, pdfkit corta solo apenas un texto roza el pie y mete hojas en blanco.
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 40, left: 40, right: 40, bottom: 0 },
  bufferPages: true,
});
doc.pipe(createWriteStream(OUT));

// GUARDARRAÍL: las fuentes estándar del PDF (Helvetica) solo tienen Latin-1.
// Un − (menos tipográfico), una → o un ✓ salen impresos como basura (`"&40`).
// Envolvemos .text() para que avise en vez de arruinar el PDF en silencio.
const _text = doc.text.bind(doc);
const malos = new Set();
doc.text = (str, ...rest) => {
  if (typeof str === "string") {
    for (const ch of str) if (ch.charCodeAt(0) > 255) malos.add(ch);
  }
  return _text(str, ...rest);
};

const W = doc.page.width - 80; // ancho útil
const X = 40;

// ---------- Portada / encabezado ----------
doc.rect(0, 0, doc.page.width, 118).fill(TEAL);
try {
  doc.image(LOGO, X, 26, { width: 58 });
} catch {}
doc
  .fillColor("#ffffff")
  .font("Helvetica-Bold")
  .fontSize(19)
  .text("Distribuidora Los Amigos", X + 72, 34);
doc
  .font("Helvetica")
  .fontSize(9.5)
  .fillColor("#cfe4ec")
  .text("NOA · Distribuidora mayorista · Doncella y Nonisec", X + 72, 57);
doc
  .font("Helvetica-Bold")
  .fontSize(13)
  .fillColor("#ffffff")
  .text("Reporte de ventas y stock", X + 72, 78);
doc
  .font("Helvetica")
  .fontSize(9)
  .fillColor("#cfe4ec")
  .text(
    `Del martes 7 al jueves 16 de julio de 2026`,
    X + 72,
    95
  );

let y = 142;

// ---------- Totales ----------
const kpis = [
  ["Remitos", num(totRemitos)],
  ["Unidades vendidas", num(totUnidades)],
  ["Efectivo", ars(totEfectivo)],
  ["Total facturado", ars(totEfectivo + totOtros)],
];
const kw = W / 4;
doc.rect(X, y, W, 46).fill(TEAL_CLARO);
kpis.forEach(([k, v], i) => {
  const cx = X + i * kw + 12;
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(TEAL).text(k.toUpperCase(), cx, y + 9, { characterSpacing: 0.7 });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(TINTA).text(v, cx, y + 22);
  if (i > 0) doc.moveTo(X + i * kw, y + 8).lineTo(X + i * kw, y + 38).lineWidth(0.5).strokeColor("#c3dde6").stroke();
});
y += 66;

// ---------- Stock de un vistazo ----------
doc.font("Helvetica-Bold").fontSize(11).fillColor(TINTA).text("Stock: de dónde salimos y dónde estamos", X, y);
y += 18;
const pw = W / cols.length;
cols.forEach((id, i) => {
  const cx = X + i * pw;
  const ini = stockInicialGlobal.get(id) ?? 0;
  const fin = stock.get(id) ?? 0;
  doc.roundedRect(cx, y, pw - 8, 52, 3).lineWidth(0.7).strokeColor(REGLA).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA).text(corto(nombres.get(id)), cx + 10, y + 9, { width: pw - 26 });
  doc.font("Helvetica").fontSize(12).fillColor(GRIS).text(num(ini), cx + 10, y + 28, { continued: true });
  doc.fillColor(GRIS).fontSize(9).text("   >   ", { continued: true });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(fin === 0 ? ROJO : TINTA).text(num(fin));
});
y += 72;

// ---------- Tabla día por día ----------
doc.font("Helvetica-Bold").fontSize(11).fillColor(TINTA).text("Día por día", X, y);
y += 6;
doc.font("Helvetica").fontSize(8).fillColor(GRIS).text("Por cada día: cuánto se vendió y con qué stock quedó cada producto.", X, y + 8);
y += 26;

const encabezado = () => {
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GRIS);
  doc.text("DÍA", X, y, { width: 92, characterSpacing: 0.5 });
  doc.text("REM.", X + 94, y, { width: 26, align: "right" });
  doc.text("UNID.", X + 122, y, { width: 34, align: "right" });
  doc.text("VENDIDO", X + 158, y, { width: 72, align: "right" });
  cols.forEach((id, i) => {
    const cx = X + 236 + i * 92;
    doc.text(corto(nombres.get(id)).toUpperCase(), cx, y - 8, { width: 88, align: "center" });
    doc.text("vend.", cx, y, { width: 42, align: "right" });
    doc.text("stock", cx + 46, y, { width: 42, align: "right" });
  });
  y += 11;
  doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1).strokeColor(TINTA).stroke();
  y += 6;
};
encabezado();

dias.forEach((d, idx) => {
  if (y > doc.page.height - 90) {
    doc.addPage();
    y = 50;
    encabezado();
  }
  if (idx % 2 === 0) doc.rect(X, y - 3, W, 17).fill(BANDA);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA);
  doc.text(d.titulo.replace(/^\w/, (c) => c.toUpperCase()), X, y, { width: 92 });
  doc.font("Helvetica").fontSize(8).fillColor(TINTA);
  doc.text(String(d.remitos), X + 94, y, { width: 26, align: "right" });
  doc.text(num(d.unidades), X + 122, y, { width: 34, align: "right" });
  doc.font("Helvetica-Bold").text(ars(d.efectivo + d.otros), X + 158, y, { width: 72, align: "right" });
  cols.forEach((id, i) => {
    const cx = X + 236 + i * 92;
    const v = d.prod.get(id)?.u ?? 0;
    const sf = d.stockFin.get(id) ?? 0;
    doc.font("Helvetica").fontSize(8).fillColor(v ? TINTA : REGLA).text(v ? num(v) : "·", cx, y, { width: 42, align: "right" });
    doc
      .font(sf === 0 ? "Helvetica-Bold" : "Helvetica")
      .fillColor(sf === 0 ? ROJO : GRIS)
      .text(num(sf), cx + 46, y, { width: 42, align: "right" });
  });
  y += 17;
});

doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1).strokeColor(TINTA).stroke();
y += 6;
doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA);
doc.text("TOTAL", X, y, { width: 92 });
doc.text(String(totRemitos), X + 94, y, { width: 26, align: "right" });
doc.text(num(totUnidades), X + 122, y, { width: 34, align: "right" });
doc.text(ars(totEfectivo + totOtros), X + 158, y, { width: 72, align: "right" });
cols.forEach((id, i) => {
  const cx = X + 236 + i * 92;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA).text(num(vol.get(id)), cx, y, { width: 42, align: "right" });
  const fin = stock.get(id) ?? 0;
  doc.fillColor(fin === 0 ? ROJO : GRIS).text(num(fin), cx + 46, y, { width: 42, align: "right" });
});
y += 26;

// ---------- Detalle por día ----------
doc.addPage();
y = 50;
doc.font("Helvetica-Bold").fontSize(13).fillColor(TEAL).text("Detalle por día", X, y);
y += 22;

dias.forEach((d) => {
  // Que el encabezado del día no quede solo al pie: pedimos lugar para la
  // cabecera + los productos + las primeras filas de tickets.
  const alto = 80 + d.prod.size * 14;
  if (y + alto > doc.page.height - 60) {
    doc.addPage();
    y = 50;
  }
  doc.rect(X, y, W, 18).fill(TEAL);
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#ffffff")
    .text(d.titulo.replace(/^\w/, (c) => c.toUpperCase()), X + 8, y + 5);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#cfe4ec")
    .text(
      `${d.remitos} remitos · ${num(d.unidades)} u. · ${ars(d.efectivo + d.otros)}${d.anulados ? ` · ${d.anulados} anulado(s)` : ""}`,
      X + 8,
      y + 5,
      { width: W - 16, align: "right" }
    );
  y += 24;

  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GRIS);
  doc.text("PRODUCTO", X + 8, y, { width: 210 });
  doc.text("STOCK INICIAL", X + 220, y, { width: 66, align: "right" });
  doc.text("RECIBIDO", X + 290, y, { width: 52, align: "right" });
  doc.text("VENDIDO", X + 346, y, { width: 52, align: "right" });
  doc.text("STOCK FINAL", X + 402, y, { width: 60, align: "right" });
  doc.text("IMPORTE", X + 466, y, { width: 49, align: "right" });
  y += 10;
  doc.moveTo(X + 8, y).lineTo(X + W - 8, y).lineWidth(0.5).strokeColor(REGLA).stroke();
  y += 4;

  [...d.prod.entries()]
    .sort((a, b) => b[1].u - a[1].u)
    .forEach(([id, v]) => {
      const sf = d.stockFin.get(id) ?? 0;
      const rec = d.recibido.get(id) ?? 0;
      const si = sf + v.u - rec;
      doc.font("Helvetica").fontSize(8).fillColor(TINTA).text(corto(nombres.get(id)), X + 8, y, { width: 210 });
      doc.fillColor(GRIS).text(num(si), X + 220, y, { width: 66, align: "right" });
      doc.fillColor(rec ? TINTA : REGLA).text(rec ? num(rec) : "·", X + 290, y, { width: 52, align: "right" });
      doc.font("Helvetica-Bold").fillColor(TINTA).text(num(v.u), X + 346, y, { width: 52, align: "right" });
      doc
        .font(sf === 0 ? "Helvetica-Bold" : "Helvetica")
        .fillColor(sf === 0 ? ROJO : GRIS)
        .text(num(sf), X + 402, y, { width: 60, align: "right" });
      doc.font("Helvetica").fillColor(TINTA).text(ars(v.plata), X + 466, y, { width: 49, align: "right" });
      y += 14;
    });
  y += 12;

  // ----- Tickets (remitos) de ese día, uno por uno -----
  if (y + 40 > doc.page.height - 60) {
    doc.addPage();
    y = 50;
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(TEAL)
    .text(`Tickets del día  ·  ${d.tickets.length}`, X + 8, y);
  y += 13;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(GRIS)
    .text("Qué se llevó cada uno y cómo va bajando el stock.", X + 8, y);
  y += 14;

  // Columnas: ticket · hora · [por producto: unidades | stock] · importe
  const CX = (i) => X + 100 + i * 92;
  const FIL = 14.5; // alto de fila
  const encTickets = () => {
    // Franja con el nombre de cada producto, arriba de sus dos columnas.
    cols.forEach((id, i) => {
      doc.rect(CX(i) - 4, y, 88, 12).fill(TEAL_CLARO);
      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(TEAL)
        .text(cortito(nombres.get(id)).toUpperCase(), CX(i) - 4, y + 3.5, { width: 88, align: "center" });
    });
    y += 14;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GRIS);
    doc.text("TICKET", X + 8, y, { width: 54 });
    doc.text("HORA", X + 64, y, { width: 30 });
    cols.forEach((_, i) => {
      doc.text("SE LLEVÓ", CX(i), y, { width: 38, align: "right" });
      doc.text("QUEDAN", CX(i) + 40, y, { width: 44, align: "right" });
    });
    doc.text("IMPORTE", X + 420, y, { width: 95, align: "right" });
    y += 10;
    doc.moveTo(X + 8, y).lineTo(X + W - 8, y).lineWidth(0.8).strokeColor(TINTA).stroke();
    y += 5;
  };
  encTickets();

  // Punto de partida: el stock cargado con el que arrancó el día.
  doc.rect(X + 8, y - 3, W - 16, FIL).fill(TEAL_CLARO);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TEAL).text("Stock inicial del día", X + 8, y, { width: 92 });
  cols.forEach((id, i) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(TEAL)
      .text(num(d.stockIni.get(id) ?? 0), CX(i) + 40, y - 0.5, { width: 44, align: "right" });
  });
  y += FIL + 2;

  d.tickets.forEach((t, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 50;
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(TEAL)
        .text(`${d.titulo.replace(/^\w/, (c) => c.toUpperCase())} · tickets (continúa)`, X + 8, y);
      y += 14;
      encTickets();
    }
    if (i % 2 === 0) doc.rect(X + 8, y - 3, W - 16, FIL).fill(BANDA);
    const c = t.anulado ? GRIS : TINTA;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(t.anulado ? GRIS : TEAL).text(t.numero, X + 8, y, { width: 54 });
    doc.font("Helvetica").fontSize(8).fillColor(GRIS).text(t.hora, X + 64, y, { width: 30 });
    t.cols.forEach((cc, i2) => {
      doc
        .font(cc.vend ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .fillColor(cc.vend ? c : REGLA)
        .text(cc.vend ? `-${num(cc.vend)}` : ".", CX(i2), y, { width: 38, align: "right" });
      doc
        .font(cc.stock === 0 ? "Helvetica-Bold" : "Helvetica")
        .fillColor(cc.stock === 0 ? ROJO : GRIS)
        .text(num(cc.stock), CX(i2) + 40, y, { width: 44, align: "right" });
    });
    if (t.anulado) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(ROJO).text("ANULADO", X + 420, y + 0.5, { width: 95, align: "right" });
    } else {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA).text(ars(t.total), X + 420, y, { width: 95, align: "right" });
    }
    y += FIL;
  });

  y += 3;
  doc.moveTo(X + 8, y).lineTo(X + W - 8, y).lineWidth(0.8).strokeColor(TINTA).stroke();
  y += 6;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA);
  doc.text(`${d.remitos} tickets · ${num(d.unidades)} u.`, X + 8, y, { width: 92 });
  cols.forEach((id, i) => {
    const v = d.prod.get(id)?.u ?? 0;
    const sf = d.stockFin.get(id) ?? 0;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(TINTA).text(v ? `-${num(v)}` : ".", CX(i), y, { width: 38, align: "right" });
    doc.fillColor(sf === 0 ? ROJO : TINTA).text(num(sf), CX(i) + 40, y, { width: 44, align: "right" });
  });
  doc.fillColor(TINTA).text(ars(d.efectivo + d.otros), X + 420, y, { width: 95, align: "right" });
  y += 13;
  if (d.otros > 0) {
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(GRIS)
      .text(`Efectivo ${ars(d.efectivo)} · Otras formas de pago ${ars(d.otros)}`, X + 8, y, { width: W - 16, align: "right" });
    y += 10;
  }
  y += 14;
});

// ---------- Pie en todas las páginas ----------
// OJO: el pie va DEBAJO del margen inferior. Si no anulamos el margen, pdfkit
// considera que el texto se desbordó y agrega una hoja en blanco por cada pie.
const rango = doc.bufferedPageRange();
for (let i = 0; i < rango.count; i++) {
  doc.switchToPage(i);
  doc.page.margins.bottom = 0;
  const py = doc.page.height - 34;
  doc.moveTo(X, py).lineTo(X + W, py).lineWidth(0.5).strokeColor(REGLA).stroke();
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(GRIS)
    .text(
      `Distribuidora Los Amigos NOA · Balcarce 836, La Quiaca, Jujuy · Generado el ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`,
      X,
      py + 8,
      { width: W - 60 }
    );
  doc.text(`${i + 1} / ${rango.count}`, X + W - 60, py + 8, { width: 60, align: "right" });
}

// Releemos DESPUÉS de escribir los pies: si alguno hubiera desbordado, acá
// aparecerían las hojas de más.
const finales = doc.bufferedPageRange().count;
if (finales !== rango.count) {
  console.warn(`⚠️  Los pies agregaron ${finales - rango.count} hoja(s) en blanco.`);
}

if (malos.size) {
  console.warn(
    `⚠️  Caracteres que Helvetica NO imprime (van a salir como basura): ${[...malos].join(" ")}`
  );
  console.warn(`    Reemplazalos por ASCII/Latin-1 (− → "-", → → ">").`);
}

doc.end();
console.log(`✓ PDF generado: ${OUT}`);
console.log(`  ${finales} páginas · ${dias.length} días · ${totRemitos} remitos · ${num(totUnidades)} unidades · ${ars(totEfectivo + totOtros)}`);
