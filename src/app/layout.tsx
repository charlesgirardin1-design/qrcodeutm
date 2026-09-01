import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkForge — UTM Builder, Raccourcisseur & QR Codes",
  description:
    "Créez, raccourcissez et suivez vos liens marketing en temps réel. UTM Builder, raccourcisseur de liens, analytics et QR codes personnalisés.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
