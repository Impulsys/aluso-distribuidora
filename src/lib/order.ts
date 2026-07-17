import type { CartItem, Product } from "./types";
import { formatARS } from "./format";
import { waLink } from "./whatsapp";

// Consulta de UN producto puntual.
export function consultaProductoLink(p: Product): string {
  const precio =
    p.precioVenta > 0 ? ` — ${formatARS(p.precioVenta)}` : " (consultar precio)";
  const msg =
    `Hola ALUSO DISTRIBUIDORA 👋\n` +
    `Quería consultar por este producto:\n\n` +
    `• ${p.nombre}${precio}\n` +
    (p.ean ? `  Cód: ${p.ean}\n\n` : "\n") +
    `¿Me pasan disponibilidad y precio mayorista?`;
  return waLink(msg);
}

// Pedido completo del carrito.
export function pedidoCarritoLink(
  items: CartItem[],
  total: number,
  cliente?: { nombre?: string; nota?: string }
): string {
  const algunoSinPrecio = items.some((i) => i.precioVenta <= 0);

  const lineas = items
    .map((i) => {
      const subtotal =
        i.precioVenta > 0
          ? ` — ${formatARS(i.precioVenta * i.cantidad)}`
          : " (precio a confirmar)";
      return `• ${i.cantidad}x ${i.nombre}${subtotal}`;
    })
    .join("\n");

  const totalLinea = algunoSinPrecio
    ? "*Total: a confirmar*"
    : `*Total: ${formatARS(total)}*`;

  const msg =
    `Hola ALUSO DISTRIBUIDORA 👋\n` +
    `Quiero hacer este *pedido*:\n\n` +
    `${lineas}\n\n` +
    `${totalLinea}` +
    (cliente?.nombre ? `\n\nNombre: ${cliente.nombre}` : "") +
    (cliente?.nota ? `\nNota: ${cliente.nota}` : "");

  return waLink(msg);
}

