import type { ReactНетde } from "react";
import type { Задача } from "@paperclipai/shared";
import { Columns3 } from "lucide-react";
import { pickTextColorForPillBg } from "@/lib/color-contrast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatИсполнительUserLabel } from "../lib/assignees";
import type { ВходящиеЗадачаColumn } from "../lib/inbox";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Identity } from "./Identity";
import { СтатусIcon } from "./СтатусIcon";

export const issueTrailingColumns: ВходящиеЗадачаColumn[] = ["assignee", "project", "workspace", "parent", "labels", "updated"];

const issueColumnЯрлыки: Record<ВходящиеЗадачаColumn, string> = {
  status: "Статус",
  id: "ID",
  assignee: "Исполнитель",
  project: "Project",
  workspace: "Рабочая область",
  parent: "Родитель issue",
  labels: "Метки",
  updated: "Last updated",
};

const issueColumnОписаниеs: Record<ВходящиеЗадачаColumn, string> = {
  status: "Задача state chip on the left edge.",
  id: "Ticket identifier like PAP-1009.",
  assignee: "Assigned agent or board user.",
  project: "Linked project pill with its color.",
  workspace: "Execution or project workspace used for the issue.",
  parent: "Родитель issue identifier and title.",
  labels: "Задача labels and tags.",
  updated: "Latest visible activity time.",
};

export function issueАктивностьText(issue: Задача): string {
  return `Обновлено ${timeAgo(issue.lastАктивностьAt ?? issue.lastExternalCommentAt ?? issue.updatedAt)}`;
}

function issueTrailingGridTemplate(columns: ВходящиеЗадачаColumn[]): string {
  return columns
    .map((column) => {
      if (column === "assignee") return "minmax(6rem, 8rem)";
      if (column === "project") return "minmax(4.5rem, 7rem)";
      if (column === "workspace") return "minmax(6rem, 9rem)";
      if (column === "parent") return "minmax(3.5rem, 5.5rem)";
      if (column === "labels") return "minmax(3rem, 6rem)";
      return "minmax(3.5rem, 4.5rem)";
    })
    .join(" ");
}

export function ЗадачаColumnPicker({
  availableColumns,
  visibleColumnSet,
  onToggleColumn,
  onСброситьColumns,
  title,
  iconOnly = false,
}: {
  availableColumns: ВходящиеЗадачаColumn[];
  visibleColumnSet: ReadonlySet<ВходящиеЗадачаColumn>;
  onToggleColumn: (column: ВходящиеЗадачаColumn, enabled: boolean) => void;
  onСброситьColumns: () => void;
  title: string;
  iconOnly?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={iconOnly ? "outline" : "ghost"}
          size={iconOnly ? "icon" : "sm"}
          classИмя={iconOnly ? "h-8 w-8 shrink-0" : "hidden h-8 shrink-0 px-2 text-xs sm:inline-flex"}
          title="Columns"
        >
          <Columns3 classИмя={iconOnly ? "h-3.5 w-3.5" : "mr-1 h-3.5 w-3.5"} />
          {!iconOnly && "Columns"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" classИмя="w-[300px] rounded-xl border-border/70 p-1.5 shadow-xl shadow-black/10">
        <DropdownMenuLabel classИмя="px-2 pb-1 pt-1.5">
          <div classИмя="space-y-1">
            <div classИмя="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Desktop issue rows
            </div>
            <div classИмя="text-sm font-medium text-foreground">
              {title}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={visibleColumnSet.has(column)}
            onSelect={(event) => event.preventПо умолчанию()}
            onCheckedChange={(checked) => onToggleColumn(column, checked === true)}
            classИмя="items-start rounded-lg px-3 py-2.5 pl-8"
          >
            <span classИмя="flex flex-col gap-0.5">
              <span classИмя="text-sm font-medium text-foreground">
                {issueColumnЯрлыки[column]}
              </span>
              <span classИмя="text-xs leading-relaxed text-muted-foreground">
                {issueColumnОписаниеs[column]}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onСброситьColumns}
          classИмя="rounded-lg px-3 py-2 text-sm"
        >
          Сбросить defaults
          <span classИмя="ml-auto text-xs text-muted-foreground">status, id, updated</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ВходящиеЗадачаMetaLeading({
  issue,
  isLive,
  showСтатус = true,
  showIdentifier = true,
  statusSlot,
  checklistStepNumber = null,
}: {
  issue: Задача;
  isLive: boolean;
  showСтатус?: boolean;
  showIdentifier?: boolean;
  statusSlot?: ReactНетde;
  checklistStepNumber?: number | string | null;
}) {
  return (
    <>
      {showСтатус ? (
        <span classИмя="hidden shrink-0 sm:inline-flex">
          {statusSlot ?? <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} />}
        </span>
      ) : null}
      {checklistStepNumber !== null ? (
        <span classИмя="shrink-0 font-mono text-xs text-muted-foreground" aria-hidden="true">
          {checklistStepNumber}.
        </span>
      ) : null}
      {showIdentifier ? (
        <span classИмя="shrink-0 font-mono text-xs text-muted-foreground">
          {issue.identifier ?? issue.id.slice(0, 8)}
        </span>
      ) : null}
      {isLive && (
        <span
          classИмя={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 sm:gap-1.5 sm:px-2",
            "bg-blue-500/10",
          )}
        >
          <span classИмя="relative flex h-2 w-2">
            <span classИмя="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75" />
            <span
              classИмя={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                "bg-blue-500",
              )}
            />
          </span>
          <span
            classИмя={cn(
              "hidden text-[11px] font-medium sm:inline",
              "text-blue-600 dark:text-blue-400",
            )}
          >
            Live
          </span>
        </span>
      )}
    </>
  );
}

