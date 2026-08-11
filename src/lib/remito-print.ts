// Remito en HOJA A4, listo para imprimir o guardar como PDF con el navegador.
// (Antes salía en ticket de 80mm porque venía de Los Amigos; ALUSO usa A4.)
import type { Envio, Remito } from "./types";
import { LOGISTICA_POR_EAN, medidasBulto } from "@/data/logistica";
import { armarPallet, type BultoAColocar } from "./pallet";
import {
  ars,
  esc,
  fechaCorta,
  horaCorta,
  a4Header,
  a4Toolbar,
  a4Shell,
  abrirA4,
} from "./a4";

function itemsHTML(r: Remito): string {
  return r.items
    .map((it) => {
      const cod = it.codigo ? `<span class="cod">${esc(it.codigo)}</span><br>` : "";
      const b = bultosDe(it.productId, it.cantidad);
      const bultosTxt =
        b != null
          ? `<br><span style="font-size:10px;color:#667">${b} bulto${b === 1 ? "" : "s"}</span>`
          : "";
      return `
      <tr>
        <td>${cod}${esc(it.nombre)}</td>
        <td class="num">${it.cantidad}${bultosTxt}</td>
        <td class="num">${ars(it.precioVenta)}</td>
        <td class="num">${ars(it.precioVenta * it.cantidad)}</td>
      </tr>`;
    })
    .join("");
}

function totalesHTML(r: Remito): string {
  const hayDesc = r.descuentos && r.descuentos.length > 0;
  const filasDesc = hayDesc
    ? `<div class="row"><span>Subtotal</span><span>${ars(
        r.subtotal ?? r.total
      )}</span></div>` +
      r.descuentos!
        .map(
          (d) =>
            `<div class="row desc"><span>${esc(d.concepto)} (${d.pct}%)</span><span>${ars(
              d.monto
            )}</span></div>`
        )
        .join("")
    : "";
  return `
  <div class="totales">
    ${filasDesc}
    <div class="row total"><span>TOTAL</span><span>${ars(r.total)}</span></div>
  </div>`;
}

export function remitoHTML(r: Remito): string {
  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}

    <div class="doc-head">
      <span class="tipo">REMITO</span>
      <div style="text-align:right">
        <div class="nro">N° ${esc(r.numero)}</div>
        <div class="fecha">${fechaCorta(r.fecha)} · ${horaCorta(r.fecha)}</div>
      </div>
    </div>

    <div class="cliente">
      <div><span class="lbl">Cliente:</span> ${esc(
        r.clienteNombre || "Consumidor final"
      )}</div>
      <div><span class="lbl">CUIT:</span> ${esc(r.clienteCuit || "—")}</div>
      <div><span class="lbl">Forma de pago:</span> ${esc(
        r.formaPago || "—"
      )}</div>
      <div><span class="lbl">Comprobante:</span> ${esc(r.numero)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="num">Cant.</th>
          <th class="num">P. Unitario</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHTML(r)}</tbody>
    </table>

    ${totalesHTML(r)}

    <div class="firma">
      <div class="linea">Entregó</div>
      <div class="linea">Recibí conforme</div>
    </div>

    <p class="nota">
      Documento no válido como factura. Comprobante de entrega de mercadería.
    </p>
  </div>`;
  return a4Shell(`Remito ${r.numero}`, body);
}

/**
 * PROFORMA: el mismo remito pero SIN PRECIOS, para que el depósito arme el
 * pedido sin ver importes (pedido de Luciano). Solo código, descripción y
 * cantidad, con un casillero para tildar lo armado.
 *
 * `area` (opcional): el protocolo pide controlar el pedido en dos/tres sectores,
 * cada uno con su proforma. Si se pasa, el título es el del área
 * (ej. "Control en el área de racks") en vez de "ORDEN DE ARMADO".
 */
export function proformaHTML(r: Remito, area?: string): string {
  const items = r.items
    .map((it) => {
      const cod = it.codigo ? `<span class="cod">${esc(it.codigo)}</span><br>` : "";
      return `
      <tr>
        <td style="width:34px;text-align:center;color:#889">☐</td>
        <td>${cod}${esc(it.nombre)}</td>
        <td class="num" style="font-size:15px;font-weight:700">${it.cantidad}</td>
      </tr>`;
    })
    .join("");

  const titulo = area ? esc(area.toUpperCase()) : "ORDEN DE ARMADO";
  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}
    <div class="doc-head">
      <span class="tipo">${titulo}</span>
      <div style="text-align:right">
        <div class="nro">N° ${esc(r.numero)}</div>
        <div class="fecha">${fechaCorta(r.fecha)}</div>
      </div>
    </div>
    <div class="cliente">
      <div><span class="lbl">Cliente:</span> ${esc(
        r.clienteNombre || "Consumidor final"
      )}</div>
      <div><span class="lbl">Pedido:</span> ${esc(r.numero)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:34px">✓</th>
          <th>Descripción</th>
          <th class="num">Cantidad</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <div class="firma">
      <div class="linea">Armó el pedido</div>
      <div class="linea">Controló</div>
    </div>
    <p class="nota">
      Documento interno de armado. No es remito ni factura. Sin valores.
    </p>
  </div>`;
  return a4Shell(`Proforma ${r.numero}`, body);
}

