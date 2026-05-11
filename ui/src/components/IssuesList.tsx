import { startTransition, useDeferredЗначение, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { accessApi } from "../api/access";
import { useDialogActions } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { Link } from "@/lib/router";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { issuesApi } from "../api/issues";
import { authApi } from "../api/auth";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { queryКлючs } from "../lib/queryКлючs";
import {
  shouldBlurPageПоискOnEnter,
  shouldBlurPageПоискOnEscape,
} from "../lib/keyboardShortcuts";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { buildКомпанияUserLabelMap, buildКомпанияUserПрофильMap } from "../lib/company-members";
import { createЗадачаDetailПуть, withЗадачаDetailHeaderSeed } from "../lib/issueDetailBreadcrumb";
import {
  buildSubЗадачаProgressSummary,
  shouldRenderSubЗадачаProgressSummary,
  type SubЗадачаProgressSummary,
} from "../lib/issue-detail-subissues";
import { groupBy } from "../lib/groupBy";
import {
  applyЗадачаФильтрs,
  countАктивенЗадачаФильтрs,
  defaultЗадачаФильтрState,
  issueФильтрLabel,
  issueПриоритетOrder,
  normalizeЗадачаФильтрState,
  resolveЗадачаФильтрРабочая областьId,
  shouldIncludeЗадачаФильтрРабочая областьOption,
  issueСтатусOrder,
  type ЗадачаФильтрState,
} from "../lib/issue-filters";
import {
  DEFAULT_INBOX_ISSUE_COLUMNS,
  getAvailableВходящиеЗадачаColumns,
  normalizeВходящиеЗадачаColumns,
  resolveЗадачаРабочая областьИмя,
  type ВходящиеЗадачаColumn,
} from "../lib/inbox";
import { cn, formatDurationMs, formatТокенs } from "../lib/utils";
import {
  ВходящиеЗадачаMetaLeading,
  ВходящиеЗадачаTrailingColumns,
  ЗадачаColumnPicker,
  issueАктивностьText,
  issueTrailingColumns,
} from "./ЗадачаColumns";
import { СтатусIcon } from "./СтатусIcon";
import { EmptyState } from "./EmptyState";
import { Identity } from "./Identity";
import { ЗадачаGroupHeader } from "./ЗадачаGroupHeader";
import { ЗадачаФильтрsPopover } from "./ЗадачаФильтрsPopover";
import { ЗадачаRow } from "./ЗадачаRow";
import { PageSkeleton } from "./PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CircleDot, Plus, ArrowUpDown, Layers, Check, ChevronRight, List, ListTree, Columns3, User, Поиск, CircleSlash2 } from "lucide-react";
import { KanbanСовет } from "./KanbanСовет";
import { buildЗадачаTree, countDescendants } from "../lib/issue-tree";
import { buildSubЗадачаПо умолчаниюsForViewer } from "../lib/subЗадачаПо умолчаниюs";
import { statusBadge } from "../lib/status-colors";
import { workflowСортировка } from "../lib/workflow-sort";
import { isУспешноfulЗапуститьHandoffОбязательно } from "../lib/successful-run-handoff";
import { ISSUE_STATUSES, type Задача, type ЗадачаСтатус, type Project } from "@paperclipai/shared";
const ISSUE_SEARCH_DEBOUNCE_MS = 250;
const ISSUE_SEARCH_RESULT_LIMIT = 200;
const ISSUE_BOARD_COLUMN_RESULT_LIMIT = 200;
const INITIAL_ISSUE_ROW_RENDER_LIMIT = 100;
const ISSUE_ROW_RENDER_BATCH_SIZE = 150;
const ISSUE_SCROLL_LOAD_THRESHOLD_PX = 320;

function findЗадачиScrollContainer(element: HTMLElement | null): HTMLElement | null {
  if (!element || typeof window === "undefined") return null;
  let current = element.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
const boardЗадачаСтатусes = ISSUE_STATUSES;
const issueСтатусЯрлыки: Record<ЗадачаСтатус, string> = {
  backlog: "Назадlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Готово",
  blocked: "Заблокирован",
  cancelled: "Отменён",
};
const progressSegmentClasses: Record<ЗадачаСтатус, string> = {
  backlog: "bg-muted-foreground/40",
  todo: "bg-blue-500",
  in_progress: "bg-yellow-500",
  in_review: "bg-violet-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
  cancelled: "bg-neutral-400",
};

/* ── View state ── */

export type ЗадачаСортировкаField = "status" | "priority" | "title" | "created" | "updated" | "workflow";

export type ЗадачаViewState = ЗадачаФильтрState & {
  sortField: ЗадачаСортировкаField;
  sortDir: "asc" | "desc";
  groupBy: "status" | "priority" | "assignee" | "project" | "workspace" | "parent" | "none";
  viewMode: "list" | "board";
  nestingВключитьd: boolean;
  collapsedGroups: string[];
  collapsedРодительs: string[];
};

const defaultViewState: ЗадачаViewState = {
  ...defaultЗадачаФильтрState,
  sortField: "updated",
  sortDir: "desc",
  groupBy: "none",
  viewMode: "list",
  nestingВключитьd: true,
  collapsedGroups: [],
  collapsedРодительs: [],
};

function getViewState(key: string): ЗадачаViewState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultViewState, ...parsed, ...normalizeЗадачаФильтрState(parsed) };
    }
  } catch { /* ignore */ }
  return { ...defaultViewState };
}

function saveViewState(key: string, state: ЗадачаViewState) {
  localStorage.setItem(key, JSON.stringify(state));
}

function getInitialViewState(
  key: string,
  initialИсполнители?: string[],
  defaultСортировкаField?: ЗадачаСортировкаField,
): ЗадачаViewState {
  const hasStored = hasStoredViewState(key);
  const stored = getViewState(key);
  const base = !hasStored && defaultСортировкаField
    ? { ...stored, sortField: defaultСортировкаField, sortDir: "asc" as const }
    : stored;
  if (!initialИсполнители) return base;
  return {
    ...base,
    assignees: initialИсполнители,
    statuses: [],
  };
}

function getInitialРабочая областьViewState(
  key: string,
  initialИсполнители?: string[],
  initialРабочие области?: string[],
  defaultСортировкаField?: ЗадачаСортировкаField,
): ЗадачаViewState {
  const stored = getInitialViewState(key, initialИсполнители, defaultСортировкаField);
  if (!initialРабочие области) return stored;
  return {
    ...stored,
    workspaces: initialРабочие области,
    statuses: [],
  };
}

