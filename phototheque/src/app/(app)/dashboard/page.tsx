import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarRange, CheckCircle2, CircleDashed, Film, ImageIcon, Images, Upload } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCategoryBreakdown, getDashboardStats } from "@/lib/stats";
import { serializeMedia } from "@/lib/media/serialize";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatBytes, formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Tableau de bord — Photothèque" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  UPLOAD: "a importé",
  SORT: "a marqué comme trié(s)",
  UNSORT: "a remis « À trier »",
  DELETE: "a supprimé définitivement",
  UPDATE: "a modifié",
  CATEGORY_CREATE: "a créé la catégorie",
  CATEGORY_UPDATE: "a modifié la catégorie",
  CATEGORY_DISABLE: "a désactivé la catégorie",
  CATEGORY_ENABLE: "a réactivé la catégorie",
  CATEGORY_DELETE: "a supprimé la catégorie",
  ACTIVITY_CREATE: "a créé l'activité",
  ACTIVITY_UPDATE: "a modifié l'activité",
  ACTIVITY_DISABLE: "a désactivé l'activité",
  ACTIVITY_ENABLE: "a réactivé l'activité",
  ACTIVITY_DELETE: "a supprimé l'activité",
  MAINTENANCE: "a lancé un nettoyage",
};

const COUNTED = new Set(["UPLOAD", "SORT", "UNSORT", "DELETE"]);

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "red" | "green";
  href?: string;
}) {
  const content = (
    <div className={cn("flex h-full flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-shadow", href && "hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug text-muted-foreground">{label}</p>
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "red" ? "text-primary" : tone === "green" ? "text-success" : "text-muted-foreground")} />
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", tone === "red" && value > 0 && "text-primary", tone === "green" && "text-success")}>
        {formatNumber(value)}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function DashboardPage() {
  const session = await requirePagePermission("dashboard:view");

  const [stats, recent, toSort, events, breakdown] = await Promise.all([
    getDashboardStats(),
    prisma.media.findMany({ where: { uploadState: "READY" }, orderBy: [{ uploadedAt: "desc" }, { id: "desc" }], take: 12 }),
    prisma.media.findMany({ where: { uploadState: "READY", status: "TO_SORT" }, orderBy: [{ uploadedAt: "asc" }, { id: "asc" }], take: 6 }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    getCategoryBreakdown(),
  ]);

  const recentDto = recent.map(serializeMedia);
  const toSortDto = toSort.map(serializeMedia);
  const maxCategory = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bonjour {session.name} · {formatBytes(stats.totalBytes)} d&apos;originaux conservés
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload /> Importer
            </Link>
          </Button>
          {stats.toSort > 0 ? (
            <Button asChild>
              <Link href="/phototheque?status=TO_SORT&sort=upload_asc">
                {formatNumber(stats.toSort)} média{stats.toSort > 1 ? "s" : ""} à trier <ArrowRight />
              </Link>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Tout est trié
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total des médias" value={stats.total} icon={Images} href="/phototheque" />
        <StatCard label="À trier" value={stats.toSort} icon={CircleDashed} tone="red" href="/phototheque?status=TO_SORT" />
        <StatCard label="Triés" value={stats.sorted} icon={CheckCircle2} tone="green" href="/phototheque?status=SORTED" />
        <StatCard label="Photos" value={stats.photos} icon={ImageIcon} href="/phototheque?type=PHOTO" />
        <StatCard label="Vidéos" value={stats.videos} icon={Film} href="/phototheque?type=VIDEO" />
        <StatCard label="Importés cette semaine" value={stats.thisWeek} icon={CalendarDays} href="/phototheque?sort=upload_desc" />
        <StatCard label="Importés ce mois" value={stats.thisMonth} icon={CalendarRange} href="/phototheque?sort=upload_desc" />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Derniers médias importés</h2>
            <Link href="/phototheque?sort=upload_desc" className="text-sm text-muted-foreground hover:text-foreground">
              Tout voir →
            </Link>
          </div>
          {recentDto.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
              Aucun média pour le moment. <Link href="/import" className="font-medium text-foreground underline">Importer des médias</Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {recentDto.map((m) => (
                <Link key={m.id} href={`/phototheque?q=${encodeURIComponent(m.originalFilename)}`} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnailUrl} alt={m.originalFilename} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">{m.extension}</div>
                  )}
                  {m.mediaType === "VIDEO" && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">VIDÉO</span>}
                  <span className={cn("absolute right-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white", m.status === "SORTED" ? "bg-success" : "bg-primary")} />
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <h2 className="font-semibold">Médias nécessitant une action</h2>
            {stats.toSort > 0 && (
              <Link href="/phototheque?status=TO_SORT&sort=upload_asc" className="text-sm text-muted-foreground hover:text-foreground">
                Trier →
              </Link>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            {toSortDto.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Aucun média en attente de tri.</p>
            ) : (
              <ul className="divide-y">
                {toSortDto.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 p-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {m.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.originalFilename}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.categoryName} · {m.activityName} · importé le {formatDate(m.uploadedAt)}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-semibold">Activité de la photothèque</h2>
            <div className="rounded-xl border bg-white">
              {events.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
              ) : (
                <ul className="divide-y">
                  {events.map((e) => (
                    <li key={e.id} className="p-3 text-sm">
                      <p>
                        <span className="font-medium">{e.actorName}</span> {ACTION_LABELS[e.action] ?? e.action.toLowerCase()}
                        {COUNTED.has(e.action) && <strong> {formatNumber(e.count)} média{e.count > 1 ? "s" : ""}</strong>}
                        {e.details && !COUNTED.has(e.action) && <span> « {e.details} »</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.createdAt, true)}
                        {COUNTED.has(e.action) && e.details && ` · ${e.details}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Répartition par catégorie</h2>
            <div className="space-y-3 rounded-xl border bg-white p-4">
              {breakdown.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">—</p>
              ) : (
                breakdown.map((b) => (
                  <Link key={b.id ?? "none"} href={b.id ? `/phototheque?category=${b.id}` : "/phototheque"} className="block">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{b.name}</span>
                      <span className="tabular-nums text-muted-foreground">{formatNumber(b.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gray-700" style={{ width: `${(b.count / maxCategory) * 100}%` }} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
