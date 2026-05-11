import type {
  Согласование,
  Панель управленияSummary,
  HeartbeatЗапустить,
  ВходящиеЗакрытьal,
  Задача,
  JoinRequest,
} from "@paperclipai/shared";
import {
  applyЗадачаФильтрs,
  defaultЗадачаФильтрState,
  normalizeЗадачаФильтрState,
  type ЗадачаФильтрState,
} from "./issue-filters";
import { formatИсполнительUserLabel } from "./assignees";

export const RECENT_ISSUES_LIMIT = 100;
export const FAILED_RUN_STATUSES = new Set(["failed", "timed_out"]);
export const ACTIONABLE_APPROVAL_STATUSES = new Set(["pending", "revision_requested"]);
export const DISMISSED_KEY = "paperclip:inbox:dismissed";
export const READ_ITEMS_KEY = "paperclip:inbox:read-items";
export const INBOX_LAST_TAB_KEY = "paperclip:inbox:last-tab";
export const INBOX_ISSUE_COLUMNS_KEY = "paperclip:inbox:issue-columns";
export const INBOX_NESTING_KEY = "paperclip:inbox:nesting";
export const INBOX_GROUP_BY_KEY = "paperclip:inbox:group-by";
export const INBOX_FILTER_PREFERENCES_KEY_PREFIX = "paperclip:inbox:filters";
export const INBOX_COLLAPSED_GROUPS_KEY_PREFIX = "paperclip:inbox:collapsed-groups";
export type ВходящиеTab = "mine" | "recent" | "unread" | "all";
export type ВходящиеCategoryФильтр =
  | "everything"
  | "issues_i_touched"
  | "join_requests"
  | "approvals"
  | "failed_runs"
  | "alerts";
export type ВходящиеСогласованиеФильтр = "all" | "actionable" | "resolved";
export type ВходящиеРаботаItemGroupBy = "none" | "type" | "assignee" | "project" | "workspace";
export const inboxЗадачаColumns = [
  "status",
  "id",
  "assignee",
  "project",
  "workspace",
  "parent",
  "labels",
  "updated",
] as const;
export type ВходящиеЗадачаColumn = (typeof inboxЗадачаColumns)[number];
export const DEFAULT_INBOX_ISSUE_COLUMNS: ВходящиеЗадачаColumn[] = ["status", "id", "updated"];
export interface ВходящиеФильтрPreferences {
  allCategoryФильтр: ВходящиеCategoryФильтр;
  allСогласованиеФильтр: ВходящиеСогласованиеФильтр;
  issueФильтрs: ЗадачаФильтрState;
}
export type ВходящиеРаботаItem =
  | {
      kind: "issue";
      timestamp: number;
      issue: Задача;
    }
  | {
      kind: "approval";
      timestamp: number;
      approval: Согласование;
    }
  | {
      kind: "failed_run";
      timestamp: number;
      run: HeartbeatЗапустить;
    }
  | {
      kind: "join_request";
      timestamp: number;
      joinRequest: JoinRequest;
    };

export interface ВходящиеBadgeData {
  inbox: number;
  approvals: number;
  failedЗапуститьs: number;
  joinRequests: number;
  mineЗадачи: number;
  alerts: number;
}

export interface ВходящиеРаботаItemGroup {
  key: string;
  label: string | null;
  items: ВходящиеРаботаItem[];
}

export type ВходящиеПоискSection = "none" | "archived" | "other";

export interface ВходящиеGroupedSection {
  key: string;
  label: string | null;
  displayItems: ВходящиеРаботаItem[];
  childrenByЗадачаId: Map<string, Задача[]>;
  searchSection: ВходящиеПоискSection;
}

export interface ВходящиеКлючboardGroupSection {
  key: string;
  label?: string | null;
  displayItems: ВходящиеРаботаItem[];
  childrenByЗадачаId: ReadonlyMap<string, Задача[]>;
}

export type ВходящиеКлючboardNavEntry =
  | {
      type: "group";
      groupКлюч: string;
      label: string;
      collapsed: boolean;
    }
  | {
      type: "top";
      itemКлюч: string;
      item: ВходящиеРаботаItem;
    }
  | {
      type: "child";
      issueId: string;
      issue: Задача;
    };

export interface ВходящиеProjectРабочая областьLookup {
  name: string;
  projectId?: string | null;
}

export interface ВходящиеExecutionРабочая областьLookup {
  name: string;
  mode: "shared_workspace" | "isolated_workspace" | "operator_branch" | "adapter_managed" | "cloud_sandbox";
  projectРабочая областьId: string | null;
  projectId?: string | null;
}

export interface ВходящиеРабочая областьGroupingOptions {
  executionРабочая областьById?: ReadonlyMap<string, ВходящиеExecutionРабочая областьLookup>;
  projectРабочая областьById?: ReadonlyMap<string, ВходящиеProjectРабочая областьLookup>;
  defaultProjectРабочая областьIdByProjectId?: ReadonlyMap<string, string>;
  projectById?: ReadonlyMap<string, { name: string | null | undefined }>;
  agentById?: ReadonlyMap<string, string | null | undefined>;
  userLabelById?: ReadonlyMap<string, string>;
  currentUserId?: string | null;
}

export interface ВходящиеЗадачаGroupСоздатьПо умолчаниюs {
  projectId?: string;
  projectРабочая областьId?: string;
  executionРабочая областьId?: string;
  executionРабочая областьMode?: string;
  assigneeАгентId?: string;
  assigneeUserId?: string;
}

const defaultВходящиеФильтрPreferences: ВходящиеФильтрPreferences = {
  allCategoryФильтр: "everything",
  allСогласованиеФильтр: "all",
  issueФильтрs: defaultЗадачаФильтрState,
};

