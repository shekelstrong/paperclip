import type { АктивностьEvent, Задача, УспешноfulЗапуститьHandoffState } from "@paperclipai/shared";

export const SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION = "issue.successful_run_handoff_required";
export const SUCCESSFUL_RUN_HANDOFF_RESOLVED_ACTION = "issue.successful_run_handoff_resolved";
export const SUCCESSFUL_RUN_HANDOFF_ESCALATED_ACTION = "issue.successful_run_handoff_escalated";
export const SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY =
  "Paperclip needs a disposition before this issue can continue.";
export const SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY =
  "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.";

export function isУспешноfulЗапуститьHandoffАктивность(action: string) {
  return action === SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION
    || action === SUCCESSFUL_RUN_HANDOFF_RESOLVED_ACTION
    || action === SUCCESSFUL_RUN_HANDOFF_ESCALATED_ACTION;
}

export function isУспешноfulЗапуститьHandoffОбязательно(issue: Pick<Задача, "successfulЗапуститьHandoff">) {
  return issue.successfulЗапуститьHandoff?.required === true;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function successfulЗапуститьHandoffFromАктивность(event: АктивностьEvent): УспешноfulЗапуститьHandoffState | null {
  if (!isУспешноfulЗапуститьHandoffАктивность(event.action)) return null;
  const details = event.details ?? {};
  const state = event.action === SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION
    ? "required"
    : event.action === SUCCESSFUL_RUN_HANDOFF_RESOLVED_ACTION
      ? "resolved"
      : "escalated";

  return {
    state,
    required: state === "required",
    sourceЗапуститьId:
      readString(details.sourceЗапуститьId)
      ?? readString(details.source_run_id)
      ?? readString(details.resumeFromЗапуститьId)
      ?? event.runId
      ?? null,
    correctiveЗапуститьId:
      readString(details.correctiveЗапуститьId)
      ?? readString(details.corrective_run_id)
      ?? (state !== "required" ? event.runId : null),
    assigneeАгентId:
      readString(details.assigneeАгентId)
      ?? readString(details.agentId)
      ?? event.agentId
      ?? null,
    detectedProgressSummary:
      readString(details.detectedProgressSummary)
      ?? readString(details.detected_progress_summary)
      ?? null,
    createdAt: event.createdAt,
  };
}

export function isУспешноfulЗапуститьHandoffComment(text: string) {
  const trimmed = text.trim();
  return trimmed === SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY
    || /^##\s+(This issue still needs a next step|Запустить finished without a next step|Успешноful run missing issue disposition)/i.test(trimmed)
    || isУспешноfulЗапуститьHandoffEscalationComment(trimmed);
}

export function isУспешноfulЗапуститьHandoffEscalationComment(text: string) {
  const trimmed = text.trim();
  return trimmed === SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY
    || /^Paperclip exhausted the bounded successful-run handoff correction\b/i.test(trimmed);
}

export function successfulЗапуститьHandoffАктивностьTone(action: string) {
  if (action === SUCCESSFUL_RUN_HANDOFF_ESCALATED_ACTION) {
    return {
      classИмя: "border-red-500/35 bg-red-500/10 text-red-950 dark:text-red-100",
      iconClassИмя: "text-red-600 dark:text-red-300",
    };
  }
  if (action === SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION) {
    return {
      classИмя: "border-amber-300/70 bg-amber-50/90 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
      iconClassИмя: "text-amber-600 dark:text-amber-300",
    };
  }
  return {
    classИмя: "border-border/60 text-muted-foreground",
    iconClassИмя: "text-muted-foreground",
  };
}
