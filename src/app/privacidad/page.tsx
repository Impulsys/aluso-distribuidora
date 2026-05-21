import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Distribuidora Los Amigos NOA",
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <span className="text-xs uppercase tracking-[0.22em] text-primary">
          Legales
        </span>
        <h1 className="mt-2 font-serif text-3xl text-brand-dark sm:text-4xl">
          Política de privacidad
        </h1>
        <p className="mt-2 text-sm text-brand-dark/60">
          Última actualización: {new Date().toLocaleDateString("es-AR")}
        </p>
      </header>

      <div className="space-y-4 text-brand-dark/80">
        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            1. Información que recopilamos
          </h2>
          <p>
            En esta plataforma podemos recopilar la siguiente información:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>Datos de cuenta</b>: nombre, email y foto de perfil cuando
              ingresás con Google, o nombre y email si usás un usuario interno
              (vendedor/socio/admin).
            </li>
            <li>
              <b>Datos de pedido</b>: productos solicitados, nombre del
              cliente, teléfono y notas que ingreses al armar un pedido.
            </li>
            <li>
              <b>Datos técnicos básicos</b>: información necesaria para que la
              plataforma funcione (token de autenticación, idioma, navegador).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            2. Para qué usamos esos datos
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Procesar y entregar los pedidos.</li>
            <li>
              Comunicarnos con vos vía WhatsApp si así lo iniciás desde la
              plataforma.
            </li>
            <li>
              Llevar la trazabilidad interna del negocio (qué vendió cada
              vendedor, qué pedidos hay en curso, etc).
            </li>
            <li>Mejorar la plataforma y resolver problemas técnicos.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            3. Con quién compartimos
          </h2>
          <p>
            Tus datos se almacenan en <b>Google Firebase</b> (Firestore +
            Authentication) con las medidas de seguridad estándar de Google.
            No vendemos ni cedemos datos personales a terceros con fines
            comerciales. Compartimos información sólo con las personas dentro
            de la distribuidora que necesitan acceder para procesar tu pedido.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">4. WhatsApp</h2>
          <p>
            Cuando enviás un pedido o consulta por WhatsApp, la información
            que pegues en el mensaje viaja por WhatsApp y queda sujeta a sus{" "}
            <a
              href="https://www.whatsapp.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              propias políticas de privacidad
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            5. Cookies y almacenamiento local
          </h2>
          <p>
            Usamos almacenamiento local del navegador (localStorage) para
            recordar el contenido de tu carrito entre visitas. No usamos
            cookies de seguimiento publicitario.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            6. Tus derechos
          </h2>
          <p>
            De acuerdo con la Ley Nº 25.326 de Protección de Datos Personales
            de la República Argentina, podés solicitar acceder, rectificar o
            eliminar tus datos personales escribiéndonos por WhatsApp desde la
            plataforma o por los canales de contacto del pie de página.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brand-dark">
            7. Cambios a esta política
          </h2>
          <p>
            Podemos actualizar esta política cuando incorporemos nuevas
            funcionalidades. La versión vigente es siempre la publicada en
            esta página.
          </p>
        </section>
      </div>
    </div>
  );
}
