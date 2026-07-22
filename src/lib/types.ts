// ===== Tipos del dominio — ALUSO DISTRIBUIDORA =====

export type Role = "cliente" | "vendedor" | "socio" | "superadmin" | "contador";

export const ROLE_LABELS: Record<Role, string> = {
  cliente: "Cliente",
  vendedor: "Vendedor",
  socio: "Socio administrador",
  superadmin: "Superadmin",
  contador: "Contador",
};

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
  createdAt: number;
}

// ===== Bitácora (auditoría) — registro inmutable de acciones del sistema =====
export interface BitacoraEntry {
  id: string;
  ts: number; // fecha y hora del evento (timestamp ms)
  uid: string; // quién lo hizo
  email: string;
  nombre: string;
  role: Role;
  accion: string; // ej "Anuló venta", "Creó producto"
  detalle?: string; // descripción legible (nombre/nº/monto afectado)
  entidad?: string; // colección/tipo afectado: "remito" | "producto" | ...
  entidadId?: string; // id del documento afectado
}

// ===== Promociones (banner destacado del catálogo, en carrusel) =====
export interface Promocion {
  id: string;
  productId: string; // producto asociado (imagen / precio / nombre base)
  badge: string; // cartel: "OFERTA" | "PROMOCIÓN" | "2x1" | texto libre
  titulo?: string; // título override (si vacío usa el nombre del producto)
  texto: string; // descripción de la oferta ("Llevá 3 y 1 de regalo", etc.)
  paleta: string; // id de la paleta de fondo (color sólido, ver PALETAS)
  colorTexto?: string; // color de las letras del anuncio (hex)
  mostrarPrecio: boolean; // mostrar precio (con tachado si hay oferta)
  // Oferta combinada (opcional): "llevá N del principal y te regalamos M de otro"
  cantidadLleva?: number; // cantidad del producto principal a llevar
  regaloProductId?: string; // producto de regalo (si hay)
  cantidadRegalo?: number; // cantidad que se regala (por defecto 1)
  textoRegalo?: string; // cartel del regalo (default "GRATIS")
  activo: boolean;
  orden: number; // orden en el carrusel (menor primero)
  createdAt: number;
}

// ===== Clientes (CRM simple) =====
export type CondicionIva =
  | "responsable_inscripto"
  | "monotributo"
  | "exento"
  | "consumidor_final";

export const CONDICION_IVA_LABELS: Record<CondicionIva, string> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributo: "Monotributista",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
};

export interface Cliente {
  id: string;
  nombre: string; // nombre / contacto
  razonSocial?: string;
  cuit?: string;
  condicionIva?: CondicionIva;
  email?: string;
  telefono?: string;
  direccionEntrega?: string;
  domicilioFiscal?: string;
  vendedorId?: string; // quién lo cargó (automático)
  vendedorNombre?: string; // snapshot
  createdAt: number;
}

export type Marca = "doncella" | "nonisec" | "lenterdit";

export const MARCAS: Record<Marca, string> = {
  doncella: "Doncella",
  nonisec: "Nonisec",
  lenterdit: "Lenterdit",
};

export interface Product {
  id: string;
  ean?: string; // código de barras
  codigo?: string; // código interno del producto (SKU), editable
  marca: Marca;
  nombre: string;
  descripcion: string;
  imagen: string;
  precioVenta: number; // ARS — 0 = "Consultar precio"
  precioCosto: number; // ARS — SOLO superadmin/socio. Nunca exponer a vendedor/cliente
  stock: number;
  categoria: string;
  activo: boolean;
  destacado?: boolean; // switch en Admin → aparece en el banner superior
  precioOferta?: number; // si > 0 y < precioVenta → muestra "OFERTA"
  eliminado?: boolean; // borrado lógico desde Admin (se oculta del catálogo y del admin)
}

export interface CartItem {
  productId: string;
  nombre: string;
  /**
   * Código interno (SKU). Se arrastra desde el catálogo para que el remito
   * generado desde un PEDIDO salga igual que el generado desde el POS: antes
   * el del pedido salía sin código y quedaban dos formatos de remito según de
   * dónde había venido la venta.
   */
  codigo?: string;
  precioVenta: number;
  cantidad: number;
}

export type OrderOrigin = "web" | "vendedor";
export type OrderStatus = "nuevo" | "en_proceso" | "entregado" | "cancelado";

