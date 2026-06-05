// ============================================================================
//  Generador de clave privada + CSR para ARCA (AFIP) — Facturación Electrónica
// ----------------------------------------------------------------------------
//  Genera:
//    afip/private.key        → clave privada RSA 2048 (SECRETA, queda con vos)
//    afip/losamigos.csr      → pedido de certificado (ESTO se sube a ARCA)
//
//  Uso:
//    node scripts/afip-generar-claves.mjs "RAZON SOCIAL LEGAL EXACTA"
//    node scripts/afip-generar-claves.mjs "RAZON SOCIAL" mi-alias
//
//  Después: subir el .csr a ARCA → bajar el .crt firmado → vincularlo a WSFE.
//  Ver: docs/afip-instructivo.md
// ============================================================================
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import forge from "node-forge";

// ---- Datos del contribuyente (Distribuidora Los Amigos) --------------------
const CUIT = "20250642114"; // CUIT del titular (validado, dígito verificador OK)
const PAIS = "AR";

const razonSocial = (process.argv[2] || "").trim();
const alias = (process.argv[3] || "losamigos").trim().replace(/[^a-zA-Z0-9_-]/g, "");

if (!razonSocial) {
  console.error(
    '\n✗ Falta la razón social legal.\n  Uso: node scripts/afip-generar-claves.mjs "RAZON SOCIAL LEGAL EXACTA"\n' +
      "  (Como figura en ARCA — para una persona física es Apellido Nombre del titular del CUIT.)\n"
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "afip");
mkdirSync(outDir, { recursive: true });

const keyPath = join(outDir, "private.key");
const csrPath = join(outDir, `${alias}.csr`);

if (existsSync(keyPath)) {
  console.error(
    `\n✗ Ya existe ${keyPath}.\n  Si generás una clave nueva, el certificado viejo deja de servir.\n` +
      "  Borrá el archivo a mano si estás seguro de regenerar todo.\n"
  );
  process.exit(1);
}

console.log("Generando par de claves RSA 2048 (puede tardar unos segundos)…");
const keys = forge.pki.rsa.generateKeyPair(2048);

const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
// DN que exige AFIP: C=AR, O=razón social, CN=alias, serialNumber="CUIT <11 díg>"
// Se usan los OID explícitos (node-forge no resuelve "serialNumber" por nombre).
csr.setSubject([
  { type: "2.5.4.6", value: PAIS }, // countryName (C)
  { type: "2.5.4.10", value: razonSocial }, // organizationName (O)
  { type: "2.5.4.3", value: alias }, // commonName (CN)
  { type: "2.5.4.5", value: `CUIT ${CUIT}` }, // serialNumber
]);
csr.sign(keys.privateKey, forge.md.sha256.create());

writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), "utf8");
writeFileSync(csrPath, forge.pki.certificationRequestToPem(csr), "utf8");

console.log(`
✓ Listo. Archivos generados en  ${outDir}

  • private.key   → CLAVE PRIVADA. Guardala a salvo. NUNCA la subas a ningún lado.
  • ${alias}.csr  → Esto es lo que se SUBE a ARCA.

Datos grabados en el CSR:
  País (C):           ${PAIS}
  Razón social (O):   ${razonSocial}
  Alias (CN):         ${alias}
  CUIT (serialNumber): CUIT ${CUIT}

Siguiente paso: seguí docs/afip-instructivo.md (subir el .csr en ARCA →
"Administración de Certificados Digitales" → bajar el .crt de PRODUCCIÓN).
`);
