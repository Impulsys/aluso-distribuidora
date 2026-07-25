// Pruebas del motor de comisiones. Corren con: npm test
// Los casos salen del ejemplo que dio el cliente: X vende, trae a "a" y "b",
// y cobra su 3% + 3% sobre lo de ellos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularComisiones, type VendedorComision } from "./comisiones.ts";

const X: VendedorComision = { uid: "x", nombre: "X" };
const Y: VendedorComision = { uid: "y", nombre: "Y" };
const A: VendedorComision = { uid: "a", nombre: "a", reclutadoPor: "x" };
const B: VendedorComision = { uid: "b", nombre: "b", reclutadoPor: "x" };

test("un vendedor sin reclutados cobra solo su 3%", () => {
  const r = calcularComisiones([Y], [{ vendedorUid: "y", monto: 1_000_000 }]);
  assert.equal(r[0].comisionPropia, 30000);
  assert.equal(r[0].overrideTotal, 0);
  assert.equal(r[0].total, 30000);
});

test("el reclutador cobra su 3% + 3% de lo que venden sus reclutados", () => {
  const r = calcularComisiones(
    [X, A, B],
    [
      { vendedorUid: "x", monto: 1_000_000 }, // X vende
      { vendedorUid: "a", monto: 500_000 }, // a vende
      { vendedorUid: "b", monto: 300_000 }, // b vende
    ]
  );
  const x = r.find((v) => v.uid === "x")!;
  assert.equal(x.comisionPropia, 30000); // 3% de 1.000.000
  assert.equal(x.overrideTotal, 24000); // 3% de (500.000 + 300.000)
  assert.equal(x.total, 54000);
  assert.equal(x.overridePorReclutado.length, 2);
});

test("el reclutado cobra su propio 3%, sin override", () => {
  const r = calcularComisiones(
    [X, A],
    [{ vendedorUid: "a", monto: 500_000 }]
  );
  const a = r.find((v) => v.uid === "a")!;
  assert.equal(a.comisionPropia, 15000);
  assert.equal(a.overrideTotal, 0);
  assert.equal(a.total, 15000);
});

test("un % de comisión propio del vendedor pisa el default", () => {
  const r = calcularComisiones(
    [{ uid: "z", nombre: "Z", comisionPct: 5 }],
    [{ vendedorUid: "z", monto: 1_000_000 }]
  );
  assert.equal(r[0].comisionPropia, 50000); // 5%, no 3%
});

test("el override usa el % configurado", () => {
  const r = calcularComisiones(
    [X, A],
    [{ vendedorUid: "a", monto: 1_000_000 }],
    { comisionDefaultPct: 3, overridePct: 2 }
  );
  const x = r.find((v) => v.uid === "x")!;
  assert.equal(x.overrideTotal, 20000); // 2% de 1.000.000
});

test("un vendedor sin ventas en el período cobra 0", () => {
  const r = calcularComisiones([Y], []);
  assert.equal(r[0].total, 0);
});
