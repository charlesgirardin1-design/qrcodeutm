"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked || indeterminate ? "border-foreground bg-foreground text-white" : "border-gray-300 bg-white/90",
        className,
      )}
    >
      {indeterminate ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </button>
  );
}
