import type { АктивностьEvent } from "@paperclipai/shared";

export interface ЗадачаTimelineИсполнитель {
  agentId: string | null;
  userId: string | null;
}

export interface ЗадачаTimelineEvent {
  id: string;
  createdAt: Date | string;
  actorТип: АктивностьEvent["actorТип"];
  actorId: string;
  runId?: string | null;
  statusChange?: {
    from: string | null;
    to: string | null;
  };
  assigneeChange?: {
    from: ЗадачаTimelineИсполнитель;
    to: ЗадачаTimelineИсполнитель;
  };
  workspaceChange?: {
    from: ЗадачаTimelineРабочая область;
    to: ЗадачаTimelineРабочая область;
  };
  commentId?: string | null;
  followUpRequested?: boolean;
}

export interface ЗадачаTimelineРабочая область {
  label: string | null;
  projectРабочая областьId: string | null;
  executionРабочая областьId: string | null;
  mode: string | null;
}

export function formatTimelineРабочая областьLabel(workspace: ЗадачаTimelineРабочая область) {
  const fallbackId = workspace.executionРабочая областьId ?? workspace.projectРабочая областьId;
  return workspace.label ?? (fallbackId ? fallbackId.slice(0, 8) : "Нет");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toTimestamp(value: Date | string) {
  return new Date(value).getTime();
}

function sameИсполнитель(left: ЗадачаTimelineИсполнитель, right: ЗадачаTimelineИсполнитель) {
  return left.agentId === right.agentId && left.userId === right.userId;
}

function sameРабочая область(left: ЗадачаTimelineРабочая область, right: ЗадачаTimelineРабочая область) {
  return left.projectРабочая областьId === right.projectРабочая областьId
    && left.executionРабочая областьId === right.executionРабочая областьId
    && left.mode === right.mode
    && left.label === right.label;
}

function workspaceFromRecord(value: unknown): ЗадачаTimelineРабочая область | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    label: nullableString(record.label),
    projectРабочая областьId: nullableString(record.projectРабочая областьId),
    executionРабочая областьId: nullableString(record.executionРабочая областьId),
    mode: nullableString(record.mode),
  };
}

function workspaceChangeFromДетали(details: Record<string, unknown>) {
  const change = asRecord(details.workspaceChange);
  if (!change) return null;
  const from = workspaceFromRecord(change.from);
  const to = workspaceFromRecord(change.to);
  if (!from || !to || sameРабочая область(from, to)) return null;
  return { from, to };
}

function sortTimelineEvents<T extends { createdAt: Date | string; id: string }>(events: T[]) {
  return [...events].sort((a, b) => {
    const createdAtDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    if (createdAtDiff !== 0) return createdAtDiff;
    return a.id.localeCompare(b.id);
  });
}

export function extractЗадачаTimelineEvents(activity: АктивностьEvent[] | null | undefined): ЗадачаTimelineEvent[] {
  const events: ЗадачаTimelineEvent[] = [];

  for (const event of activity ?? []) {
    const details = asRecord(event.details);
    if (!details) continue;

    if (event.action === "issue.comment_added") {
      if (details.followUpRequested !== true && details.resumeIntent !== true) continue;
      if (details.reopened === true) continue;
      const commentId = nullableString(details.commentId);
      events.push({
        id: event.id,
        createdAt: event.createdAt,
        actorТип: event.actorТип,
        actorId: event.actorId,
        runId: event.runId ?? null,
        commentId,
        followUpRequested: true,
      });
      continue;
    }

    if (event.action !== "issue.updated") continue;

    const previous = asRecord(details._previous);
    const timelineEvent: ЗадачаTimelineEvent = {
      id: event.id,
      createdAt: event.createdAt,
      actorТип: event.actorТип,
      actorId: event.actorId,
      runId: event.runId ?? null,
    };
    if (details.followUpRequested === true || details.resumeIntent === true) {
      timelineEvent.followUpRequested = true;
      timelineEvent.commentId = nullableString(details.commentId);
    }

    if (hasOwn(details, "status")) {
      const from = nullableString(previous?.status) ?? nullableString(details.reopenedFrom);
      const to = nullableString(details.status);
      if (from !== to) {
        timelineEvent.statusChange = { from, to };
      }
    }

    if (hasOwn(details, "assigneeАгентId") || hasOwn(details, "assigneeUserId")) {
      const previousИсполнитель: ЗадачаTimelineИсполнитель = {
        agentId: nullableString(previous?.assigneeАгентId),
        userId: nullableString(previous?.assigneeUserId),
      };
      const nextИсполнитель: ЗадачаTimelineИсполнитель = {
        agentId: hasOwn(details, "assigneeАгентId")
          ? nullableString(details.assigneeАгентId)
          : previousИсполнитель.agentId,
        userId: hasOwn(details, "assigneeUserId")
          ? nullableString(details.assigneeUserId)
          : previousИсполнитель.userId,
      };

      if (!sameИсполнитель(previousИсполнитель, nextИсполнитель)) {
        timelineEvent.assigneeChange = {
          from: previousИсполнитель,
          to: nextИсполнитель,
        };
      }
    }

    const workspaceChange = workspaceChangeFromДетали(details);
    if (workspaceChange) {
      timelineEvent.workspaceChange = workspaceChange;
    }

    if (
      timelineEvent.statusChange
      || timelineEvent.assigneeChange
      || timelineEvent.workspaceChange
      || timelineEvent.followUpRequested
    ) {
      events.push(timelineEvent);
    }
  }

  return sortTimelineEvents(events);
}
