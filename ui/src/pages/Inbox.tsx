import { type ReactНетde, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { INBOX_MINE_ISSUE_STATUS_FILTER } from "@paperclipai/shared";
import { approvalsApi } from "../api/approvals";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { ApiОшибка } from "../api/client";
import { dashboardApi } from "../api/dashboard";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { projectsApi } from "../api/projects";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useОбщиеНастройки } from "../context/ОбщиеНастройкиContext";
import { useSidebar } from "../context/SidebarContext";
import { queryКлючs } from "../lib/queryКлючs";
import { useDialogActions } from "../context/DialogContext";
import {
  applyЗадачаФильтрs,
  countАктивенЗадачаФильтрs,
  type ЗадачаФильтрState,
} from "../lib/issue-filters";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { buildКомпанияUserLabelMap, buildКомпанияUserПрофильMap } from "../lib/company-members";
import {
  armЗадачаDetailВходящиеQuickАрхивировать,
  createЗадачаDetailLocationState,
  createЗадачаDetailПуть,
  rememberЗадачаDetailLocationState,
  withЗадачаDetailHeaderSeed,
} from "../lib/issueDetailBreadcrumb";
import { prefetchЗадачаDetail } from "../lib/issueDetailCache";
import {
  hasBlockingShortcutDialog,
  isКлючboardShortcutTextInputЦель,
  resolveВходящиеUndoАрхивироватьКлючAction,
  shouldBlurPageПоискOnEnter,
  shouldBlurPageПоискOnEscape,
} from "../lib/keyboardShortcuts";
import { EmptyState } from "../components/EmptyState";
import { ЗадачаGroupHeader } from "../components/ЗадачаGroupHeader";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  ВходящиеЗадачаMetaLeading,
  ВходящиеЗадачаTrailingColumns,
  ЗадачаColumnPicker,
  issueАктивностьText,
  issueTrailingColumns,
} from "../components/ЗадачаColumns";
import { ЗадачаФильтрsPopover } from "../components/ЗадачаФильтрsPopover";
import { ЗадачаRow } from "../components/ЗадачаRow";
import { SwipeToАрхивировать } from "../components/SwipeToАрхивировать";

import { СтатусIcon } from "../components/СтатусIcon";
import { cn } from "../lib/utils";
import { СтатусBadge } from "../components/СтатусBadge";
import { approvalLabel, defaultТипIcon, typeIcon } from "../components/СогласованиеPayload";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Входящие as ВходящиеIcon,
  AlertTriangle,
  Check,
  ChevronRight,
  Layers,
  Plus,
  XCircle,
  X,
  RotateCcw,
  UserPlus,
  Поиск,
  ListTree,
} from "lucide-react";

const INBOX_HEARTBEAT_RUN_LIMIT = 200;
const INBOX_ISSUE_LIST_LIMIT = 500;
import { Input } from "@/components/ui/input";
import { PageTabBar } from "../components/PageTabBar";
import type { Согласование, HeartbeatЗапустить, Задача, JoinRequest } from "@paperclipai/shared";
import {
  ACTIONABLE_APPROVAL_STATUSES,
  DEFAULT_INBOX_ISSUE_COLUMNS,
  buildGroupedВходящиеSections,
  buildВходящиеЗадачаGroupСоздатьПо умолчаниюs,
  buildВходящиеКлючboardNavEntries,
  getAvailableВходящиеЗадачаColumns,
  getВходящиеРаботаItemКлюч,
  getСогласованияForTab,
  getАрхивированВходящиеПоискЗадачи,
  getВходящиеКлючboardSelectionIndex,
  getВходящиеРаботаItems,
  getВходящиеПоискSupplementЗадачи,
  getLatestОшибкаЗапуститьsByАгент,
  matchesВходящиеЗадачаПоиск,
  getRecentTouchedЗадачи,
  isВходящиеEntityЗакрытьed,
  isMineВходящиеTab,
  loadCollapsedВходящиеGroupКлючs,
  loadВходящиеФильтрPreferences,
  loadВходящиеЗадачаColumns,
  loadВходящиеNesting,
  loadВходящиеРаботаItemGroupBy,
  normalizeВходящиеЗадачаColumns,
  resolveВходящиеNestingВключитьd,
  shouldСброситьВходящиеРабочая областьGrouping,
  resolveЗадачаРабочая областьИмя,
  resolveВходящиеSelectionIndex,
  saveВходящиеФильтрPreferences,
  saveCollapsedВходящиеGroupКлючs,
  saveВходящиеЗадачаColumns,
  saveВходящиеNesting,
  saveВходящиеРаботаItemGroupBy,
  type ВходящиеРабочая областьGroupingOptions,
  type ВходящиеСогласованиеФильтр,
  type ВходящиеCategoryФильтр,
  type ВходящиеФильтрPreferences,
  type ВходящиеЗадачаColumn,
  type ВходящиеКлючboardNavEntry,
  saveLastВходящиеTab,
  shouldShowКомпанияAlerts,
  shouldShowВходящиеSection,
  type ВходящиеGroupedSection,
  type ВходящиеTab,
  type ВходящиеРаботаItem,
  type ВходящиеРаботаItemGroupBy,
} from "../lib/inbox";
import { useЗакрытьedВходящиеAlerts, useВходящиеЗакрытьals, useReadВходящиеItems } from "../hooks/useВходящиеBadge";

export { ВходящиеЗадачаMetaLeading, ВходящиеЗадачаTrailingColumns } from "../components/ЗадачаColumns";
export { ЗадачаGroupHeader as ВходящиеGroupHeader } from "../components/ЗадачаGroupHeader";
type SectionКлюч =
  | "work_items"
  | "alerts";

/** A flat navigation entry for keyboard j/k traversal that includes expanded children. */
type NavEntry = ВходящиеКлючboardNavEntry;
type CreatorOption = {
  id: string;
  label: string;
  kind: "agent" | "user";
  searchText?: string;
};

function firstНетnEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.split("\n").map((chunk) => chunk.trim()).find(Boolean);
  return line ?? null;
}

function runFailureMessage(run: HeartbeatЗапустить): string {
  return firstНетnEmptyLine(run.error) ?? firstНетnEmptyLine(run.stderrExcerpt) ?? "Запустить exited with an error.";
}

function approvalСтатусLabel(status: Согласование["status"]): string {
  return status.replaceВсе("_", " ");
}

function readЗадачаIdFromЗапустить(run: HeartbeatЗапустить): string | null {
  const context = run.contextSnapshot;
  if (!context) return null;

  const issueId = context["issueId"];
  if (typeof issueId === "string" && issueId.length > 0) return issueId;

  const taskId = context["taskId"];
  if (typeof taskId === "string" && taskId.length > 0) return taskId;

  return null;
}

function nonEmptyLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatJoinRequestВходящиеLabel(
  joinRequest: Pick<
    JoinRequest,
    "requestТип" | "agentИмя" | "requestПочтаSnapshot" | "requestingUserId"
  > & {
    requesterUser?: {
      name: string | null;
      email: string | null;
    } | null;
  },
) {
  if (joinRequest.requestТип !== "human") {
    return `Заявка агента${joinRequest.agentИмя ? `: ${joinRequest.agentИмя}` : ""}`;
  }

  const requesterИмя = nonEmptyLabel(joinRequest.requesterUser?.name);
  const requesterПочта =
    nonEmptyLabel(joinRequest.requesterUser?.email) ??
    nonEmptyLabel(joinRequest.requestПочтаSnapshot);
  const requesterId = nonEmptyLabel(joinRequest.requestingUserId);

  if (requesterИмя && requesterПочта) return `${requesterИмя} (${requesterПочта})`;
  if (requesterПочта) return requesterПочта;
  if (requesterИмя) return requesterИмя;
  if (requesterId) return requesterId;
  return "Человек join request";
}


type НетnЗадачаUnreadState = "visible" | "fading" | "hidden" | null;

