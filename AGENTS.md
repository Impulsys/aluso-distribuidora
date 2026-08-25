# AGENTS.md — reglas para agentes de código en este repo

Este archivo es el contrato para CUALQUIER agente de código que no sea la
sesión principal de Claude (Codex, u otros). Si estás leyendo esto como
agente: estas reglas no son sugerencias.

## Qué es este repo

App de catálogo + pedidos + reportes para una distribuidora mayorista (cliente "ALUSO"), clonada a partir de "Distribuidora Los Amigos NOA" — otro cliente real de Impulsys que sigue en producción en un repo aparte. Next.js + Firebase (proyecto propio `aluso-distribuidora`). Fase 1 completa (branding, auth, seed de productos); AFIP sin configurar todavía y datos de negocio del cliente ALUSO vacíos a propósito, pendientes de que el cliente los cargue. No consta si ya está de cara al cliente final en producción: preguntar antes de asumirlo.

Hasta que "Estado actual" de `COORDINACION.md` diga lo contrario, asumí que hay clientes usando producción: un cambio mal integrado rompe algo que alguien usa hoy.

## Antes de cualquier tarea: leé `COORDINACION.md`

`COORDINACION.md` (raíz) es el documento compartido entre TODAS las sesiones
que trabajan en este repo: Claude en la PC, Claude en la notebook, y vos.
Es la última versión del contexto. Antes de opinar, auditar o tocar algo:

1. `git pull` (o pedí que lo hagan) para tener la última versión.
2. Leé el bloque **"Estado actual"** de arriba de todo: qué hay en
   producción, qué está en curso, qué está pendiente y qué pregunta abierta
   hay entre agentes.
3. Leé las entradas del registro que no conocías. Lo que parece faltante
   puede haberse hecho ayer en la otra máquina o por el otro agente.

Y después de cada tarea tuya que deje algo (una auditoría, una edición,
un commit, una pregunta que quede abierta), dejás tu entrada ahí. Formato en
el mismo archivo.

## Tus tres modos de trabajo

La regla de este repo no es de capacidad, es de **autorización**: podés hacer
todo lo que Lautaro te pida, pero solo cuando te lo pide explícitamente para
esa tarea. Sin ese OK, sos solo lectura. El permiso se da por tarea, en la
conversación en curso; no arrastra a la tarea siguiente ni a otra sesión.

### Modo 1 — LECTURA Y ANÁLISIS (por defecto, siempre)

- Podés leer todo el código (salvo lo listado en "Datos que no se tocan"),
  analizar diffs, correr `tsc`/build/tests de solo lectura, señalar bugs y
  proponer cambios como diff o como texto.
- **No modificás ningún archivo del working tree**, salvo los dos del modo
  3 (`AUDITORIAS.md` y tu entrada en `COORDINACION.md`).
- Si el pedido implica editar código y Lautaro no dijo explícitamente que
  edites, entregás la propuesta (diff o archivo aparte) y preguntás. No
  aplicás.

### Modo 2 — TRABAJO COMPLETO (solo con OK explícito de Lautaro para esa tarea)

Con OK explícito de Lautaro podés hacer **todo** lo que él te pida para esa
tarea: editar archivos, instalar dependencias, correr builds, commitear,
pushear y deployar.

- Se habilita únicamente cuando Lautaro, en esta conversación y para esta
  tarea, dice algo inequívoco: "editá", "aplicalo", "implementalo vos",
  "hacé el cambio", "commiteá", "pusheá", "deployá". Un "dale" a una
  propuesta ambigua **no** alcanza: preguntá antes de tocar.
- **El permiso cubre exactamente lo que dijo.** "Editá" no incluye commit;
  "commiteá" no incluye push; "pusheá" no incluye deploy. Cada paso
  siguiente, pedilo. Aprobar un deploy una vez no aprueba los siguientes.
- Es por tarea y por conversación. Terminada la tarea, volvés al modo 1.
- Editás solo los archivos que la tarea necesita. Nada de "ya que estoy".
  Si en el medio el cambio resulta más grande de lo acordado, frenás y
  avisás: el permiso cubre lo que se pidió, no lo que apareció.
- Al terminar dejás tu entrada en `COORDINACION.md` — tipo `edición Codex`
  si solo editaste, `commit` o `deploy` si llegaste hasta ahí — con la lista
  exacta de archivos, el hash y qué verificaste. **Si commiteás, la entrada
  va en el mismo commit** (regla del repo). Si deployás, verificación
  post-deploy y registro apenas termina. Después de un commit o deploy,
  reescribís también el bloque "Estado actual".
- Si la tarea toca reglas de seguridad, dinero o datos de clientes, decilo
  en la entrada para que Claude lo revise en su próxima sesión.

### Modo 3 — SUBIR TU AUDITORÍA A GIT (permiso permanente, alcance cerrado)

