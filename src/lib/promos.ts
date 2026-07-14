// Promociones: banner destacado del catálogo (carrusel). CRUD + paletas.
// Lectura pública (el catálogo las muestra); escritura solo superadmin.
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./bitacora";
import type { Promocion } from "./types";

// ===== Paletas prediseñadas (gradientes curados) =====
// Se usan como CSS inline (no clases Tailwind) para que el build estático no
// las purgue. `acento` = color fuerte para el cartel/botón sobre fondo claro.
export interface Paleta {
  id: string;
  label: string;
  bg: string; // gradiente CSS
  acento: string; // color para texto del cartel y del botón
}

// Colores de fondo SÓLIDOS (tono claro). `acento` = color fuerte para el
// cartel/botón sobre el fondo claro.
export const PALETAS: Paleta[] = [
  { id: "violeta", label: "Violeta", bg: "#ddd6fe", acento: "#6b46a8" },
  { id: "rosa", label: "Rosa", bg: "#fbcfe8", acento: "#be185d" },
  { id: "celeste", label: "Celeste", bg: "#bae6fd", acento: "#0369a1" },
  { id: "esmeralda", label: "Esmeralda", bg: "#bbf7d0", acento: "#047857" },
  { id: "naranja", label: "Naranja", bg: "#fed7aa", acento: "#c2410c" },
  { id: "rojo", label: "Rojo", bg: "#fecaca", acento: "#b91c1c" },
  { id: "dorado", label: "Dorado", bg: "#fde68a", acento: "#b45309" },
  { id: "teal", label: "Verde agua", bg: "#99f6e4", acento: "#0f766e" },
  { id: "indigo", label: "Índigo", bg: "#c7d2fe", acento: "#3730a3" },
  { id: "oscuro", label: "Gris claro", bg: "#e2e8f0", acento: "#334155" },
];

export function getPaleta(id: string): Paleta {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}

// Color por defecto y opciones para las letras del anuncio.
export const COLOR_TEXTO_DEFAULT = "#1e293b";
export const COLORES_TEXTO = [
  "#1e293b", // gris oscuro
  "#000000", // negro
  "#ffffff", // blanco
  "#6b21a8", // violeta
  "#be185d", // rosa
  "#0369a1", // celeste
  "#047857", // verde
  "#b91c1c", // rojo
  "#b45309", // naranja
];

// Carteles sugeridos para el selector (igual admite texto libre).
export const BADGES_SUGERIDOS = [
  "OFERTA",
  "PROMOCIÓN",
  "PROMO",
  "2x1",
  "3x2",
  "LIQUIDACIÓN",
  "NUEVO",
];

// ===== CRUD =====
export interface NewPromoInput {
  productId: string;
  badge: string;
  titulo?: string;
  texto: string;
  paleta: string;
  colorTexto?: string;
  mostrarPrecio: boolean;
  cantidadLleva?: number;
  regaloProductId?: string;
  cantidadRegalo?: number;
  textoRegalo?: string;
  activo: boolean;
  orden: number;
}

export function subscribePromos(cb: (xs: Promocion[]) => void): () => void {
  return onSnapshot(collection(db, "promociones"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as Promocion), id: d.id }))
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.createdAt - b.createdAt)
    );
  });
}

// Campos opcionales: presentes solo si tienen valor (Firestore no acepta undefined).
const OPCIONALES = [
  "titulo",
  "colorTexto",
  "cantidadLleva",
  "regaloProductId",
  "cantidadRegalo",
  "textoRegalo",
] as const;

function clean(input: NewPromoInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    productId: input.productId,
    badge: input.badge.trim(),
    texto: input.texto.trim(),
    paleta: input.paleta,
    mostrarPrecio: input.mostrarPrecio,
    activo: input.activo,
    orden: input.orden,
  };
  if (input.titulo && input.titulo.trim()) out.titulo = input.titulo.trim();
  if (input.colorTexto) out.colorTexto = input.colorTexto;
  if (input.cantidadLleva && input.cantidadLleva > 0)
    out.cantidadLleva = input.cantidadLleva;
  // El regalo solo vale si se eligió un producto de regalo.
  if (input.regaloProductId) {
    out.regaloProductId = input.regaloProductId;
    out.cantidadRegalo =
      input.cantidadRegalo && input.cantidadRegalo > 0
        ? input.cantidadRegalo
        : 1;
    if (input.textoRegalo && input.textoRegalo.trim())
      out.textoRegalo = input.textoRegalo.trim();
  }
  return out;
}

export async function createPromo(input: NewPromoInput): Promise<string> {
  const ref = await addDoc(collection(db, "promociones"), {
    ...clean(input),
    createdAt: Date.now(),
  });
  logActivity("Creó promoción", {
    detalle: input.badge,
    entidad: "promocion",
    entidadId: ref.id,
  });
  return ref.id;
}

export async function updatePromo(
  id: string,
  input: NewPromoInput
): Promise<void> {
  // Los campos opcionales que queden vacíos se borran explícitamente (null).
  const data = clean(input);
  for (const k of OPCIONALES) {
    if (!(k in data)) data[k] = null;
  }
  // `orden` NO se toca al editar: no está en el formulario, viaja escondido con
  // el valor que tenía la promo cuando lo abriste. Si mientras tanto la moviste
  // con las flechas (setPromoOrden), guardar la edición revertía el orden.
  delete data.orden;
  await updateDoc(doc(db, "promociones", id), data);
  logActivity("Editó promoción", { entidad: "promocion", entidadId: id });
}

export async function setPromoActivo(
  id: string,
  activo: boolean
): Promise<void> {
  await updateDoc(doc(db, "promociones", id), { activo });
  logActivity(activo ? "Activó promoción" : "Desactivó promoción", {
    entidad: "promocion",
    entidadId: id,
  });
}

/** Cambia solo el orden (para reordenar el carrusel con ↑/↓). */
export async function setPromoOrden(id: string, orden: number): Promise<void> {
  await updateDoc(doc(db, "promociones", id), { orden });
}

export async function deletePromo(id: string): Promise<void> {
  await deleteDoc(doc(db, "promociones", id));
  logActivity("Eliminó promoción", { entidad: "promocion", entidadId: id });
}
