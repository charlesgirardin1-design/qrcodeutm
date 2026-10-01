"use client";

import { memo, useState } from "react";
import { Film, ImageIcon, Play } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import type { MediaDTO } from "./types";

/** Vignette de la grille : uniquement la MINIATURE (jamais l'original), chargée paresseusement. */
export const MediaCard = memo(function MediaCard({
  media,
  selected,
  selectionMode,
  onToggle,
  onOpen,
}: {
  media: MediaDTO;
  selected: boolean;
  selectionMode: boolean;
  onToggle: (id: string, range: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const isVideo = media.mediaType === "VIDEO";
  const duration = formatDuration(media.durationSec);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
        selected && "ring-2 ring-foreground ring-offset-2",
      )}
    >
      <button
        type="button"
        onClick={(e) => (selectionMode || e.metaKey || e.ctrlKey || e.shiftKey ? onToggle(media.id, e.shiftKey) : onOpen(media.id))}
        className="relative block aspect-square w-full overflow-hidden bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Ouvrir ${media.originalFilename}`}
      >
        {media.thumbnailUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumbnailUrl}
            alt={media.originalFilename}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isVideo ? <Film className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
            <span className="text-xs font-semibold uppercase">{media.extension}</span>
          </div>
        )}
        {isVideo && (
          <>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </span>
            <Badge variant="dark" className="absolute bottom-2 left-2">
              Vidéo{duration && ` · ${duration}`}
            </Badge>
          </>
        )}
        <StatusBadge status={media.status} className="absolute right-2 top-2 bg-white/95 shadow-sm" />
      </button>

      <div
        className={cn(
          "absolute left-2 top-2 transition-opacity",
          selectionMode || selected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onChange={() => onToggle(media.id, false)}
          label={`Sélectionner ${media.originalFilename}`}
          className="shadow-sm"
        />
      </div>

      <div className="space-y-0.5 p-2.5">
        <p className="truncate text-[13px] font-medium" title={media.originalFilename}>
          {media.originalFilename}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={`${media.categoryName} · ${media.activityName}`}>
          {media.categoryName} · {media.activityName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(media.captureDate)} · {media.photographer}
        </p>
      </div>
    </article>
  );
});
