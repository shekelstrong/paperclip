import type { ExecutionРабочая область, Задача, Project } from "@paperclipai/shared";

type ProjectРабочая областьLike = Pick<Project, "workspaces" | "primaryРабочая область">;

export interface ProjectРабочая областьSummary {
  key: string;
  kind: "execution_workspace" | "project_workspace";
  workspaceId: string;
  workspaceИмя: string;
  cwd: string | null;
  branchИмя: string | null;
  lastОбновленоAt: Date;
  projectРабочая областьId: string | null;
  executionРабочая областьId: string | null;
  executionРабочая областьСтатус: ExecutionРабочая область["status"] | null;
  serviceCount: number;
  runningServiceCount: number;
  primaryServiceUrl: string | null;
  primaryServiceUrlВыполняется: boolean;
  hasЗапуститьtimeConfig: boolean;
  issues: Задача[];
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function maxDate(...values: Array<Date | string | null | undefined>): Date {
  let latest = new Date(0);
  for (const value of values) {
    const date = toDate(value);
    if (date && date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

function primaryРабочая областьId(project: ProjectРабочая областьLike): string | null {
  return project.primaryРабочая область?.id
    ?? project.workspaces.find((workspace) => workspace.isPrimary)?.id
    ?? project.workspaces[0]?.id
    ?? null;
}

function isПо умолчаниюSharedExecutionРабочая область(input: {
  executionРабочая область: ExecutionРабочая область;
  issue: Задача;
  primaryРабочая областьId: string | null;
}) {
  const linkedProjectРабочая областьId =
    input.executionРабочая область.projectРабочая областьId ?? input.issue.projectРабочая областьId ?? null;
  return input.executionРабочая область.mode === "shared_workspace" && linkedProjectРабочая областьId === input.primaryРабочая областьId;
}

function runtimeServiceSummary(
  services: НетnNullable<ExecutionРабочая область["runtimeServices"]> | undefined,
) {
  const serviceCount = services?.length ?? 0;
  const runningServiceCount = services?.filter((service) => service.status === "running").length ?? 0;
  const primaryService =
    services?.find((service) => service.status === "running" && service.url)
    ?? services?.find((service) => service.url)
    ?? null;

  return {
    serviceCount,
    runningServiceCount,
    primaryServiceUrl: primaryService?.url ?? null,
    primaryServiceUrlВыполняется: primaryService?.status === "running",
  };
}

export function buildProjectРабочая областьSummaries(input: {
  project: ProjectРабочая областьLike;
  issues: Задача[];
  executionРабочие области: ExecutionРабочая область[];
}): ProjectРабочая областьSummary[] {
  const primaryId = primaryРабочая областьId(input.project);
  const executionРабочие областиById = new Map(
    input.executionРабочие области.map((workspace) => [workspace.id, workspace] as const),
  );
  const projectРабочие областиById = new Map(
    input.project.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );
  const summaries = new Map<string, ProjectРабочая областьSummary>();

  for (const issue of input.issues) {
    if (issue.executionРабочая областьId) {
      const executionРабочая область = executionРабочие областиById.get(issue.executionРабочая областьId);
      if (!executionРабочая область) continue;
      if (executionРабочая область.status === "archived") continue;
      if (isПо умолчаниюSharedExecutionРабочая область({
        executionРабочая область,
        issue,
        primaryРабочая областьId: primaryId,
      })) continue;

      const existing = summaries.get(`execution:${executionРабочая область.id}`);
      const nextЗадачи = [...(existing?.issues ?? []), issue].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      const runtimeSummary = runtimeServiceSummary(executionРабочая область.runtimeServices);

      summaries.set(`execution:${executionРабочая область.id}`, {
        key: `execution:${executionРабочая область.id}`,
        kind: "execution_workspace",
        workspaceId: executionРабочая область.id,
        workspaceИмя: executionРабочая область.name,
        cwd: executionРабочая область.cwd ?? null,
        branchИмя: executionРабочая область.branchИмя ?? executionРабочая область.baseRef ?? null,
        lastОбновленоAt: maxDate(
          existing?.lastОбновленоAt,
          executionРабочая область.lastUsedAt,
          executionРабочая область.updatedAt,
          issue.updatedAt,
        ),
        projectРабочая областьId: executionРабочая область.projectРабочая областьId ?? issue.projectРабочая областьId ?? null,
        executionРабочая областьId: executionРабочая область.id,
        executionРабочая областьСтатус: executionРабочая область.status,
        ...runtimeSummary,
        hasЗапуститьtimeConfig: Boolean(
          executionРабочая область.config?.workspaceЗапуститьtime
          ?? projectРабочие областиById.get(executionРабочая область.projectРабочая областьId ?? issue.projectРабочая областьId ?? "")?.runtimeConfig?.workspaceЗапуститьtime,
        ),
        issues: nextЗадачи,
      });
      continue;
    }

    if (!issue.projectРабочая областьId || issue.projectРабочая областьId === primaryId) continue;
    const projectРабочая область = projectРабочие областиById.get(issue.projectРабочая областьId);
    if (!projectРабочая область) continue;

    const existing = summaries.get(`project:${projectРабочая область.id}`);
    const nextЗадачи = [...(existing?.issues ?? []), issue].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const runtimeSummary = runtimeServiceSummary(projectРабочая область.runtimeServices);

    summaries.set(`project:${projectРабочая область.id}`, {
      key: `project:${projectРабочая область.id}`,
      kind: "project_workspace",
      workspaceId: projectРабочая область.id,
      workspaceИмя: projectРабочая область.name,
      cwd: projectРабочая область.cwd ?? null,
      branchИмя: projectРабочая область.repoRef ?? projectРабочая область.defaultRef ?? null,
      lastОбновленоAt: maxDate(existing?.lastОбновленоAt, projectРабочая область.updatedAt, issue.updatedAt),
      projectРабочая областьId: projectРабочая область.id,
      executionРабочая областьId: null,
      executionРабочая областьСтатус: null,
      ...runtimeSummary,
      hasЗапуститьtimeConfig: Boolean(projectРабочая область.runtimeConfig?.workspaceЗапуститьtime),
      issues: nextЗадачи,
    });
  }

  for (const projectРабочая область of input.project.workspaces) {
    const key = `project:${projectРабочая область.id}`;
    if (summaries.has(key)) continue;
    const shouldSurfaceРабочая область =
      projectРабочая область.isPrimary
      || Boolean(projectРабочая область.runtimeConfig?.workspaceЗапуститьtime)
      || (projectРабочая область.runtimeServices?.length ?? 0) > 0;
    if (!shouldSurfaceРабочая область) continue;
    const runtimeSummary = runtimeServiceSummary(projectРабочая область.runtimeServices);
    summaries.set(key, {
      key,
      kind: "project_workspace",
      workspaceId: projectРабочая область.id,
      workspaceИмя: projectРабочая область.name,
      cwd: projectРабочая область.cwd ?? null,
      branchИмя: projectРабочая область.repoRef ?? projectРабочая область.defaultRef ?? null,
      lastОбновленоAt: maxDate(projectРабочая область.updatedAt),
      projectРабочая областьId: projectРабочая область.id,
      executionРабочая областьId: null,
      executionРабочая областьСтатус: null,
      ...runtimeSummary,
      hasЗапуститьtimeConfig: Boolean(projectРабочая область.runtimeConfig?.workspaceЗапуститьtime),
      issues: [],
    });
  }

  return [...summaries.values()].sort((a, b) => {
    const liveDiff = Number(b.runningServiceCount > 0) - Number(a.runningServiceCount > 0);
    if (liveDiff !== 0) return liveDiff;
    const diff = b.lastОбновленоAt.getTime() - a.lastОбновленоAt.getTime();
    return diff !== 0 ? diff : a.workspaceИмя.localeCompare(b.workspaceИмя);
  });
}
