import type {
  SystemНетticeMetadataSection,
  SystemНетticeProps,
} from "../components/SystemНетtice";

export type SystemНетticeFixture = {
  id: string;
  caption: string;
} & SystemНетticeProps;

const HANDOFF_METADATA: SystemНетticeMetadataSection[] = [
  {
    title: "Recovery owner",
    rows: [
      {
        kind: "issue",
        label: "Recovery issue",
        identifier: "PAP-3440",
        href: "/PAP/issues/PAP-3440",
        title: "Успешноful run handoff missing disposition",
      },
      {
        kind: "agent",
        label: "Владелец",
        name: "CTO",
        href: "/PAP/agents/cto",
      },
      {
        kind: "text",
        label: "Suggested action",
        value: "Reassign to a recovery agent and pick a disposition.",
      },
    ],
  },
  {
    title: "Запустить evidence",
    rows: [
      {
        kind: "run",
        label: "Source run",
        runId: "9cdba892-c7ca-4d93-8604-4843873b127c",
        href: "/PAP/agents/codexcoder/runs/9cdba892-c7ca-4d93-8604-4843873b127c",
        status: "succeeded",
      },
      {
        kind: "run",
        label: "Recovery run",
        runId: "61fdb79b-8012-4676-ac71-2971830e126a",
        href: "/PAP/agents/codexcoder/runs/61fdb79b-8012-4676-ac71-2971830e126a",
        status: "failed",
      },
      {
        kind: "text",
        label: "Нетrmalized cause",
        value: "Запустить completed without issuing a disposition for an in_progress task.",
      },
    ],
  },
];

const REQUIRED_METADATA: SystemНетticeMetadataSection[] = [
  {
    title: "Обязательно action",
    rows: [
      {
        kind: "issue",
        label: "Source issue",
        identifier: "PAP-3440",
        href: "/PAP/issues/PAP-3440",
        title: "Успешноful run handoff missing disposition",
      },
      {
        kind: "agent",
        label: "Исполнитель",
        name: "CodexCoder",
        href: "/PAP/agents/codexcoder",
      },
      {
        kind: "text",
        label: "Далее step",
        value: "Pick done, blocked, or in_review and post a one-line rationale.",
      },
    ],
  },
  {
    title: "Запустить context",
    rows: [
      {
        kind: "run",
        label: "Успешноful run",
        runId: "9cdba892-c7ca-4d93-8604-4843873b127c",
        href: "/PAP/agents/codexcoder/runs/9cdba892-c7ca-4d93-8604-4843873b127c",
        status: "succeeded",
      },
      {
        kind: "code",
        label: "Статус before",
        value: "in_progress",
      },
    ],
  },
];

const NEUTRAL_METADATA: SystemНетticeMetadataSection[] = [
  {
    rows: [
      {
        kind: "agent",
        label: "Reassigned to",
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
        value: "Manual reassignment requested by Совет.",
      },
    ],
  },
];

export const systemНетticeFixtures: readonly SystemНетticeFixture[] = [
  {
    id: "warning-collapsed",
    caption: "Предупреждение · collapsed (default)",
    tone: "warning",
    label: "System warning",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:32:00.000Z",
    body: "Paperclip needs a disposition before this issue can continue.",
    metadata: REQUIRED_METADATA,
    detailsПо умолчаниюOpen: false,
  },
  {
    id: "warning-expanded",
    caption: "Предупреждение · expanded",
    tone: "warning",
    label: "System warning",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:32:00.000Z",
    body: "Paperclip needs a disposition before this issue can continue.",
    metadata: REQUIRED_METADATA,
    detailsПо умолчаниюOpen: true,
  },
  {
    id: "danger-collapsed",
    caption: "Danger · collapsed (default)",
    tone: "danger",
    label: "System alert",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:48:00.000Z",
    body: "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.",
    metadata: HANDOFF_METADATA,
    detailsПо умолчаниюOpen: false,
  },
  {
    id: "danger-expanded",
    caption: "Danger · expanded",
    tone: "danger",
    label: "System alert",
    source: { label: "Paperclip", href: "/PAP/agents" },
    timestamp: "2026-05-04T16:48:00.000Z",
    body: "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.",
    metadata: HANDOFF_METADATA,
    detailsПо умолчаниюOpen: true,
  },
  {
    id: "neutral-collapsed",
    caption: "Neutral · collapsed (default)",
    tone: "neutral",
    label: "System notice",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T15:10:00.000Z",
    body: "Reassigned to ClaudeFixer.",
    metadata: NEUTRAL_METADATA,
    detailsПо умолчаниюOpen: false,
  },
  {
    id: "neutral-expanded",
    caption: "Neutral · expanded",
    tone: "neutral",
    label: "System notice",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T15:10:00.000Z",
    body: "Reassigned to ClaudeFixer.",
    metadata: NEUTRAL_METADATA,
    detailsПо умолчаниюOpen: true,
  },
  {
    id: "warning-no-details",
    caption: "Предупреждение · no metadata (Детали affordance hidden)",
    tone: "warning",
    label: "System warning",
    source: { label: "Paperclip" },
    timestamp: "2026-05-04T17:02:00.000Z",
    body: "This run paused while waiting on board approval.",
  },
];