// ===== Documentos del envío según el protocolo de ALUSO =====
const AREA_RACKS = "Control en el área de racks";
const AREA_PREP = "Control en el área de preparación";
const AREA_GRANEL = "Control de carga a granel";

/**
 * Todas las proformas de control de un envío, en un solo documento (una hoja por
 * cada una): por cada pedido palletizado → racks + preparación; por cada pedido
 * a granel → racks + preparación + carga a granel. El navegador las imprime todas
 * juntas (una por página).
 */
export function proformasControlHTML(remitos: Remito[]): string {
  const paginas: string[] = [];
  const hoja = (r: Remito, area: string) => {
    const items = r.items
      .map((it) => {
        const cod = it.codigo ? `<span class="cod">${esc(it.codigo)}</span><br>` : "";
        return `<tr><td style="width:34px;text-align:center;color:#889">☐</td><td>${cod}${esc(
          it.nombre
        )}</td><td class="num" style="font-size:15px;font-weight:700">${it.cantidad}</td></tr>`;
      })
      .join("");
    return `
    <div class="hoja">
      ${a4Header()}
      <div class="doc-head">
        <span class="tipo">${esc(area.toUpperCase())}</span>
        <div style="text-align:right">
          <div class="nro">N° ${esc(r.numero)}</div>
          <div class="fecha">${fechaCorta(r.fecha)}</div>
        </div>
      </div>
      <div class="cliente">
        <div><span class="lbl">Cliente:</span> ${esc(r.clienteNombre || "Consumidor final")}</div>
        <div><span class="lbl">Pedido:</span> ${esc(r.numero)}</div>
      </div>
      <table>
        <thead><tr><th style="width:34px">✓</th><th>Descripción</th><th class="num">Cantidad</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div class="firma"><div class="linea">Armó</div><div class="linea">Controló</div></div>
      <p class="nota">Documento interno de control. No es remito ni factura. Sin valores.</p>
    </div>`;
  };
  for (const r of remitos) {
    paginas.push(hoja(r, AREA_RACKS));
    paginas.push(hoja(r, AREA_PREP));
    if (r.modoDespacho === "granel") paginas.push(hoja(r, AREA_GRANEL));
  }
  const body = `${a4Toolbar()}${paginas.join('<div style="page-break-after:always"></div>')}`;
  return a4Shell("Proformas de control del envío", body);
}

/** Bultos de un renglón: cuántas cajas completas son esas unidades. `null` si el
 *  producto no tiene datos de paquetería cargados (no se inventa un número). */
function bultosDe(productId: string, cantidad: number): number | null {
  const d = LOGISTICA_POR_EAN[productId];
  const paq = d?.paqPorBulto || 0;
  return paq > 0 ? Math.ceil(cantidad / paq) : null;
}

/**
 * HOJA DE ARMADO del envío: una sola hoja para el depósito con TODOS los pedidos
 * del envío. Cada pedido palletizado es su propio pallet (no se surte con otro);
 * los "a granel" van listados aparte. Sin precios. Con casilleros para tildar.
 */
