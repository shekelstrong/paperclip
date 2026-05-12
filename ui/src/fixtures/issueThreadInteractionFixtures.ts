import type { LiveRunForIssue } from "../api/heartbeats";
import type {
  IssueChatComment,
  IssueChatTranscriptEntry,
} from "../lib/issue-chat-messages";
import type { IssueTimelineEvent } from "../lib/issue-timeline-events";
import type {
  AskUserQuestionsInteraction,
  RequestConfirmationInteraction,
  SuggestTasksInteraction,
} from "../lib/issue-thread-interactions";

export const issueThreadInteractionFixtureMeta = {
  companyId: "company-storybook",
  projectId: "project-board-ui",
  issueId: "issue-thread-interactions",
  currentUserId: "user-board",
} as const;

function createComment(overrides: Partial<IssueChatComment>): IssueChatComment {
  const createdAt = overrides.createdAt ?? new Date("2026-04-20T14:00:00.000Z");
  return {
    id: "comment-default",
    companyId: issueThreadInteractionFixtureMeta.companyId,
    issueId: issueThreadInteractionFixtureMeta.issueId,
    authorType: overrides.authorAgentId ? "agent" : "user",
    authorAgentId: null,
    authorUserId: issueThreadInteractionFixtureMeta.currentUserId,
    body: "",
    presentation: null,
    metadata: null,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    ...overrides,
  };
}

function createSuggestTasksInteraction(
  overrides: Partial<SuggestTasksInteraction>,
): SuggestTasksInteraction {
  return {
    id: "interaction-suggest-default",
    companyId: issueThreadInteractionFixtureMeta.companyId,
    issueId: issueThreadInteractionFixtureMeta.issueId,
    kind: "suggest_tasks",
    title: "Предлагаемое дерево задач для первого прохода взаимодействия",
    summary:
      "Draft task creation stays pending until a reviewer accepts it, so the thread can preview structure without mutating the task system.",
    status: "pending",
    continuationPolicy: "wake_assignee",
    createdByAgentId: "agent-codex",
    createdByUserId: null,
    resolvedByAgentId: null,
    resolvedByUserId: null,
    createdAt: new Date("2026-04-20T14:11:00.000Z"),
    updatedAt: new Date("2026-04-20T14:11:00.000Z"),
    resolvedAt: null,
    payload: {
      version: 1,
      defaultParentId: "PAP-1709",
      tasks: [
        {
          clientKey: "root-design",
          title: "Прототип карточек взаимодействия задач-потоков",
          description:
            "Build render-only cards that sit in the issue feed and show suggested tasks before anything is persisted.",
          priority: "high",
          assigneeAgentId: "agent-codex",
          billingCode: "ui-research",
          labels: ["UI", "interaction"],
        },
        {
          clientKey: "child-stories",
          parentClientKey: "root-design",
          title: "Добавить Storybook для состояний принятия и отклонения",
          description:
            "Покрытие превью: ожидание, принятие, отклонение и свёрнутые дочерние элементы в fixture-backed story.",
          priority: "medium",
          assigneeAgentId: "agent-qa",
          labels: ["Storybook"],
        },
        {
          clientKey: "child-mixed-thread",
          parentClientKey: "root-design",
          title: "Прототип смешанного потока",
          description:
            "Показывать комментарии, активность, живые запуски и карточки взаимодействий в одном хронологическом потоке.",
          priority: "medium",
          assigneeAgentId: "agent-codex",
          labels: ["Поток задачи"],
        },
        {
          clientKey: "hidden-follow-up",
          parentClientKey: "child-mixed-thread",
          title: "Доработка отступов и кратких ответов",
          description:
            "Свернуть под видимым деревом задач, чтобы превью показало обработку скрытых потомков.",
          priority: "low",
          hiddenInPreview: true,
        },
      ],
    },
    result: null,
    ...overrides,
  };
}

