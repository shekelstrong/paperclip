import type { Agent } from "@paperclipai/shared";
import type { CompanyUserProfile } from "./company-members";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  userProfileMap?: Map<string, CompanyUserProfile>;
  currentUserId?: string | null;
}

const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "issue.created": "created",
  "issue.updated": "updated",
  "issue.checked_out": "взял в работу",
  "issue.released": "released",
  "issue.comment_added": "прокомментировал",
  "issue.comment_cancelled": "отменил отложенный комментарий к",
  "issue.attachment_added": "прикрепил файл к",
  "issue.attachment_removed": "убрал вложение из",
  "issue.document_created": "создал документ для",
  "issue.document_updated": "обновил документ в",
  "issue.document_deleted": "удалил документ из",
  "issue.monitor_scheduled": "запланировал мониторинг для",
  "issue.monitor_triggered": "активировал мониторинг для",
  "issue.monitor_cleared": "снял мониторинг с",
  "issue.monitor_skipped": "пропустил мониторинг для",
  "issue.monitor_exhausted": "исчерпал мониторинг для",
  "issue.monitor_recovery_wake_queued": "поставил в очередь восстановление мониторинга для",
  "issue.monitor_recovery_issue_created": "создал задачу восстановления мониторинга для",
  "issue.monitor_escalated_to_board": "эскалировал мониторинг для",
  "issue.commented": "прокомментировал",
  "issue.deleted": "deleted",
  "issue.successful_run_handoff_required": "отметил отсутствие следующего шага в",
  "issue.successful_run_handoff_resolved": "записал выбранный следующий шаг в",
  "issue.successful_run_handoff_escalated": "эскалировал отсутствие следующего шага в",
  "agent.created": "created",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "terminated",
  "agent.key_created": "создал API-ключ для",
  "agent.budget_updated": "обновил бюджет для",
  "agent.runtime_session_reset": "сбросил сессию для",
  "heartbeat.invoked": "вызвал пульс для",
  "heartbeat.cancelled": "отменил пульс для",
  "approval.created": "запросил одобрение",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "project.created": "created",
  "project.updated": "updated",
  "project.deleted": "deleted",
  "goal.created": "created",
  "goal.updated": "updated",
  "goal.deleted": "deleted",
  "cost.reported": "reported cost for",
  "cost.recorded": "recorded cost for",
  "company.created": "создал компанию",
  "company.updated": "обновил компанию",
  "company.archived": "archived",
  "company.budget_updated": "обновил бюджет для",
};

const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": "создал задачу",
  "issue.updated": "обновил задачу",
  "issue.checked_out": "взял задачу в работу",
  "issue.released": "освободил задачу",
  "issue.comment_added": "добавил комментарий",
  "issue.comment_cancelled": "отменил отложенный комментарий",
  "issue.feedback_vote_saved": "сохранил отзыв на вывод ИИ",
  "issue.attachment_added": "добавил вложение",
  "issue.attachment_removed": "убрал вложение",
  "issue.document_created": "создал документ",
  "issue.document_updated": "обновил документ",
  "issue.document_deleted": "удалил документ",
  "issue.monitor_scheduled": "запланировал мониторинг",
  "issue.monitor_triggered": "активировал мониторинг",
  "issue.monitor_cleared": "снял мониторинг",
  "issue.monitor_skipped": "пропустил мониторинг",
  "issue.monitor_exhausted": "исчерпал мониторинг",
  "issue.monitor_recovery_wake_queued": "поставил в очередь восстановление мониторинга",
  "issue.monitor_recovery_issue_created": "создал задачу восстановления мониторинга",
  "issue.monitor_escalated_to_board": "эскалировал мониторинг на доску",
  "issue.deleted": "удалил задачу",
  "issue.successful_run_handoff_required": "Запуск завершён без чёткого следующего шага",
  "issue.successful_run_handoff_resolved": "Следующий шаг выбран",
  "issue.successful_run_handoff_escalated": "Запуск завершён без следующего шага — эскалировано восстановление",
  "agent.created": "создал агента",
  "agent.updated": "обновил агента",
  "agent.paused": "приостановил агента",
  "agent.resumed": "возобновил агента",
  "agent.terminated": "завершил агента",
  "heartbeat.invoked": "вызвал пульс",
  "heartbeat.cancelled": "отменил пульс",
  "approval.created": "запросил одобрение",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(userId: string | null | undefined, options: ActivityFormatOptions = {}): string {
  if (!userId || userId === "local-board") return "Доска";
  if (options.currentUserId && userId === options.currentUserId) return "Вы";
  const profile = options.userProfileMap?.get(userId);
  if (profile) return profile.label;
  return `user ${userId.slice(0, 5)}`;
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? "agent";
  }
  return formatUserLabel(participant.userId, options);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return "issue";
}

