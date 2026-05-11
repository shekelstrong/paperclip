import { useState } from "react";
import type { Агент } from "@paperclipai/shared";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { User } from "lucide-react";
import { cn } from "../lib/utils";
import { roleЯрлыки } from "./agent-config-primitives";
import { АгентIcon } from "./АгентIconPicker";

export function РепозиторийrtsToPicker({
  agents,
  value,
  onChange,
  disabled = false,
  excludeАгентIds = [],
  disabledEmptyLabel = "Репозиторийrts to: N/A (CEO)",
  chooseLabel = "Репозиторийrts to...",
}: {
  agents: Агент[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  excludeАгентIds?: string[];
  disabledEmptyLabel?: string;
  chooseLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const exclude = new Set(excludeАгентIds);
  const rows = agents.filter(
    (a) => a.status !== "terminated" && !exclude.has(a.id),
  );
  const current = value ? agents.find((a) => a.id === value) : null;
  const terminatedManager = current?.status === "terminated";
  const unknownManager = Boolean(value && !current);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          classИмя={cn(
            "inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
            terminatedManager && "border-amber-600/45 bg-amber-500/5",
            disabled && "opacity-60 cursor-not-allowed",
          )}
          disabled={disabled}
        >
          {unknownManager ? (
            <>
              <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              <span classИмя="min-w-0 truncate text-muted-foreground">Неизвестно manager (stale ID)</span>
            </>
          ) : current ? (
            <>
              <АгентIcon icon={current.icon} classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              <span
                classИмя={cn(
                  "min-w-0 truncate",
                  terminatedManager && "text-amber-900 dark:text-amber-200",
                )}
              >
                {`Репозиторийrts to ${current.name}${terminatedManager ? " (terminated)" : ""}`}
              </span>
            </>
          ) : (
            <>
              <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              <span classИмя="min-w-0 truncate">
                {disabled ? disabledEmptyLabel : chooseLabel}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="w-48 p-1" align="start">
        <button
          type="button"
          classИмя={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
            value === null && "bg-accent",
          )}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          Нет manager
        </button>
        {terminatedManager && (
          <div classИмя="flex min-w-0 items-center gap-2 overflow-hidden px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-0.5">
            <АгентIcon icon={current.icon} classИмя="shrink-0 h-3 w-3" />
            <span classИмя="min-w-0 truncate">
              Current: {current.name} (terminated)
            </span>
          </div>
        )}
        {unknownManager && (
          <div classИмя="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-0.5">
            Сохранитьd manager is missing from this company. Choose a new manager or clear.
          </div>
        )}
        {rows.map((a) => (
          <button
            type="button"
            key={a.id}
            classИмя={cn(
              "flex items-center gap-2 w-full min-w-0 px-2 py-1.5 text-xs rounded hover:bg-accent/50 overflow-hidden",
              a.id === value && "bg-accent",
            )}
            onClick={() => {
              onChange(a.id);
              setOpen(false);
            }}
          >
            <АгентIcon icon={a.icon} classИмя="shrink-0 h-3 w-3 text-muted-foreground" />
            <span classИмя="min-w-0 truncate">{a.name}</span>
            <span classИмя="text-muted-foreground ml-auto shrink-0">{roleЯрлыки[a.role] ?? a.role}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
