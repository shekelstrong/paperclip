import { useState } from "react";
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { priorityColor, priorityColorПо умолчанию } from "../lib/status-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const priorityConfig: Record<string, { icon: typeof ArrowUp; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: priorityColor.critical ?? priorityColorПо умолчанию, label: "Критично" },
  high: { icon: ArrowUp, color: priorityColor.high ?? priorityColorПо умолчанию, label: "Высокий" },
  medium: { icon: Minus, color: priorityColor.medium ?? priorityColorПо умолчанию, label: "Средний" },
  low: { icon: ArrowDown, color: priorityColor.low ?? priorityColorПо умолчанию, label: "Низкий" },
};

const allPriorities = ["critical", "high", "medium", "low"];

interface ПриоритетIconProps {
  priority: string;
  onChange?: (priority: string) => void;
  classИмя?: string;
  showLabel?: boolean;
}

export function ПриоритетIcon({ priority, onChange, classИмя, showLabel }: ПриоритетIconProps) {
  const [open, setOpen] = useState(false);
  const config = priorityConfig[priority] ?? priorityConfig.medium!;
  const Icon = config.icon;

  const icon = (
    <span
      classИмя={cn(
        "inline-flex items-center justify-center shrink-0",
        config.color,
        onChange && !showLabel && "cursor-pointer",
        classИмя
      )}
    >
      <Icon classИмя="h-3.5 w-3.5" />
    </span>
  );

  if (!onChange) return showLabel ? <span classИмя="inline-flex items-center gap-1.5">{icon}<span classИмя="text-sm">{config.label}</span></span> : icon;

  const trigger = showLabel ? (
    <button classИмя="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors">
      {icon}
      <span classИмя="text-sm">{config.label}</span>
    </button>
  ) : icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent classИмя="w-36 p-1" align="start">
        {allPriorities.map((p) => {
          const c = priorityConfig[p]!;
          const PIcon = c.icon;
          return (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              classИмя={cn("w-full justify-start gap-2 text-xs", p === priority && "bg-accent")}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
            >
              <PIcon classИмя={cn("h-3.5 w-3.5", c.color)} />
              {c.label}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
