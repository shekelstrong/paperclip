import type { ЗадачаExecutionPolicy, ЗадачаExecutionStageParticipant, ЗадачаExecutionStagePrincipal } from "@paperclipai/shared";
import { parseИсполнительЗначение } from "./assignees";

type StageТип = "review" | "approval";

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stage-${Math.random().toString(36).slice(2)}`;
}

function principalКлюч(principal: ЗадачаExecutionStagePrincipal | ЗадачаExecutionStageParticipant) {
  return principal.type === "agent" ? `agent:${principal.agentId}` : `user:${principal.userId}`;
}

export function principalFromSelectionЗначение(value: string): ЗадачаExecutionStagePrincipal | null {
  const selection = parseИсполнительЗначение(value);
  if (selection.assigneeАгентId) {
    return { type: "agent", agentId: selection.assigneeАгентId, userId: null };
  }
  if (selection.assigneeUserId) {
    return { type: "user", userId: selection.assigneeUserId, agentId: null };
  }
  return null;
}

export function selectionЗначениеFromPrincipal(principal: ЗадачаExecutionStagePrincipal | ЗадачаExecutionStageParticipant): string {
  return principal.type === "agent" ? `agent:${principal.agentId}` : `user:${principal.userId}`;
}

export function stageParticipantЗначениеs(policy: ЗадачаExecutionPolicy | null | undefined, stageТип: StageТип): string[] {
  const stage = policy?.stages.find((candidate) => candidate.type === stageТип);
  return stage?.participants.map((participant) => selectionЗначениеFromPrincipal(participant)) ?? [];
}

function mergeParticipants(
  existing: ЗадачаExecutionStageParticipant[] | undefined,
  values: string[],
): ЗадачаExecutionStageParticipant[] {
  const existingByКлюч = new Map((existing ?? []).map((participant) => [principalКлюч(participant), participant]));
  const participants: ЗадачаExecutionStageParticipant[] = [];
  for (const value of values) {
    const principal = principalFromSelectionЗначение(value);
    if (!principal) continue;
    const key = principalКлюч(principal);
    const previous = existingByКлюч.get(key);
    participants.push({
      id: previous?.id ?? newId(),
      type: principal.type,
      agentId: principal.type === "agent" ? principal.agentId ?? null : null,
      userId: principal.type === "user" ? principal.userId ?? null : null,
    });
  }
  return participants;
}

export function buildExecutionPolicy(input: {
  existingPolicy?: ЗадачаExecutionPolicy | null;
  reviewerЗначениеs: string[];
  approverЗначениеs: string[];
}): ЗадачаExecutionPolicy | null {
  const mode = input.existingPolicy?.mode ?? "normal";
  const stages: ЗадачаExecutionPolicy["stages"] = [];
  const monitor = input.existingPolicy?.monitor ?? null;

  const existingReviewStage = input.existingPolicy?.stages.find((stage) => stage.type === "review");
  const reviewParticipants = mergeParticipants(existingReviewStage?.participants, input.reviewerЗначениеs);
  if (reviewParticipants.length > 0) {
    stages.push({
      id: existingReviewStage?.id ?? newId(),
      type: "review" as const,
      approvalsNeeded: 1 as const,
      participants: reviewParticipants,
    });
  }

  const existingСогласованиеStage = input.existingPolicy?.stages.find((stage) => stage.type === "approval");
  const approvalParticipants = mergeParticipants(existingСогласованиеStage?.participants, input.approverЗначениеs);
  if (approvalParticipants.length > 0) {
    stages.push({
      id: existingСогласованиеStage?.id ?? newId(),
      type: "approval" as const,
      approvalsNeeded: 1 as const,
      participants: approvalParticipants,
    });
  }

  if (stages.length === 0 && !monitor) return null;

  return {
    mode,
    commentОбязательно: true,
    stages,
    ...(monitor ? { monitor } : {}),
  };
}
