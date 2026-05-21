import RouteGuard from "@/components/RouteGuard";
import ReportesTabs from "@/components/ReportesTabs";

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard min="socio">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-4">
          <span className="text-xs uppercase tracking-[0.22em] text-primary">
            Reportes
          </span>
          <h1 className="mt-1 font-serif text-3xl text-brand-dark sm:text-4xl">
            Reportes para socios
          </h1>
        </header>
        <ReportesTabs />
        {children}
      </div>
    </RouteGuard>
  );
}
