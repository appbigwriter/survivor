import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor Node autocontido para o contêiner do Easypanel.
  output: "standalone",
  // O app é quase todo dinâmico (sessão por cookie em todas as telas), então
  // o modelo clássico de renderização é mais simples que o Cache Components.
  cacheComponents: false,
  experimental: {
    serverActions: {
      // Fotos de refeições (fase 2) passam por Server Actions.
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
