import type { Агент, FeedbackVote } from "@paperclipai/shared";
import type { LiveЗапуститьForЗадача } from "../api/heartbeats";
import type { InlineEntityOption } from "../components/InlineEntitySelector";
import type { MentionOption } from "../components/MarkdownИзменитьor";
import type {
  ЗадачаChatComment,
  ЗадачаChatLinkedЗапустить,
  ЗадачаChatTranscriptEntry,
} from "../lib/issue-chat-messages";
import type { ЗадачаTimelineEvent } from "../lib/issue-timeline-events";

function createАгент(
  id: string,
  name: string,
  icon: string,
  urlКлюч: string,
): Агент {
  const now = new Date("2026-04-06T12:00:00.000Z");
  return {
    id,
    companyId: "company-ux",
    name,
    urlКлюч,
    role: "engineer",
    title: null,
    icon,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterТип: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    pauseReason: null,
    pausedAt: null,
    permissions: { canСоздатьАгенты: false },
  };
}

function createComment(overrides: Partial<ЗадачаChatComment>): ЗадачаChatComment {
  const merged: ЗадачаChatComment = {
    id: "comment-default",
    companyId: "company-ux",
    issueId: "issue-ux",
    authorТип: overrides.authorАгентId ? "agent" : "user",
    authorАгентId: null,
    authorUserId: "user-1",
    body: "",
    presentation: null,
    metadata: null,
    createdAt: new Date("2026-04-06T12:00:00.000Z"),
    updatedAt: new Date("2026-04-06T12:00:00.000Z"),
    ...overrides,
  };
  return merged;
}

const primaryАгент = createАгент("agent-1", "CodexCoder", "code", "codexcoder");
const reviewАгент = createАгент("agent-2", "ClaudeFixer", "sparkles", "claudefixer");

export const issueChatUxАгентMap = new Map<string, Агент>([
  [primaryАгент.id, primaryАгент],
  [reviewАгент.id, reviewАгент],
]);

export const issueChatUxMentions: MentionOption[] = [
  {
    id: "mention-agent-1",
    name: primaryАгент.name,
    kind: "agent",
    agentId: primaryАгент.id,
    agentIcon: primaryАгент.icon,
  },
  {
    id: "mention-agent-2",
    name: reviewАгент.name,
    kind: "agent",
    agentId: reviewАгент.id,
    agentIcon: reviewАгент.icon,
  },
  {
    id: "mention-project-1",
    name: "Paperclip Совет UI",
    kind: "project",
    projectId: "project-1",
    projectColor: "#0f766e",
  },
];

export const issueChatUxReassignOptions: InlineEntityOption[] = [
  {
    id: `agent:${primaryАгент.id}`,
    label: primaryАгент.name,
    searchText: `${primaryАгент.name} codex engineer`,
  },
  {
    id: `agent:${reviewАгент.id}`,
    label: reviewАгент.name,
    searchText: `${reviewАгент.name} claude reviewer`,
  },
  {
    id: "user:user-1",
    label: "Совет",
    searchText: "board user",
  },
];

export const issueChatUxLiveКомментарии: ЗадачаChatComment[] = [
  createComment({
    id: "comment-live-user",
    body: "Ship the issue page as a real chat. Keep the activity feed, but make the assistant flow feel conversational.",
    createdAt: new Date("2026-04-06T11:55:00.000Z"),
    updatedAt: new Date("2026-04-06T11:55:00.000Z"),
  }),
  createComment({
    id: "comment-live-agent",
    authorАгентId: primaryАгент.id,
    authorUserId: null,
    body: "I swapped the old comment stack for the new assistant-ui thread and kept the existing issue mutations intact.",
    createdAt: new Date("2026-04-06T12:01:00.000Z"),
    updatedAt: new Date("2026-04-06T12:01:00.000Z"),
    runId: "run-history-1",
    runАгентId: primaryАгент.id,
  }),
  createComment({
    id: "comment-live-queued",
    body: "Can you also make a dedicated review page that shows every chat state side by side?",
    createdAt: new Date("2026-04-06T12:05:30.000Z"),
    updatedAt: new Date("2026-04-06T12:05:30.000Z"),
    clientId: "client-queued-1",
    clientСтатус: "queued",
    queueState: "queued",
    queueЦельЗапуститьId: "run-live-1",
  }),
];

