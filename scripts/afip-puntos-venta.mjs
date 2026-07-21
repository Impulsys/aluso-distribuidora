// Consulta a AFIP (producción) los PUNTOS DE VENTA habilitados del CUIT.
// Solo lectura (FEParamGetPtosVenta). No emite comprobantes.
//   WSAA: arma TRA → lo firma (CMS) con cert+clave → obtiene Ticket de Acceso.
//   WSFE: FEParamGetPtosVenta con ese TA.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import https from "node:https";
import { constants } from "node:crypto";
import forge from "node-forge";
import soap from "soap";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

// AFIP usa SSL/DH viejo → bajamos el nivel de seguridad TLS para poder conectar.
const httpsAgent = new https.Agent({
  ciphers: "DEFAULT@SECLEVEL=0",
  minVersion: "TLSv1",
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
});
const soapOpts = { request: axios.create({ httpsAgent }) };

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

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "afip");
const certPem = readFileSync(join(dir, "aluso.crt"), "utf8");
const keyPem = readFileSync(join(dir, "private.key"), "utf8");

// Fecha en hora Argentina (UTC-3) con formato ISO + offset.
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
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now / 1000)}</uniqueId>
    <generationTime>${arDate(new Date(now - 10 * 60 * 1000))}</generationTime>
    <expirationTime>${arDate(new Date(now + 12 * 60 * 60 * 1000))}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
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
  console.log("WSAA: pidiendo Ticket de Acceso (producción)…");
  const cms = signCMS(buildTRA());
  const wsaa = await soap.createClientAsync(WSAA_URL, soapOpts);
  const [loginRes] = await wsaa.loginCmsAsync({ in0: cms });
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(
    loginRes.loginCmsReturn
  );
  const cred = parsed?.loginTicketResponse?.credentials;
  if (!cred?.token) throw new Error("WSAA no devolvió credenciales");
  console.log("WSAA OK. Consultando puntos de venta…\n");

  const wsfe = await soap.createClientAsync(WSFE_URL, soapOpts);
  const [res] = await wsfe.FEParamGetPtosVentaAsync({
    Auth: { Token: cred.token, Sign: cred.sign, Cuit: CUIT },
  });
  const out = res?.FEParamGetPtosVentaResult ?? {};

  if (out.Errors) {
    const errs = Array.isArray(out.Errors.Err) ? out.Errors.Err : [out.Errors.Err];
    console.log("AFIP devolvió error/aviso:");
    errs.forEach((e) => console.log(`  [${e.Code}] ${e.Msg}`));
  }
  const pv = out?.ResultGet?.PtoVenta;
  const lista = pv ? (Array.isArray(pv) ? pv : [pv]) : [];
  if (lista.length === 0) {
    console.log(
      "\nNo se listaron puntos de venta para Web Services (RECE).\n" +
        "Puede que el contador todavía no lo haya creado, o lo creó como 'Factura en línea'."
    );
  } else {
    console.log("PUNTOS DE VENTA habilitados:");
    lista.forEach((p) =>
      console.log(
        `  • Nº ${p.Nro} · ${p.EmisionTipo} · ${p.Bloqueado === "S" ? "BLOQUEADO" : "activo"}`
      )
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✗ Error:", e.message || e);
  process.exit(1);
});