function createAskUserQuestionsInteraction(
  overrides: Partial<AskUserQuestionsInteraction>,
): AskUserQuestionsInteraction {
  return {
    id: "interaction-questions-default",
    companyId: issueThreadInteractionFixtureMeta.companyId,
    issueId: issueThreadInteractionFixtureMeta.issueId,
    kind: "ask_user_questions",
    title: "Разрешите открытые UX-решения перед Phase 1",
    summary:
      "This form stays local until the operator submits it, so the assignee only wakes once after the whole answer set is ready.",
    status: "pending",
    continuationPolicy: "wake_assignee",
    createdByAgentId: "agent-codex",
    createdByUserId: null,
    resolvedByAgentId: null,
    resolvedByUserId: null,
    createdAt: new Date("2026-04-20T14:18:00.000Z"),
    updatedAt: new Date("2026-04-20T14:18:00.000Z"),
    resolvedAt: null,
    payload: {
      version: 1,
      title: "Before I wire the persistence layer, which preview behavior do you want?",
      submitLabel: "Отправить ответы",
      questions: [
        {
          id: "collapse-depth",
          prompt: "How aggressive should the suggested-task preview collapse descendant work?",
          helpText:
            "We need enough context to review the tree without making the feed feel like a project plan.",
          selectionMode: "single",
          required: true,
          options: [
            {
              id: "visible-root",
              label: "Сворачивать только скрытых потомков",
              description: "Держать развёрнутыми корневые и видимые дочерние задачи.",
            },
            {
              id: "collapse-all",
              label: "Свернуть всех потомков по умолчанию",
              description: "Показывать только корневые задачи, пока оператор не развернёт дерево.",
            },
          ],
        },
        {
          id: "post-submit-summary",
          prompt: "What should the answered-state card emphasize after submission?",
          helpText: "Выберите каждое summary treatment, которое поможет будущим рецензентам.",
          selectionMode: "multi",
          required: true,
          options: [
            {
              id: "answers-inline",
              label: "Inline answer pills",
              description: "Keep the exact operator choices visible under each question.",
            },
            {
              id: "summary-note",
              label: "Short markdown summary",
              description: "Добавьте компактное повествовательное summary внизу карточки.",
            },
            {
              id: "resolver-meta",
              label: "Resolver metadata",
              description: "Показать, кто ответил и когда, без открытия raw thread.",
            },
          ],
        },
      ],
    },
    result: null,
    ...overrides,
  };
}

function createRequestConfirmationInteraction(
  overrides: Partial<RequestConfirmationInteraction>,
): RequestConfirmationInteraction {
  return {
    id: "interaction-confirmation-default",
    companyId: issueThreadInteractionFixtureMeta.companyId,
    issueId: issueThreadInteractionFixtureMeta.issueId,
    kind: "request_confirmation",
    title: "Approve the proposed plan",
    summary:
      "Исполнитель ожидает прямого решения доски перед продолжением работы над планом.",
    status: "pending",
    continuationPolicy: "wake_assignee",
    createdByAgentId: "agent-codex",
    createdByUserId: null,
    resolvedByAgentId: null,
    resolvedByUserId: null,
    createdAt: new Date("2026-04-20T14:30:00.000Z"),
    updatedAt: new Date("2026-04-20T14:30:00.000Z"),
    resolvedAt: null,
    payload: {
      version: 1,
      prompt: "Утвердить план и позволить исполнителю начать реализацию?",
      acceptLabel: "Утвердить план",
      rejectLabel: "Запросить правки",
      rejectRequiresReason: true,
      rejectReasonLabel: "Опишите изменения плана, необходимые перед утверждением",
      detailsMarkdown:
        "This confirmation watches the `plan` document revision so stale approvals are blocked if the plan changes.",
      supersedeOnUserComment: true,
      target: {
        type: "issue_document",
        issueId: issueThreadInteractionFixtureMeta.issueId,
        key: "plan",
        revisionId: "11111111-1111-4111-8111-111111111111",
        revisionNumber: 3,
      },
    },
    result: null,
    ...overrides,
  };
}

export const pendingSuggestedTasksInteraction = createSuggestTasksInteraction({});

export const acceptedSuggestedTasksInteraction = createSuggestTasksInteraction({
  id: "interaction-suggest-accepted",
  status: "accepted",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:16:00.000Z"),
  updatedAt: new Date("2026-04-20T14:16:00.000Z"),
  result: {
    version: 1,
    createdTasks: [
      {
        clientKey: "root-design",
        issueId: "issue-created-1",
        identifier: "PAP-1713",
        title: "Прототип карточек взаимодействия задач-потоков",
      },
      {
        clientKey: "child-stories",
        issueId: "issue-created-2",
        identifier: "PAP-1714",
        title: "Добавить Storybook для состояний принятия и отклонения",
        parentIssueId: "issue-created-1",
        parentIdentifier: "PAP-1713",
      },
      {
        clientKey: "child-mixed-thread",
        issueId: "issue-created-3",
        identifier: "PAP-1715",
        title: "Прототип смешанного потока",
        parentIssueId: "issue-created-1",
        parentIdentifier: "PAP-1713",
      },
      {
        clientKey: "hidden-follow-up",
        issueId: "issue-created-4",
        identifier: "PAP-1716",
        title: "Доработка отступов и кратких ответов",
        parentIssueId: "issue-created-3",
        parentIdentifier: "PAP-1715",
      },
    ],
  },
});

