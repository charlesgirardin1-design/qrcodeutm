import { requirePagePermission } from "@/lib/auth/session";
import { Importer } from "@/components/import/importer";

export const metadata = { title: "Importer des médias — Photothèque" };

export default async function ImportPage() {
  await requirePagePermission("media:upload");
  return <Importer />;
}
