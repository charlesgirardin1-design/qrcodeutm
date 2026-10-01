"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import { isBrowserDisplayableImage } from "@/lib/media/formats";
import type { CategoryDTO } from "@/lib/catalog";
import type { MediaDTO } from "./types";

const DATE_SOURCE: Record<string, string> = {
  EXIF: "EXIF",
  VIDEO_METADATA: "métadonnées vidéo",
  FILE_DATE: "date du fichier",
  MANUAL: "saisie manuelle",
};

function toInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Viewer({ media }: { media: MediaDTO }) {
  const [source, setSource] = useState<"preview" | "original" | "none">("preview");

  useEffect(() => {
    if (media.mediaType === "PHOTO") {
      setSource(media.previewUrl ? "preview" : isBrowserDisplayableImage(media.mimeType) ? "original" : "none");
    }
  }, [media]);

  if (media.mediaType === "VIDEO") {
    return (
      <video
        key={media.id}
        controls
        playsInline
        preload="metadata"
        poster={media.previewUrl ?? undefined}
        className="max-h-full max-w-full bg-black"
        src={media.originalUrl}
      >
        <p className="p-6 text-center text-sm text-white/80">
          Ce format vidéo ne peut pas être lu dans le navigateur. Téléchargez l&apos;original pour le visionner.
        </p>
      </video>
    );
  }

  const url = source === "preview" ? media.previewUrl : source === "original" ? media.originalUrl : null;
  if (!url) {
    return (
      <div className="flex flex-col items-center gap-3 text-center text-white/70">
        <ImageIcon className="h-12 w-12" />
        <p className="max-w-xs text-sm">
          Aperçu indisponible pour ce format ({media.extension.toUpperCase()}). L&apos;original est intact et téléchargeable.
        </p>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={url}
      src={url}
      alt={media.originalFilename}
      className="max-h-full max-w-full object-contain"
      onError={() => setSource((s) => (s === "preview" && isBrowserDisplayableImage(media.mimeType) ? "original" : "none"))}
    />
  );
}

export function MediaDetail({
  media,
  categories,
  onClose,
  onPrev,
  onNext,
  onUpdated,
  onDeleted,
}: {
  media: MediaDTO | null;
  categories: CategoryDTO[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onUpdated: (media: MediaDTO) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ photographer: "", captureDate: "", categoryId: "", activityId: "" });

  useEffect(() => {
    setEditing(false);
    if (media) {
      setForm({
        photographer: media.photographer,
        captureDate: toInputValue(media.captureDate),
        categoryId: media.categoryId ?? "",
        activityId: media.activityId ?? "",
      });
    }
  }, [media]);

  // Navigation clavier ← →
  useEffect(() => {
    if (!media || editing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [media, editing, onPrev, onNext]);

  if (!media) return null;

  async function patch(body: Record<string, unknown>, success: string) {
    if (!media) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "La modification a échoué.");
      onUpdated(data.media);
      toast(success);
      setEditing(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "La modification a échoué.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!media) return;
    try {
      const res = await fetch(`/api/media/${media.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(data.error ?? "Impossible de supprimer ce média. Veuillez réessayer.");
      setConfirmDelete(false);
      onDeleted(media.id);
      toast("Le média a été supprimé définitivement.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Impossible de supprimer ce média. Veuillez réessayer.", "error");
    }
  }

  const editActivities = categories.find((c) => c.id === form.categoryId)?.activities.filter((a) => a.active || a.id === media.activityId) ?? [];
  const duration = formatDuration(media.durationSec);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-white focus:outline-none lg:inset-6 lg:flex-row lg:overflow-hidden lg:rounded-2xl"
          aria-describedby={undefined}
        >
          {/* Média en grand */}
          <div className="relative flex min-h-[45dvh] flex-1 items-center justify-center bg-neutral-950 p-2 lg:min-h-0">
            <Viewer media={media} />
            {onPrev && (
              <button
                onClick={onPrev}
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
                aria-label="Média précédent"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
                aria-label="Média suivant"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
            <DialogPrimitive.Close
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 lg:hidden"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Informations et actions */}
          <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t lg:w-[380px] lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div className="min-w-0">
                <DialogPrimitive.Title className="break-all text-base font-semibold leading-snug">{media.originalFilename}</DialogPrimitive.Title>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={media.status} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {media.mediaType === "VIDEO" ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {media.mediaType === "VIDEO" ? "Vidéo" : "Photo"} · {media.extension.toUpperCase()} · {formatBytes(media.fileSize)}
                  </span>
                </div>
              </div>
              <DialogPrimitive.Close className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:block" aria-label="Fermer">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            {editing ? (
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const date = new Date(form.captureDate);
                  if (Number.isNaN(date.getTime())) return toast("Date invalide.", "error");
                  if (!form.activityId) return toast("Veuillez choisir une activité.", "error");
                  patch(
                    {
                      photographer: form.photographer,
                      captureDate: date.toISOString(),
                      categoryId: form.categoryId,
                      activityId: form.activityId,
                    },
                    "Informations mises à jour.",
                  );
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="edit-photographer">Photographe</Label>
                  <Input id="edit-photographer" value={form.photographer} onChange={(e) => setForm({ ...form, photographer: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-date">Date de prise de vue</Label>
                  <Input id="edit-date" type="datetime-local" value={form.captureDate} onChange={(e) => setForm({ ...form, captureDate: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v, activityId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.active || c.id === media.categoryId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Activité</Label>
                  <Select value={form.activityId} onValueChange={(v) => setForm({ ...form, activityId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Activité" />
                    </SelectTrigger>
                    <SelectContent>
                      {editActivities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={busy}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="success" className="flex-1" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />} Enregistrer
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 p-5 text-sm">
                <dt className="text-muted-foreground">Prise de vue</dt>
                <dd>
                  {formatDate(media.captureDate, true)}
                  <span className="block text-xs text-muted-foreground">source : {DATE_SOURCE[media.captureDateSource] ?? "—"}</span>
                </dd>
                <dt className="text-muted-foreground">Photographe</dt>
                <dd>{media.photographer}</dd>
                <dt className="text-muted-foreground">Catégorie</dt>
                <dd>{media.categoryName}</dd>
                <dt className="text-muted-foreground">Activité</dt>
                <dd>{media.activityName}</dd>
                {media.width && media.height && (
                  <>
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd>
                      {media.width} × {media.height} px{duration && ` · ${duration}`}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Importé le</dt>
                <dd>
                  {formatDate(media.uploadedAt, true)}
                  {media.uploadedByName && <span className="block text-xs text-muted-foreground">par {media.uploadedByName}</span>}
                </dd>
                {media.status === "SORTED" && media.sortedAt && (
                  <>
                    <dt className="text-muted-foreground">Trié le</dt>
                    <dd>
                      {formatDate(media.sortedAt, true)}
                      {media.sortedByName && <span className="block text-xs text-muted-foreground">par {media.sortedByName}</span>}
                    </dd>
                  </>
                )}
              </dl>
            )}

            {!editing && (
              <div className="mt-auto space-y-2 border-t p-5">
                <Button asChild className="w-full" size="lg" variant="outline">
                  <a href={media.downloadUrl} download={media.originalFilename}>
                    <Download /> Télécharger l&apos;original
                  </a>
                </Button>
                {media.status === "TO_SORT" ? (
                  <Button className="w-full" size="lg" variant="success" disabled={busy} onClick={() => patch({ status: "SORTED" }, "Média marqué comme trié.")}>
                    {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Marquer comme triée
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" variant="outline" disabled={busy} onClick={() => patch({ status: "TO_SORT" }, "Média remis « À trier ».")}>
                    {busy ? <Loader2 className="animate-spin" /> : <CircleDashed />} Remettre « À trier »
                  </Button>
                )}
                <Button className="w-full" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil /> Modifier les informations
                </Button>
                <div className="pt-3">
                  <Button className="w-full" variant="destructive-outline" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Supprimer
                  </Button>
                </div>
              </div>
            )}
          </aside>

          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Supprimer définitivement ce média ?"
            description={
              <>
                <p>Cette action est irréversible. Le fichier original et ses données associées seront supprimés.</p>
                <p className="break-all font-medium text-foreground">{media.originalFilename}</p>
              </>
            }
            confirmLabel="Supprimer définitivement"
            onConfirm={handleDelete}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
