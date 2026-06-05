# Instructivo ARCA (AFIP) — Alta de Facturación Electrónica

Distribuidora Los Amigos · CUIT **20250642114** · Condición: **Responsable Inscripto** · Ambiente: **Producción**

Este documento describe, paso a paso, qué hay que hacer **una sola vez** en el portal de
ARCA (con la clave fiscal del titular) para habilitar la emisión de comprobantes
electrónicos por Web Service (WSFE).

---

## Resumen del trámite

| # | Paso | Dónde | Resultado |
|---|------|-------|-----------|
| 0 | Generar clave + CSR | En la PC (script) | `private.key` + `losamigos.csr` |
| 1 | Subir CSR y descargar certificado | ARCA → Administración de Certificados Digitales | `losamigos.crt` |
| 2 | Vincular el certificado al servicio WSFE | ARCA → Administrador de Relaciones | Cert autorizado a facturar |
| 3 | (Opcional) Vincular a Padrón A13 | ARCA → Administrador de Relaciones | Autocompletar datos de clientes por CUIT |
| 4 | Habilitar Punto de Venta "RECE / Web Services" | ARCA → Administración de Puntos de Venta | Nº de punto de venta (ej. 1, 2, 3…) |
| 5 | Cargar los datos en el sistema | App (etapa server, ver abajo) | Listo para emitir |

---

## Paso 0 — Generar la clave privada y el CSR (en la PC)

```bash
node scripts/afip-generar-claves.mjs "RAZON SOCIAL LEGAL EXACTA"
```

> La **razón social legal** es como figura el titular en AFIP. Para una persona física
> (CUIT que empieza en 20/23/24/27) es normalmente **Apellido Nombre** del titular.

Genera dos archivos en la carpeta `afip/` (ya está en `.gitignore`, no se sube a git):

- **`private.key`** → la clave privada. **SECRETA.** Guardarla a resguardo (no se sube a
  ARCA ni a ningún lado). Si se pierde, hay que rehacer todo el trámite.
- **`losamigos.csr`** → el pedido de certificado. **Esto es lo que se sube a ARCA** (paso 1).

---

## Paso 1 — Subir el CSR y descargar el certificado

1. Entrar a **arca.gob.ar** con clave fiscal (nivel 3).
2. Buscar el servicio **"Administración de Certificados Digitales"** (si no aparece,
   habilitarlo desde *Administrador de Relaciones de Clave Fiscal → Adherir servicio*).
3. **Crear un alias** (ej. `losamigos`) y **subir el archivo `losamigos.csr`**.
4. ARCA procesa y permite **descargar el certificado** (`.crt` / `.pem`).
5. Guardar ese archivo como **`afip/losamigos.crt`** junto a la clave privada.

> ⚠️ Este certificado es de **PRODUCCIÓN**. No mezclar con uno de homologación: si el
> ambiente del cert no coincide con el del sistema, AFIP responde *"AC de confianza"*
> (error `cms.cert.untrusted`).

---

## Paso 2 — Vincular el certificado al servicio de Facturación (WSFE)

1. En ARCA: **"Administrador de Relaciones de Clave Fiscal"**.
2. **Nueva Relación** → Buscar el servicio **"Facturación Electrónica" (wsfe)**.
3. En *Representante*, seleccionar el **certificado/Computador Fiscal** recién creado (el alias `losamigos`).
4. Confirmar.

Sin este paso, AFIP rechaza con error `10016/10017` ("certificado no autorizado al servicio").

---

## Paso 3 — (Opcional) Vincular a Padrón A13

Permite que el sistema **autocomplete el nombre/razón social del cliente** tipeando su CUIT.

- Igual que el paso 2, pero el servicio es **"ws_sr_padron_a13"** (Padrón Alcance 13).

---

## Paso 4 — Habilitar el Punto de Venta para Web Services

1. En ARCA: **"Administración de Puntos de Venta y Domicilios"**.
2. **Agregar** un nuevo punto de venta.
3. **Tipo de emisión: "RECE - Web Services"** (NO "Factura en línea" / RCEL — ese es otro
   circuito y no sirve para este sistema).
4. Anotar el **número** asignado (ej. `1`, `2`, `3`…). Ese número se carga en el sistema.

> Importante: un punto de venta "Web Services" y uno "Factura en Línea" **no pueden ser el
> mismo número**. Si ya usan Factura en Línea con el 1, este será otro (ej. 2 o 3).

---

## Paso 5 — Datos a cargar en el sistema

Una vez completados los pasos anteriores, el sistema necesita esta configuración
(se carga en el módulo de facturación — **etapa server**, ver más abajo):

| Campo | Valor |
|-------|-------|
| CUIT emisor | `20250642114` |
| Razón social | *(la legal, la misma del CSR)* |
| Condición IVA | `responsable_inscripto` |
| Punto de venta | *(el nº del paso 4)* |
| Ambiente | `produccion` |
| Certificado (`.crt`) | contenido de `afip/losamigos.crt` (base64) |
| Clave privada (`.key`) | contenido de `afip/private.key` (base64) |

---

## ⚠️ Nota técnica — falta el componente server

La app actual es **export estático** (Firebase Hosting, sin backend). La emisión AFIP
**no puede correr en el navegador**:

- La **clave privada** no puede vivir en el cliente (sería un riesgo de seguridad grave).
- El SOAP + firma CMS (WSAA/WSFE) es **solo Node**, no funciona en el browser.

Por eso la **emisión** se implementa como **segunda etapa**: una **Firebase Cloud Function**
(o Functions de 2da gen) que:

1. Guarda cert/key de forma segura (Secret Manager / variables protegidas).
2. Expone un endpoint `POST /afip { action: 'generateInvoice', … }`.
3. Hace WSAA → WSFE → verificación → devuelve CAE + número + QR.
4. Persiste el comprobante en la colección `invoices` de Firestore.

El **remito** que ya imprimimos en 80 mm sirve de base visual del comprobante: cuando esté
la Function, el PDF fiscal usa el mismo diseño **+ el QR oficial** (lo único que el remito
no tiene).

### Comprobantes que va a emitir (Responsable Inscripto)

| Comprobante | Cuándo | Código AFIP |
|-------------|--------|-------------|
| **Factura A** | Cliente RI con CUIT (11 díg.) | 1 |
| **Factura B** | Consumidor final / Monotributo / Exento | 6 |
| **Nota de Crédito A/B** | Anular factura | 3 / 8 |
| **Nota de Débito A/B** | Cargo adicional | 2 / 7 |

---

## Checklist final antes de operar en serio

- [ ] `private.key` + `losamigos.crt` resguardados (backup seguro, fuera de git).
- [ ] Certificado vinculado a **wsfe** en ARCA.
- [ ] Punto de venta **"RECE Web Services"** creado y su número anotado.
- [ ] Cloud Function de emisión desplegada con cert/key cargados.
- [ ] **Prueba real**: emitir una **Factura B a Consumidor Final por importe mínimo** y
      verificar CAE + QR. Recién después, operar normal.