export function hojaArmadoHTML(envio: Envio, remitos: Remito[]): string {
  const palletizados = remitos.filter((r) => r.modoDespacho !== "granel");
  const granel = remitos.filter((r) => r.modoDespacho === "granel");

  const tabla = (r: Remito) => {
    const filas = r.items
      .map((it) => {
        const cod = it.codigo
          ? `<span class="cod">${esc(it.codigo)}</span><br>`
          : "";
        const b = bultosDe(it.productId, it.cantidad);
        return `
        <tr>
          <td style="width:30px;text-align:center;color:#889">☐</td>
          <td>${cod}${esc(it.nombre)}</td>
          <td class="num" style="font-weight:700">${it.cantidad}</td>
          <td class="num">${b ?? "—"}</td>
        </tr>`;
      })
      .join("");
    return `
    <table>
      <thead>
        <tr>
          <th style="width:30px">✓</th>
          <th>Descripción</th>
          <th class="num">Unid.</th>
          <th class="num">Bultos</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
  };

  const bloquesPallet = palletizados
    .map(
      (r, i) => `
    <div class="bloque">
      <div class="bloque-tit">
        <span class="pill">📦 Pallet ${i + 1}</span>
        ${esc(r.numero)} · <b>${esc(r.clienteNombre || "Consumidor final")}</b>
      </div>
      ${tabla(r)}
    </div>`
    )
    .join("");

  const bloqueGranel =
    granel.length > 0
      ? `
    <div class="bloque">
      <div class="bloque-tit granel">
        <span class="pill granel">🧺 A granel (sin pallet)</span>
      </div>
      ${granel
        .map(
          (r) => `
        <div class="bloque-tit" style="border:none;margin-top:6px">
          ${esc(r.numero)} · <b>${esc(r.clienteNombre || "Consumidor final")}</b>
        </div>
        ${tabla(r)}`
        )
        .join("")}
    </div>`
      : "";

  const extraCss = `
    .bloque { margin-top: 14px; page-break-inside: avoid; }
    .bloque-tit { font-size: 14px; padding: 6px 0; border-bottom: 2px solid #0a5b7a; margin-bottom: 4px; }
    .bloque-tit.granel { border-color: #c2740a; }
    .pill { display:inline-block; background:#0a5b7a; color:#fff; font-weight:700; font-size:12px;
            padding:2px 8px; border-radius:10px; margin-right:6px; }
    .pill.granel { background:#c2740a; }`;

  const body = `
  ${a4Toolbar()}
  <div class="hoja">
    ${a4Header()}
    <div class="doc-head">
      <span class="tipo">HOJA DE ARMADO</span>
      <div style="text-align:right">
        <div class="nro">${fechaCorta(envio.fecha)}</div>
        <div class="fecha">${esc(envio.transporte)}</div>
      </div>
    </div>
    <div class="cliente">
      <div><span class="lbl">Pedidos:</span> ${remitos.length}</div>
      <div><span class="lbl">Pallets:</span> ${palletizados.length}${
        granel.length ? ` · ${granel.length} a granel` : ""
      }</div>
    </div>
    ${bloquesPallet}
    ${bloqueGranel}
    <div class="firma">
      <div class="linea">Armó</div>
      <div class="linea">Controló</div>
    </div>
    <p class="nota">
      Documento interno de armado del envío. No es remito ni factura. Sin valores.
    </p>
  </div>
  <style>${extraCss}</style>`;
  return a4Shell(`Hoja de armado ${fechaCorta(envio.fecha)}`, body);
}

/** Bultos físicos de un pedido (para el armado y el conteo por pallet). */
function bultosDeRemito(r: Remito): BultoAColocar[] {
  const out: BultoAColocar[] = [];
  r.items.forEach((it) => {
    const d = LOGISTICA_POR_EAN[it.productId];
    if (!d) return;
    const n = Math.max(1, Math.ceil(it.cantidad / (d.paqPorBulto || 1)));
    const m = medidasBulto(d);
    for (let k = 0; k < n; k++)
      out.push({ pedidoId: r.id, etiqueta: r.numero, color: "#000", ...m });
  });
  return out;
}

/**
 * IDENTIFICACIÓN DEL PALLET: la hoja que va pegada a cada pallet. Se genera UNA
 * por pallet de cada pedido palletizado, ya prellenada con lo que el sistema
 * sabe (cliente, pedido, pallet X de Y, bultos del pallet, total). Los datos
 * manuales (hora, quién armó/controló) quedan en blanco.
 */
export function identificacionPalletHTML(envio: Envio, remitos: Remito[]): string {
  const paginas: string[] = [];
  const linea = (lbl: string, val = "") =>
    `<div class="idrow"><span class="idlbl">${lbl}:</span> <span class="idval">${val}</span></div>`;
  for (const r of remitos) {
    if (r.modoDespacho === "granel") continue; // el granel no se palletiza
    const bultos = bultosDeRemito(r);
    const { cajas, pallets } = armarPallet(bultos);
    const total = bultos.length;
    const n = Math.max(1, pallets);
    for (let i = 0; i < n; i++) {
      const enEste = cajas.filter((c) => c.pallet === i).length || total;
      paginas.push(`
      <div class="hoja">
        ${a4Header()}
        <div class="doc-head"><span class="tipo">IDENTIFICACIÓN DEL PALLET</span></div>
        <div class="idbox">
          ${linea("Nombre del cliente", esc(r.clienteNombre || "Consumidor final"))}
          ${linea("Número de pedido", esc(r.numero))}
          ${linea("Número de pallet", `${i + 1} de ${n}`)}
          ${linea("Cantidad de bultos en este pallet", String(enEste))}
          ${linea("Cantidad total de bultos del pedido", String(total))}
          ${linea("Fecha de armado", fechaCorta(envio.fecha))}
          ${linea("Hora de cierre")}
          ${linea("Armado por")}
          ${linea("Controlado por")}
          ${linea("Observaciones")}
        </div>
      </div>`);
    }
  }
  if (paginas.length === 0) {
    paginas.push(
      `<div class="hoja">${a4Header()}<p class="nota">Este envío no tiene pedidos palletizados (todo a granel).</p></div>`
    );
  }
  const extraCss = `
    .idbox { margin-top: 16px; }
    .idrow { font-size: 16px; padding: 12px 4px; border-bottom: 1px solid #ccc; }
    .idlbl { font-weight: 700; color: #0a5b7a; }
    .idval { font-size: 18px; }
    .tipo { font-size: 20px; }`;
  const body = `${a4Toolbar()}${paginas.join(
    '<div style="page-break-after:always"></div>'
  )}<style>${extraCss}</style>`;
  return a4Shell("Identificación de pallets", body);
}

/**
 * CONSTANCIA DE RECEPCIÓN DEL TRANSPORTISTA: la firma el flete al retirar. El
 * protocolo pide imprimir DOS, así que el documento trae la hoja duplicada.
 * Se prellenan cliente, pedido(s), cantidad de pallets y total de bultos.
 */
export function constanciaTransportistaHTML(
  envio: Envio,
  remitos: Remito[]
): string {
  let totalBultos = 0;
  let totalPallets = 0;
  for (const r of remitos) {
    const bultos = bultosDeRemito(r);
    totalBultos += bultos.length;
    totalPallets +=
      r.modoDespacho === "granel" ? 0 : Math.max(1, armarPallet(bultos).pallets);
  }
  const pedidos = remitos
    .map((r) => `${esc(r.numero)} · ${esc(r.clienteNombre || "s/cliente")}`)
    .join("  /  ");
  const linea = (lbl: string, val = "") =>
    `<div class="idrow"><span class="idlbl">${lbl}:</span> <span class="idval">${val}</span></div>`;
  const hoja = (copia: string) => `
    <div class="hoja">
      ${a4Header()}
      <div class="doc-head">
        <span class="tipo">CONSTANCIA DE RECEPCIÓN DEL TRANSPORTISTA</span>
        <div style="text-align:right"><div class="fecha">${copia}</div></div>
      </div>
      <div class="idbox">
        ${linea("Fecha", fechaCorta(envio.fecha))}
        ${linea("Hora")}
        ${linea("Cliente / Pedido(s)", pedidos)}
        ${linea("Cantidad de pallets", String(totalPallets))}
        ${linea("Cantidad total de bultos declarados", String(totalBultos))}
        ${linea("Estado del film")}
        ${linea("Estado visible de los pallets")}
        ${linea("Nombre y apellido del transportista")}
        ${linea("DNI")}
        ${linea("Patente del vehículo")}
        ${linea("Empresa de transporte")}
        ${linea("Observaciones")}
      </div>
      <p class="decl">Recibo los pallets identificados anteriormente, en el estado
      visible declarado. Verifiqué la cantidad de pallets, la identificación y el
      estado del film. Desde la firma de esta constancia recibo la mercadería bajo
      mi custodia hasta su entrega al destinatario, controlándolo y dejando
      asentada cualquier diferencia u observación antes de retirarme.</p>
      <div class="firma"><div class="linea">Firma del transportista</div><div class="linea">Aclaración</div></div>
    </div>`;
  const extraCss = `
    .idbox { margin-top: 12px; }
    .idrow { font-size: 14px; padding: 8px 4px; border-bottom: 1px solid #ccc; }
    .idlbl { font-weight: 700; color: #0a5b7a; }
    .decl { margin-top: 14px; font-size: 12px; color: #333; line-height: 1.5; }
    .tipo { font-size: 15px; }`;
  const body = `${a4Toolbar()}${hoja("Copia 1 de 2")}<div style="page-break-after:always"></div>${hoja(
    "Copia 2 de 2"
  )}<style>${extraCss}</style>`;
  return a4Shell("Constancia de recepción del transportista", body);
}

/**
 * PROTOCOLO DE PREPARACIÓN, CONTROL Y DESPACHO — el instructivo del depósito.
 * Se abre desde Envíos para consultarlo o imprimirlo. Texto provisto por ALUSO.
 */
export function protocoloPreparacionHTML(): string {
  const ul = (xs: string[]) =>
    `<ul>${xs.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const ol = (xs: string[]) =>
    `<ol>${xs.map((x) => `<li>${x}</li>`).join("")}</ol>`;
  const h = (t: string) => `<h2>${t}</h2>`;
  const body = `
  ${a4Toolbar()}
  <div class="hoja proto">
    ${a4Header()}
    <div class="doc-head"><span class="tipo">PROTOCOLO DE PREPARACIÓN, CONTROL Y DESPACHO</span></div>
    <p>Este procedimiento debe cumplirse en todos los pedidos preparados en el depósito. Su objetivo es evitar faltantes, sobrantes y mercadería equivocada; registrar quién preparó y controló cada pedido; mantener la trazabilidad desde el depósito hasta el cliente; proteger al empleado, la empresa, el transportista y el cliente; y evitar que un pallet cerrado sea modificado sin autorización.</p>

    ${h("Reglas generales")}
    ${ol([
      "Ningún pedido puede prepararse sin una proforma u orden de preparación.",
      "Toda mercadería debe ser contada y controlada en el sector correspondiente antes de despacharse.",
      "Cada producto se controla por descripción, estado, cantidad de unidades o bultos, y marca/variante cuando corresponda.",
      "No se debe confiar únicamente en la memoria.",
      "Todo producto retirado del rack debe tildarse en la proforma.",
      "No marcar un producto como controlado antes de contarlo físicamente.",
      "Cuando trabajen dos personas, una prepara y la otra controla.",
      "La persona que controla debe volver a contar físicamente, no solo observar.",
      "Todo pedido debe pasar por el área de Preparación.",
      "Ningún pallet puede filmarse o precintarse antes del control final.",
      "Un pallet cerrado no puede modificarse sin autorización y sin repetir el control.",
      "Toda diferencia, error o duda debe informarse inmediatamente.",
      "Informar un error a tiempo no es una falta; ocultarlo o saltear el procedimiento sí lo es.",
    ])}

    ${h("Con dos empleados")}
    <p><b>Prepara:</b> lee producto y cantidad, retira, cuenta los bultos en voz alta y marca la columna.
    <b>Controla:</b> verifica que el producto sea el correcto, vuelve a contar físicamente, marca la columna, informa cualquier diferencia y firma. No debe marcar basándose solo en lo que dice el preparador.</p>

    ${h("Con una sola persona")}
    ${ol([
      "Primer conteo al retirar la mercadería.",
      "Trasladar todo el pedido al área de Preparación.",
      "Volver a contar desde cero (sin usar el primer conteo como referencia).",
      "Firmar indicando que realizó preparación y control.",
    ])}

    ${h("Etapa 1 · Recepción del pedido")}
    <p>Recibir o imprimir <b>dos proformas</b>: <i>Control en el área de racks</i> y <i>Control en el área de preparación</i>. Antes de empezar, verificar que tengan cliente, número de pedido, fecha, detalle de productos, cantidad de bultos y cantidad estimada de pallets. Si algo está incompleto o confuso, no comenzar hasta consultar con Administración.</p>

    ${h("Etapa 2 · Retiro de mercadería de los racks (primer conteo)")}
    ${ol([
      "Leer descripción y cantidad solicitada.",
      "Retirar la cantidad exacta del rack (sin tildar aún).",
      "Contar los bultos y tildar la columna en la proforma de racks.",
      "Firmar la proforma.",
    ])}
    <p>No contar varios renglones a la vez sin terminar el anterior.</p>

    ${h("Etapa 3 · Control en el área de Preparación (segundo conteo)")}
    <p>Trasladar toda la mercadería al área de control, visible en cámaras, sin mezclar con otros pedidos. Volver a controlar el pedido completo desde cero: leer la descripción, colocar los bultos a la vista, contarlos al ponerlos en el pallet, verificar producto y cantidad, tildar y avisar cualquier diferencia.</p>
    <p><b>Si aparece un faltante, sobrante o error:</b> detener el armado, no filmar, no corregir la proforma sin autorización, informar, buscar el producto correcto, corregir, repetir el conteo del renglón y registrar en observaciones.</p>

    ${h("Etapa 4 · Filmado del pallet (tercer conteo y control final)")}
    <p>Usar un pallet en buen estado, colocar los productos según lo indicado en el sistema, filmar desde la base reforzando arriba, abajo y los laterales. Luego revisar la proforma completa, verificar que todos los renglones estén tildados, que no haya mercadería de otro pedido ni quede mercadería afuera, y firmar.</p>

    ${h("Etapa 5 · Identificación del pallet")}
    <p>Cada pallet lleva una hoja visible con: nombre del cliente, número de pedido, número de pallet (X de Y), bultos en este pallet, total de bultos, fecha de armado, hora de cierre, armado por, controlado por y observaciones. Desde ese momento el pallet se considera cerrado.</p>

    ${h("Etapa 6 · Pallet cerrado")}
    <p>Un pallet cerrado no se abre, no se le saca ni agrega mercadería, no se cambia producto ni identificación, y no se presta un bulto para otro pedido. Queda en el área de pallets cerrados, separado de la mercadería a la venta, sin bloquear pasillos. <b>Para reabrirlo</b> hay que informar y registrar el motivo y quién autorizó, cortar el precinto en Preparación, hacer la modificación, repetir el control, volver a contar, refilmar, registrar nueva fecha/hora, firmar de nuevo y actualizar la hoja de identificación.</p>

    ${h("Despacho al transportista")}
    <p>Antes de que llegue el flete, verificar cliente, número de pedido, cantidad de pallets, total de bultos, estado del film y de los pallets, identificación visible y datos del transportista. Imprimir <b>dos remitos de entrega y dos constancias de recepción</b>. El transportista completa y firma la <b>Constancia de recepción</b> antes de retirarse. La carga debe ser segura (sin golpes, pallets derechos, film intacto); se recomienda fotografiar los pallets dentro de la unidad.</p>

    ${h("Si el pedido se carga a granel")}
    ${ol([
      "Se usa el mismo protocolo de armado (se prepara en pallet) y almacenamiento.",
      "Al llegar el transporte se imprime una proforma de control de carga a granel.",
      "Se acerca el/los pallet(s) al transporte y se abre con cuidado el film.",
      "Se carga la mercadería mientras se controla y tilda en la proforma.",
      "Se firma la proforma.",
    ])}

    ${h("Incumplimientos")}
    <p>Se considera incumplimiento: no hacer los conteos, tildar sin controlar, firmar un control no realizado, abrir un pallet sin autorización, sacar/agregar mercadería sin registrarla, reutilizar un precinto, ocultar un error, alterar una planilla, preparar fuera del área, mezclar pedidos de distintos clientes, despachar con diferencias conocidas o no informar la rotura del film.</p>

    <div class="firma" style="margin-top:28px">
      <div class="linea">Empleado (nombre, DNI y firma)</div>
      <div class="linea">Responsable de la capacitación</div>
    </div>
  </div>`;
  const extraCss = `
    .proto { font-size: 12px; line-height: 1.55; }
    .proto h2 { font-size: 14px; color: #0a5b7a; margin: 16px 0 4px; border-bottom: 1px solid #0a5b7a; padding-bottom: 2px; }
    .proto ul, .proto ol { margin: 4px 0 4px 18px; padding: 0; }
    .proto li { margin-bottom: 3px; }
    .proto p { margin: 6px 0; }
    .tipo { font-size: 15px; }`;
  return a4Shell("Protocolo de preparación", `${body}<style>${extraCss}</style>`);
}

/** Abre la ventana del remito, lista para imprimir o guardar como PDF. */
export function printRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}

/** Igual que printRemito (se mantiene por compatibilidad). */
export function openRemito(r: Remito): void {
  abrirA4(remitoHTML(r));
}
