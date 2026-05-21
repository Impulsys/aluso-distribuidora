import Image from "next/image";
import Link from "next/link";
import { waLink } from "@/lib/whatsapp";
import { PRODUCTOS_SEED } from "@/data/productos";

// ===== Helpers visuales =====
const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center sm:text-left">
    <div className="font-serif text-4xl font-light leading-none text-white sm:text-5xl">
      {value}
    </div>
    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/60">
      {label}
    </div>
  </div>
);

type BrandTone = "doncella" | "doncellaFem" | "nonisec";
const BRAND_BG: Record<BrandTone, string> = {
  doncella:    "bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100",
  doncellaFem: "bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-100",
  nonisec:     "bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100",
};
const BRAND_GRADIENT_OVERLAY: Record<BrandTone, string> = {
  doncella:    "from-rose-900/85 via-rose-900/40 to-transparent",
  doncellaFem: "from-indigo-900/85 via-indigo-900/40 to-transparent",
  nonisec:     "from-sky-900/85 via-sky-900/40 to-transparent",
};
const BRAND_CHIP: Record<BrandTone, string> = {
  doncella:    "bg-rose-600",
  doncellaFem: "bg-indigo-700",
  nonisec:     "bg-sky-700",
};
const BRAND_LABEL: Record<BrandTone, string> = {
  doncella:    "Doncella",
  doncellaFem: "Doncella Fem",
  nonisec:     "Nonisec",
};

