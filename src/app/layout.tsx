import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { WhatsAppFab } from "@/components/shared/WhatsAppFab";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Consulta Yolanda Miranda · Psicoanálisis",
  description: "Agenda tu sesión",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-cream-50 min-h-screen font-body text-pine-900">
        {children}
        <WhatsAppFab />
      </body>
    </html>
  );
}
