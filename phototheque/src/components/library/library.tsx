"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDashed, Download, ImageOff, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { formatNumber, pluralize } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/catalog";
import { FiltersBar } from "./filters-bar";
import { MediaCard } from "./media-card";
import { MediaDetail } from "./media-detail";
import { filtersToParams, paramsToFilters, type LibraryFilters, type MediaDTO } from "./types";

const PAGE_SIZE = 60;

/** Télécharge les originaux sélectionnés dans une archive ZIP (formulaire POST → téléchargement natif en flux). */
function downloadZip(ids: string[]) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/media/download";
  form.style.display = "none";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "ids";
  input.value = ids.join(",");
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function Library({ categories }: { categories: CategoryDTO[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const filters = useMemo(() => paramsToFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const query = useMemo(() => filtersToParams(filters).toString(), [filters]);

  const [items, setItems] = useState<MediaDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<null | "status" | "delete" | "select">(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const lastToggled = useRef<string | null>(null);
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const setFilters = useCallback(
    (next: LibraryFilters) => {
      const qs = filtersToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const load = useCallback(
    async (reset: boolean) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(query);
      params.set("limit", String(PAGE_SIZE));
      // Curseur = dernier média encore affiché (robuste aux suppressions).
      const last = itemsRef.current[itemsRef.current.length - 1];
      if (!reset && last) params.set("cursor", last.id);
      try {
        const res = await fetch(`/api/media?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Chargement impossible.");
        if (id !== requestId.current) return;
        setItems((prev) => {
          if (reset) return data.items;
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...data.items.filter((m: MediaDTO) => !seen.has(m.id))];
        });
        if (data.total !== null) setTotal(data.total);
        setHasMore(Boolean(data.nextCursor));
      } catch (e) {
        if (id === requestId.current) setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [query],
  );

  // Rechargement complet à chaque changement de filtres
  useEffect(() => {
    setItems([]);
    setTotal(null);
    setSelected(new Set());
    load(true);
  }, [load]);

  // Défilement infini
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) load(false);
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, load]);

  const toggle = useCallback((id: string, range: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const list = itemsRef.current;
      if (range && lastToggled.current) {
        const a = list.findIndex((m) => m.id === lastToggled.current);
        const b = list.findIndex((m) => m.id === id);
        if (a >= 0 && b >= 0) {
          for (const m of list.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(m.id);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastToggled.current = id;
      return next;
    });
  }, []);

  async function selectAll() {
    setBulkBusy("select");
    try {
      const res = await fetch(`/api/media/ids?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected(new Set(data.ids));
    } catch {
      setSelected(new Set(items.map((m) => m.id)));
    } finally {
      setBulkBusy(null);
    }
  }

  function removeLocally(ids: string[]) {
    const gone = new Set(ids);
    setItems((prev) => prev.filter((m) => !gone.has(m.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    setTotal((t) => (t === null ? t : Math.max(0, t - ids.length)));
  }

  async function bulkStatus(status: "SORTED" | "TO_SORT") {
    const ids = [...selected];
    setBulkBusy("status");
    try {
      const res = await fetch("/api/media/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-status", status, ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "La mise à jour a échoué.");
      toast(`${pluralize(data.updated, "média")} ${status === "SORTED" ? "marqué(s) comme trié(s)" : "remis « À trier »"}.`);
      // Les listes se mettent à jour : si le filtre de statut exclut désormais ces médias, on les retire.
      if (filters.status && filters.status !== status) {
        removeLocally(ids);
      } else {
        const set = new Set(ids);
        setItems((prev) => prev.map((m) => (set.has(m.id) ? { ...m, status, sortedAt: status === "SORTED" ? (m.sortedAt ?? new Date().toISOString()) : null } : m)));
        setSelected(new Set());
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "La mise à jour a échoué.", "error");
    } finally {
      setBulkBusy(null);
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    setBulkBusy("delete");
    try {
      const res = await fetch("/api/media/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const data = await res.json();
      if (!res.ok && !data.deleted) throw new Error(data.error ?? "Impossible de supprimer ces médias. Veuillez réessayer.");
      removeLocally(data.deleted);
      setConfirmBulkDelete(false);
      if (data.failed.length) {
        toast(
          `${pluralize(data.deleted.length, "média")} supprimé(s). ${data.failed.length} n'ont pas pu être supprimés : ${data.failed[0].error}`,
          "error",
        );
        setSelected(new Set(data.failed.map((f: { id: string }) => f.id)));
      } else {
        toast(`${pluralize(data.deleted.length, "média")} supprimé(s) définitivement.`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impossible de supprimer ces médias. Veuillez réessayer.", "error");
    } finally {
      setBulkBusy(null);
    }
  }

  const openIndex = openId ? items.findIndex((m) => m.id === openId) : -1;
  const openMedia = openIndex >= 0 ? items[openIndex]! : null;
  const selectionMode = selected.size > 0;
  const allLoadedSelected = items.length > 0 && items.every((m) => selected.has(m.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Photothèque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === null ? "Chargement…" : total === 0 ? "Aucun média" : `${pluralize(total, "média")}`}
          </p>
        </div>
      </div>

      <FiltersBar filters={filters} onChange={setFilters} categories={categories} />

      {/* Barre de sélection */}
      <div className="flex min-h-9 flex-wrap items-center gap-3 text-sm">
        <Checkbox
          checked={allLoadedSelected}
          indeterminate={selectionMode && !allLoadedSelected}
          onChange={(checked) => (checked ? selectAll() : setSelected(new Set()))}
          label="Tout sélectionner"
        />
        <button className="font-medium hover:underline disabled:opacity-50" onClick={selectAll} disabled={!total || bulkBusy === "select"}>
          {bulkBusy === "select" ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Tout sélectionner"}
          {total ? ` (${formatNumber(total)})` : ""}
        </button>
        {selectionMode && (
          <>
            <span className="text-muted-foreground">·</span>
            <button className="font-medium hover:underline" onClick={() => setSelected(new Set())}>
              Tout désélectionner
            </button>
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-white">
              {pluralize(selected.size, "média sélectionné", "médias sélectionnés")}
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <Button size="sm" variant="outline" onClick={() => load(items.length === 0)}>
            Réessayer
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-20 text-center">
          <ImageOff className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aucun média ne correspond à ces critères</p>
          <p className="mt-1 text-sm text-muted-foreground">Modifiez la recherche ou les filtres.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((media) => (
          <MediaCard
            key={media.id}
            media={media}
            selected={selected.has(media.id)}
            selectionMode={selectionMode}
            onToggle={toggle}
            onOpen={setOpenId}
          />
        ))}
        {loading &&
          Array.from({ length: items.length ? 6 : 12 }, (_, i) => (
            <div key={`s${i}`} className="overflow-hidden rounded-xl border bg-white">
              <div className="aspect-square animate-pulse bg-gray-100" />
              <div className="space-y-2 p-2.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
      </div>
      <div ref={sentinel} className="h-1" />

      {/* Actions groupées */}
      {selectionMode && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-3 lg:bottom-6 lg:left-64 lg:px-8">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5 shadow-xl">
            <span className="px-2 text-sm font-semibold">{pluralize(selected.size, "média sélectionné", "médias sélectionnés")}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadZip([...selected])} disabled={selected.size > 2000}>
                <Download /> <span className="hidden sm:inline">Télécharger la sélection</span>
                <span className="sm:hidden">ZIP</span>
              </Button>
              <Button size="sm" variant="success" onClick={() => bulkStatus("SORTED")} disabled={bulkBusy !== null}>
                {bulkBusy === "status" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                <span className="hidden sm:inline">Marquer comme triées</span>
                <span className="sm:hidden">Triées</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus("TO_SORT")} disabled={bulkBusy !== null}>
                <CircleDashed /> <span className="hidden sm:inline">Marquer comme à trier</span>
                <span className="sm:hidden">À trier</span>
              </Button>
              <Button size="sm" variant="destructive-outline" onClick={() => setConfirmBulkDelete(true)} disabled={bulkBusy !== null}>
                <Trash2 /> <span className="hidden sm:inline">Supprimer la sélection</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Désélectionner">
                <X /> <span className="hidden md:inline">Désélectionner</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`Supprimer définitivement ${pluralize(selected.size, "média")} ?`}
        description={<p>Cette action est irréversible. Les fichiers originaux et leurs données associées seront supprimés.</p>}
        confirmLabel="Supprimer définitivement"
        onConfirm={bulkDelete}
      />

      {openMedia && (
        <MediaDetail
          media={openMedia}
          categories={categories}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(items[openIndex - 1]!.id) : undefined}
          onNext={
            openIndex < items.length - 1
              ? () => {
                  setOpenId(items[openIndex + 1]!.id);
                  if (openIndex + 5 >= items.length && hasMore && !loading) load(false);
                }
              : undefined
          }
          onUpdated={(media) => {
            if (filters.status && media.status !== filters.status) {
              // Le média sort de la liste filtrée : on passe directement au suivant.
              const next = items[openIndex + 1] ?? items[openIndex - 1];
              removeLocally([media.id]);
              setOpenId(next ? next.id : null);
            } else {
              setItems((prev) => prev.map((m) => (m.id === media.id ? media : m)));
            }
          }}
          onDeleted={(id) => {
            const next = items[openIndex + 1] ?? items[openIndex - 1];
            removeLocally([id]);
            setOpenId(next && next.id !== id ? next.id : null);
          }}
        />
      )}
    </div>
  );
}

