// SOLO LECTURA. Histórico día por día desde que se empezó a usar el sistema:
// qué se vendió (unidades y plata), qué entró por camión, y el stock inicial /
// final de cada día por producto.
//
//   node scripts/historico-ventas-stock.mjs            → resumen por día
//   node scripts/historico-ventas-stock.mjs --detalle  → + detalle por producto
//   node scripts/historico-ventas-stock.mjs --json     → JSON (para el reporte web)
//
// El stock se RECONSTRUYE hacia atrás desde el stock de hoy:
//   stock al cierre del día D = stock de hoy + vendido después de D − recibido después de D
// Solo contempla ventas (remitos) y recepciones de camión; las correcciones de
// stock hechas a mano desde Productos no quedan registradas y no se ven acá.
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(
  readFileSync(new URL("../serviceAccountKey.json", import.meta.url))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const detalle = process.argv.includes("--detalle");
const asJson = process.argv.includes("--json");

const diaKey = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const nombreDia = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
};

const [remSnap, prodSnap, truckSnap, cierreSnap] = await Promise.all([
  db.collection("remitos").get(),
  db.collection("products").get(),
  db.collection("trucks").get(),
  db.collection("cashClosings").get(),
]);

const prods = new Map();
prodSnap.docs.forEach((p) => prods.set(p.id, { ...p.data(), id: p.id }));

const cierres = new Map();
cierreSnap.docs.forEach((c) => cierres.set(c.id, c.data()));

// ---- Agrupar ventas por día ----
const dias = new Map(); // key -> { ventas, unidades, efectivo, transf, cheque, anulados, prod: Map }
const tocar = (key) => {
  if (!dias.has(key))
    dias.set(key, {
      key,
      ventas: 0,
      unidades: 0,
      efectivo: 0,
      transf: 0,
      cheque: 0,
      anulados: 0,
      prod: new Map(),
      recibido: new Map(),
    });
  return dias.get(key);
};

const remitos = remSnap.docs.map((x) => x.data());
for (const r of remitos) {
  const k = diaKey(r.fecha);
  const dd = tocar(k);
  if (r.anulado) {
    dd.anulados++;
    continue;
  }
  dd.ventas++;
  const fp = r.formaPago ?? "efectivo";
  if (fp === "efectivo") dd.efectivo += r.total || 0;
  else if (fp === "transferencia") dd.transf += r.total || 0;
  else if (fp === "cheque") dd.cheque += r.total || 0;
  for (const it of r.items ?? []) {
    dd.unidades += it.cantidad || 0;
    const cur = dd.prod.get(it.productId) ?? {
      nombre: it.nombre,
      u: 0,
      plata: 0,
    };
    cur.u += it.cantidad || 0;
    cur.plata += (it.cantidad || 0) * (it.precioVenta || 0);
    dd.prod.set(it.productId, cur);
  }
}

// ---- Recepciones de camión por día ----
for (const t of truckSnap.docs.map((x) => x.data())) {
  if (!t.fechaIngreso) continue;
  const dd = tocar(diaKey(t.fechaIngreso));
  for (const c of t.carga ?? []) {
    dd.recibido.set(
      c.productId,
      (dd.recibido.get(c.productId) ?? 0) + (c.cantidadUnidades || 0)
    );
  }
}

const keys = [...dias.keys()].sort();

// ---- Reconstruir el stock hacia atrás ----
// Arrancamos del stock de HOY y vamos deshaciendo día por día, del más nuevo al
// más viejo: antes de las ventas de ese día había MÁS; antes de la recepción, MENOS.
const stockFin = new Map(); // key -> Map(productId -> stock al cierre de ese día)
const cursor = new Map();
prods.forEach((p, id) => cursor.set(id, p.stock ?? 0));

for (let i = keys.length - 1; i >= 0; i--) {
  const k = keys[i];
  const dd = dias.get(k);
  // El stock al CIERRE de este día es el cursor actual.
  stockFin.set(k, new Map(cursor));
  // Rebobinar este día para obtener el cierre del día anterior.
  dd.prod.forEach((v, id) => cursor.set(id, (cursor.get(id) ?? 0) + v.u));
  dd.recibido.forEach((u, id) => cursor.set(id, (cursor.get(id) ?? 0) - u));
}

