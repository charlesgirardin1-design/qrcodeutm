import { cn } from "@/lib/utils";

/**
 * Emblème croix rouge. Pour utiliser le logo officiel de la Croix-Rouge
 * française, déposez le fichier fourni par la communication nationale dans
 * /public et remplacez ce composant par une balise <Image>.
 */
export function CrossMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8", className)}>
      <path fill="#E3000F" d="M11 2h10v9h9v10h-9v9H11v-9H2V11h9z" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <CrossMark className="h-7 w-7 shrink-0" />
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Photothèque</p>
          <p className="text-[11px] text-muted-foreground">Croix-Rouge · Boulogne-Billancourt</p>
        </div>
      )}
    </div>
  );
}
