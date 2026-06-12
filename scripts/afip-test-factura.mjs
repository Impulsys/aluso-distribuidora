// PRUEBA: emite una Factura B de $1 a Consumidor Final en el punto de venta 6.
// Comprobante FISCAL REAL (se puede anular después con una NC). Solo para validar.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import https from "node:https";
import { constants } from "node:crypto";
import forge from "node-forge";
import soap from "soap";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const CUIT = 20250642114;
const PTO_VTA = 6;
const TIPO = 6; // Factura B
const TOTAL = 1; // $1
const WSAA_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl";
const WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?wsdl";

const httpsAgent = new https.Agent({
  ciphers: "DEFAULT@SECLEVEL=0",
  minVersion: "TLSv1",
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
});
const soapOpts = { request: axios.create({ httpsAgent }) };

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "afip");
const certPem = readFileSync(join(dir, "losamigos.crt"), "utf8");
const keyPem = readFileSync(join(dir, "private.key"), "utf8");

function arDate(d) {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())}T${p(ar.getUTCHours())}:${p(ar.getUTCMinutes())}:${p(ar.getUTCSeconds())}-03:00`;
}
function hoy() {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${ar.getUTCFullYear()}${p(ar.getUTCMonth() + 1)}${p(ar.getUTCDate())}`;
}
function buildTRA() {
  const now = Date.now();
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(now / 1000)}</uniqueId><generationTime>${arDate(new Date(now - 600000))}</generationTime><expirationTime>${arDate(new Date(now + 43200000))}</expirationTime></header><service>wsfe</service></loginTicketRequest>`;
}
function signCMS(xml) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: cert,
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
  console.log("WSAA…");
  const wsaa = await soap.createClientAsync(WSAA_URL, soapOpts);
  const [loginRes] = await wsaa.loginCmsAsync({ in0: signCMS(buildTRA()) });
  const cred = new XMLParser({ ignoreAttributes: false }).parse(loginRes.loginCmsReturn)?.loginTicketResponse?.credentials;

  const wsfe = await soap.createClientAsync(WSFE_URL, soapOpts);
  const Auth = { Token: cred.token, Sign: cred.sign, Cuit: CUIT };

  const [ultRes] = await wsfe.FECompUltimoAutorizadoAsync({ Auth, PtoVta: PTO_VTA, CbteTipo: TIPO });
  const next = Number(ultRes?.FECompUltimoAutorizadoResult?.CbteNro ?? 0) + 1;
  console.log(`Próximo número: ${PTO_VTA}-${String(next).padStart(8, "0")}`);

  const neto = Math.round((TOTAL / 1.21) * 100) / 100;
  const iva = Math.round((TOTAL - neto) * 100) / 100;

  const [res] = await wsfe.FECAESolicitarAsync({
    Auth,
    FeCAEReq: {
      FeCabReq: { CantReg: 1, PtoVta: PTO_VTA, CbteTipo: TIPO },
      FeDetReq: {
        FECAEDetRequest: {
          Concepto: 1,
          DocTipo: 99,
          DocNro: 0,
          CbteDesde: next,
          CbteHasta: next,
          CbteFch: hoy(),
          ImpTotal: TOTAL,
          ImpTotConc: 0,
          ImpNeto: neto,
          ImpOpEx: 0,
          ImpTrib: 0,
          ImpIVA: iva,
          CondicionIVAReceptorId: 5, // Consumidor Final
          MonId: "PES",
          MonCotiz: 1,
          Iva: { AlicIva: [{ Id: 5, BaseImp: neto, Importe: iva }] },
        },
      },
    },
  });

  const r = res?.FECAESolicitarResult;
  if (r?.Errors) {
    const errs = Array.isArray(r.Errors.Err) ? r.Errors.Err : [r.Errors.Err];
    console.log("\n✗ ERROR AFIP:", errs.map((e) => `[${e.Code}] ${e.Msg}`).join("; "));
    process.exit(1);
  }
  let det = r?.FeDetResp?.FECAEDetResponse;
  if (Array.isArray(det)) det = det[0];
  if (det?.Resultado === "R") {
    const obs = det.Observaciones?.Obs;
    const arr = Array.isArray(obs) ? obs : obs ? [obs] : [];
    console.log("\n✗ RECHAZADA:", arr.map((o) => `[${o.Code}] ${o.Msg}`).join("; "));
    process.exit(1);
  }

  console.log("\n✓✓✓ FACTURA B AUTORIZADA POR AFIP ✓✓✓");
  console.log(`   Número:        ${PTO_VTA}-${String(next).padStart(8, "0")}`);
  console.log(`   CAE:           ${det.CAE}`);
  console.log(`   Vencimiento:   ${det.CAEFchVto}`);
  console.log(`   Neto: $${neto}  IVA: $${iva}  Total: $${TOTAL}`);
  process.exit(0);
}
main().catch((e) => {
  console.error("\n✗ Error:", e.message || e);
  process.exit(1);
});
