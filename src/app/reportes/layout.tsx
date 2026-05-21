import RouteGuard from "@/components/RouteGuard";

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard min="socio">
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </RouteGuard>
  );
}