// ---- Salida ----
const salida = keys.map((k) => {
  const dd = dias.get(k);
  const fin = stockFin.get(k);
  const filas = [...dd.prod.entries()]
    .map(([id, v]) => {
      const sf = fin.get(id) ?? 0;
      const rec = dd.recibido.get(id) ?? 0;
      return {
        producto: v.nombre,
        vendidas: v.u,
        plata: v.plata,
        recibidas: rec,
        stockInicial: sf + v.u - rec,
        stockFinal: sf,
      };
    })
    .sort((a, b) => b.vendidas - a.vendidas);
  // Productos que SOLO recibieron ese día (no se vendieron)
  dd.recibido.forEach((rec, id) => {
    if (dd.prod.has(id)) return;
    const sf = fin.get(id) ?? 0;
    filas.push({
      producto: prods.get(id)?.nombre ?? id,
      vendidas: 0,
      plata: 0,
      recibidas: rec,
      stockInicial: sf - rec,
      stockFinal: sf,
    });
  });
  const c = cierres.get(k);
  return {
    dia: k,
    nombre: nombreDia(k),
    ventas: dd.ventas,
    anulados: dd.anulados,
    unidades: dd.unidades,
    efectivo: dd.efectivo,
    transferencia: dd.transf,
    cheque: dd.cheque,
    total: dd.efectivo + dd.transf + dd.cheque,
    caja: c
      ? {
          cerrado: !!c.cerrado,
          cajaInicial: c.cajaInicial ?? 0,
          esperado: c.efectivoEsperado ?? 0,
          contado: c.efectivoContado ?? 0,
          diferencia: c.diferencia ?? 0,
        }
      : null,
    productos: filas,
  };
});

if (asJson) {
  console.log(JSON.stringify(salida, null, 2));
  process.exit(0);
}

console.log(`\n${"=".repeat(104)}`);
console.log(`HISTORICO DE VENTAS Y STOCK  ·  ${keys[0]} → ${keys[keys.length - 1]}  ·  ${keys.length} dias con movimiento`);
console.log(`${"=".repeat(104)}\n`);
console.log(
  `  ${"Dia".padEnd(22)} ${"Vtas".padStart(5)} ${"Unid.".padStart(7)} ${"Efectivo".padStart(15)} ${"Otros".padStart(13)} ${"TOTAL".padStart(15)}`
);
console.log(`  ${"-".repeat(86)}`);

let tU = 0, tE = 0, tO = 0;
for (const s of salida) {
  tU += s.unidades;
  tE += s.efectivo;
  tO += s.transferencia + s.cheque;
  const otros = s.transferencia + s.cheque;
  console.log(
    `  ${s.nombre.padEnd(22)} ${String(s.ventas).padStart(5)} ${String(s.unidades).padStart(7)} ${ars(s.efectivo).padStart(15)} ${(otros ? ars(otros) : "—").padStart(13)} ${ars(s.total).padStart(15)}`
  );
}
console.log(`  ${"-".repeat(86)}`);
console.log(
  `  ${"TOTAL".padEnd(22)} ${"".padStart(5)} ${String(tU).padStart(7)} ${ars(tE).padStart(15)} ${ars(tO).padStart(13)} ${ars(tE + tO).padStart(15)}\n`
);

if (detalle) {
  for (const s of salida) {
    console.log(`\n${"-".repeat(104)}`);
    console.log(`${s.nombre.toUpperCase()}   ${s.ventas} ventas · ${s.unidades} u. · ${ars(s.total)}${s.anulados ? ` · ${s.anulados} anulado(s)` : ""}`);
    console.log(
      `  ${"Producto".padEnd(44)} ${"St.ini".padStart(7)} ${"Recib".padStart(6)} ${"Vend".padStart(6)} ${"St.fin".padStart(7)} ${"Plata".padStart(14)}`
    );
    for (const f of s.productos) {
      console.log(
        `  ${f.producto.slice(0, 44).padEnd(44)} ${String(f.stockInicial).padStart(7)} ${(f.recibidas || "—").toString().padStart(6)} ${String(f.vendidas).padStart(6)} ${String(f.stockFinal).padStart(7)} ${ars(f.plata).padStart(14)}`
      );
    }
  }
  console.log();
}
process.exit(0);
