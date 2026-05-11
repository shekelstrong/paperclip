import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ФильтрЗначение {
  key: string;
  label: string;
  value: string;
}

interface ФильтрBarProps {
  filters: ФильтрЗначение[];
  onУдалить: (key: string) => void;
  onОчистить: () => void;
}

export function ФильтрBar({ filters, onУдалить, onОчистить }: ФильтрBarProps) {
  if (filters.length === 0) return null;

  return (
    <div classИмя="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <Badge key={f.key} variant="secondary" classИмя="gap-1 pr-1">
          <span classИмя="text-muted-foreground">{f.label}:</span>
          <span>{f.value}</span>
          <button
            classИмя="ml-1 rounded-full hover:bg-accent p-0.5"
            onClick={() => onУдалить(f.key)}
          >
            <X classИмя="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" classИмя="text-xs h-6" onClick={onОчистить}>
        Очистить all
      </Button>
    </div>
  );
}
