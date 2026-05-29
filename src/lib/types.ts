// ===== Tipos del dominio — Distribuidora Los Amigos NOA =====

export type Role = "cliente" | "vendedor" | "socio" | "superadmin";

export const ROLE_LABELS: Record<Role, string> = {
  cliente: "Cliente",
  vendedor: "Vendedor",
  socio: "Socio administrador",
  superadmin: "Superadmin",
};

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
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
  ean?: string;
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
}

export interface CartItem {
  productId: string;
  nombre: string;
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
  items: CartItem[];
  total: number;
  status: OrderStatus;
  clienteNombre?: string;
  clienteTelefono?: string;
  notas?: string;
  formaPago?: FormaPago; // efectivo / cheque / transferencia
  truckId?: string; // asignación al camión activo del día
  createdAt: number;
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

export interface SupplierPayment {
  id: string;
  proveedorId: string;
  monto: number;
  fecha: number;
  formaPago?: FormaPago;
  purchaseId?: string; // imputado a una compra puntual; ausente = pago general a cuenta
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
  | "adelantos";

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  impuestos: "Impuestos",
  insumos: "Insumos",
  mantenimiento: "Mantenimiento",
  sueldos: "Sueldos (Joaquín / Benjamín)",
  fletes: "Fletes",
  cobertura_cheques: "Cobertura de cheques",
  adelantos: "Adelantos de sueldo",
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
  costoCamion?: number; // cuánto salió el camión
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
