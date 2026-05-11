import type { ReactНетde } from "react";
import { MoreHorizontal, Play } from "lucide-react";
import { Link } from "@/lib/router";
import { АгентIcon } from "@/components/АгентIconPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

export type ПроцедураListProjectSummary = {
  name: string;
  color?: string | null;
};

export type ПроцедураListАгентSummary = {
  name: string;
  icon?: string | null;
};

export type ПроцедураListRowItem = {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  assigneeАгентId: string | null;
  lastЗапустить?: {
    triggeredAt?: Date | string | null;
    status?: string | null;
  } | null;
};

export function formatLastЗапуститьTimestamp(value: Date | string | null | undefined) {
  if (!value) return "Никогда";
  return new Date(value).toLocaleString();
}

export function formatПроцедураЗапуститьСтатус(value: string | null | undefined) {
  if (!value) return null;
  return value.replaceВсе("_", " ");
}

export function nextПроцедураСтатус(currentСтатус: string, enabled: boolean) {
  if (currentСтатус === "archived" && enabled) return "active";
  return enabled ? "active" : "paused";
}

export function ПроцедураListRow<TПроцедура extends ПроцедураListRowItem>({
  routine,
  projectById,
  agentById,
  runningПроцедураId,
  statusMutationПроцедураId,
  href,
  configureLabel = "Изменить",
  managedByLabel,
  secondaryДетали,
  runСейчасButton = false,
  disableЗапуститьСейчас = false,
  disableToggle = false,
  hideАрхивироватьAction = false,
  onЗапуститьСейчас,
  onToggleВключитьd,
  onToggleАрхивирован,
}: {
  routine: TПроцедура;
  projectById: Map<string, ПроцедураListProjectSummary>;
  agentById: Map<string, ПроцедураListАгентSummary>;
  runningПроцедураId: string | null;
  statusMutationПроцедураId: string | null;
  href: string;
  configureLabel?: string;
  managedByLabel?: string | null;
  secondaryДетали?: ReactНетde;
  runСейчасButton?: boolean;
  disableЗапуститьСейчас?: boolean;
  disableToggle?: boolean;
  hideАрхивироватьAction?: boolean;
  onЗапуститьСейчас: (routine: TПроцедура) => void;
  onToggleВключитьd: (routine: TПроцедура, enabled: boolean) => void;
  onToggleАрхивирован?: (routine: TПроцедура) => void;
}) {
  const enabled = routine.status === "active";
  const isАрхивирован = routine.status === "archived";
  const isСтатусОжидание = statusMutationПроцедураId === routine.id;
  const project = routine.projectId ? projectById.get(routine.projectId) ?? null : null;
  const agent = routine.assigneeАгентId ? agentById.get(routine.assigneeАгентId) ?? null : null;
  const isЧерновик = !isАрхивирован && !routine.assigneeАгентId;
  const runОтключитьd = runningПроцедураId === routine.id || isАрхивирован || disableЗапуститьСейчас;

  return (
    <Link
      to={href}
      classИмя="group flex flex-col gap-3 border-b border-border px-3 py-3 transition-colors hover:bg-accent/50 last:border-b-0 sm:flex-row sm:items-center no-underline text-inherit"
    >
      <div classИмя="min-w-0 flex-1 space-y-1.5">
        <div classИмя="flex flex-wrap items-center gap-2">
          <span classИмя="truncate text-sm font-medium">{routine.title}</span>
          {(isАрхивирован || routine.status === "paused" || isЧерновик) ? (
            <span classИмя="text-xs text-muted-foreground">
              {isАрхивирован ? "archived" : isЧерновик ? "draft" : "paused"}
            </span>
          ) : null}
          {managedByLabel ? (
            <span classИмя="text-xs text-muted-foreground">{managedByLabel}</span>
          ) : null}
        </div>
        <div classИмя="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span classИмя="flex items-center gap-2">
            <span
              classИмя="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: project?.color ?? "#64748b" }}
            />
            <span>{routine.projectId ? (project?.name ?? "Неизвестно project") : "Нет project"}</span>
          </span>
          <span classИмя="flex items-center gap-2">
            {agent?.icon ? <АгентIcon icon={agent.icon} classИмя="h-3.5 w-3.5 shrink-0" /> : null}
            <span>{routine.assigneeАгентId ? (agent?.name ?? "Неизвестно agent") : "Нет default agent"}</span>
          </span>
          <span>
            {formatLastЗапуститьTimestamp(routine.lastЗапустить?.triggeredAt)}
            {routine.lastЗапустить ? ` · ${formatПроцедураЗапуститьСтатус(routine.lastЗапустить.status)}` : ""}
          </span>
        </div>
        {secondaryДетали ? (
          <div classИмя="text-xs text-muted-foreground">{secondaryДетали}</div>
        ) : null}
      </div>

      <div classИмя="flex items-center gap-3" onClick={(event) => { event.preventПо умолчанию(); event.stopPropagation(); }}>
        {runСейчасButton ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={runОтключитьd}
            onClick={() => onЗапуститьСейчас(routine)}
          >
            <Play classИмя="h-3.5 w-3.5" />
            {runningПроцедураId === routine.id ? "Выполняется..." : "Запустить сейчас"}
          </Button>
        ) : null}

        <div classИмя="flex items-center gap-3">
          <ToggleSwitch
            size="lg"
            checked={enabled}
            onCheckedChange={() => onToggleВключитьd(routine, enabled)}
            disabled={isСтатусОжидание || isАрхивирован || disableToggle}
            aria-label={enabled ? `Отключить ${routine.title}` : `Включить ${routine.title}`}
          />
          <span classИмя="w-12 text-xs text-muted-foreground">
            {isАрхивирован ? "Архивирован" : isЧерновик ? "Черновик" : enabled ? "On" : "Off"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${routine.title}`}>
              <MoreHorizontal classИмя="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={href}>{configureLabel}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={runОтключитьd}
              onClick={() => onЗапуститьСейчас(routine)}
            >
              {runningПроцедураId === routine.id ? "Выполняется..." : "Запустить сейчас"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onToggleВключитьd(routine, enabled)}
              disabled={isСтатусОжидание || isАрхивирован || disableToggle}
            >
              {enabled ? "Пауза" : "Включить"}
            </DropdownMenuItem>
            {!hideАрхивироватьAction && onToggleАрхивирован ? (
              <DropdownMenuItem
                onClick={() => onToggleАрхивирован(routine)}
                disabled={isСтатусОжидание}
              >
                {routine.status === "archived" ? "Restore" : "Архивировать"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}