export interface Order {
  id: string;
  origin: OrderOrigin;
  createdBy: string; // uid o "anonimo"
  createdByName: string;
  createdByRole?: Role; // rol de quien cargó el pedido (snapshot)
  items: CartItem[];
  total: number;
  status: OrderStatus;
  clienteNombre?: string;
  clienteTelefono?: string;
  // Cliente guardado (CRM) + datos snapshot para la entrega/factura
  clienteId?: string;
  clienteCuit?: string;
  clienteRazonSocial?: string;
  clienteCondicionIva?: CondicionIva;
  clienteDireccion?: string;
  // Entrega
  fechaEntrega?: number; // día agendado de entrega (timestamp)
  horarioEntrega?: string; // ej "10 a 12" o "16:30"
  entregado?: boolean; // se marca en la sección Entregas
  fechaEntregado?: number; // cuándo se marcó entregado
  notas?: string;
  formaPago?: FormaPago; // efectivo / cheque / transferencia
  truckId?: string; // asignación al camión activo del día
  remitoId?: string; // si ya se generó el remito de este pedido
  createdAt: number;
}

// ===== Ventas: Remito (descuenta stock) y Factura (no toca stock) =====

export interface RemitoItem {
  productId: string;
  codigo?: string; // código interno del producto (snapshot, para el ticket)
  nombre: string;
  cantidad: number;
  precioVenta: number; // ARS por unidad al momento de la venta
  costoUnitario: number; // ARS por unidad (snapshot para COGS)
}

export interface Remito {
  id: string;
  numero: string; // nº de guía, ej "R-000001"
  orderId?: string; // pedido del que se generó
  origin?: OrderOrigin;
  clienteNombre?: string;
  clienteCuit?: string;
  formaPago?: FormaPago; // efectivo / transferencia / cheque
  items: RemitoItem[];
  total: number; // total de venta
  facturaId?: string; // si ya se facturó
  anulado?: boolean; // venta anulada (devolvió stock); no cuenta en reportes/caja
  anuladoPor?: string;
  anuladoAt?: number;
  createdBy?: string;
  createdAt: number;
  fecha: number; // fecha de la venta (timestamp)
}

export type TipoFactura = "A" | "B" | "C";

export interface Factura {
  id: string;
  remitoId: string;
  remitoNumero: string;
  tipo: TipoFactura;
  consumidorFinal: boolean;
  cuit?: string;
  razonSocial?: string;
  items: RemitoItem[]; // snapshot
  neto: number;
  iva: number;
  total: number;
  // AFIP: se completan al emitir
  numero?: string; // nº de comprobante AFIP (ej "0006-00000002")
  puntoVenta?: number;
  cae?: string | null;
  caeVto?: string | null; // YYYYMMDD (formato AFIP)
  qrUrl?: string | null; // URL del QR oficial (RG 4291)
  verification?: "verified" | "mismatch" | "pending" | null;
  estado: "interna" | "emitida";
  createdBy?: string;
  createdAt: number;
  fecha: number;
}

// ===== Módulo Reportes — operación por CAMIÓN =====

export const PROVEEDORES = [
  "Lenterdith SA",
  "Fincadelazo SA",
  "Azucarera SA",
  "Arrocera SA",
] as const;

export const TRANSPORTES = ["Mafe (propio)"] as const;

// ===== Cuentas Corrientes — compras a proveedores (deudas) =====

export interface Proveedor {
  id: string;
  nombre: string;
  cuit?: string;
  contacto?: string; // teléfono / email / referente
  notas?: string;
  createdAt: number;
}

// A = facturado (con IVA) · B = sin facturar (remito, sin IVA)
export type PurchaseModalidad = "A" | "B";

export const MODALIDAD_LABELS: Record<PurchaseModalidad, string> = {
  A: "A (facturado)",
  B: "B (sin facturar)",
};

export interface Purchase {
  id: string;
  proveedorId: string;
  proveedorNombre: string; // snapshot al crear
  modalidad: PurchaseModalidad;
  numero: string; // nº de factura (A) o remito (B)
  monto: number; // ARS — la deuda generada
  fecha: number;
  camionId?: string; // si la compra vino con un camión
  camionNombre?: string; // snapshot
  createdBy?: string;
  createdAt: number;
}

// Operativa del pago a proveedor:
//  - deposito: depósito bancario en efectivo (con detalle opcional de billetes)
//  - transferencia: transferencia desde mi cuenta
//  - agencia: vía agencia de pagos (cobra una comisión % sobre el importe)
//  - banco/financiera/efectivo: valores antiguos usados por la Caja (CajaView)
export type PagoVia =
  | "deposito"
  | "transferencia"
  | "agencia"
  | "banco"
  | "financiera"
  | "efectivo";

