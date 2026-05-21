import Link from "next/link";
import { Suspense } from "react";
import ProductCatalog from "@/components/ProductCatalog";

export default function VendedorNuevoPedidoPage() {
  return (
    <div>
      <section className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl">Nuevo pedido</h2>
            <p className="mt-1 text-sm text-secondary">
              Armá el carrito con los productos del cliente. Al final lo
              registrás en la plataforma y se envía por WhatsApp en un click.
            </p>
          </div>
          <Link
            href="/carrito"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow hover:bg-secondary"
          >
            🛒 Ir al carrito y registrar →
          </Link>
        </div>
      </section>

      <Suspense
        fallback={
          <p className="py-12 text-center text-brand-dark/60">
            Cargando catálogo…
          </p>
        }
      >
        <ProductCatalog />
      </Suspense>
    </div>
  );
}
