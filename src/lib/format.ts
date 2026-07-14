// Formato regional Argentina (es-AR / ARS)

export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Importe de un GASTO con su signo correcto.
 *
 * Un gasto normal es plata que SALE → "−$1.000". Pero la comisión de la
 * financiera puede ser negativa (descuento a favor): ahí la plata ENTRA →
 * "+$1.000". Antes se anteponía un "−" a mano al `formatARS`, y con montos
 * negativos salía el clásico "−−$1.000".
 */
export function formatGasto(monto: number): string {
  const v = formatARS(Math.abs(monto));
  return `${monto < 0 ? "+" : "−"}${v}`;
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ts));
}

export function daysBetween(from: number, to: number): number {
  // Días redondeados HACIA ARRIBA — si faltan unas horas, cuenta como 1 día.
  return Math.max(0, Math.ceil((to - from) / 86_400_000));
}

// Parsea "YYYY-MM-DD" como fecha LOCAL (evita el corrimiento de día por UTC).
export function tsFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

// Timestamp → "YYYY-MM-DD" en hora LOCAL (para inputs type=date).
export function isoFromTs(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
