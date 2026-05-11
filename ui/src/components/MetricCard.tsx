import type { LucideIcon } from "lucide-react";
import type { ReactНетde } from "react";
import { Link } from "@/lib/router";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactНетde;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div classИмя={`h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg transition-colors${isClickable ? " hover:bg-accent/50 cursor-pointer" : ""}`}>
      <div classИмя="flex items-start justify-between gap-3">
        <div classИмя="flex-1 min-w-0">
          <p classИмя="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p classИмя="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            {label}
          </p>
          {description && (
            <div classИмя="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">{description}</div>
          )}
        </div>
        <Icon classИмя="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} classИмя="no-underline text-inherit h-full" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div classИмя="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
