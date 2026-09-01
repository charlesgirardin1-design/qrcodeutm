import { PresetsManager } from "@/components/presets/presets-manager";

export default function PresetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Presets UTM</h1>
        <p className="text-sm text-muted-foreground">
          Sauvegardez vos combinaisons source/medium/campagne pour les réutiliser en un clic.
        </p>
      </div>
      <PresetsManager />
    </div>
  );
}