export const issueChatUxLiveEvents: ЗадачаTimelineEvent[] = [
  {
    id: "event-live-1",
    createdAt: new Date("2026-04-06T11:54:00.000Z"),
    actorТип: "user",
    actorId: "user-1",
    statusChange: {
      from: "done",
      to: "todo",
    },
  },
  {
    id: "event-live-2",
    createdAt: new Date("2026-04-06T11:54:30.000Z"),
    actorТип: "user",
    actorId: "user-1",
    assigneeChange: {
      from: { agentId: null, userId: null },
      to: { agentId: primaryАгент.id, userId: null },
    },
  },
];

export const issueChatUxLiveЗапуститьs: LiveЗапуститьForЗадача[] = [
  {
    id: "run-live-1",
    status: "running",
    invocationSource: "manual",
    triggerDetail: null,
    startedAt: "2026-04-06T12:04:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-06T12:04:00.000Z",
    agentId: primaryАгент.id,
    agentИмя: primaryАгент.name,
    adapterТип: "codex_local",
    issueId: "issue-ux",
  },
];

export const issueChatUxLinkedЗапуститьs: ЗадачаChatLinkedЗапустить[] = [
  {
    runId: "run-history-1",
    status: "succeeded",
    agentId: primaryАгент.id,
    createdAt: new Date("2026-04-06T11:58:00.000Z"),
    startedAt: new Date("2026-04-06T11:58:00.000Z"),
    finishedAt: new Date("2026-04-06T12:00:00.000Z"),
  },
  {
    runId: "run-review-1",
    status: "failed",
    agentId: reviewАгент.id,
    createdAt: new Date("2026-04-06T12:31:00.000Z"),
    startedAt: new Date("2026-04-06T12:31:00.000Z"),
    finishedAt: new Date("2026-04-06T12:33:00.000Z"),
  },
];

export const issueChatUxTranscriptsByЗапуститьId = new Map<string, readonly ЗадачаChatTranscriptEntry[]>([
  [
    "run-history-1",
    [
      {
        kind: "thinking",
        ts: "2026-04-06T11:58:03.000Z",
        text: "Reviewing the issue thread to see where transcript noise still leaks into the conversation.",
      },
      {
        kind: "tool_call",
        ts: "2026-04-06T11:58:07.000Z",
        name: "read_file",
        toolUseId: "tool-history-1",
        input: { path: "ui/src/lib/issue-chat-messages.ts" },
      },
      {
        kind: "tool_result",
        ts: "2026-04-06T11:58:11.000Z",
        toolUseId: "tool-history-1",
        content: "Found the run projection path that decides whether transcript output survives after completion.",
        isОшибка: false,
      },
      {
        kind: "assistant",
        ts: "2026-04-06T11:59:24.000Z",
        text: "Kept the completed run context attached to the chat timeline so the reasoning can stay folded instead of disappearing.",
      },
    ],
  ],
  [
    "run-live-1",
    [
      {
        kind: "assistant",
        ts: "2026-04-06T12:04:02.000Z",
        text: "I am reshaping the issue page so the thread reads like a conversation instead of a run log.",
      },
      {
        kind: "thinking",
        ts: "2026-04-06T12:04:05.000Z",
        text: "Need to remove the internal scrollbox first, otherwise the page still feels like a nested console.",
      },
      {
        kind: "tool_call",
        ts: "2026-04-06T12:04:08.000Z",
        name: "read_file",
        toolUseId: "tool-read-1",
        input: { path: "ui/src/components/ЗадачаChatThread.tsx" },
      },
      {
        kind: "tool_result",
        ts: "2026-04-06T12:04:11.000Z",
        toolUseId: "tool-read-1",
        content: "Loaded the current chat surface and found the max-h viewport constraint.",
        isОшибка: false,
      },
      {
        kind: "tool_call",
        ts: "2026-04-06T12:04:14.000Z",
        name: "apply_patch",
        toolUseId: "tool-edit-1",
        input: { file: "ui/src/components/ЗадачаChatThread.tsx", action: "remove scroll pane" },
      },
      {
        kind: "tool_result",
        ts: "2026-04-06T12:04:22.000Z",
        toolUseId: "tool-edit-1",
        content: "Обновлено layout classes and swapped Jump to latest to page-level scrolling.",
        isОшибка: false,
      },
      {
        kind: "stderr",
        ts: "2026-04-06T12:04:24.000Z",
        text: "vite warm-up: rebuilding route chunks",
      },
    ],
  ],
]);

