import type {
  ReasoningMessagePart,
  TextMessagePart,
  ThreadAssistantMessage,
  ThreadMessage,
  ToolCallMessagePart,
  ThreadSystemMessage,
  ThreadUserMessage,
} from "@assistant-ui/react";
import type { Агент, ЗадачаComment } from "@paperclipai/shared";
import type { АктивенЗапуститьForЗадача, LiveЗапуститьForЗадача } from "../api/heartbeats";
import { formatИсполнительUserLabel } from "./assignees";
import {
  buildЗадачаThreadInteractionSummary,
  type ЗадачаThreadInteraction,
} from "./issue-thread-interactions";
import type { ЗадачаTimelineEvent } from "./issue-timeline-events";
import {
  summarizeНетtice,
} from "./transcriptPresentation";

type JsonЗначение = null | string | number | boolean | JsonЗначение[] | { [key: string]: JsonЗначение };
type JsonObject = { [key: string]: JsonЗначение };

export interface ЗадачаChatComment extends ЗадачаComment {
  runId?: string | null;
  runАгентId?: string | null;
  interruptedЗапуститьId?: string | null;
  clientId?: string;
  clientСтатус?: "pending" | "queued";
  queueState?: "queued";
  queueЦельЗапуститьId?: string | null;
  queueReason?: "hold" | "active_run" | "other";
  followUpRequested?: boolean;
}

export interface ЗадачаChatLinkedЗапустить {
  runId: string;
  status: string;
  agentId: string;
  adapterТип?: string;
  agentИмя?: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  finishedAt?: Date | string | null;
  hasStoredOutput?: boolean;
  logBytes?: number | null;
  resultJson?: Record<string, unknown> | null;
}

export interface ЗадачаChatTranscriptEntry {
  kind:
    | "assistant"
    | "thinking"
    | "user"
    | "tool_call"
    | "tool_result"
    | "init"
    | "result"
    | "stderr"
    | "system"
    | "stdout"
    | "diff";
  ts: string;
  text?: string;
  delta?: boolean;
  name?: string;
  input?: unknown;
  toolUseId?: string;
  toolИмя?: string;
  content?: string;
  isОшибка?: boolean;
  subtype?: string;
  errors?: string[];
  model?: string;
  sessionId?: string;
  inputТокенs?: number;
  outputТокенs?: number;
  cachedТокенs?: number;
  costUsd?: number;
  changeТип?: "add" | "remove" | "context" | "hunk" | "file_header" | "truncation";
}

const ISSUE_CHAT_TRANSCRIPT_MAX_VISIBLE_ENTRIES = 30;

type MessageWithOrder = {
  createdAtMs: number;
  order: number;
  message: ThreadMessage;
};

type СортировкаBoundaryItem = {
  createdAtMs: number;
  runId?: string | null;
};

export interface StableThreadMessageCacheEntry {
  fingerprint: string;
  message: ThreadMessage;
}

function toDate(value: Date | string | null | undefined) {
  return value instanceof Date ? value : new Date(value ?? Date.now());
}

function toTimestamp(value: Date | string | null | undefined) {
  return toDate(value).getTime();
}

function fingerprintThreadMessage(message: ThreadMessage) {
  return JSON.stringify(message);
}

export function stabilizeThreadMessages(
  messages: readonly ThreadMessage[],
  previousMessages: readonly ThreadMessage[],
  previousById: ReadonlyMap<string, StableThreadMessageCacheEntry>,
) {
  const nextById = new Map<string, StableThreadMessageCacheEntry>();
  let sameSequence = previousMessages.length === messages.length;

  const stabilizedMessages = messages.map((message, index) => {
    const fingerprint = fingerprintThreadMessage(message);
    const cached = previousById.get(message.id);
    const stableMessage =
      cached && cached.fingerprint === fingerprint
        ? cached.message
        : message;
    nextById.set(message.id, {
      fingerprint,
      message: stableMessage,
    });
    if (sameSequence && previousMessages[index] !== stableMessage) {
      sameSequence = false;
    }
    return stableMessage;
  });

  return {
    messages: sameSequence ? previousMessages : stabilizedMessages,
    cache: nextById,
  };
}

