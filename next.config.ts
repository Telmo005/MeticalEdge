import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O indicador flutuante de dev (canto inferior esquerdo) sobrepunha o
  // botão "Sair" da sidebar — só aparece em `next dev`, nunca em produção,
  // mas desliga-se aqui para não confundir durante os testes.
  devIndicators: false,
};

export default nextConfig;