const CategoryCard = ({
  href,
  title,
  hint,
  image,
  brand,
}: {
  href: string;
  title: string;
  hint: string;
  image: string;
  brand: BrandTone;
}) => (
  <Link
    href={href}
    className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-md transition hover:-translate-y-1 hover:shadow-xl ${BRAND_BG[brand]}`}
  >
    {/* Imagen del producto cubriendo todo */}
    <Image
      src={image}
      alt={title}
      fill
      sizes="(max-width:640px) 50vw, 33vw"
      className="object-contain p-6 transition-transform duration-500 group-hover:scale-110"
    />
    {/* Chip de marca arriba a la izquierda */}
    <span
      className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow ${BRAND_CHIP[brand]}`}
    >
      {BRAND_LABEL[brand]}
    </span>
    {/* Gradiente para legibilidad del texto */}
    <div
      className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${BRAND_GRADIENT_OVERLAY[brand]}`}
    />
    {/* Texto al pie */}
    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
      <h3 className="font-serif text-2xl leading-tight drop-shadow">
        {title}
      </h3>
      <p className="mt-1 text-sm text-white/80">{hint}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">
        Ver línea
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </div>
  </Link>
);

export default function LandingPage() {
  const totalProductos = PRODUCTOS_SEED.filter((p) => p.activo).length;
  const waConsulta = waLink(
    "Hola! Me interesa el catálogo mayorista de Distribuidora Los Amigos NOA. ¿Me pasan precios y disponibilidad?"
  );

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 80% at 80% 0%, #3a2566 0%, #1a1a4b 35%, #0a1530 70%, #050a1f 100%)",
          }}
        />
        {/* glow decorativo */}
        <div
          className="pointer-events-none absolute -right-32 top-10 -z-10 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #ff7e87, transparent)" }}
        />

        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-32">
          <div>
            <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-white/70">
              <span className="h-px w-8 bg-landing-coral" />
              Distribución mayorista · NOA Argentina
            </div>

            <h1 className="font-serif text-5xl font-light leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              Cuidado e higiene
              <br />
              para quienes{" "}
              <em
                className="font-serif italic"
                style={{ color: "var(--landing-coral)" }}
              >
                cuidan
              </em>
              <br />a otros.
            </h1>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Distribuimos las marcas{" "}
              <strong className="text-white">Nonisec</strong> y{" "}
              <strong className="text-white">Doncella</strong> en farmacias,
              geriátricos y comercios del Noroeste argentino. Stock permanente,
              logística propia y atención directa con el fabricante.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/catalogo"
                className="rounded-full bg-landing-coral px-7 py-3.5 text-sm font-semibold text-landing-navy shadow-lg shadow-rose-500/30 transition hover:shadow-rose-500/50"
              >
                Ver catálogo completo
              </Link>
              <a
                href={waConsulta}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                Pedir por WhatsApp →
              </a>
            </div>

            <div className="mt-12 flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.22em] text-white/45">
                Por
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2 shadow-md">
                <Image
                  src="/brand/lenterdit.png"
                  alt="Lenterdit"
                  width={120}
                  height={24}
                  className="h-6 w-auto object-contain"
                />
              </span>
            </div>
          </div>

          {/* Composición visual derecha — productos reales flotando con onda */}
          <div className="relative hidden h-[620px] lg:block">
            {/* Glow rosa + violeta de fondo */}
            <div
              className="pointer-events-none absolute -inset-10 -z-10"
              style={{
                background:
                  "radial-gradient(closest-side at 65% 40%, rgba(255,126,135,0.35), transparent 65%), radial-gradient(closest-side at 30% 75%, rgba(140,90,255,0.22), transparent 70%)",
              }}
            />
            {/* Patrón de puntos sutil */}
            <div className="bg-dots absolute inset-0 -z-10 opacity-50" />

            {/* Círculo decorativo grande blureado */}
            <div className="pointer-events-none absolute -right-12 top-20 -z-10 h-72 w-72 rounded-full bg-landing-coral/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 bottom-10 -z-10 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />

            {/* SVG decorativo: trazos dorados + sparkles */}
            <svg
              className="absolute inset-0 h-full w-full -z-10 opacity-60"
              viewBox="0 0 500 620"
              fill="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e6c89f" stopOpacity="0" />
                  <stop offset="50%" stopColor="#e6c89f" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#e6c89f" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M20 90 Q 250 30 480 130" stroke="url(#gold)" strokeWidth="1.2" fill="none" />
              <path d="M30 530 Q 230 600 490 470" stroke="url(#gold)" strokeWidth="1.2" fill="none" />
              <path d="M450 200 Q 480 300 440 410" stroke="url(#gold)" strokeWidth="0.8" fill="none" opacity="0.7" />
              {/* Sparkles ✦ varios tamaños */}
              <text x="425" y="80" fill="#e6c89f" opacity="0.85" fontSize="26" fontFamily="serif">✦</text>
              <text x="40"  y="400" fill="#e6c89f" opacity="0.55" fontSize="18" fontFamily="serif">✦</text>
              <text x="465" y="320" fill="#e6c89f" opacity="0.6"  fontSize="12" fontFamily="serif">✦</text>
              <text x="25"  y="180" fill="#e6c89f" opacity="0.45" fontSize="14" fontFamily="serif">✦</text>
              <text x="240" y="32"  fill="#e6c89f" opacity="0.45" fontSize="10" fontFamily="serif">✦</text>
              {/* Puntos dorados pequeños */}
              <circle cx="80"  cy="250" r="2.5" fill="#e6c89f" opacity="0.7" />
              <circle cx="450" cy="510" r="2"   fill="#e6c89f" opacity="0.6" />
              <circle cx="380" cy="40"  r="1.8" fill="#e6c89f" opacity="0.7" />
            </svg>

            {/* Chip flotante: "82 productos" */}
            <div className="float-d absolute right-8 top-0 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-landing-coral" />
              +{totalProductos} productos en stock
            </div>

            {/* Card BIG — Nonisec adulto ULTRA (protagonista, centro-izq) */}
            <div
              className="float-a absolute left-2 top-28 z-20 w-64 rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5"
              style={{
                ["--start" as never]: "rotate(2deg)",
                transform: "rotate(2deg)",
                boxShadow: "0 50px 90px -25px rgba(0,0,0,.75)",
              }}
            >
              <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                Nonisec · Ultra
              </span>
              <Image
                src="/productos/7790940410245.jpg"
                alt="Nonisec adulto ultra"
                width={500}
                height={500}
                className="h-64 w-full object-contain"
              />
              <div className="mt-2 text-center">
                <p className="font-serif text-xs italic text-brand-dark/70">
                  Cuidado adulto premium
                </p>
              </div>
            </div>

            {/* Card MID — Nonisec juvenil naranja (arriba-der) */}
            <div
              className="float-b absolute right-0 top-12 z-10 w-48 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5"
              style={{
                ["--start" as never]: "rotate(-7deg)",
                transform: "rotate(-7deg)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)",
              }}
            >
              <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Nonisec
              </span>
              <Image
                src="/productos/7790940888327.jpg"
                alt="Nonisec juvenil"
                width={320}
                height={320}
                className="h-44 w-full object-contain"
              />
            </div>

            {/* Card — Doncella toalla rosa (adelante-abajo-derecha) */}
            <div
              className="float-c absolute bottom-16 right-2 z-30 w-56 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-rose-200/40"
              style={{
                ["--start" as never]: "rotate(-4deg)",
                transform: "rotate(-4deg)",
                boxShadow: "0 40px 80px -20px rgba(255,126,135,.55)",
              }}
            >
              <span
                className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow"
                style={{ background: "var(--landing-coral)" }}
              >
                Doncella
              </span>
              <Image
                src="/productos/7790940216205.jpg"
                alt="Doncella toalla pocket"
                width={400}
                height={400}
                className="h-48 w-full object-contain"
              />
            </div>

            {/* Card chiquita — Doncella Algodón (abajo-izq) */}
            <div
              className="float-d absolute bottom-4 left-12 z-20 w-40 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-rose-200/30"
              style={{
                ["--start" as never]: "rotate(6deg)",
                transform: "rotate(6deg)",
                boxShadow: "0 28px 55px -18px rgba(255,126,135,.4)",
              }}
            >
              <span
                className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ background: "var(--landing-coral)" }}
              >
                Doncella
              </span>
              <Image
                src="/productos/7790940003034.jpg"
                alt="Doncella algodón hidrófilo"
                width={280}
                height={280}
                className="h-32 w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Banda de stats */}
        <div className="border-t border-white/10 bg-black/20 backdrop-blur">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-4">
            <Stat value={`+${totalProductos}`} label="Productos en stock" />
            <Stat value="2" label="Marcas líderes" />
            <Stat value="NOA" label="Cobertura regional" />
            <Stat value="Directa" label="Atención con el fabricante" />
          </div>
        </div>
      </section>

      {/* ============ CATEGORÍAS ============ */}
      <section className="bg-brand-light py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.22em] text-primary">
              Líneas
            </span>
            <h2 className="mt-3 font-serif text-4xl font-light leading-tight text-brand-dark sm:text-5xl">
              Todo lo necesario, organizado por{" "}
              <em
                className="font-serif italic"
                style={{ color: "var(--brand-primary)" }}
              >
                necesidad
              </em>
              .
            </h2>
            <p className="mt-4 text-brand-dark/60">
              De la higiene íntima diaria al cuidado adulto avanzado. Más de 80
              productos pensados para cada momento del cuidado.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CategoryCard
              href="/catalogo?marca=doncella&cat=Toallas+femeninas"
              image="/productos/7790940216205.jpg"
              brand="doncella"
              title="Toallas femeninas"
              hint="Pocket, nocturnas, tanga, ultrafinas"
            />
            <CategoryCard
              href="/catalogo?marca=doncella&cat=Protectores+diarios"
              image="/productos/7790940233264.jpg"
              brand="doncella"
              title="Protectores diarios"
              hint="Anatómicos, respirables, duo forma"
            />
            <CategoryCard
              href="/catalogo?marca=doncella&cat=Incontinencia+femenina"
              image="/productos/7790940518026.jpg"
              brand="doncellaFem"
              title="Incontinencia femenina"
              hint="Doncella Fem · mini, medium, maxi, super"
            />
            <CategoryCard
              href="/catalogo?marca=nonisec&cat=Anat%C3%B3mico"
              image="/productos/7790940410252.jpg"
              brand="nonisec"
              title="Pañal adulto anatómico"
              hint="Ultra, extra protección, símil tela"
            />
            <CategoryCard
              href="/catalogo?marca=nonisec&cat=Adulto+recto"
              image="/productos/7790940110008.jpg"
              brand="nonisec"
              title="Pañal adulto recto"
              hint="Juvenil, adulto, hospitalario, básico"
            />
            <CategoryCard
              href="/catalogo?marca=doncella&cat=Algod%C3%B3n"
              image="/productos/7790940411266.jpg"
              brand="doncella"
              title="Algodón y accesorios"
              hint="Hisopos, óleo, algodón, babylook"
            />
          </div>
        </div>
      </section>

      {/* ============ PARA QUIÉN ============ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.22em] text-primary">
              A quién servimos
            </span>
            <h2 className="mt-3 font-serif text-4xl font-light leading-tight text-brand-dark sm:text-5xl">
              Trabajamos con quienes{" "}
              <em
                className="font-serif italic"
                style={{ color: "var(--brand-primary)" }}
              >
                hacen la diferencia
              </em>{" "}
              todos los días.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Farmacias",
                copy: "Reposición ágil, precios mayoristas competitivos y rotación garantizada de las marcas más pedidas.",
                bg: "https://images.unsplash.com/photo-1639432522665-12c11347b61a?w=900&q=80&auto=format&fit=crop",
                tint:
                  "linear-gradient(180deg, rgba(6,95,70,0.15) 0%, rgba(6,78,59,0.45) 60%, rgba(6,78,59,0.82) 100%)",
              },
              {
                title: "Geriátricos y centros de salud",
                copy: "Logística pensada para volumen alto, talles institucionales y entregas programadas.",
                bg: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=900&q=80&auto=format&fit=crop",
                tint:
                  "linear-gradient(180deg, rgba(125,46,68,0.15) 0%, rgba(125,46,68,0.45) 55%, rgba(76,29,42,0.85) 100%)",
              },
              {
                title: "Despensas y autoservicios",
                copy: "Pañales, papel higiénico, aceite y azúcar — surtido mayorista para góndola con packs y entrega directa.",
                bg: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=900&q=80&auto=format&fit=crop",
                tint:
                  "linear-gradient(180deg, rgba(7,89,133,0.15) 0%, rgba(7,89,133,0.45) 55%, rgba(12,74,110,0.82) 100%)",
              },
            ].map((b) => (
              <div
                key={b.title}
                className="group relative overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                style={{
                  aspectRatio: "4 / 5",
                }}
              >
                {/* Zoom suave de la imagen en hover */}
                <div
                  className="absolute inset-0 -z-10 transition-transform duration-700 ease-out group-hover:scale-110"
                  style={{
                    backgroundImage: `url('${b.bg}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  aria-hidden
                />
                {/* Overlay tintado encima del zoom */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: b.tint }}
                  aria-hidden
                />

                <div className="relative flex h-full flex-col justify-end p-7 text-white">
                  <h3 className="font-serif text-2xl leading-tight drop-shadow sm:text-3xl">
                    {b.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/85">
                    {b.copy}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/90">
                    <span className="h-px w-6 bg-white/70 transition-all group-hover:w-10" />
                    Vendemos B2B
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="relative overflow-hidden bg-landing-navy py-24 text-white">
        <div
          className="pointer-events-none absolute -left-32 bottom-0 h-[400px] w-[400px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #ff7e87, transparent)" }}
        />
        <div className="mx-auto max-w-3xl px-4 text-center">
          <span className="text-xs uppercase tracking-[0.22em] text-white/60">
            Pedidos
          </span>
          <h2 className="mt-3 font-serif text-4xl font-light leading-tight sm:text-5xl">
            Empezá tu pedido{" "}
            <em className="font-serif italic" style={{ color: "var(--landing-coral)" }}>
              ahora
            </em>
            .
          </h2>
          <p className="mt-4 text-white/70">
            Revisá el catálogo completo o escribinos directo por WhatsApp. Te
            respondemos en el día con precios mayoristas y disponibilidad.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/catalogo"
              className="rounded-full bg-landing-coral px-7 py-3.5 text-sm font-semibold text-landing-navy shadow-lg shadow-rose-500/30 transition hover:shadow-rose-500/50"
            >
              Ver catálogo completo
            </Link>
            <a
              href={waConsulta}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Pedir por WhatsApp →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