function sortByСоздано<T extends { createdAt: Date | string; id: string }>(items: readonly T[]) {
  return [...items].sort((a, b) => {
    const diff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function latestSameЗапуститьHandoffTimestamp(args: {
  interactionСозданоAtMs: number;
  sourceЗапуститьId: string;
  comments: readonly ЗадачаChatComment[];
  timelineEvents: readonly ЗадачаTimelineEvent[];
  linkedЗапуститьs: readonly ЗадачаChatLinkedЗапустить[];
  liveЗапуститьs: readonly LiveЗапуститьForЗадача[];
}) {
  const {
    interactionСозданоAtMs,
    sourceЗапуститьId,
    comments,
    timelineEvents,
    linkedЗапуститьs,
    liveЗапуститьs,
  } = args;
  const handoffItems: СортировкаBoundaryItem[] = [
    ...comments.map((comment) => ({
      createdAtMs: toTimestamp(comment.createdAt),
      runId: comment.runId ?? null,
    })),
    ...timelineEvents.map((event) => ({
      createdAtMs: toTimestamp(event.createdAt),
      runId: event.runId ?? null,
    })),
  ];
  const barrierItems: СортировкаBoundaryItem[] = [
    ...handoffItems,
    ...linkedЗапуститьs.map((run) => ({
      createdAtMs: toTimestamp(runTimestamp(run)),
      runId: run.runId,
    })),
    ...liveЗапуститьs.map((run) => ({
      createdAtMs: toTimestamp(run.startedAt ?? run.createdAt),
      runId: run.id,
    })),
  ];
  const barrierAtMs = barrierItems
    .filter((item) => item.createdAtMs > interactionСозданоAtMs && item.runId !== sourceЗапуститьId)
    .reduce<number | null>(
      (earliest, item) =>
        earliest === null ? item.createdAtMs : Math.min(earliest, item.createdAtMs),
      null,
    );

  return handoffItems
    .filter((item) =>
      item.createdAtMs > interactionСозданоAtMs
      && item.runId === sourceЗапуститьId
      && (barrierAtMs === null || item.createdAtMs < barrierAtMs)
    )
    .reduce<number | null>(
      (latest, item) =>
        latest === null ? item.createdAtMs : Math.max(latest, item.createdAtMs),
      null,
    );
}

function normalizeJsonЗначение(input: unknown): JsonЗначение {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((entry) => normalizeJsonЗначение(entry));
  }
  if (typeof input === "object" && input) {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      normalizeJsonЗначение(value),
    ]);
    return Object.fromEntries(entries) as JsonObject;
  }
  return String(input);
}

function normalizeToolArgs(input: unknown): JsonObject {
  if (typeof input === "object" && input && !Array.isArray(input)) {
    return normalizeJsonЗначение(input) as JsonObject;
  }
  if (input === undefined) return {};
  return { value: normalizeJsonЗначение(input) };
}

