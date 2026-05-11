import type { Задача } from "@paperclipai/shared";

type ЗадачаPropertiesPanelКлючЗадача = Pick<
  Задача,
  | "id"
  | "status"
  | "priority"
  | "assigneeАгентId"
  | "assigneeUserId"
  | "projectId"
  | "projectРабочая областьId"
  | "parentId"
  | "createdByUserId"
  | "hiddenAt"
  | "labelIds"
  | "executionPolicy"
  | "executionState"
  | "executionРабочая областьId"
  | "executionРабочая областьPreference"
  | "executionРабочая областьНастройки"
  | "currentExecutionРабочая область"
  | "blocks"
  | "blockedBy"
  | "ancestors"
>;

type ЗадачаPropertiesPanelКлючChild = Pick<Задача, "id" | "updatedAt" | "identifier" | "title">;

export function buildЗадачаPropertiesPanelКлюч(
  issue: ЗадачаPropertiesPanelКлючЗадача | null | undefined,
  childЗадачи: readonly ЗадачаPropertiesPanelКлючChild[],
) {
  if (!issue) return "";

  return JSON.stringify({
    id: issue.id,
    status: issue.status,
    priority: issue.priority,
    assigneeАгентId: issue.assigneeАгентId,
    assigneeUserId: issue.assigneeUserId,
    projectId: issue.projectId,
    projectРабочая областьId: issue.projectРабочая областьId,
    parentId: issue.parentId,
    createdByUserId: issue.createdByUserId,
    hiddenAt: issue.hiddenAt,
    labelIds: issue.labelIds ?? [],
    executionРабочая областьId: issue.executionРабочая областьId,
    executionРабочая областьPreference: issue.executionРабочая областьPreference,
    executionРабочая областьНастройки: issue.executionРабочая областьНастройки ?? null,
    currentExecutionРабочая область: issue.currentExecutionРабочая область
      ? {
          id: issue.currentExecutionРабочая область.id,
          mode: issue.currentExecutionРабочая область.mode,
          status: issue.currentExecutionРабочая область.status,
          projectРабочая областьId: issue.currentExecutionРабочая область.projectРабочая областьId,
          branchИмя: issue.currentExecutionРабочая область.branchИмя,
          cwd: issue.currentExecutionРабочая область.cwd,
          runtimeServices: (issue.currentExecutionРабочая область.runtimeServices ?? []).map((service) => ({
            id: service.id,
            status: service.status,
            url: service.url,
          })),
        }
      : null,
    executionPolicy: issue.executionPolicy ?? null,
    executionState: issue.executionState
      ? {
          status: issue.executionState.status,
          currentStageТип: issue.executionState.currentStageТип,
          currentParticipant: issue.executionState.currentParticipant,
          returnИсполнитель: issue.executionState.returnИсполнитель,
        }
      : null,
    blocks: (issue.blocks ?? []).map((relation) => ({
      id: relation.id,
      identifier: relation.identifier ?? null,
      title: relation.title,
      status: relation.status,
    })),
    blockedBy: (issue.blockedBy ?? []).map((relation) => ({
      id: relation.id,
      identifier: relation.identifier ?? null,
      title: relation.title,
      status: relation.status,
    })),
    parentSummary: issue.ancestors?.[0]
      ? {
          id: issue.ancestors[0].id,
          identifier: issue.ancestors[0].identifier ?? null,
          title: issue.ancestors[0].title,
        }
      : null,
    childЗадачи: childЗадачи.map((child) => ({
      id: child.id,
      updatedAt: String(child.updatedAt),
      identifier: child.identifier ?? null,
      title: child.title,
    })),
  });
}
