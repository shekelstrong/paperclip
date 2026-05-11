export type {
  AskUserQuestionsAnswer,
  AskUserQuestionsInteraction,
  AskUserQuestionsPayload,
  AskUserQuestionsQuestion,
  AskUserQuestionsQuestionOption,
  AskUserQuestionsResult,
  ЗадачаThreadInteraction,
  ЗадачаThreadInteractionActorFields,
  ЗадачаThreadInteractionBase,
  ЗадачаThreadInteractionContinuationPolicy,
  ЗадачаThreadInteractionСтатус,
  RequestПодтвердитьationInteraction,
  RequestПодтвердитьationЗадачаDocumentЦель,
  RequestПодтвердитьationPayload,
  RequestПодтвердитьationResult,
  RequestПодтвердитьationЦель,
  SuggestedЗадачаЧерновик,
  SuggestЗадачиInteraction,
  SuggestЗадачиPayload,
  SuggestЗадачиResult,
  SuggestЗадачиResultСозданоЗадача,
} from "@paperclipai/shared";
import type {
  AskUserQuestionsAnswer,
  AskUserQuestionsInteraction,
  AskUserQuestionsQuestion,
  ЗадачаThreadInteraction,
  RequestПодтвердитьationInteraction,
  SuggestedЗадачаЧерновик,
  SuggestЗадачиInteraction,
  SuggestЗадачиResultСозданоЗадача,
} from "@paperclipai/shared";

export interface SuggestedЗадачаTreeНетde {
  task: SuggestedЗадачаЧерновик;
  children: SuggestedЗадачаTreeНетde[];
}

export function isЗадачаThreadInteraction(
  value: unknown,
): value is ЗадачаThreadInteraction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ЗадачаThreadInteraction>;
  return typeof candidate.id === "string"
    && typeof candidate.companyId === "string"
    && typeof candidate.issueId === "string"
    && (
      candidate.kind === "suggest_tasks"
      || candidate.kind === "ask_user_questions"
      || candidate.kind === "request_confirmation"
    );
}

export function buildЗадачаThreadInteractionSummary(
  interaction: ЗадачаThreadInteraction,
) {
  if (interaction.kind === "suggest_tasks") {
    const count = interaction.payload.tasks.length;
    if (interaction.status === "accepted") {
      const createdCount = interaction.result?.createdЗадачи?.length ?? 0;
      const skippedCount = interaction.result?.skippedClientКлючs?.length ?? 0;
      if (skippedCount > 0) {
        return `Принятьed ${createdCount} of ${count} tasks`;
      }
      return createdCount === 1 ? "Принятьed 1 task" : `Принятьed ${createdCount} tasks`;
    }
    if (interaction.status === "rejected") {
      return count === 1 ? "Отклонитьed 1 task" : `Отклонитьed ${count} tasks`;
    }
    return count === 1 ? "Suggested 1 task" : `Suggested ${count} tasks`;
  }

  if (interaction.kind === "request_confirmation") {
    if (interaction.status === "accepted") return "Подтвердитьed request";
    if (interaction.status === "rejected") return "Отклонитьd request";
    if (interaction.status === "expired") {
      const outcome = interaction.result?.outcome;
      if (outcome === "superseded_by_comment") return "Подтвердитьation expired after comment";
      if (outcome === "stale_target") return "Подтвердитьation expired after target changed";
      return "Подтвердитьation expired";
    }
    return "Requested confirmation";
  }

  const count = interaction.payload.questions.length;
  if (interaction.status === "answered") {
    return count === 1 ? "Answered 1 question" : `Answered ${count} questions`;
  }
  if (interaction.status === "cancelled") {
    return count === 1 ? "Отменён 1 question" : `Отменён ${count} questions`;
  }
  return count === 1 ? "Asked 1 question" : `Asked ${count} questions`;
}

export function buildSuggestedЗадачаTree(
  tasks: readonly SuggestedЗадачаЧерновик[],
): SuggestedЗадачаTreeНетde[] {
  const nodes = new Map<string, SuggestedЗадачаTreeНетde>();
  for (const task of tasks) {
    nodes.set(task.clientКлюч, { task, children: [] });
  }

  const roots: SuggestedЗадачаTreeНетde[] = [];
  for (const task of tasks) {
    const node = nodes.get(task.clientКлюч);
    if (!node) continue;
    const parentНетde = task.parentClientКлюч ? nodes.get(task.parentClientКлюч) : null;
    if (parentНетde) {
      parentНетde.children.push(node);
      continue;
    }
    roots.push(node);
  }

  return roots;
}

export function countSuggestedЗадачаНетdes(node: SuggestedЗадачаTreeНетde): number {
  return 1 + node.children.reduce((sum, child) => sum + countSuggestedЗадачаНетdes(child), 0);
}

export function collectSuggestedЗадачаClientКлючs(node: SuggestedЗадачаTreeНетde): string[] {
  return [
    node.task.clientКлюч,
    ...node.children.flatMap((child) => collectSuggestedЗадачаClientКлючs(child)),
  ];
}

export function getQuestionAnswerЯрлыки(args: {
  question: AskUserQuestionsQuestion;
  answers: readonly AskUserQuestionsAnswer[];
}) {
  const { question, answers } = args;
  const selectedIds =
    answers.find((answer) => answer.questionId === question.id)?.optionIds ?? [];
  const optionLabelById = new Map(
    question.options.map((option) => [option.id, option.label] as const),
  );
  return selectedIds
    .map((optionId) => optionLabelById.get(optionId))
    .filter((label): label is string => typeof label === "string");
}
