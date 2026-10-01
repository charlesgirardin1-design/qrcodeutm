import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", {
  variants: {
    variant: {
      neutral: "bg-secondary text-secondary-foreground",
      outline: "border bg-white text-foreground",
      // À TRIER : rouge
      todo: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      // TRIÉE : vert
      done: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      dark: "bg-black/70 text-white backdrop-blur",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status, className }: { status: "TO_SORT" | "SORTED"; className?: string }) {
  return status === "SORTED" ? (
    <Badge variant="done" className={className}>
      Triée
    </Badge>
  ) : (
    <Badge variant="todo" className={className}>
      À trier
    </Badge>
  );
}
