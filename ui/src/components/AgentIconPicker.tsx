import { useState, useMemo } from "react";
import {
  type LucideIcon,
} from "lucide-react";
import { AGENT_ICON_NAMES, type АгентIconИмя } from "@paperclipai/shared";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AGENT_ICONS, getАгентIcon } from "../lib/agent-icons";

const DEFAULT_ICON: АгентIconИмя = "bot";

interface АгентIconProps {
  icon: string | null | undefined;
  classИмя?: string;
}

export function АгентIcon({ icon, classИмя }: АгентIconProps) {
  const Icon = getАгентIcon(icon);
  return <Icon classИмя={classИмя} />;
}

interface АгентIconPickerProps {
  value: string | null | undefined;
  onChange: (icon: string) => void;
  children: React.ReactНетde;
}

export function АгентIconPicker({ value, onChange, children }: АгентIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setПоиск] = useState("");

  const filtered = useMemo(() => {
    const entries = AGENT_ICON_NAMES.map((name) => [name, AGENT_ICONS[name]] as const);
    if (!search) return entries;
    const q = search.toНизкийerCase();
    return entries.filter(([name]) => name.includes(q));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent classИмя="w-72 p-3" align="start">
        <Input
          placeholder="Поиск icons..."
          value={search}
          onChange={(e) => setПоиск(e.target.value)}
          classИмя="mb-2 h-8 text-sm"
          autoFocus
        />
        <div classИмя="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
          {filtered.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
                setПоиск("");
              }}
              classИмя={cn(
                "flex items-center justify-center h-8 w-8 rounded hover:bg-accent transition-colors",
                (value ?? DEFAULT_ICON) === name && "bg-accent ring-1 ring-primary"
              )}
              title={name}
            >
              <Icon classИмя="h-4 w-4" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p classИмя="col-span-7 text-xs text-muted-foreground text-center py-2">Нет icons match</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
