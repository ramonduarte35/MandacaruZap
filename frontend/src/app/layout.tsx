import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MandacaruZap — Automação de Afiliados para WhatsApp",
  description:
    "Automatize seus links de afiliado da Amazon, Shopee e Mercado Livre no WhatsApp. Converta todos os links dos seus grupos em comissão para você, no piloto automático.",
  keywords:
    "bot whatsapp afiliados, automação whatsapp afiliados, amazon afiliados whatsapp, mercado livre afiliados bot, shopee afiliados whatsapp",
  openGraph: {
    title: "MandacaruZap — Automação de Afiliados para WhatsApp",
    description:
      "Converta links de afiliado automaticamente em todos os seus grupos de WhatsApp. Trial de 7 dias grátis.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
