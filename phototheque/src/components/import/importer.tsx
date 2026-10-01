"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Film,
  ImageIcon,
  ImagePlus,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ACCEPT_ATTRIBUTE, detectFormat, type MediaKind } from "@/lib/media/formats";
import { createDerivatives, extractInfo, type Derivatives } from "@/lib/client/media-metadata";
import { uploadMedia } from "@/lib/client/upload";
import { cn, formatBytes } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/catalog";

type ItemState = "analyzing" | "ready" | "uploading" | "done" | "error";
type DateSource = "EXIF" | "VIDEO_METADATA" | "FILE_DATE" | "MANUAL";

interface QueueItem {
  key: string;
  file: File;
  kind: MediaKind;
  state: ItemState;
  progress: number;
  error?: string;
  captureDate?: Date;
  dateSource?: DateSource;
  derivatives?: Derivatives | null;
  previewUrl?: string;
}

interface Rejected {
  key: string;
  name: string;
  reason: string;
}

const CONCURRENCY = 3;
const PHOTOGRAPHER_STORAGE_KEY = "phototheque:photographer";

const DATE_SOURCE_LABEL: Record<DateSource, string> = {
  EXIF: "Date EXIF",
  VIDEO_METADATA: "Date de la vidéo",
  FILE_DATE: "Date du fichier — à vérifier",
  MANUAL: "Date modifiée",
};