export const issueChatUxОтправитьtingКомментарии: ЗадачаChatComment[] = [
  createComment({
    id: "comment-submitting-user-settled",
    body: "Let me know once the thread layout is locked down.",
    createdAt: new Date("2026-04-06T12:40:00.000Z"),
    updatedAt: new Date("2026-04-06T12:40:00.000Z"),
  }),
  createComment({
    id: "comment-submitting-pending",
    body: "Looks good — go ahead and ship it when you're ready.",
    createdAt: new Date("2026-04-06T12:42:00.000Z"),
    updatedAt: new Date("2026-04-06T12:42:00.000Z"),
    clientId: "client-pending-1",
    clientСтатус: "pending",
  }),
];

export const issueChatUxReviewКомментарии: ЗадачаChatComment[] = [
  createComment({
    id: "comment-review-user",
    body: "This looks close. Tighten the spacing and keep the composer grounded to the chat surface.",
    createdAt: new Date("2026-04-06T12:28:00.000Z"),
    updatedAt: new Date("2026-04-06T12:28:00.000Z"),
  }),
  createComment({
    id: "comment-review-agent",
    authorАгентId: reviewАгент.id,
    authorUserId: null,
    body: [
      "Adjusted the treatment to feel more like a product conversation.",
      "",
      "- Удалитьd the count from the heading",
      "- Let the page own scrolling",
      "- Добавитьed a dedicated `/tests/ux/chat` review page",
    ].join("\n"),
    createdAt: new Date("2026-04-06T12:34:00.000Z"),
    updatedAt: new Date("2026-04-06T12:34:00.000Z"),
    runId: "run-review-1",
    runАгентId: reviewАгент.id,
  }),
  createComment({
    id: "comment-review-user-followup",
    body: "Perfect. I also want to see an empty state and a blocked composer state before we merge.",
    createdAt: new Date("2026-04-06T12:36:00.000Z"),
    updatedAt: new Date("2026-04-06T12:36:00.000Z"),
  }),
];

export const issueChatUxReviewEvents: ЗадачаTimelineEvent[] = [
  {
    id: "event-review-1",
    createdAt: new Date("2026-04-06T12:27:00.000Z"),
    actorТип: "user",
    actorId: "user-1",
    assigneeChange: {
      from: { agentId: primaryАгент.id, userId: null },
      to: { agentId: reviewАгент.id, userId: null },
    },
  },
];

export const issueChatUxFeedbackVotes: FeedbackVote[] = [
  {
    id: "feedback-1",
    companyId: "company-ux",
    issueId: "issue-ux",
    targetТип: "issue_comment",
    targetId: "comment-review-agent",
    authorUserId: "user-1",
    vote: "up",
    reason: null,
    sharedWithLabs: false,
    sharedAt: null,
    consentВерсия: null,
    redactionSummary: null,
    createdAt: new Date("2026-04-06T12:35:00.000Z"),
    updatedAt: new Date("2026-04-06T12:35:00.000Z"),
  },
];
