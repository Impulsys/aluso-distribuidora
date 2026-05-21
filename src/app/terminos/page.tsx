import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones · Distribuidora Los Amigos NOA",
};

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <span className="text-xs uppercase tracking-[0.22em] text-primary">
          Legales
        </span>
        <h1 className="mt-2 font-serif text-3xl text-brand-dark sm:text-4xl">
          Términos y condiciones
        </h1>
        <p className="mt-2 text-sm text-brand-dark/60">
          Última actualización: {new Date().toLocaleDateString("es-AR")}
        </p>
      </header>

      <div className="prose prose-sm max-w-none space-y-4 text-brand-dark/80">
        <section>
          <h2 className="font-serif text-xl text-brand-dark">1. Quiénes somos</h2>
          <p>
            Esta plataforma pertenece a <b>Distribuidora Los Amigos NOA</b>,
            con domicilio comercial en el Noroeste argentino. Es un canal
            digital de catálogo y pedidos mayoristas. El sitio es operado y
            mantenido por Impulsys en nombre de la distribuidora.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            2. Objeto del servicio
          </h2>
          <p>
            La plataforma permite visualizar el catálogo de productos
            distribuidos (Doncella, Nonisec y otras marcas), armar un pedido
            virtual mediante carrito y comunicar la intención de compra al
            equipo de la distribuidora a través de WhatsApp o del panel
            interno. Vendedores autorizados pueden registrar pedidos en nombre
            de clientes.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            3. Pedidos y precios
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Los precios mostrados son <b>mayoristas</b> y referenciales.
              Pueden variar sin previo aviso por actualizaciones del fabricante
              o variaciones del mercado.
            </li>
            <li>
              Todo pedido recibido a través de la plataforma queda{" "}
              <b>sujeto a confirmación</b> por parte de la distribuidora. La
              disponibilidad de stock se valida al momento de procesar el
              pedido.
            </li>
            <li>
              Las formas de pago, plazos de entrega y condiciones comerciales
              específicas se acuerdan con cada cliente al confirmar el pedido.
            </li>
            <li>
              El envío del pedido por WhatsApp es una solicitud de cotización
              /compra: no constituye una compra perfeccionada hasta que la
              distribuidora la confirme.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">4. Usuarios y roles</h2>
          <p>
            Los clientes pueden navegar el catálogo libremente y enviar
            pedidos sin necesidad de registrarse. Los vendedores, socios y
            administradores ingresan con credenciales otorgadas por la
            distribuidora; el uso de estas credenciales es personal e
            intransferible.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            5. Uso aceptable
          </h2>
          <p>
            Está prohibido utilizar la plataforma con fines fraudulentos,
            cargar información falsa, intentar accesos no autorizados o
            interferir con su normal funcionamiento. La distribuidora se
            reserva el derecho de suspender cuentas que incumplan estas
            condiciones.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            6. Propiedad intelectual
          </h2>
          <p>
            Los logos, marcas, imágenes y contenidos de productos son
            propiedad de sus respectivos titulares (Lenterdit, Doncella,
            Nonisec, etc.). Su uso en esta plataforma se realiza con fines de
            comercialización autorizados como distribuidor.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            7. Modificaciones
          </h2>
          <p>
            Estos términos pueden ser actualizados en cualquier momento. La
            versión vigente es siempre la publicada en esta página.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            8. Jurisdicción
          </h2>
          <p>
            Cualquier controversia se rige por las leyes de la República
            Argentina, con jurisdicción de los tribunales ordinarios del
            domicilio comercial de la distribuidora.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">9. Contacto</h2>
          <p>
            Para consultas relacionadas con estos términos, escribinos por
            WhatsApp desde la plataforma o a los datos de contacto del pie de
            página.
          </p>
        </section>
      </div>
    </div>
  );
}
