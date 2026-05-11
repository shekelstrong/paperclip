import type { Задача } from "@paperclipai/shared";

type SubЗадачаПо умолчаниюSource = Pick<
  Задача,
  | "id"
  | "identifier"
  | "title"
  | "projectId"
  | "projectРабочая областьId"
  | "goalId"
  | "executionРабочая областьId"
  | "executionРабочая областьPreference"
  | "currentExecutionРабочая область"
  | "assigneeАгентId"
  | "assigneeUserId"
>;

export function buildSubЗадачаПо умолчаниюs(issue: SubЗадачаПо умолчаниюSource) {
  return buildSubЗадачаПо умолчаниюsForViewer(issue);
}

export function buildSubЗадачаПо умолчаниюsForViewer(
  issue: SubЗадачаПо умолчаниюSource,
  currentUserId?: string | null,
) {
  const parentExecutionРабочая областьLabel =
    issue.currentExecutionРабочая область?.name
    ?? issue.currentExecutionРабочая область?.branchИмя
    ?? issue.currentExecutionРабочая область?.cwd
    ?? issue.executionРабочая областьId
    ?? null;
  const shouldInheritUserИсполнитель = Boolean(issue.assigneeUserId && issue.assigneeUserId !== currentUserId);
  const inheritedИсполнительUserId = shouldInheritUserИсполнитель ? issue.assigneeUserId ?? undefined : undefined;

  return {
    parentId: issue.id,
    parentIdentifier: issue.identifier ?? undefined,
    parentНазвание: issue.title,
    ...(issue.projectId ? { projectId: issue.projectId } : {}),
    ...(issue.projectРабочая областьId ? { projectРабочая областьId: issue.projectРабочая областьId } : {}),
    ...(issue.goalId ? { goalId: issue.goalId } : {}),
    ...(issue.executionРабочая областьId ? { executionРабочая областьId: issue.executionРабочая областьId } : {}),
    ...(issue.executionРабочая областьId
      ? { executionРабочая областьMode: "reuse_existing" }
      : issue.executionРабочая областьPreference
        ? { executionРабочая областьMode: issue.executionРабочая областьPreference }
        : {}),
    ...(parentExecutionРабочая областьLabel ? { parentExecutionРабочая областьLabel } : {}),
    ...(issue.assigneeАгентId ? { assigneeАгентId: issue.assigneeАгентId } : {}),
    ...(inheritedИсполнительUserId ? { assigneeUserId: inheritedИсполнительUserId } : {}),
  };
}
