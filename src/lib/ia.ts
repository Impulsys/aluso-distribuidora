// Cliente del módulo de IA: llama a las Cloud Functions (análisis, chat, lectura
// de factura) y arma el CONTEXTO del sistema para que el asistente "vea" todo.
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Cliente, Product, Remito } from "./types";

export interface RecomendacionIA {
  producto?: string;
  razon?: string;
  sugerencia?: string;
}
export interface AnalisisVentas {
  periodoDias: number;
  masVendidos: { nombre: string; vendidas: number; stock: number; ingresos: number }[];
  totalVentas: number;
  resumen: string;
  recomendaciones: RecomendacionIA[];
  observaciones: string[];
}

export async function analizarVentasIA(dias: number): Promise<AnalisisVentas> {
  const call = httpsCallable(functions, "analizarVentas");
  const res = await call({ dias });
  return res.data as AnalisisVentas;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export async function chatConIA(
  messages: ChatMsg[],
  contexto: string
): Promise<string> {
  const call = httpsCallable(functions, "chatIA");
  const res = await call({ messages, contexto });
  return (res.data as { reply: string }).reply;
}

const ars = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR");

/**
 * Arma un PANORAMA compacto de TODO el sistema (ventas, stock, faltantes, deudas,
 * clientes) para pasárselo a la IA como contexto. No manda datos crudos: resume.
 */
export function construirContextoSistema(
  productos: Product[],
  remitos: Remito[],
  clientes: Cliente[],
  ahora: number
): string {
  const d30 = ahora - 30 * 24 * 60 * 60 * 1000;
  const ventas30 = remitos.filter((r) => !r.anulado && r.fecha >= d30);
  const totalVentas30 = ventas30.reduce((s, r) => s + (r.total || 0), 0);

  const aggUnid = new Map<string, number>();
  ventas30.forEach((r) =>
    (r.items ?? []).forEach((it) => {
      aggUnid.set(it.nombre, (aggUnid.get(it.nombre) ?? 0) + (it.cantidad || 0));
    })
  );
  const topVendidos = [...aggUnid.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([n, u]) => `${n}: ${Math.round(u)} u`);

  const faltantes = productos
    .filter((p) => (p.stock ?? 0) < 0)
    .map((p) => `${p.nombre} (${p.stock})`);
  const stockBajo = productos
    .filter((p) => (p.stock ?? 0) >= 0 && (p.stock ?? 0) < 10)
    .map((p) => p.nombre);

  const deuda = new Map<string, number>();
  remitos
    .filter((r) => !r.anulado && !r.cobrado)
    .forEach((r) =>
      deuda.set(
        r.clienteNombre || "—",
        (deuda.get(r.clienteNombre || "—") ?? 0) + (r.total || 0)
      )
    );
  const deudaTotal = [...deuda.values()].reduce((s, v) => s + v, 0);
  const topDeudores = [...deuda.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c, m]) => `${c}: ${ars(m)}`);

  return [
    `PANORAMA DEL NEGOCIO (ALUSO Distribuidora), generado del sistema:`,
    ``,
    `Catálogo: ${productos.length} productos activos.`,
    `Clientes: ${clientes.length} en el CRM.`,
    ``,
    `VENTAS últimos 30 días: ${ars(totalVentas30)} en ${ventas30.length} remitos.`,
    `Más vendidos (30d): ${topVendidos.join(" · ") || "sin ventas"}.`,
    ``,
    `STOCK NEGATIVO (faltantes a reponer): ${
      faltantes.length ? faltantes.join(" · ") : "ninguno"
    }.`,
    `Stock bajo (<10): ${stockBajo.slice(0, 20).join(" · ") || "ninguno"}.`,
    ``,
    `DEUDA de clientes (ventas no cobradas): ${ars(deudaTotal)} total.`,
    `Mayores deudores: ${topDeudores.join(" · ") || "ninguno"}.`,
  ].join("\n");
}
