import { test } from "node:test";
import assert from "node:assert/strict";
import { armarPallet, type BultoAColocar } from "./pallet.ts";

const caja = (
  pedidoId: string,
  ancho: number,
  prof: number,
  alto: number
): BultoAColocar => ({ pedidoId, etiqueta: pedidoId, color: "#000", ancho, prof, alto });

test("un solo bulto va en el origen del primer pallet", () => {
  const r = armarPallet([caja("p1", 40, 30, 30)]);
  assert.equal(r.pallets, 1);
  assert.deepEqual(
    { x: r.cajas[0].x, y: r.cajas[0].y, z: r.cajas[0].z, pallet: r.cajas[0].pallet },
    { x: 0, y: 0, z: 0, pallet: 0 }
  );
});

test("dos bultos que entran a lo ancho van uno al lado del otro", () => {
  const r = armarPallet([caja("p1", 40, 30, 30), caja("p1", 40, 30, 30)], {
    ancho: 120,
    prof: 100,
    alto: 180,
  });
  assert.equal(r.cajas[0].x, 0);
  assert.equal(r.cajas[1].x, 40); // al lado
  assert.equal(r.cajas[1].y, 0);
  assert.equal(r.cajas[1].z, 0);
});

test("cuando no entra a lo ancho, pasa a la fila de atrás", () => {
  // pallet de 60 de ancho: entra 1 por fila de 40
  const r = armarPallet(
    [caja("p1", 40, 30, 30), caja("p1", 40, 30, 30)],
    { ancho: 60, prof: 100, alto: 180 }
  );
  assert.equal(r.cajas[1].x, 0);
  assert.equal(r.cajas[1].y, 30); // fila de atrás
});

test("cuando no entra a lo profundo, arma una capa arriba", () => {
  // pallet 40 ancho × 30 prof: cada bulto ocupa toda la base → apila
  const r = armarPallet(
    [caja("p1", 40, 30, 25), caja("p1", 40, 30, 25)],
    { ancho: 40, prof: 30, alto: 180 }
  );
  assert.equal(r.cajas[1].z, 25); // segunda capa
});

test("cuando supera la altura, abre otro pallet", () => {
  const r = armarPallet(
    [caja("p1", 40, 30, 100), caja("p1", 40, 30, 100)],
    { ancho: 40, prof: 30, alto: 150 }
  );
  assert.equal(r.cajas[0].pallet, 0);
  assert.equal(r.cajas[1].pallet, 1); // no entra en altura
  assert.equal(r.pallets, 2);
});

test("ninguna caja se solapa con otra (mismo pallet)", () => {
  const bultos = Array.from({ length: 12 }, (_, i) => caja("p1", 40, 30, 20 + (i % 3) * 5));
  const r = armarPallet(bultos);
  const mismoP = r.cajas.filter((c) => c.pallet === 0);
  for (let i = 0; i < mismoP.length; i++) {
    for (let j = i + 1; j < mismoP.length; j++) {
      const a = mismoP[i], b = mismoP[j];
      const solapa =
        a.x < b.x + b.ancho && a.x + a.ancho > b.x &&
        a.y < b.y + b.prof && a.y + a.prof > b.y &&
        a.z < b.z + b.alto && a.z + a.alto > b.z;
      assert.ok(!solapa, `cajas ${i} y ${j} se solapan`);
    }
  }
});

test("sin bultos, cero pallets", () => {
  assert.equal(armarPallet([]).pallets, 0);
});

test("separarPedidos: dos clientes chicos = dos pallets (no se surten)", () => {
  // Sin separar, estos dos bultos chiquitos entran en el mismo pallet.
  const bultos = [caja("p1", 40, 30, 30), caja("p2", 40, 30, 30)];
  assert.equal(armarPallet(bultos).pallets, 1);
  // Separando por pedido, cada cliente tiene el suyo.
  const r = armarPallet(bultos, undefined, { separarPedidos: true });
  assert.equal(r.pallets, 2);
  assert.equal(r.cajas.find((c) => c.pedidoId === "p1")!.pallet, 0);
  assert.equal(r.cajas.find((c) => c.pedidoId === "p2")!.pallet, 1);
});

test("separarPedidos: un mismo pedido grande sigue usando varios pallets", () => {
  const bultos = [caja("p1", 40, 30, 100), caja("p1", 40, 30, 100)];
  const r = armarPallet(bultos, { ancho: 40, prof: 30, alto: 150 }, { separarPedidos: true });
  assert.equal(r.pallets, 2); // no entra en altura → segundo pallet, mismo pedido
});
