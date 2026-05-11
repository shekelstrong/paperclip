import { type ReactНетde } from "react";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";

interface EntityRowProps {
  leading?: ReactНетde;
  identifier?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactНетde;
  selected?: boolean;
  to?: string;
  onClick?: () => void;
  classИмя?: string;
}

export function EntityRow({
  leading,
  identifier,
  title,
  subtitle,
  trailing,
  selected,
  to,
  onClick,
  classИмя,
}: EntityRowProps) {
  const isClickable = !!(to || onClick);
  const classes = cn(
    "flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-b-0 transition-colors",
    isClickable && "cursor-pointer hover:bg-accent/50",
    selected && "bg-accent/30",
    classИмя
  );

  const content = (
    <>
      {leading && <div classИмя="flex items-center gap-2 shrink-0">{leading}</div>}
      <div classИмя="flex-1 min-w-0">
        <div classИмя="flex items-center gap-2">
          {identifier && (
            <span classИмя="text-xs text-muted-foreground font-mono shrink-0 relative top-[1px]">
              {identifier}
            </span>
          )}
          <span classИмя="truncate">{title}</span>
        </div>
        {subtitle && (
          <p classИмя="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && <div classИмя="flex items-center gap-2 shrink-0">{trailing}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} classИмя={cn(classes, "no-underline text-inherit")} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <div classИмя={classes} onClick={onClick}>
      {content}
    </div>
  );
}
