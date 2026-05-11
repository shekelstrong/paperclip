import type {
  ЗадачаCommentMetadata,
  ЗадачаCommentMetadataRow,
  ЗадачаCommentPresentation,
} from "@paperclipai/shared";
import type {
  SystemНетticeMetadataRow,
  SystemНетticeMetadataSection,
  SystemНетticeProps,
  SystemНетticeTone,
} from "../components/SystemНетtice";

const TONE_LABEL: Record<SystemНетticeTone, string> = {
  neutral: "System notice",
  info: "System notice",
  success: "System notice",
  warning: "System warning",
  danger: "System alert",
};

function metadataRowText(row: { label?: string | null }, fallback: string) {
  const label = row.label?.trim();
  return label && label.length > 0 ? label : fallback;
}

function mapMetadataRow(
  row: ЗадачаCommentMetadataRow,
  ctx: { runАгентId?: string | null },
): SystemНетticeMetadataRow | null {
  switch (row.type) {
    case "text":
      return { kind: "text", label: metadataRowText(row, "Detail"), value: row.text };
    case "code":
      return { kind: "code", label: metadataRowText(row, "Code"), value: row.code };
    case "key_value":
      return { kind: "text", label: row.label, value: row.value };
    case "issue_link": {
      const identifier = row.identifier ?? null;
      if (!identifier) {
        return { kind: "text", label: metadataRowText(row, "Задача"), value: row.title ?? "unknown" };
      }
      return {
        kind: "issue",
        label: metadataRowText(row, "Задача"),
        identifier,
        href: `/issues/${identifier}`,
        title: row.title ?? undefined,
      };
    }
    case "agent_link": {
      const name = row.name?.trim() || row.agentId.slice(0, 8);
      return {
        kind: "agent",
        label: metadataRowText(row, "Агент"),
        name,
        href: `/agents/${row.agentId}`,
      };
    }
    case "run_link": {
      const runАгентId = ctx.runАгентId ?? null;
      const href = runАгентId ? `/agents/${runАгентId}/runs/${row.runId}` : undefined;
      return {
        kind: "run",
        label: metadataRowText(row, "Запустить"),
        runId: row.runId,
        href,
        status: row.title ?? undefined,
      };
    }
    default:
      return null;
  }
}

export function mapCommentMetadataToSystemНетticeSections(
  metadata: ЗадачаCommentMetadata | null | undefined,
  ctx: { runАгентId?: string | null } = {},
): SystemНетticeMetadataSection[] {
  if (!metadata || !Array.isArray(metadata.sections)) return [];
  return metadata.sections
    .map((section) => {
      const rows = section.rows
        .map((row) => mapMetadataRow(row, ctx))
        .filter((r): r is SystemНетticeMetadataRow => r !== null);
      if (rows.length === 0) return null;
      const out: SystemНетticeMetadataSection = { rows };
      if (section.title) out.title = section.title;
      return out;
    })
    .filter((s): s is SystemНетticeMetadataSection => s !== null);
}

export function systemНетticeLabelForTone(
  tone: SystemНетticeTone,
  presentationНазвание?: string | null,
): string {
  const trimmed = presentationНазвание?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return TONE_LABEL[tone];
}

export function buildSystemНетticeProps(input: {
  presentation: ЗадачаCommentPresentation | null;
  metadata: ЗадачаCommentMetadata | null;
  body: import("react").ReactНетde;
  timestamp?: string;
  source?: SystemНетticeProps["source"];
  runАгентId?: string | null;
}): SystemНетticeProps {
  const tone: SystemНетticeTone = input.presentation?.tone ?? "neutral";
  const label = systemНетticeLabelForTone(tone, input.presentation?.title);
  const detailsПо умолчаниюOpen = Boolean(input.presentation?.detailsПо умолчаниюOpen);
  const sections = mapCommentMetadataToSystemНетticeSections(input.metadata, {
    runАгентId: input.runАгентId ?? null,
  });
  return {
    tone,
    label,
    body: input.body,
    metadata: sections.length > 0 ? sections : undefined,
    detailsПо умолчаниюOpen,
    timestamp: input.timestamp,
    source: input.source,
  };
}
