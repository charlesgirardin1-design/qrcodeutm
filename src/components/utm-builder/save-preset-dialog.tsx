"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save } from "lucide-react";

interface SavePresetDialogProps {
  values: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm?: string;
    utmContent?: string;
  };
  onSaved: () => void;
}

export function SavePresetDialog({ values, onSaved }: SavePresetDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...values }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la sauvegarde.");
        return;
      }
      setOpen(false);
      setName("");
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Save /> Sauvegarder en preset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sauvegarder ce preset</DialogTitle>
          <DialogDescription>
            Réutilisez cette combinaison source/medium/campagne en un clic la prochaine fois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="preset-name">Nom du preset</Label>
          <Input
            id="preset-name"
            placeholder="ex: Campagne Facebook Ads Q3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={!name.trim() || loading}>
            {loading ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
