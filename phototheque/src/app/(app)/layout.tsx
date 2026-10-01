import { requirePagePermission } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePagePermission();
  return (
    <AppShell role={session.role} name={session.name}>
      {children}
    </AppShell>
  );
}
