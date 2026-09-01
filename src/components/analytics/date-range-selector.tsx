"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/types";

const OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "all", label: "Tout" },
];

interface DateRangeSelectorProps {
  value: DateRangePreset;
  onChange: (value: DateRangePreset) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "h-7 px-3 text-xs",
            value === option.value && "bg-background shadow-sm hover:bg-background",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
