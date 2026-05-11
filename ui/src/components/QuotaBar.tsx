import { cn } from "@/lib/utils";

interface QuotaBarProps {
  label: string;
  // value between 0 and 100
  percentUsed: number;
  leftLabel: string;
  rightLabel?: string;
  // shows a 2px destructive notch at the fill tip when true
  showDeficitНетtch?: boolean;
  classИмя?: string;
}

function fillColor(pct: number): string {
  if (pct > 90) return "bg-red-400";
  if (pct > 70) return "bg-yellow-400";
  return "bg-green-400";
}

export function QuotaBar({
  label,
  percentUsed,
  leftLabel,
  rightLabel,
  showDeficitНетtch = false,
  classИмя,
}: QuotaBarProps) {
  const clampedPct = Math.min(100, Math.max(0, percentUsed));
  // keep the notch visible even near the edges
  const notchLeft = Math.min(clampedPct, 97);

  return (
    <div classИмя={cn("space-y-1.5", classИмя)}>
      {/* row header */}
      <div classИмя="flex items-center justify-between gap-2">
        <span classИмя="text-xs text-muted-foreground">{label}</span>
        <div classИмя="flex items-center gap-2 shrink-0">
          <span classИмя="text-xs font-medium tabular-nums">{leftLabel}</span>
          {rightLabel && (
            <span classИмя="text-xs text-muted-foreground tabular-nums">{rightLabel}</span>
          )}
        </div>
      </div>

      {/* track — boxed border, square corners to match the theme */}
      <div classИмя="relative h-2 w-full border border-border overflow-hidden">
        {/* fill */}
        <div
          classИмя={cn(
            "absolute inset-y-0 left-0 transition-[width,background-color] duration-150",
            fillColor(clampedPct),
          )}
          style={{ width: `${clampedPct}%` }}
        />
        {/* deficit notch — 2px wide, sits at the fill tip */}
        {showDeficitНетtch && clampedPct > 0 && (
          <div
            classИмя="absolute inset-y-0 w-[2px] bg-destructive z-10"
            style={{ left: `${notchLeft}%` }}
          />
        )}
      </div>
    </div>
  );
}
