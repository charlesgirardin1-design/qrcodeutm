"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn, formatNumber } from "@/lib/utils";
import type { ActivityDTO, CategoryDTO } from "@/lib/catalog";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "L'opération a échoué.");
  return data;
}

function InlineEdit({ value, onSave, onCancel, placeholder }: { value: string; onSave: (v: string) => Promise<void>; onCancel: () => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-1 items-center gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        try {
          await onSave(text.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="h-8" maxLength={80} />
      <Button type="submit" size="icon" variant="success" className="h-8 w-8" disabled={busy} aria-label="Enregistrer">
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel} aria-label="Annuler">
        <X />
      </Button>
    </form>
  );
}

function IconButton({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className={cn("h-8 w-8", className)} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </Button>
  );
}

type Pending = { kind: "category"; item: CategoryDTO } | { kind: "activity"; item: ActivityDTO; category: CategoryDTO };

export function CatalogManager({ initial }: { initial: CategoryDTO[] }) {
  const toast = useToast();
  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // "category" | categoryId
  const [toDelete, setToDelete] = useState<Pending | null>(null);

  const refresh = useCallback(async () => {
    const data = await call("/api/categories?all=1", "GET");
    setCategories(data.categories);
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await refresh();
      toast(success);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "L'opération a échoué.", "error");
      return false;
    }
  }

  async function moveCategory(index: number, delta: number) {
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved!);
    setCategories(next);
    await run(() => call("/api/categories/reorder", "POST", { ids: next.map((c) => c.id) }), "Ordre mis à jour.");
  }

  async function moveActivity(category: CategoryDTO, index: number, delta: number) {
    const list = [...category.activities];
    const [moved] = list.splice(index, 1);
    list.splice(index + delta, 0, moved!);
    setCategories((cs) => cs.map((c) => (c.id === category.id ? { ...c, activities: list } : c)));
    await run(() => call("/api/activities/reorder", "POST", { ids: list.map((a) => a.id) }), "Ordre mis à jour.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catégories & activités</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Les modifications s&apos;appliquent immédiatement au formulaire d&apos;importation. Les médias existants conservent le nom de catégorie
            et d&apos;activité enregistré lors de leur importation. Un élément utilisé ne peut pas être supprimé : désactivez-le.
          </p>
        </div>
        <Button onClick={() => setAdding("category")}>
          <Plus /> Nouvelle catégorie
        </Button>
      </div>

      {adding === "category" && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <InlineEdit
            value=""
            placeholder="Nom de la nouvelle catégorie"
            onCancel={() => setAdding(null)}
            onSave={async (name) => {
              if (await run(() => call("/api/categories", "POST", { name }), `Catégorie « ${name} » créée.`)) setAdding(null);
            }}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((category, index) => (
          <section key={category.id} className={cn("rounded-xl border bg-white shadow-sm", !category.active && "bg-gray-50")}>
            <header className="flex items-center gap-2 border-b p-3 pl-4">
              {editing === category.id ? (
                <InlineEdit
                  value={category.name}
                  onCancel={() => setEditing(null)}
                  onSave={async (name) => {
                    if (await run(() => call(`/api/categories/${category.id}`, "PATCH", { name }), "Catégorie renommée.")) setEditing(null);
                  }}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <h2 className={cn("truncate font-semibold", !category.active && "text-muted-foreground line-through")}>{category.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(category.mediaCount ?? 0)} média(s){!category.active && " · désactivée"}
                    </p>
                  </div>
                  <IconButton label="Monter" onClick={() => moveCategory(index, -1)} disabled={index === 0}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton label="Descendre" onClick={() => moveCategory(index, 1)} disabled={index === categories.length - 1}>
                    <ArrowDown />
                  </IconButton>
                  <IconButton label="Renommer" onClick={() => setEditing(category.id)}>
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={category.active ? "Désactiver" : "Réactiver"}
                    onClick={() =>
                      run(
                        () => call(`/api/categories/${category.id}`, "PATCH", { active: !category.active }),
                        category.active ? "Catégorie désactivée." : "Catégorie réactivée.",
                      )
                    }
                  >
                    {category.active ? <EyeOff /> : <Eye />}
                  </IconButton>
                  <IconButton
                    label={category.mediaCount ? "Utilisée par des médias : désactivez-la plutôt" : "Supprimer"}
                    onClick={() => setToDelete({ kind: "category", item: category })}
                    disabled={Boolean(category.mediaCount)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </IconButton>
                </>
              )}
            </header>

            <ul className="divide-y">
              {category.activities.map((activity, aIndex) => (
                <li key={activity.id} className="flex items-center gap-2 py-1.5 pl-4 pr-3">
                  {editing === activity.id ? (
                    <InlineEdit
                      value={activity.name}
                      onCancel={() => setEditing(null)}
                      onSave={async (name) => {
                        if (await run(() => call(`/api/activities/${activity.id}`, "PATCH", { name }), "Activité renommée.")) setEditing(null);
                      }}
                    />
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <span className={cn("text-sm", !activity.active && "text-muted-foreground line-through")}>{activity.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatNumber(activity.mediaCount ?? 0)}
                          {!activity.active && " · désactivée"}
                        </span>
                      </div>
                      <IconButton label="Monter" onClick={() => moveActivity(category, aIndex, -1)} disabled={aIndex === 0}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton label="Descendre" onClick={() => moveActivity(category, aIndex, 1)} disabled={aIndex === category.activities.length - 1}>
                        <ArrowDown />
                      </IconButton>
                      <IconButton label="Renommer" onClick={() => setEditing(activity.id)}>
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label={activity.active ? "Désactiver" : "Réactiver"}
                        onClick={() =>
                          run(
                            () => call(`/api/activities/${activity.id}`, "PATCH", { active: !activity.active }),
                            activity.active ? "Activité désactivée." : "Activité réactivée.",
                          )
                        }
                      >
                        {activity.active ? <EyeOff /> : <Eye />}
                      </IconButton>
                      <IconButton
                        label={activity.mediaCount ? "Utilisée par des médias : désactivez-la plutôt" : "Supprimer"}
                        onClick={() => setToDelete({ kind: "activity", item: activity, category })}
                        disabled={Boolean(activity.mediaCount)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </IconButton>
                    </>
                  )}
                </li>
              ))}
              <li className="p-3">
                {adding === category.id ? (
                  <InlineEdit
                    value=""
                    placeholder="Nom de la nouvelle activité"
                    onCancel={() => setAdding(null)}
                    onSave={async (name) => {
                      if (await run(() => call("/api/activities", "POST", { categoryId: category.id, name }), `Activité « ${name} » ajoutée.`)) {
                        setAdding(null);
                      }
                    }}
                  />
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setAdding(category.id)}>
                    <Plus /> Ajouter une activité
                  </Button>
                )}
              </li>
            </ul>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete?.kind === "category" ? `Supprimer la catégorie « ${toDelete.item.name} » ?` : `Supprimer l'activité « ${toDelete?.item.name ?? ""} » ?`}
        description={
          <p>
            {toDelete?.kind === "category"
              ? "La catégorie et ses activités seront supprimées. Aucun média n'y est rattaché."
              : "Aucun média n'utilise cette activité."}
          </p>
        }
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (!toDelete) return;
          const url = toDelete.kind === "category" ? `/api/categories/${toDelete.item.id}` : `/api/activities/${toDelete.item.id}`;
          if (await run(() => call(url, "DELETE"), "Suppression effectuée.")) setToDelete(null);
        }}
      />
    </div>
  );
}