export const rejectedSuggestedTasksInteraction = createSuggestTasksInteraction({
  id: "interaction-suggest-rejected",
  status: "rejected",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:17:00.000Z"),
  updatedAt: new Date("2026-04-20T14:17:00.000Z"),
  result: {
    version: 1,
    rejectionReason:
      "Keep the first pass tighter. The hidden follow-on work is useful, but the acceptance story should stay focused on one visible root and one visible child.",
  },
});

export const pendingAskUserQuestionsInteraction = createAskUserQuestionsInteraction({});

export const answeredAskUserQuestionsInteraction = createAskUserQuestionsInteraction({
  id: "interaction-questions-answered",
  status: "answered",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:24:00.000Z"),
  updatedAt: new Date("2026-04-20T14:24:00.000Z"),
  result: {
    version: 1,
    answers: [
      {
        questionId: "collapse-depth",
        optionIds: ["visible-root"],
      },
      {
        questionId: "post-submit-summary",
        optionIds: ["answers-inline", "summary-note", "resolver-meta"],
      },
    ],
    summaryMarkdown: [
      "- Keep visible child tasks expanded when they are part of the main review path.",
      "- Preserve inline answer chips and resolver metadata in the answered state.",
      "- Add a short summary note so future reviewers understand the operator's intent without replaying the form.",
    ].join("\n"),
  },
});

export const pendingRequestConfirmationInteraction = createRequestConfirmationInteraction({});

export const genericPendingRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-generic-pending",
  title: "Confirm next step",
  summary: "Исполнителю нужно простое да или нет перед продолжением.",
  continuationPolicy: "none",
  payload: {
    version: 1,
    prompt: "Продолжить с текущим подходом?",
  },
});

export const optionalDeclineRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-optional-decline",
  continuationPolicy: "none",
  payload: {
    version: 1,
    prompt: "Использовать более короткий путь реализации?",
    acceptLabel: "Confirm",
    rejectLabel: "Decline",
    rejectRequiresReason: false,
    declineReasonPlaceholder: "Optional: tell the agent what you'd change.",
  },
});

export const disabledDeclineReasonRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-no-decline-reason",
  continuationPolicy: "none",
  payload: {
    version: 1,
    prompt: "Закрыть этот низкорисковый follow-up как ненужный?",
    acceptLabel: "Закрыть",
    rejectLabel: "Оставить",
    allowDeclineReason: false,
  },
});

export const acceptedRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-accepted",
  status: "accepted",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:34:00.000Z"),
  updatedAt: new Date("2026-04-20T14:34:00.000Z"),
  result: {
    version: 1,
    outcome: "accepted",
  },
});

export const planApprovalAcceptedRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-plan-accepted",
  status: "accepted",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:34:00.000Z"),
  updatedAt: new Date("2026-04-20T14:34:00.000Z"),
  payload: {
    version: 1,
    prompt: "Утвердить план и позволить исполнителю начать реализацию?",
    acceptLabel: "Утвердить план",
    rejectLabel: "Request changes",
    rejectRequiresReason: true,
    declineReasonPlaceholder: "Опционально: что бы вы хотели исправить?",
    target: {
      type: "issue_document",
      issueId: issueThreadInteractionFixtureMeta.issueId,
      key: "plan",
      revisionId: "11111111-1111-4111-8111-111111111111",
      revisionNumber: 4,
    },
  },
  result: {
    version: 1,
    outcome: "accepted",
  },
});

export const rejectedRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-rejected",
  status: "rejected",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:36:00.000Z"),
  updatedAt: new Date("2026-04-20T14:36:00.000Z"),
  result: {
    version: 1,
    outcome: "rejected",
    reason: "Split the migration and UI work into separate reviewable steps.",
  },
});

