// Pruebas del motor de precios. Corren con el runner de Node (sin dependencias):
//   npm test
//
// Los casos salen de lo que escribió el cliente en el formulario, no de lo que
// a mí me pareció: cada test lleva la frase que lo justifica.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrecio,
  CONFIG_PRECIOS_DEFAULT,
  type PerfilPrecioCliente,
  type CondicionesVenta,
  // Con la extensión: el runner de Node resuelve como ESM y la exige.
  // Por eso tsconfig tiene `allowImportingTsExtensions` (válido con noEmit).
} from "./precios.ts";

const DISTRIBUIDOR: PerfilPrecioCliente = { listaTipo: "distribuidor" };
const base: CondicionesVenta = {
  formaPago: "transferencia",
  retiraEnDeposito: false,
  bultos: 10,
};

test("sin ninguna condición cobra la lista distribuidor tal cual", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, base);
  assert.equal(d.final, 10000);
  assert.equal(d.origenBase, "lista_distribuidor");
  assert.equal(d.ajustes.length, 0);
});

// "si pago en efectivo se le hace el 2,5% de desc"
test("efectivo descuenta 2,5%", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, { ...base, formaPago: "efectivo" });
  assert.equal(d.final, 9750);
});

// "si retira por el depo el 3%"
test("retiro en depósito descuenta 3%", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, { ...base, retiraEnDeposito: true });
  assert.equal(d.final, 9700);
});

// "y si supera los 150 bultos el 3%"
test("más de 150 bultos descuenta 3%", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, { ...base, bultos: 150 });
  assert.equal(d.final, 9700);
});

test("149 bultos NO alcanza el descuento por volumen", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, { ...base, bultos: 149 });
  assert.equal(d.final, 10000);
});

// "Los descuentos pueden ser acumulables"
test("los tres descuentos juntos suman 8,5%", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, {
    formaPago: "efectivo",
    retiraEnDeposito: true,
    bultos: 200,
  });
  assert.equal(d.final, 9150); // 10000 - 8,5%
  assert.equal(d.ajustes.length, 3);
});

// "este ultimo descuento no aplica para las ventas de los vendedores a y b
//  xq ellos se llevan ese 3% como comisión"
test("un vendedor reclutado NO da el descuento por volumen, pero sí los otros", () => {
  const d = calcularPrecio(10000, 6000, DISTRIBUIDOR, {
    formaPago: "efectivo",
    retiraEnDeposito: true,
    bultos: 200,
    vendedorReclutado: true,
  });
  assert.equal(d.final, 9450); // solo 2,5 + 3 = 5,5%
  assert.equal(d.ajustes.length, 2);
});

// "hay un cliente que se le suma el 11% del costo"
test("lista especial cobra costo + markup e ignora la lista", () => {
  const perfil: PerfilPrecioCliente = { listaTipo: "especial", markupSobreCostoPct: 11 };
  const d = calcularPrecio(10000, 6000, perfil, base);
  assert.equal(d.final, 6660); // 6000 + 11%
  assert.equal(d.origenBase, "costo_mas_markup");
});

test("a la lista especial no se le encima ningún descuento", () => {
  const perfil: PerfilPrecioCliente = { listaTipo: "especial", markupSobreCostoPct: 15 };
  const d = calcularPrecio(10000, 6000, perfil, {
    formaPago: "efectivo",
    retiraEnDeposito: true,
    bultos: 500,
  });
  assert.equal(d.final, 6900); // 6000 + 15%, sin tocar
  assert.equal(d.ajustes.length, 0);
});

// "en el caso que sea transfer se le suma el 2.5%, él es al unico que se le suma"
test("el recargo por transferencia se aplica solo a ese cliente y solo si transfiere", () => {
  const perfil: PerfilPrecioCliente = { listaTipo: "distribuidor", recargoTransferenciaPct: 2.5 };
  const conTransf = calcularPrecio(10000, 6000, perfil, { ...base, formaPago: "transferencia" });
  assert.equal(conTransf.final, 10250);

  // Este es EL dolor que contaron: pagando en efectivo se recalcula solo.
  const conEfectivo = calcularPrecio(10000, 6000, perfil, { ...base, formaPago: "efectivo" });
  assert.equal(conEfectivo.final, 9750); // sin recargo y con el 2,5% de descuento

  const otroCliente = calcularPrecio(10000, 6000, DISTRIBUIDOR, base);
  assert.equal(otroCliente.final, 10000); // a los demás no se les suma nada
});

test("el desglose cierra exactamente con el total", () => {
  const d = calcularPrecio(13333, 6000, DISTRIBUIDOR, {
    formaPago: "efectivo",
    retiraEnDeposito: true,
    bultos: 300,
  });
  const suma = d.ajustes.reduce((s, a) => s + a.monto, 0);
  assert.equal(Math.round((d.base + suma) * 100) / 100, d.final);
});

test("modo sucesivo da menos descuento que sumando", () => {
  const cond: CondicionesVenta = {
    formaPago: "efectivo",
    retiraEnDeposito: true,
    bultos: 200,
  };
  const sumando = calcularPrecio(10000, 6000, DISTRIBUIDOR, cond);
  const sucesivo = calcularPrecio(10000, 6000, DISTRIBUIDOR, cond, {
    ...CONFIG_PRECIOS_DEFAULT,
    acumulaSumando: false,
  });
  // sumando:  10000 - 8,5%                        = 9150
  // sucesivo: 10000 × 0,975 × 0,97 × 0,97         = 9173,78
  // Son $23,78 de diferencia cada $10.000 vendidos: sobre una venta de
  // $500.000 son casi $1.200. Por eso hay que preguntárselo y no elegirlo yo.
  assert.equal(sumando.final, 9150);
  assert.equal(sucesivo.final, 9173.78);
  assert.ok(sucesivo.final > sumando.final);
});

test("precio 0 (Consultar precio) no se rompe ni inventa números", () => {
  const d = calcularPrecio(0, 0, DISTRIBUIDOR, { ...base, formaPago: "efectivo" });
  assert.equal(d.final, 0);
});
