import RouteGuard from "@/components/RouteGuard";
import VendedorTabs from "@/components/VendedorTabs";

export default function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard min="vendedor">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <span className="text-xs uppercase tracking-[0.22em] text-primary">
            Panel
          </span>
          <h1 className="mt-1 font-serif text-3xl text-brand-dark sm:text-4xl">
            Vendedor
          </h1>
        </header>
        <VendedorTabs />
        {children}
      </div>
    </RouteGuard>
  );
}
