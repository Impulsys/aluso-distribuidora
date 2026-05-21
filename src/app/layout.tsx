import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://distribuidora-los-amigos-noa.web.app"),
  title: {
    default: "Distribuidora Los Amigos NOA · Mayorista del NOA",
    template: "%s · Distribuidora Los Amigos NOA",
  },
  description:
    "Distribuidora mayorista del Noroeste argentino. Doncella y Nonisec (Lenterdit): cuidado adulto, incontinencia, higiene femenina y bebé para farmacias, geriátricos y comercios.",
  keywords: [
    "distribuidora mayorista",
    "NOA",
    "Doncella",
    "Nonisec",
    "Lenterdit",
    "pañales adulto",
    "incontinencia",
    "toallas femeninas",
    "protectores diarios",
    "babylook",
    "farmacia",
    "geriátrico",
  ],
  manifest: "/manifest.json",
  applicationName: "Los Amigos NOA",
  appleWebApp: {
    capable: true,
    title: "Los Amigos NOA",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Distribuidora Los Amigos NOA",
    title: "Distribuidora Los Amigos NOA · Mayorista del NOA",
    description:
      "Doncella y Nonisec al mejor precio mayorista del NOA. Pedidos por WhatsApp en segundos.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Distribuidora Los Amigos NOA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Distribuidora Los Amigos NOA",
    description:
      "Doncella y Nonisec al mejor precio mayorista del NOA.",
    images: ["/icons/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#006081",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <PWARegister />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
