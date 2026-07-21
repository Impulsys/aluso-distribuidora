/**
 * Integración AFIP/ARCA (WSAA + WSFEv1) para facturación electrónica.
 * Producción. ALUSO DISTRIBUIDORA. CUIT y punto de venta NO van acá: vienen de
 * los secretos AFIP_CUIT / AFIP_PTO_VENTA (antes estaba el CUIT de Los Amigos).
 *
 * Flujo: WSAA (firma CMS con cert+clave → Ticket de Acceso, cacheado) →
 * WSFE FECompUltimoAutorizado (próx. número) → FECAESolicitar (pide CAE) →
 * FECompConsultar (verifica lo guardado) → devuelve CAE + número + QR.
 */
import * as https from "https";
import { constants } from "crypto";
import * as forge from "node-forge";
import * as soap from "soap";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const WSAA_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl";
const WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?wsdl";

// AFIP usa SSL/DH viejo → agente TLS con seguridad relajada.
const httpsAgent = new https.Agent({
  ciphers: "DEFAULT@SECLEVEL=0",
  minVersion: "TLSv1",
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const soapOpts: any = { request: axios.create({ httpsAgent }) };

// ===== Helpers de mapeo =====
export interface IvaEntry {
  Id: number;
  BaseImp: number;
  Importe: number;
}

/** YYYYMMDD en hora Argentina. */
export function fechaHoyAfip(): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ar.getUTCFullYear()}${p(ar.getUTCMonth() + 1)}${p(ar.getUTCDate())}`;
}

function arDate(d: Date): string {
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())}` +
    `T${p(ar.getUTCHours())}:${p(ar.getUTCMinutes())}:${p(ar.getUTCSeconds())}-03:00`
  );
}

// ===== WSAA: Ticket de Acceso (cacheado en memoria por servicio) =====
interface TA {
  token: string;
  sign: string;
  expiresAt: number;
}
const taCache: Map<string, TA> = new Map();

