import { UtmBuilderForm } from "@/components/utm-builder/utm-builder-form";
import { LinksTable } from "@/components/links/links-table";

export default function LinksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Créer un lien</h1>
        <p className="text-sm text-muted-foreground">
          Générez un lien UTM, raccourcissez-le et suivez ses performances.
        </p>
      </div>
      <UtmBuilderForm />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tous vos liens</h2>
        <LinksTable />
      </div>
    </div>
  );
}
