import { DollarSign } from "lucide-react";

export type БюджетSidebarMarkerLevel = "healthy" | "warning" | "critical";

const levelClasses: Record<БюджетSidebarMarkerLevel, string> = {
  healthy: "bg-emerald-500/90 text-white",
  warning: "bg-amber-500/95 text-amber-950",
  critical: "bg-red-500/90 text-white",
};

const defaultНазваниеs: Record<БюджетSidebarMarkerLevel, string> = {
  healthy: "Бюджет в норме",
  warning: "Предупреждение бюджета",
  critical: "Приостановлен by budget",
};

export function БюджетSidebarMarker({
  title,
  level = "critical",
}: {
  title?: string;
  level?: БюджетSidebarMarkerLevel;
}) {
  const accessibleНазвание = title ?? defaultНазваниеs[level];

  return (
    <span
      title={accessibleНазвание}
      aria-label={accessibleНазвание}
      classИмя={`ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ${levelClasses[level]}`}
    >
      <DollarSign classИмя="h-3 w-3" />
    </span>
  );
}
