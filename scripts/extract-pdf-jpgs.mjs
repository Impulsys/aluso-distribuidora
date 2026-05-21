// Extrae JPEGs embebidos en un PDF sin dependencias externas.
// Funciona porque las imágenes JPG en PDFs se guardan como streams
// DCTDecode con los bytes JPEG sin recodificar (SOI=FFD8 FF .. EOI=FFD9).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ins = [
  "_cliente/Catalogo/CATÁLOGO LENTERDIT_compressed.pdf",
  "_cliente/Catalogo/CATÁLOGO LENTERDIT expo_compressed.pdf",
];
const out = "_cliente/_extracted_pdf_jpgs";
if (!existsSync(out)) mkdirSync(out, { recursive: true });

let total = 0;
for (const inPath of ins) {
  if (!existsSync(inPath)) { console.log("MISS:", inPath); continue; }
  const buf = readFileSync(inPath);
  const base = path.basename(inPath, ".pdf").replace(/[^\w-]/g, "_");
  let count = 0, i = 0;
  while (i < buf.length - 4) {
    // SOI
    if (buf[i] === 0xff && buf[i + 1] === 0xd8 && buf[i + 2] === 0xff) {
      // buscar EOI desde aquí
      let j = i + 2;
      while (j < buf.length - 1) {
        if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
          const slice = buf.subarray(i, j + 2);
          if (slice.length > 4096) {
            const fn = `${base}_${String(count).padStart(3, "0")}.jpg`;
            writeFileSync(path.join(out, fn), slice);
            count++;
          }
          i = j + 2;
          break;
        }
        j++;
      }
      if (j >= buf.length - 1) break;
    } else i++;
  }
  console.log(`${base}: ${count} JPGs (>4KB)`);
  total += count;
}
console.log(`TOTAL: ${total}`);
