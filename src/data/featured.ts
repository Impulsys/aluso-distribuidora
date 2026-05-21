// IDs (EAN) de productos destacados que aparecen en el banner superior.
// Hasta 3. Vacío = no se muestra banner.
//
// 🔄 En la Fase 4 (Admin), el switch "Destacado" de cada producto reemplaza
//    este archivo escribiendo en Firestore (config/featured). Por ahora,
//    hardcoded para demo.

export const FEATURED_IDS: string[] = [
  "7790940410245", // Pañal adulto anatómico ultra grande (Nonisec)
  "7790940216205", // Toalla pocket tanga con alas (Doncella)
  "7790940233240", // Protector diario pocket anatómico sin perfume x20 (Doncella)
];

// Precios de oferta opcionales por id. Si está y es menor a precioVenta,
// se renderiza tachado el original y destacado el de oferta.
export const PRECIO_OFERTA: Record<string, number> = {
  // "7790940410245": 24990,
};
