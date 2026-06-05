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

export const PALETAS: Paleta[] = [
  { id: "violeta", label: "Violeta marca", bg: "linear-gradient(135deg,#6b46a8,#9f7aea)", acento: "#6b46a8" },
  { id: "rosa", label: "Rosa Doncella", bg: "linear-gradient(135deg,#db2777,#f472b6)", acento: "#be185d" },
  { id: "celeste", label: "Celeste Nonisec", bg: "linear-gradient(135deg,#0284c7,#38bdf8)", acento: "#0369a1" },
  { id: "esmeralda", label: "Esmeralda", bg: "linear-gradient(135deg,#059669,#34d399)", acento: "#047857" },
  { id: "naranja", label: "Naranja oferta", bg: "linear-gradient(135deg,#ea580c,#f59e0b)", acento: "#c2410c" },
  { id: "rojo", label: "Rojo promo", bg: "linear-gradient(135deg,#dc2626,#f97316)", acento: "#b91c1c" },
  { id: "dorado", label: "Dorado", bg: "linear-gradient(135deg,#d97706,#fbbf24)", acento: "#b45309" },
  { id: "teal", label: "Verde agua", bg: "linear-gradient(135deg,#0d9488,#22d3ee)", acento: "#0f766e" },
  { id: "indigo", label: "Índigo noche", bg: "linear-gradient(135deg,#4338ca,#6366f1)", acento: "#3730a3" },
  { id: "oscuro", label: "Elegante oscuro", bg: "linear-gradient(135deg,#1e293b,#0f172a)", acento: "#0f172a" },
];

export function getPaleta(id: string): Paleta {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}

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
  mostrarPrecio: boolean;
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
  // titulo puede quedar vacío → lo borramos explícitamente.
  const data = clean(input);
  if (!("titulo" in data)) data.titulo = null;
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