function normalizeВходящиеCategoryФильтр(value: unknown): ВходящиеCategoryФильтр {
  return value === "issues_i_touched"
    || value === "join_requests"
    || value === "approvals"
    || value === "failed_runs"
    || value === "alerts"
    ? value
    : "everything";
}

function normalizeВходящиеСогласованиеФильтр(value: unknown): ВходящиеСогласованиеФильтр {
  return value === "actionable" || value === "resolved" ? value : "all";
}

function getВходящиеФильтрPreferencesStorageКлюч(companyId: string | null | undefined): string | null {
  if (!companyId) return null;
  return `${INBOX_FILTER_PREFERENCES_KEY_PREFIX}:${companyId}`;
}

function getВходящиеCollapsedGroupsStorageКлюч(companyId: string | null | undefined): string | null {
  if (!companyId) return null;
  return `${INBOX_COLLAPSED_GROUPS_KEY_PREFIX}:${companyId}`;
}

export function loadВходящиеФильтрPreferences(
  companyId: string | null | undefined,
): ВходящиеФильтрPreferences {
  const storageКлюч = getВходящиеФильтрPreferencesStorageКлюч(companyId);
  if (!storageКлюч) {
    return {
      ...defaultВходящиеФильтрPreferences,
      issueФильтрs: { ...defaultЗадачаФильтрState },
    };
  }

  try {
    const raw = localStorage.getItem(storageКлюч);
    if (!raw) {
      return {
        ...defaultВходящиеФильтрPreferences,
        issueФильтрs: { ...defaultЗадачаФильтрState },
      };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      allCategoryФильтр: normalizeВходящиеCategoryФильтр(parsed.allCategoryФильтр),
      allСогласованиеФильтр: normalizeВходящиеСогласованиеФильтр(parsed.allСогласованиеФильтр),
      issueФильтрs: normalizeЗадачаФильтрState(parsed.issueФильтрs),
    };
  } catch {
    return {
      ...defaultВходящиеФильтрPreferences,
      issueФильтрs: { ...defaultЗадачаФильтрState },
    };
  }
}

