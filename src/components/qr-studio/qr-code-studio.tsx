"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import { Download, ImageUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorInput } from "@/components/qr-studio/color-input";
import { defaultQrConfig, type QrConfig } from "@/lib/validations/qr";
import { toQrStylingOptions } from "@/lib/qr-styling-options";
import { getAppUrl } from "@/lib/utils";

export interface QrStudioLink {
  id: string;
  slug: string;
  destinationUrl: string;
  qrConfig: QrConfig | null;
}

interface QrCodeStudioProps {
  link: QrStudioLink | null;
  initialUrl?: string;
}

const DOT_STYLE_LABELS: Record<QrConfig["dotStyle"], string> = {
  SQUARE: "Carrés",
  DOTS: "Points",
  ROUNDED: "Arrondi",
  CLASSY: "Classy",
  CLASSY_ROUNDED: "Classy arrondi",
  EXTRA_ROUNDED: "Très arrondi",
};

export function QrCodeStudio({ link, initialUrl }: QrCodeStudioProps) {
  const shortUrl = link ? `${getAppUrl()}/${link.slug}` : null;
  const [freeformUrl, setFreeformUrl] = useState(initialUrl ?? "https://exemple.com");
  const [config, setConfig] = useState<QrConfig>(link?.qrConfig ?? defaultQrConfig);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const containerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const data = useMemo(() => {
    if (!link) return freeformUrl;
    return config.target === "SHORT_LINK" ? shortUrl! : link.destinationUrl;
  }, [link, shortUrl, config.target, freeformUrl]);

  function update<K extends keyof QrConfig>(key: K, value: QrConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateGradient<K extends keyof QrConfig["gradient"]>(key: K, value: QrConfig["gradient"][K]) {
    setConfig((prev) => ({ ...prev, gradient: { ...prev.gradient, [key]: value } }));
  }

  // Instancie qr-code-styling une seule fois, puis met à jour via `.update()`
  // à chaque changement de config (évite de recréer le DOM à chaque frappe).
  useEffect(() => {
    if (!containerRef.current) return;
    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling(toQrStylingOptions(config, data || " "));
      qrInstanceRef.current.append(containerRef.current);
    } else {
      qrInstanceRef.current.update(toQrStylingOptions(config, data || " "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, data]);

  // Persistance debouncée de la configuration QR sur le lien (si associé à un lien traqué).
  useEffect(() => {
    if (!link) return;
    setSaveState("saving");
    const timeout = setTimeout(async () => {
      try {
        await fetch(`/api/links/${link.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrConfig: config }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, link?.id]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function downloadPng() {
    await qrInstanceRef.current?.download({ name: `qr-${link?.slug ?? "code"}`, extension: "png" });
  }

  async function downloadSvg() {
    await qrInstanceRef.current?.download({ name: `qr-${link?.slug ?? "code"}`, extension: "svg" });
  }

  async function downloadPdf() {
    const instance = qrInstanceRef.current;
    if (!instance) return;
    const blob = (await instance.getRawData("svg")) as Blob | null;
    if (!blob) return;
    const svgText = await blob.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement;

    const pdf = new jsPDF({ unit: "pt", format: [config.size, config.size] });
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: config.size, height: config.size });
    pdf.save(`qr-${link?.slug ?? "code"}.pdf`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>QR Code Studio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!link && (
            <div className="space-y-1.5">
              <Label>URL à encoder</Label>
              <Input value={freeformUrl} onChange={(e) => setFreeformUrl(e.target.value)} />
            </div>
          )}

          {link && (
            <div className="space-y-1.5">
              <Label>Cible du QR Code</Label>
              <Select value={config.target} onValueChange={(v) => update("target", v as QrConfig["target"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT_LINK">Lien court ({shortUrl})</SelectItem>
                  <SelectItem value="DESTINATION_URL">URL longue avec UTM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs defaultValue="colors">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="colors">Couleurs</TabsTrigger>
              <TabsTrigger value="shapes">Formes</TabsTrigger>
              <TabsTrigger value="logo">Logo</TabsTrigger>
              <TabsTrigger value="advanced">Avancé</TabsTrigger>
            </TabsList>

            <TabsContent value="colors" className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.gradient.enabled}
                  onCheckedChange={(checked) => updateGradient("enabled", checked)}
                />
                <Label className="font-normal">Activer un dégradé sur les modules</Label>
              </div>

              {config.gradient.enabled ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                      label="Couleur de départ"
                      value={config.gradient.colorStart}
                      onChange={(v) => updateGradient("colorStart", v)}
                    />
                    <ColorInput
                      label="Couleur de fin"
                      value={config.gradient.colorEnd}
                      onChange={(v) => updateGradient("colorEnd", v)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select
                        value={config.gradient.type}
                        onValueChange={(v) => updateGradient("type", v as "linear" | "radial")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linéaire</SelectItem>
                          <SelectItem value="radial">Radial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Rotation ({config.gradient.rotation}°)
                      </Label>
                      <Slider
                        min={0}
                        max={360}
                        step={5}
                        value={[config.gradient.rotation]}
                        onValueChange={([v]) => updateGradient("rotation", v ?? 0)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <ColorInput label="Couleur des modules" value={config.dotsColor} onChange={(v) => update("dotsColor", v)} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Couleur de fond" value={config.backgroundColor} onChange={(v) => update("backgroundColor", v)} />
                <ColorInput label="Couleur des yeux (coins)" value={config.cornersSquareColor} onChange={(v) => update("cornersSquareColor", v)} />
              </div>
              <ColorInput label="Couleur des points des yeux" value={config.cornersDotColor} onChange={(v) => update("cornersDotColor", v)} />
            </TabsContent>

            <TabsContent value="shapes" className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Style des modules</Label>
                <Select value={config.dotStyle} onValueChange={(v) => update("dotStyle", v as QrConfig["dotStyle"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOT_STYLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Style des coins</Label>
                  <Select
                    value={config.cornerSquareStyle}
                    onValueChange={(v) => update("cornerSquareStyle", v as QrConfig["cornerSquareStyle"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Carré</SelectItem>
                      <SelectItem value="dot">Rond</SelectItem>
                      <SelectItem value="extra-rounded">Très arrondi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Points des coins</Label>
                  <Select
                    value={config.cornerDotStyle}
                    onValueChange={(v) => update("cornerDotStyle", v as QrConfig["cornerDotStyle"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Carré</SelectItem>
                      <SelectItem value="dot">Rond</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logo" className="space-y-4">
              {config.logoDataUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={config.logoDataUrl} alt="Logo" className="h-14 w-14 rounded border object-contain p-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => update("logoDataUrl", null)}>
                    <X /> Retirer le logo
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-accent">
                  <ImageUp className="h-4 w-4" /> Importer un logo (PNG/SVG)
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              )}

              {config.logoDataUrl && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Taille du logo ({Math.round(config.logoSize * 100)}%)
                    </Label>
                    <Slider
                      min={10}
                      max={60}
                      value={[Math.round(config.logoSize * 100)]}
                      onValueChange={([v]) => update("logoSize", (v ?? 35) / 100)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Marge autour du logo ({config.logoMargin}px)</Label>
                    <Slider
                      min={0}
                      max={40}
                      value={[config.logoMargin]}
                      onValueChange={([v]) => update("logoMargin", v ?? 8)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Correction d&apos;erreur — augmentez si un logo masque une partie du code
                </Label>
                <Select
                  value={config.errorCorrectionLevel}
                  onValueChange={(v) => update("errorCorrectionLevel", v as QrConfig["errorCorrectionLevel"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L — Faible (~7%)</SelectItem>
                    <SelectItem value="M">M — Moyenne (~15%)</SelectItem>
                    <SelectItem value="Q">Q — Quartile (~25%)</SelectItem>
                    <SelectItem value="H">H — Haute (~30%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Taille ({config.size}px)</Label>
                  <Slider
                    min={128}
                    max={1024}
                    step={16}
                    value={[config.size]}
                    onValueChange={([v]) => update("size", v ?? 400)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Marge extérieure ({config.margin}px)</Label>
                  <Slider min={0} max={64} value={[config.margin]} onValueChange={([v]) => update("margin", v ?? 16)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {link && (
            <p className="text-xs text-muted-foreground">
              {saveState === "saving" && "Sauvegarde en cours..."}
              {saveState === "saved" && "Configuration sauvegardée ✓"}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle className="text-base">Aperçu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div ref={containerRef} className="flex items-center justify-center rounded-lg border bg-white p-4" />
            <div className="grid w-full grid-cols-3 gap-2">
              <Button type="button" variant="outline" onClick={downloadPng}>
                <Download /> PNG
              </Button>
              <Button type="button" variant="outline" onClick={downloadSvg}>
                <Download /> SVG
              </Button>
              <Button type="button" variant="outline" onClick={downloadPdf}>
                <Download /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