export interface SupplierPayment {
  id: string;
  proveedorId: string;
  monto: number;
  fecha: number;
  formaPago?: FormaPago;
  purchaseId?: string; // imputado a una compra puntual; ausente = pago general a cuenta
  modalidad?: PurchaseModalidad; // A (facturado) / B (sin facturar) — a qué deuda va
  via?: PagoVia;
  comisionPct?: number; // % que cobra la agencia/financiera
  comisionMonto?: number; // monto * comisionPct / 100
  arqueoDeposito?: Record<string, number>; // billetes físicos enviados (denominación → cantidad)
  // Datos de la transferencia (cuando via = "transferencia")
  transferNumero?: string; // nº/comprobante de la transferencia
  transferBanco?: string; // banco emisor
  transferTitular?: string; // titular de la cuenta que transfiere (puede ser un cliente)
  // Datos del depósito bancario (cuando via = "deposito")
  depositoCuenta?: string; // nº de cuenta o CBU destino
  depositoTitular?: string; // titular de la cuenta donde se deposita
  desdeCaja?: boolean; // registrado desde la Caja del día (egreso de caja)
  /**
   * Identifica la OPERACIÓN de pago completa: un mismo "Registrar pago" puede
   * generar varios SupplierPayment (uno imputado a cada comprobante + uno a
   * cuenta) y UN gasto de comisión. Sin este vínculo, borrar el pago dejaba la
   * comisión viva y sin forma de encontrarla, y el arqueo marcaba un sobrante
   * falso. Ver deletePayment en lib/cuentas.ts.
   */
  grupoPagoId?: string;
  notas?: string;
  createdBy?: string;
  createdAt: number;
}

export interface TruckCargoItem {
  productId: string; // referencia al catálogo (Product.id / EAN)
  producto: string; // snapshot del nombre al cargar
  descripcion?: string; // notas/variante opcional
  cantidadUnidades: number;
  costoUnitario: number; // ARS por unidad
  precioVentaOptimo: number; // ARS sugerido al cargar (informativo, NO modifica catálogo)
}

export type FormaPago = "efectivo" | "cheque" | "transferencia";

export interface TruckSale {
  id: string;
  fecha: number;
  detalle: string;
  monto: number;
  formaPago: FormaPago;
}

export type ExpenseType =
  | "impuestos"
  | "insumos"
  | "mantenimiento"
  | "sueldos"
  | "fletes"
  | "cobertura_cheques"
  | "adelantos"
  | "comision_agencia";

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  impuestos: "Impuestos",
  insumos: "Insumos",
  mantenimiento: "Mantenimiento",
  sueldos: "Sueldos (Joaquín / Benjamín)",
  fletes: "Fletes",
  cobertura_cheques: "Cobertura de cheques",
  adelantos: "Adelantos de sueldo",
  comision_agencia: "Comisión agencia de pagos",
};

export interface TruckExpense {
  id: string;
  tipo: ExpenseType;
  detalle: string;
  monto: number;
  fecha: number;
}

// ====== Gasto diario (no atado a un camión específico) ======
// Se carga en /admin/gastos y se imputa al día seleccionado.
// El reporte del día agrupa estos por tipo.
export interface DailyExpense {
  id: string;
  fecha: number; // timestamp del DÍA (00:00:00)
  tipo: ExpenseType;
  monto: number;
  formaPago: FormaPago;
  detalle?: string;
  /** Ver SupplierPayment.grupoPagoId: ata la comisión al pago que la generó. */
  grupoPagoId?: string;
  createdBy?: string;
  createdAt: number;
}

export interface Truck {
  id: string;
  nombre: string; // ej: "Camión 1"
  color: string; // hex, ej "#3B82F6" — marca los días del calendario
  fechaIngreso: number;
  fechaCierre?: number; // si está cerrado: timestamp del cierre. Si no, undefined → "activo"
  descripcion?: string;
  proveedor?: string; // de PROVEEDORES u "otro"
  proveedorOtro?: string;
  transporte?: string; // de TRANSPORTES u "otro"
  transporteOtro?: string;
  proveedorId?: string; // vínculo al proveedor de la cuenta corriente (si aplica)
  numeroRemito?: string; // nº de remito del proveedor/transporte (compra B, sin facturar)
  numeroFactura?: string; // nº de factura del proveedor/transporte (compra A, facturado)
  costoCamion?: number; // gastos de LOGÍSTICA del camión (flete/descarga); se descuenta en la ganancia real
  logisticaDetalle?: string; // nota de qué incluye la logística (ej: "flete Mafe + descarga")
  porcentajeGanancia: number; // %
  carga?: TruckCargoItem[];
  ventas?: TruckSale[];
  gastos?: TruckExpense[];
  fechaVendidoTotal?: number;
  createdAt: number;
}

// ===== Cheques =====

export type CheckStatus = "pendiente" | "pagado" | "rechazado";

export interface Check {
  id: string;
  numero: string;
  banco: string;
  monto: number;
  fechaEmision: number;
  fechaPago: number; // dispara alerta 3 días antes
  beneficiario: string;
  status: CheckStatus;
  notas?: string;
}

// ===== Caja Fidel — cierre de caja DIARIO (se deposita en banco) =====

export interface CashMovement {
  id: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number;
  formaPago: FormaPago;
}

export interface CashClosing {
  id: string;
  fecha: number; // día del cierre
  cajaInicial: number;
  ventasDia: number;
  adelantos: number;
  movimientos: CashMovement[];
  totalDepositar: number; // lo que va al banco
  depositado: boolean;
  cerradoPor: string;
  createdAt: number;
}

