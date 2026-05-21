// Lee el Excel maestro del cliente y vuelca su contenido a JSON.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { writeFileSync } from "node:fs";

const SRC =
  "_cliente/Descripcion de producto/codigos, titulos y descripciones .xlsx";

const wb = XLSX.readFile(SRC, { cellDates: true });
const out = {};
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
    defval: "",
    raw: false,
  });
  out[name] = rows;
  console.log(`Sheet "${name}": ${rows.length} filas`);
  if (rows[0]) console.log("  cols:", Object.keys(rows[0]).join(" | "));
  if (rows[0]) console.log("  sample[0]:", JSON.stringify(rows[0]).slice(0, 220));
  if (rows[1]) console.log("  sample[1]:", JSON.stringify(rows[1]).slice(0, 220));
}
writeFileSync("_cliente/catalog.json", JSON.stringify(out, null, 2), "utf8");
console.log("\n→ _cliente/catalog.json escrito");
