// Pruebas de la calculadora de costo logístico. Corren con: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { repartirFlete, type LineaCarga } from "./logistica.ts";

// Dos productos: A ocupa el doble de volumen que B por bulto.
const A: LineaCarga = { ean: "A", nombre: "Grande", bultos: 1, m3Bulto: 0.2, pesoBultoKg: 3, paqPorBulto: 10 };
const B: LineaCarga = { ean: "B", nombre: "Chico", bultos: 1, m3Bulto: 0.1, pesoBultoKg: 6, paqPorBulto: 20 };

test("reparte por volumen en proporción al m³", () => {
  const r = repartirFlete(30000, [A, B], "volumen");
  // A = 0.2 m³, B = 0.1 m³ → A se lleva 2/3, B 1/3
  assert.equal(r.lineas[0].costoLinea, 20000);
  assert.equal(r.lineas[1].costoLinea, 10000);
});

test("por peso el reparto se invierte (B pesa el doble)", () => {
  const r = repartirFlete(30000, [A, B], "peso");
  // A = 3 kg, B = 6 kg → A 1/3, B 2/3
  assert.equal(r.lineas[0].costoLinea, 10000);
  assert.equal(r.lineas[1].costoLinea, 20000);
});

test("el costo por paquete divide por unidades del bulto", () => {
  const r = repartirFlete(30000, [A, B], "volumen");
  // A: $20000 / (10 paq × 1 bulto) = $2000/paq
  assert.equal(r.lineas[0].costoPorPaquete, 2000);
  // B: $10000 / 20 = $500/paq
  assert.equal(r.lineas[1].costoPorPaquete, 500);
});

test("más bultos del mismo producto = más volumen = más costo", () => {
  const r = repartirFlete(30000, [{ ...A, bultos: 2 }, B], "volumen");
  // A ahora 0.4 m³, B 0.1 → A 4/5, B 1/5
  assert.equal(r.lineas[0].costoLinea, 24000);
  assert.equal(r.lineas[1].costoLinea, 6000);
  // pero el costo POR bulto de A baja: se reparte entre 2
  assert.equal(r.lineas[0].costoPorBulto, 12000);
});

test("la suma de las líneas cierra EXACTO con el flete (sin centavos perdidos)", () => {
  // Números feos a propósito, para forzar el redondeo.
  const r = repartirFlete(13333.37, [
    { ...A, m3Bulto: 0.077 },
    { ...B, m3Bulto: 0.033 },
    { ean: "C", nombre: "Otro", bultos: 3, m3Bulto: 0.019, pesoBultoKg: 1, paqPorBulto: 8 },
  ]);
  const suma = r.lineas.reduce((s, l) => s + l.costoLinea, 0);
  assert.equal(Math.round(suma * 100) / 100, 13333.37);
  assert.equal(r.sinRepartir, 0);
});

test("un producto sin medidas no rompe: si NADIE tiene volumen, no se inventa nada", () => {
  const r = repartirFlete(30000, [
    { ...A, m3Bulto: 0 },
    { ...B, m3Bulto: 0 },
  ], "volumen");
  assert.equal(r.magnitudTotal, 0);
  assert.equal(r.lineas[0].costoLinea, 0);
  assert.equal(r.sinRepartir, 30000); // queda todo sin repartir, y se avisa
});

test("las líneas con 0 bultos se ignoran", () => {
  const r = repartirFlete(30000, [A, { ...B, bultos: 0 }], "volumen");
  assert.equal(r.lineas.length, 1);
  assert.equal(r.lineas[0].costoLinea, 30000);
});
