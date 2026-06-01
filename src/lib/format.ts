// Formato regional Argentina (es-AR / ARS)

export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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
