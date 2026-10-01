"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/catalog";
import { activeFilterCount, EMPTY_FILTERS, type LibraryFilters } from "./types";

const ALL = "__all__";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-gray-50 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
            value === option.value && "bg-white text-foreground shadow-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const SORTS = [
  { value: "capture_desc", label: "Prise de vue : récentes" },
  { value: "capture_asc", label: "Prise de vue : anciennes" },
  { value: "upload_desc", label: "Importation : récentes" },
  { value: "upload_asc", label: "Importation : anciennes" },
  { value: "name_asc", label: "Nom : A → Z" },
  { value: "name_desc", label: "Nom : Z → A" },
];

export function FiltersBar({
  filters,
  onChange,
  categories,
}: {
  filters: LibraryFilters;
  onChange: (next: LibraryFilters) => void;
  categories: CategoryDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(filters.q);
  const [photographer, setPhotographer] = useState(filters.photographer);

  // Recherche dynamique (anti-rebond 300 ms)
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => onChange({ ...filters, q }), 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (photographer === filters.photographer) return;
    const t = setTimeout(() => onChange({ ...filters, photographer }), 300);
    return () => clearTimeout(t);
  }, [photographer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => setPhotographer(filters.photographer), [filters.photographer]);

  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => onChange({ ...filters, [key]: value });
  const activities = categories.find((c) => c.id === filters.category)?.activities ?? [];
  const count = activeFilterCount(filters);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2009 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un fichier, un photographe, une activité, une catégorie…"
            className="h-10 bg-white pl-9"
            aria-label="Rechercher"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <SlidersHorizontal /> Filtres
            {count > 0 && <span className="ml-1 rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-white">{count}</span>}
          </Button>
          <Select value={filters.sort} onValueChange={(v) => set("sort", v)}>
            <SelectTrigger className="h-10 w-auto min-w-0 flex-1 whitespace-nowrap bg-white sm:w-[230px] sm:flex-none [&>span]:truncate" aria-label="Trier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Statut"
          value={filters.status}
          onChange={(v) => set("status", v)}
          options={[
            { value: "", label: "Tous" },
            { value: "TO_SORT", label: "À trier" },
            { value: "SORTED", label: "Triées" },
          ]}
        />
        <Segmented
          label="Type"
          value={filters.type}
          onChange={(v) => set("type", v)}
          options={[
            { value: "", label: "Tous" },
            { value: "PHOTO", label: "Photos" },
            { value: "VIDEO", label: "Vidéos" },
          ]}
        />
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })}>
            <RotateCcw /> Réinitialiser
          </Button>
        )}
      </div>

      {open && (
        <div className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={filters.category || ALL}
              onValueChange={(v) => onChange({ ...filters, category: v === ALL ? "" : v, activity: "" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {!c.active && " (désactivée)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Activité</Label>
            <Select
              value={filters.activity || ALL}
              onValueChange={(v) => set("activity", v === ALL ? "" : v)}
              disabled={!filters.category}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisissez une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes</SelectItem>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {!a.active && " (désactivée)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-photographer">Photographe</Label>
            <div className="relative">
              <Input
                id="filter-photographer"
                value={photographer}
                onChange={(e) => setPhotographer(e.target.value)}
                placeholder="Nom du photographe"
              />
              {photographer && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setPhotographer("")}
                  aria-label="Effacer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <div className="flex gap-2">
              <Select value={filters.dateMode || ALL} onValueChange={(v) => set("dateMode", (v === ALL ? "" : v) as LibraryFilters["dateMode"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toutes les dates</SelectItem>
                  <SelectItem value="date">Date précise</SelectItem>
                  <SelectItem value="range">Période</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
              {filters.dateMode && (
                <Select value={filters.dateField} onValueChange={(v) => set("dateField", v as "capture" | "upload")}>
                  <SelectTrigger className="w-[130px]" aria-label="Type de date">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capture">Prise de vue</SelectItem>
                    <SelectItem value="upload">Importation</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {filters.dateMode === "date" && (
              <Input type="date" value={filters.date} onChange={(e) => set("date", e.target.value)} aria-label="Date précise" />
            )}
            {filters.dateMode === "range" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} aria-label="Du" />
                <span className="text-xs text-muted-foreground">au</span>
                <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} aria-label="Au" />
              </div>
            )}
            {filters.dateMode === "month" && (
              <Input type="month" value={filters.month} onChange={(e) => set("month", e.target.value)} aria-label="Mois" />
            )}
            {filters.dateMode === "year" && (
              <Select value={filters.year || ALL} onValueChange={(v) => set("year", v === ALL ? "" : v)}>
                <SelectTrigger aria-label="Année">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Choisir…</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
