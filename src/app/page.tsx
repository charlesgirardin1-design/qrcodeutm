import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Link2, QrCode, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

const FEATURES = [
  {
    icon: Target,
    title: "UTM Builder",
    description: "Construisez des liens traçables avec des presets réutilisables et un aperçu en temps réel.",
  },
  {
    icon: Link2,
    title: "Raccourcisseur de liens",
    description: "Slugs personnalisables, expiration programmable et redirections 301/302 ultra-rapides.",
  },
  {
    icon: BarChart3,
    title: "Analytics en temps réel",
    description: "Clics uniques, géolocalisation, appareils, referrers et performance par campagne UTM.",
  },
  {
    icon: QrCode,
    title: "QR Code Studio",
    description: "QR codes personnalisés (couleurs, dégradés, logo) exportables en PNG, SVG et PDF.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="container flex items-center justify-between py-6">
        <span className="text-lg font-bold">LinkForge</span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Commencer gratuitement</Link>
          </Button>
        </nav>
      </header>

      <main className="container py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Vos liens marketing, <span className="text-primary">optimisés de bout en bout</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            UTM Builder, raccourcisseur de liens, analytics temps réel et générateur de QR codes
            personnalisés — dans une seule plateforme.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Créer mon premier lien</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
