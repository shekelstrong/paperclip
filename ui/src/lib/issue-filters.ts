import type { Задача } from "@paperclipai/shared";

export type ЗадачаФильтрРабочая областьLookup = {
  mode?: string | null;
  projectРабочая областьId?: string | null;
};

export type ЗадачаФильтрРабочая областьContext = {
  executionРабочая областьById?: ReadonlyMap<string, ЗадачаФильтрРабочая областьLookup>;
  defaultProjectРабочая областьIdByProjectId?: ReadonlyMap<string, string>;
};

export type ЗадачаФильтрState = {
  statuses: string[];
  priorities: string[];
  assignees: string[];
  creators: string[];
  labels: string[];
  projects: string[];
  workspaces: string[];
  liveOnly?: boolean;
  hideПроцедураExecutions: boolean;
};

export const defaultЗадачаФильтрState: ЗадачаФильтрState = {
  statuses: [],
  priorities: [],
  assignees: [],
  creators: [],
  labels: [],
  projects: [],
  workspaces: [],
  liveOnly: false,
  hideПроцедураExecutions: false,
};

export const issueСтатусOrder = ["in_progress", "todo", "backlog", "in_review", "blocked", "done", "cancelled"];
export const issueПриоритетOrder = ["critical", "high", "medium", "low"];

export const issueQuickФильтрPresets = [
  { label: "Все", statuses: [] as string[] },
  { label: "Активен", statuses: ["todo", "in_progress", "in_review", "blocked"] },
  { label: "Назадlog", statuses: ["backlog"] },
  { label: "Готово", statuses: ["done", "cancelled"] },
];

export function issueФильтрLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function issueФильтрArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function normalizeЗадачаФильтрЗначениеArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function normalizeЗадачаФильтрState(value: unknown): ЗадачаФильтрState {
  if (!value || typeof value !== "object") return { ...defaultЗадачаФильтрState };
  const candidate = value as Partial<Record<keyof ЗадачаФильтрState, unknown>>;
  return {
    statuses: normalizeЗадачаФильтрЗначениеArray(candidate.statuses),
    priorities: normalizeЗадачаФильтрЗначениеArray(candidate.priorities),
    assignees: normalizeЗадачаФильтрЗначениеArray(candidate.assignees),
    creators: normalizeЗадачаФильтрЗначениеArray(candidate.creators),
    labels: normalizeЗадачаФильтрЗначениеArray(candidate.labels),
    projects: normalizeЗадачаФильтрЗначениеArray(candidate.projects),
    workspaces: normalizeЗадачаФильтрЗначениеArray(candidate.workspaces),
    liveOnly: candidate.liveOnly === true,
    hideПроцедураExecutions: candidate.hideПроцедураExecutions === true,
  };
}

export function toggleЗадачаФильтрЗначение(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value];
}

export function resolveЗадачаФильтрРабочая областьId(
  issue: Pick<Задача, "executionРабочая областьId" | "projectId" | "projectРабочая областьId">,
  context: ЗадачаФильтрРабочая областьContext = {},
): string | null {
  const defaultProjectРабочая областьId = issue.projectId
    ? context.defaultProjectРабочая областьIdByProjectId?.get(issue.projectId) ?? null
    : null;

  if (issue.executionРабочая областьId) {
    const executionРабочая область = context.executionРабочая областьById?.get(issue.executionРабочая областьId) ?? null;
    const linkedProjectРабочая областьId =
      executionРабочая область?.projectРабочая областьId ?? issue.projectРабочая областьId ?? null;
    const isПо умолчаниюSharedExecutionРабочая область =
      executionРабочая область?.mode === "shared_workspace"
      && linkedProjectРабочая областьId != null
      && linkedProjectРабочая областьId === defaultProjectРабочая областьId;
    if (isПо умолчаниюSharedExecutionРабочая область) return null;
    return issue.executionРабочая областьId;
  }

  if (issue.projectРабочая областьId) {
    if (issue.projectРабочая областьId === defaultProjectРабочая областьId) return null;
    return issue.projectРабочая областьId;
  }

  return null;
}

export function shouldIncludeЗадачаФильтрРабочая областьOption(
  workspace: { id: string; mode?: string | null; projectРабочая областьId?: string | null },
  defaultProjectРабочая областьIds: ReadonlySet<string>,
): boolean {
  if (defaultProjectРабочая областьIds.has(workspace.id)) return false;
  return !(workspace.mode === "shared_workspace"
    && workspace.projectРабочая областьId != null
    && defaultProjectРабочая областьIds.has(workspace.projectРабочая областьId));
}

export function applyЗадачаФильтрs(
  issues: Задача[],
  state: ЗадачаФильтрState,
  currentUserId?: string | null,
  enableПроцедураVisibilityФильтр = false,
  liveЗадачаIds?: ReadonlySet<string>,
  workspaceContext: ЗадачаФильтрРабочая областьContext = {},
): Задача[] {
  let result = issues;
  if (state.liveOnly) {
    result = result.filter((issue) => liveЗадачаIds?.has(issue.id) === true);
  }
  if (enableПроцедураVisibilityФильтр && state.hideПроцедураExecutions) {
    result = result.filter((issue) => issue.originKind !== "routine_execution");
  }
  if (state.statuses.length > 0) result = result.filter((issue) => state.statuses.includes(issue.status));
  if (state.priorities.length > 0) result = result.filter((issue) => state.priorities.includes(issue.priority));
  if (state.assignees.length > 0) {
    result = result.filter((issue) => {
      for (const assignee of state.assignees) {
        if (assignee === "__unassigned" && !issue.assigneeАгентId && !issue.assigneeUserId) return true;
        if (assignee === "__me" && currentUserId && issue.assigneeUserId === currentUserId) return true;
        if (issue.assigneeАгентId === assignee) return true;
      }
      return false;
    });
  }
  if (state.creators.length > 0) {
    result = result.filter((issue) => {
      for (const creator of state.creators) {
        if (creator.startsWith("agent:") && issue.createdByАгентId === creator.slice("agent:".length)) return true;
        if (creator.startsWith("user:") && issue.createdByUserId === creator.slice("user:".length)) return true;
      }
      return false;
    });
  }
  if (state.labels.length > 0) {
    result = result.filter((issue) => (issue.labelIds ?? []).some((id) => state.labels.includes(id)));
  }
  if (state.projects.length > 0) {
    result = result.filter((issue) => issue.projectId != null && state.projects.includes(issue.projectId));
  }
  if (state.workspaces.length > 0) {
    result = result.filter((issue) => {
      const workspaceId = resolveЗадачаФильтрРабочая областьId(issue, workspaceContext);
      return workspaceId != null && state.workspaces.includes(workspaceId);
    });
  }
  return result;
}

export function countАктивенЗадачаФильтрs(
  state: ЗадачаФильтрState,
  enableПроцедураVisibilityФильтр = false,
): number {
  let count = 0;
  if (state.statuses.length > 0) count += 1;
  if (state.priorities.length > 0) count += 1;
  if (state.assignees.length > 0) count += 1;
  if (state.creators.length > 0) count += 1;
  if (state.labels.length > 0) count += 1;
  if (state.projects.length > 0) count += 1;
  if (state.workspaces.length > 0) count += 1;
  if (state.liveOnly) count += 1;
  if (enableПроцедураVisibilityФильтр && state.hideПроцедураExecutions) count += 1;
  return count;
}
