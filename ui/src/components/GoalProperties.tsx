import { useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { Цель } from "@paperclipai/shared";
import { GOAL_STATUSES, GOAL_LEVELS } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусBadge } from "./СтатусBadge";
import { formatDate, cn, agentUrl } from "../lib/utils";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ЦельPropertiesProps {
  goal: Цель;
  onОбновить?: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex items-start gap-3 py-1.5">
      <span classИмя="text-xs text-muted-foreground shrink-0 w-20 mt-0.5">{label}</span>
      <div classИмя="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">{children}</div>
    </div>
  );
}

function label(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PickerButton({
  current,
  options,
  onChange,
  children,
}: {
  current: string;
  options: readonly string[];
  onChange: (value: string) => void;
  children: React.ReactНетde;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button classИмя="cursor-pointer hover:opacity-80 transition-opacity">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="w-40 p-1" align="end">
        {options.map((opt) => (
          <Button
            key={opt}
            variant="ghost"
            size="sm"
            classИмя={cn("w-full justify-start text-xs", opt === current && "bg-accent")}
            onClick={() => {
              onChange(opt);
              setOpen(false);
            }}
          >
            {label(opt)}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ЦельProperties({ goal, onОбновить }: ЦельPropertiesProps) {
  const { selectedКомпанияId } = useКомпания();

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: allЦели } = useQuery({
    queryКлюч: queryКлючs.goals.list(selectedКомпанияId!),
    queryFn: () => goalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const ownerАгент = goal.ownerАгентId
    ? agents?.find((a) => a.id === goal.ownerАгентId)
    : null;

  const parentЦель = goal.parentId
    ? allЦели?.find((g) => g.id === goal.parentId)
    : null;

  return (
    <div classИмя="space-y-4">
      <div classИмя="space-y-1">
        <PropertyRow label="Статус">
          {onОбновить ? (
            <PickerButton
              current={goal.status}
              options={GOAL_STATUSES}
              onChange={(status) => onОбновить({ status })}
            >
              <СтатусBadge status={goal.status} />
            </PickerButton>
          ) : (
            <СтатусBadge status={goal.status} />
          )}
        </PropertyRow>

        <PropertyRow label="Level">
          {onОбновить ? (
            <PickerButton
              current={goal.level}
              options={GOAL_LEVELS}
              onChange={(level) => onОбновить({ level })}
            >
              <span classИмя="text-sm capitalize">{goal.level}</span>
            </PickerButton>
          ) : (
            <span classИмя="text-sm capitalize">{goal.level}</span>
          )}
        </PropertyRow>

        <PropertyRow label="Владелец">
          {ownerАгент ? (
            <Link
              to={agentUrl(ownerАгент)}
              classИмя="text-sm hover:underline"
            >
              {ownerАгент.name}
            </Link>
          ) : (
            <span classИмя="text-sm text-muted-foreground">Нет</span>
          )}
        </PropertyRow>

        {goal.parentId && (
          <PropertyRow label="Родитель Цель">
            <Link
              to={`/goals/${goal.parentId}`}
              classИмя="text-sm hover:underline"
            >
              {parentЦель?.title ?? goal.parentId.slice(0, 8)}
            </Link>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div classИмя="space-y-1">
        <PropertyRow label="Создано">
          <span classИмя="text-sm">{formatDate(goal.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Обновлено">
          <span classИмя="text-sm">{formatDate(goal.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
