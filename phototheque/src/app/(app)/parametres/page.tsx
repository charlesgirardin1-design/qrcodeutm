import { requirePagePermission } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { config } from "@/lib/config";
import { Settings } from "@/components/settings/settings";

export const metadata = { title: "Paramètres — Photothèque" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requirePagePermission("settings:manage");
  return (
    <Settings
      name={session.name}
      storage={getStorage().name}
      maxUploadMb={Math.round(config.maxUploadBytes / 1024 / 1024)}
      timezone={config.timezone}
      passwordMode={process.env.ADMIN_PASSWORD_HASH ? "hash" : "plain"}
    />
  );
}
