import RouteGuard from "@/components/RouteGuard";

/**
 * Área del DEPÓSITO. La ve el rol "deposito" (el pibe del depo) y, para
 * supervisar, socio/superadmin. NO usa el layout de /admin (nada de AdminTabs
 * ni precios): el depósito solo ve envíos y remitos SIN valorizar.
 */
export default function DepositoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard min="socio" roles={["deposito"]}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <span className="text-xs uppercase tracking-[0.22em] text-primary">
            Depósito
          </span>
          <h1 className="mt-1 font-serif text-3xl text-brand-dark sm:text-4xl">
            Armado y despacho
          </h1>
        </header>
        {children}
      </div>
    </RouteGuard>
  );
}