function hasStoredViewState(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function getЗадачаColumnsStorageКлюч(key: string): string {
  return `${key}:issue-columns`;
}

function loadЗадачаColumns(key: string): ВходящиеЗадачаColumn[] {
  try {
    const raw = localStorage.getItem(getЗадачаColumnsStorageКлюч(key));
    if (raw === null) return DEFAULT_INBOX_ISSUE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INBOX_ISSUE_COLUMNS;
    return normalizeВходящиеЗадачаColumns(parsed);
  } catch {
    return DEFAULT_INBOX_ISSUE_COLUMNS;
  }
}

function saveЗадачаColumns(key: string, columns: ВходящиеЗадачаColumn[]) {
  try {
    localStorage.setItem(
      getЗадачаColumnsStorageКлюч(key),
      JSON.stringify(normalizeВходящиеЗадачаColumns(columns)),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

function sortЗадачи(issues: Задача[], state: ЗадачаViewState): Задача[] {
  if (state.sortField === "workflow") {
    const ordered = workflowСортировка(issues);
    return state.sortDir === "desc" ? [...ordered].reverse() : ordered;
  }
  const sorted = [...issues];
  const dir = state.sortDir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (state.sortField) {
      case "status":
        return dir * (issueСтатусOrder.indexOf(a.status) - issueСтатусOrder.indexOf(b.status));
      case "priority":
        return dir * (issueПриоритетOrder.indexOf(a.priority) - issueПриоритетOrder.indexOf(b.priority));
      case "title":
        return dir * a.title.localeCompare(b.title);
      case "created":
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "updated":
        return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      default:
        return 0;
    }
  });
  return sorted;
}

function issueMatchesLocalПоиск(issue: Задача, normalizedПоиск: string): boolean {
  if (!normalizedПоиск) return true;
  return [
    issue.identifier,
    issue.title,
    issue.description,
  ].some((value) => value?.toНизкийerCase().includes(normalizedПоиск));
}

function isActionableРаботаflowСтатус(status: ЗадачаСтатус): boolean {
  return status !== "done" && status !== "cancelled" && status !== "blocked";
}

function buildChecklistStepNumberMap(issues: Задача[], nestingВключитьd: boolean): Map<string, string> {
  const stepNumberByЗадачаId = new Map<string, string>();

  if (!nestingВключитьd) {
    issues.forEach((issue, index) => {
      stepNumberByЗадачаId.set(issue.id, String(index + 1));
    });
    return stepNumberByЗадачаId;
  }

  const { roots, childMap } = buildЗадачаTree(issues);
  const visit = (siblings: Задача[], prefix: string | null) => {
    siblings.forEach((issue, index) => {
      const stepNumber = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      stepNumberByЗадачаId.set(issue.id, stepNumber);
      visit(childMap.get(issue.id) ?? [], stepNumber);
    });
  };
  visit(roots, null);

  issues.forEach((issue, index) => {
    if (!stepNumberByЗадачаId.has(issue.id)) {
      stepNumberByЗадачаId.set(issue.id, String(index + 1));
    }
  });

  return stepNumberByЗадачаId;
}

function buildPreviousSiblingЗадачаIdMap(issues: Задача[], nestingВключитьd: boolean): Map<string, string> {
  const previousSiblingByЗадачаId = new Map<string, string>();

  if (!nestingВключитьd) {
    const previousByРодительId = new Map<string, Задача>();
    for (const issue of issues) {
      if (!issue.parentId) continue;
      const previousSibling = previousByРодительId.get(issue.parentId);
      if (previousSibling) {
        previousSiblingByЗадачаId.set(issue.id, previousSibling.id);
      }
      previousByРодительId.set(issue.parentId, issue);
    }
    return previousSiblingByЗадачаId;
  }

  const { roots, childMap } = buildЗадачаTree(issues);
  const visit = (siblings: Задача[]) => {
    siblings.forEach((issue, index) => {
      const previousSibling = index > 0 ? siblings[index - 1] : null;
      if (issue.parentId && previousSibling?.parentId === issue.parentId) {
        previousSiblingByЗадачаId.set(issue.id, previousSibling.id);
      }
      visit(childMap.get(issue.id) ?? []);
    });
  };
  visit(roots);

  return previousSiblingByЗадачаId;
}

function shouldSuppressSinglePreviousSiblingBlockerChip(
  issue: Задача,
  unresolvedVisibleBlockerIds: string[],
  previousSiblingЗадачаId: string | undefined,
): boolean {
  return Boolean(
    issue.parentId
      && previousSiblingЗадачаId
      && (issue.blockedBy ?? []).length === 1
      && unresolvedVisibleBlockerIds.length === 1
      && unresolvedVisibleBlockerIds[0] === previousSiblingЗадачаId,
  );
}

/* ── Component ── */

interface Агент {
  id: string;
  name: string;
}

type CreatorOption = {
  id: string;
  label: string;
  kind: "agent" | "user";
  searchText?: string;
};

type ProjectOption = Pick<Project, "id" | "name"> & Partial<Pick<Project, "color" | "workspaces" | "executionРабочая областьPolicy" | "primaryРабочая область">>;
type ЗадачаListRequestФильтрs = НетnNullable<Parameters<typeof issuesApi.list>[1]>;

interface ЗадачиListProps {
  issues: Задача[];
  isЗагрузка?: boolean;
  error?: Ошибка | null;
  agents?: Агент[];
  projects?: ProjectOption[];
  liveЗадачаIds?: Set<string>;
  projectId?: string;
  viewStateКлюч: string;
  issueLinkState?: unknown;
  initialИсполнители?: string[];
  initialРабочие области?: string[];
  initialПоиск?: string;
  searchФильтрs?: Omit<ЗадачаListRequestФильтрs, "q" | "projectId" | "limit" | "includeПроцедураExecutions">;
  searchWithinLoadedЗадачи?: boolean;
  baseСоздатьЗадачаПо умолчаниюs?: Record<string, unknown>;
  createЗадачаLabel?: string;
  defaultСортировкаField?: ЗадачаСортировкаField;
  showProgressSummary?: boolean;
  /**
   * When set together with `showProgressSummary`, the progress strip fetches
   * the recursive cost-summary for this parent issue and renders aggregate
   * tokens + wall-clock runtime for every run in the tree.
   */
  parentЗадачаIdForCostSummary?: string;
  enableПроцедураVisibilityФильтр?: boolean;
  hasMoreЗадачи?: boolean;
  isЗагрузкаMoreЗадачи?: boolean;
  mutedЗадачаIds?: Set<string>;
  issueBadgeById?: Map<string, string>;
  onLoadMoreЗадачи?: () => void;
  onПоискChange?: (search: string) => void;
  onОбновитьЗадача: (id: string, data: Record<string, unknown>) => void;
}

function ЗадачаПоискInput({
  value,
  onDebouncedChange,
}: {
  value: string;
  onDebouncedChange?: (search: string) => void;
}) {
  const [draftЗначение, setЧерновикЗначение] = useState(value);
  const lastCommittedЗначениеRef = useRef(value);

  useEffect(() => {
    setЧерновикЗначение(value);
    lastCommittedЗначениеRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!onDebouncedChange || draftЗначение === lastCommittedЗначениеRef.current) return;

    const timeoutId = window.setTimeout(() => {
      lastCommittedЗначениеRef.current = draftЗначение;
      startTransition(() => {
        onDebouncedChange(draftЗначение);
      });
    }, ISSUE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [draftЗначение, onDebouncedChange]);

  return (
    <div classИмя="relative w-48 sm:w-64 md:w-80">
      <Поиск classИмя="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draftЗначение}
        onChange={(e) => {
          setЧерновикЗначение(e.target.value);
        }}
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
        placeholder="Поиск issues..."
        classИмя="pl-7 text-xs sm:text-sm"
        aria-label="Поиск issues"
        data-page-search-target="true"
      />
    </div>
  );
}

function SubЗадачаProgressSummaryStrip({
  summary,
  issueLinkState,
  parentЗадачаIdForCostSummary,
}: {
  summary: SubЗадачаProgressSummary;
  issueLinkState?: unknown;
  parentЗадачаIdForCostSummary?: string;
}) {
  const target = summary.target;
  const targetЗадача = target?.issue ?? null;
  const targetПутьId = targetЗадача?.identifier ?? targetЗадача?.id ?? "";
  const targetState = targetЗадача ? withЗадачаDetailHeaderSeed(issueLinkState, targetЗадача) : undefined;
  const statusEntries = ISSUE_STATUSES
    .map((status) => ({ status, count: summary.countsByСтатус[status] ?? 0 }))
    .filter((entry) => entry.count > 0);

  // Обновить fast enough that the runtime ticks up while a sub-issue is still
  // running, but slow enough not to hammer the recursive CTE on idle trees.
  const hasInProgress = summary.inProgressCount > 0;
  const { data: costSummary } = useQuery({
    queryКлюч: queryКлючs.issues.costSummary(parentЗадачаIdForCostSummary ?? "pending", { excludeRoot: true }),
    queryFn: () => issuesApi.getCostSummary(parentЗадачаIdForCostSummary!, { excludeRoot: true }),
    enabled: !!parentЗадачаIdForCostSummary,
    refetchInterval: hasInProgress ? 5_000 : false,
  });

  const totalТокенs = costSummary
    ? costSummary.inputТокенs + costSummary.cachedInputТокенs + costSummary.outputТокенs
    : 0;
  const showCostSummary = !!costSummary && (costSummary.runCount > 0 || totalТокенs > 0);

  return (
    <div classИмя="border border-border bg-background p-3">
      <div classИмя="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div classИмя="min-w-0 flex-1 space-y-2">
          <div classИмя="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span classИмя="font-medium text-foreground">
              {summary.doneCount}/{summary.totalCount} done
            </span>
            <span classИмя="text-muted-foreground">
              {summary.inProgressCount} in progress
            </span>
            <span classИмя="text-muted-foreground">
              {summary.blockedCount} blocked
            </span>
            {showCostSummary && (
              <>
                <span
                  classИмя="text-muted-foreground tabular-nums"
                  title={`${costSummary.runCount.toLocaleString()} run${
                    costSummary.runCount === 1 ? "" : "s"
                  } across ${costSummary.issueCount} sub-issue${
                    costSummary.issueCount === 1 ? "" : "s"
                  }`}
                >
                  {formatТокенs(totalТокенs)} tokens
                </span>
                <span classИмя="text-muted-foreground tabular-nums">
                  {formatDurationMs(costSummary.runtimeMs)} runtime
                </span>
              </>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Подзадачи completion progress"
            aria-valuemin={0}
            aria-valuenow={summary.doneCount}
            aria-valuemax={summary.totalCount}
            classИмя="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            {statusEntries.map(({ status, count }) => (
              <span
                key={status}
                classИмя={cn("h-full", progressSegmentClasses[status])}
                style={{ width: `${(count / summary.totalCount) * 100}%` }}
                title={`${issueСтатусЯрлыки[status]}: ${count}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div classИмя="min-w-0 border border-border bg-background px-3 py-2 text-sm lg:w-72">
          {target && targetЗадача ? (
            <>
              <div classИмя="text-xs font-medium text-muted-foreground">
                {target.kind === "next" ? "Далее up" : "Waiting on blockers"}
              </div>
              <Link
                to={createЗадачаDetailПуть(targetПутьId)}
                state={targetState}
                issuePrefetch={targetЗадача}
                classИмя="mt-1 block min-w-0 text-foreground underline-offset-2 hover:underline"
              >
                <span classИмя="font-mono text-xs text-muted-foreground">
                  {targetЗадача.identifier ?? targetЗадача.id.slice(0, 8)}
                </span>{" "}
                <span>{targetЗадача.title}</span>
              </Link>
            </>
          ) : summary.totalCount === 0 ? (
            <div classИмя="text-sm font-medium text-foreground">Нет active sub-issues</div>
          ) : summary.doneCount === summary.totalCount ? (
            <div classИмя="text-sm font-medium text-foreground">Все sub-issues done</div>
          ) : (
            <div classИмя="text-sm font-medium text-foreground">Нет actionable sub-issues</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ЗадачиList({
  issues,
  isЗагрузка,
  error,
  agents,
  projects,
  liveЗадачаIds,
  projectId,
  viewStateКлюч,
  issueLinkState,
  initialИсполнители,
  initialРабочие области,
  initialПоиск,
  searchФильтрs,
  searchWithinLoadedЗадачи = false,
  baseСоздатьЗадачаПо умолчаниюs,
  createЗадачаLabel,
  defaultСортировкаField,
  showProgressSummary = false,
  parentЗадачаIdForCostSummary,
  enableПроцедураVisibilityФильтр = false,
  hasMoreЗадачи = false,
  isЗагрузкаMoreЗадачи = false,
  mutedЗадачаIds,
  issueBadgeById,
  onLoadMoreЗадачи,
  onПоискChange,
  onОбновитьЗадача,
}: ЗадачиListProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { selectedКомпанияId } = useКомпания();
  const { openNewЗадача } = useDialogActions();
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const isolatedРабочие областиВключитьd = experimentalНастройки?.enableIsolatedРабочие области === true;

  // Область the storage key per company so folding/view state is independent across companies.
  const scopedКлюч = selectedКомпанияId ? `${viewStateКлюч}:${selectedКомпанияId}` : viewStateКлюч;
  const initialИсполнителиКлюч = initialИсполнители?.join("|") ?? "";
  const initialРабочие областиКлюч = initialРабочие области?.join("|") ?? "";

  const [viewState, setViewState] = useState<ЗадачаViewState>(() =>
    getInitialРабочая областьViewState(scopedКлюч, initialИсполнители, initialРабочие области, defaultСортировкаField),
  );
  const [assigneePickerЗадачаId, setИсполнительPickerЗадачаId] = useState<string | null>(null);
  const [assigneeПоиск, setИсполнительПоиск] = useState("");
  const [issueПоиск, setЗадачаПоиск] = useState(initialПоиск ?? "");
  const [renderedЗадачаRowLimit, setRenderedЗадачаRowLimit] = useState(INITIAL_ISSUE_ROW_RENDER_LIMIT);
  const [visibleЗадачаColumns, setVisibleЗадачаColumns] = useState<ВходящиеЗадачаColumn[]>(() => loadЗадачаColumns(scopedКлюч));
  const renderedЗадачаIdsRef = useRef("");
  const initialServerFillRequestedRef = useRef(false);
  const deferredЗадачаПоиск = useDeferredЗначение(issueПоиск);
  const normalizedЗадачаПоиск = deferredЗадачаПоиск.trim().toНизкийerCase();

  useEffect(() => {
    setЗадачаПоиск(initialПоиск ?? "");
  }, [initialПоиск]);

  // Reload view state whenever the persisted context changes.
  const prevViewStateContextКлюч = useRef(`${scopedКлюч}::${initialИсполнителиКлюч}::${initialРабочие областиКлюч}`);
  useEffect(() => {
    const nextContextКлюч = `${scopedКлюч}::${initialИсполнителиКлюч}::${initialРабочие областиКлюч}`;
    if (prevViewStateContextКлюч.current !== nextContextКлюч) {
      prevViewStateContextКлюч.current = nextContextКлюч;
      setViewState(getInitialРабочая областьViewState(scopedКлюч, initialИсполнители, initialРабочие области, defaultСортировкаField));
    }
  }, [scopedКлюч, initialИсполнители, initialИсполнителиКлюч, initialРабочие области, initialРабочие областиКлюч, defaultСортировкаField]);

  const prevColumnsОбластьdКлюч = useRef(scopedКлюч);
  useEffect(() => {
    if (prevColumnsОбластьdКлюч.current !== scopedКлюч) {
      prevColumnsОбластьdКлюч.current = scopedКлюч;
      setVisibleЗадачаColumns(loadЗадачаColumns(scopedКлюч));
    }
  }, [scopedКлюч]);

  const updateView = useCallback((patch: Partial<ЗадачаViewState>) => {
    setViewState((prev) => {
      const next = { ...prev, ...patch };
      saveViewState(scopedКлюч, next);
      return next;
    });
  }, [scopedКлюч]);

  // Prune stale IDs from collapsedРодительs whenever the issue list changes.
  // Удалитьd or reassigned issues leave orphan IDs in localStorage; this keeps
  // the stored array bounded to only current parent IDs.
  useEffect(() => {
    const parentIds = new Set(issues.map((i) => i.parentId).filter(Boolean) as string[]);
    const pruned = viewState.collapsedРодительs.filter((id) => parentIds.has(id));
    if (pruned.length !== viewState.collapsedРодительs.length) {
      updateView({ collapsedРодительs: pruned });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const { data: searchedЗадачи = [] } = useQuery({
    queryКлюч: [
      ...queryКлючs.issues.search(selectedКомпанияId!, normalizedЗадачаПоиск, projectId),
      searchФильтрs ?? {},
      ISSUE_SEARCH_RESULT_LIMIT,
      enableПроцедураVisibilityФильтр ? "with-routine-executions" : "without-routine-executions",
    ],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        q: normalizedЗадачаПоиск,
        projectId,
        limit: ISSUE_SEARCH_RESULT_LIMIT,
        ...searchФильтрs,
        ...(enableПроцедураVisibilityФильтр ? { includeПроцедураExecutions: true } : {}),
      }),
    enabled: !!selectedКомпанияId && normalizedЗадачаПоиск.length > 0 && !searchWithinLoadedЗадачи,
    placeholderData: (previousData) => previousData,
  });
  const boardЗадачаQueries = useQueries({
    queries: boardЗадачаСтатусes.map((status) => ({
      queryКлюч: [
        ...queryКлючs.issues.list(selectedКомпанияId ?? "__no-company__"),
        "board-column",
        status,
        normalizedЗадачаПоиск,
        projectId ?? "__all-projects__",
        searchФильтрs ?? {},
        ISSUE_BOARD_COLUMN_RESULT_LIMIT,
        enableПроцедураVisibilityФильтр ? "with-routine-executions" : "without-routine-executions",
      ],
      queryFn: () =>
        issuesApi.list(selectedКомпанияId!, {
          ...searchФильтрs,
          ...(normalizedЗадачаПоиск.length > 0 ? { q: normalizedЗадачаПоиск } : {}),
          projectId,
          status,
          limit: ISSUE_BOARD_COLUMN_RESULT_LIMIT,
          ...(enableПроцедураVisibilityФильтр ? { includeПроцедураExecutions: true } : {}),
        }),
      enabled: !!selectedКомпанияId && viewState.viewMode === "board" && !searchWithinLoadedЗадачи,
      placeholderData: (previousData: Задача[] | undefined) => previousData,
    })),
  });
  const { data: executionРабочие области = [] } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.executionРабочие области.summaryList(selectedКомпанияId)
      : ["execution-workspaces", "__disabled__"],
    queryFn: () => executionРабочие областиApi.listSummaries(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && isolatedРабочие областиВключитьd,
  });

  const agentИмя = useCallback((id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  }, [agents]);

  const companyUserLabelMap = useMemo(
    () => buildКомпанияUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const companyUserПрофильMap = useMemo(
    () => buildКомпанияUserПрофильMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const project of projects ?? []) {
      map.set(project.id, { name: project.name, color: project.color ?? null });
    }
    return map;
  }, [projects]);

  const projectРабочая областьById = useMemo(() => {
    const map = new Map<string, { name: string; projectId: string }>();
    for (const project of projects ?? []) {
      for (const workspace of project.workspaces ?? []) {
        map.set(workspace.id, { name: workspace.name || project.name, projectId: project.id });
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
  const defaultProjectРабочая областьIds = useMemo(
    () => new Set(defaultProjectРабочая областьIdByProjectId.values()),
    [defaultProjectРабочая областьIdByProjectId],
  );

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
  const issueФильтрРабочая областьContext = useMemo(() => ({
    executionРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  }), [defaultProjectРабочая областьIdByProjectId, executionРабочая областьById]);

  const workspaceИмяMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [workspaceId, workspace] of projectРабочая областьById) {
      if (!shouldIncludeЗадачаФильтрРабочая областьOption({ id: workspaceId }, defaultProjectРабочая областьIds)) continue;
      map.set(workspaceId, workspace.name);
    }
    for (const [workspaceId, workspace] of executionРабочая областьById) {
      if (!shouldIncludeЗадачаФильтрРабочая областьOption({
        id: workspaceId,
        mode: workspace.mode,
        projectРабочая областьId: workspace.projectРабочая областьId,
      }, defaultProjectРабочая областьIds)) continue;
      map.set(workspaceId, workspace.name);
    }
    return map;
  }, [defaultProjectРабочая областьIds, executionРабочая областьById, projectРабочая областьById]);

  const workspaceOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const [workspaceId, workspaceИмя] of workspaceИмяMap) {
      options.set(workspaceId, workspaceИмя);
    }
    return [...options.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [workspaceИмяMap]);

  const creatorOptions = useMemo<CreatorOption[]>(() => {
    const options = new Map<string, CreatorOption>();
    const knownАгентIds = new Set<string>();

    if (currentUserId) {
      options.set(`user:${currentUserId}`, {
        id: `user:${currentUserId}`,
        label: currentUserId === "local-board" ? "Совет" : "Me",
        kind: "user",
        searchText: currentUserId === "local-board" ? "board me human local-board" : `me board human ${currentUserId}`,
      });
    }

    for (const issue of issues) {
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

    for (const issue of issues) {
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
  }, [agents, currentUserId, issues]);

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

  const issueById = useMemo(() => {
    const map = new Map<string, Задача>();
    for (const issue of issues) {
      map.set(issue.id, issue);
    }
    return map;
  }, [issues]);

  const issueНазваниеMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      map.set(issue.id, issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title);
    }
    return map;
  }, [issues]);

  const boardЗадачи = useMemo(() => {
    if (viewState.viewMode !== "board" || searchWithinLoadedЗадачи) return null;
    const merged = new Map<string, Задача>();
    let isОжидание = false;
    for (const query of boardЗадачаQueries) {
      isОжидание ||= query.isОжидание;
      for (const issue of query.data ?? []) {
        merged.set(issue.id, issue);
      }
    }
    if (merged.size > 0) return [...merged.values()];
    return isОжидание ? issues : [];
  }, [boardЗадачаQueries, issues, searchWithinLoadedЗадачи, viewState.viewMode]);
  const boardColumnLimitReached = useMemo(
    () =>
      viewState.viewMode === "board" &&
      !searchWithinLoadedЗадачи &&
      boardЗадачаQueries.some((query) => (query.data?.length ?? 0) === ISSUE_BOARD_COLUMN_RESULT_LIMIT),
    [boardЗадачаQueries, searchWithinLoadedЗадачи, viewState.viewMode],
  );

  const filtered = useMemo(() => {
    const useRemoteПоиск = normalizedЗадачаПоиск.length > 0 && !searchWithinLoadedЗадачи;
    const sourceЗадачи = boardЗадачи ?? (useRemoteПоиск ? searchedЗадачи : issues);
    const searchОбластьdЗадачи = normalizedЗадачаПоиск.length > 0 && searchWithinLoadedЗадачи
      ? sourceЗадачи.filter((issue) => issueMatchesLocalПоиск(issue, normalizedЗадачаПоиск))
      : sourceЗадачи;
    const filteredByControls = applyЗадачаФильтрs(
      searchОбластьdЗадачи,
      viewState,
      currentUserId,
      enableПроцедураVisibilityФильтр,
      liveЗадачаIds,
      issueФильтрРабочая областьContext,
    );
    return sortЗадачи(filteredByControls, viewState);
  }, [
    boardЗадачи,
    issues,
    searchedЗадачи,
    searchWithinLoadedЗадачи,
    viewState,
    normalizedЗадачаПоиск,
    currentUserId,
    enableПроцедураVisibilityФильтр,
    liveЗадачаIds,
    issueФильтрРабочая областьContext,
  ]);

  const progressSummary = useMemo(
    () => shouldRenderSubЗадачаProgressSummary(showProgressSummary, issues.length)
      ? buildSubЗадачаProgressSummary(issues)
      : null,
    [issues, showProgressSummary],
  );
  const checklistAffordanceВключитьd = useMemo(
    () =>
      defaultСортировкаField === "workflow"
      && viewState.groupBy === "none",
    [defaultСортировкаField, viewState.groupBy],
  );
  const workflowChecklistMeta = useMemo(() => {
    if (!checklistAffordanceВключитьd) return null;

    const visibleЗадачаIds = new Set(filtered.map((issue) => issue.id));
    const stepNumberByЗадачаId = buildChecklistStepNumberMap(filtered, viewState.nestingВключитьd);
    const previousSiblingЗадачаIdByЗадачаId = buildPreviousSiblingЗадачаIdMap(filtered, viewState.nestingВключитьd);
    const unresolvedVisibleBlockersByЗадачаId = new Map<string, string[]>();

    filtered.forEach((issue) => {
      const unresolvedVisible = (issue.blockedBy ?? [])
        .map((blocker) => blocker.id)
        .filter((blockerId) => {
          if (!visibleЗадачаIds.has(blockerId)) return false;
          const blockerЗадача = issueById.get(blockerId);
          if (!blockerЗадача) return false;
          return blockerЗадача.status !== "done" && blockerЗадача.status !== "cancelled";
        });
      const shouldSuppressChip = shouldSuppressSinglePreviousSiblingBlockerChip(
        issue,
        unresolvedVisible,
        previousSiblingЗадачаIdByЗадачаId.get(issue.id),
      );
      unresolvedVisibleBlockersByЗадачаId.set(issue.id, shouldSuppressChip ? [] : unresolvedVisible);
    });

    const firstActionable = filtered.find((issue) => isActionableРаботаflowСтатус(issue.status)) ?? null;
    const currentStepЗадача = firstActionable ?? filtered.find((issue) => issue.status === "blocked") ?? null;

    return {
      stepNumberByЗадачаId,
      unresolvedVisibleBlockersByЗадачаId,
      currentStepЗадачаId: currentStepЗадача?.id ?? null,
    };
  }, [checklistAffordanceВключитьd, filtered, issueById, viewState.nestingВключитьd]);

  const { data: labels } = useQuery({
    queryКлюч: queryКлючs.issues.labels(selectedКомпанияId!),
    queryFn: () => issuesApi.listЯрлыки(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const activeФильтрCount = countАктивенЗадачаФильтрs(viewState, enableПроцедураVisibilityФильтр);

  const groupedContent = useMemo(() => {
    if (viewState.groupBy === "none") {
      return [{ key: "__all", label: null as string | null, items: filtered }];
    }
    if (viewState.groupBy === "status") {
      const groups = groupBy(filtered, (i) => i.status);
      return issueСтатусOrder
        .filter((s) => groups[s]?.length)
        .map((s) => ({ key: s, label: issueФильтрLabel(s), items: groups[s]! }));
    }
    if (viewState.groupBy === "priority") {
      const groups = groupBy(filtered, (i) => i.priority);
      return issueПриоритетOrder
        .filter((p) => groups[p]?.length)
        .map((p) => ({ key: p, label: issueФильтрLabel(p), items: groups[p]! }));
    }
    if (viewState.groupBy === "workspace") {
      const groups = groupBy(
        filtered,
        (issue) => resolveЗадачаФильтрРабочая областьId(issue, issueФильтрРабочая областьContext) ?? "__no_workspace",
      );
      return Object.keys(groups)
        .sort((a, b) => {
          // Groups with items first, "no workspace" last
          if (a === "__no_workspace") return 1;
          if (b === "__no_workspace") return -1;
          return (groups[b]?.length ?? 0) - (groups[a]?.length ?? 0);
        })
        .map((key) => ({
          key,
          label: key === "__no_workspace" ? "Без области" : (workspaceИмяMap.get(key) ?? key.slice(0, 8)),
          items: groups[key]!,
        }));
    }
    if (viewState.groupBy === "project") {
      const groups = groupBy(filtered, (issue) => issue.projectId ?? "__no_project");
      return Object.keys(groups)
        .sort((a, b) => {
          if (a === "__no_project") return 1;
          if (b === "__no_project") return -1;
          const labelA = projectById.get(a)?.name ?? a;
          const labelB = projectById.get(b)?.name ?? b;
          return labelA.localeCompare(labelB);
        })
        .map((key) => ({
          key,
          label: key === "__no_project" ? "Без проекта" : (projectById.get(key)?.name ?? key.slice(0, 8)),
          items: groups[key]!,
        }));
    }
    if (viewState.groupBy === "parent") {
      const groups = groupBy(filtered, (i) => i.parentId ?? "__no_parent");
      return Object.keys(groups)
        .sort((a, b) => {
          // Groups with items first, "no parent" last
          if (a === "__no_parent") return 1;
          if (b === "__no_parent") return -1;
          return (groups[b]?.length ?? 0) - (groups[a]?.length ?? 0);
        })
        .map((key) => ({
          key,
          label: key === "__no_parent" ? "Нет Родитель" : (issueНазваниеMap.get(key) ?? key.slice(0, 8)),
          items: groups[key]!,
        }));
    }
    // assignee
    const groups = groupBy(
      filtered,
      (issue) => issue.assigneeАгентId ?? (issue.assigneeUserId ? `__user:${issue.assigneeUserId}` : "__unassigned"),
    );
    return Object.keys(groups).map((key) => ({
      key,
      label:
        key === "__unassigned"
          ? "Не назначен"
          : key.startsWith("__user:")
            ? (formatИсполнительUserLabel(key.slice("__user:".length), currentUserId, companyUserLabelMap) ?? "User")
            : (agentИмя(key) ?? key.slice(0, 8)),
      items: groups[key]!,
    }));
  }, [
    filtered,
    issueФильтрРабочая областьContext,
    viewState.groupBy,
    agents,
    agentИмя,
    currentUserId,
    workspaceИмяMap,
    issueНазваниеMap,
    companyUserLabelMap,
    projectById,
  ]);

  useEffect(() => {
    if (viewState.viewMode !== "list") return;
    const nextЗадачаIds = filtered.map((issue) => issue.id).join("|");
    const previousЗадачаIds = renderedЗадачаIdsRef.current;
    renderedЗадачаIdsRef.current = nextЗадачаIds;

    setRenderedЗадачаRowLimit((current) => {
      const nextInitialLimit = Math.min(filtered.length, INITIAL_ISSUE_ROW_RENDER_LIMIT);
      const listAppended = previousЗадачаIds.length > 0
        && nextЗадачаIds.startsWith(previousЗадачаIds)
        && filtered.length >= current;
      if (listAppended) return Math.min(filtered.length, Math.max(current, nextInitialLimit));
      return nextInitialLimit;
    });
  }, [filtered, viewState.viewMode]);

  const hasMoreRenderedRows = viewState.viewMode === "list" && renderedЗадачаRowLimit < filtered.length;
  const remainingЗадачаRowCount = Math.max(filtered.length - renderedЗадачаRowLimit, 0);
  const loadMoreЗадачаRows = useCallback(() => {
    if (viewState.viewMode !== "list") return;
    if (hasMoreRenderedRows) {
      startTransition(() => {
        setRenderedЗадачаRowLimit((current) => Math.min(filtered.length, current + ISSUE_ROW_RENDER_BATCH_SIZE));
      });
      return;
    }
    if (hasMoreЗадачи && !isЗагрузкаMoreЗадачи) {
      onLoadMoreЗадачи?.();
    }
  }, [
    filtered.length,
    hasMoreЗадачи,
    hasMoreRenderedRows,
    isЗагрузкаMoreЗадачи,
    onLoadMoreЗадачи,
    viewState.viewMode,
  ]);

  const canLoadMoreЗадачи = viewState.viewMode === "list"
    && !isЗагрузка
    && (hasMoreRenderedRows || (hasMoreЗадачи && !isЗагрузкаMoreЗадачи));

  useEffect(() => {
    if (!canLoadMoreЗадачи) return;
    let animationFrameId: number | null = null;
    const scrollContainer = findЗадачиScrollContainer(rootRef.current);
    const scrollЦель: Window | HTMLElement = scrollContainer ?? window;

    const checkScrollPosition = (trigger: "initial" | "scroll" | "resize" = "scroll") => {
      if (animationFrameId !== null) return;
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const scrollHeight = scrollContainer?.scrollHeight ?? document.documentElement.scrollHeight;
        if (scrollHeight === 0) return;
        const viewportHeight = scrollContainer?.clientHeight ?? window.innerHeight;
        const scrollБотtom = scrollContainer
          ? scrollContainer.scrollTop + scrollContainer.clientHeight
          : window.scrollY + window.innerHeight;
        const hasScrollableOverflow = scrollHeight > viewportHeight + 1;
        const threshold = scrollHeight - ISSUE_SCROLL_LOAD_THRESHOLD_PX;
        if (scrollБотtom >= threshold) {
          if (trigger === "initial" && !hasMoreRenderedRows && hasMoreЗадачи && !hasScrollableOverflow) {
            if (initialServerFillRequestedRef.current) return;
            initialServerFillRequestedRef.current = true;
          }
          loadMoreЗадачаRows();
        }
      });
    };

    const handleScroll = () => checkScrollPosition("scroll");
    const handleResize = () => checkScrollPosition("resize");
    scrollЦель.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    checkScrollPosition("initial");

    return () => {
      scrollЦель.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [canLoadMoreЗадачи, hasMoreЗадачи, hasMoreRenderedRows, loadMoreЗадачаRows]);

  const newЗадачаПо умолчаниюs = useCallback((group?: { key: string; items: Задача[] }) => {
    const groupКлюч = group?.key;
    const defaults: Record<string, unknown> = { ...(baseСоздатьЗадачаПо умолчаниюs ?? {}) };
    if (projectId && defaults.projectId === undefined) defaults.projectId = projectId;
    if (groupКлюч) {
      if (viewState.groupBy === "status") defaults.status = groupКлюч;
      else if (viewState.groupBy === "priority") defaults.priority = groupКлюч;
      else if (viewState.groupBy === "assignee" && groupКлюч !== "__unassigned") {
        if (groupКлюч.startsWith("__user:")) defaults.assigneeUserId = groupКлюч.slice("__user:".length);
        else defaults.assigneeАгентId = groupКлюч;
      }
      else if (viewState.groupBy === "project" && groupКлюч !== "__no_project") defaults.projectId = groupКлюч;
      else if (viewState.groupBy === "workspace" && groupКлюч !== "__no_workspace") {
        const representativeЗадача = group?.items.find((issue) => issue.executionРабочая областьId === groupКлюч) ?? null;
        const executionРабочая область = executionРабочая областьById.get(groupКлюч);
        if (executionРабочая область) {
          defaults.executionРабочая областьId = groupКлюч;
          defaults.executionРабочая областьMode = "reuse_existing";
          if (executionРабочая область.projectРабочая областьId) defaults.projectРабочая областьId = executionРабочая область.projectРабочая областьId;
          const groupedProjectId = executionРабочая область.projectId
            ?? (executionРабочая область.projectРабочая областьId
              ? projectРабочая областьById.get(executionРабочая область.projectРабочая областьId)?.projectId
              : null)
            ?? (representativeЗадача?.executionРабочая областьId === groupКлюч ? representativeЗадача.projectId : null);
          if (groupedProjectId) defaults.projectId = groupedProjectId;
        } else {
          const projectРабочая область = projectРабочая областьById.get(groupКлюч);
          if (projectРабочая область) {
            defaults.projectРабочая областьId = groupКлюч;
            defaults.projectId = projectРабочая область.projectId;
          }
        }
      }
      else if (viewState.groupBy === "parent" && groupКлюч !== "__no_parent") {
        const parentЗадача = issueById.get(groupКлюч);
        if (parentЗадача) Object.assign(defaults, buildSubЗадачаПо умолчаниюsForViewer(parentЗадача, currentUserId));
        else defaults.parentId = groupКлюч;
      }
    }
    return defaults;
  }, [
    baseСоздатьЗадачаПо умолчаниюs,
    currentUserId,
    executionРабочая областьById,
    issueById,
    projectId,
    projectРабочая областьById,
    viewState.groupBy,
  ]);

  const createActionLabel = createЗадачаLabel ? `Создать ${createЗадачаLabel}` : "Создать задачу";
  const createButtonLabel = createЗадачаLabel ? `New ${createЗадачаLabel}` : "Новая задача";
  const openСоздатьЗадачаDialog = useCallback((group?: { key: string; items: Задача[] }) => {
    openNewЗадача(newЗадачаПо умолчаниюs(group));
  }, [newЗадачаПо умолчаниюs, openNewЗадача]);

  const filterToРабочая область = useCallback((workspaceId: string) => {
    updateView({ workspaces: [workspaceId] });
  }, [updateView]);

  const setЗадачаColumns = useCallback((next: ВходящиеЗадачаColumn[]) => {
    const normalized = normalizeВходящиеЗадачаColumns(next);
    setVisibleЗадачаColumns(normalized);
    saveЗадачаColumns(scopedКлюч, normalized);
  }, [scopedКлюч]);

  const toggleЗадачаColumn = useCallback((column: ВходящиеЗадачаColumn, enabled: boolean) => {
    if (enabled) {
      setЗадачаColumns([...visibleЗадачаColumns, column]);
      return;
    }
    setЗадачаColumns(visibleЗадачаColumns.filter((value) => value !== column));
  }, [setЗадачаColumns, visibleЗадачаColumns]);

  const assignЗадача = useCallback((issueId: string, assigneeАгентId: string | null, assigneeUserId: string | null = null) => {
    onОбновитьЗадача(issueId, { assigneeАгентId, assigneeUserId });
    setИсполнительPickerЗадачаId(null);
    setИсполнительПоиск("");
  }, [onОбновитьЗадача]);

  let remainingRowsToRender = viewState.viewMode === "list" ? renderedЗадачаRowLimit : Number.POSITIVE_INFINITY;

  return (
    <div ref={rootRef} classИмя="space-y-4">
      {progressSummary ? (
        <SubЗадачаProgressSummaryStrip
          summary={progressSummary}
          issueLinkState={issueLinkState}
          parentЗадачаIdForCostSummary={parentЗадачаIdForCostSummary}
        />
      ) : null}

      {/* Toolbar */}
      <div classИмя="flex items-center justify-between gap-2 sm:gap-3">
        <div classИмя="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button size="sm" variant="outline" onClick={() => openСоздатьЗадачаDialog()}>
            <Plus classИмя="h-4 w-4 sm:mr-1" />
            <span classИмя="hidden sm:inline">{createButtonLabel}</span>
          </Button>
          <ЗадачаПоискInput
            value={issueПоиск}
            onDebouncedChange={(nextПоиск) => {
              setЗадачаПоиск(nextПоиск);
              onПоискChange?.(nextПоиск);
            }}
          />
        </div>

        <div classИмя="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* View mode toggle */}
          <div classИмя="flex items-center border border-border rounded-md overflow-hidden mr-1">
            <button
              classИмя={`p-1.5 transition-colors ${viewState.viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => updateView({ viewMode: "list" })}
              title="List view"
            >
              <List classИмя="h-3.5 w-3.5" />
            </button>
            <button
              classИмя={`p-1.5 transition-colors ${viewState.viewMode === "board" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => updateView({ viewMode: "board" })}
              title="Совет view"
            >
              <Columns3 classИмя="h-3.5 w-3.5" />
            </button>
          </div>

          {viewState.viewMode === "list" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              classИмя={cn("hidden h-8 w-8 shrink-0 sm:inline-flex", viewState.nestingВключитьd && "bg-accent")}
              onClick={() => updateView({ nestingВключитьd: !viewState.nestingВключитьd })}
              title={viewState.nestingВключитьd ? "Отключить parent-child nesting" : "Включить parent-child nesting"}
            >
              <ListTree classИмя="h-3.5 w-3.5" />
            </Button>
          )}

          <ЗадачаColumnPicker
            availableColumns={availableЗадачаColumns}
            visibleColumnSet={visibleЗадачаColumnSet}
            onToggleColumn={toggleЗадачаColumn}
            onСброситьColumns={() => setЗадачаColumns(DEFAULT_INBOX_ISSUE_COLUMNS)}
            title="Choose which issue columns stay visible"
            iconOnly
          />

          <ЗадачаФильтрsPopover
            state={viewState}
            onChange={updateView}
            activeФильтрCount={activeФильтрCount}
            agents={agents}
            creators={creatorOptions}
            projects={projects?.map((project) => ({ id: project.id, name: project.name }))}
            labels={labels?.map((label) => ({ id: label.id, name: label.name, color: label.color }))}
            currentUserId={currentUserId}
            enableПроцедураVisibilityФильтр={enableПроцедураVisibilityФильтр}
            iconOnly
            workspaces={isolatedРабочие областиВключитьd ? workspaceOptions : undefined}
          />

          {/* Сортировка (list view only) */}
          {viewState.viewMode === "list" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" classИмя="h-8 w-8 shrink-0" title="Сортировка">
                  <ArrowUpDown classИмя="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" classИмя="w-48 p-0">
                <div classИмя="p-2 space-y-0.5">
                  {([
                    ["workflow", "Работаflow"],
                    ["status", "Статус"],
                    ["priority", "Приоритет"],
                    ["title", "Название"],
                    ["created", "Создано"],
                    ["updated", "Обновлено"],
                  ] as const).map(([field, label]) => (
                    <button
                      key={field}
                      classИмя={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm ${
                        viewState.sortField === field ? "bg-accent/50 text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                      }`}
                      onClick={() => {
                        if (viewState.sortField === field) {
                          updateView({ sortDir: viewState.sortDir === "asc" ? "desc" : "asc" });
                        } else {
                          updateView({ sortField: field, sortDir: "asc" });
                        }
                      }}
                    >
                      <span>{label}</span>
                      {viewState.sortField === field && (
                        <span classИмя="text-xs text-muted-foreground">
                          {viewState.sortDir === "asc" ? "\u2191" : "\u2193"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Group (list view only) */}
          {viewState.viewMode === "list" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" classИмя="h-8 w-8 shrink-0" title="Group">
                  <Layers classИмя="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" classИмя="w-44 p-0">
                <div classИмя="p-2 space-y-0.5">
                  {([
                    ["status", "Статус"],
                    ["priority", "Приоритет"],
                    ["assignee", "Исполнитель"],
                    ["project", "Project"],
                    ["workspace", "Рабочая область"],
                    ["parent", "Родитель Задача"],
                    ["none", "Нет"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      classИмя={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm ${
                        viewState.groupBy === value ? "bg-accent/50 text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                      }`}
                      onClick={() => updateView({ groupBy: value })}
                    >
                      <span>{label}</span>
                      {viewState.groupBy === value && <Check classИмя="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {isЗагрузка && <PageSkeleton variant="issues-list" />}
      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}
      {!searchWithinLoadedЗадачи && normalizedЗадачаПоиск.length > 0 && searchedЗадачи.length === ISSUE_SEARCH_RESULT_LIMIT && (
        <p classИмя="text-xs text-muted-foreground">
          Showing up to {ISSUE_SEARCH_RESULT_LIMIT} matches. Refine the search to narrow further.
        </p>
      )}
      {boardColumnLimitReached && (
        <p classИмя="text-xs text-muted-foreground">
          Some board columns are showing up to {ISSUE_BOARD_COLUMN_RESULT_LIMIT} issues. Refine filters or search to reveal the rest.
        </p>
      )}
      {!isЗагрузка && filtered.length === 0 && viewState.viewMode === "list" && (
        <EmptyState
          icon={CircleDot}
          message="Нет issues match the current filters or search."
          action={createActionLabel}
          onAction={() => openСоздатьЗадачаDialog()}
        />
      )}

      {viewState.viewMode === "board" ? (
        <KanbanСовет
          issues={filtered}
          agents={agents}
          liveЗадачаIds={liveЗадачаIds}
          onОбновитьЗадача={onОбновитьЗадача}
        />
      ) : (
        <>
          {groupedContent.map((group) => {
          if (remainingRowsToRender <= 0) return null;
          return (
          <Collapsible
            key={group.key}
            open={!viewState.collapsedGroups.includes(group.key)}
            onOpenChange={(open) => {
              updateView({
                collapsedGroups: open
                  ? viewState.collapsedGroups.filter((k) => k !== group.key)
                  : [...viewState.collapsedGroups, group.key],
              });
            }}
          >
            {group.label && (
              <ЗадачаGroupHeader
                label={group.label}
                collapsible
                collapsed={viewState.collapsedGroups.includes(group.key)}
                onToggle={() => {
                  updateView({
                    collapsedGroups: viewState.collapsedGroups.includes(group.key)
                      ? viewState.collapsedGroups.filter((k) => k !== group.key)
                      : [...viewState.collapsedGroups, group.key],
                  });
                }}
                trailing={(
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    classИмя="-mr-2 text-muted-foreground"
                    title={`Новая задача in ${group.label}`}
                    aria-label={`Новая задача in ${group.label}`}
                    onClick={() => openСоздатьЗадачаDialog(group)}
                  >
                    <Plus classИмя="h-3 w-3" />
                  </Button>
                )}
              />
            )}
            <CollapsibleContent>
              {(() => {
                const { roots, childMap } = viewState.nestingВключитьd
                  ? buildЗадачаTree(group.items)
                  : { roots: group.items, childMap: new Map<string, Задача[]>() };

                const renderЗадачаRow = (issue: Задача, depth: number) => {
                  if (remainingRowsToRender <= 0) return null;
                  remainingRowsToRender -= 1;

                  const children = childMap.get(issue.id) ?? [];
                  const hasChildren = children.length > 0;
                  const totalDescendants = hasChildren ? countDescendants(issue.id, childMap) : 0;
                  const isExpanded = !viewState.collapsedРодительs.includes(issue.id);
                  const useDeferredRowRendering = !(hasChildren && isExpanded);
                  const issueProject = issue.projectId ? projectById.get(issue.projectId) ?? null : null;
                  const parentЗадача = issue.parentId ? issueById.get(issue.parentId) ?? null : null;
                  const issueBadge = issueBadgeById?.get(issue.id);
                  const isMutedЗадача = mutedЗадачаIds?.has(issue.id) === true;
                  const assigneeUserПрофиль = issue.assigneeUserId
                    ? companyUserПрофильMap.get(issue.assigneeUserId) ?? null
                    : null;
                  const assigneeUserLabel = formatИсполнительUserLabel(
                    issue.assigneeUserId,
                    currentUserId,
                    companyUserLabelMap,
                  ) ?? assigneeUserПрофиль?.label ?? null;
                  const toggleCollapse = (e: { preventПо умолчанию: () => void; stopPropagation: () => void }) => {
                    e.preventПо умолчанию();
                    e.stopPropagation();
                    updateView({
                      collapsedРодительs: isExpanded
                        ? [...viewState.collapsedРодительs, issue.id]
                        : viewState.collapsedРодительs.filter((id) => id !== issue.id),
                    });
                  };
                  const checklistMeta = workflowChecklistMeta;
                  const checklistStepNumber = checklistMeta?.stepNumberByЗадачаId.get(issue.id) ?? null;
                  const unresolvedVisibleBlockers = checklistMeta?.unresolvedVisibleBlockersByЗадачаId.get(issue.id) ?? [];
                  const checklistRowId = checklistMeta ? `issue-workflow-row-${issue.id}` : undefined;
                  const doneRowНазваниеClass = checklistMeta && issue.status === "done"
                    ? "text-muted-foreground"
                    : undefined;
                  const visibleBlockerChips = unresolvedVisibleBlockers
                    .map((blockerId) => {
                      const blockerЗадача = issueById.get(blockerId);
                      if (!blockerЗадача) return null;
                      const label = blockerЗадача.identifier ?? blockerЗадача.id.slice(0, 8);
                      const blockerStep = checklistMeta?.stepNumberByЗадачаId.get(blockerId);
                      const blockerStepSuffix = blockerStep ? ` \u00b7 step ${blockerStep}` : "";
                      return { blockerId, chipLabel: `blocked by ${label}${blockerStepSuffix}` };
                    })
                    .filter((chip): chip is { blockerId: string; chipLabel: string } => chip !== null);
                  const firstVisibleBlockerChip = visibleBlockerChips[0] ?? null;
                  const additionalVisibleBlockerCount = Math.max(visibleBlockerChips.length - 1, 0);
                  const additionalVisibleBlockerLabel = additionalVisibleBlockerCount > 0
                    ? ` ... and ${additionalVisibleBlockerCount} more`
                    : "";
                  const firstVisibleBlockerDisplayLabel = firstVisibleBlockerChip
                    ? `${firstVisibleBlockerChip.chipLabel}${additionalVisibleBlockerLabel}`
                    : "";
                  const hiddenVisibleBlockerЯрлыки = visibleBlockerChips
                    .slice(1)
                    .map((chip) => chip.chipLabel)
                    .join(", ");
                  const firstVisibleBlockerНазвание = additionalVisibleBlockerCount > 0
                    ? `${firstVisibleBlockerDisplayLabel}: ${hiddenVisibleBlockerЯрлыки}`
                    : firstVisibleBlockerDisplayLabel;
                  const checklistDependencyChips = checklistMeta && firstVisibleBlockerChip ? (
                    <button
                      key={firstVisibleBlockerChip.blockerId}
                      type="button"
                      onClick={(event) => {
                        event.preventПо умолчанию();
                        event.stopPropagation();
                        const target = document.getElementById(`issue-workflow-row-${firstVisibleBlockerChip.blockerId}`);
                        if (!target) return;
                        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        target.focus?.();
                      }}
                      classИмя="inline-flex items-center rounded-full border border-amber-400/45 bg-amber-50/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-300/35 dark:bg-amber-400/10 dark:text-amber-300"
                      title={firstVisibleBlockerНазвание}
                      aria-label={firstVisibleBlockerНазвание}
                    >
                      {firstVisibleBlockerDisplayLabel}
                    </button>
                  ) : null;

                  return (
                    <div
                      key={issue.id}
                      style={{
                        ...(depth > 0 ? { paddingLeft: `${depth * 16}px` } : {}),
                        ...(useDeferredRowRendering
                          ? {
                            contentVisibility: "auto",
                            containIntrinsicSize: "44px",
                          }
                          : {}),
                      }}
                    >
                      <ЗадачаRow
                        issue={issue}
                        issueLinkState={issueLinkState}
                        checklistStepNumber={checklistStepNumber}
                        checklistCurrentStep={checklistMeta?.currentStepЗадачаId === issue.id}
                        checklistDependencyChips={checklistDependencyChips}
                        checklistRowId={checklistRowId}
                        titleClassИмя={doneRowНазваниеClass}
                        titleSuffix={(
                          <>
                            {hasChildren && !isExpanded ? (
                              <span classИмя="ml-1.5 text-xs text-muted-foreground">
                                ({totalDescendants} sub-task{totalDescendants !== 1 ? "s" : ""})
                              </span>
                            ) : null}
                            {issueBadge ? (
                              issueBadge === "Приостановлен" ? (
                                <span
                                  classИмя={cn("ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", statusBadge.paused)}
                                  aria-label="Приостановлен"
                                  title="Приостановлен"
                                >
                                  <CircleSlash2 classИмя="h-3 w-3" />
                                  Приостановлен
                                </span>
                              ) : (
                                <span classИмя="ml-1.5 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                  {issueBadge}
                                </span>
                              )
                            ) : null}
                            {isУспешноfulЗапуститьHandoffОбязательно(issue) ? (
                              <span
                                classИмя="ml-1.5 inline-flex items-center gap-1 rounded-full border border-amber-400/45 bg-amber-50/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-300/35 dark:bg-amber-400/10 dark:text-amber-300"
                                aria-label="Needs next step"
                                title="This issue needs a next step"
                              >
                                <CircleDot classИмя="h-3 w-3" />
                                Needs next step
                              </span>
                            ) : null}
                          </>
                        )}
                        classИмя={isMutedЗадача ? "opacity-70" : undefined}
                        mobileLeading={
                          hasChildren ? (
                            <button type="button" onClick={toggleCollapse}>
                              <ChevronRight classИмя={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                            </button>
                          ) : (
                            <span onClick={(e) => { e.preventПо умолчанию(); e.stopPropagation(); }}>
                              <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} onChange={(s) => onОбновитьЗадача(issue.id, { status: s })} />
                            </span>
                          )
                        }
                        desktopMetaLeading={(
                          <>
                            {hasChildren ? (
                              <button
                                type="button"
                                classИмя="hidden shrink-0 items-center sm:inline-flex"
                                onClick={toggleCollapse}
                              >
                                <ChevronRight classИмя={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                              </button>
                            ) : (
                              <span classИмя="hidden w-3.5 shrink-0 sm:block" />
                            )}
                            <ВходящиеЗадачаMetaLeading
                              issue={issue}
                              isLive={liveЗадачаIds?.has(issue.id) === true}
                              showСтатус={visibleЗадачаColumnSet.has("status") && availableЗадачаColumnSet.has("status")}
                              showIdentifier={visibleЗадачаColumnSet.has("id") && availableЗадачаColumnSet.has("id")}
                              checklistStepNumber={checklistStepNumber}
                              statusSlot={(
                                <span onClick={(e) => { e.preventПо умолчанию(); e.stopPropagation(); }}>
                                  <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} onChange={(s) => onОбновитьЗадача(issue.id, { status: s })} />
                                </span>
                              )}
                            />
                          </>
                        )}
                        mobileMeta={issueАктивностьText(issue).toНизкийerCase()}
                        desktopTrailing={(
                          visibleTrailingЗадачаColumns.length > 0 ? (
                            <ВходящиеЗадачаTrailingColumns
                              issue={issue}
                              columns={visibleTrailingЗадачаColumns}
                              projectИмя={issueProject?.name ?? null}
                              projectColor={issueProject?.color ?? null}
                              workspaceId={resolveЗадачаФильтрРабочая областьId(issue, issueФильтрРабочая областьContext)}
                              workspaceИмя={resolveЗадачаРабочая областьИмя(issue, {
                                executionРабочая областьById,
                                projectРабочая областьById,
                                defaultProjectРабочая областьIdByProjectId,
                              })}
                              onФильтрРабочая область={filterToРабочая область}
                              assigneeИмя={agentИмя(issue.assigneeАгентId)}
                              assigneeUserИмя={assigneeUserLabel}
                              assigneeUserAvatarUrl={assigneeUserПрофиль?.image ?? null}
                              currentUserId={currentUserId}
                              parentIdentifier={parentЗадача?.identifier ?? null}
                              parentНазвание={parentЗадача?.title ?? null}
                              assigneeContent={(
                                <Popover
                                  open={assigneePickerЗадачаId === issue.id}
                                  onOpenChange={(open) => {
                                    setИсполнительPickerЗадачаId(open ? issue.id : null);
                                    if (!open) setИсполнительПоиск("");
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      classИмя="flex w-full shrink-0 items-center overflow-hidden rounded-md px-2 py-1 transition-colors hover:bg-accent/50"
                                      onClick={(e) => { e.preventПо умолчанию(); e.stopPropagation(); }}
                                    >
                                      {issue.assigneeАгентId && agentИмя(issue.assigneeАгентId) ? (
                                        <Identity name={agentИмя(issue.assigneeАгентId)!} size="sm" classИмя="min-w-0" />
                                      ) : issue.assigneeUserId ? (
                                        <Identity
                                          name={assigneeUserLabel ?? "User"}
                                          avatarUrl={assigneeUserПрофиль?.image ?? null}
                                          size="sm"
                                          classИмя="min-w-0"
                                        />
                                      ) : (
                                        <span classИмя="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <span classИмя="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 bg-muted/30">
                                            <User classИмя="h-3.5 w-3.5" />
                                          </span>
                                          Исполнитель
                                        </span>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    classИмя="w-56 p-1"
                                    align="end"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDownOutside={() => setИсполнительПоиск("")}
                                  >
                                    <input
                                      classИмя="mb-1 w-full border-b border-border bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
                                      placeholder="Поиск assignees..."
                                      value={assigneeПоиск}
                                      onChange={(e) => setИсполнительПоиск(e.target.value)}
                                      autoFocus
                                    />
                                    <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
                                      <button
                                        classИмя={cn(
                                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                                          !issue.assigneeАгентId && !issue.assigneeUserId && "bg-accent",
                                        )}
                                        onClick={(e) => {
                                          e.preventПо умолчанию();
                                          e.stopPropagation();
                                          assignЗадача(issue.id, null, null);
                                        }}
                                      >
                                        Нет assignee
                                      </button>
                                      {currentUserId && (
                                        <button
                                          classИмя={cn(
                                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50",
                                            issue.assigneeUserId === currentUserId && "bg-accent",
                                          )}
                                          onClick={(e) => {
                                            e.preventПо умолчанию();
                                            e.stopPropagation();
                                            assignЗадача(issue.id, null, currentUserId);
                                          }}
                                        >
                                          <User classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span>Me</span>
                                        </button>
                                      )}
                                      {(agents ?? [])
                                        .filter((agent) => {
                                          if (!assigneeПоиск.trim()) return true;
                                          return agent.name.toНизкийerCase().includes(assigneeПоиск.toНизкийerCase());
                                        })
                                        .map((agent) => (
                                          <button
                                            key={agent.id}
                                            classИмя={cn(
                                              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50",
                                              issue.assigneeАгентId === agent.id && "bg-accent",
                                            )}
                                            onClick={(e) => {
                                              e.preventПо умолчанию();
                                              e.stopPropagation();
                                              assignЗадача(issue.id, agent.id, null);
                                            }}
                                          >
                                            <Identity name={agent.name} size="sm" classИмя="min-w-0" />
                                          </button>
                                        ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            />
                          ) : undefined
                        )}
                      />
                      {hasChildren && isExpanded && children.map((child) => renderЗадачаRow(child, depth + 1))}
                    </div>
                  );
                };

                return roots.map((issue) => renderЗадачаRow(issue, 0)).filter((node) => node !== null);
              })()}
            </CollapsibleContent>
          </Collapsible>
          );
          })}
          {(remainingЗадачаRowCount > 0 || hasMoreЗадачи || isЗагрузкаMoreЗадачи) && (
            <div classИмя="py-2" data-testid="issues-load-more-sentinel">
              <p classИмя="text-xs text-muted-foreground">
                {isЗагрузкаMoreЗадачи
                  ? "Загрузка more issues..."
                  : remainingЗадачаRowCount > 0
                    ? `Rendering ${Math.min(renderedЗадачаRowLimit, filtered.length)} of ${filtered.length} issues`
                    : "Scroll to load more issues"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