function formatChangedEntityLabel(
  singular: string,
  plural: string,
  labels: string[],
): string {
  if (labels.length <= 0) return plural;
  if (labels.length === 1) return `${singular} ${labels[0]}`;
  return `${labels.length} ${plural}`;
}

function formatIssueUpdatedVerb(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    return from
      ? `changed status from ${humanizeValue(from)} to ${humanizeValue(details.status)} on`
      : `changed status to ${humanizeValue(details.status)} on`;
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? `changed priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)} on`
      : `changed priority to ${humanizeValue(details.priority)} on`;
  }
  return null;
}

function formatAssigneeName(details: ActivityDetails, options: ActivityFormatOptions): string | null {
  if (!details) return null;
  const agentId = details.assigneeAgentId;
  const userId = details.assigneeUserId;
  if (typeof agentId === "string" && agentId) {
    return options.agentMap?.get(agentId)?.name ?? "agent";
  }
  if (typeof userId === "string" && userId) {
    return formatUserLabel(userId, options);
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails, options: ActivityFormatOptions = {}): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    parts.push(
      from
        ? `changed the status from ${humanizeValue(from)} to ${humanizeValue(details.status)}`
        : `changed the status to ${humanizeValue(details.status)}`,
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? `changed the priority from ${humanizeValue(from)} to ${humanizeValue(details.priority)}`
        : `changed the priority to ${humanizeValue(details.priority)}`,
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    const assigneeName = formatAssigneeName(details, options);
    parts.push(assigneeName ? `assigned the issue to ${assigneeName}` : "снял назначение с задачи");
  }
  if (details.title !== undefined) parts.push("обновил название");
  if (details.description !== undefined) parts.push("обновил описание");

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map(formatIssueReferenceLabel);
    const removed = readIssueReferences(details, "removedBlockedByIssues").map(formatIssueReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", added);
      return input.forIssueDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", removed);
      return input.forIssueDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return input.forIssueDetail ? "обновил блокировщики" : "обновил блокировщики в";
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const singular = input.action === "issue.reviewers_updated" ? "reviewer" : "approver";
    const plural = input.action === "issue.reviewers_updated" ? "reviewers" : "approvers";
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, added);
      return input.forIssueDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, removed);
      return input.forIssueDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return input.forIssueDetail ? `updated ${plural}` : `updated ${plural} on`;
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  return ACTIVITY_ROW_VERBS[action] ?? action.replace(/[._]/g, " ");
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details, options);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (action.startsWith("issue.monitor_") && details) {
    const serviceName = typeof details.serviceName === "string" && details.serviceName.trim()
      ? details.serviceName.trim()
      : null;
    const base = ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
    return serviceName ? `${base} for ${serviceName}` : base;
  }

  if (
    (action === "issue.document_created" || action === "issue.document_updated" || action === "issue.document_deleted") &&
    details
  ) {
    const key = typeof details.key === "string" ? details.key : "document";
    const title = typeof details.title === "string" && details.title ? ` (${details.title})` : "";
    return `${ISSUE_ACTIVITY_LABELS[action] ?? action} ${key}${title}`;
  }

  return ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
}
