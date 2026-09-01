"use client";

import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Check, QrCode, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLinkSchema, type CreateLinkInput, buildDestinationUrl } from "@/lib/validations/link";
import { PresetSelector } from "@/components/utm-builder/preset-selector";
import { SavePresetDialog } from "@/components/utm-builder/save-preset-dialog";
import { getAppUrl } from "@/lib/utils";
import type { LinkListItem } from "@/types";

const DEFAULT_VALUES: CreateLinkInput = {
  destinationUrl: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
  customParams: [],
  lowercaseAndTrim: true,
  title: "",
  customSlug: "",
  redirectType: "TEMPORARY_302",
  expiresAt: "",
  presetId: "",
};

export function UtmBuilderForm() {
  const router = useRouter();
  const [presetRefreshKey, setPresetRefreshKey] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<LinkListItem | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLinkInput>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "customParams",
  });

  const watched = watch();

  const previewUrl = useMemo(() => {
    if (!watched.destinationUrl) return "";
    try {
      return buildDestinationUrl({
        destinationUrl: watched.destinationUrl,
        utmSource: watched.utmSource || "utm_source",
        utmMedium: watched.utmMedium || "utm_medium",
        utmCampaign: watched.utmCampaign || "utm_campaign",
        utmTerm: watched.utmTerm,
        utmContent: watched.utmContent,
        customParams: watched.customParams,
        lowercaseAndTrim: watched.lowercaseAndTrim,
      });
    } catch {
      return watched.destinationUrl;
    }
  }, [watched]);

  async function onSubmit(values: CreateLinkInput) {
    setSubmitError(null);
    setCreatedLink(null);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitError(data.error ?? "Une erreur est survenue.");
      return;
    }
    setCreatedLink(data.link);
    router.refresh();
  }

  const shortUrl = createdLink ? `${getAppUrl()}/${createdLink.slug}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Générateur de liens UTM</CardTitle>
          <CardDescription>
            Construisez un lien traçable, raccourcissez-le et suivez ses performances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="destinationUrl">URL de destination</Label>
              <Input
                id="destinationUrl"
                placeholder="https://exemple.com/page"
                {...register("destinationUrl")}
              />
              {errors.destinationUrl && (
                <p className="text-xs text-destructive">{errors.destinationUrl.message}</p>
              )}
            </div>

            <PresetSelector
              refreshKey={presetRefreshKey}
              selectedPresetId={selectedPresetId}
              onSelectedPresetIdChange={setSelectedPresetId}
              onApply={(preset) => {
                setValue("presetId", preset.id);
                if (preset.utmSource) setValue("utmSource", preset.utmSource);
                if (preset.utmMedium) setValue("utmMedium", preset.utmMedium);
                if (preset.utmCampaign) setValue("utmCampaign", preset.utmCampaign);
                if (preset.utmTerm) setValue("utmTerm", preset.utmTerm);
                if (preset.utmContent) setValue("utmContent", preset.utmContent);
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="utmSource">utm_source *</Label>
                <Input id="utmSource" placeholder="google, facebook..." {...register("utmSource")} />
                {errors.utmSource && <p className="text-xs text-destructive">{errors.utmSource.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utmMedium">utm_medium *</Label>
                <Input id="utmMedium" placeholder="cpc, email, social..." {...register("utmMedium")} />
                {errors.utmMedium && <p className="text-xs text-destructive">{errors.utmMedium.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="utmCampaign">utm_campaign *</Label>
                <Input id="utmCampaign" placeholder="ete_2026_promo" {...register("utmCampaign")} />
                {errors.utmCampaign && (
                  <p className="text-xs text-destructive">{errors.utmCampaign.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utmTerm">utm_term</Label>
                <Input id="utmTerm" placeholder="mots-clés (optionnel)" {...register("utmTerm")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utmContent">utm_content</Label>
                <Input id="utmContent" placeholder="variante A/B (optionnel)" {...register("utmContent")} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Paramètres personnalisés</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ key: "", value: "" })}
                >
                  <Plus /> Ajouter
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input placeholder="clé (ex: ref)" {...register(`customParams.${index}.key` as const)} />
                  <Input placeholder="valeur (ex: twitter)" {...register(`customParams.${index}.value` as const)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="lowercaseAndTrim"
                checked={watched.lowercaseAndTrim}
                onCheckedChange={(checked) => setValue("lowercaseAndTrim", checked)}
              />
              <Label htmlFor="lowercaseAndTrim" className="font-normal">
                Normaliser automatiquement (minuscules + suppression des espaces)
              </Label>
            </div>

            <hr />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titre (interne)</Label>
                <Input id="title" placeholder="Notes internes (optionnel)" {...register("title")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customSlug">Slug personnalisé</Label>
                <Input id="customSlug" placeholder="promo-ete (optionnel)" {...register("customSlug")} />
                {errors.customSlug && <p className="text-xs text-destructive">{errors.customSlug.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Type de redirection</Label>
                <Select
                  value={watched.redirectType}
                  onValueChange={(value) => setValue("redirectType", value as CreateLinkInput["redirectType"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEMPORARY_302">302 — Temporaire</SelectItem>
                    <SelectItem value="PERMANENT_301">301 — Permanente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Expiration (optionnel)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  onChange={(e) =>
                    setValue("expiresAt", e.target.value ? new Date(e.target.value).toISOString() : "")
                  }
                />
              </div>
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <div className="flex items-center justify-between">
              <SavePresetDialog
                values={{
                  utmSource: watched.utmSource,
                  utmMedium: watched.utmMedium,
                  utmCampaign: watched.utmCampaign,
                  utmTerm: watched.utmTerm,
                  utmContent: watched.utmContent,
                }}
                onSaved={() => setPresetRefreshKey((k) => k + 1)}
              />
              <Button type="submit" disabled={isSubmitting}>
                <Link2 /> {isSubmitting ? "Création..." : "Créer le lien court"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu en temps réel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-all rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
              {previewUrl || "https://exemple.com/..."}
            </p>
          </CardContent>
        </Card>

        {createdLink && (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">Lien créé 🎉</CardTitle>
              <CardDescription>Votre lien court est prêt à être partagé.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={shortUrl} className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(shortUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => router.push(`/qr-studio?linkId=${createdLink.id}`)}
                >
                  <QrCode /> Générer le QR Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    reset(DEFAULT_VALUES);
                    setCreatedLink(null);
                  }}
                >
                  Nouveau lien
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
