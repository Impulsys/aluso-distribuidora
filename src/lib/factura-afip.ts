// Emisión de factura electrónica AFIP vía Cloud Function (emitirFactura).
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Factura } from "./types";

export interface EmitirFacturaInput {
  remitoId: string;
  tipo: "A" | "B";
  clienteCuit?: string;
  clienteCondicionIva?:
    | "responsable_inscripto"
    | "monotributo"
    | "exento"
    | "consumidor_final";
  clienteNombre?: string;
}

const fn = httpsCallable<EmitirFacturaInput, Factura & { yaExistia?: boolean }>(
  functions,
  "emitirFactura"
);

/** Emite la factura en AFIP y devuelve el comprobante (con CAE, número y QR). */
export async function emitirFacturaAfip(
  input: EmitirFacturaInput
): Promise<Factura & { yaExistia?: boolean }> {
  const res = await fn(input);
  return res.data;
}

/** Traduce el error de la Cloud Function a algo legible. */
export function mensajeFacturaError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  return msg || "No se pudo emitir la factura. Reintentá en unos minutos.";
}
