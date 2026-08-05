import { test } from "node:test";
import assert from "node:assert/strict";
import { saldoFletero, saldosPorFletero, deudaTotalFletes } from "./fleteSaldo.ts";
import type { Fletero, MovimientoFlete } from "./types.ts";

const mov = (p: Partial<MovimientoFlete>): MovimientoFlete =>
  ({
    id: Math.random().toString(36).slice(2),
    fleteroId: "f1",
    tipo: "cargo",
    monto: 0,
    fecha: 0,
    createdAt: 0,
    ...p,
  }) as MovimientoFlete;

const fletero = (id: string, nombre: string): Fletero =>
  ({ id, nombre, createdAt: 0 }) as Fletero;

test("saldo = cargos − pagos", () => {
  const movs = [
    mov({ tipo: "cargo", monto: 10000 }),
    mov({ tipo: "cargo", monto: 5000 }),
    mov({ tipo: "pago", monto: 8000 }),
  ];
  const s = saldoFletero("f1", movs);
  assert.equal(s.cargos, 15000);
  assert.equal(s.pagos, 8000);
  assert.equal(s.saldo, 7000);
  assert.equal(s.movimientos, 3);
});

test("cada fletero tiene su propia cuenta (no se mezclan)", () => {
  const movs = [
    mov({ fleteroId: "f1", tipo: "cargo", monto: 10000 }),
    mov({ fleteroId: "f2", tipo: "cargo", monto: 3000 }),
  ];
  assert.equal(saldoFletero("f1", movs).saldo, 10000);
  assert.equal(saldoFletero("f2", movs).saldo, 3000);
});

test("si le pagaste de más, el saldo queda negativo (no se tapa)", () => {
  const movs = [mov({ tipo: "cargo", monto: 5000 }), mov({ tipo: "pago", monto: 7000 })];
  assert.equal(saldoFletero("f1", movs).saldo, -2000);
});

test("saldosPorFletero ordena por deuda descendente", () => {
  const fleteros = [fletero("chico", "Chico"), fletero("grande", "Grande")];
  const movs = [
    mov({ fleteroId: "chico", tipo: "cargo", monto: 1000 }),
    mov({ fleteroId: "grande", tipo: "cargo", monto: 9000 }),
  ];
  const s = saldosPorFletero(fleteros, movs);
  assert.equal(s[0].fleteroId, "grande");
  assert.equal(s[1].nombre, "Chico");
});

test("deuda total suma las cuentas de todos los fletes", () => {
  const fleteros = [fletero("f1", "A"), fletero("f2", "B")];
  const movs = [
    mov({ fleteroId: "f1", tipo: "cargo", monto: 10000 }),
    mov({ fleteroId: "f1", tipo: "pago", monto: 4000 }),
    mov({ fleteroId: "f2", tipo: "cargo", monto: 2000 }),
  ];
  assert.equal(deudaTotalFletes(fleteros, movs), 8000);
});