export function ВходящиеЗадачаTrailingColumns({
  issue,
  columns,
  projectИмя,
  projectColor,
  workspaceId,
  workspaceИмя,
  assigneeИмя,
  assigneeUserИмя,
  assigneeUserAvatarUrl,
  currentUserId,
  parentIdentifier,
  parentНазвание,
  assigneeContent,
  onФильтрРабочая область,
}: {
  issue: Задача;
  columns: ВходящиеЗадачаColumn[];
  projectИмя: string | null;
  projectColor: string | null;
  workspaceId?: string | null;
  workspaceИмя: string | null;
  assigneeИмя: string | null;
  assigneeUserИмя?: string | null;
  assigneeUserAvatarUrl?: string | null;
  currentUserId: string | null;
  parentIdentifier: string | null;
  parentНазвание: string | null;
  assigneeContent?: ReactНетde;
  onФильтрРабочая область?: (workspaceId: string) => void;
}) {
  const activityText = timeAgo(issue.lastАктивностьAt ?? issue.lastExternalCommentAt ?? issue.updatedAt);
  const userLabel = assigneeUserИмя ?? formatИсполнительUserLabel(issue.assigneeUserId, currentUserId) ?? "User";

  return (
    <span
      classИмя="grid items-center gap-2"
      style={{ gridTemplateColumns: issueTrailingGridTemplate(columns) }}
    >
      {columns.map((column) => {
        if (column === "assignee") {
          if (assigneeContent) {
            return <span key={column} classИмя="min-w-0">{assigneeContent}</span>;
          }

          if (issue.assigneeАгентId) {
            return (
              <span key={column} classИмя="min-w-0 text-xs text-foreground">
                <Identity
                  name={assigneeИмя ?? issue.assigneeАгентId.slice(0, 8)}
                  size="sm"
                  classИмя="min-w-0"
                />
              </span>
            );
          }

          if (issue.assigneeUserId) {
            return (
              <span key={column} classИмя="min-w-0 text-xs text-foreground">
                <Identity
                  name={userLabel}
                  avatarUrl={assigneeUserAvatarUrl}
                  size="sm"
                  classИмя="min-w-0"
                />
              </span>
            );
          }

          return (
            <span key={column} classИмя="min-w-0 truncate text-xs text-muted-foreground">
              Не назначен
            </span>
          );
        }

        if (column === "project") {
          if (projectИмя) {
            const accentColor = projectColor ?? "#64748b";
            return (
              <span
                key={column}
                classИмя="inline-flex min-w-0 items-center gap-2 text-xs font-medium"
                style={{ color: pickTextColorForPillBg(accentColor, 0.12) }}
              >
                <span
                  classИмя="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span classИмя="truncate">{projectИмя}</span>
              </span>
            );
          }

          return (
            <span key={column} classИмя="min-w-0 truncate text-xs text-muted-foreground">
              Нет project
            </span>
          );
        }

        if (column === "labels") {
          if ((issue.labels ?? []).length > 0) {
            return (
              <span key={column} classИмя="flex min-w-0 items-center gap-1 overflow-hidden">
                {(issue.labels ?? []).slice(0, 2).map((label) => (
                  <span
                    key={label.id}
                    classИмя="inline-flex min-w-0 max-w-full shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-medium"
                    style={{
                      borderColor: label.color,
                      color: pickTextColorForPillBg(label.color, 0.12),
                      backgroundColor: `${label.color}1f`,
                    }}
                  >
                    <span classИмя="truncate">{label.name}</span>
                  </span>
                ))}
                {(issue.labels ?? []).length > 2 ? (
                  <span classИмя="shrink-0 text-[10px] font-medium text-muted-foreground">
                    +{(issue.labels ?? []).length - 2}
                  </span>
                ) : null}
              </span>
            );
          }

          return <span key={column} classИмя="min-w-0" aria-hidden="true" />;
        }

        if (column === "workspace") {
          if (!workspaceИмя) {
            return <span key={column} classИмя="min-w-0" aria-hidden="true" />;
          }

          return (
            <span key={column} classИмя="min-w-0 truncate text-xs text-muted-foreground">
              {workspaceId && onФильтрРабочая область ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      classИмя="truncate rounded-sm text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                      onClick={(event) => {
                        event.preventПо умолчанию();
                        event.stopPropagation();
                        onФильтрРабочая область(workspaceId);
                      }}
                    >
                      {workspaceИмя}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Фильтр by workspace
                  </TooltipContent>
                </Tooltip>
              ) : (
                workspaceИмя
              )}
            </span>
          );
        }

        if (column === "parent") {
          if (!issue.parentId) {
            return <span key={column} classИмя="min-w-0" aria-hidden="true" />;
          }

          return (
            <span key={column} classИмя="min-w-0 truncate text-xs text-muted-foreground" title={parentНазвание ?? undefined}>
              {parentIdentifier ? (
                <span classИмя="font-mono">{parentIdentifier}</span>
              ) : (
                <span classИмя="italic">Подзадача</span>
              )}
            </span>
          );
        }

        if (column === "updated") {
          return (
            <span key={column} classИмя="min-w-0 truncate text-right text-[11px] font-medium text-muted-foreground">
              {activityText}
            </span>
          );
        }

        return null;
      })}
    </span>
  );
}