function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputValue(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function Importer() {
  const toast = useToast();
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [photographer, setPhotographer] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Catalogue catégories → activités chargé depuis la base de données.
  useEffect(() => {
    fetch("/api/categories")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCategories(data.categories);
      })
      .catch(() => setCatalogError("Impossible de charger les catégories. Rechargez la page."));
    try {
      setPhotographer(localStorage.getItem(PHOTOGRAPHER_STORAGE_KEY) ?? "");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => () => itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []);

  const activities = useMemo(() => categories?.find((c) => c.id === categoryId)?.activities ?? [], [categories, categoryId]);

  const update = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  // Analyse (date + miniature) des fichiers ajoutés, 2 à la fois.
  const analyzeQueue = useRef<QueueItem[]>([]);
  const analyzing = useRef(0);
  const pumpAnalysis = useCallback(() => {
    while (analyzing.current < 2 && analyzeQueue.current.length) {
      const item = analyzeQueue.current.shift()!;
      analyzing.current++;
      (async () => {
        const [info, derivatives] = await Promise.all([
          extractInfo(item.file, item.kind),
          createDerivatives(item.file, item.kind).catch(() => null),
        ]);
        update(item.key, {
          state: "ready",
          captureDate: info.captureDate,
          dateSource: info.captureDateSource,
          derivatives,
          previewUrl: derivatives ? URL.createObjectURL(derivatives.thumbnail) : undefined,
        });
      })().finally(() => {
        analyzing.current--;
        pumpAnalysis();
      });
    }
  }, [update]);

  function addFiles(fileList: FileList | File[]) {
    const accepted: QueueItem[] = [];
    const refused: Rejected[] = [];
    const existing = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}:${i.file.lastModified}`));
    for (const file of Array.from(fileList)) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existing.has(key)) continue;
      existing.add(key);
      const format = detectFormat(file.name, file.type);
      if (!format) {
        refused.push({ key: `${key}:${Math.random()}`, name: file.name, reason: "Ce fichier n'est pas compatible." });
        continue;
      }
      if (file.size === 0) {
        refused.push({ key: `${key}:${Math.random()}`, name: file.name, reason: "Le fichier est vide." });
        continue;
      }
      accepted.push({ key: `${key}:${Math.random().toString(36).slice(2)}`, file, kind: format.kind, state: "analyzing", progress: 0 });
    }
    if (refused.length) setRejected((r) => [...refused, ...r].slice(0, 50));
    if (accepted.length) {
      setItems((list) => [...list.filter((i) => i.state !== "done"), ...accepted]);
      analyzeQueue.current.push(...accepted);
      pumpAnalysis();
    }
  }

  function removeItem(key: string) {
    setItems((list) => {
      const item = list.find((i) => i.key === key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return list.filter((i) => i.key !== key);
    });
    analyzeQueue.current = analyzeQueue.current.filter((i) => i.key !== key);
  }

  function applyBulkDate() {
    const date = fromInputValue(bulkDate);
    if (!date) return;
    setItems((list) =>
      list.map((i) => (i.state === "ready" || i.state === "error" ? { ...i, captureDate: date, dateSource: "MANUAL" } : i)),
    );
  }

  const pending = items.filter((i) => i.state === "ready" || i.state === "error");
  const analyzingCount = items.filter((i) => i.state === "analyzing").length;
  const done = items.filter((i) => i.state === "done").length;
  const failed = items.filter((i) => i.state === "error");
  const batchTotal = items.filter((i) => i.state !== "analyzing").length;
  const overallProgress = batchTotal
    ? items.reduce((sum, i) => sum + (i.state === "done" ? 1 : i.state === "uploading" ? i.progress : 0), 0) / batchTotal
    : 0;

  async function startUpload(onlyFailed = false) {
    setFormError(null);
    if (!photographer.trim()) return setFormError("Veuillez renseigner le nom du photographe.");
    if (!categoryId) return setFormError("Veuillez choisir une catégorie.");
    if (!activityId) return setFormError("Veuillez choisir une activité.");
    const queue = items.filter((i) => (onlyFailed ? i.state === "error" : i.state === "ready" || i.state === "error"));
    if (!queue.length) return;
    if (queue.some((i) => !i.captureDate)) return setFormError("Chaque fichier doit avoir une date de prise de vue.");

    try {
      localStorage.setItem(PHOTOGRAPHER_STORAGE_KEY, photographer.trim());
    } catch {
      /* ignore */
    }

    setRunning(true);
    queue.forEach((i) => update(i.key, { state: "uploading", progress: 0, error: undefined }));
    const work = [...queue];
    let success = 0;
    let errors = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, work.length) }, async () => {
        while (work.length) {
          const item = work.shift()!;
          try {
            await uploadMedia(
              item.file,
              {
                photographer: photographer.trim(),
                categoryId,
                activityId,
                captureDate: item.captureDate!,
                captureDateSource: item.dateSource ?? "MANUAL",
              },
              item.derivatives ?? null,
              (progress) => update(item.key, { progress }),
            );
            success++;
            update(item.key, { state: "done", progress: 1 });
          } catch (error) {
            errors++;
            update(item.key, {
              state: "error",
              progress: 0,
              error: error instanceof Error ? error.message : "L'importation a échoué pour ce fichier.",
            });
          }
        }
      }),
    );
    setRunning(false);
    if (errors === 0) toast(`Importation terminée ✓ — ${success} fichier${success > 1 ? "s" : ""} enregistré${success > 1 ? "s" : ""}.`);
    else toast(`${errors} fichier${errors > 1 ? "s" : ""} en échec. Vous pouvez réessayer.`, "error");
  }

  function clearDone() {
    setItems((list) => {
      list.filter((i) => i.state === "done").forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
      return list.filter((i) => i.state !== "done");
    });
  }

  const finished = !running && batchTotal > 0 && done === batchTotal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importer des médias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos et vidéos sont conservées dans leur format et leur qualité d&apos;origine. Chaque média importé est enregistré « À trier ».
        </p>
      </div>

      {/* Métadonnées communes */}
      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations</h2>
        {catalogError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{catalogError}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="photographer">Photographe *</Label>
            <Input
              id="photographer"
              placeholder="Prénom Nom"
              value={photographer}
              onChange={(e) => setPhotographer(e.target.value)}
              disabled={running}
              autoComplete="name"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie *</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setActivityId("");
              }}
              disabled={running || !categories}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={categories ? "Choisir une catégorie" : "Chargement…"} />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Activité *</Label>
            <Select value={activityId} onValueChange={setActivityId} disabled={running || !categoryId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={categoryId ? "Choisir une activité" : "Choisissez d'abord une catégorie"} />
              </SelectTrigger>
              <SelectContent>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Zone de dépôt */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!running) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-10 text-center transition-colors",
          dragging ? "border-primary bg-red-50/40" : "border-gray-300",
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <ImagePlus className="h-6 w-6 text-gray-600" />
        </div>
        <p className="font-medium">
          <span className="hidden sm:inline">Glissez-déposez vos photos et vidéos ici</span>
          <span className="sm:hidden">Ajoutez vos photos et vidéos</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, HEIC, HEIF, WEBP, RAW… · MP4, MOV, AVI, MKV…</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()} disabled={running}>
          <Upload /> Sélectionner des fichiers
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      {rejected.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">Fichiers refusés</p>
            <button className="text-xs text-red-700 hover:underline" onClick={() => setRejected([])}>
              Masquer
            </button>
          </div>
          <ul className="space-y-1 text-sm text-red-700">
            {rejected.map((r) => (
              <li key={r.key} className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">
                  <strong className="font-medium">{r.name}</strong> — {r.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 && (
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {running ? (
                  <>
                    Importation : {done} / {batchTotal}
                  </>
                ) : finished ? (
                  <span className="text-success">Importation terminée ✓</span>
                ) : (
                  <>
                    {items.length} fichier{items.length > 1 ? "s" : ""} sélectionné{items.length > 1 ? "s" : ""}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(items.reduce((s, i) => s + i.file.size, 0))}
                {analyzingCount > 0 && ` · analyse de ${analyzingCount} fichier(s)…`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!running && pending.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="datetime-local"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="h-9 w-[190px]"
                    aria-label="Date à appliquer à tous les fichiers"
                  />
                  <Button variant="outline" size="sm" className="h-9" onClick={applyBulkDate} disabled={!bulkDate}>
                    <CalendarClock /> Appliquer à tous
                  </Button>
                </div>
              )}
              {finished && (
                <Button variant="outline" onClick={clearDone}>
                  Nouvelle importation
                </Button>
              )}
              {!running && failed.length > 0 && failed.length < pending.length && (
                <Button variant="outline" onClick={() => startUpload(true)}>
                  <RotateCcw /> Réessayer les échecs ({failed.length})
                </Button>
              )}
              {pending.length > 0 && (
                <Button onClick={() => startUpload(false)} disabled={running || analyzingCount > 0 || !categories}>
                  {running ? <Loader2 className="animate-spin" /> : failed.length === pending.length ? <RotateCcw /> : <Upload />}
                  {failed.length === pending.length
                    ? `Réessayer (${failed.length})`
                    : `Importer ${pending.length} fichier${pending.length > 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          </div>

          {(running || done > 0) && (
            <div className="h-1.5 w-full bg-gray-100">
              <div
                className={cn("h-full transition-all", finished ? "bg-success" : "bg-primary")}
                style={{ width: `${Math.round(overallProgress * 100)}%` }}
              />
            </div>
          )}

          {formError && <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.key} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : item.state === "analyzing" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : item.kind === "VIDEO" ? (
                      <Film className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                    {item.kind === "VIDEO" && item.previewUrl && (
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">VIDÉO</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind === "VIDEO" ? "Vidéo" : "Photo"} · {formatBytes(item.file.size)}
                    </p>
                    {item.state === "uploading" && (
                      <div className="mt-1.5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                      </div>
                    )}
                    {item.state === "error" && <p className="mt-1 text-xs font-medium text-destructive">{item.error}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-[76px] sm:pl-0">
                  {item.captureDate && item.state !== "done" && (
                    <div className="flex flex-col">
                      <Input
                        type="datetime-local"
                        value={toInputValue(item.captureDate)}
                        onChange={(e) => {
                          const date = fromInputValue(e.target.value);
                          if (date) update(item.key, { captureDate: date, dateSource: "MANUAL" });
                        }}
                        disabled={item.state === "uploading"}
                        className="h-9 w-[190px]"
                        aria-label={`Date de prise de vue de ${item.file.name}`}
                      />
                      <span
                        className={cn(
                          "mt-0.5 text-[11px]",
                          item.dateSource === "FILE_DATE" ? "text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {DATE_SOURCE_LABEL[item.dateSource ?? "MANUAL"]}
                      </span>
                    </div>
                  )}
                  <div className="flex w-16 justify-end">
                    {item.state === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-label="Importé" />
                    ) : item.state === "uploading" ? (
                      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(item.progress * 100)} %</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.key)}
                        disabled={running}
                        aria-label={`Retirer ${item.file.name} de la sélection`}
                      >
                        {item.state === "error" ? <Trash2 className="text-destructive" /> : <X />}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