export function saveВходящиеФильтрPreferences(
  companyId: string | null | undefined,
  preferences: ВходящиеФильтрPreferences,
) {
  const storageКлюч = getВходящиеФильтрPreferencesStorageКлюч(companyId);
  if (!storageКлюч) return;

  try {
    localStorage.setItem(
      storageКлюч,
      JSON.stringify({
        allCategoryФильтр: normalizeВходящиеCategoryФильтр(preferences.allCategoryФильтр),
        allСогласованиеФильтр: normalizeВходящиеСогласованиеФильтр(preferences.allСогласованиеФильтр),
        issueФильтрs: normalizeЗадачаФильтрState(preferences.issueФильтрs),
      }),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function loadCollapsedВходящиеGroupКлючs(
  companyId: string | null | undefined,
): Set<string> {
  const storageКлюч = getВходящиеCollapsedGroupsStorageКлюч(companyId);
  if (!storageКлюч) return new Set();

  try {
    const raw = localStorage.getItem(storageКлюч);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedВходящиеGroupКлючs(
  companyId: string | null | undefined,
  groupКлючs: ReadonlySet<string>,
) {
  const storageКлюч = getВходящиеCollapsedGroupsStorageКлюч(companyId);
  if (!storageКлюч) return;

  try {
    localStorage.setItem(storageКлюч, JSON.stringify([...groupКлючs]));
  } catch {
    // Ignore localStorage failures.
  }
}

export function loadЗакрытьedВходящиеAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string" && value.startsWith("alert:")));
  } catch {
    return new Set();
  }
}

export function saveЗакрытьedВходящиеAlerts(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore localStorage failures.
  }
}

export function buildВходящиеЗакрытьedAtByКлюч(dismissals: ВходящиеЗакрытьal[]): Map<string, number> {
  return new Map(
    dismissals.map((dismissal) => [dismissal.itemКлюч, normalizeTimestamp(dismissal.dismissedAt)]),
  );
}

export function isВходящиеEntityЗакрытьed(
  dismissedAtByКлюч: ReadonlyMap<string, number>,
  itemКлюч: string,
  activityAt: string | Date | null | undefined,
): boolean {
  const dismissedAt = dismissedAtByКлюч.get(itemКлюч);
  if (dismissedAt == null) return false;
  return dismissedAt >= normalizeTimestamp(activityAt);
}

export function loadReadВходящиеItems(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_ITEMS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadВходящиеItems(ids: Set<string>) {
  try {
    localStorage.setItem(READ_ITEMS_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore localStorage failures.
  }
}

export function normalizeВходящиеЗадачаColumns(columns: Iterable<string | ВходящиеЗадачаColumn>): ВходящиеЗадачаColumn[] {
  const selected = new Set(columns);
  return inboxЗадачаColumns.filter((column) => selected.has(column));
}

export function getAvailableВходящиеЗадачаColumns(enableРабочая областьColumn: boolean): ВходящиеЗадачаColumn[] {
  if (enableРабочая областьColumn) return [...inboxЗадачаColumns];
  return inboxЗадачаColumns.filter((column) => column !== "workspace");
}

export function loadВходящиеЗадачаColumns(): ВходящиеЗадачаColumn[] {
  try {
    const raw = localStorage.getItem(INBOX_ISSUE_COLUMNS_KEY);
    if (raw === null) return DEFAULT_INBOX_ISSUE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_INBOX_ISSUE_COLUMNS;
    return normalizeВходящиеЗадачаColumns(parsed);
  } catch {
    return DEFAULT_INBOX_ISSUE_COLUMNS;
  }
}

export function saveВходящиеЗадачаColumns(columns: ВходящиеЗадачаColumn[]) {
  try {
    localStorage.setItem(
      INBOX_ISSUE_COLUMNS_KEY,
      JSON.stringify(normalizeВходящиеЗадачаColumns(columns)),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function loadВходящиеРаботаItemGroupBy(): ВходящиеРаботаItemGroupBy {
  try {
    const raw = localStorage.getItem(INBOX_GROUP_BY_KEY);
    return raw === "type" || raw === "assignee" || raw === "project" || raw === "workspace" ? raw : "none";
  } catch {
    return "none";
  }
}

export function saveВходящиеРаботаItemGroupBy(groupBy: ВходящиеРаботаItemGroupBy) {
  try {
    localStorage.setItem(INBOX_GROUP_BY_KEY, groupBy);
  } catch {
    // Ignore localStorage failures.
  }
}

export function shouldСброситьВходящиеРабочая областьGrouping(
  groupBy: ВходящиеРаботаItemGroupBy,
  isolatedРабочие областиВключитьd: boolean,
  experimentalНастройкиLoaded: boolean,
): boolean {
  return experimentalНастройкиLoaded && groupBy === "workspace" && !isolatedРабочие областиВключитьd;
}

export function shouldIncludeПроцедураExecutionЗадача(
  issue: Pick<Задача, "originKind">,
  hideПроцедураExecutions: boolean,
): boolean {
  return !hideПроцедураExecutions || issue.originKind !== "routine_execution";
}

export function filterВходящиеЗадачи(issues: Задача[], hideПроцедураExecutions: boolean): Задача[] {
  if (!hideПроцедураExecutions) return issues;
  return issues.filter((issue) => shouldIncludeПроцедураExecutionЗадача(issue, hideПроцедураExecutions));
}

export function matchesВходящиеЗадачаПоиск(
  issue: Pick<Задача, "title" | "identifier" | "description" | "executionРабочая областьId" | "projectId" | "projectРабочая областьId">,
  query: string,
  {
    isolatedРабочие областиВключитьd = false,
    executionРабочая областьById,
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  }: ВходящиеРабочая областьGroupingOptions & {
    isolatedРабочие областиВключитьd?: boolean;
  } = {},
): boolean {
  const normalizedQuery = query.trim().toНизкийerCase();
  if (!normalizedQuery) return true;
  if (issue.title.toНизкийerCase().includes(normalizedQuery)) return true;
  if (issue.identifier?.toНизкийerCase().includes(normalizedQuery)) return true;
  if (issue.description?.toНизкийerCase().includes(normalizedQuery)) return true;
  if (!isolatedРабочие областиВключитьd) return false;

  const workspaceИмя = resolveЗадачаРабочая областьИмя(issue, {
    executionРабочая областьById,
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  });
  return workspaceИмя?.toНизкийerCase().includes(normalizedQuery) ?? false;
}

export function getАрхивированВходящиеПоискЗадачи({
  visibleЗадачи,
  searchableЗадачи,
  query,
  isolatedРабочие областиВключитьd = false,
  executionРабочая областьById,
  projectРабочая областьById,
  defaultProjectРабочая областьIdByProjectId,
}: {
  visibleЗадачи: Задача[];
  searchableЗадачи: Задача[];
  query: string;
  isolatedРабочие областиВключитьd?: boolean;
  executionРабочая областьById?: ReadonlyMap<string, ВходящиеExecutionРабочая областьLookup>;
  projectРабочая областьById?: ReadonlyMap<string, ВходящиеProjectРабочая областьLookup>;
  defaultProjectРабочая областьIdByProjectId?: ReadonlyMap<string, string>;
}): Задача[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const visibleЗадачаIds = new Set(visibleЗадачи.map((issue) => issue.id));
  return searchableЗадачи
    .filter((issue) => !visibleЗадачаIds.has(issue.id))
    .filter((issue) =>
      matchesВходящиеЗадачаПоиск(issue, normalizedQuery, {
        isolatedРабочие областиВключитьd,
        executionРабочая областьById,
        projectРабочая областьById,
        defaultProjectРабочая областьIdByProjectId,
      }),
    )
    .sort(sortЗадачиByMostRecentАктивность);
}

export function getВходящиеПоискSupplementЗадачи({
  query,
  filteredРаботаItems,
  archivedПоискЗадачи,
  remoteЗадачи,
  issueФильтрs,
  currentUserId,
  enableПроцедураVisibilityФильтр = false,
  liveЗадачаIds,
}: {
  query: string;
  filteredРаботаItems: ВходящиеРаботаItem[];
  archivedПоискЗадачи: Задача[];
  remoteЗадачи: Задача[];
  issueФильтрs: ЗадачаФильтрState;
  currentUserId?: string | null;
  enableПроцедураVisibilityФильтр?: boolean;
  liveЗадачаIds?: ReadonlySet<string>;
}): Задача[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const visibleЗадачаIds = new Set([
    ...filteredРаботаItems
      .filter((item): item is Extract<ВходящиеРаботаItem, { kind: "issue" }> => item.kind === "issue")
      .map((item) => item.issue.id),
    ...archivedПоискЗадачи.map((issue) => issue.id),
  ]);
  return applyЗадачаФильтрs(remoteЗадачи, issueФильтрs, currentUserId, enableПроцедураVisibilityФильтр, liveЗадачаIds)
    .filter((issue) => !visibleЗадачаIds.has(issue.id));
}

function formatПо умолчаниюРабочая областьGroupLabel(name: string | null | undefined): string {
  const normalizedИмя = name?.trim();
  return normalizedИмя ? `${normalizedИмя} (default)` : "По умолчанию workspace";
}

function resolveПо умолчаниюProjectРабочая областьInfo(
  issue: Pick<Задача, "projectId">,
  {
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  }: Pick<ВходящиеРабочая областьGroupingOptions, "projectРабочая областьById" | "defaultProjectРабочая областьIdByProjectId">,
): { id: string; label: string } | null {
  if (!issue.projectId) return null;
  const defaultProjectРабочая областьId = defaultProjectРабочая областьIdByProjectId?.get(issue.projectId) ?? null;
  if (!defaultProjectРабочая областьId) return null;
  return {
    id: defaultProjectРабочая областьId,
    label: formatПо умолчаниюРабочая областьGroupLabel(projectРабочая областьById?.get(defaultProjectРабочая областьId)?.name),
  };
}

export function resolveЗадачаРабочая областьИмя(
  issue: Pick<Задача, "executionРабочая областьId" | "projectId" | "projectРабочая областьId">,
  {
    executionРабочая областьById,
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  }: ВходящиеРабочая областьGroupingOptions,
): string | null {
  const defaultProjectРабочая областьId = issue.projectId
    ? defaultProjectРабочая областьIdByProjectId?.get(issue.projectId) ?? null
    : null;

  if (issue.executionРабочая областьId) {
    const executionРабочая область = executionРабочая областьById?.get(issue.executionРабочая областьId) ?? null;
    const linkedProjectРабочая областьId =
      executionРабочая область?.projectРабочая областьId ?? issue.projectРабочая областьId ?? null;
    const isПо умолчаниюSharedExecutionРабочая область =
      executionРабочая область?.mode === "shared_workspace" && linkedProjectРабочая областьId === defaultProjectРабочая областьId;
    if (isПо умолчаниюSharedExecutionРабочая область) return null;

    const workspaceИмя = executionРабочая область?.name;
    if (workspaceИмя) return workspaceИмя;
  }

  if (issue.projectРабочая областьId) {
    if (issue.projectРабочая областьId === defaultProjectРабочая областьId) return null;
    const workspaceИмя = projectРабочая областьById?.get(issue.projectРабочая областьId)?.name;
    if (workspaceИмя) return workspaceИмя;
  }

  return null;
}

export function resolveЗадачаРабочая областьGroup(
  issue: Pick<Задача, "executionРабочая областьId" | "projectId" | "projectРабочая областьId">,
  {
    executionРабочая областьById,
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  }: ВходящиеРабочая областьGroupingOptions = {},
): { key: string; label: string } {
  const defaultProjectРабочая область = resolveПо умолчаниюProjectРабочая областьInfo(issue, {
    projectРабочая областьById,
    defaultProjectРабочая областьIdByProjectId,
  });

  if (issue.executionРабочая областьId) {
    const executionРабочая область = executionРабочая областьById?.get(issue.executionРабочая областьId) ?? null;
    const linkedProjectРабочая областьId =
      executionРабочая область?.projectРабочая областьId ?? issue.projectРабочая областьId ?? null;
    const isПо умолчаниюSharedExecutionРабочая область =
      executionРабочая область?.mode === "shared_workspace"
      && linkedProjectРабочая областьId != null
      && linkedProjectРабочая областьId === defaultProjectРабочая область?.id;

    if (isПо умолчаниюSharedExecutionРабочая область && defaultProjectРабочая область) {
      return {
        key: `workspace:project:${defaultProjectРабочая область.id}`,
        label: defaultProjectРабочая область.label,
      };
    }

    const workspaceИмя = executionРабочая область?.name?.trim();
    if (workspaceИмя) {
      return {
        key: `workspace:execution:${issue.executionРабочая областьId}`,
        label: workspaceИмя,
      };
    }
  }

  if (issue.projectРабочая областьId) {
    if (issue.projectРабочая областьId === defaultProjectРабочая область?.id) {
      return {
        key: `workspace:project:${defaultProjectРабочая область.id}`,
        label: defaultProjectРабочая область.label,
      };
    }

    const workspaceИмя = projectРабочая областьById?.get(issue.projectРабочая областьId)?.name?.trim();
    if (workspaceИмя) {
      return {
        key: `workspace:project:${issue.projectРабочая областьId}`,
        label: workspaceИмя,
      };
    }
  }

  if (defaultProjectРабочая область) {
    return {
      key: `workspace:project:${defaultProjectРабочая область.id}`,
      label: defaultProjectРабочая область.label,
    };
  }

  return {
    key: "workspace:none",
    label: "Нет workspace",
  };
}

export function loadВходящиеNesting(): boolean {
  try {
    const raw = localStorage.getItem(INBOX_NESTING_KEY);
    return raw !== "false";
  } catch {
    return true;
  }
}

export function saveВходящиеNesting(enabled: boolean) {
  try {
    localStorage.setItem(INBOX_NESTING_KEY, String(enabled));
  } catch {
    // Ignore localStorage failures.
  }
}

export function resolveВходящиеNestingВключитьd(preferenceВключитьd: boolean, isMobile: boolean): boolean {
  return preferenceВключитьd && !isMobile;
}

export function loadLastВходящиеTab(): ВходящиеTab {
  try {
    const raw = localStorage.getItem(INBOX_LAST_TAB_KEY);
    if (raw === "all" || raw === "unread" || raw === "recent" || raw === "mine") return raw;
    if (raw === "new") return "mine";
    return "mine";
  } catch {
    return "mine";
  }
}

export function saveLastВходящиеTab(tab: ВходящиеTab) {
  try {
    localStorage.setItem(INBOX_LAST_TAB_KEY, tab);
  } catch {
    // Ignore localStorage failures.
  }
}

export function isMineВходящиеTab(tab: ВходящиеTab): boolean {
  return tab === "mine";
}

export function shouldShowКомпанияAlerts(tab: ВходящиеTab): boolean {
  return tab === "all";
}

export function resolveВходящиеSelectionIndex(
  previousIndex: number,
  itemCount: number,
): number {
  if (itemCount === 0) return -1;
  if (previousIndex < 0) return -1;
  return Math.min(previousIndex, itemCount - 1);
}

export function getВходящиеКлючboardSelectionIndex(
  previousIndex: number,
  itemCount: number,
  direction: "next" | "previous",
): number {
  if (itemCount === 0) return -1;
  if (previousIndex < 0) return 0;
  return direction === "next"
    ? Math.min(previousIndex + 1, itemCount - 1)
    : Math.max(previousIndex - 1, 0);
}

export function getLatestОшибкаЗапуститьsByАгент(runs: HeartbeatЗапустить[]): HeartbeatЗапустить[] {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestByАгент = new Map<string, HeartbeatЗапустить>();

  for (const run of sorted) {
    if (!latestByАгент.has(run.agentId)) {
      latestByАгент.set(run.agentId, run);
    }
  }

  return Array.from(latestByАгент.values()).filter((run) => FAILED_RUN_STATUSES.has(run.status));
}

export function normalizeTimestamp(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function issueLastАктивностьTimestamp(issue: Задача): number {
  const lastАктивностьAt = normalizeTimestamp(issue.lastАктивностьAt);
  if (lastАктивностьAt > 0) return lastАктивностьAt;

  const lastExternalCommentAt = normalizeTimestamp(issue.lastExternalCommentAt);
  if (lastExternalCommentAt > 0) return lastExternalCommentAt;

  return normalizeTimestamp(issue.updatedAt);
}

export function sortЗадачиByMostRecentАктивность(a: Задача, b: Задача): number {
  const activityDiff = issueLastАктивностьTimestamp(b) - issueLastАктивностьTimestamp(a);
  if (activityDiff !== 0) return activityDiff;
  return normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt);
}

export function getRecentTouchedЗадачи(issues: Задача[]): Задача[] {
  return [...issues].sort(sortЗадачиByMostRecentАктивность).slice(0, RECENT_ISSUES_LIMIT);
}

export function getUnreadTouchedЗадачи(issues: Задача[]): Задача[] {
  return issues.filter((issue) => issue.isUnreadForMe);
}

export function getСогласованияForTab(
  approvals: Согласование[],
  tab: ВходящиеTab,
  filter: ВходящиеСогласованиеФильтр,
  currentUserId?: string | null,
): Согласование[] {
  const sortedСогласования = [...approvals].sort(
    (a, b) => normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt),
  );

  if (tab === "mine") {
    return sortedСогласования.filter((approval) => isСогласованиеVisibleInMine(approval, currentUserId));
  }
  if (tab === "recent") return sortedСогласования;
  if (tab === "unread") {
    return sortedСогласования.filter((approval) => ACTIONABLE_APPROVAL_STATUSES.has(approval.status));
  }
  if (filter === "all") return sortedСогласования;

  return sortedСогласования.filter((approval) => {
    const isActionable = ACTIONABLE_APPROVAL_STATUSES.has(approval.status);
    return filter === "actionable" ? isActionable : !isActionable;
  });
}

export function isСогласованиеVisibleInMine(
  approval: Согласование,
  currentUserId?: string | null,
): boolean {
  if (ACTIONABLE_APPROVAL_STATUSES.has(approval.status)) return true;
  if (!currentUserId) return false;
  return approval.requestedByUserId === currentUserId || approval.decidedByUserId === currentUserId;
}

export function approvalАктивностьTimestamp(approval: Согласование): number {
  const updatedAt = normalizeTimestamp(approval.updatedAt);
  if (updatedAt > 0) return updatedAt;
  return normalizeTimestamp(approval.createdAt);
}

export function getВходящиеРаботаItems({
  issues,
  approvals,
  failedЗапуститьs = [],
  joinRequests = [],
}: {
  issues: Задача[];
  approvals: Согласование[];
  failedЗапуститьs?: HeartbeatЗапустить[];
  joinRequests?: JoinRequest[];
}): ВходящиеРаботаItem[] {
  return [
    ...issues.map((issue) => ({
      kind: "issue" as const,
      timestamp: issueLastАктивностьTimestamp(issue),
      issue,
    })),
    ...approvals.map((approval) => ({
      kind: "approval" as const,
      timestamp: approvalАктивностьTimestamp(approval),
      approval,
    })),
    ...failedЗапуститьs.map((run) => ({
      kind: "failed_run" as const,
      timestamp: normalizeTimestamp(run.createdAt),
      run,
    })),
    ...joinRequests.map((joinRequest) => ({
      kind: "join_request" as const,
      timestamp: normalizeTimestamp(joinRequest.createdAt),
      joinRequest,
    })),
  ].sort((a, b) => {
    const timestampDiff = b.timestamp - a.timestamp;
    if (timestampDiff !== 0) return timestampDiff;

    if (a.kind === "issue" && b.kind === "issue") {
      return sortЗадачиByMostRecentАктивность(a.issue, b.issue);
    }
    if (a.kind === "approval" && b.kind === "approval") {
      return approvalАктивностьTimestamp(b.approval) - approvalАктивностьTimestamp(a.approval);
    }

    return a.kind === "approval" ? -1 : 1;
  });
}

const inboxРаботаItemKindOrder: ВходящиеРаботаItem["kind"][] = [
  "issue",
  "approval",
  "failed_run",
  "join_request",
];

const inboxРаботаItemKindЯрлыки: Record<ВходящиеРаботаItem["kind"], string> = {
  issue: "Задачи",
  approval: "Согласования",
  failed_run: "Ошибка runs",
  join_request: "Join requests",
};

function resolveЗадачаИсполнительGroup(
  issue: Pick<Задача, "assigneeАгентId" | "assigneeUserId">,
  {
    agentById,
    currentUserId,
    userLabelById,
  }: Pick<ВходящиеРабочая областьGroupingOptions, "agentById" | "currentUserId" | "userLabelById">,
): { key: string; label: string } {
  if (issue.assigneeАгентId) {
    const agentИмя = agentById?.get(issue.assigneeАгентId)?.trim();
    return {
      key: `assignee:agent:${issue.assigneeАгентId}`,
      label: agentИмя || issue.assigneeАгентId.slice(0, 8),
    };
  }

  if (issue.assigneeUserId) {
    return {
      key: `assignee:user:${issue.assigneeUserId}`,
      label: formatИсполнительUserLabel(issue.assigneeUserId, currentUserId, userLabelById) ?? "User",
    };
  }

  return { key: "assignee:none", label: "Не назначен" };
}

function resolveЗадачаProjectGroup(
  issue: Pick<Задача, "projectId">,
  { projectById }: Pick<ВходящиеРабочая областьGroupingOptions, "projectById">,
): { key: string; label: string } {
  if (!issue.projectId) return { key: "project:none", label: "Нет project" };

  const projectИмя = projectById?.get(issue.projectId)?.name?.trim();
  return {
    key: `project:${issue.projectId}`,
    label: projectИмя || issue.projectId.slice(0, 8),
  };
}

function groupВходящиеРаботаItemsByЗадачаGroup(
  items: ВходящиеРаботаItem[],
  resolveЗадачаGroup: (issue: Задача) => { key: string; label: string },
): ВходящиеРаботаItemGroup[] {
  const groups = new Map<string, { label: string; items: ВходящиеРаботаItem[]; latestTimestamp: number }>();
  for (const item of items) {
    const resolvedGroup = item.kind === "issue"
      ? resolveЗадачаGroup(item.issue)
      : { key: `kind:${item.kind}`, label: inboxРаботаItemKindЯрлыки[item.kind] };
    const existing = groups.get(resolvedGroup.key);
    if (existing) {
      existing.items.push(item);
      existing.latestTimestamp = Math.max(existing.latestTimestamp, item.timestamp);
    } else {
      groups.set(resolvedGroup.key, {
        label: resolvedGroup.label,
        items: [item],
        latestTimestamp: item.timestamp,
      });
    }
  }

  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      items: value.items,
      latestTimestamp: value.latestTimestamp,
    }))
    .sort((a, b) => {
      const timestampDiff = b.latestTimestamp - a.latestTimestamp;
      if (timestampDiff !== 0) return timestampDiff;
      return a.label.localeCompare(b.label);
    })
    .map(({ key, label, items: groupItems }) => ({
      key,
      label,
      items: groupItems,
    }));
}

export function groupВходящиеРаботаItems(
  items: ВходящиеРаботаItem[],
  groupBy: ВходящиеРаботаItemGroupBy,
  options: ВходящиеРабочая областьGroupingOptions = {},
): ВходящиеРаботаItemGroup[] {
  if (groupBy === "none") {
    return [{ key: "__all", label: null, items }];
  }

  if (groupBy === "workspace") {
    return groupВходящиеРаботаItemsByЗадачаGroup(items, (issue) => resolveЗадачаРабочая областьGroup(issue, options));
  }

  if (groupBy === "assignee") {
    return groupВходящиеРаботаItemsByЗадачаGroup(items, (issue) => resolveЗадачаИсполнительGroup(issue, options));
  }

  if (groupBy === "project") {
    return groupВходящиеРаботаItemsByЗадачаGroup(items, (issue) => resolveЗадачаProjectGroup(issue, options));
  }

  const groups = new Map<ВходящиеРаботаItem["kind"], ВходящиеРаботаItem[]>();
  for (const item of items) {
    const existing = groups.get(item.kind) ?? [];
    existing.push(item);
    groups.set(item.kind, existing);
  }

  const orderedGroups: ВходящиеРаботаItemGroup[] = [];
  for (const kind of inboxРаботаItemKindOrder) {
    const groupItems = groups.get(kind) ?? [];
    if (groupItems.length === 0) continue;
    orderedGroups.push({
        key: kind,
        label: inboxРаботаItemKindЯрлыки[kind],
        items: groupItems,
    });
  }
  return orderedGroups;
}

function stripВходящиеПоискGroupPrefix(groupКлюч: string) {
  return groupКлюч
    .replace(/^archived-search:/, "")
    .replace(/^other-search:/, "");
}

function firstЗадачаFromВходящиеРаботаItems(items: ВходящиеРаботаItem[]): Задача | null {
  return items.find((item): item is ВходящиеРаботаItem & { kind: "issue" } => item.kind === "issue")?.issue ?? null;
}

function projectIdForProjectРабочая область(
  projectРабочая областьId: string | null | undefined,
  options: ВходящиеРабочая областьGroupingOptions,
  fallbackЗадача: Задача | null,
) {
  if (!projectРабочая областьId) return fallbackЗадача?.projectId ?? null;
  return options.projectРабочая областьById?.get(projectРабочая областьId)?.projectId
    ?? (fallbackЗадача?.projectРабочая областьId === projectРабочая областьId ? fallbackЗадача.projectId : null);
}

export function buildВходящиеЗадачаGroupСоздатьПо умолчаниюs(
  groupКлюч: string,
  groupBy: ВходящиеРаботаItemGroupBy,
  items: ВходящиеРаботаItem[],
  options: ВходящиеРабочая областьGroupingOptions = {},
): ВходящиеЗадачаGroupСоздатьПо умолчаниюs | null {
  const fallbackЗадача = firstЗадачаFromВходящиеРаботаItems(items);
  if (!fallbackЗадача) return null;

  const key = stripВходящиеПоискGroupPrefix(groupКлюч);
  if (groupBy === "project") {
    if (!key.startsWith("project:")) return {};
    const projectId = key.slice("project:".length);
    return projectId && projectId !== "none" ? { projectId } : {};
  }

  if (groupBy === "assignee") {
    if (key.startsWith("assignee:agent:")) {
      const assigneeАгентId = key.slice("assignee:agent:".length);
      return assigneeАгентId ? { assigneeАгентId } : {};
    }
    if (key.startsWith("assignee:user:")) {
      const assigneeUserId = key.slice("assignee:user:".length);
      return assigneeUserId ? { assigneeUserId } : {};
    }
    return {};
  }

  if (groupBy === "workspace") {
    if (key.startsWith("workspace:execution:")) {
      const executionРабочая областьId = key.slice("workspace:execution:".length);
      if (!executionРабочая областьId) return {};
      const executionРабочая область = options.executionРабочая областьById?.get(executionРабочая областьId) ?? null;
      const projectРабочая областьId = executionРабочая область?.projectРабочая областьId
        ?? (fallbackЗадача.executionРабочая областьId === executionРабочая областьId ? fallbackЗадача.projectРабочая областьId : null);
      const projectId = executionРабочая область?.projectId
        ?? projectIdForProjectРабочая область(projectРабочая областьId, options, fallbackЗадача);
      return {
        executionРабочая областьId,
        executionРабочая областьMode: "reuse_existing",
        ...(projectId ? { projectId } : {}),
        ...(projectРабочая областьId ? { projectРабочая областьId } : {}),
      };
    }

    if (key.startsWith("workspace:project:")) {
      const projectРабочая областьId = key.slice("workspace:project:".length);
      if (!projectРабочая областьId) return {};
      const projectId = projectIdForProjectРабочая область(projectРабочая областьId, options, fallbackЗадача);
      return {
        ...(projectId ? { projectId } : {}),
        projectРабочая областьId,
      };
    }
  }

  return {};
}

/**
 * Groups parent-child issues in a flat ВходящиеРаботаItem list.
 *
 * - Children whose parent is also in the list are removed from the top level
 *   and stored in `childrenByЗадачаId`.
 * - The parent's sort timestamp becomes max(parent, children) so that a group
 *   with a recently-updated child floats to the top.
 * - If a parent is absent (e.g. archived), children remain as independent roots.
 */
export function buildВходящиеNesting(items: ВходящиеРаботаItem[]): {
  displayItems: ВходящиеРаботаItem[];
  childrenByЗадачаId: Map<string, Задача[]>;
} {
  const issueItems: (ВходящиеРаботаItem & { kind: "issue" })[] = [];
  const nonЗадачаItems: ВходящиеРаботаItem[] = [];
  for (const item of items) {
    if (item.kind === "issue") issueItems.push(item as ВходящиеРаботаItem & { kind: "issue" });
    else nonЗадачаItems.push(item);
  }

  const issueIdSet = new Set(issueItems.map((i) => i.issue.id));
  const childrenByЗадачаId = new Map<string, Задача[]>();
  const childIds = new Set<string>();

  for (const item of issueItems) {
    const { issue } = item;
    if (issue.parentId && issueIdSet.has(issue.parentId)) {
      childIds.add(issue.id);
      const arr = childrenByЗадачаId.get(issue.parentId) ?? [];
      arr.push(issue);
      childrenByЗадачаId.set(issue.parentId, arr);
    }
  }

  const subtreeАктивностьTimestamp = (issue: Задача, seen: ReadonlySet<string> = new Set()): number => {
    const ownTimestamp = issueLastАктивностьTimestamp(issue);
    if (seen.has(issue.id)) return ownTimestamp;
    const nextSeen = new Set(seen);
    nextSeen.add(issue.id);
    const children = childrenByЗадачаId.get(issue.id) ?? [];
    if (children.length === 0) return ownTimestamp;
    return Math.max(
      ownTimestamp,
      ...children.map((child) => subtreeАктивностьTimestamp(child, nextSeen)),
    );
  };

  // Сортировка each child list by most recent descendant activity, not just direct issue activity.
  for (const children of childrenByЗадачаId.values()) {
    children.sort((a, b) => {
      const activityDiff = subtreeАктивностьTimestamp(b) - subtreeАктивностьTimestamp(a);
      if (activityDiff !== 0) return activityDiff;
      return sortЗадачиByMostRecentАктивность(a, b);
    });
  }

  // Build root issue items with group-adjusted timestamps
  const rootЗадачаItems: ВходящиеРаботаItem[] = issueItems
    .filter((item) => !childIds.has(item.issue.id))
    .map((item) => {
      const children = childrenByЗадачаId.get(item.issue.id);
      if (!children?.length) return item;
      const maxChildTs = Math.max(...children.map((child) => subtreeАктивностьTimestamp(child)));
      return { ...item, timestamp: Math.max(item.timestamp, maxChildTs) };
    });

  // Merge and re-sort
  const displayItems = [...rootЗадачаItems, ...nonЗадачаItems].sort((a, b) => {
    const diff = b.timestamp - a.timestamp;
    if (diff !== 0) return diff;
    if (a.kind === "issue" && b.kind === "issue") {
      return sortЗадачиByMostRecentАктивность(a.issue, b.issue);
    }
    return 0;
  });

  return { displayItems, childrenByЗадачаId };
}

export function buildGroupedВходящиеSections(
  items: ВходящиеРаботаItem[],
  groupBy: ВходящиеРаботаItemGroupBy,
  workspaceGrouping: ВходящиеРабочая областьGroupingOptions,
  options?: { keyPrefix?: string; searchSection?: ВходящиеПоискSection; nestingВключитьd?: boolean },
): ВходящиеGroupedSection[] {
  const keyPrefix = options?.keyPrefix ?? "";
  const searchSection = options?.searchSection ?? "none";
  const nestingВключитьd = options?.nestingВключитьd ?? false;

  return groupВходящиеРаботаItems(items, groupBy, workspaceGrouping).map((group) => {
    const nestedGroup = nestingВключитьd && group.items.some((item) => item.kind === "issue")
      ? buildВходящиеNesting(group.items)
      : { displayItems: group.items, childrenByЗадачаId: new Map<string, Задача[]>() };

    return {
      key: `${keyPrefix}${group.key}`,
      label: group.label,
      displayItems: nestedGroup.displayItems,
      childrenByЗадачаId: nestedGroup.childrenByЗадачаId,
      searchSection,
    };
  });
}

export function getВходящиеРаботаItemКлюч(item: ВходящиеРаботаItem): string {
  if (item.kind === "issue") return `issue:${item.issue.id}`;
  if (item.kind === "approval") return `approval:${item.approval.id}`;
  if (item.kind === "failed_run") return `run:${item.run.id}`;
  return `join:${item.joinRequest.id}`;
}

export function buildВходящиеКлючboardNavEntries(
  groupedSections: ReadonlyArray<ВходящиеКлючboardGroupSection>,
  collapsedGroupКлючs: ReadonlySet<string>,
  collapsedВходящиеРодительs: ReadonlySet<string>,
): ВходящиеКлючboardNavEntry[] {
  const entries: ВходящиеКлючboardNavEntry[] = [];

  for (const group of groupedSections) {
    const isCollapsed = collapsedGroupКлючs.has(group.key);
    if (group.label) {
      entries.push({
        type: "group",
        groupКлюч: group.key,
        label: group.label,
        collapsed: isCollapsed,
      });
    }
    if (isCollapsed) continue;

    const addЗадачаChildren = (issueId: string, seen: ReadonlySet<string>) => {
      const children = group.childrenByЗадачаId.get(issueId);
      if (!children?.length || collapsedВходящиеРодительs.has(issueId)) return;

      for (const child of children) {
        if (seen.has(child.id)) continue;
        const nextSeen = new Set(seen);
        nextSeen.add(child.id);
        entries.push({
          type: "child",
          issueId: child.id,
          issue: child,
        });
        addЗадачаChildren(child.id, nextSeen);
      }
    };

    for (const item of group.displayItems) {
      entries.push({
        type: "top",
        itemКлюч: `${group.key}:${getВходящиеРаботаItemКлюч(item)}`,
        item,
      });

      if (item.kind !== "issue") continue;
      addЗадачаChildren(item.issue.id, new Set([item.issue.id]));
    }
  }

  return entries;
}

export function shouldShowВходящиеSection({
  tab,
  hasItems,
  showOnMine,
  showOnRecent,
  showOnUnread,
  showOnВсе,
}: {
  tab: ВходящиеTab;
  hasItems: boolean;
  showOnMine: boolean;
  showOnRecent: boolean;
  showOnUnread: boolean;
  showOnВсе: boolean;
}): boolean {
  if (!hasItems) return false;
  if (tab === "mine") return showOnMine;
  if (tab === "recent") return showOnRecent;
  if (tab === "unread") return showOnUnread;
  return showOnВсе;
}

export function computeВходящиеBadgeData({
  approvals,
  joinRequests,
  dashboard,
  heartbeatЗапуститьs,
  mineЗадачи,
  dismissedAlerts,
  dismissedAtByКлюч,
  currentUserId,
}: {
  approvals: Согласование[];
  joinRequests: JoinRequest[];
  dashboard: Панель управленияSummary | undefined;
  heartbeatЗапуститьs: HeartbeatЗапустить[];
  mineЗадачи: Задача[];
  dismissedAlerts: Set<string>;
  dismissedAtByКлюч: ReadonlyMap<string, number>;
  currentUserId?: string | null;
}): ВходящиеBadgeData {
  const actionableСогласования = approvals.filter(
    (approval) =>
      isСогласованиеVisibleInMine(approval, currentUserId) &&
      ACTIONABLE_APPROVAL_STATUSES.has(approval.status) &&
      !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `approval:${approval.id}`, approval.updatedAt),
  ).length;
  const failedЗапуститьs = getLatestОшибкаЗапуститьsByАгент(heartbeatЗапуститьs).filter(
    (run) => !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `run:${run.id}`, run.createdAt),
  ).length;
  const visibleJoinRequests = joinRequests.filter(
    (jr) => !isВходящиеEntityЗакрытьed(dismissedAtByКлюч, `join:${jr.id}`, jr.updatedAt ?? jr.createdAt),
  ).length;
  const visibleMineЗадачи = mineЗадачи.filter((issue) => issue.isUnreadForMe).length;
  const agentОшибкаCount = dashboard?.agents.error ?? 0;
  const monthБюджетCents = dashboard?.costs.monthБюджетCents ?? 0;
  const monthUtilizationPercent = dashboard?.costs.monthUtilizationPercent ?? 0;
  const showAggregateАгентОшибка =
    agentОшибкаCount > 0 &&
    failedЗапуститьs === 0 &&
    !dismissedAlerts.has("alert:agent-errors");
  const showБюджетAlert =
    monthБюджетCents > 0 &&
    monthUtilizationPercent >= 80 &&
    !dismissedAlerts.has("alert:budget");
  const alerts = Number(showAggregateАгентОшибка) + Number(showБюджетAlert);

  return {
    // The inbox badge reflects personal/actionable work, not company-wide health alerts.
    inbox: actionableСогласования + visibleJoinRequests + failedЗапуститьs + visibleMineЗадачи,
    approvals: actionableСогласования,
    failedЗапуститьs,
    joinRequests: visibleJoinRequests,
    mineЗадачи: visibleMineЗадачи,
    alerts,
  };
}
