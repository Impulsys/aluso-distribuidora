import { test } from "node:test";
import assert from "node:assert/strict";
import { deudaPorCliente, esDeuda } from "./cobros.ts";
import type { Remito } from "./types.ts";

const remito = (p: Partial<Remito>): Remito =>
  ({
    id: Math.random().toString(36).slice(2),
    numero: "R-000001",
    items: [],
    subtotal: 0,
    total: 0,
    fecha: 0,
    formaPago: "efectivo",
    ...p,
  }) as Remito;

test("un remito no cobrado es deuda; uno cobrado no", () => {
  assert.equal(esDeuda(remito({ total: 100 })), true);
  assert.equal(esDeuda(remito({ total: 100, cobrado: true })), false);
  assert.equal(esDeuda(remito({ total: 100, anulado: true })), false);
});

test("suma vendido, cobrado y deuda por cliente", () => {
  const rs = [
    remito({ clienteId: "c1", clienteNombre: "Kiosco Sol", total: 1000 }),
    remito({ clienteId: "c1", clienteNombre: "Kiosco Sol", total: 500, cobrado: true }),
    remito({ clienteId: "c2", clienteNombre: "Almacén Luz", total: 300 }),
  ];
  const d = deudaPorCliente(rs, []);
  const c1 = d.find((x) => x.clienteId === "c1")!;
  assert.equal(c1.vendido, 1500);
  assert.equal(c1.cobrado, 500);
  assert.equal(c1.deuda, 1000);
  assert.equal(c1.pendientes, 1);
});

test("ordena por deuda descendente", () => {
  const rs = [
    remito({ clienteId: "chico", clienteNombre: "A", total: 100 }),
    remito({ clienteId: "grande", clienteNombre: "B", total: 9000 }),
  ];
  const d = deudaPorCliente(rs, []);
  assert.equal(d[0].clienteId, "grande");
});

test("los remitos anulados no cuentan", () => {
  const rs = [remito({ clienteId: "c1", clienteNombre: "X", total: 500, anulado: true })];
  assert.equal(deudaPorCliente(rs, []).length, 0);
});

test("ventas sin cliente identificable no arman cuenta corriente", () => {
  const rs = [remito({ total: 500 })];
  assert.equal(deudaPorCliente(rs, []).length, 0);
});

test("agrupa por nombre los remitos viejos sin clienteId", () => {
  const rs = [
    remito({ clienteNombre: "Don Pepe", total: 100 }),
    remito({ clienteNombre: "don pepe", total: 200, cobrado: true }),
  ];
  const d = deudaPorCliente(rs, []);
  assert.equal(d.length, 1);
  assert.equal(d[0].vendido, 300);
  assert.equal(d[0].deuda, 100);
});