No necesita OK: es permanente, pero está acotado a dos archivos:
**`AUDITORIAS.md`** y **tu entrada en `COORDINACION.md`**. Nada más viaja en
un commit de este modo.

- Para subir, usás **siempre** el script, nunca `git add`/`commit`/`push` a
  mano:

  ```
  node scripts/subir-auditoria.mjs "<título corto de la auditoría>"
  ```

  El script hace `git pull --rebase`, agrega SOLO esos dos archivos,
  commitea como `audit(codex): <título>` y pushea a la rama principal. Si
  hay conflicto o algo no cierra, aborta y te dice qué pasa: en ese caso
  avisá, no lo resuelvas a mano.
- Si el script rechaza (por ejemplo, porque `AUDITORIAS.md` no cambió, o la
  rama no es la principal, o hay staging de otra sesión), no hay atajo: el
  rechazo es la regla.

### Lo que sigue prohibido en cualquier modo (no son permisos: es seguridad)

- **Reescribir historial compartido**: `git push --force`, `git reset --hard`
  sobre commits ya pusheados, `rebase` de ramas publicadas. Rompe el trabajo
  de las otras tres sesiones.
- **Subir, pegar o mandar a la nube** secretos o datos de clientes (sección
  "Datos que NO se tocan").
- **Reescribir o borrar entradas ajenas** en `COORDINACION.md` o
  `AUDITORIAS.md`.
- **Actuar sobre algo que en "Estado actual" figura "en curso" por otra
  sesión** sin preguntar antes.

## Dónde dejás tu trabajo: `AUDITORIAS.md`

Tu entregable principal como revisor es una entrada en **`AUDITORIAS.md`**
(raíz). Reglas:

- Usá el formato que está en ese archivo, sin cambiarlo: una entrada nueva
  ARRIBA de las anteriores, con `auditor: Codex`.
- Cada hallazgo cita **archivo y línea**. Sin cita no es hallazgo.
- Separá lo que **ROMPE** (bug, permisos, plata mal calculada) de lo que
  **MEJORA** (deuda, estilo). Primero lo que rompe.
- Todo hallazgo nuevo nace `ABIERTO`. El estado lo cambia quien integra, no
  vos. La sección "Plan de acción" la completa quien integra: dejala vacía.
- Lo dudoso va en **Preguntas**, no en la tabla.
- No pegues datos sensibles: ni montos con nombre de cliente, ni
  credenciales, ni contenido de planillas de clientes. Citá la ubicación,
  no el contenido.
- No modifiques entradas anteriores ni sus estados. Si algo ya auditado
  sigue mal, va como hallazgo nuevo en tu entrada, con referencia al
  número viejo.
- Después de escribirla: entrada en `COORDINACION.md` (tipo `auditoría`,
  una línea por hallazgo ROMPE como mínimo) y subís las dos con el script
  del modo 3. Claude la lee en su próxima sesión, en cualquiera de las dos
  máquinas.

## Cómo se habla entre agentes

- Vos y Claude no se corrigen en silencio. Si no estás de acuerdo con algo
  que Claude registró en `COORDINACION.md`, dejás una entrada tipo
  `pregunta` con las dos posturas y Lautaro decide.
- Las preguntas abiertas se listan en "Estado actual → Pendientes entre
  agentes". Las cierra quien las responde, dejando entrada.
- No repitas trabajo: si en "Estado actual" figura algo "en curso" por otra
  sesión, no lo audites ni lo edites hasta que figure como hecho.

## Reglas duras de este repo (aplican a cualquier propuesta o edición)

1. **`COORDINACION.md`** es la fuente de contexto compartida; se lee antes y se escribe después. Toda acción relevante queda registrada ahí.
2. **Si existe `CLAUDE.md` en la raíz, leelo: sus reglas duras aplican también a vos.** (Acá `CLAUDE.md` es un `@AGENTS.md`, y ese `AGENTS.md` SÍ trae reglas de negocio propias y explícitas — ver siguientes puntos, tomados literalmente de ahí.)
3. **"Distribuidora Los Amigos NOA" NO SE TOCA desde este repo, bajo ninguna circunstancia.** Es un cliente real y distinto, en producción y funcionando (orden del dueño, 20/7/2026: "Los Amigos queda blindada. Salvo un pedido puntual, no se toca más."). Nunca correr `deploy`, `firestore:delete` ni nada que escriba contra el proyecto Firebase `distribuidora-los-amigos-noa`; evitar incluso lecturas salvo necesidad avisada.
4. **No traer a este repo el `serviceAccountKey.json` ni los certificados AFIP de Los Amigos NOA.** Se borraron a propósito el 20/7/2026 (los originales viven en otro repo, `D:\Proyectos\Clientes\distribuidora-losamigos-noa`). Si un script pide credenciales, hay que generar las **de ALUSO**, nunca reusar las de ellos.
5. **No reintroducir datos de Los Amigos NOA** en el código: CUIT `20250642114`, punto de venta `6`, dominio `dlanoa.com`, dirección de La Quiaca (Jujuy), su mail y teléfono, o el dominio `distribuidora-los-amigos-noa.web.app`. Si alguno de esos valores aparece en el código de ALUSO es un error heredado del clon, no una configuración válida.
6. **AFIP de ALUSO está en `PENDIENTE`** (`AFIP_CUIT`, `AFIP_PTO_VENTA`, `AFIP_CERT`, `AFIP_KEY`) y `emitirFactura` aborta antes de tocar ARCA a propósito — no activar facturación real sin que el cliente entregue sus propios certificados.
7. Los datos de negocio de ALUSO (CUIT, domicilio, teléfono, mail) se cargan desde un formulario público del propio cliente (`formularioDatos`) y están vacíos a propósito — no completarlos a mano con datos inventados o de otro cliente.
8. `scripts/` trae herramientas operativas que escriben contra la base real (`set-stock.mjs`, `set-precios.mjs`, `reset-cero.mjs`, `reset-operacion.mjs`, `corregir-arqueo.mjs`, etc.) — correrlas fuera de un pedido puntual puede alterar stock, precios o caja reales.