export const rejectedNoReasonRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-rejected-no-reason",
  status: "rejected",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:37:00.000Z"),
  updatedAt: new Date("2026-04-20T14:37:00.000Z"),
  result: {
    version: 1,
    outcome: "rejected",
    reason: null,
  },
});

export const commentExpiredRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-expired-comment",
  status: "expired",
  resolvedByUserId: issueThreadInteractionFixtureMeta.currentUserId,
  resolvedAt: new Date("2026-04-20T14:38:00.000Z"),
  updatedAt: new Date("2026-04-20T14:38:00.000Z"),
  result: {
    version: 1,
    outcome: "superseded_by_comment",
    commentId: "22222222-2222-4222-8222-222222222222",
  },
});

export const staleTargetRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-expired-target",
  status: "expired",
  resolvedByAgentId: "agent-codex",
  resolvedAt: new Date("2026-04-20T14:40:00.000Z"),
  updatedAt: new Date("2026-04-20T14:40:00.000Z"),
  payload: {
    version: 1,
    prompt: "Утвердить план и позволить исполнителю начать реализацию?",
    acceptLabel: "Утвердить план",
    rejectLabel: "Запросить правки",
    rejectRequiresReason: true,
    target: {
      type: "issue_document",
      issueId: issueThreadInteractionFixtureMeta.issueId,
      key: "plan",
      revisionId: "44444444-4444-4444-8444-444444444444",
      revisionNumber: 4,
    },
  },
  result: {
    version: 1,
    outcome: "stale_target",
    staleTarget: {
      type: "issue_document",
      issueId: issueThreadInteractionFixtureMeta.issueId,
      key: "plan",
      revisionId: "11111111-1111-4111-8111-111111111111",
      revisionNumber: 3,
    },
  },
});

export const failedRequestConfirmationInteraction = createRequestConfirmationInteraction({
  id: "interaction-confirmation-failed",
  status: "failed",
  updatedAt: new Date("2026-04-20T14:42:00.000Z"),
});

export const issueThreadInteractionComments: IssueChatComment[] = [
  createComment({
    id: "comment-thread-board",
    body: "Pressure-test first-class issue-thread interactions before we touch persistence. I want to see the cards in the real feed, not in a disconnected mock.",
    createdAt: new Date("2026-04-20T14:02:00.000Z"),
    updatedAt: new Date("2026-04-20T14:02:00.000Z"),
  }),
  createComment({
    id: "comment-thread-agent",
    authorAgentId: "agent-codex",
    authorUserId: null,
    body: "I found the existing issue chat surface and I am adding prototype-only interaction records so the Storybook review can happen before persistence work.",
    createdAt: new Date("2026-04-20T14:09:00.000Z"),
    updatedAt: new Date("2026-04-20T14:09:00.000Z"),
    runId: "run-thread-interaction",
    runAgentId: "agent-codex",
  }),
];

export const issueThreadInteractionEvents: IssueTimelineEvent[] = [
  {
    id: "event-thread-checkout",
    createdAt: new Date("2026-04-20T14:01:00.000Z"),
    actorType: "user",
    actorId: issueThreadInteractionFixtureMeta.currentUserId,
    statusChange: {
      from: "todo",
      to: "in_progress",
    },
  },
];

export const issueThreadInteractionLiveRuns: LiveRunForIssue[] = [
  {
    id: "run-thread-live",
    status: "running",
    invocationSource: "manual",
    triggerDetail: null,
    startedAt: "2026-04-20T14:26:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-20T14:26:00.000Z",
    agentId: "agent-codex",
    agentName: "CodexCoder",
    adapterType: "codex_local",
  },
];

export const issueThreadInteractionTranscriptsByRunId = new Map<
  string,
  readonly IssueChatTranscriptEntry[]
>([
  [
    "run-thread-live",
    [
      {
        kind: "assistant",
        ts: "2026-04-20T14:26:02.000Z",
        text: "Wiring the prototype interaction cards into the same issue feed that already renders comments and live runs.",
      },
      {
        kind: "thinking",
        ts: "2026-04-20T14:26:04.000Z",
        text: "Need to keep the payload shapes local to the UI layer so Phase 0 stays non-persistent.",
      },
    ],
  ],
]);

export const mixedIssueThreadInteractions = [
  acceptedSuggestedTasksInteraction,
  pendingRequestConfirmationInteraction,
  pendingAskUserQuestionsInteraction,
];
