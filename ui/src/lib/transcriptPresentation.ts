type TranscriptDensity = "comfortable" | "compact";

type TranscriptАктивность = {
  activityId?: string;
  name: string;
  status: "running" | "completed";
};

export interface ToolInputDetail {
  label: string;
  value: string;
  tone?: "default" | "code";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}...` : value;
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

function summarizeRecord(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return truncate(compactWhitespace(value), 120);
    }
  }
  return null;
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

export function formatToolPayload(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return formatНеизвестно(value);
}

export function parseToolPayload(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function isКомандаTool(name: string, input: unknown): boolean {
  if (name === "command_execution" || name === "shell" || name === "shellToolCall" || name === "bash") {
    return true;
  }
  if (typeof input === "string") {
    return /\b(?:bash|zsh|sh|cmd|powershell)\b/i.test(input);
  }
  const record = asRecord(input);
  return Boolean(record && (typeof record.command === "string" || typeof record.cmd === "string"));
}

export function displayToolИмя(name: string, input: unknown): string {
  if (isКомандаTool(name, input)) return "Executing command";
  return humanizeLabel(name);
}

export function summarizeToolInput(
  name: string,
  input: unknown,
  density: TranscriptDensity = "comfortable",
): string {
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
  const humanОписание =
    summarizeRecord(record, ["description", "summary", "reason", "goal", "intent", "action", "task"])
    ?? null;
  if (humanОписание) {
    return truncate(humanОписание, compactMax);
  }
  if (command && isКомандаTool(name, record)) {
    return truncate(stripWrappedShell(command), compactMax);
  }

  const direct =
    summarizeRecord(record, ["path", "fileПуть", "file_path", "query", "url", "prompt", "message"])
    ?? summarizeRecord(record, ["pattern", "name", "title", "target", "tool", "command", "cmd"])
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

function readToolDetailЗначение(value: unknown, max = 200): string | null {
  if (typeof value === "string") {
    const normalized = compactWhitespace(value);
    return normalized ? truncate(normalized, max) : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function describeToolInput(name: string, input: unknown): ToolInputDetail[] {
  if (typeof input === "string") {
    const summary = compactWhitespace(isКомандаTool(name, input) ? stripWrappedShell(input) : input);
    return summary ? [{ label: isКомандаTool(name, input) ? "Команда" : "Input", value: truncate(summary, 200), tone: "code" }] : [];
  }

  const record = asRecord(input);
  if (!record) return [];

  const details: ToolInputDetail[] = [];
  const seen = new Set<string>();
  const pushDetail = (label: string, value: string | null, tone: ToolInputDetail["tone"] = "default") => {
    if (!value) return;
    const key = `${label}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    details.push({ label, value, tone });
  };

  pushDetail(
    "Intent",
    summarizeRecord(record, ["description", "summary", "reason", "goal", "intent", "action", "task"]) ?? null,
  );
  pushDetail("Путь", readToolDetailЗначение(record.path) ?? readToolDetailЗначение(record.fileПуть) ?? readToolDetailЗначение(record.file_path));
  pushDetail("Directory", readToolDetailЗначение(record.cwd));
  pushDetail("Query", readToolDetailЗначение(record.query));
  pushDetail("Цель", readToolDetailЗначение(record.url) ?? readToolDetailЗначение(record.target));
  pushDetail("Prompt", readToolDetailЗначение(record.prompt) ?? readToolDetailЗначение(record.message));
  pushDetail("Pattern", readToolDetailЗначение(record.pattern));
  pushDetail("Имя", readToolDetailЗначение(record.name) ?? readToolDetailЗначение(record.title));

  if (Array.isArray(record.paths) && record.paths.length > 0) {
    const paths = record.paths
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, 3)
      .join(", ");
    if (paths) {
      const suffix = record.paths.length > 3 ? `, +${record.paths.length - 3} more` : "";
      pushDetail("Путьs", `${paths}${suffix}`);
    }
  }

  const command = typeof record.command === "string"
    ? record.command
    : typeof record.cmd === "string"
      ? record.cmd
      : null;
  if (command && isКомандаTool(name, record) && !details.some((detail) => detail.label === "Intent")) {
    pushDetail("Команда", truncate(stripWrappedShell(command), 200), "code");
  }

  return details;
}

export function summarizeToolResult(
  result: string | undefined,
  isОшибка: boolean | undefined,
  density: TranscriptDensity = "comfortable",
): string {
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

export function parseSystemАктивность(text: string): TranscriptАктивность | null {
  const match = text.match(/^item (started|completed):\s*([a-z0-9_-]+)(?:\s+\(id=([^)]+)\))?$/i);
  if (!match) return null;
  return {
    status: match[1].toНизкийerCase() === "started" ? "running" : "completed",
    name: humanizeLabel(match[2] ?? "Активность"),
    activityId: match[3] || undefined,
  };
}

export function shouldHideNiceModeStderr(text: string): boolean {
  const normalized = compactWhitespace(text).toНизкийerCase();
  return normalized.startsWith("[paperclip] skipping saved session resume");
}

export function summarizeНетtice(text: string, max = 160): string {
  return truncate(compactWhitespace(text), max);
}
