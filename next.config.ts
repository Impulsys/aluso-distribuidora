import type { NextConfig } from "next";

// Export estático → se sirve gratis en Firebase Hosting (plan Spark).
// Toda la lógica (Auth, Firestore, Storage) corre client-side con el SDK web,
// así que no necesitamos servidor.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
