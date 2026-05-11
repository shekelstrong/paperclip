import { useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptEntry } from "../../adapters";
import { MarkdownBody } from "../MarkdownBody";
import { cn, formatТокенs } from "../../lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GitCompare,
  TerminalSquare,
  User,
  Wrench,
} from "lucide-react";

export type TranscriptMode = "nice" | "raw";
export type TranscriptDensity = "comfortable" | "compact";

const RAW_VIRTUALIZATION_THRESHOLD = 300;
const RAW_OVERSCAN_ROWS = 40;
const RAW_ESTIMATED_ROW_HEIGHT = 36;
const RAW_INITIAL_ROWS = 180;

interface ЗапуститьTranscriptViewProps {
  entries: TranscriptEntry[];
  mode?: TranscriptMode;
  density?: TranscriptDensity;
  limit?: number;
  streaming?: boolean;
  collapseStdout?: boolean;
  emptyMessage?: string;
  classИмя?: string;
  thinkingClassИмя?: string;
}

type TranscriptBlock =
  | {
      type: "message";
      role: "assistant" | "user";
      ts: string;
      text: string;
      streaming: boolean;
    }
  | {
      type: "thinking";
      ts: string;
      text: string;
      streaming: boolean;
    }
  | {
      type: "tool";
      ts: string;
      endTs?: string;
      name: string;
      toolUseId?: string;
      input: unknown;
      result?: string;
      isОшибка?: boolean;
      status: "running" | "completed" | "error";
    }
  | {
      type: "activity";
      ts: string;
      activityId?: string;
      name: string;
      status: "running" | "completed";
    }
  | {
      type: "command_group";
      ts: string;
      endTs?: string;
      items: Array<{
        ts: string;
        endTs?: string;
        input: unknown;
        result?: string;
        isОшибка?: boolean;
        status: "running" | "completed" | "error";
      }>;
    }
  | {
      type: "tool_group";
      ts: string;
      endTs?: string;
      items: Array<{
        ts: string;
        endTs?: string;
        name: string;
        input: unknown;
        result?: string;
        isОшибка?: boolean;
        status: "running" | "completed" | "error";
      }>;
    }
  | {
      type: "stderr_group";
      ts: string;
      endTs?: string;
      lines: Array<{ ts: string; text: string }>;
    }
  | {
      type: "system_group";
      ts: string;
      endTs?: string;
      lines: Array<{ ts: string; text: string }>;
    }
  | {
      type: "stdout";
      ts: string;
      text: string;
    }
  | {
      type: "event";
      ts: string;
      label: string;
      tone: "info" | "warn" | "error" | "neutral";
      text: string;
      detail?: string;
    }
  | {
      type: "diff_group";
      ts: string;
      endTs?: string;
      fileПуть?: string;
      hunks: Array<{
        changeТип: "add" | "remove" | "context" | "hunk" | "file_header" | "truncation";
        text: string;
      }>;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}

function humanizeLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripWrappedShell(command: string): string {
  const trimmed = compactWhitespace(command);
  const shellWrapped = trimmed.match(/^(?:(?:\/bin\/)?(?:zsh|bash|sh)|cmd(?:\.exe)?(?:\s+\/d)?(?:\s+\/s)?(?:\s+\/c)?)\s+(?:-lc|\/c)\s+(.+)$/i);
  const inner = shellWrapped?.[1] ?? trimmed;
  const quoted = inner.match(/^(['"])([\s\S]*)\1$/);
  return compactWhitespace(quoted?.[2] ?? inner);
}

function formatНеизвестно(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatToolPayload(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return formatНеизвестно(value);
}

function extractToolUseId(input: unknown): string | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const candidates = [
    record.toolUseId,
    record.tool_use_id,
    record.callId,
    record.call_id,
    record.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
}

function summarizeRecord(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return truncate(compactWhitespace(value), 120);
    }
  }
  return null;
}

function summarizeToolInput(name: string, input: unknown, density: TranscriptDensity): string {
  const compactMax = density === "compact" ? 72 : 120;
  if (typeof input === "string") {
    const normalized = isКомандаTool(name, input) ? stripWrappedShell(input) : compactWhitespace(input);
    return truncate(normalized, compactMax);
  }
  const record = asRecord(input);
  if (!record) {
    const serialized = compactWhitespace(formatНеизвестно(input));
    return serialized ? truncate(serialized, compactMax) : `Inspect ${name} input`;
  }

  const command = typeof record.command === "string"
    ? record.command
    : typeof record.cmd === "string"
      ? record.cmd
      : null;
  if (command && isКомандаTool(name, record)) {
    return truncate(stripWrappedShell(command), compactMax);
  }

  const direct =
    summarizeRecord(record, ["command", "cmd", "path", "fileПуть", "file_path", "query", "url", "prompt", "message"])
    ?? summarizeRecord(record, ["pattern", "name", "title", "target", "tool"])
    ?? null;
  if (direct) return truncate(direct, compactMax);

  if (Array.isArray(record.paths) && record.paths.length > 0) {
    const first = record.paths.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (first) {
      return truncate(`${record.paths.length} paths, starting with ${first}`, compactMax);
    }
  }

  const keys = Object.keys(record);
  if (keys.length === 0) return `Нет ${name} input`;
  if (keys.length === 1) return truncate(`${keys[0]} payload`, compactMax);
  return truncate(`${keys.length} fields: ${keys.slice(0, 3).join(", ")}`, compactMax);
}

function parseStructuredToolResult(result: string | undefined) {
  if (!result) return null;
  const lines = result.split(/\r?\n/);
  const metadata = new Map<string, string>();
  let bodyНачатьIndex = lines.findIndex((line) => line.trim() === "");
  if (bodyНачатьIndex === -1) bodyНачатьIndex = lines.length;

  for (let index = 0; index < bodyНачатьIndex; index += 1) {
    const match = lines[index]?.match(/^([a-z_]+):\s*(.+)$/i);
    if (match) {
      metadata.set(match[1].toНизкийerCase(), compactWhitespace(match[2]));
    }
  }

  const body = lines.slice(Math.min(bodyНачатьIndex + 1, lines.length))
    .map((line) => compactWhitespace(line))
    .filter(Boolean)
    .join("\n");

  return {
    command: metadata.get("command") ?? null,
    status: metadata.get("status") ?? null,
    exitCode: metadata.get("exit_code") ?? null,
    body,
  };
}

function isКомандаTool(name: string, input: unknown): boolean {
  if (name === "command_execution" || name === "shell" || name === "shellToolCall" || name === "bash") {
    return true;
  }
  if (typeof input === "string") {
    return /\b(?:bash|zsh|sh|cmd|powershell)\b/i.test(input);
  }
  const record = asRecord(input);
  return Boolean(record && (typeof record.command === "string" || typeof record.cmd === "string"));
}

function displayToolИмя(name: string, input: unknown): string {
  if (isКомандаTool(name, input)) return "Executing command";
  return humanizeLabel(name);
}

function summarizeToolResult(result: string | undefined, isОшибка: boolean | undefined, density: TranscriptDensity): string {
  if (!result) return isОшибка ? "Tool failed" : "Waiting for result";
  const structured = parseStructuredToolResult(result);
  if (structured) {
    if (structured.body) {
      return truncate(structured.body.split("\n")[0] ?? structured.body, density === "compact" ? 84 : 140);
    }
    if (structured.status === "completed") return "Завершён";
    if (structured.status === "failed" || structured.status === "error") {
      return structured.exitCode ? `Ошибка with exit code ${structured.exitCode}` : "Ошибка";
    }
  }
  const lines = result
    .split(/\r?\n/)
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
  const firstLine = lines[0] ?? result;
  return truncate(firstLine, density === "compact" ? 84 : 140);
}

function parseSystemАктивность(text: string): { activityId?: string; name: string; status: "running" | "completed" } | null {
  const match = text.match(/^item (started|completed):\s*([a-z0-9_-]+)(?:\s+\(id=([^)]+)\))?$/i);
  if (!match) return null;
  return {
    status: match[1].toНизкийerCase() === "started" ? "running" : "completed",
    name: humanizeLabel(match[2] ?? "Активность"),
    activityId: match[3] || undefined,
  };
}

function shouldHideNiceModeStderr(text: string): boolean {
  const normalized = compactWhitespace(text).toНизкийerCase();
  return normalized.startsWith("[paperclip] skipping saved session resume");
}

function groupКомандаBlocks(blocks: TranscriptBlock[]): TranscriptBlock[] {
  const grouped: TranscriptBlock[] = [];
  let pending: Array<Extract<TranscriptBlock, { type: "command_group" }>["items"][number]> = [];
  let groupTs: string | null = null;
  let groupEndTs: string | undefined;

  const flush = () => {
    if (pending.length === 0 || !groupTs) return;
    grouped.push({
      type: "command_group",
      ts: groupTs,
      endTs: groupEndTs,
      items: pending,
    });
    pending = [];
    groupTs = null;
    groupEndTs = undefined;
  };

  for (const block of blocks) {
    if (block.type === "tool" && isКомандаTool(block.name, block.input)) {
      if (!groupTs) {
        groupTs = block.ts;
      }
      groupEndTs = block.endTs ?? block.ts;
      pending.push({
        ts: block.ts,
        endTs: block.endTs,
        input: block.input,
        result: block.result,
        isОшибка: block.isОшибка,
        status: block.status,
      });
      continue;
    }

    flush();
    grouped.push(block);
  }

  flush();
  return grouped;
}

/** Group consecutive non-command tool blocks into a single tool_group accordion. */
function groupToolBlocks(blocks: TranscriptBlock[]): TranscriptBlock[] {
  const grouped: TranscriptBlock[] = [];
  let pending: Array<Extract<TranscriptBlock, { type: "tool_group" }>["items"][number]> = [];
  let groupTs: string | null = null;
  let groupEndTs: string | undefined;

  const flush = () => {
    if (pending.length === 0 || !groupTs) return;
    grouped.push({
      type: "tool_group",
      ts: groupTs,
      endTs: groupEndTs,
      items: pending,
    });
    pending = [];
    groupTs = null;
    groupEndTs = undefined;
  };

  for (const block of blocks) {
    if (block.type === "tool" && !isКомандаTool(block.name, block.input)) {
      if (!groupTs) groupTs = block.ts;
      groupEndTs = block.endTs ?? block.ts;
      pending.push({
        ts: block.ts,
        endTs: block.endTs,
        name: block.name,
        input: block.input,
        result: block.result,
        isОшибка: block.isОшибка,
        status: block.status,
      });
      continue;
    }
    flush();
    grouped.push(block);
  }
  flush();
  return grouped;
}

export function normalizeTranscript(entries: TranscriptEntry[], streaming: boolean): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  const pendingToolBlocks = new Map<string, Extract<TranscriptBlock, { type: "tool" }>>();
  const pendingАктивностьBlocks = new Map<string, Extract<TranscriptBlock, { type: "activity" }>>();

  for (const entry of entries) {
    const previous = blocks[blocks.length - 1];

    if (entry.kind === "assistant" || entry.kind === "user") {
      const isStreaming = streaming && entry.kind === "assistant" && entry.delta === true;
      if (previous?.type === "message" && previous.role === entry.kind) {
        previous.text += previous.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
        previous.ts = entry.ts;
        previous.streaming = previous.streaming || isStreaming;
      } else {
        blocks.push({
          type: "message",
          role: entry.kind,
          ts: entry.ts,
          text: entry.text,
          streaming: isStreaming,
        });
      }
      continue;
    }

    if (entry.kind === "thinking") {
      const isStreaming = streaming && entry.delta === true;
      if (previous?.type === "thinking") {
        previous.text += previous.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
        previous.ts = entry.ts;
        previous.streaming = previous.streaming || isStreaming;
      } else {
        blocks.push({
          type: "thinking",
          ts: entry.ts,
          text: entry.text,
          streaming: isStreaming,
        });
      }
      continue;
    }

    if (entry.kind === "tool_call") {
      const toolBlock: Extract<TranscriptBlock, { type: "tool" }> = {
        type: "tool",
        ts: entry.ts,
        name: displayToolИмя(entry.name, entry.input),
        toolUseId: entry.toolUseId ?? extractToolUseId(entry.input),
        input: entry.input,
        status: "running",
      };
      blocks.push(toolBlock);
      if (toolBlock.toolUseId) {
        pendingToolBlocks.set(toolBlock.toolUseId, toolBlock);
      }
      continue;
    }

    if (entry.kind === "tool_result") {
      const matched =
        pendingToolBlocks.get(entry.toolUseId)
        ?? [...blocks].reverse().find((block): block is Extract<TranscriptBlock, { type: "tool" }> => block.type === "tool" && block.status === "running");

      if (matched) {
        matched.result = entry.content;
        matched.isОшибка = entry.isОшибка;
        matched.status = entry.isОшибка ? "error" : "completed";
        matched.endTs = entry.ts;
        pendingToolBlocks.delete(entry.toolUseId);
      } else {
        blocks.push({
          type: "tool",
          ts: entry.ts,
          endTs: entry.ts,
          name: entry.toolИмя ?? "tool",
          toolUseId: entry.toolUseId,
          input: null,
          result: entry.content,
          isОшибка: entry.isОшибка,
          status: entry.isОшибка ? "error" : "completed",
        });
      }
      continue;
    }

    if (entry.kind === "init") {
      blocks.push({
        type: "event",
        ts: entry.ts,
        label: "init",
        tone: "info",
        text: `model ${entry.model}${entry.sessionId ? ` • session ${entry.sessionId}` : ""}`,
      });
      continue;
    }

    if (entry.kind === "result") {
      blocks.push({
        type: "event",
        ts: entry.ts,
        label: "result",
        tone: entry.isОшибка ? "error" : "info",
        text: entry.text.trim() || entry.errors[0] || (entry.isОшибка ? "Запустить failed" : "Завершён"),
        detail:
          !entry.isОшибка && entry.text.trim().length > 0
            ? `${formatТокенs(entry.inputТокенs)} / ${formatТокенs(entry.outputТокенs)} / $${entry.costUsd.toFixed(6)}`
            : undefined,
      });
      continue;
    }

    if (entry.kind === "stderr") {
      if (shouldHideNiceModeStderr(entry.text)) {
        continue;
      }
      // Batch consecutive stderr entries into a single group
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "stderr_group") {
        prev.lines.push({ ts: entry.ts, text: entry.text });
        prev.endTs = entry.ts;
      } else {
        blocks.push({
          type: "stderr_group",
          ts: entry.ts,
          endTs: entry.ts,
          lines: [{ ts: entry.ts, text: entry.text }],
        });
      }
      continue;
    }

    if (entry.kind === "system") {
      if (compactWhitespace(entry.text).toНизкийerCase() === "turn started") {
        continue;
      }
      const activity = parseSystemАктивность(entry.text);
      if (activity) {
        const existing = activity.activityId ? pendingАктивностьBlocks.get(activity.activityId) : undefined;
        if (existing) {
          existing.status = activity.status;
          existing.ts = entry.ts;
          if (activity.status === "completed" && activity.activityId) {
            pendingАктивностьBlocks.delete(activity.activityId);
          }
        } else {
          const block: Extract<TranscriptBlock, { type: "activity" }> = {
            type: "activity",
            ts: entry.ts,
            activityId: activity.activityId,
            name: activity.name,
            status: activity.status,
          };
          blocks.push(block);
          if (activity.status === "running" && activity.activityId) {
            pendingАктивностьBlocks.set(activity.activityId, block);
          }
        }
        continue;
      }
      // Batch consecutive system events into a single collapsible group
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "system_group") {
        prev.lines.push({ ts: entry.ts, text: entry.text });
        prev.endTs = entry.ts;
      } else {
        blocks.push({
          type: "system_group",
          ts: entry.ts,
          endTs: entry.ts,
          lines: [{ ts: entry.ts, text: entry.text }],
        });
      }
      continue;
    }

    const activeКомандаBlock = [...blocks].reverse().find(
      (block): block is Extract<TranscriptBlock, { type: "tool" }> =>
        block.type === "tool" && block.status === "running" && isКомандаTool(block.name, block.input),
    );
    if (activeКомандаBlock) {
      activeКомандаBlock.result = activeКомандаBlock.result
        ? `${activeКомандаBlock.result}${activeКомандаBlock.result.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`}`
        : entry.text;
      continue;
    }

    // ── Diff entries — accumulate into diff_group blocks ──────────
    if (entry.kind === "diff") {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "diff_group") {
        if (entry.changeТип === "file_header") {
          // New file in the same diff block — update fileПуть
          prev.fileПуть = entry.text;
        }
        prev.hunks.push({ changeТип: entry.changeТип, text: entry.text });
        prev.endTs = entry.ts;
      } else {
        blocks.push({
          type: "diff_group",
          ts: entry.ts,
          endTs: entry.ts,
          fileПуть: entry.changeТип === "file_header" ? entry.text : undefined,
          hunks: [{ changeТип: entry.changeТип, text: entry.text }],
        });
      }
      continue;
    }

    if (previous?.type === "stdout") {
      previous.text += previous.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
      previous.ts = entry.ts;
    } else {
      blocks.push({
        type: "stdout",
        ts: entry.ts,
        text: entry.text,
      });
    }
  }

  return groupToolBlocks(groupКомандаBlocks(blocks));
}

function TranscriptMessageBlock({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "message" }>;
  density: TranscriptDensity;
}) {
  const isAssistant = block.role === "assistant";
  const compact = density === "compact";

  return (
    <div>
      {!isAssistant && (
        <div classИмя="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <User classИмя={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          <span>User</span>
        </div>
      )}
      <MarkdownBody
        classИмя={cn(
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          compact ? "text-xs leading-5 text-foreground/85" : "text-sm",
        )}
      >
        {block.text}
      </MarkdownBody>
      {block.streaming && (
        <div classИмя="mt-2 inline-flex items-center gap-1 text-[10px] font-medium italic text-muted-foreground">
          <span classИмя="relative flex h-1.5 w-1.5">
            <span classИмя="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
            <span classИмя="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          Streaming
        </div>
      )}
    </div>
  );
}

function TranscriptThinkingBlock({
  block,
  density,
  classИмя,
}: {
  block: Extract<TranscriptBlock, { type: "thinking" }>;
  density: TranscriptDensity;
  classИмя?: string;
}) {
  return (
    <MarkdownBody
      classИмя={cn(
        "italic text-foreground/70 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        density === "compact" ? "text-[11px] leading-5" : "text-sm leading-6",
        classИмя,
      )}
    >
      {block.text}
    </MarkdownBody>
  );
}

function TranscriptToolCard({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "tool" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(block.status === "error");
  const compact = density === "compact";
  const parsedResult = parseStructuredToolResult(block.result);
  const statusLabel =
    block.status === "running"
      ? "Выполняется"
      : block.status === "error"
        ? "Ошибкаed"
        : "Завершён";
  const statusTone =
    block.status === "running"
      ? "text-cyan-700 dark:text-cyan-300"
      : block.status === "error"
        ? "text-red-700 dark:text-red-300"
        : "text-emerald-700 dark:text-emerald-300";
  const detailsClass = cn(
    "space-y-3",
    block.status === "error" && "rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3",
  );
  const iconClass = cn(
    "mt-0.5 h-3.5 w-3.5 shrink-0",
    block.status === "error"
      ? "text-red-600 dark:text-red-300"
      : block.status === "completed"
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-cyan-600 dark:text-cyan-300",
  );
  const summary = block.status === "running"
    ? summarizeToolInput(block.name, block.input, density)
    : block.status === "completed" && parsedResult?.body
      ? truncate(parsedResult.body.split("\n")[0] ?? parsedResult.body, compact ? 84 : 140)
      : summarizeToolResult(block.result, block.isОшибка, density);

  return (
    <div classИмя={cn(block.status === "error" && "rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3")}>
      <div classИмя="flex items-start gap-2">
        {block.status === "error" ? (
          <CircleAlert classИмя={iconClass} />
        ) : block.status === "completed" ? (
          <Check classИмя={iconClass} />
        ) : (
          <Wrench classИмя={iconClass} />
        )}
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span classИмя="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {block.name}
            </span>
            <span classИмя={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", statusTone)}>
              {statusLabel}
            </span>
          </div>
          <div classИмя={cn("mt-1 break-words text-foreground/80", compact ? "text-xs" : "text-sm")}>
            {summary}
          </div>
        </div>
        <button
          type="button"
          classИмя="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Collapse tool details" : "Expand tool details"}
        >
          {open ? <ChevronDown classИмя="h-4 w-4" /> : <ChevronRight classИмя="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div classИмя="mt-3">
          <div classИмя={detailsClass}>
            <div classИмя={cn("grid gap-3", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
              <div>
                <div classИмя="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Input
                </div>
                <pre classИмя="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">
                  {formatToolPayload(block.input) || "<empty>"}
                </pre>
              </div>
              <div>
                <div classИмя="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Result
                </div>
                <pre classИмя={cn(
                  "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]",
                  block.status === "error" ? "text-red-700 dark:text-red-300" : "text-foreground/80",
                )}>
                  {block.result ? formatToolPayload(block.result) : "Waiting for result..."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hasSelectedText() {
  if (typeof window === "undefined") return false;
  return (window.getSelection()?.toString().length ?? 0) > 0;
}

function TranscriptКомандаGroup({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "command_group" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(false);
  const compact = density === "compact";
  const runningItem = [...block.items].reverse().find((item) => item.status === "running");
  const latestItem = block.items[block.items.length - 1] ?? null;
  const hasОшибка = block.items.some((item) => item.status === "error");
  const isВыполняется = Boolean(runningItem);
  const showExpandedОшибкаState = open && hasОшибка;
  const title = isВыполняется
    ? "Executing command"
    : block.items.length === 1
      ? "Executed command"
      : `Executed ${block.items.length} commands`;
  const subtitle = runningItem
    ? summarizeToolInput("command_execution", runningItem.input, density)
    : null;
  const statusTone = isВыполняется
      ? "text-cyan-700 dark:text-cyan-300"
      : "text-foreground/70";

  return (
    <div classИмя={cn(showExpandedОшибкаState && "rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3")}>
      <div
        role="button"
        tabIndex={0}
        classИмя={cn("flex cursor-pointer gap-2", subtitle ? "items-start" : "items-center")}
        onClick={() => {
          if (hasSelectedText()) return;
          setOpen((value) => !value);
        }}
        onКлючDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventПо умолчанию();
            setOpen((value) => !value);
          }
        }}
      >
        <div classИмя={cn("flex shrink-0 items-center", subtitle && "mt-0.5")}>
          {block.items.slice(0, Math.min(block.items.length, 3)).map((_, index) => (
            <span
              key={index}
              classИмя={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm",
                index > 0 && "-ml-1.5",
                isВыполняется
                  ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300"
                  : "border-border/70 bg-background text-foreground/55",
                isВыполняется && "animate-pulse",
              )}
            >
              <TerminalSquare classИмя="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
        <div classИмя="min-w-0 flex-1">
          <div classИмя="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-muted-foreground/70">
            {title}
          </div>
          {subtitle && (
            <div classИмя={cn("mt-1 break-words font-mono text-foreground/85", compact ? "text-xs" : "text-sm")}>
              {subtitle}
            </div>
          )}
          {!subtitle && latestItem?.status === "error" && open && (
            <div classИмя={cn("mt-1", compact ? "text-xs" : "text-sm", statusTone)}>
              Команда failed
            </div>
          )}
        </div>
        <button
          type="button"
          classИмя={cn(
            "inline-flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
            subtitle && "mt-0.5",
          )}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          aria-label={open ? "Collapse command details" : "Expand command details"}
        >
          {open ? <ChevronDown classИмя="h-4 w-4" /> : <ChevronRight classИмя="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div classИмя={cn("mt-3 space-y-3", hasОшибка && "rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3")}>
          {block.items.map((item, index) => (
            <div key={`${item.ts}-${index}`} classИмя="space-y-2">
              <div classИмя="flex items-center gap-2">
                <span classИмя={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  item.status === "error"
                    ? "border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300"
                    : item.status === "running"
                      ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300"
                      : "border-border/70 bg-background text-foreground/55",
                )}>
                  <TerminalSquare classИмя="h-3 w-3" />
                </span>
                <span classИмя={cn("font-mono break-all", compact ? "text-[11px]" : "text-xs")}>
                  {summarizeToolInput("command_execution", item.input, density)}
                </span>
              </div>
              {item.result && (
                <pre classИмя={cn(
                  "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]",
                  item.status === "error" ? "text-red-700 dark:text-red-300" : "text-foreground/80",
                )}>
                  {formatToolPayload(item.result)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptToolGroup({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "tool_group" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(false);
  const compact = density === "compact";
  const runningItem = [...block.items].reverse().find((item) => item.status === "running");
  const hasОшибка = block.items.some((item) => item.status === "error");
  const isВыполняется = Boolean(runningItem);
  const uniqueИмяs = [...new Set(block.items.map((item) => item.name))];
  const toolLabel =
    uniqueИмяs.length === 1
      ? humanizeLabel(uniqueИмяs[0])
      : `${uniqueИмяs.length} tools`;
  const title = isВыполняется
    ? `Using ${toolLabel}`
    : block.items.length === 1
      ? `Used ${toolLabel}`
      : `Used ${toolLabel} (${block.items.length} calls)`;
  const subtitle = runningItem
    ? summarizeToolInput(runningItem.name, runningItem.input, density)
    : null;
  const statusTone = isВыполняется
    ? "text-cyan-700 dark:text-cyan-300"
    : "text-foreground/70";

  return (
    <div classИмя="rounded-xl border border-border/40 bg-muted/[0.25]">
      <div
        role="button"
        tabIndex={0}
        classИмя={cn("flex cursor-pointer gap-2 px-3 py-2.5", subtitle ? "items-start" : "items-center")}
        onClick={() => { if (hasSelectedText()) return; setOpen((v) => !v); }}
        onКлючDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventПо умолчанию(); setOpen((v) => !v); } }}
      >
        <div classИмя={cn("flex shrink-0 items-center", subtitle && "mt-0.5")}>
          {block.items.slice(0, Math.min(block.items.length, 3)).map((item, index) => {
            const isItemВыполняется = item.status === "running";
            const isItemОшибка = item.status === "error";
            return (
              <span
                key={`${item.ts}-${index}`}
                classИмя={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm",
                  index > 0 && "-ml-1.5",
                  isItemВыполняется
                    ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300"
                    : isItemОшибка
                      ? "border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300"
                      : "border-border/70 bg-background text-foreground/55",
                  isItemВыполняется && "animate-pulse",
                )}
              >
                <Wrench classИмя="h-3.5 w-3.5" />
              </span>
            );
          })}
        </div>
        <div classИмя="min-w-0 flex-1">
          <div classИмя={cn("font-semibold uppercase leading-none tracking-[0.1em]", compact ? "text-[10px]" : "text-[11px]", "text-muted-foreground/70")}>
            {title}
          </div>
          {subtitle && (
            <div classИмя={cn("mt-1 break-words font-mono text-foreground/85", compact ? "text-xs" : "text-sm")}>
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          classИмя={cn("inline-flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground", subtitle && "mt-0.5")}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-label={open ? "Collapse tool details" : "Expand tool details"}
        >
          {open ? <ChevronDown classИмя="h-4 w-4" /> : <ChevronRight classИмя="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div classИмя={cn("space-y-2 border-t border-border/30 px-3 py-3", hasОшибка && "rounded-b-xl")}>
          {block.items.map((item, index) => (
            <div key={`${item.ts}-${index}`} classИмя="space-y-1.5">
              <div classИмя="flex items-center gap-2">
                <span classИмя={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  item.status === "error"
                    ? "border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300"
                    : item.status === "running"
                      ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300"
                      : "border-border/70 bg-background text-foreground/55",
                )}>
                  <Wrench classИмя="h-3 w-3" />
                </span>
                <span classИмя={cn("text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground")}>
                  {humanizeLabel(item.name)}
                </span>
                <span classИмя={cn("text-[10px] font-semibold uppercase tracking-[0.14em]",
                  item.status === "running" ? "text-cyan-700 dark:text-cyan-300"
                  : item.status === "error" ? "text-red-700 dark:text-red-300"
                  : "text-emerald-700 dark:text-emerald-300"
                )}>
                  {item.status === "running" ? "Выполняется" : item.status === "error" ? "Ошибкаed" : "Завершён"}
                </span>
              </div>
              <div classИмя={cn("grid gap-2 pl-7", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
                <div>
                  <div classИмя="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Input</div>
                  <pre classИмя="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">
                    {formatToolPayload(item.input) || "<empty>"}
                  </pre>
                </div>
                {item.result && (
                  <div>
                    <div classИмя="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Result</div>
                    <pre classИмя={cn(
                      "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]",
                      item.status === "error" ? "text-red-700 dark:text-red-300" : "text-foreground/80",
                    )}>
                      {formatToolPayload(item.result)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptАктивностьRow({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "activity" }>;
  density: TranscriptDensity;
}) {
  return (
    <div classИмя="flex items-start gap-2">
      {block.status === "completed" ? (
        <Check classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
      ) : (
        <span classИмя="relative mt-1 flex h-2.5 w-2.5 shrink-0">
          <span classИмя="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
          <span classИмя="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
        </span>
      )}
      <div classИмя={cn(
        "break-words text-foreground/80",
        density === "compact" ? "text-xs leading-5" : "text-sm leading-6",
      )}>
        {block.name}
      </div>
    </div>
  );
}

function TranscriptEventRow({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "event" }>;
  density: TranscriptDensity;
}) {
  const compact = density === "compact";
  const toneClasses =
    block.tone === "error"
      ? "rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-red-700 dark:text-red-300"
      : block.tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : block.tone === "info"
          ? "text-sky-700 dark:text-sky-300"
          : "text-foreground/75";

  return (
    <div classИмя={toneClasses}>
      <div classИмя="flex items-start gap-2">
        {block.tone === "error" ? (
          <CircleAlert classИмя="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : block.tone === "warn" ? (
          <TerminalSquare classИмя="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <span classИмя="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current/50" />
        )}
        <div classИмя="min-w-0 flex-1">
          {block.label === "result" && block.tone !== "error" ? (
            <MarkdownBody
              classИмя={cn(
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sky-700 dark:text-sky-300",
                compact ? "text-[11px] leading-5" : "text-xs leading-5",
              )}
            >
              {block.text}
            </MarkdownBody>
          ) : (
            <div classИмя={cn("whitespace-pre-wrap break-words", compact ? "text-[11px]" : "text-xs")}>
              <span classИмя="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {block.label}
              </span>
              {block.text ? <span classИмя="ml-2">{block.text}</span> : null}
            </div>
          )}
          {block.detail && (
            <pre classИмя="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/75">
              {block.detail}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptDiffGroup({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "diff_group" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(false);
  const compact = density === "compact";

  // Count add/remove lines (exclude context, hunk, file_header, truncation)
  const addCount = block.hunks.filter((h) => h.changeТип === "add").length;
  const removeCount = block.hunks.filter((h) => h.changeТип === "remove").length;
  const hasChanges = addCount > 0 || removeCount > 0;

  // Extract a short file name from the path
  const shortFile = block.fileПуть
    ? block.fileПуть.split("/").pop() ?? block.fileПуть
    : "diff";

  return (
    <div classИмя="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-2">
      <div
        role="button"
        tabIndex={0}
        classИмя="flex cursor-pointer items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        onКлючDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventПо умолчанию(); setOpen((v) => !v); } }}
      >
        <GitCompare classИмя={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span classИмя={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300")}>
          {shortFile}
        </span>
        {hasChanges && (
          <span classИмя="text-[10px] tabular-nums">
            <span classИмя="text-emerald-600 dark:text-emerald-400">+{addCount}</span>
            {" "}
            <span classИмя="text-red-600 dark:text-red-400">-{removeCount}</span>
          </span>
        )}
        {open ? <ChevronDown classИмя="h-3.5 w-3.5" /> : <ChevronRight classИмя="h-3.5 w-3.5" />}
      </div>
      {open && (
        <pre classИмя={cn(
          "mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono pl-5",
          compact ? "text-[11px]" : "text-xs",
        )}>
          {block.hunks.map((hunk, i) => {
            const key = `${i}-${hunk.changeТип}`;
            switch (hunk.changeТип) {
              case "remove":
                return (
                  <span key={key} classИмя="block bg-red-500/[0.10] text-red-700 dark:text-red-300 -mx-2 px-2">
                    <span classИмя="select-none mr-2 text-red-500/60 dark:text-red-400/50">-</span>
                    {hunk.text}
                    {"\n"}
                  </span>
                );
              case "add":
                return (
                  <span key={key} classИмя="block bg-emerald-500/[0.10] text-emerald-700 dark:text-emerald-300 -mx-2 px-2">
                    <span classИмя="select-none mr-2 text-emerald-500/60 dark:text-emerald-400/50">+</span>
                    {hunk.text}
                    {"\n"}
                  </span>
                );
              case "file_header":
                return (
                  <span key={key} classИмя="block font-semibold text-blue-600 dark:text-blue-300 mt-2 first:mt-0">
                    {hunk.text}
                    {"\n"}
                  </span>
                );
              case "truncation":
                return (
                  <span key={key} classИмя="block text-muted-foreground italic mt-1">
                    {hunk.text}
                    {"\n"}
                  </span>
                );
              case "context":
              default:
                return (
                  <span key={key} classИмя="block text-muted-foreground/70">
                    {" "}
                    {hunk.text}
                    {"\n"}
                  </span>
                );
            }
          })}
        </pre>
      )}
    </div>
  );
}

function TranscriptStderrGroup({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "stderr_group" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(false);
  const compact = density === "compact";
  return (
    <div classИмя="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2 text-amber-700 dark:text-amber-300">
      <div
        role="button"
        tabIndex={0}
        classИмя="flex cursor-pointer items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        onКлючDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventПо умолчанию(); setOpen((v) => !v); } }}
      >
        <span classИмя={cn("text-[10px] font-semibold uppercase tracking-[0.14em]")}>
          {block.lines.length} log {block.lines.length === 1 ? "line" : "lines"}
        </span>
        {open ? <ChevronDown classИмя="h-3.5 w-3.5" /> : <ChevronRight classИмя="h-3.5 w-3.5" />}
      </div>
      {open && (
        <pre classИмя="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-amber-700/80 dark:text-amber-300/80 pl-5">
          {block.lines.map((line, i) => (
            <span key={`${line.ts}-${i}`}>
              <span classИмя="select-none text-amber-500/50 dark:text-amber-400/40">{i > 0 ? "\n" : ""}</span>
              {line.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}

function TranscriptSystemGroup({
  block,
  density,
}: {
  block: Extract<TranscriptBlock, { type: "system_group" }>;
  density: TranscriptDensity;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div classИмя="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-2 text-blue-700 dark:text-blue-300">
      <div
        role="button"
        tabIndex={0}
        classИмя="flex cursor-pointer items-center gap-2"
        onClick={() => setOpen((v) => !v)}
        onКлючDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventПо умолчанию(); setOpen((v) => !v); } }}
      >
        <TerminalSquare classИмя="h-3.5 w-3.5 shrink-0" />
        <span classИмя="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {block.lines.length} system {block.lines.length === 1 ? "message" : "messages"}
        </span>
        {open ? <ChevronDown classИмя="h-3.5 w-3.5" /> : <ChevronRight classИмя="h-3.5 w-3.5" />}
      </div>
      {open && (
        <pre classИмя="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-blue-700/80 dark:text-blue-300/80 pl-5">
          {block.lines.map((line, i) => (
            <span key={`${line.ts}-${i}`}>
              <span classИмя="select-none text-blue-500/40 dark:text-blue-400/30">{i > 0 ? "\n" : ""}</span>
              {line.text}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}

function TranscriptStdoutRow({
  block,
  density,
  collapseByПо умолчанию,
}: {
  block: Extract<TranscriptBlock, { type: "stdout" }>;
  density: TranscriptDensity;
  collapseByПо умолчанию: boolean;
}) {
  const [open, setOpen] = useState(!collapseByПо умолчанию);

  return (
    <div>
      <div classИмя="flex items-center gap-2">
        <span classИмя="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          stdout
        </span>
        <button
          type="button"
          classИмя="inline-flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Collapse stdout" : "Expand stdout"}
        >
          {open ? <ChevronDown classИмя="h-4 w-4" /> : <ChevronRight classИмя="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <pre classИмя={cn(
          "mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground/80",
          density === "compact" ? "text-[11px]" : "text-xs",
        )}>
          {block.text}
        </pre>
      )}
    </div>
  );
}

function findScrollРодитель(element: HTMLElement): HTMLElement | Window {
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function rawEntryContent(entry: TranscriptEntry): string {
  if (entry.kind === "tool_call") {
    return `${entry.name}\n${formatToolPayload(entry.input)}`;
  }
  if (entry.kind === "tool_result") {
    return formatToolPayload(entry.content);
  }
  if (entry.kind === "result") {
    return `${entry.text}\n${formatТокенs(entry.inputТокенs)} / ${formatТокенs(entry.outputТокенs)} / $${entry.costUsd.toFixed(6)}`;
  }
  if (entry.kind === "init") {
    return `model=${entry.model}${entry.sessionId ? ` session=${entry.sessionId}` : ""}`;
  }
  return entry.text;
}

function RawTranscriptView({
  entries,
  density,
}: {
  entries: TranscriptEntry[];
  density: TranscriptDensity;
}) {
  const compact = density === "compact";
  const listRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = entries.length > RAW_VIRTUALIZATION_THRESHOLD;
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(entries.length, shouldVirtualize ? RAW_INITIAL_ROWS : entries.length),
  }));

  useEffect(() => {
    if (!shouldVirtualize) {
      setRange({ start: 0, end: entries.length });
      return;
    }

    const list = listRef.current;
    if (!list) return;

    const scrollРодитель = findScrollРодитель(list);
    const updateRange = () => {
      const scrollElement: HTMLElement | null = scrollРодитель === window ? null : (scrollРодитель as HTMLElement);
      const scrollerTop = scrollElement ? scrollElement.getBoundingClientRect().top : 0;
      const scrollerHeight = scrollElement ? scrollElement.clientHeight : window.innerHeight;
      const listTop = list.getBoundingClientRect().top;
      const visibleTop = Math.max(0, scrollerTop - listTop);
      const visibleБотtom = Math.max(visibleTop + scrollerHeight, 0);
      const nextНачать = Math.max(0, Math.floor(visibleTop / RAW_ESTIMATED_ROW_HEIGHT) - RAW_OVERSCAN_ROWS);
      const nextEnd = Math.min(
        entries.length,
        Math.ceil(visibleБотtom / RAW_ESTIMATED_ROW_HEIGHT) + RAW_OVERSCAN_ROWS,
      );
      setRange((current) => (
        current.start === nextНачать && current.end === nextEnd
          ? current
          : { start: nextНачать, end: nextEnd }
      ));
    };

    updateRange();
    const frame = window.requestAnimationFrame(updateRange);
    scrollРодитель.addEventListener("scroll", updateRange, { passive: true });
    window.addEventListener("resize", updateRange);
    return () => {
      window.cancelAnimationFrame(frame);
      scrollРодитель.removeEventListener("scroll", updateRange);
      window.removeEventListener("resize", updateRange);
    };
  }, [entries.length, shouldVirtualize]);

  const visibleEntries = shouldVirtualize ? entries.slice(range.start, range.end) : entries;
  const topSpacer = shouldVirtualize ? range.start * RAW_ESTIMATED_ROW_HEIGHT : 0;
  const bottomSpacer = shouldVirtualize ? Math.max(0, entries.length - range.end) * RAW_ESTIMATED_ROW_HEIGHT : 0;

  return (
    <div ref={listRef} classИмя={cn("font-mono", compact ? "space-y-1 text-[11px]" : "space-y-1.5 text-xs")}>
      {topSpacer > 0 && <div aria-hidden="true" style={{ height: topSpacer }} />}
      {visibleEntries.map((entry, idx) => (
        <div
          key={`${entry.kind}-${entry.ts}-${range.start + idx}`}
          classИмя={cn(
            "grid gap-x-3",
            "grid-cols-[auto_1fr]",
          )}
        >
          <span classИмя="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {entry.kind}
          </span>
          <pre classИмя="min-w-0 whitespace-pre-wrap break-words text-foreground/80">
            {rawEntryContent(entry)}
          </pre>
        </div>
      ))}
      {bottomSpacer > 0 && <div aria-hidden="true" style={{ height: bottomSpacer }} />}
    </div>
  );
}

export function ЗапуститьTranscriptView({
  entries,
  mode = "nice",
  density = "comfortable",
  limit,
  streaming = false,
  collapseStdout = false,
  emptyMessage = "Нет transcript yet.",
  classИмя,
  thinkingClassИмя,
}: ЗапуститьTranscriptViewProps) {
  const blocks = useMemo(
    () => (mode === "raw" ? [] : normalizeTranscript(entries, streaming)),
    [entries, mode, streaming],
  );
  const visibleBlocks = limit ? blocks.slice(-limit) : blocks;
  const visibleEntries = limit ? entries.slice(-limit) : entries;

  if (entries.length === 0) {
    return (
      <div classИмя={cn("rounded-2xl border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground", classИмя)}>
        {emptyMessage}
      </div>
    );
  }

  if (mode === "raw") {
    return (
      <div classИмя={classИмя}>
        <RawTranscriptView entries={visibleEntries} density={density} />
      </div>
    );
  }

  return (
    <div classИмя={cn("space-y-3", classИмя)}>
      {visibleBlocks.map((block, index) => (
        <div
          key={`${block.type}-${block.ts}-${index}`}
          classИмя={cn(index === visibleBlocks.length - 1 && streaming && "animate-in fade-in slide-in-from-bottom-1 duration-300")}
        >
          {block.type === "message" && <TranscriptMessageBlock block={block} density={density} />}
          {block.type === "thinking" && (
            <TranscriptThinkingBlock block={block} density={density} classИмя={thinkingClassИмя} />
          )}
          {block.type === "tool" && <TranscriptToolCard block={block} density={density} />}
          {block.type === "command_group" && <TranscriptКомандаGroup block={block} density={density} />}
          {block.type === "tool_group" && <TranscriptToolGroup block={block} density={density} />}
          {block.type === "diff_group" && <TranscriptDiffGroup block={block} density={density} />}
          {block.type === "stderr_group" && <TranscriptStderrGroup block={block} density={density} />}
          {block.type === "system_group" && <TranscriptSystemGroup block={block} density={density} />}
          {block.type === "stdout" && (
            <TranscriptStdoutRow block={block} density={density} collapseByПо умолчанию={collapseStdout} />
          )}
          {block.type === "activity" && <TranscriptАктивностьRow block={block} density={density} />}
          {block.type === "event" && <TranscriptEventRow block={block} density={density} />}
        </div>
      ))}
    </div>
  );
}
