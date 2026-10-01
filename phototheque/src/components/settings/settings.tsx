"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HardDrive, Loader2, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

function Card({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Settings({
  name,
  storage,
  maxUploadMb,
  timezone,
  passwordMode,
}: {
  name: string;
  storage: string;
  maxUploadMb: number;
  timezone: string;
  passwordMode: "hash" | "plain";
}) {
  const toast = useToast();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState<{ stalePending: number; deleting: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  async function loadMaintenance() {
    const res = await fetch("/api/maintenance");
    if (res.ok) setMaintenance(await res.json());
  }
  useEffect(() => {
    loadMaintenance();
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configuration de la session et maintenance de la photothèque.</p>
      </div>

      <Card icon={UserRound} title="Nom affiché">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const res = await fetch("/api/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: displayName }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              toast("Nom affiché mis à jour.");
              router.refresh();
            } catch (error) {
              toast(error instanceof Error && error.message ? error.message : "Mise à jour impossible.", "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="display-name">Votre nom (enregistré dans l&apos;historique du tri)</Label>
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Enregistrer
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Le compte administrateur étant partagé, indiquez votre prénom pour que « trié par » identifie la bonne personne.
        </p>
      </Card>

      <Card icon={HardDrive} title="Stockage">
        <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Stockage</dt>
          <dd>{storage === "s3" ? "Stockage objet S3" : "Disque local du serveur"}</dd>
          <dt className="text-muted-foreground">Taille max. par fichier</dt>
          <dd>{maxUploadMb.toLocaleString("fr-FR")} Mo</dd>
          <dt className="text-muted-foreground">Fuseau horaire</dt>
          <dd>{timezone}</dd>
          <dt className="text-muted-foreground">Originaux</dt>
          <dd>Conservés à l&apos;identique (format, résolution, qualité, extension)</dd>
        </dl>
      </Card>

      <Card icon={Sparkles} title="Maintenance">
        {maintenance === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{maintenance.stalePending}</strong> importation(s) interrompue(s) depuis plus de 24 h ·{" "}
              <strong>{maintenance.deleting}</strong> suppression(s) inachevée(s)
            </p>
            <Button
              variant="outline"
              disabled={cleaning || maintenance.stalePending + maintenance.deleting === 0}
              onClick={async () => {
                setCleaning(true);
                try {
                  const res = await fetch("/api/maintenance", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  toast(`${data.cleaned} élément(s) nettoyé(s)${data.failed ? `, ${data.failed} en échec` : ""}.`, data.failed ? "error" : "success");
                  await loadMaintenance();
                } catch {
                  toast("Le nettoyage a échoué. Veuillez réessayer.", "error");
                } finally {
                  setCleaning(false);
                }
              }}
            >
              {cleaning && <Loader2 className="animate-spin" />} Nettoyer
            </Button>
          </div>
        )}
      </Card>

      <Card icon={ShieldCheck} title="Sécurité">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Les mots de passe sont définis dans les variables d&apos;environnement du serveur ({passwordMode === "hash" ? "empreintes bcrypt" : "secrets serveur"}) et ne sont jamais transmis au navigateur.</li>
          <li>Modifier un mot de passe déconnecte automatiquement toutes les sessions correspondantes.</li>
          <li>Toutes les actions d&apos;administration sont vérifiées côté serveur ; les photos ne sont jamais accessibles publiquement.</li>
          <li>Après 8 échecs de connexion en 15 minutes, l&apos;adresse IP est temporairement bloquée.</li>
        </ul>
      </Card>
    </div>
  );
}
