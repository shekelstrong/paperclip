import type { Агент } from "@paperclipai/shared";
import type { КомпанияUserПрофиль } from "./company-members";

type АктивностьДетали = Record<string, unknown> | null | undefined;

type АктивностьParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type АктивностьЗадачаReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface АктивностьFormatOptions {
  agentMap?: Map<string, Агент>;
  userПрофильMap?: Map<string, КомпанияUserПрофиль>;
  currentUserId?: string | null;
}

const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "issue.created": "created",
  "issue.updated": "updated",
  "issue.checked_out": "checked out",
  "issue.released": "released",
  "issue.comment_added": "commented on",
  "issue.comment_cancelled": "cancelled a queued comment on",
  "issue.attachment_added": "attached file to",
  "issue.attachment_removed": "removed attachment from",
  "issue.document_created": "created document for",
  "issue.document_updated": "updated document on",
  "issue.document_deleted": "deleted document from",
  "issue.monitor_scheduled": "scheduled monitor on",
  "issue.monitor_triggered": "triggered monitor for",
  "issue.monitor_cleared": "cleared monitor on",
  "issue.monitor_skipped": "skipped monitor for",
  "issue.monitor_exhausted": "exhausted monitor on",
  "issue.monitor_recovery_wake_queued": "queued monitor recovery for",
  "issue.monitor_recovery_issue_created": "created monitor recovery for",
  "issue.monitor_escalated_to_board": "escalated monitor for",
  "issue.commented": "commented on",
  "issue.deleted": "deleted",
  "issue.successful_run_handoff_required": "flagged missing next step on",
  "issue.successful_run_handoff_resolved": "recorded next step chosen on",
  "issue.successful_run_handoff_escalated": "escalated missing next step on",
  "agent.created": "created",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "terminated",
  "agent.key_created": "created API key for",
  "agent.budget_updated": "updated budget for",
  "agent.runtime_session_reset": "reset session for",
  "heartbeat.invoked": "invoked heartbeat for",
  "heartbeat.cancelled": "cancelled heartbeat for",
  "approval.created": "requested approval",
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
  "company.created": "created company",
  "company.updated": "updated company",
  "company.archived": "archived",
  "company.budget_updated": "updated budget for",
};

const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": "created the issue",
  "issue.updated": "updated the issue",
  "issue.checked_out": "checked out the issue",
  "issue.released": "released the issue",
  "issue.comment_added": "added a comment",
  "issue.comment_cancelled": "cancelled a queued comment",
  "issue.feedback_vote_saved": "saved feedback on an AI output",
  "issue.attachment_added": "added an attachment",
  "issue.attachment_removed": "removed an attachment",
  "issue.document_created": "created a document",
  "issue.document_updated": "updated a document",
  "issue.document_deleted": "deleted a document",
  "issue.monitor_scheduled": "scheduled a monitor",
  "issue.monitor_triggered": "triggered a monitor",
  "issue.monitor_cleared": "cleared a monitor",
  "issue.monitor_skipped": "skipped a monitor",
  "issue.monitor_exhausted": "exhausted a monitor",
  "issue.monitor_recovery_wake_queued": "queued a monitor recovery wake",
  "issue.monitor_recovery_issue_created": "created a monitor recovery issue",
  "issue.monitor_escalated_to_board": "escalated a monitor to the board",
  "issue.deleted": "deleted the issue",
  "issue.successful_run_handoff_required": "Запустить finished without a clear next step",
  "issue.successful_run_handoff_resolved": "Далее step chosen",
  "issue.successful_run_handoff_escalated": "Запустить finished without a next step - recovery escalated",
  "agent.created": "created an agent",
  "agent.updated": "updated the agent",
  "agent.paused": "paused the agent",
  "agent.resumed": "resumed the agent",
  "agent.terminated": "terminated the agent",
  "heartbeat.invoked": "invoked a heartbeat",
  "heartbeat.cancelled": "cancelled a heartbeat",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeЗначение(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function isАктивностьParticipant(value: unknown): value is АктивностьParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isАктивностьЗадачаReference(value: unknown): value is АктивностьЗадачаReference {
  return asRecord(value) !== null;
}

function readParticipants(details: АктивностьДетали, key: string): АктивностьParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isАктивностьParticipant);
}

function readЗадачаСсылки(details: АктивностьДетали, key: string): АктивностьЗадачаReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isАктивностьЗадачаReference);
}

