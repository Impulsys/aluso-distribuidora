import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const wb = XLSX.readFile(
  "_cliente/Descripcion de producto/codigos, titulos y descripciones .xlsx"
);
const sh = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false });
console.log("Total filas:", rows.length);
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const cells = r.map((c) => String(c).slice(0, 60));
  console.log(`#${i}: [${cells.join(" | ")}]`);
}
writeFileSync("_cliente/raw-rows.json", JSON.stringify(rows, null, 2), "utf8");
