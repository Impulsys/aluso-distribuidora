import RouteGuard from "@/components/RouteGuard";

export default function ContadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Acceso: el rol "contador" (su área exclusiva) + socio/superadmin (supervisión).
  return (
    <RouteGuard min="superadmin" roles={["contador", "socio"]}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <span className="text-xs uppercase tracking-[0.22em] text-primary">
            Área del contador
          </span>
          <h1 className="mt-1 font-serif text-3xl text-brand-dark sm:text-4xl">
            Contaduría
          </h1>
          <p className="mt-1 text-sm text-brand-dark/60">
            Remitos y facturas emitidos, con todo el detalle.
          </p>
        </header>
        {children}
      </div>
    </RouteGuard>
  );
}