function formatUserLabel(userId: string | null | undefined, options: АктивностьFormatOptions = {}): string {
  if (!userId || userId === "local-board") return "Совет";
  if (options.currentUserId && userId === options.currentUserId) return "You";
  const profile = options.userПрофильMap?.get(userId);
  if (profile) return profile.label;
  return `user ${userId.slice(0, 5)}`;
}

function formatParticipantLabel(participant: АктивностьParticipant, options: АктивностьFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? "agent";
  }
  return formatUserLabel(participant.userId, options);
}

function formatЗадачаReferenceLabel(reference: АктивностьЗадачаReference): string {
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

function formatЗадачаОбновленоVerb(details: АктивностьДетали): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    return from
      ? `changed status from ${humanizeЗначение(from)} to ${humanizeЗначение(details.status)} on`
      : `changed status to ${humanizeЗначение(details.status)} on`;
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? `changed priority from ${humanizeЗначение(from)} to ${humanizeЗначение(details.priority)} on`
      : `changed priority to ${humanizeЗначение(details.priority)} on`;
  }
  return null;
}

function formatИсполнительИмя(details: АктивностьДетали, options: АктивностьFormatOptions): string | null {
  if (!details) return null;
  const agentId = details.assigneeАгентId;
  const userId = details.assigneeUserId;
  if (typeof agentId === "string" && agentId) {
    return options.agentMap?.get(agentId)?.name ?? "agent";
  }
  if (typeof userId === "string" && userId) {
    return formatUserLabel(userId, options);
  }
  return null;
}

function formatЗадачаОбновленоAction(details: АктивностьДетали, options: АктивностьFormatOptions = {}): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    parts.push(
      from
        ? `changed the status from ${humanizeЗначение(from)} to ${humanizeЗначение(details.status)}`
        : `changed the status to ${humanizeЗначение(details.status)}`,
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? `changed the priority from ${humanizeЗначение(from)} to ${humanizeЗначение(details.priority)}`
        : `changed the priority to ${humanizeЗначение(details.priority)}`,
    );
  }
  if (details.assigneeАгентId !== undefined || details.assigneeUserId !== undefined) {
    const assigneeИмя = formatИсполнительИмя(details, options);
    parts.push(assigneeИмя ? `assigned the issue to ${assigneeИмя}` : "unassigned the issue");
  }
  if (details.title !== undefined) parts.push("updated the title");
  if (details.description !== undefined) parts.push("updated the description");

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatStructuredЗадачаChange(input: {
  action: string;
  details: АктивностьДетали;
  options: АктивностьFormatOptions;
  forЗадачаDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readЗадачаСсылки(details, "addedЗаблокированByЗадачи").map(formatЗадачаReferenceLabel);
    const removed = readЗадачаСсылки(details, "removedЗаблокированByЗадачи").map(formatЗадачаReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", added);
      return input.forЗадачаDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel("blocker", "blockers", removed);
      return input.forЗадачаDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return input.forЗадачаDetail ? "updated blockers" : "updated blockers on";
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const singular = input.action === "issue.reviewers_updated" ? "reviewer" : "approver";
    const plural = input.action === "issue.reviewers_updated" ? "reviewers" : "approvers";
    if (added.length > 0 && removed.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, added);
      return input.forЗадачаDetail ? `added ${changed}` : `added ${changed} to`;
    }
    if (removed.length > 0 && added.length === 0) {
      const changed = formatChangedEntityLabel(singular, plural, removed);
      return input.forЗадачаDetail ? `removed ${changed}` : `removed ${changed} from`;
    }
    return input.forЗадачаDetail ? `updated ${plural}` : `updated ${plural} on`;
  }

  return null;
}

export function formatАктивностьVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: АктивностьFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueОбновленоVerb = formatЗадачаОбновленоVerb(details);
    if (issueОбновленоVerb) return issueОбновленоVerb;
  }

  const structuredChange = formatStructuredЗадачаChange({
    action,
    details,
    options,
    forЗадачаDetail: false,
  });
  if (structuredChange) return structuredChange;

  return ACTIVITY_ROW_VERBS[action] ?? action.replace(/[._]/g, " ");
}

export function formatЗадачаАктивностьAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: АктивностьFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueОбновленоAction = formatЗадачаОбновленоAction(details, options);
    if (issueОбновленоAction) return issueОбновленоAction;
  }

  const structuredChange = formatStructuredЗадачаChange({
    action,
    details,
    options,
    forЗадачаDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (action.startsWith("issue.monitor_") && details) {
    const serviceИмя = typeof details.serviceИмя === "string" && details.serviceИмя.trim()
      ? details.serviceИмя.trim()
      : null;
    const base = ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
    return serviceИмя ? `${base} for ${serviceИмя}` : base;
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