## Datos que NO se tocan ni se suben a ningún lado

- El repo hermano `D:\Proyectos\Clientes\distribuidora-losamigos-noa` (u otra ruta donde viva) y su proyecto Firebase `distribuidora-los-amigos-noa` — cliente real y ajeno a ALUSO, blindado.
- `docs/afip-instructivo.md` — instructivo operativo de AFIP, tratar como interno.
- Cualquier `.env*` que se cree localmente (hoy el repo no trae ninguno en el listado raíz) — ahí van las claves de Firebase y, eventualmente, los certificados AFIP de ALUSO.
- `functions/` (Cloud Functions) y cualquier certificado/clave AFIP que se genere para ALUSO (`afip-generar-claves.mjs`, `afip-verificar-cert.mjs`).
- Si una tarea "en la nube" necesitara subir el repo, este repo NO se delega a la nube: trabajá solo en local.
- Si dudás si algo es sensible, lo es.

## Estilo

- Castellano rioplatense en comentarios y textos de UI ("vos", nunca "tú").
- Sin jerga marketinera en código, comentarios ni commits.
- Commits narrativos: qué pasó, por qué se decidió así, cómo se verificó.

---

## Instrucciones previas de este repo (se conservan; ante conflicto mandan las reglas de arriba)

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🛑 Distribuidora Los Amigos NOA NO SE TOCA

Este proyecto es un **clon** de `distribuidora-losamigos-noa`, que es **otro cliente,
está en producción y funcionando bien**. Orden del dueño (20/07/2026):

> "Los Amigos queda blindada. Salvo un pedido puntual, no se toca más."

**Nunca**, desde este repo:

- Correr comandos contra el proyecto Firebase `distribuidora-los-amigos-noa`
  (ni `deploy`, ni `firestore:delete`, ni nada que escriba). Las lecturas también
  se evitan salvo que haga falta y se avise.
- Traer acá su `serviceAccountKey.json` ni sus certificados de AFIP. Se borraron
  a propósito el 20/07/2026 (los originales viven en
  `D:/Proyectos/Clientes/distribuidora-losamigos-noa`). Si un script pide
  credenciales, hay que generar las **de ALUSO**, no copiar las de ellos.
- Reintroducir sus datos: CUIT `20250642114`, punto de venta `6`, dominio
  `dlanoa.com`, `Balcarce 836 · La Quiaca, Jujuy`, `maxi@distribuidoralosamigosnoa.com.ar`,
  el teléfono `+54 9 11 2759-7572` o el dominio `distribuidora-los-amigos-noa.web.app`.

Todo eso venía heredado del clon y estaba **activo**: la cabecera de remitos y
facturas, `emitirFactura` (que habría emitido comprobantes en ARCA contra el CUIT
de ellos), el pie de los reportes PDF, el sitemap, el dominio de los usuarios y
los scripts de AFIP. Se limpió el 20/07/2026. Si volvés a ver alguno de esos
valores en el código, es un error, no una configuración.

## Estado de ALUSO

- Proyecto Firebase propio: `aluso-distribuidora` (Firestore en `southamerica-east1`).
- Datos del negocio (CUIT, domicilio, teléfono, mail) **vacíos a propósito**: los
  carga el cliente en `https://alusodistribuidora.web.app/formulario-datos-aluso`
  y caen en la colección `formularioDatos`.
- AFIP sin configurar: los secretos `AFIP_CUIT`, `AFIP_PTO_VENTA`, `AFIP_CERT` y
  `AFIP_KEY` están en `PENDIENTE` y `emitirFactura` aborta antes de tocar ARCA.
  Los scripts de `scripts/afip-*.mjs` exigen `AFIP_CUIT` por variable de entorno.
