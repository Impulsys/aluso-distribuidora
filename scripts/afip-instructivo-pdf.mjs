// Genera el instructivo SIMPLE para el contador (PDF) en el escritorio.
// Solo los pasos que tiene que hacer él en ARCA. Sin notas técnicas.
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

const OUT =
  "C:/Users/Axel/Desktop/Maximo ARCA/Instructivo ARCA.pdf";

const VIOLETA = "#6b46a8";
const GRIS = "#444444";

const doc = new PDFDocument({ size: "A4", margin: 56 });
doc.pipe(createWriteStream(OUT));

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

// ---- Encabezado ----
doc
  .fillColor(VIOLETA)
  .font("Helvetica-Bold")
  .fontSize(20)
  .text("Alta de Facturación Electrónica – ARCA", { align: "left" });
doc
  .moveDown(0.3)
  .fillColor(GRIS)
  .font("Helvetica")
  .fontSize(11)
  .text("VILTE MÁXIMO ALBERTO  ·  CUIT 20-25064211-4  ·  IVA Responsable Inscripto");
doc
  .moveTo(doc.x, doc.y + 8)
  .lineTo(doc.x + W, doc.y + 8)
  .strokeColor(VIOLETA)
  .lineWidth(2)
  .stroke();
doc.moveDown(1.4);

// ---- Intro ----
doc
  .fillColor("#000000")
  .font("Helvetica")
  .fontSize(11)
  .text(
    "Para habilitar la facturación electrónica por Web Service (WSFE) hay que realizar estos pasos en el portal de ARCA, con la clave fiscal del titular. Se adjunta el archivo «losamigos.csr».",
    { align: "left", lineGap: 2 }
  );
doc.moveDown(1);

// ---- Paso reutilizable ----
function paso(n, titulo, lineas) {
  doc
    .fillColor(VIOLETA)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(`Paso ${n}.  ${titulo}`);
  doc.moveDown(0.3);
  doc.fillColor("#000000").font("Helvetica").fontSize(11);
  for (const l of lineas) {
    doc.text(`•  ${l}`, { indent: 14, lineGap: 2 });
  }
  doc.moveDown(0.9);
}

paso(1, "Generar el certificado digital", [
  "Ingresar a ARCA → «Administración de Certificados Digitales».",
  "Crear un alias (por ejemplo: losamigos).",
  "Subir el archivo adjunto «losamigos.csr».",
  "Descargar el certificado (.crt) que genera ARCA.",
]);

paso(2, "Asociar el certificado al servicio de Facturación", [
  "Ir a «Administrador de Relaciones de Clave Fiscal» → Nueva relación.",
  "Servicio: «Facturación Electrónica» (WSFE).",
  "Representante: el certificado/alias creado en el Paso 1.",
]);

paso(3, "Habilitar el punto de venta", [
  "Ir a «Administración de Puntos de Venta y Domicilios» → Agregar.",
  "Tipo de emisión: «RECE – Web Services».",
  "Anotar el número de punto de venta asignado.",
]);

// ---- Qué enviarnos ----
doc.moveDown(0.2);
const boxY = doc.y;
doc
  .roundedRect(doc.x, boxY, W, 86, 8)
  .fillColor("#f3eefb")
  .fill();
doc
  .fillColor(VIOLETA)
  .font("Helvetica-Bold")
  .fontSize(12)
  .text(
    "Al finalizar, necesitamos que nos envíes:",
    doc.page.margins.left + 14,
    boxY + 12
  );
doc
  .fillColor("#000000")
  .font("Helvetica")
  .fontSize(11)
  .text(
    "1)  El archivo del certificado «.crt» descargado en el Paso 1.",
    doc.page.margins.left + 14,
    boxY + 34
  )
  .text(
    "2)  El número de punto de venta creado en el Paso 3.",
    doc.page.margins.left + 14,
    boxY + 52
  )
  .fillColor(GRIS)
  .fontSize(9.5)
  .text(
    "Con esos dos datos dejamos el sistema listo para facturar.",
    doc.page.margins.left + 14,
    boxY + 70
  );

doc.end();
console.log("PDF generado en:", OUT);
