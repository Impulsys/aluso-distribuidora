// Consulta a AFIP (producción) el ÚLTIMO comprobante autorizado por cada
// punto de venta y tipo (A/B). Sirve para saber cuál PV está en uso. Solo lectura.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import https from "node:https";
import { constants } from "node:crypto";
import forge from "node-forge";
import soap from "soap";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

// 🛑 Este CUIT venía HARDCODEADO con 20250642114, que es el de Distribuidora
//    Los Amigos NOA (otro cliente). Correr esto para ALUSO operaba en ARCA
//    contra el contribuyente equivocado. Ahora sale de una variable y si no
//    está, el script no arranca.
//    Uso:  AFIP_CUIT=30xxxxxxxxx node <este-script>
const CUIT = process.env.AFIP_CUIT;
if (!CUIT || String(CUIT).length !== 11) {
  console.error("");
  console.error("🛑 ABORTADO: falta AFIP_CUIT (11 dígitos, sin guiones).");
  console.error("   Ej: AFIP_CUIT=30123456789 node " + process.argv[1]);
  console.error("");
  process.exit(1);
}
const WSAA_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl";
const WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?wsdl";
const PUNTOS = [5, 6];
const TIPOS = [
  { cod: 1, nombre: "Factura A" },
  { cod: 6, nombre: "Factura B" },
];

const httpsAgent = new https.Agent({
  ciphers: "DEFAULT@SECLEVEL=0",
  minVersion: "TLSv1",
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
});
const soapOpts = { request: axios.create({ httpsAgent }) };

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "afip");
const certPem = readFileSync(join(dir, "aluso.crt"), "utf8");
const keyPem = readFileSync(join(dir, "private.key"), "utf8");

function arDate(d) {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())}` +
    `T${p(ar.getUTCHours())}:${p(ar.getUTCMinutes())}:${p(ar.getUTCSeconds())}-03:00`
  );
}
function buildTRA() {
  const now = Date.now();
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(now / 1000)}</uniqueId><generationTime>${arDate(new Date(now - 600000))}</generationTime><expirationTime>${arDate(new Date(now + 43200000))}</expirationTime></header><service>wsfe</service></loginTicketRequest>`;
}
function signCMS(xml) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  p7.addCertificate(forge.pki.certificateFromPem(certPem));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: forge.pki.certificateFromPem(certPem),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: false });
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function main() {
  const wsaa = await soap.createClientAsync(WSAA_URL, soapOpts);
  const [loginRes] = await wsaa.loginCmsAsync({ in0: signCMS(buildTRA()) });
  const cred = new XMLParser({ ignoreAttributes: false }).parse(
    loginRes.loginCmsReturn
  )?.loginTicketResponse?.credentials;

  const wsfe = await soap.createClientAsync(WSFE_URL, soapOpts);
  const Auth = { Token: cred.token, Sign: cred.sign, Cuit: CUIT };

  for (const pv of PUNTOS) {
    console.log(`\nPunto de venta Nº ${pv}:`);
    for (const t of TIPOS) {
      const [r] = await wsfe.FECompUltimoAutorizadoAsync({
        Auth,
        PtoVta: pv,
        CbteTipo: t.cod,
      });
      const out = r?.FECompUltimoAutorizadoResult ?? {};
      const nro = Number(out.CbteNro ?? 0);
      const err = out.Errors
        ? ` (aviso: ${(Array.isArray(out.Errors.Err) ? out.Errors.Err : [out.Errors.Err]).map((e) => e.Msg).join("; ")})`
        : "";
      console.log(
        `   ${t.nombre.padEnd(10)} → última emitida: ${nro === 0 ? "ninguna (arranca en 1)" : `nº ${nro}`}${err}`
      );
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error("✗ Error:", e.message || e);
  process.exit(1);
});
