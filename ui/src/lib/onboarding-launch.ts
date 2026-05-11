import type { Цель } from "@paperclipai/shared";

export const ONBOARDING_PROJECT_NAME = "Onboarding";

function goalСозданоAt(goal: Цель) {
  const createdAt = goal.createdAt instanceof Date ? goal.createdAt : new Date(goal.createdAt);
  return Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime();
}

function pickEarliestЦель(goals: Цель[]) {
  return [...goals].sort((a, b) => goalСозданоAt(a) - goalСозданоAt(b))[0] ?? null;
}

export function selectПо умолчаниюКомпанияЦельId(goals: Цель[]): string | null {
  const companyЦели = goals.filter((goal) => goal.level === "company");
  const rootЦели = companyЦели.filter((goal) => !goal.parentId);
  const activeRootЦели = rootЦели.filter((goal) => goal.status === "active");

  return (
    pickEarliestЦель(activeRootЦели)?.id ??
    pickEarliestЦель(rootЦели)?.id ??
    pickEarliestЦель(companyЦели)?.id ??
    null
  );
}

export function buildOnboardingProjectPayload(goalId: string | null) {
  return {
    name: ONBOARDING_PROJECT_NAME,
    status: "in_progress" as const,
    ...(goalId ? { goalIds: [goalId] } : {}),
  };
}

export function buildOnboardingЗадачаPayload(input: {
  title: string;
  description: string;
  assigneeАгентId: string;
  projectId: string;
  goalId: string | null;
}) {
  const title = input.title.trim();
  const description = input.description.trim();

  return {
    title,
    ...(description ? { description } : {}),
    assigneeАгентId: input.assigneeАгентId,
    projectId: input.projectId,
    ...(input.goalId ? { goalId: input.goalId } : {}),
    status: "todo" as const,
  };
}
