import RouteGuard from "@/components/RouteGuard";
import AdminTabs from "@/components/AdminTabs";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard min="superadmin">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <span className="text-xs uppercase tracking-[0.22em] text-primary">
            Panel
          </span>
          <h1 className="mt-1 font-serif text-3xl text-brand-dark sm:text-4xl">
            Administración
          </h1>
        </header>
        <AdminTabs />
        {children}
      </div>
    </RouteGuard>
  );
}
