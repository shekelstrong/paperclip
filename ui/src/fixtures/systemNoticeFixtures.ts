import type {
  SystemNoticeMetadataSection,
  SystemNoticeProps,
} from "../components/SystemNotice";

export type SystemNoticeFixture = {
  id: string;
  caption: string;
} & SystemNoticeProps;

const HANDOFF_METADATA: SystemNoticeMetadataSection[] = [
  {
    title: "Владелец восстановления",
    rows: [
      {
        kind: "issue",
        label: "Задача восстановления",
        identifier: "PAP-3440",
        href: "/PAP/issues/PAP-3440",
        title: "Успешный запуск — отсутствует решение",
      },
      {
        kind: "agent",
        label: "Owner",
        name: "CTO",
        href: "/PAP/agents/cto",
      },
      {
        kind: "text",
        label: "Suggested action",
        value: "Переназначить на агента восстановления и выбрать распоряжение.",
      },
    ],
  },
  {
    title: "Доказательства запуска",
    rows: [
      {
        kind: "run",
        label: "Исходный запуск",
        runId: "9cdba892-c7ca-4d93-8604-4843873b127c",
        href: "/PAP/agents/codexcoder/runs/9cdba892-c7ca-4d93-8604-4843873b127c",
        status: "succeeded",
      },
      {
        kind: "run",
        label: "Восстановительный запуск",
        runId: "61fdb79b-8012-4676-ac71-2971830e126a",
        href: "/PAP/agents/codexcoder/runs/61fdb79b-8012-4676-ac71-2971830e126a",
        status: "failed",
      },
      {
        kind: "text",
        label: "Normalized cause",
        value: "Запуск завершён без выдачи распоряжения для задачи в работе.",
      },
    ],
  },
];

const REQUIRED_METADATA: SystemNoticeMetadataSection[] = [
  {
    title: "Required action",
    rows: [
      {
        kind: "issue",
        label: "Исходная задача",
        identifier: "PAP-3440",
        href: "/PAP/issues/PAP-3440",
        title: "Успешный запуск — отсутствует решение",
      },
      {
        kind: "agent",
        label: "Assignee",
        name: "CodexCoder",
        href: "/PAP/agents/codexcoder",
      },
      {
        kind: "text",
        label: "Следующий шаг",
        value: "Выберите done, blocked или in_review и укажите однострочное обоснование.",
      },
    ],
  },
  {
    title: "Контекст запуска",
    rows: [
      {
        kind: "run",
        label: "Успешный запуск",
        runId: "9cdba892-c7ca-4d93-8604-4843873b127c",
        href: "/PAP/agents/codexcoder/runs/9cdba892-c7ca-4d93-8604-4843873b127c",
        status: "succeeded",
      },
      {
        kind: "code",
        label: "Статус до",
        value: "in_progress",
      },
    ],
  },
];

const NEUTRAL_METADATA: SystemNoticeMetadataSection[] = [
  {
    rows: [
      {
        kind: "agent",
        label: "Переназначено",
        name: "ClaudeFixer",
        href: "/PAP/agents/claudefixer",
      },
      {
        kind: "agent",
        label: "From",
        name: "CodexCoder",
        href: "/PAP/agents/codexcoder",
      },
      {
        kind: "text",
        label: "Reason",
        value: "Manual reassignment requested by Board.",
      },
    ],
  },
];

export const systemNoticeFixtures: readonly SystemNoticeFixture[] = [
  {
    id: "warning-collapsed",
    caption: "Warning · collapsed (default)",
    tone: "warning",
    label: "Системное предупреждение",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:32:00.000Z",
    body: "Paperclip нужно решение, прежде чем задача продолжится.",
    metadata: REQUIRED_METADATA,
    detailsDefaultOpen: false,
  },
  {
    id: "warning-expanded",
    caption: "Warning · expanded",
    tone: "warning",
    label: "Системное предупреждение",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:32:00.000Z",
    body: "Paperclip нужно решение, прежде чем задача продолжится.",
    metadata: REQUIRED_METADATA,
    detailsDefaultOpen: true,
  },
  {
    id: "danger-collapsed",
    caption: "Danger · collapsed (default)",
    tone: "danger",
    label: "Системное оповещение",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:48:00.000Z",
    body: "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.",
    metadata: HANDOFF_METADATA,
    detailsDefaultOpen: false,
  },
  {
    id: "danger-expanded",
    caption: "Danger · expanded",
    tone: "danger",
    label: "Системное оповещение",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:48:00.000Z",
    body: "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.",
    metadata: HANDOFF_METADATA,
    detailsDefaultOpen: true,
  },
  {
    id: "neutral-collapsed",
    caption: "Neutral · collapsed (default)",
    tone: "neutral",
    label: "Системное уведомление",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T15:10:00.000Z",
    body: "Переназначено на ClaudeFixer.",
    metadata: NEUTRAL_METADATA,
    detailsDefaultOpen: false,
  },
  {
    id: "neutral-expanded",
    caption: "Neutral · expanded",
    tone: "neutral",
    label: "Системное уведомление",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T15:10:00.000Z",
    body: "Переназначено на ClaudeFixer.",
    metadata: NEUTRAL_METADATA,
    detailsDefaultOpen: true,
  },
  {
    id: "warning-no-details",
    caption: "Warning · no metadata (Details affordance hidden)",
    tone: "warning",
    label: "Системное предупреждение",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T17:02:00.000Z",
    body: "Этот запуск приостановлен в ожидании утверждения доской.",
  },
];
