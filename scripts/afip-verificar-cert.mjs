// Verifica que el certificado (afip/aluso.crt) corresponda a la clave
// privada (afip/private.key): compara el módulo RSA y muestra el subject/fechas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import forge from "node-forge";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "afip");
const certPem = readFileSync(join(dir, "aluso.crt"), "utf8");
const keyPem = readFileSync(join(dir, "private.key"), "utf8");

const cert = forge.pki.certificateFromPem(certPem);
const key = forge.pki.privateKeyFromPem(keyPem);

const certMod = cert.publicKey.n.toString(16);
const keyMod = key.n.toString(16);

const subj = cert.subject.attributes
  .map((a) => `${a.shortName || a.name}=${a.value}`)
  .join(", ");
const iss = cert.issuer.attributes
  .map((a) => `${a.shortName || a.name}=${a.value}`)
  .join(", ");

console.log("Subject :", subj);
console.log("Issuer  :", iss);
console.log("Válido  :", cert.validity.notBefore.toISOString(), "→", cert.validity.notAfter.toISOString());
console.log("");
console.log(
  certMod === keyMod
    ? "✓ COINCIDEN — el certificado corresponde a NUESTRA private.key. Todo listo."
    : "✗ NO COINCIDEN — el cert NO es de esta clave. Falta la .key del contador."
);
