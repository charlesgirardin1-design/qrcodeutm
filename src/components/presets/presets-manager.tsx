"use client";

import { useEffect, useState } from "react";
import type { Preset } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { presetSchema } from "@/lib/validations/preset";

const EMPTY_FORM = { name: "", utmSource: "", utmMedium: "", utmCampaign: "", utmTerm: "", utmContent: "" };

export function PresetsManager() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/presets");
      const data = await res.json();
      setPresets(data.presets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = presetSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création.");
        return;
      }
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce preset ?")) return;
    await fetch(`/api/presets/${id}`, { method: "DELETE" });
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau preset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                placeholder="ex: Campagne Facebook Ads Q3"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>utm_source</Label>
                <Input value={form.utmSource} onChange={(e) => setForm((f) => ({ ...f, utmSource: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>utm_medium</Label>
                <Input value={form.utmMedium} onChange={(e) => setForm((f) => ({ ...f, utmMedium: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>utm_campaign</Label>
                <Input value={form.utmCampaign} onChange={(e) => setForm((f) => ({ ...f, utmCampaign: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>utm_term</Label>
                <Input value={form.utmTerm} onChange={(e) => setForm((f) => ({ ...f, utmTerm: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>utm_content</Label>
                <Input value={form.utmContent} onChange={(e) => setForm((f) => ({ ...f, utmContent: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              <Plus /> {submitting ? "Création..." : "Créer le preset"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Presets sauvegardés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && presets.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun preset pour le moment.</p>
          )}
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-start justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[preset.utmSource, preset.utmMedium, preset.utmCampaign].filter(Boolean).join(" / ") || "—"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(preset.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
