import type { MetadataRoute } from "next";

/** Next.js serve isto automaticamente em /manifest.webmanifest e liga-o no
 *  <head> sozinho — é o que faz o Android/Chrome oferecer "Adicionar ao
 *  ecrã principal" como app instalável, não só um atalho de browser. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MeticalEdge — Arbitragem Binance ↔ Bybit",
    short_name: "MeticalEdge",
    description: "Painel do robô de arbitragem cross-exchange entre Binance e Bybit",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