function stringifyНеизвестно(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function mergePartText(
  previous: TextMessagePart | ReasoningMessagePart,
  next: TextMessagePart | ReasoningMessagePart,
) {
  if (!previous.text) return next.text;
  if (!next.text) return previous.text;
  if (
    previous.text.endsWith("\n")
    || next.text.startsWith("\n")
    || previous.text.endsWith(" ")
    || next.text.startsWith(" ")
  ) {
    return `${previous.text}${next.text}`;
  }
  return previous.type === "text"
    ? `${previous.text} ${next.text}`
    : `${previous.text}\n${next.text}`;
}

function formatDiffBlock(lines: string[]) {
  return `\`\`\`diff\n${lines.join("\n")}\n\`\`\``;
}

function isЗадачаChatRenderableTranscriptEntry(entry: ЗадачаChatTranscriptEntry) {
  return entry.kind !== "init"
    && entry.kind !== "stderr"
    && entry.kind !== "stdout"
    && entry.kind !== "system";
}

function compactЗадачаChatTranscript(
  entries: readonly ЗадачаChatTranscriptEntry[],
  maxVisibleEntries = ISSUE_CHAT_TRANSCRIPT_MAX_VISIBLE_ENTRIES,
): readonly ЗадачаChatTranscriptEntry[] {
  const renderable = entries
    .map((entry, fullIndex) => ({ entry, fullIndex }))
    .filter(({ entry }) => isЗадачаChatRenderableTranscriptEntry(entry));

  if (renderable.length <= maxVisibleEntries) {
    return entries;
  }

  let startPos = Math.max(0, renderable.length - maxVisibleEntries);
  while (
    startPos > 0
    && renderable[startPos]?.entry.kind === "diff"
    && renderable[startPos - 1]?.entry.kind === "diff"
  ) {
    startPos -= 1;
  }

  const keptRenderablePositions = new Set<number>();
  for (let pos = startPos; pos < renderable.length; pos += 1) {
    keptRenderablePositions.add(pos);
  }

  // Keep the matching tool call when the visible tail starts at a tool result.
  for (let pos = startPos; pos < renderable.length; pos += 1) {
    const entry = renderable[pos]?.entry;
    if (entry?.kind !== "tool_result" || !entry.toolUseId) continue;
    for (let scan = pos - 1; scan >= 0; scan -= 1) {
      const candidate = renderable[scan]?.entry;
      if (candidate?.kind === "tool_call" && candidate.toolUseId === entry.toolUseId) {
        keptRenderablePositions.add(scan);
        break;
      }
    }
  }

  const keptFullIndices = new Set<number>();
  for (const pos of keptRenderablePositions) {
    const fullIndex = renderable[pos]?.fullIndex;
    if (fullIndex !== undefined) keptFullIndices.add(fullIndex);
  }

  const compactedEntries = entries.filter((_entry, index) => keptFullIndices.has(index));
  return compactedEntries;
}

function createAssistantMetadata(custom: Record<string, unknown>) {
  return {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom,
  } as const;
}

function authorИмяForComment(
  comment: ЗадачаChatComment,
  agentMap?: Map<string, Агент>,
  currentUserId?: string | null,
  userLabelMap?: ReadonlyMap<string, string> | null,
) {
  if (comment.authorАгентId) {
    return agentMap?.get(comment.authorАгентId)?.name ?? comment.authorАгентId.slice(0, 8);
  }
  const authorUserId = comment.authorUserId ?? null;
  if (!authorUserId) return "You";
  const userLabel = userLabelMap?.get(authorUserId)?.trim();
  if (userLabel) return userLabel;
  return formatИсполнительUserLabel(authorUserId, currentUserId, userLabelMap) ?? "You";
}

function formatСтатусLabel(status: string) {
  return status.replace(/_/g, " ");
}

function createCommentMessage(args: {
  comment: ЗадачаChatComment;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  companyId?: string | null;
  projectId?: string | null;
}): ThreadMessage {
  const { comment, agentMap, currentUserId, userLabelMap, companyId, projectId } = args;
  const createdAt = toDate(comment.createdAt);
  const authorИмя = authorИмяForComment(comment, agentMap, currentUserId, userLabelMap);
  const isSystemНетtice = comment.authorТип === "system";
  const custom = {
    kind: isSystemНетtice ? "system_notice" : "comment",
    commentId: comment.id,
    anchorId: `comment-${comment.id}`,
    authorИмя,
    authorТип: comment.authorТип,
    authorАгентId: comment.authorАгентId,
    authorUserId: comment.authorUserId,
    companyId: companyId ?? comment.companyId,
    projectId: projectId ?? null,
    runId: comment.runId ?? null,
    runАгентId: comment.runАгентId ?? null,
    clientСтатус: comment.clientСтатус ?? null,
    queueState: comment.queueState ?? null,
    queueЦельЗапуститьId: comment.queueЦельЗапуститьId ?? null,
    queueReason: comment.queueReason ?? null,
    interruptedЗапуститьId: comment.interruptedЗапуститьId ?? null,
    followUpRequested: comment.followUpRequested === true,
    presentation: comment.presentation ?? null,
    commentMetadata: comment.metadata ?? null,
  };

  if (isSystemНетtice) {
    const message: ThreadSystemMessage = {
      id: comment.id,
      role: "system",
      createdAt,
      content: [{ type: "text", text: comment.body }],
      metadata: { custom },
    };
    return message;
  }

  if (comment.authorАгентId) {
    const message: ThreadAssistantMessage = {
      id: comment.id,
      role: "assistant",
      createdAt,
      content: [{ type: "text", text: comment.body }],
      status: { type: "complete", reason: "stop" },
      metadata: createAssistantMetadata(custom),
    };
    return message;
  }

  const message: ThreadUserMessage = {
    id: comment.id,
    role: "user",
    createdAt,
    content: [{ type: "text", text: comment.body }],
    attachments: [],
    metadata: { custom },
  };
  return message;
}

function createTimelineEventMessage(args: {
  event: ЗадачаTimelineEvent;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
}) {
  const { event, agentMap, currentUserId, userLabelMap } = args;
  const actorИмя = event.actorТип === "agent"
    ? (agentMap?.get(event.actorId)?.name ?? event.actorId.slice(0, 8))
    : event.actorТип === "system"
      ? "System"
      : (formatИсполнительUserLabel(event.actorId, currentUserId, userLabelMap) ?? "Совет");

  const lines: string[] = [
    event.followUpRequested ? `${actorИмя} requested follow-up` : `${actorИмя} updated this issue`,
  ];
  if (event.statusChange) {
    lines.push(
      `Статус: ${event.statusChange.from ?? "none"} -> ${event.statusChange.to ?? "none"}`,
    );
  }
  if (event.assigneeChange) {
    const from = event.assigneeChange.from.agentId
      ? (agentMap?.get(event.assigneeChange.from.agentId)?.name ?? event.assigneeChange.from.agentId.slice(0, 8))
      : (formatИсполнительUserLabel(event.assigneeChange.from.userId, currentUserId, userLabelMap) ?? "Не назначен");
    const to = event.assigneeChange.to.agentId
      ? (agentMap?.get(event.assigneeChange.to.agentId)?.name ?? event.assigneeChange.to.agentId.slice(0, 8))
      : (formatИсполнительUserLabel(event.assigneeChange.to.userId, currentUserId, userLabelMap) ?? "Не назначен");
    lines.push(`Исполнитель: ${from} -> ${to}`);
  }
  if (event.workspaceChange) {
    lines.push(
      `Рабочая область: ${event.workspaceChange.from.label ?? "none"} -> ${event.workspaceChange.to.label ?? "none"}`,
    );
  }

  const message: ThreadSystemMessage = {
    id: `activity:${event.id}`,
    role: "system",
    createdAt: toDate(event.createdAt),
    content: [{ type: "text", text: lines.join("\n") }],
    metadata: {
      custom: {
        kind: "event",
        anchorId: `activity-${event.id}`,
        eventId: event.id,
        actorИмя,
        actorТип: event.actorТип,
        actorId: event.actorId,
        statusChange: event.statusChange ?? null,
        assigneeChange: event.assigneeChange ?? null,
        workspaceChange: event.workspaceChange ?? null,
        followUpRequested: event.followUpRequested === true,
      },
    },
  };
  return message;
}

function createInteractionMessage(interaction: ЗадачаThreadInteraction) {
  const message: ThreadSystemMessage = {
    id: `interaction:${interaction.id}`,
    role: "system",
    createdAt: toDate(interaction.createdAt),
    content: [{ type: "text", text: buildЗадачаThreadInteractionSummary(interaction) }],
    metadata: {
      custom: {
        kind: "interaction",
        anchorId: `interaction-${interaction.id}`,
        interaction,
      },
    },
  };
  return message;
}

function runTimestamp(run: ЗадачаChatLinkedЗапустить) {
  return run.finishedAt ?? run.startedAt ?? run.createdAt;
}

export interface SegmentTiming {
  startMs: number;
  endMs: number;
}

function computeSegmentTimings(entries: readonly ЗадачаChatTranscriptEntry[]): SegmentTiming[] {
  const timings: SegmentTiming[] = [];
  let inSegment = false;
  let segНачать = 0;
  let segEnd = 0;

  for (const entry of entries) {
    const ts = new Date(entry.ts).getTime();

    const isCoT =
      entry.kind === "thinking" ||
      entry.kind === "tool_call" ||
      entry.kind === "tool_result" ||
      entry.kind === "diff" ||
      (entry.kind === "result" && ((entry.isОшибка && !!entry.errors?.length) || !!entry.text));
    const isText = entry.kind === "assistant" && !!entry.text;

    if (isCoT) {
      if (!inSegment) {
        inSegment = true;
        segНачать = ts;
      }
      segEnd = ts;
    } else if (isText && inSegment) {
      timings.push({ startMs: segНачать, endMs: segEnd });
      inSegment = false;
    }
  }

  if (inSegment) {
    timings.push({ startMs: segНачать, endMs: segEnd });
  }

  return timings;
}

export function formatDurationWords(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function runDurationLabel(run: {
  status: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  finishedAt?: Date | string | null;
  resultJson?: Record<string, unknown> | null;
}) {
  const start = run.startedAt ?? run.createdAt;
  const end = run.finishedAt ?? null;
  const durationMs = end ? Math.max(0, toTimestamp(end) - toTimestamp(start)) : null;
  const durationText = formatDurationWords(durationMs);
  const stopReason = typeof run.resultJson?.stopReason === "string" ? run.resultJson.stopReason : null;
  switch (run.status) {
    case "succeeded":
      return durationText ? `Работаed for ${durationText}` : "Finished work";
    case "failed":
    case "error":
      return durationText ? `Ошибка after ${durationText}` : "Запустить failed";
    case "timed_out":
      return durationText ? `Timed out after ${durationText}` : "Запустить timed out";
    case "cancelled":
      if (stopReason === "paused") {
        return durationText ? `Приостановлен by board after ${durationText}` : "Приостановлен by board";
      }
      return durationText ? `Отменён after ${durationText}` : "Запустить cancelled";
    case "queued":
      return "Queued";
    case "running":
      return "Работаing...";
    default:
      return formatСтатусLabel(run.status);
  }
}

function createHistoricalЗапуститьMessage(run: ЗадачаChatLinkedЗапустить, agentMap?: Map<string, Агент>) {
  const agentИмя = run.agentИмя ?? agentMap?.get(run.agentId)?.name ?? run.agentId.slice(0, 8);
  const message: ThreadSystemMessage = {
    id: `run:${run.runId}`,
    role: "system",
    createdAt: toDate(runTimestamp(run)),
    content: [{ type: "text", text: `${agentИмя} run ${run.runId.slice(0, 8)} ${formatСтатусLabel(run.status)}` }],
    metadata: {
      custom: {
        kind: "run",
        anchorId: `run-${run.runId}`,
        runId: run.runId,
        runАгентId: run.agentId,
        runАгентИмя: agentИмя,
        runСтатус: run.status,
      },
    },
  };
  return message;
}

function createHistoricalTranscriptMessage(args: {
  run: ЗадачаChatLinkedЗапустить;
  transcript: readonly ЗадачаChatTranscriptEntry[];
  hasOutput: boolean;
  agentMap?: Map<string, Агент>;
}) {
  const { run, transcript, hasOutput, agentMap } = args;
  const agentИмя = run.agentИмя ?? agentMap?.get(run.agentId)?.name ?? run.agentId.slice(0, 8);
  const compactedTranscript = compactЗадачаChatTranscript(transcript);
  const { parts, notices, segments } = buildAssistantPartsFromTranscript(compactedTranscript);
  const waitingText = hasOutput ? "" : "Запустить finished";
  const content = parts.length > 0
    ? parts
    : waitingText
      ? [{ type: "text", text: waitingText } satisfies TextMessagePart]
      : [];

  const message: ThreadAssistantMessage = {
    id: `run-assistant:${run.runId}`,
    role: "assistant",
    createdAt: toDate(run.startedAt ?? run.createdAt),
    content,
    status: { type: "complete", reason: "stop" },
    metadata: createAssistantMetadata({
      kind: "historical-run",
      anchorId: `run-${run.runId}`,
      runId: run.runId,
      runАгентId: run.agentId,
      runАгентИмя: agentИмя,
      runСтатус: run.status,
      notices,
      waitingText,
      chainOfThoughtLabel: runDurationLabel(run),
      chainOfThoughtSegments: segments,
    }),
  };
  return message;
}

export function buildAssistantPartsFromTranscript(entries: readonly ЗадачаChatTranscriptEntry[]): {
  parts: Array<TextMessagePart | ReasoningMessagePart | ToolCallMessagePart<JsonObject, unknown>>;
  notices: string[];
  segments: SegmentTiming[];
} {
  const orderedParts: Array<TextMessagePart | ReasoningMessagePart | ToolCallMessagePart<JsonObject, unknown>> = [];
  const toolParts = new Map<string, ToolCallMessagePart<JsonObject, unknown>>();
  const toolIndices = new Map<string, number>();
  const notices: string[] = [];
  let pendingDiffLines: string[] = [];
  let pendingDiffРодительId: string | undefined;

  const flushОжиданиеDiff = () => {
    if (pendingDiffLines.length === 0) return;
    orderedParts.push({
      type: "text",
      text: formatDiffBlock(pendingDiffLines),
      parentId: pendingDiffРодительId,
    });
    pendingDiffLines = [];
    pendingDiffРодительId = undefined;
  };

  for (const [index, entry] of entries.entries()) {
    if (entry.kind === "diff") {
      pendingDiffРодительId ??= `diff-group:${index}`;
      pendingDiffLines.push(entry.text ?? "");
      continue;
    }

    flushОжиданиеDiff();

    if (entry.kind === "assistant" && entry.text) {
      orderedParts.push({ type: "text", text: entry.text });
      continue;
    }
    if (entry.kind === "thinking" && entry.text) {
      orderedParts.push({ type: "reasoning", text: entry.text });
      continue;
    }
    if (entry.kind === "tool_call") {
      const toolCallId = entry.toolUseId || `tool-${index}`;
      const nextPart: ToolCallMessagePart<JsonObject, unknown> = {
        type: "tool-call",
        toolCallId,
        toolИмя: entry.name || "tool",
        args: normalizeToolArgs(entry.input),
        argsText: stringifyНеизвестно(entry.input),
      };
      if (!toolParts.has(toolCallId)) {
        toolIndices.set(toolCallId, orderedParts.length);
        orderedParts.push(nextPart);
      } else {
        const existingIndex = toolIndices.get(toolCallId);
        if (existingIndex !== undefined) {
          orderedParts[existingIndex] = nextPart;
        }
      }
      toolParts.set(toolCallId, nextPart);
      continue;
    }
    if (entry.kind === "tool_result") {
      const toolCallId = entry.toolUseId || `tool-result-${index}`;
      const existing = toolParts.get(toolCallId);
      const nextPart: ToolCallMessagePart<JsonObject, unknown> = {
        type: "tool-call",
        toolCallId,
        toolИмя: existing?.toolИмя || entry.toolИмя || "tool",
        args: existing?.args ?? {},
        argsText: existing?.argsText ?? "",
        result: entry.content ?? "",
        isОшибка: entry.isОшибка === true,
      };
      if (existing) {
        const existingIndex = toolIndices.get(toolCallId);
        if (existingIndex !== undefined) {
          orderedParts[existingIndex] = nextPart;
        }
      } else {
        toolIndices.set(toolCallId, orderedParts.length);
        orderedParts.push(nextPart);
      }
      toolParts.set(toolCallId, nextPart);
      continue;
    }
    if (entry.kind === "init") continue;
    if (entry.kind === "stderr") continue;
    if (entry.kind === "stdout") continue;
    if (entry.kind === "system") continue;
    if (entry.kind === "result") {
      if (entry.isОшибка && entry.errors?.length) {
        for (const error of entry.errors) {
          orderedParts.push({ type: "reasoning", text: `Запустить error: ${summarizeНетtice(error)}` });
        }
      } else if (entry.text) {
        orderedParts.push({
          type: "reasoning",
          text: entry.isОшибка
            ? `Запустить error: ${summarizeНетtice(entry.text)}`
            : summarizeНетtice(entry.text),
        });
      }
      continue;
    }
  }

  flushОжиданиеDiff();

  const mergedParts: Array<TextMessagePart | ReasoningMessagePart | ToolCallMessagePart<JsonObject, unknown>> = [];
  for (const part of orderedParts) {
    if (part.type === "tool-call") {
      mergedParts.push(part);
      continue;
    }
    const previous = mergedParts.at(-1);
    if (previous && previous.type === part.type && previous.parentId === part.parentId) {
      mergedParts[mergedParts.length - 1] = {
        ...previous,
        text: mergePartText(previous, part),
      };
      continue;
    }
    mergedParts.push(part);
  }

  return {
    parts: mergedParts,
    notices,
    segments: computeSegmentTimings(entries),
  };
}

function normalizeLiveЗапуститьs(
  liveЗапуститьs: readonly LiveЗапуститьForЗадача[],
  activeЗапустить: АктивенЗапуститьForЗадача | null | undefined,
  issueId?: string,
) {
  const deduped = new Map<string, LiveЗапуститьForЗадача>();
  for (const run of liveЗапуститьs) {
    deduped.set(run.id, run);
  }
  if (activeЗапустить) {
    deduped.set(activeЗапустить.id, {
      id: activeЗапустить.id,
      status: activeЗапустить.status,
      invocationSource: activeЗапустить.invocationSource,
      triggerDetail: activeЗапустить.triggerDetail,
      startedAt: activeЗапустить.startedAt ? toDate(activeЗапустить.startedAt).toISOString() : null,
      finishedAt: activeЗапустить.finishedAt ? toDate(activeЗапустить.finishedAt).toISOString() : null,
      createdAt: toDate(activeЗапустить.createdAt).toISOString(),
      agentId: activeЗапустить.agentId,
      agentИмя: activeЗапустить.agentИмя,
      adapterТип: activeЗапустить.adapterТип,
      issueId,
    });
  }
  return [...deduped.values()].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
}

function createLiveЗапуститьMessage(args: {
  run: LiveЗапуститьForЗадача;
  transcript: readonly ЗадачаChatTranscriptEntry[];
}) {
  const { run, transcript } = args;
  const compactedTranscript = compactЗадачаChatTranscript(transcript);
  const { parts, notices, segments } = buildAssistantPartsFromTranscript(compactedTranscript);
  const waitingText =
    run.status === "queued"
      ? "Queued..."
      : parts.length > 0
        ? ""
        : "Работаing...";

  const content = parts;

  const message: ThreadAssistantMessage = {
    id: `run-assistant:${run.id}`,
    role: "assistant",
    createdAt: toDate(run.startedAt ?? run.createdAt),
    content,
    status: { type: "running" },
    metadata: createAssistantMetadata({
      kind: "live-run",
      runId: run.id,
      runАгентId: run.agentId,
      runАгентИмя: run.agentИмя,
      runСтатус: run.status,
      adapterТип: run.adapterТип,
      notices,
      waitingText,
      chainOfThoughtLabel: runDurationLabel(run),
      chainOfThoughtSegments: segments,
    }),
  };
  return message;
}

export function buildЗадачаChatMessages(args: {
  comments: readonly ЗадачаChatComment[];
  interactions?: readonly ЗадачаThreadInteraction[];
  timelineEvents: readonly ЗадачаTimelineEvent[];
  linkedЗапуститьs: readonly ЗадачаChatLinkedЗапустить[];
  liveЗапуститьs: readonly LiveЗапуститьForЗадача[];
  activeЗапустить?: АктивенЗапуститьForЗадача | null;
  transcriptsByЗапуститьId?: ReadonlyMap<string, readonly ЗадачаChatTranscriptEntry[]>;
  hasOutputForЗапустить?: (runId: string) => boolean;
  includeSucceededЗапуститьsWithoutOutput?: boolean;
  issueId?: string;
  companyId?: string | null;
  projectId?: string | null;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
}) {
  const {
    comments,
    interactions = [],
    timelineEvents,
    linkedЗапуститьs,
    liveЗапуститьs,
    activeЗапустить,
    transcriptsByЗапуститьId,
    hasOutputForЗапустить,
    includeSucceededЗапуститьsWithoutOutput = false,
    issueId,
    companyId,
    projectId,
    agentMap,
    currentUserId,
    userLabelMap,
  } = args;

  const orderedMessages: MessageWithOrder[] = [];

  for (const comment of sortByСоздано(comments)) {
    orderedMessages.push({
      createdAtMs: toTimestamp(comment.createdAt),
      order: 1,
      message: createCommentMessage({ comment, agentMap, currentUserId, userLabelMap, companyId, projectId }),
    });
  }

  for (const interaction of sortByСоздано(interactions)) {
    const createdAtMs = toTimestamp(interaction.createdAt);
    const handoffAtMs = interaction.kind === "request_confirmation" && interaction.sourceЗапуститьId
      ? latestSameЗапуститьHandoffTimestamp({
        interactionСозданоAtMs: createdAtMs,
        sourceЗапуститьId: interaction.sourceЗапуститьId,
        comments,
        timelineEvents,
        linkedЗапуститьs,
        liveЗапуститьs,
      })
      : null;
    orderedMessages.push({
      createdAtMs: handoffAtMs ?? createdAtMs,
      order: 2,
      message: createInteractionMessage(interaction),
    });
  }

  for (const event of sortByСоздано(timelineEvents)) {
    orderedMessages.push({
      createdAtMs: toTimestamp(event.createdAt),
      order: 0,
      message: createTimelineEventMessage({ event, agentMap, currentUserId, userLabelMap }),
    });
  }

  for (const run of [...linkedЗапуститьs].sort((a, b) => toTimestamp(runTimestamp(a)) - toTimestamp(runTimestamp(b)))) {
    const transcript = transcriptsByЗапуститьId?.get(run.runId) ?? [];
    const hasЗапуститьOutput = transcript.length > 0 || (hasOutputForЗапустить?.(run.runId) ?? false);
    if (hasЗапуститьOutput || run.status !== "succeeded") {
      // Always use the transcript message for non-succeeded runs (even before
      // transcript data loads) so the message type and fold header are stable
      // from initial render — avoids a flash when transcripts arrive later.
      orderedMessages.push({
        createdAtMs: toTimestamp(run.startedAt ?? run.createdAt),
        order: 2,
        message: createHistoricalTranscriptMessage({
          run,
          transcript,
          hasOutput: hasЗапуститьOutput,
          agentMap,
        }),
      });
      continue;
    }
    if (!includeSucceededЗапуститьsWithoutOutput) continue;
    orderedMessages.push({
      createdAtMs: toTimestamp(runTimestamp(run)),
      order: 2,
      message: createHistoricalЗапуститьMessage(run, agentMap),
    });
  }

  for (const run of normalizeLiveЗапуститьs(liveЗапуститьs, activeЗапустить, issueId)) {
    orderedMessages.push({
      createdAtMs: toTimestamp(run.startedAt ?? run.createdAt),
      order: 3,
      message: createLiveЗапуститьMessage({
        run,
        transcript: transcriptsByЗапуститьId?.get(run.id) ?? [],
      }),
    });
  }

  return orderedMessages
    .sort((a, b) => {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      if (a.order !== b.order) return a.order - b.order;
      return a.message.id.localeCompare(b.message.id);
    })
    .map((entry) => entry.message);
}
