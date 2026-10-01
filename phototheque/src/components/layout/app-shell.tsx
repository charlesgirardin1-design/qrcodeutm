"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderTree, Images, LayoutDashboard, LogOut, Settings, Upload } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth/roles";

const ADMIN_NAV = [
  { href: "/dashboard", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { href: "/phototheque", label: "Photothèque", short: "Photos", icon: Images },
  { href: "/import", label: "Importer des médias", short: "Importer", icon: Upload },
  { href: "/categories", label: "Catégories & activités", short: "Catégories", icon: FolderTree },
  { href: "/parametres", label: "Paramètres", short: "Réglages", icon: Settings },
];

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

export function AppShell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (role !== "ADMIN") {
    // Interface USER : uniquement l'importation.
    return (
      <div className="min-h-[100dvh] bg-gray-50/60">
        <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Logo />
            <button onClick={logout} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] bg-gray-50/60">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r bg-white px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav className="space-y-1">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground",
                isActive(href) && "bg-gray-100 text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive(href) && "text-primary")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t pt-4">
          <div className="px-3 pb-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">Administrateur</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-gray-100 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête (mobile / tablette) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <button onClick={logout} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Déconnexion">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

        {/* Navigation basse (mobile / tablette) */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white lg:hidden">
          {ADMIN_NAV.map(({ href, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                isActive(href) && "text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
              {short}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
