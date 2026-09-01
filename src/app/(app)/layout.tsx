import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-muted/20 p-4 lg:flex lg:flex-col">
        <Link href="/dashboard" className="mb-6 px-2 text-lg font-bold">
          LinkForge
        </Link>
        <SidebarNav />
        <div className="mt-auto space-y-2 border-t pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
