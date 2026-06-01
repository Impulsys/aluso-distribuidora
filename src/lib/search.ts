// Utilidades de busqueda: insensible a mayusculas Y a acentos/diacriticos.
// Ej: "panal", "Panal" y "PANAL" coinciden todos entre si.

// Rango Unicode de marcas diacriticas combinantes (acentos, tilde de la ñ, etc.).
const DIACRITICOS = /[̀-ͯ]/g;

/** Pasa a minusculas y le saca los acentos/diacriticos. */
export function normalizar(s: string): string {
  return (s ?? "").normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

/** Devuelve true si `texto` contiene a `termino`, ignorando mayusculas y acentos. */
export function coincide(texto: string, termino: string): boolean {
  return normalizar(texto).includes(normalizar(termino));
}
