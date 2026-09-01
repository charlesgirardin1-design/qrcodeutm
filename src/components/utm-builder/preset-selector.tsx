"use client";

import { useEffect, useState } from "react";
import type { Preset } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PresetSelectorProps {
  onApply: (preset: Preset) => void;
  selectedPresetId: string | null;
  onSelectedPresetIdChange: (id: string | null) => void;
  refreshKey?: number;
}

export function PresetSelector({
  onApply,
  selectedPresetId,
  onSelectedPresetIdChange,
  refreshKey,
}: PresetSelectorProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/presets")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPresets(data.presets ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!loading && presets.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>Preset de campagne</Label>
      <Select
        value={selectedPresetId ?? undefined}
        onValueChange={(value) => {
          onSelectedPresetIdChange(value);
          const preset = presets.find((p) => p.id === value);
          if (preset) onApply(preset);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Chargement..." : "Charger un preset (optionnel)"} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