function buildTRA(service: string): string {
  const now = Date.now();
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(
    now / 1000
  )}</uniqueId><generationTime>${arDate(
    new Date(now - 600000)
  )}</generationTime><expirationTime>${arDate(
    new Date(now + 43200000)
  )}</expirationTime></header><service>${service}</service></loginTicketRequest>`;
}

function signCMS(xml: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem) as never,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: forge.pki.oids.signingTime, value: new Date() as any },
    ],
  });
  p7.sign({ detached: false });
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function getTA(
  service: string,
  certPem: string,
  keyPem: string
): Promise<TA> {
  const cached = taCache.get(service);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const cms = signCMS(buildTRA(service), certPem, keyPem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (await soap.createClientAsync(WSAA_URL, soapOpts)) as any;
  const [res] = await client.loginCmsAsync({ in0: cms });
  const cred = new XMLParser({ ignoreAttributes: false }).parse(
    res.loginCmsReturn
  )?.loginTicketResponse?.credentials;
  if (!cred?.token || !cred?.sign) throw new Error("WSAA: credenciales inválidas");

  const ta: TA = {
    token: cred.token,
    sign: cred.sign,
    expiresAt: Date.now() + 11 * 60 * 60 * 1000,
  };
  taCache.set(service, ta);
  return ta;
}

// ===== WSFE: solicitar CAE =====
export interface CaeParams {
  certPem: string;
  keyPem: string;
  cuit: number;
  puntoVenta: number;
  tipoComprobante: number; // 1=A, 6=B, 11=C
  importeNeto: number;
  importeIVA: number;
  importeTotal: number;
  ivaArray: IvaEntry[];
  docTipo: number;
  docNro: number;
  condicionIvaReceptorId: number; // 1=RI, 4=Exento, 5=CF, 6=Monotributo
  fechaStr: string; // YYYYMMDD
}

export interface CaeResult {
  cae: string;
  caeVto: string; // YYYYMMDD
  numero: number; // número REAL asignado por AFIP
  verification: "verified" | "mismatch" | "pending";
  verificationDetail?: string;
}

const TIPOS_SIN_IVA = [11, 13, 12]; // C: el IVA va incluido en el total

export async function requestCAE(p: CaeParams): Promise<CaeResult> {
  const ta = await getTA("wsfe", p.certPem, p.keyPem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (await soap.createClientAsync(WSFE_URL, soapOpts)) as any;
  const Auth = { Token: ta.token, Sign: ta.sign, Cuit: p.cuit };

  // Próximo número
  const [ultRes] = await client.FECompUltimoAutorizadoAsync({
    Auth,
    PtoVta: p.puntoVenta,
    CbteTipo: p.tipoComprobante,
  });
  const ult = ultRes?.FECompUltimoAutorizadoResult;
  if (ult?.Errors) {
    const e = Array.isArray(ult.Errors.Err) ? ult.Errors.Err[0] : ult.Errors.Err;
    throw new Error(`WSFE último nro: [${e.Code}] ${e.Msg}`);
  }
  const nextNumber = Number(ult?.CbteNro ?? 0) + 1;

  const detalle: Record<string, unknown> = {
    Concepto: 1, // Productos
    DocTipo: p.docTipo,
    DocNro: p.docNro,
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: p.fechaStr,
    ImpTotal: p.importeTotal,
    ImpTotConc: 0,
    ImpNeto: p.importeNeto,
    ImpOpEx: 0,
    ImpTrib: 0,
    ImpIVA: p.importeIVA,
    CondicionIVAReceptorId: p.condicionIvaReceptorId,
    MonId: "PES",
    MonCotiz: 1,
  };
  if (!TIPOS_SIN_IVA.includes(p.tipoComprobante) && p.ivaArray.length > 0) {
    detalle.Iva = {
      AlicIva: p.ivaArray.map((i) => ({
        Id: i.Id,
        BaseImp: i.BaseImp,
        Importe: i.Importe,
      })),
    };
  }

  const [res] = await client.FECAESolicitarAsync({
    Auth,
    FeCAEReq: {
      FeCabReq: {
        CantReg: 1,
        PtoVta: p.puntoVenta,
        CbteTipo: p.tipoComprobante,
      },
      FeDetReq: { FECAEDetRequest: detalle },
    },
  });

  const r = res?.FECAESolicitarResult;
  if (r?.Errors) {
    const errs = Array.isArray(r.Errors.Err) ? r.Errors.Err : [r.Errors.Err];
    throw new Error(
      "AFIP: " + errs.map((e: any) => `[${e.Code}] ${e.Msg}`).join("; ")
    );
  }
  let det = r?.FeDetResp?.FECAEDetResponse;
  if (Array.isArray(det)) det = det[0];
  if (!det) throw new Error("AFIP: respuesta sin detalle");
  if (det.Resultado === "R") {
    const obs = det.Observaciones?.Obs;
    const arr = Array.isArray(obs) ? obs : obs ? [obs] : [];
    throw new Error(
      arr.length
        ? arr.map((o: any) => `[${o.Code}] ${o.Msg}`).join("; ")
        : "AFIP rechazó el comprobante"
    );
  }

  // Verificación in-band
  let verification: CaeResult["verification"] = "pending";
  let verificationDetail: string | undefined;
  try {
    const [vr] = await client.FECompConsultarAsync({
      Auth,
      FeCompConsReq: {
        CbteTipo: p.tipoComprobante,
        PtoVta: p.puntoVenta,
        CbteNro: nextNumber,
      },
    });
    const g = vr?.FECompConsultarResult?.ResultGet;
    if (g) {
      const diffs: string[] = [];
      if (String(g.CodAutorizacion) !== String(det.CAE))
        diffs.push("CAE");
      if (Number(g.CbteDesde) !== nextNumber) diffs.push("numero");
      if (Math.abs(Number(g.ImpTotal) - p.importeTotal) > 0.01)
        diffs.push("importe");
      verification = diffs.length === 0 ? "verified" : "mismatch";
      if (diffs.length) verificationDetail = diffs.join(", ");
    }
  } catch (e) {
    verificationDetail = "verify_exception: " + (e as Error).message;
  }

  return {
    cae: det.CAE,
    caeVto: det.CAEFchVto,
    numero: nextNumber,
    verification,
    verificationDetail,
  };
}

// ===== QR oficial AFIP (RG 4291) =====
export function buildAfipQrUrl(data: {
  fecha: string; // YYYY-MM-DD
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  cae: string;
}): string {
  const payload = {
    ver: 1,
    fecha: data.fecha,
    cuit: data.cuit,
    ptoVta: data.ptoVta,
    tipoCmp: data.tipoCmp,
    nroCmp: data.nroCmp,
    importe: data.importe,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: data.tipoDocRec,
    nroDocRec: data.nroDocRec,
    tipoCodAut: "E",
    codAut: Number(data.cae),
  };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
}