export function ОшибкаЗапуститьВходящиеRow({
  run,
  issueById,
  agentИмя: linkedАгентИмя,
  issueLinkState,
  onЗакрыть,
  onПовторить,
  isПовторитьing,
  unreadState = null,
  onMarkRead,
  onАрхивировать,
  archiveОтключитьd,
  selected = false,
  classИмя,
}: {
  run: HeartbeatЗапустить;
  issueById: Map<string, Задача>;
  agentИмя: string | null;
  issueLinkState: unknown;
  onЗакрыть: () => void;
  onПовторить: () => void;
  isПовторитьing: boolean;
  unreadState?: НетnЗадачаUnreadState;
  onMarkRead?: () => void;
  onАрхивировать?: () => void;
  archiveОтключитьd?: boolean;
  selected?: boolean;
  classИмя?: string;
}) {
  const issueId = readЗадачаIdFromЗапустить(run);
  const issue = issueId ? issueById.get(issueId) ?? null : null;
  const displayОшибка = runFailureMessage(run);
  const showUnreadSlot = unreadState !== null;
  const showUnreadDot = unreadState === "visible" || unreadState === "fading";

  return (
    <div classИмя={cn(
      "group border-b border-border px-2 py-2.5 last:border-b-0 sm:px-1 sm:pr-3 sm:py-2",
      classИмя,
    )}>
      <div classИмя="flex items-start gap-2 sm:items-center">
        {showUnreadSlot ? (
          <span classИмя="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
            {showUnreadDot ? (
              <button
                type="button"
                onClick={onMarkRead}
                classИмя={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  "hover:bg-blue-500/20",
                )}
                aria-label="Mark as read"
              >
                <span classИмя={cn(
                  "block h-2 w-2 rounded-full transition-opacity duration-300",
                  "bg-blue-600 dark:bg-blue-400",
                  unreadState === "fading" ? "opacity-0" : "opacity-100",
                )} />
              </button>
            ) : onАрхивировать ? (
              <button
                type="button"
                onClick={onАрхивировать}
                disabled={archiveОтключитьd}
                classИмя="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Закрыть from inbox"
              >
                <X classИмя="h-3.5 w-3.5" />
              </button>
            ) : (
              <span classИмя="inline-flex h-4 w-4" aria-hidden="true" />
            )}
          </span>
        ) : null}
        <Link
          to={`/agents/${run.agentId}/runs/${run.id}`}
          classИмя={cn(
            "flex min-w-0 flex-1 items-start gap-2 no-underline text-inherit transition-colors",
            selected ? "hover:bg-transparent" : "hover:bg-accent/50",
          )}
        >
          {!showUnreadSlot && <span classИмя="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />}
          <span classИмя="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span classИмя="mt-0.5 shrink-0 rounded-md bg-red-500/20 p-1.5 sm:mt-0">
            <XCircle classИмя="h-4 w-4 text-red-600 dark:text-red-400" />
          </span>
          <span classИмя="min-w-0 flex-1">
            <span classИмя="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {issue ? (
                <>
                  <span classИмя="font-mono text-muted-foreground mr-1.5">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  {issue.title}
                </>
              ) : (
                <>Ошибка run{linkedАгентИмя ? ` — ${linkedАгентИмя}` : ""}</>
              )}
            </span>
            <span classИмя="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <СтатусBadge status={run.status} />
              {linkedАгентИмя && issue ? <span>{linkedАгентИмя}</span> : null}
              <span classИмя="truncate max-w-[300px]">{displayОшибка}</span>
              <span>{timeAgo(run.createdAt)}</span>
            </span>
          </span>
        </Link>
        <div classИмя="hidden shrink-0 items-center gap-2 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            classИмя="h-8 shrink-0 px-2.5"
            onClick={onПовторить}
            disabled={isПовторитьing}
          >
            <RotateCcw classИмя="mr-1.5 h-3.5 w-3.5" />
            {isПовторитьing ? "Повторитьing…" : "Повторить"}
          </Button>
          {!showUnreadSlot && (
            <button
              type="button"
              onClick={onЗакрыть}
              classИмя="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              aria-label="Закрыть"
            >
              <X classИмя="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div classИмя="mt-3 flex gap-2 sm:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          classИмя="h-8 shrink-0 px-2.5"
          onClick={onПовторить}
          disabled={isПовторитьing}
        >
          <RotateCcw classИмя="mr-1.5 h-3.5 w-3.5" />
          {isПовторитьing ? "Повторитьing…" : "Повторить"}
        </Button>
        {!showUnreadSlot && (
          <button
            type="button"
            onClick={onЗакрыть}
            classИмя="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Закрыть"
          >
            <X classИмя="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function СогласованиеВходящиеRow({
  approval,
  requesterИмя,
  onОдобрить,
  onОтклонить,
  isОжидание,
  unreadState = null,
  onMarkRead,
  onАрхивировать,
  archiveОтключитьd,
  selected = false,
  classИмя,
}: {
  approval: Согласование;
  requesterИмя: string | null;
  onОдобрить: () => void;
  onОтклонить: () => void;
  isОжидание: boolean;
  unreadState?: НетnЗадачаUnreadState;
  onMarkRead?: () => void;
  onАрхивировать?: () => void;
  archiveОтключитьd?: boolean;
  selected?: boolean;
  classИмя?: string;
}) {
  const Icon = typeIcon[approval.type] ?? defaultТипIcon;
  const label = approvalLabel(approval.type, approval.payload as Record<string, unknown> | null);
  const showResolutionButtons =
    approval.type !== "budget_override_required" &&
    ACTIONABLE_APPROVAL_STATUSES.has(approval.status);
  const showUnreadSlot = unreadState !== null;
  const showUnreadDot = unreadState === "visible" || unreadState === "fading";

  return (
    <div classИмя={cn(
      "group border-b border-border px-2 py-2.5 last:border-b-0 sm:px-1 sm:pr-3 sm:py-2",
      classИмя,
    )}>
      <div classИмя="flex items-start gap-2 sm:items-center">
        {showUnreadSlot ? (
          <span classИмя="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
            {showUnreadDot ? (
              <button
                type="button"
                onClick={onMarkRead}
                classИмя={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  "hover:bg-blue-500/20",
                )}
                aria-label="Mark as read"
              >
                <span classИмя={cn(
                  "block h-2 w-2 rounded-full transition-opacity duration-300",
                  "bg-blue-600 dark:bg-blue-400",
                  unreadState === "fading" ? "opacity-0" : "opacity-100",
                )} />
              </button>
            ) : onАрхивировать ? (
              <button
                type="button"
                onClick={onАрхивировать}
                disabled={archiveОтключитьd}
                classИмя="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Закрыть from inbox"
              >
                <X classИмя="h-3.5 w-3.5" />
              </button>
            ) : (
              <span classИмя="inline-flex h-4 w-4" aria-hidden="true" />
            )}
          </span>
        ) : null}
        <Link
          to={`/approvals/${approval.id}`}
          classИмя={cn(
            "flex min-w-0 flex-1 items-start gap-2 no-underline text-inherit transition-colors",
            selected ? "hover:bg-transparent" : "hover:bg-accent/50",
          )}
        >
          {!showUnreadSlot && <span classИмя="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />}
          <span classИмя="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span classИмя="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 sm:mt-0">
            <Icon classИмя="h-4 w-4 text-muted-foreground" />
          </span>
          <span classИмя="min-w-0 flex-1">
            <span classИмя="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {label}
            </span>
            <span classИмя="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span classИмя="capitalize">{approvalСтатусLabel(approval.status)}</span>
              {requesterИмя ? <span>requested by {requesterИмя}</span> : null}
              <span>updated {timeAgo(approval.updatedAt)}</span>
            </span>
          </span>
        </Link>
        {showResolutionButtons ? (
          <div classИмя="hidden shrink-0 items-center gap-2 sm:flex">
            <Button
              size="sm"
              classИмя="h-8 bg-green-700 px-3 text-white hover:bg-green-600"
              onClick={onОдобрить}
              disabled={isОжидание}
            >
              Одобрить
            </Button>
            <Button
              variant="destructive"
              size="sm"
              classИмя="h-8 px-3"
              onClick={onОтклонить}
              disabled={isОжидание}
            >
              Отклонить
            </Button>
          </div>
        ) : null}
      </div>
      {showResolutionButtons ? (
        <div classИмя="mt-3 flex gap-2 sm:hidden">
          <Button
            size="sm"
            classИмя="h-8 bg-green-700 px-3 text-white hover:bg-green-600"
            onClick={onОдобрить}
            disabled={isОжидание}
          >
            Одобрить
          </Button>
          <Button
            variant="destructive"
            size="sm"
            classИмя="h-8 px-3"
            onClick={onОтклонить}
            disabled={isОжидание}
          >
            Отклонить
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function JoinRequestВходящиеRow({
  joinRequest,
  onОдобрить,
  onОтклонить,
  isОжидание,
  unreadState = null,
  onMarkRead,
  onАрхивировать,
  archiveОтключитьd,
  selected = false,
  classИмя,
}: {
  joinRequest: JoinRequest;
  onОдобрить: () => void;
  onОтклонить: () => void;
  isОжидание: boolean;
  unreadState?: НетnЗадачаUnreadState;
  onMarkRead?: () => void;
  onАрхивировать?: () => void;
  archiveОтключитьd?: boolean;
  selected?: boolean;
  classИмя?: string;
}) {
  const label = formatJoinRequestВходящиеLabel(joinRequest);
  const showUnreadSlot = unreadState !== null;
  const showUnreadDot = unreadState === "visible" || unreadState === "fading";

  return (
    <div classИмя={cn(
      "group border-b border-border px-2 py-2.5 last:border-b-0 sm:px-1 sm:pr-3 sm:py-2",
      classИмя,
    )}>
      <div classИмя="flex items-start gap-2 sm:items-center">
        {showUnreadSlot ? (
          <span classИмя="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
            {showUnreadDot ? (
              <button
                type="button"
                onClick={onMarkRead}
                classИмя={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  "hover:bg-blue-500/20",
                )}
                aria-label="Mark as read"
              >
                <span classИмя={cn(
                  "block h-2 w-2 rounded-full transition-opacity duration-300",
                  "bg-blue-600 dark:bg-blue-400",
                  unreadState === "fading" ? "opacity-0" : "opacity-100",
                )} />
              </button>
            ) : onАрхивировать ? (
              <button
                type="button"
                onClick={onАрхивировать}
                disabled={archiveОтключитьd}
                classИмя="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Закрыть from inbox"
              >
                <X classИмя="h-3.5 w-3.5" />
              </button>
            ) : (
              <span classИмя="inline-flex h-4 w-4" aria-hidden="true" />
            )}
          </span>
        ) : null}
        <div classИмя="flex min-w-0 flex-1 items-start gap-2">
          {!showUnreadSlot && <span classИмя="hidden h-2 w-2 shrink-0 sm:inline-flex" aria-hidden="true" />}
          <span classИмя="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true" />
          <span classИмя="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 sm:mt-0">
            <UserPlus classИмя="h-4 w-4 text-muted-foreground" />
          </span>
          <span classИмя="min-w-0 flex-1">
            <span classИмя="line-clamp-2 text-sm font-medium sm:truncate sm:line-clamp-none">
              {label}
            </span>
            <span classИмя="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>requested {timeAgo(joinRequest.createdAt)} from IP {joinRequest.requestIp}</span>
              {joinRequest.adapterТип && <span>adapter: {joinRequest.adapterТип}</span>}
            </span>
          </span>
        </div>
        <div classИмя="hidden shrink-0 items-center gap-2 sm:flex">
          <Button
            size="sm"
            classИмя="h-8 bg-green-700 px-3 text-white hover:bg-green-600"
            onClick={onОдобрить}
            disabled={isОжидание}
          >
            Одобрить
          </Button>
          <Button
            variant="destructive"
            size="sm"
            classИмя="h-8 px-3"
            onClick={onОтклонить}
            disabled={isОжидание}
          >
            Отклонить
          </Button>
        </div>
      </div>
      <div classИмя="mt-3 flex gap-2 sm:hidden">
        <Button
          size="sm"
          classИмя="h-8 bg-green-700 px-3 text-white hover:bg-green-600"
          onClick={onОдобрить}
          disabled={isОжидание}
        >
          Одобрить
        </Button>
        <Button
          variant="destructive"
          size="sm"
          classИмя="h-8 px-3"
          onClick={onОтклонить}
          disabled={isОжидание}
        >
          Отклонить
        </Button>
      </div>
    </div>
  );
}

export function Входящие() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewЗадача } = useDialogActions();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);
  const { keyboardShortcutsВключитьd } = useОбщиеНастройки();
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });
  const experimentalНастройкиLoaded = experimentalНастройки !== undefined;
  const [searchQuery, setПоискQuery] = useState("");
  const normalizedПоискQuery = searchQuery.trim();
  const [filterPreferences, setФильтрPreferences] = useState<ВходящиеФильтрPreferences>(
    () => loadВходящиеФильтрPreferences(selectedКомпанияId),
  );
  const [groupBy, setGroupBy] = useState<ВходящиеРаботаItemGroupBy>(() => loadВходящиеРаботаItemGroupBy());
  const [visibleЗадачаColumns, setVisibleЗадачаColumns] = useState<ВходящиеЗадачаColumn[]>(loadВходящиеЗадачаColumns);
  const { dismissed: dismissedAlerts, dismiss: dismissAlert } = useЗакрытьedВходящиеAlerts();
  const { dismissedAtByКлюч, dismiss: dismissВходящиеItem } = useВходящиеЗакрытьals(selectedКомпанияId);
  const { readItems, markRead: markItemRead, markUnread: markItemUnread } = useReadВходящиеItems();
  const { allCategoryФильтр, allСогласованиеФильтр, issueФильтрs } = filterPreferences;

  const pathSegment = location.pathname.split("/").pop() ?? "mine";
  const tab: ВходящиеTab =
    pathSegment === "mine" || pathSegment === "recent" || pathSegment === "all" || pathSegment === "unread"
      ? pathSegment
      : "mine";
  const canАрхивироватьFromTab = isMineВходящиеTab(tab);
  const issueLinkState = useMemo(
    () =>
      createЗадачаDetailLocationState(
        "Входящие",
        `${location.pathname}${location.search}${location.hash}`,
        "inbox",
      ),
    [location.pathname, location.search, location.hash],
  );

  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: labels } = useQuery({
    queryКлюч: queryКлючs.issues.labels(selectedКомпанияId!),
    queryFn: () => issuesApi.listЯрлыки(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const isolatedРабочие областиВключитьd = experimentalНастройки?.enableIsolatedРабочие области === true;
  const { data: executionРабочие области = [] } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.executionРабочие области.summaryList(selectedКомпанияId)
      : ["execution-workspaces", "__disabled__"],
    queryFn: () => executionРабочие областиApi.listSummaries(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && isolatedРабочие областиВключитьd,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Входящие" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    saveLastВходящиеTab(tab);
    setSelectedIndex(-1);
    setПоискQuery("");
  }, [tab]);

  const previousSelectedКомпанияIdRef = useRef<string | null>(selectedКомпанияId);
  useEffect(() => {
    if (previousSelectedКомпанияIdRef.current !== selectedКомпанияId) {
      previousSelectedКомпанияIdRef.current = selectedКомпанияId;
      setФильтрPreferences(loadВходящиеФильтрPreferences(selectedКомпанияId));
      setCollapsedGroupКлючs(loadCollapsedВходящиеGroupКлючs(selectedКомпанияId));
    }
  }, [selectedКомпанияId]);

  const {
    data: approvals,
    isЗагрузка: isСогласованияЗагрузка,
    error: approvalsОшибка,
  } = useQuery({
    queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!),
    queryFn: () => approvalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const {
    data: joinRequests = [],
    isЗагрузка: isJoinRequestsЗагрузка,
  } = useQuery({
    queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId!),
    queryFn: async () => {
      try {
        return await accessApi.listJoinRequests(selectedКомпанияId!, "pending_approval");
      } catch (err) {
        if (err instanceof ApiОшибка && (err.status === 403 || err.status === 401)) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!selectedКомпанияId,
    retry: false,
  });

  const { data: dashboard, isЗагрузка: isПанель управленияЗагрузка } = useQuery({
    queryКлюч: queryКлючs.dashboard(selectedКомпанияId!),
    queryFn: () => dashboardApi.summary(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: issues, isЗагрузка: isЗадачиЗагрузка } = useQuery({
    queryКлюч: [...queryКлючs.issues.list(selectedКомпанияId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        includeПроцедураExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedКомпанияId,
  });
  const {
    data: mineЗадачиRaw = [],
    isЗагрузка: isMineЗадачиЗагрузка,
  } = useQuery({
    queryКлюч: [...queryКлючs.issues.listMineByMe(selectedКомпанияId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        touchedByUserId: "me",
        inboxАрхивированByUserId: "me",
        status: INBOX_MINE_ISSUE_STATUS_FILTER,
        includeПроцедураExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedКомпанияId,
  });
  const {
    data: touchedЗадачиRaw = [],
    isЗагрузка: isTouchedЗадачиЗагрузка,
  } = useQuery({
    queryКлюч: [...queryКлючs.issues.listTouchedByMe(selectedКомпанияId!), "with-routine-executions"],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        touchedByUserId: "me",
        status: INBOX_MINE_ISSUE_STATUS_FILTER,
        includeПроцедураExecutions: true,
        limit: INBOX_ISSUE_LIST_LIMIT,
      }),
    enabled: !!selectedКомпанияId,
  });

  const { data: heartbeatЗапуститьs, isЗагрузка: isЗапуститьsЗагрузка } = useQuery({
    queryКлюч: [...queryКлючs.heartbeats(selectedКомпанияId!), "limit", INBOX_HEARTBEAT_RUN_LIMIT],
    queryFn: () => heartbeatsApi.list(selectedКомпанияId!, undefined, INBOX_HEARTBEAT_RUN_LIMIT),
    enabled: !!selectedКомпанияId,
  });

  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
    refetchInterval: 5000,
  });
  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const currentUserId = session?.user.id ?? session?.session.userId ?? null;

  const companyUserLabelMap = useMemo(
    () => buildКомпанияUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const companyUserПрофильMap = useMemo(
    () => buildКомпанияUserПрофильMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const mineЗадачи = useMemo(() => getRecentTouchedЗадачи(mineЗадачиRaw), [mineЗадачиRaw]);
  const touchedЗадачи = useMemo(() => getRecentTouchedЗадачи(touchedЗадачиRaw), [touchedЗадачиRaw]);
  const visibleMineЗадачи = useMemo(
    () => applyЗадачаФильтрs(mineЗадачи, issueФильтрs, currentUserId, true, liveЗадачаIds),
    [mineЗадачи, issueФильтрs, currentUserId, liveЗадачаIds],
  );
  const visibleTouchedЗадачи = useMemo(
    () => applyЗадачаФильтрs(touchedЗадачи, issueФильтрs, currentUserId, true, liveЗадачаIds),
    [touchedЗадачи, issueФильтрs, currentUserId, liveЗадачаIds],
  );
  const unreadTouchedЗадачи = useMemo(
    () => visibleTouchedЗадачи.filter((issue) => issue.isUnreadForMe),
    [visibleTouchedЗадачи],
  );
  const creatorOptions = useMemo<CreatorOption[]>(() => {
    const options = new Map<string, CreatorOption>();
    const sourceЗадачи = [...mineЗадачи, ...touchedЗадачи];

    if (currentUserId) {
      options.set(`user:${currentUserId}`, {
        id: `user:${currentUserId}`,
        label: currentUserId === "local-board" ? "Совет" : "Me",
        kind: "user",
        searchText: currentUserId === "local-board" ? "board me human local-board" : `me board human ${currentUserId}`,
      });
    }

    for (const issue of sourceЗадачи) {
      if (issue.createdByUserId) {
        const id = `user:${issue.createdByUserId}`;
        if (!options.has(id)) {
          options.set(id, {
            id,
            label: formatИсполнительUserLabel(issue.createdByUserId, currentUserId) ?? issue.createdByUserId.slice(0, 5),
            kind: "user",
            searchText: `${issue.createdByUserId} board user human`,
          });
        }
      }
    }

    const knownАгентIds = new Set<string>();
    for (const agent of agents ?? []) {
      knownАгентIds.add(agent.id);
      const id = `agent:${agent.id}`;
      if (!options.has(id)) {
        options.set(id, {
          id,
          label: agent.name,
          kind: "agent",
          searchText: `${agent.name} ${agent.id} agent`,
        });
      }
    }

    for (const issue of sourceЗадачи) {
      if (issue.createdByАгентId && !knownАгентIds.has(issue.createdByАгентId)) {
        const id = `agent:${issue.createdByАгентId}`;
        if (!options.has(id)) {
          options.set(id, {
            id,
            label: issue.createdByАгентId.slice(0, 8),
            kind: "agent",
            searchText: `${issue.createdByАгентId} agent`,
          });
        }
      }
    }

    return [...options.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "user" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [agents, currentUserId, mineЗадачи, touchedЗадачи]);
  const issuesToRender = useMemo(
    () => {
      if (tab === "mine") return visibleMineЗадачи;
      if (tab === "unread") return unreadTouchedЗадачи;
      return visibleTouchedЗадачи;
    },
    [tab, visibleMineЗадачи, visibleTouchedЗадачи, unreadTouchedЗадачи],
  );

  const agentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Задача>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);
  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const project of projects ?? []) {
      map.set(project.id, { name: project.name, color: project.color });
    }
    return map;
  }, [projects]);
  const projectРабочая областьById = useMemo(() => {
    const map = new Map<string, { name: string; projectId: string }>();
    for (const project of projects ?? []) {
      for (const workspace of project.workspaces ?? []) {
        map.set(workspace.id, { name: workspace.name, projectId: project.id });
      }
    }
    return map;
  }, [projects]);
  const defaultProjectРабочая областьIdByProjectId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects ?? []) {
      const defaultРабочая областьId =
        project.executionРабочая областьPolicy?.defaultProjectРабочая областьId
        ?? project.primaryРабочая область?.id
        ?? null;
      if (defaultРабочая областьId) map.set(project.id, defaultРабочая областьId);
    }
    return map;
  }, [projects]);
  const executionРабочая областьById = useMemo(() => {
    const map = new Map<string, {
      name: string;
      mode: "shared_workspace" | "isolated_workspace" | "operator_branch" | "adapter_managed" | "cloud_sandbox";
      projectРабочая областьId: string | null;
      projectId: string | null;
    }>();
    for (const workspace of executionРабочие области) {
      const projectРабочая область = workspace.projectРабочая областьId
        ? projectРабочая областьById.get(workspace.projectРабочая областьId) ?? null
        : null;
      map.set(workspace.id, {
        name: workspace.name,
        mode: workspace.mode,
        projectРабочая областьId: workspace.projectРабочая областьId ?? null,
        projectId: projectРабочая область?.projectId ?? null,
      });
    }
    return map;
  }, [executionРабочие области, projectРабочая областьById]);
  const inboxРабочая областьGrouping = useMemo<ВходящиеРабочая областьGroupingOptions>(
    () => ({
      agentById,
      executionРабочая областьById,
      projectРабочая областьById,
      defaultProjectРабочая областьIdByProjectId,
      projectById,
      userLabelById: companyUserLabelMap,
      currentUserId,
    }),
    [
      agentById,
      companyUserLabelMap,
      currentUserId,
      defaultProjectРабочая областьIdByProjectId,
      executionРабочая областьById,
      projectById,
      projectРабочая областьById,
    ],
  );
  const visibleЗадачаColumnSet = useMemo(() => new Set(visibleЗадачаColumns), [visibleЗадачаColumns]);
  const availableЗадачаColumns = useMemo(
    () => getAvailableВходящиеЗадачаColumns(isolatedРабочие областиВключитьd),
    [isolatedРабочие областиВключитьd],
  );
  const availableЗадачаColumnSet = useMemo(() => new Set(availableЗадачаColumns), [availableЗадачаColumns]);
  const visibleTrailingЗадачаColumns = useMemo(
    () => issueTrailingColumns.filter((column) => visibleЗадачаColumnSet.has(column) && availableЗадачаColumnSet.has(column)),
    [availableЗадачаColumnSet, visibleЗадачаColumnSet],
  );

  const failedЗапуститьs = useMemo(
    () =>
      getLatestОшибкаЗапуститьsByАгент(heartbeatЗапуститьs ?? []).filter(
        (r) => !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `run:${r.id}`, r.createdAt),
      ),
    [heartbeatЗапуститьs, dismissedAtByКлюч],
  );
  const approvalsToRender = useMemo(() => {
    let filtered = getСогласованияForTab(approvals ?? [], tab, allСогласованиеФильтр, currentUserId);
    if (tab === "mine") {
      filtered = filtered.filter(
        (a) => !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `approval:${a.id}`, a.updatedAt),
      );
    }
    return filtered;
  }, [approvals, tab, allСогласованиеФильтр, currentUserId, dismissedAtByКлюч]);
  const showJoinRequestsCategory =
    allCategoryФильтр === "everything" || allCategoryФильтр === "join_requests";
  const showTouchedCategory =
    allCategoryФильтр === "everything" || allCategoryФильтр === "issues_i_touched";
  const showСогласованияCategory =
    allCategoryФильтр === "everything" || allCategoryФильтр === "approvals";
  const showОшибкаЗапуститьsCategory =
    allCategoryФильтр === "everything" || allCategoryФильтр === "failed_runs";
  const showAlertsCategory = allCategoryФильтр === "everything" || allCategoryФильтр === "alerts";
  const failedЗапуститьsForTab = useMemo(() => {
    if (tab === "all" && !showОшибкаЗапуститьsCategory) return [];
    return failedЗапуститьs;
  }, [failedЗапуститьs, tab, showОшибкаЗапуститьsCategory]);

  const joinRequestsForTab = useMemo(() => {
    if (tab === "all" && !showJoinRequestsCategory) return [];
    if (tab === "mine") {
      return joinRequests.filter(
        (jr) => !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `join:${jr.id}`, jr.updatedAt ?? jr.createdAt),
      );
    }
    return joinRequests;
  }, [joinRequests, tab, showJoinRequestsCategory, dismissedAtByКлюч]);

  const workItemsToRender = useMemo(
    () =>
      getВходящиеРаботаItems({
        issues: tab === "all" && !showTouchedCategory ? [] : issuesToRender,
        approvals: tab === "all" && !showСогласованияCategory ? [] : approvalsToRender,
        failedЗапуститьs: failedЗапуститьsForTab,
        joinRequests: joinRequestsForTab,
      }),
    [approvalsToRender, issuesToRender, showСогласованияCategory, showTouchedCategory, tab, failedЗапуститьsForTab, joinRequestsForTab],
  );

  const filteredРаботаItems = useMemo(() => {
    const q = normalizedПоискQuery.toНизкийerCase();
    if (!q) return workItemsToRender;
    return workItemsToRender.filter((item) => {
      if (item.kind === "issue") {
        return matchesВходящиеЗадачаПоиск(item.issue, q, {
          isolatedРабочие областиВключитьd,
          executionРабочая областьById,
          projectРабочая областьById,
          defaultProjectРабочая областьIdByProjectId,
        });
      }
      if (item.kind === "approval") {
        const a = item.approval;
        const label = approvalLabel(a.type, a.payload as Record<string, unknown> | null);
        if (label.toНизкийerCase().includes(q)) return true;
        if (a.type.toНизкийerCase().includes(q)) return true;
        return false;
      }
      if (item.kind === "failed_run") {
        const run = item.run;
        const name = agentById.get(run.agentId);
        if (name?.toНизкийerCase().includes(q)) return true;
        const msg = runFailureMessage(run);
        if (msg.toНизкийerCase().includes(q)) return true;
        const issueId = readЗадачаIdFromЗапустить(run);
        if (issueId) {
          const issue = issueById.get(issueId);
          if (issue?.title.toНизкийerCase().includes(q)) return true;
          if (issue?.identifier?.toНизкийerCase().includes(q)) return true;
        }
        return false;
      }
      if (item.kind === "join_request") {
        const jr = item.joinRequest;
        if (jr.agentИмя?.toНизкийerCase().includes(q)) return true;
        if (jr.capabilities?.toНизкийerCase().includes(q)) return true;
        return false;
      }
      return false;
    });
  }, [
    workItemsToRender,
    agentById,
    defaultProjectРабочая областьIdByProjectId,
    executionРабочая областьById,
    issueById,
    isolatedРабочие областиВключитьd,
    normalizedПоискQuery,
    projectРабочая областьById,
  ]);

  const archivedПоискЗадачи = useMemo(
    () =>
      tab === "mine"
        ? getАрхивированВходящиеПоискЗадачи({
          visibleЗадачи: visibleMineЗадачи,
          searchableЗадачи: visibleTouchedЗадачи,
          query: normalizedПоискQuery,
          isolatedРабочие областиВключитьd,
          executionРабочая областьById,
          projectРабочая областьById,
          defaultProjectРабочая областьIdByProjectId,
        })
        : [],
    [
      defaultProjectРабочая областьIdByProjectId,
      executionРабочая областьById,
      isolatedРабочие областиВключитьd,
      normalizedПоискQuery,
      projectРабочая областьById,
      tab,
      visibleMineЗадачи,
      visibleTouchedЗадачи,
    ],
  );
  const shouldUseЗадачаПоискSupplement =
    !!selectedКомпанияId
    && normalizedПоискQuery.length > 0;
  const { data: remoteЗадачаПоискResults = [] } = useQuery({
    queryКлюч: [
      ...queryКлючs.issues.search(selectedКомпанияId!, normalizedПоискQuery, undefined, 25),
      "inbox-supplement",
    ],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        q: normalizedПоискQuery,
        limit: 25,
        includeПроцедураExecutions: true,
      }),
    enabled: shouldUseЗадачаПоискSupplement,
    placeholderData: (previousData) => previousData,
  });
  const issueПоискSupplementResults = useMemo(
    () =>
      getВходящиеПоискSupplementЗадачи({
        query: normalizedПоискQuery,
        filteredРаботаItems,
        archivedПоискЗадачи,
        remoteЗадачи: remoteЗадачаПоискResults,
        issueФильтрs,
        currentUserId,
        enableПроцедураVisibilityФильтр: true,
        liveЗадачаIds,
      }),
    [
      archivedПоискЗадачи,
      currentUserId,
      filteredРаботаItems,
      issueФильтрs,
      liveЗадачаIds,
      normalizedПоискQuery,
      remoteЗадачаПоискResults,
    ],
  );
  const nonВходящиеПоискЗадачаIds = useMemo(
    () => new Set([
      ...archivedПоискЗадачи.map((issue) => issue.id),
      ...issueПоискSupplementResults.map((issue) => issue.id),
    ]),
    [archivedПоискЗадачи, issueПоискSupplementResults],
  );

  // --- Родитель-child nesting for inbox issues ---
  const [nestingPreferenceВключитьd, setNestingPreferenceВключитьd] = useState(() => loadВходящиеNesting());
  const nestingВключитьd = resolveВходящиеNestingВключитьd(nestingPreferenceВключитьd, isMobile);
  useEffect(() => {
    if (!shouldСброситьВходящиеРабочая областьGrouping(groupBy, isolatedРабочие областиВключитьd, experimentalНастройкиLoaded)) return;
    setGroupBy("none");
    saveВходящиеРаботаItemGroupBy("none");
  }, [experimentalНастройкиLoaded, groupBy, isolatedРабочие областиВключитьd]);
  const toggleNesting = useCallback(() => {
    setNestingPreferenceВключитьd((prev) => {
      const next = !prev;
      saveВходящиеNesting(next);
      return next;
    });
  }, []);
  const [collapsedВходящиеРодительs, setCollapsedВходящиеРодительs] = useState<Set<string>>(new Set());
  const [collapsedGroupКлючs, setCollapsedGroupКлючs] = useState<Set<string>>(() => loadCollapsedВходящиеGroupКлючs(selectedКомпанияId));
  const toggleGroupCollapse = useCallback((groupКлюч: string) => {
    setCollapsedGroupКлючs((prev) => {
      const next = new Set(prev);
      if (next.has(groupКлюч)) next.delete(groupКлюч);
      else next.add(groupКлюч);
      saveCollapsedВходящиеGroupКлючs(selectedКомпанияId, next);
      return next;
    });
  }, [selectedКомпанияId]);
  const setGroupCollapsed = useCallback((groupКлюч: string, collapsed: boolean) => {
    setCollapsedGroupКлючs((prev) => {
      if (collapsed ? prev.has(groupКлюч) : !prev.has(groupКлюч)) return prev;
      const next = new Set(prev);
      if (collapsed) next.add(groupКлюч);
      else next.delete(groupКлюч);
      saveCollapsedВходящиеGroupКлючs(selectedКомпанияId, next);
      return next;
    });
  }, [selectedКомпанияId]);
  const groupedSections = useMemo<ВходящиеGroupedSection[]>(() => [
    ...buildGroupedВходящиеSections(filteredРаботаItems, groupBy, inboxРабочая областьGrouping, { nestingВключитьd }),
    ...buildGroupedВходящиеSections(
      getВходящиеРаботаItems({ issues: archivedПоискЗадачи, approvals: [] }),
      groupBy,
      inboxРабочая областьGrouping,
      { keyPrefix: "archived-search:", searchSection: "archived", nestingВключитьd },
    ),
    ...buildGroupedВходящиеSections(
      getВходящиеРаботаItems({ issues: issueПоискSupplementResults, approvals: [] }),
      groupBy,
      inboxРабочая областьGrouping,
      { keyPrefix: "other-search:", searchSection: "other", nestingВключитьd },
    ),
  ], [
    archivedПоискЗадачи,
    filteredРаботаItems,
    groupBy,
    inboxРабочая областьGrouping,
    issueПоискSupplementResults,
    nestingВключитьd,
  ]);

  const openСоздатьЗадачаForGroup = useCallback((group: ВходящиеGroupedSection) => {
    const defaults = buildВходящиеЗадачаGroupСоздатьПо умолчаниюs(
      group.key,
      groupBy,
      group.displayItems,
      inboxРабочая областьGrouping,
    );
    if (!defaults) return;
    openNewЗадача(defaults);
  }, [groupBy, inboxРабочая областьGrouping, openNewЗадача]);
  const totalVisibleРаботаItems = useMemo(
    () => groupedSections.reduce((count, group) => count + group.displayItems.length, 0),
    [groupedSections],
  );
  const toggleВходящиеРодительCollapse = useCallback((parentId: string) => {
    setCollapsedВходящиеРодительs((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  // Build flat navigation list from visible rows so keyboard traversal respects collapsed groups.
  const flatNavItems = useMemo((): NavEntry[] => {
    return buildВходящиеКлючboardNavEntries(groupedSections, collapsedGroupКлючs, collapsedВходящиеРодительs);
  }, [collapsedGroupКлючs, collapsedВходящиеРодительs, groupedSections]);
  const topFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "top") map.set(entry.itemКлюч, index);
    });
    return map;
  }, [flatNavItems]);
  const childFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "child") map.set(entry.issueId, index);
    });
    return map;
  }, [flatNavItems]);
  const groupFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatNavItems.forEach((entry, index) => {
      if (entry.type === "group") map.set(entry.groupКлюч, index);
    });
    return map;
  }, [flatNavItems]);

  const agentИмя = (id: string | null) => {
    if (!id) return null;
    return agentById.get(id) ?? null;
  };
  const setЗадачаColumns = useCallback((next: ВходящиеЗадачаColumn[]) => {
    const normalized = normalizeВходящиеЗадачаColumns(next);
    setVisibleЗадачаColumns(normalized);
    saveВходящиеЗадачаColumns(normalized);
  }, []);
  const toggleЗадачаColumn = useCallback((column: ВходящиеЗадачаColumn, enabled: boolean) => {
    if (enabled) {
      setЗадачаColumns([...visibleЗадачаColumns, column]);
      return;
    }
    setЗадачаColumns(visibleЗадачаColumns.filter((value) => value !== column));
  }, [setЗадачаColumns, visibleЗадачаColumns]);
  const updateФильтрPreferences = useCallback(
    (updater: (previous: ВходящиеФильтрPreferences) => ВходящиеФильтрPreferences) => {
      setФильтрPreferences((previous) => {
        const next = updater(previous);
        saveВходящиеФильтрPreferences(selectedКомпанияId, next);
        return next;
      });
    },
    [selectedКомпанияId],
  );
  const updateЗадачаФильтрs = useCallback((patch: Partial<ЗадачаФильтрState>) => {
    updateФильтрPreferences((previous) => ({
      ...previous,
      issueФильтрs: { ...previous.issueФильтрs, ...patch },
    }));
  }, [updateФильтрPreferences]);
  const updateВсеCategoryФильтр = useCallback((value: ВходящиеCategoryФильтр) => {
    updateФильтрPreferences((previous) => ({ ...previous, allCategoryФильтр: value }));
  }, [updateФильтрPreferences]);
  const updateВсеСогласованиеФильтр = useCallback((value: ВходящиеСогласованиеФильтр) => {
    updateФильтрPreferences((previous) => ({ ...previous, allСогласованиеФильтр: value }));
  }, [updateФильтрPreferences]);
  const updateGroupBy = useCallback((nextGroupBy: ВходящиеРаботаItemGroupBy) => {
    setGroupBy(nextGroupBy);
    saveВходящиеРаботаItemGroupBy(nextGroupBy);
  }, []);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onУспешно: (_approval, id) => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!) });
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to reject");
    },
  });

  const approveJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.approveJoinRequest(selectedКомпанияId!, joinRequest.id),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(selectedКомпанияId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to approve join request");
    },
  });

  const rejectJoinMutation = useMutation({
    mutationFn: (joinRequest: JoinRequest) =>
      accessApi.rejectJoinRequest(selectedКомпанияId!, joinRequest.id),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId!) });
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to reject join request");
    },
  });

  const [retryingЗапуститьIds, setПовторитьingЗапуститьIds] = useState<Set<string>>(new Set());

  const retryЗапуститьMutation = useMutation({
    mutationFn: async (run: HeartbeatЗапустить) => {
      const payload: Record<string, unknown> = {};
      const context = run.contextSnapshot as Record<string, unknown> | null;
      if (context) {
        if (typeof context.issueId === "string" && context.issueId) payload.issueId = context.issueId;
        if (typeof context.taskId === "string" && context.taskId) payload.taskId = context.taskId;
        if (typeof context.taskКлюч === "string" && context.taskКлюч) payload.taskКлюч = context.taskКлюч;
      }
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload,
      });
      if (!("id" in result)) {
        throw new Ошибка(result.message ?? "Повторить was skipped.");
      }
      return { newЗапустить: result, originalЗапустить: run };
    },
    onMutate: (run) => {
      setПовторитьingЗапуститьIds((prev) => new Set(prev).add(run.id));
    },
    onУспешно: ({ newЗапустить, originalЗапустить }) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(originalЗапустить.companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(originalЗапустить.companyId, originalЗапустить.agentId) });
      navigate(`/agents/${originalЗапустить.agentId}/runs/${newЗапустить.id}`);
    },
    onSettled: (_data, _error, run) => {
      if (!run) return;
      setПовторитьingЗапуститьIds((prev) => {
        const next = new Set(prev);
        next.delete(run.id);
        return next;
      });
    },
  });

  const [fadingOutЗадачи, setFadingOutЗадачи] = useState<Set<string>>(new Set());
  const [showMarkВсеReadПодтвердить, setShowMarkВсеReadПодтвердить] = useState(false);
  const [archivingЗадачаIds, setArchivingЗадачаIds] = useState<Set<string>>(new Set());
  const [undoableАрхивироватьЗадачаIds, setUndoableАрхивироватьЗадачаIds] = useState<string[]>([]);
  const [unarchivingЗадачаIds, setUnarchivingЗадачаIds] = useState<Set<string>>(new Set());
  const [fadingНетnЗадачаItems, setFadingНетnЗадачаItems] = useState<Set<string>>(new Set());
  const [archivingНетnЗадачаIds, setArchivingНетnЗадачаIds] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const invalidateВходящиеЗадачаQueries = () => {
    if (!selectedКомпанияId) return;
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listMineByMe(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listUnreadTouchedByMe(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId) });
  };

  const archiveЗадачаMutation = useMutation({
    mutationFn: (id: string) => issuesApi.archiveFromВходящие(id),
    onMutate: async (id) => {
      setActionОшибка(null);
      setArchivingЗадачаIds((prev) => new Set(prev).add(id));

      // Отмена in-flight refetches so they don't overwrite our optimistic update
      const queryКлючs_ = [
        [...queryКлючs.issues.listMineByMe(selectedКомпанияId!), "with-routine-executions"],
        [...queryКлючs.issues.listTouchedByMe(selectedКомпанияId!), "with-routine-executions"],
        queryКлючs.issues.listUnreadTouchedByMe(selectedКомпанияId!),
      ];
      await Promise.all(queryКлючs_.map((qk) => queryClient.cancelQueries({ queryКлюч: qk })));

      // Snapshot previous data for rollback
      const previousData = queryКлючs_.map((qk) => [qk, queryClient.getQueryData(qk)] as const);

      // Optimistically remove the issue from all inbox query caches
      for (const qk of queryКлючs_) {
        queryClient.setQueryData(qk, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.filter((issue: { id: string }) => issue.id !== id);
        });
      }

      return { previousData };
    },
    onОшибка: (err, id, context) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to archive issue");
      setArchivingЗадачаIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Restore previous query data on failure
      if (context?.previousData) {
        for (const [qk, data] of context.previousData) {
          queryClient.setQueryData(qk, data);
        }
      }
    },
    onSettled: (_data, _error, id) => {
      // Clean up archiving state and refetch to sync with server
      setArchivingЗадачаIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateВходящиеЗадачаQueries();
    },
    onУспешно: (_data, id) => {
      setUndoableАрхивироватьЗадачаIds((prev) => [...prev.filter((issueId) => issueId !== id), id]);
    },
  });

  const unarchiveЗадачаMutation = useMutation({
    mutationFn: (id: string) => issuesApi.unarchiveFromВходящие(id),
    onMutate: (id) => {
      setActionОшибка(null);
      setUnarchivingЗадачаIds((prev) => new Set(prev).add(id));
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to undo inbox archive");
    },
    onУспешно: (_data, id) => {
      setUndoableАрхивироватьЗадачаIds((prev) => {
        const next = prev.filter((issueId) => issueId !== id);
        return next;
      });
    },
    onSettled: (_data, _error, id) => {
      setUnarchivingЗадачаIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateВходящиеЗадачаQueries();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onMutate: (id) => {
      setFadingOutЗадачи((prev) => new Set(prev).add(id));
    },
    onУспешно: () => {
      invalidateВходящиеЗадачаQueries();
    },
    onSettled: (_data, _error, id) => {
      setTimeout(() => {
        setFadingOutЗадачи((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    },
  });

  const markВсеReadMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      await Promise.all(issueIds.map((issueId) => issuesApi.markRead(issueId)));
    },
    onMutate: (issueIds) => {
      setFadingOutЗадачи((prev) => {
        const next = new Set(prev);
        for (const issueId of issueIds) next.add(issueId);
        return next;
      });
    },
    onУспешно: () => {
      invalidateВходящиеЗадачаQueries();
    },
    onSettled: (_data, _error, issueIds) => {
      setTimeout(() => {
        setFadingOutЗадачи((prev) => {
          const next = new Set(prev);
          for (const issueId of issueIds) next.delete(issueId);
          return next;
        });
      }, 300);
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markUnread(id),
    onУспешно: () => {
      invalidateВходящиеЗадачаQueries();
    },
  });

  const handleMarkНетnЗадачаRead = useCallback((key: string) => {
    setFadingНетnЗадачаItems((prev) => new Set(prev).add(key));
    markItemRead(key);
    setTimeout(() => {
      setFadingНетnЗадачаItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 300);
  }, [markItemRead]);

  const handleАрхивироватьНетnЗадача = useCallback((key: string) => {
    setArchivingНетnЗадачаIds((prev) => new Set(prev).add(key));
    setTimeout(() => {
      if (key.startsWith("alert:")) {
        dismissAlert(key);
      } else {
        dismissВходящиеItem(key);
      }
      setArchivingНетnЗадачаIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 200);
  }, [dismissAlert, dismissВходящиеItem]);

  const nonЗадачаUnreadState = (key: string): НетnЗадачаUnreadState => {
    if (!canАрхивироватьFromTab) return null;
    const isRead = readItems.has(key);
    const isFading = fadingНетnЗадачаItems.has(key);
    if (isFading) return "fading";
    if (!isRead) return "visible";
    return "hidden";
  };

  // Keep selection valid when the list shape changes, but do not auto-select on initial load.
  useEffect(() => {
    setSelectedIndex((prev) => resolveВходящиеSelectionIndex(prev, flatNavItems.length));
  }, [flatNavItems.length]);

  useEffect(() => {
    setUndoableАрхивироватьЗадачаIds([]);
    setUnarchivingЗадачаIds(new Set());
  }, [selectedКомпанияId]);

  // Use refs for keyboard handler to avoid stale closures
  const kbStateRef = useRef({
    workItems: groupedSections,
    flatNavItems,
    selectedIndex,
    canАрхивировать: canАрхивироватьFromTab,
    nonВходящиеПоискЗадачаIds,
    archivingЗадачаIds,
    undoableАрхивироватьЗадачаIds,
    unarchivingЗадачаIds,
    archivingНетnЗадачаIds,
    fadingOutЗадачи,
    readItems,
  });
  kbStateRef.current = {
    workItems: groupedSections,
    flatNavItems,
    selectedIndex,
    canАрхивировать: canАрхивироватьFromTab,
    nonВходящиеПоискЗадачаIds,
    archivingЗадачаIds,
    undoableАрхивироватьЗадачаIds,
    unarchivingЗадачаIds,
    archivingНетnЗадачаIds,
    fadingOutЗадачи,
    readItems,
  };

  const kbActionsRef = useRef({
    archiveЗадача: (id: string) => archiveЗадачаMutation.mutate(id),
    undoАрхивироватьЗадача: (id: string) => unarchiveЗадачаMutation.mutate(id),
    archiveНетnЗадача: handleАрхивироватьНетnЗадача,
    markRead: (id: string) => markReadMutation.mutate(id),
    markUnreadЗадача: (id: string) => markUnreadMutation.mutate(id),
    markНетnЗадачаRead: handleMarkНетnЗадачаRead,
    markНетnЗадачаUnread: markItemUnread,
    setGroupCollapsed,
    navigate,
  });
  kbActionsRef.current = {
    archiveЗадача: (id: string) => archiveЗадачаMutation.mutate(id),
    undoАрхивироватьЗадача: (id: string) => unarchiveЗадачаMutation.mutate(id),
    archiveНетnЗадача: handleАрхивироватьНетnЗадача,
    markRead: (id: string) => markReadMutation.mutate(id),
    markUnreadЗадача: (id: string) => markUnreadMutation.mutate(id),
    markНетnЗадачаRead: handleMarkНетnЗадачаRead,
    markНетnЗадачаUnread: markItemUnread,
    setGroupCollapsed,
    navigate,
  };

  // Ключboard shortcuts (mail-client style) — single stable listener using refs
  useEffect(() => {
    if (!keyboardShortcutsВключитьd) return;

    const handleКлючDown = (e: КлючboardEvent) => {
      if (e.defaultPrevented) return;

      // Don't capture when typing in inputs/textareas or with modifier keys
      const target = e.target;
      if (
        !(target instanceof HTMLElement) ||
        isКлючboardShortcutTextInputЦель(target) ||
        hasBlockingShortcutDialog(document) ||
        e.metaКлюч ||
        e.ctrlКлюч ||
        e.altКлюч
      ) {
        return;
      }

      const st = kbStateRef.current;
      const act = kbActionsRef.current;

      // Ключboard shortcuts are only active on the "mine" tab
      if (!st.canАрхивировать) return;

      const undoАрхивироватьAction = resolveВходящиеUndoАрхивироватьКлючAction({
        hasUndoableАрхивировать: st.undoableАрхивироватьЗадачаIds.length > 0,
        defaultPrevented: e.defaultPrevented,
        key: e.key,
        metaКлюч: e.metaКлюч,
        ctrlКлюч: e.ctrlКлюч,
        altКлюч: e.altКлюч,
        target,
        hasOpenDialog: hasBlockingShortcutDialog(document),
      });
      if (undoАрхивироватьAction === "undo_archive") {
        const issueId = st.undoableАрхивироватьЗадачаIds[st.undoableАрхивироватьЗадачаIds.length - 1];
        if (!issueId || st.unarchivingЗадачаIds.has(issueId)) return;
        e.preventПо умолчанию();
        act.undoАрхивироватьЗадача(issueId);
        return;
      }

      const navItems = st.flatNavItems;
      const navCount = navItems.length;
      if (navCount === 0) return;

      /** Resolve the nav entry at selectedIndex to an issue (for child entries) or work item. */
      const resolveNavEntry = (idx: number): { issue?: Задача; item?: ВходящиеРаботаItem } => {
        const entry = navItems[idx];
        if (!entry) return {};
        if (entry.type === "child") return { issue: entry.issue };
        if (entry.type === "top") return { item: entry.item };
        return {};
      };

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventПо умолчанию();
          setSelectedIndex((prev) => getВходящиеКлючboardSelectionIndex(prev, navCount, "next"));
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventПо умолчанию();
          setSelectedIndex((prev) => getВходящиеКлючboardSelectionIndex(prev, navCount, "previous"));
          break;
        }
        case "ArrowLeft":
        case "ArrowRight": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          const entry = navItems[st.selectedIndex];
          if (!entry || entry.type !== "group") return;
          e.preventПо умолчанию();
          act.setGroupCollapsed(entry.groupКлюч, e.key === "ArrowLeft");
          break;
        }
        case "a":
        case "y": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventПо умолчанию();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            if (!st.nonВходящиеПоискЗадачаIds.has(issue.id) && !st.archivingЗадачаIds.has(issue.id)) act.archiveЗадача(issue.id);
          } else if (item) {
            if (item.kind === "issue") {
              if (!st.nonВходящиеПоискЗадачаIds.has(item.issue.id) && !st.archivingЗадачаIds.has(item.issue.id)) {
                act.archiveЗадача(item.issue.id);
              }
            } else {
              const key = getВходящиеРаботаItemКлюч(item);
              if (!st.archivingНетnЗадачаIds.has(key)) act.archiveНетnЗадача(key);
            }
          }
          break;
        }
        case "U": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventПо умолчанию();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            act.markUnreadЗадача(issue.id);
          } else if (item) {
            if (item.kind === "issue") act.markUnreadЗадача(item.issue.id);
            else act.markНетnЗадачаUnread(getВходящиеРаботаItemКлюч(item));
          }
          break;
        }
        case "r": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventПо умолчанию();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            if (issue.isUnreadForMe && !st.fadingOutЗадачи.has(issue.id)) act.markRead(issue.id);
          } else if (item) {
            if (item.kind === "issue") {
              if (item.issue.isUnreadForMe && !st.fadingOutЗадачи.has(item.issue.id)) act.markRead(item.issue.id);
            } else {
              const key = getВходящиеРаботаItemКлюч(item);
              if (!st.readItems.has(key)) act.markНетnЗадачаRead(key);
            }
          }
          break;
        }
        case "Enter": {
          if (st.selectedIndex < 0 || st.selectedIndex >= navCount) return;
          e.preventПо умолчанию();
          const { issue, item } = resolveNavEntry(st.selectedIndex);
          if (issue) {
            const pathId = issue.identifier ?? issue.id;
            const detailState = armЗадачаDetailВходящиеQuickАрхивировать(withЗадачаDetailHeaderSeed(issueLinkState, issue));
            rememberЗадачаDetailLocationState(pathId, detailState);
            void prefetchЗадачаDetail(queryClient, pathId, { issue });
            act.navigate(createЗадачаDetailПуть(pathId), { state: detailState });
          } else if (item) {
            if (item.kind === "issue") {
              const pathId = item.issue.identifier ?? item.issue.id;
              const detailState = armЗадачаDetailВходящиеQuickАрхивировать(
                withЗадачаDetailHeaderSeed(issueLinkState, item.issue),
              );
              rememberЗадачаDetailLocationState(pathId, detailState);
              void prefetchЗадачаDetail(queryClient, pathId, { issue: item.issue });
              act.navigate(createЗадачаDetailПуть(pathId), { state: detailState });
            } else if (item.kind === "approval") {
              act.navigate(`/approvals/${item.approval.id}`);
            } else if (item.kind === "failed_run") {
              act.navigate(`/agents/${item.run.agentId}/runs/${item.run.id}`);
            }
          }
          break;
        }
        default:
          return;
      }
    };
    window.addEventListener("keydown", handleКлючDown);
    return () => window.removeEventListener("keydown", handleКлючDown);
  }, [issueLinkState, keyboardShortcutsВключитьd]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const rows = listRef.current.querySelectorВсе("[data-inbox-item]");
    const row = rows[selectedIndex];
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!selectedКомпанияId) {
    return <EmptyState icon={ВходящиеIcon} message="Select a company to view inbox." />;
  }

  const hasЗапуститьFailures = failedЗапуститьs.length > 0;
  const showКомпанияAlerts = shouldShowКомпанияAlerts(tab) && showAlertsCategory;
  const showAggregateАгентОшибка =
    showКомпанияAlerts &&
    !!dashboard &&
    dashboard.agents.error > 0 &&
    !hasЗапуститьFailures &&
    !dismissedAlerts.has("alert:agent-errors");
  const showБюджетAlert =
    showКомпанияAlerts &&
    !!dashboard &&
    dashboard.costs.monthБюджетCents > 0 &&
    dashboard.costs.monthUtilizationPercent >= 80 &&
    !dismissedAlerts.has("alert:budget");
  const hasAlerts = showAggregateАгентОшибка || showБюджетAlert;
  const showРаботаItemsSection = totalVisibleРаботаItems > 0;
  const showAlertsSection = shouldShowВходящиеSection({
    tab,
    hasItems: hasAlerts,
    showOnMine: false,
    showOnRecent: false,
    showOnUnread: false,
    showOnВсе: hasAlerts,
  });

  const visibleSections = [
    showAlertsSection ? "alerts" : null,
    showРаботаItemsSection ? "work_items" : null,
  ].filter((key): key is SectionКлюч => key !== null);

  const allLoaded =
    !isJoinRequestsЗагрузка &&
    !isСогласованияЗагрузка &&
    !isПанель управленияЗагрузка &&
    !isЗадачиЗагрузка &&
    !isMineЗадачиЗагрузка &&
    !isTouchedЗадачиЗагрузка &&
    !isЗапуститьsЗагрузка;

  const showSeparatorBefore = (key: SectionКлюч) => visibleSections.indexOf(key) > 0;
  const markВсеReadЗадачи = (tab === "mine" ? visibleMineЗадачи : unreadTouchedЗадачи)
    .filter((issue) => issue.isUnreadForMe && !fadingOutЗадачи.has(issue.id) && !archivingЗадачаIds.has(issue.id));
  const unreadЗадачаIds = markВсеReadЗадачи
    .map((issue) => issue.id);
  const canMarkВсеRead = unreadЗадачаIds.length > 0;
  const activeЗадачаФильтрCount = countАктивенЗадачаФильтрs(issueФильтрs, true);
  return (
    <div classИмя="space-y-6">
      <div classИмя="space-y-2">
        {/* Поиск — full-width row on mobile, inline on desktop */}
        <div classИмя="relative sm:hidden">
          <Поиск classИмя="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск inbox…"
            value={searchQuery}
            onChange={(e) => setПоискQuery(e.target.value)}
            onКлючDown={(e) => {
              if (shouldBlurPageПоискOnEnter({
                key: e.key,
                isComposing: e.nativeEvent.isComposing,
              })) {
                e.currentЦель.blur();
                return;
              }

              if (shouldBlurPageПоискOnEscape({
                key: e.key,
                isComposing: e.nativeEvent.isComposing,
                currentЗначение: e.currentЦель.value,
              })) {
                e.currentЦель.blur();
              }
            }}
            classИмя="h-8 w-full pl-8 text-xs"
            data-page-search-target="true"
          />
        </div>
        <div classИмя="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onЗначениеChange={(value) => navigate(`/inbox/${value}`)}>
          <PageTabBar
            items={[
              {
                value: "mine",
                label: "Mine",
              },
              {
                value: "recent",
                label: "Recent",
              },
              { value: "unread", label: "Unread" },
              { value: "all", label: "Все" },
            ]}
          />
        </Tabs>

        <div classИмя="flex items-center gap-2">
          <div classИмя="relative hidden sm:block">
            <Поиск classИмя="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск inbox…"
              value={searchQuery}
              onChange={(e) => setПоискQuery(e.target.value)}
              onКлючDown={(e) => {
                if (shouldBlurPageПоискOnEnter({
                  key: e.key,
                  isComposing: e.nativeEvent.isComposing,
                })) {
                  e.currentЦель.blur();
                  return;
                }

                if (shouldBlurPageПоискOnEscape({
                  key: e.key,
                  isComposing: e.nativeEvent.isComposing,
                  currentЗначение: e.currentЦель.value,
                })) {
                  e.currentЦель.blur();
                }
              }}
              classИмя="h-8 w-[220px] pl-8 text-xs"
              data-page-search-target="true"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            classИмя={cn("hidden h-8 w-8 shrink-0 sm:inline-flex", nestingВключитьd && "bg-accent")}
            onClick={toggleNesting}
            title={nestingВключитьd ? "Отключить parent-child nesting" : "Включить parent-child nesting"}
          >
            <ListTree classИмя="h-3.5 w-3.5" />
          </Button>
          <ЗадачаФильтрsPopover
            state={issueФильтрs}
            onChange={updateЗадачаФильтрs}
            activeФильтрCount={activeЗадачаФильтрCount}
            agents={agents}
            creators={creatorOptions}
            projects={projects?.map((project) => ({ id: project.id, name: project.name }))}
            labels={labels?.map((label) => ({ id: label.id, name: label.name, color: label.color }))}
            currentUserId={currentUserId}
            enableПроцедураVisibilityФильтр
            buttonVariant="outline"
            iconOnly
            workspaces={isolatedРабочие областиВключитьd ? executionРабочие области.filter((w) => w.mode === "isolated_workspace").map((w) => ({ id: w.id, name: w.name })) : undefined}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                classИмя={cn("h-8 w-8 shrink-0", groupBy !== "none" && "bg-accent")}
                title="Group"
              >
                <Layers classИмя="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" classИмя="w-40 p-2">
              <div classИмя="space-y-0.5">
                {([
                  ["none", "Нет"],
                  ["type", "Тип"],
                  ["assignee", "Исполнитель"],
                  ["project", "Project"],
                  ...(isolatedРабочие областиВключитьd ? ([["workspace", "Рабочая область"]] as const) : []),
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    classИмя={cn(
                      "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm",
                      groupBy === value ? "bg-accent/50 text-foreground" : "text-muted-foreground hover:bg-accent/50",
                    )}
                    onClick={() => updateGroupBy(value)}
                  >
                    <span>{label}</span>
                    {groupBy === value ? <Check classИмя="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <ЗадачаColumnPicker
            availableColumns={availableЗадачаColumns}
            visibleColumnSet={visibleЗадачаColumnSet}
            onToggleColumn={toggleЗадачаColumn}
            onСброситьColumns={() => setЗадачаColumns(DEFAULT_INBOX_ISSUE_COLUMNS)}
            title="Choose which inbox columns stay visible"
            iconOnly
          />
          {canMarkВсеRead && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                classИмя="h-8 shrink-0"
                onClick={() => setShowMarkВсеReadПодтвердить(true)}
                disabled={markВсеReadMutation.isОжидание}
              >
                {markВсеReadMutation.isОжидание ? "Marking…" : "Mark all as read"}
              </Button>
              <Dialog open={showMarkВсеReadПодтвердить} onOpenChange={setShowMarkВсеReadПодтвердить}>
                <DialogContent classИмя="sm:max-w-md">
                  <DialogHeader>
                    <DialogНазвание>Mark all as read?</DialogНазвание>
                    <DialogОписание>
                      This will mark {unreadЗадачаIds.length} unread {unreadЗадачаIds.length === 1 ? "item" : "items"} as read.
                    </DialogОписание>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowMarkВсеReadПодтвердить(false)}>
                      Отмена
                    </Button>
                    <Button
                      onClick={() => {
                        setShowMarkВсеReadПодтвердить(false);
                        markВсеReadMutation.mutate(unreadЗадачаIds);
                      }}
                    >
                      Mark all as read
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
        </div>
      </div>

      {tab === "all" && (
        <div classИмя="flex flex-wrap items-center gap-2">
          <Select
            value={allCategoryФильтр}
            onЗначениеChange={(value) => updateВсеCategoryФильтр(value as ВходящиеCategoryФильтр)}
          >
            <SelectTrigger classИмя="h-8 w-[170px] text-xs">
              <SelectЗначение placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everything">Все categories</SelectItem>
              <SelectItem value="issues_i_touched">My recent issues</SelectItem>
              <SelectItem value="join_requests">Join requests</SelectItem>
              <SelectItem value="approvals">Согласования</SelectItem>
              <SelectItem value="failed_runs">Ошибка runs</SelectItem>
              <SelectItem value="alerts">Alerts</SelectItem>
            </SelectContent>
          </Select>

          {showСогласованияCategory && (
            <Select
              value={allСогласованиеФильтр}
              onЗначениеChange={(value) => updateВсеСогласованиеФильтр(value as ВходящиеСогласованиеФильтр)}
            >
              <SelectTrigger classИмя="h-8 w-[170px] text-xs">
                <SelectЗначение placeholder="Согласование status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все approval statuses</SelectItem>
                <SelectItem value="actionable">Needs action</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {approvalsОшибка && <p classИмя="text-sm text-destructive">{approvalsОшибка.message}</p>}
      {actionОшибка && <p classИмя="text-sm text-destructive">{actionОшибка}</p>}

      {!allLoaded && visibleSections.length === 0 && (
        <PageSkeleton variant="inbox" />
      )}

      {allLoaded && visibleSections.length === 0 && (
        <EmptyState
          icon={searchQuery.trim() ? Поиск : ВходящиеIcon}
          message={
            searchQuery.trim()
              ? "Нет inbox items match your search."
              : tab === "mine"
              ? "Входящие пусты."
              : tab === "unread"
              ? "Нет новых входящих."
              : tab === "recent"
                ? "Нет recent inbox items."
                : "Нет inbox items match these filters."
          }
        />
      )}

      {showРаботаItemsSection && (
        <>
          {showSeparatorBefore("work_items") && <Separator />}
          <div>
            <div ref={listRef} classИмя="overflow-hidden rounded-xl">
              {(() => {
                const renderВходящиеЗадача = ({
                  issue,
                  depth,
                  selected,
                  hasChildren = false,
                  isExpanded = false,
                  childCount = 0,
                  collapseРодительId = null,
                  allowАрхивировать = canАрхивироватьFromTab,
                }: {
                  issue: Задача;
                  depth: number;
                  selected: boolean;
                  hasChildren?: boolean;
                  isExpanded?: boolean;
                  childCount?: number;
                  collapseРодительId?: string | null;
                  allowАрхивировать?: boolean;
                }) => {
                  const isUnread = issue.isUnreadForMe && !fadingOutЗадачи.has(issue.id);
                  const isFading = fadingOutЗадачи.has(issue.id);
                  const isArchiving = archivingЗадачаIds.has(issue.id);
                  const project = issue.projectId ? projectById.get(issue.projectId) ?? null : null;
                  const assigneeUserПрофиль = issue.assigneeUserId
                    ? companyUserПрофильMap.get(issue.assigneeUserId) ?? null
                    : null;
                  return (
                    <ЗадачаRow
                      key={`issue:${issue.id}`}
                      issue={issue}
                      issueLinkState={issueLinkState}
                      selected={selected}
                      classИмя={
                        isArchiving
                          ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                          : "transition-all duration-200 ease-out"
                      }
                      desktopMetaLeading={
                        <>
                          {nestingВключитьd ? (
                            depth === 0 && hasChildren && collapseРодительId ? (
                              <button
                                type="button"
                                classИмя="hidden w-4 shrink-0 items-center justify-center sm:inline-flex"
                                onClick={(event) => {
                                  event.preventПо умолчанию();
                                  event.stopPropagation();
                                  toggleВходящиеРодительCollapse(collapseРодительId);
                                }}
                              >
                                <ChevronRight classИмя={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                              </button>
                            ) : (
                              <span classИмя="hidden w-4 shrink-0 sm:block" />
                            )
                          ) : null}
                          {depth > 0 ? <span classИмя="hidden w-4 shrink-0 sm:block" /> : null}
                          <ВходящиеЗадачаMetaLeading
                            issue={issue}
                            isLive={liveЗадачаIds.has(issue.id)}
                            showСтатус={visibleЗадачаColumnSet.has("status") && availableЗадачаColumnSet.has("status")}
                            showIdentifier={visibleЗадачаColumnSet.has("id") && availableЗадачаColumnSet.has("id")}
                          />
                        </>
                      }
                      titleSuffix={hasChildren && !isExpanded && depth === 0 ? (
                        <span classИмя="ml-1.5 text-xs text-muted-foreground">
                          ({childCount} sub-task{childCount !== 1 ? "s" : ""})
                        </span>
                      ) : undefined}
                      mobileMeta={issueАктивностьText(issue).toНизкийerCase()}
                      mobileLeading={
                        depth === 0 && hasChildren && collapseРодительId ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventПо умолчанию();
                              event.stopPropagation();
                              toggleВходящиеРодительCollapse(collapseРодительId);
                            }}
                          >
                            <ChevronRight classИмя={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                          </button>
                        ) : undefined
                      }
                      unreadState={isUnread ? "visible" : isFading ? "fading" : "hidden"}
                      onMarkRead={() => markReadMutation.mutate(issue.id)}
                      onАрхивировать={allowАрхивировать ? () => archiveЗадачаMutation.mutate(issue.id) : undefined}
                      archiveОтключитьd={isArchiving || archiveЗадачаMutation.isОжидание}
                      desktopTrailing={
                        visibleTrailingЗадачаColumns.length > 0 ? (
                          <ВходящиеЗадачаTrailingColumns
                            issue={issue}
                            columns={visibleTrailingЗадачаColumns}
                            projectИмя={project?.name ?? null}
                            projectColor={project?.color ?? null}
                            workspaceИмя={resolveЗадачаРабочая областьИмя(issue, {
                              executionРабочая областьById,
                              projectРабочая областьById,
                              defaultProjectРабочая областьIdByProjectId,
                            })}
                            assigneeИмя={agentИмя(issue.assigneeАгентId)}
                            assigneeUserИмя={
                              formatИсполнительUserLabel(issue.assigneeUserId, currentUserId, companyUserLabelMap)
                              ?? assigneeUserПрофиль?.label
                              ?? null
                            }
                            assigneeUserAvatarUrl={assigneeUserПрофиль?.image ?? null}
                            currentUserId={currentUserId}
                            parentIdentifier={issue.parentId ? (issueById.get(issue.parentId)?.identifier ?? null) : null}
                            parentНазвание={issue.parentId ? (issueById.get(issue.parentId)?.title ?? null) : null}
                          />
                        ) : undefined
                      }
                    />
                  );
                };

                let previousTimestamp = Number.POSITIVE_INFINITY;
                return groupedSections.flatMap((group, groupIndex) => {
                  const elements: ReactНетde[] = [];
                  const isGroupCollapsed = collapsedGroupКлючs.has(group.key);
                  if (
                    group.searchSection !== "none"
                    && group.searchSection !== groupedSections[groupIndex - 1]?.searchSection
                  ) {
                    elements.push(
                      <div
                        key={`${group.searchSection}-search-divider`}
                        classИмя="flex items-center gap-3 border-y border-border/70 bg-muted/30 px-4 py-2"
                      >
                        <div classИмя="h-px flex-1 bg-border/80" />
                        <span classИмя="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.searchSection === "archived" ? "Архивирован" : "Other results"}
                        </span>
                        <div classИмя="h-px flex-1 bg-border/80" />
                      </div>,
                    );
                  }
                  if (group.label) {
                    const groupNavIdx = groupFlatIndex.get(group.key) ?? -1;
                    const isGroupSelected = groupNavIdx >= 0 && selectedIndex === groupNavIdx;
                    const canСоздатьЗадачаInGroup = group.displayItems.some((item) => item.kind === "issue");
                    elements.push(
                      <div
                        key={`group-${group.key}`}
                        data-inbox-item
                        classИмя={cn(
                          "px-3 sm:px-4",
                          groupIndex > 0 && "pt-2",
                          isGroupSelected && "bg-accent/50",
                        )}
                        onClick={() => {
                          if (groupNavIdx >= 0) setSelectedIndex(groupNavIdx);
                        }}
                      >
                        <ЗадачаGroupHeader
                          label={group.label}
                          collapsible
                          collapsed={isGroupCollapsed}
                          onToggle={() => toggleGroupCollapse(group.key)}
                          trailing={canСоздатьЗадачаInGroup ? (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              classИмя="-mr-2 text-muted-foreground"
                              title={`Новая задача in ${group.label}`}
                              aria-label={`Новая задача in ${group.label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openСоздатьЗадачаForGroup(group);
                              }}
                            >
                              <Plus classИмя="h-3 w-3" />
                            </Button>
                          ) : null}
                        />
                      </div>,
                    );
                  }
                  if (isGroupCollapsed) return elements;

                  for (let index = 0; index < group.displayItems.length; index += 1) {
                    const item = group.displayItems[index]!;
                    const navIdx = topFlatIndex.get(`${group.key}:${getВходящиеРаботаItemКлюч(item)}`) ?? 0;
                    const wrapItem = (key: string, isSelected: boolean, child: ReactНетde) => (
                      <div
                        key={`sel-${key}`}
                        data-inbox-item
                        classИмя="relative"
                        onClick={() => setSelectedIndex(navIdx)}
                      >
                        {child}
                      </div>
                    );
                    const todayCutoff = Date.now() - 24 * 60 * 60 * 1000;
                    const showСегодняDivider =
                      groupBy === "none" &&
                      item.timestamp > 0 &&
                      item.timestamp < todayCutoff &&
                      previousTimestamp >= todayCutoff;
                    previousTimestamp = item.timestamp > 0 ? item.timestamp : previousTimestamp;
                    if (showСегодняDivider) {
                      elements.push(
                        <div key={`today-divider-${group.key}-${index}`} classИмя="my-2 flex items-center gap-3 px-4">
                          <div classИмя="flex-1 border-t border-zinc-600" />
                          <span classИмя="shrink-0 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Earlier
                          </span>
                        </div>,
                      );
                    }
                    const isSelected = selectedIndex === navIdx;

                    if (item.kind === "approval") {
                      const approvalКлюч = `approval:${item.approval.id}`;
                      const isArchiving = archivingНетnЗадачаIds.has(approvalКлюч);
                      const row = (
                        <СогласованиеВходящиеRow
                          key={approvalКлюч}
                          approval={item.approval}
                          selected={isSelected}
                          requesterИмя={agentИмя(item.approval.requestedByАгентId)}
                          onОдобрить={() => approveMutation.mutate(item.approval.id)}
                          onОтклонить={() => rejectMutation.mutate(item.approval.id)}
                          isОжидание={approveMutation.isОжидание || rejectMutation.isОжидание}
                          unreadState={nonЗадачаUnreadState(approvalКлюч)}
                          onMarkRead={() => handleMarkНетnЗадачаRead(approvalКлюч)}
                          onАрхивировать={canАрхивироватьFromTab ? () => handleАрхивироватьНетnЗадача(approvalКлюч) : undefined}
                          archiveОтключитьd={isArchiving}
                          classИмя={
                            isArchiving
                              ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                              : "transition-all duration-200 ease-out"
                          }
                        />
                      );
                      elements.push(wrapItem(approvalКлюч, isSelected, canАрхивироватьFromTab ? (
                        <SwipeToАрхивировать
                          key={approvalКлюч}
                          selected={isSelected}
                          disabled={isArchiving}
                          onАрхивировать={() => handleАрхивироватьНетnЗадача(approvalКлюч)}
                        >
                          {row}
                        </SwipeToАрхивировать>
                      ) : row));
                      continue;
                    }

                    if (item.kind === "failed_run") {
                      const runКлюч = `run:${item.run.id}`;
                      const isArchiving = archivingНетnЗадачаIds.has(runКлюч);
                      const row = (
                        <ОшибкаЗапуститьВходящиеRow
                          key={runКлюч}
                          run={item.run}
                          selected={isSelected}
                          issueById={issueById}
                          agentИмя={agentИмя(item.run.agentId)}
                          issueLinkState={issueLinkState}
                          onЗакрыть={() => dismissВходящиеItem(runКлюч)}
                          onПовторить={() => retryЗапуститьMutation.mutate(item.run)}
                          isПовторитьing={retryingЗапуститьIds.has(item.run.id)}
                          unreadState={nonЗадачаUnreadState(runКлюч)}
                          onMarkRead={() => handleMarkНетnЗадачаRead(runКлюч)}
                          onАрхивировать={canАрхивироватьFromTab ? () => handleАрхивироватьНетnЗадача(runКлюч) : undefined}
                          archiveОтключитьd={isArchiving}
                          classИмя={
                            isArchiving
                              ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                              : "transition-all duration-200 ease-out"
                          }
                        />
                      );
                      elements.push(wrapItem(runКлюч, isSelected, canАрхивироватьFromTab ? (
                        <SwipeToАрхивировать
                          key={runКлюч}
                          selected={isSelected}
                          disabled={isArchiving}
                          onАрхивировать={() => handleАрхивироватьНетnЗадача(runКлюч)}
                        >
                          {row}
                        </SwipeToАрхивировать>
                      ) : row));
                      continue;
                    }

                    if (item.kind === "join_request") {
                      const joinКлюч = `join:${item.joinRequest.id}`;
                      const isArchiving = archivingНетnЗадачаIds.has(joinКлюч);
                      const row = (
                        <JoinRequestВходящиеRow
                          key={joinКлюч}
                          joinRequest={item.joinRequest}
                          selected={isSelected}
                          onОдобрить={() => approveJoinMutation.mutate(item.joinRequest)}
                          onОтклонить={() => rejectJoinMutation.mutate(item.joinRequest)}
                          isОжидание={approveJoinMutation.isОжидание || rejectJoinMutation.isОжидание}
                          unreadState={nonЗадачаUnreadState(joinКлюч)}
                          onMarkRead={() => handleMarkНетnЗадачаRead(joinКлюч)}
                          onАрхивировать={canАрхивироватьFromTab ? () => handleАрхивироватьНетnЗадача(joinКлюч) : undefined}
                          archiveОтключитьd={isArchiving}
                          classИмя={
                            isArchiving
                              ? "pointer-events-none -translate-x-4 scale-[0.98] opacity-0 transition-all duration-200 ease-out"
                              : "transition-all duration-200 ease-out"
                          }
                        />
                      );
                      elements.push(wrapItem(joinКлюч, isSelected, canАрхивироватьFromTab ? (
                        <SwipeToАрхивировать
                          key={joinКлюч}
                          selected={isSelected}
                          disabled={isArchiving}
                          onАрхивировать={() => handleАрхивироватьНетnЗадача(joinКлюч)}
                        >
                          {row}
                        </SwipeToАрхивировать>
                      ) : row));
                      continue;
                    }

                    const issue = item.issue;
                    const childЗадачи = group.childrenByЗадачаId.get(issue.id) ?? [];
                    const hasChildren = childЗадачи.length > 0;
                    const isExpanded = hasChildren && !collapsedВходящиеРодительs.has(issue.id);
                    const canАрхивироватьЗадача = canАрхивироватьFromTab && group.searchSection === "none";
                    const renderChildЗадачаRows = (
                      children: Задача[],
                      depth: number,
                      seen: ReadonlySet<string>,
                    ): ReactНетde[] =>
                      children.flatMap((child) => {
                        if (seen.has(child.id)) return [];
                        const nextSeen = new Set(seen);
                        nextSeen.add(child.id);
                        const childNavIdx = childFlatIndex.get(child.id) ?? -1;
                        const isChildSelected = selectedIndex === childNavIdx;
                        const grandchildЗадачи = group.childrenByЗадачаId.get(child.id) ?? [];
                        const childHasChildren = grandchildЗадачи.length > 0;
                        const childIsExpanded = childHasChildren && !collapsedВходящиеРодительs.has(child.id);
                        const childRow = renderВходящиеЗадача({
                          issue: child,
                          depth,
                          selected: isChildSelected,
                          hasChildren: childHasChildren,
                          isExpanded: childIsExpanded,
                          childCount: grandchildЗадачи.length,
                          collapseРодительId: child.id,
                          allowАрхивировать: canАрхивироватьЗадача,
                        });
                        const isChildArchiving = archivingЗадачаIds.has(child.id);
                        const row = (
                          <div
                            key={`sel-issue:${child.id}`}
                            data-inbox-item
                            classИмя="relative"
                            onClick={() => setSelectedIndex(childNavIdx)}
                          >
                            {canАрхивироватьЗадача ? (
                              <SwipeToАрхивировать
                                key={`issue:${child.id}`}
                                selected={isChildSelected}
                                disabled={isChildArchiving || archiveЗадачаMutation.isОжидание}
                                onАрхивировать={() => archiveЗадачаMutation.mutate(child.id)}
                              >
                                {childRow}
                              </SwipeToАрхивировать>
                            ) : childRow}
                          </div>
                        );

                        return childIsExpanded
                          ? [row, ...renderChildЗадачаRows(grandchildЗадачи, depth + 1, nextSeen)]
                          : [row];
                      });
                    const parentRow = renderВходящиеЗадача({
                      issue,
                      depth: 0,
                      selected: isSelected,
                      hasChildren,
                      isExpanded,
                      childCount: childЗадачи.length,
                      collapseРодительId: issue.id,
                      allowАрхивировать: canАрхивироватьЗадача,
                    });

                    elements.push(wrapItem(`issue:${issue.id}`, isSelected, canАрхивироватьЗадача ? (
                      <SwipeToАрхивировать
                        key={`issue:${issue.id}`}
                        selected={isSelected}
                        disabled={archivingЗадачаIds.has(issue.id) || archiveЗадачаMutation.isОжидание}
                        onАрхивировать={() => archiveЗадачаMutation.mutate(issue.id)}
                      >
                        {parentRow}
                      </SwipeToАрхивировать>
                    ) : parentRow));

                    if (isExpanded) {
                      elements.push(...renderChildЗадачаRows(childЗадачи, 1, new Set([issue.id])));
                    }
                  }

                  return elements;
                });
              })()}
            </div>
          </div>
        </>
      )}

      {showAlertsSection && (
        <>
          {showSeparatorBefore("alerts") && <Separator />}
          <div>
            <h3 classИмя="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Alerts
            </h3>
            <div classИмя="divide-y divide-border border border-border">
              {showAggregateАгентОшибка && (
                <div classИмя="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                  <Link
                    to="/agents"
                    classИмя="flex flex-1 cursor-pointer items-center gap-3 no-underline text-inherit"
                  >
                    <AlertTriangle classИмя="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span classИмя="text-sm">
                      <span classИмя="font-medium">{dashboard!.agents.error}</span>{" "}
                      {dashboard!.agents.error === 1 ? "agent has" : "agents have"} errors
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissAlert("alert:agent-errors")}
                    classИмя="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/alert:opacity-100"
                    aria-label="Закрыть"
                  >
                    <X classИмя="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {showБюджетAlert && (
                <div classИмя="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                  <Link
                    to="/costs"
                    classИмя="flex flex-1 cursor-pointer items-center gap-3 no-underline text-inherit"
                  >
                    <AlertTriangle classИмя="h-4 w-4 shrink-0 text-yellow-400" />
                    <span classИмя="text-sm">
                      Бюджет at{" "}
                      <span classИмя="font-medium">{dashboard!.costs.monthUtilizationPercent}%</span>{" "}
                      utilization this month
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismissAlert("alert:budget")}
                    classИмя="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/alert:opacity-100"
                    aria-label="Закрыть"
                  >
                    <X classИмя="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
