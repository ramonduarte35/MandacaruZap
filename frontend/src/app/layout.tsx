import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandacaruZap - Painel de Afiliados",
  description: "Sistema SaaS de automação de links de afiliado para WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
