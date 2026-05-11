import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link, Navigate, useBeforeUnload } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentsApi,
  type АгентКлюч,
  type ClaudeLoginResult,
  type АгентPermissionОбновить,
} from "../api/agents";
import { companyНавыкиApi } from "../api/companyНавыки";
import { budgetsApi } from "../api/budgets";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { ApiОшибка } from "../api/client";
import { ChartCard, ЗапуститьАктивностьChart, ПриоритетChart, ЗадачаСтатусChart, УспешноRateChart } from "../components/АктивностьCharts";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useSidebar } from "../context/SidebarContext";
import { useКомпания } from "../context/КомпанияContext";
import { useToastActions } from "../context/ToastContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { АгентConfigForm } from "../components/АгентConfigForm";
import { PageTabBar } from "../components/PageTabBar";
import { adapterЯрлыки, roleЯрлыки, help } from "../components/agent-config-primitives";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useАдаптерCapabilities } from "@/adapters/use-adapter-capabilities";
import { redactКомандаText as redactКомандаСекретText } from "@paperclipai/adapter-utils";
import { MarkdownИзменитьor } from "../components/MarkdownИзменитьor";
import { assetsApi } from "../api/assets";
import { getUIАдаптер, buildTranscript, onАдаптерChange } from "../adapters";
import { СтатусBadge } from "../components/СтатусBadge";
import { agentСтатусDot, agentСтатусDotПо умолчанию } from "../lib/status-colors";
import { MarkdownBody } from "../components/MarkdownBody";
import { КопироватьText } from "../components/КопироватьText";
import { EntityRow } from "../components/EntityRow";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { ЗапуститьButton, ПаузаПродолжитьButton } from "../components/АгентActionButtons";
import { БюджетPolicyCard } from "../components/БюджетPolicyCard";
import { FileTree, buildFileTree } from "../components/FileTree";
import { ScrollToБотtom } from "../components/ScrollToБотtom";
import { formatCents, formatDate, relativeTime, formatТокенs, visibleЗапуститьCostUsd } from "../lib/utils";
import { cn } from "../lib/utils";
import { describeЗапуститьПовторитьState } from "../lib/runПовторитьState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Loader2,
  Slash,
  RotateCcw,
  Trash2,
  Plus,
  Ключ,
  Eye,
  EyeOff,
  Копировать,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  HelpCircle,
  ПапкаOpen,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { TooltipПровайдер } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { АгентIcon, АгентIconPicker } from "../components/АгентIconPicker";
import { ЗапуститьTranscriptView, type TranscriptMode } from "../components/transcript/ЗапуститьTranscriptView";
import {
  isUuidLike,
  type Агент,
  type АгентНавыкEntry,
  type АгентНавыкSnapshot,
  type АгентDetail as АгентDetailRecord,
  type БюджетPolicySummary,
  type HeartbeatЗапустить,
  type HeartbeatЗапуститьEvent,
  type АгентЗапуститьtimeState,
  type LiveEvent,
  type Рабочая областьOperation,
} from "@paperclipai/shared";
import { redactHomeПутьUserSegments, redactHomeПутьUserSegmentsInЗначение } from "@paperclipai/adapter-utils";
import { agentRouteRef } from "../lib/utils";
import {
  applyАгентНавыкSnapshot,
  arraysEqual,
  isReadOnlyUnmanagedНавыкEntry,
} from "../lib/agent-skills-state";

const runСтатусIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  succeeded: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
  running: { icon: Loader2, color: "text-cyan-600 dark:text-cyan-400" },
  queued: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
  scheduled_retry: { icon: Clock, color: "text-sky-600 dark:text-sky-400" },
  timed_out: { icon: Timer, color: "text-orange-600 dark:text-orange-400" },
  cancelled: { icon: Slash, color: "text-neutral-500 dark:text-neutral-400" },
};

const RUN_LOG_PAGE_BYTES = 256_000;

const REDACTED_ENV_VALUE = "***REDACTED***";
const SECRET_ENV_KEY_RE =
  /(api[-_]?key|access[-_]?token|auth(?:_?token)?|authorization|bearer|secret|passwd|password|credential|jwt|private[-_]?key|cookie|connectionstring)/i;
const COMMAND_ENV_KEY_RE = /(^command$|^cmd$|command[-_]?line|resolved[-_]?command|PAPERCLIP_RESOLVED_COMMAND)/i;
const JWT_VALUE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/;

function redactПутьText(value: string, censorUsernameInLogs: boolean) {
  return redactHomeПутьUserSegments(value, { enabled: censorUsernameInLogs });
}

function redactПутьЗначение<T>(value: T, censorUsernameInLogs: boolean): T {
  return redactHomeПутьUserSegmentsInЗначение(value, { enabled: censorUsernameInLogs });
}

function redactКомандаText(value: string, censorUsernameInLogs: boolean): string {
  return redactПутьText(redactКомандаСекретText(value, REDACTED_ENV_VALUE), censorUsernameInLogs);
}

function shouldRedactСекретЗначение(key: string, value: unknown): boolean {
  if (SECRET_ENV_KEY_RE.test(key)) return true;
  if (typeof value !== "string") return false;
  return JWT_VALUE_RE.test(value);
}

function redactEnvЗначение(key: string, value: unknown, censorUsernameInLogs: boolean): string {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "secret_ref"
  ) {
    return "***SECRET_REF***";
  }
  if (shouldRedactСекретЗначение(key, value)) return REDACTED_ENV_VALUE;
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && COMMAND_ENV_KEY_RE.test(key)) return redactКомандаText(value, censorUsernameInLogs);
  if (typeof value === "string") return redactПутьText(value, censorUsernameInLogs);
  try {
    return JSON.stringify(redactПутьЗначение(value, censorUsernameInLogs));
  } catch {
    return redactПутьText(String(value), censorUsernameInLogs);
  }
}

function isMarkdown(pathЗначение: string) {
  return pathЗначение.toНизкийerCase().endsWith(".md");
}

function formatEnvForDisplay(envЗначение: unknown, censorUsernameInLogs: boolean): string {
  const env = asRecord(envЗначение);
  if (!env) return "<unable-to-parse>";

  const keys = Object.keys(env);
  if (keys.length === 0) return "<empty>";

  return keys
    .sort()
    .map((key) => `${key}=${redactEnvЗначение(key, env[key], censorUsernameInLogs)}`)
    .join("\n");
}

const sourceЯрлыки: Record<string, string> = {
  timer: "Timer",
  assignment: "Assignment",
  on_demand: "On-demand",
  automation: "Автоmation",
};

const LIVE_SCROLL_BOTTOM_TOLERANCE_PX = 32;
type ScrollContainer = Window | HTMLElement;

function isWindowContainer(container: ScrollContainer): container is Window {
  return container === window;
}

function isElementScrollContainer(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

function findScrollContainer(anchor: HTMLElement | null): ScrollContainer {
  let parent = anchor?.parentElement ?? null;
  while (parent) {
    if (isElementScrollContainer(parent)) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function readScrollMetrics(container: ScrollContainer): { scrollHeight: number; distanceFromБотtom: number } {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const viewportБотtom = window.scrollY + window.innerHeight;
    return {
      scrollHeight: pageHeight,
      distanceFromБотtom: Math.max(0, pageHeight - viewportБотtom),
    };
  }

  const viewportБотtom = container.scrollTop + container.clientHeight;
  return {
    scrollHeight: container.scrollHeight,
    distanceFromБотtom: Math.max(0, container.scrollHeight - viewportБотtom),
  };
}

function scrollToContainerБотtom(container: ScrollContainer, behavior: ScrollBehavior = "auto") {
  if (isWindowContainer(container)) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    window.scrollTo({ top: pageHeight, behavior });
    return;
  }

  container.scrollTo({ top: container.scrollHeight, behavior });
}

type АгентDetailView = "dashboard" | "instructions" | "configuration" | "skills" | "runs" | "budget";

function parseАгентDetailView(value: string | null): АгентDetailView {
  if (value === "instructions" || value === "prompts") return "instructions";
  if (value === "configure" || value === "configuration") return "configuration";
  if (value === "skills") return "skills";
  if (value === "budget") return "budget";
  if (value === "runs") return value;
  return "dashboard";
}

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function setsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function runMetrics(run: HeartbeatЗапустить) {
  const usage = (run.usageJson ?? null) as Record<string, unknown> | null;
  const result = (run.resultJson ?? null) as Record<string, unknown> | null;
  const input = usageNumber(usage, "inputТокенs", "input_tokens");
  const output = usageNumber(usage, "outputТокенs", "output_tokens");
  const cached = usageNumber(
    usage,
    "cachedInputТокенs",
    "cached_input_tokens",
    "cache_read_input_tokens",
  );
  const cost =
    visibleЗапуститьCostUsd(usage, result);
  const provider = asНетnEmptyString(usage?.provider) ?? null;
  const model = asНетnEmptyString(usage?.model) ?? null;
  return {
    input,
    output,
    cached,
    cost,
    totalТокенs: input + output,
    provider,
    model,
  };
}

type ЗапуститьLogChunk = { ts: string; stream: "stdout" | "stderr" | "system"; chunk: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asНетnEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ЗапуститьInvocationCard({
  payload,
  censorUsernameInLogs,
}: {
  payload: Record<string, unknown>;
  censorUsernameInLogs: boolean;
}) {
  const rawКомандаLine = [
    typeof payload.command === "string" ? payload.command : null,
    ...(Array.isArray(payload.commandArgs)
      ? payload.commandArgs.filter((value): value is string => typeof value === "string")
      : []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const commandLine = rawКомандаLine ? redactКомандаText(rawКомандаLine, censorUsernameInLogs) : "";

  const hasДополнительноДетали =
    commandLine.length > 0
    || (Array.isArray(payload.commandНетtes) && payload.commandНетtes.length > 0)
    || payload.prompt !== undefined
    || payload.context !== undefined
    || payload.env !== undefined;

  return (
    <div classИмя="rounded-lg border border-border bg-background/60 p-3 space-y-2">
      <div classИмя="text-xs font-medium text-muted-foreground">Invocation</div>
      {typeof payload.adapterТип === "string" && (
        <div classИмя="text-xs"><span classИмя="text-muted-foreground">Адаптер: </span>{payload.adapterТип}</div>
      )}
      {typeof payload.cwd === "string" && (
        <div classИмя="text-xs break-all"><span classИмя="text-muted-foreground">Работаing dir: </span><span classИмя="font-mono">{payload.cwd}</span></div>
      )}
      {hasДополнительноДетали && (
        <Collapsible>
          <CollapsibleTrigger classИмя="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronRight classИмя="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            Детали
          </CollapsibleTrigger>
          <CollapsibleContent classИмя="pt-2 space-y-2">
            {commandLine && (
              <div classИмя="text-xs break-all">
                <span classИмя="text-muted-foreground">Команда: </span>
                <span classИмя="font-mono">{commandLine}</span>
              </div>
            )}
            {Array.isArray(payload.commandНетtes) && payload.commandНетtes.length > 0 && (
              <div>
                <div classИмя="text-xs text-muted-foreground mb-1">Команда notes</div>
                <ul classИмя="list-disc pl-5 space-y-1">
                  {payload.commandНетtes
                    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                    .map((note, idx) => (
                      <li key={`${idx}-${note}`} classИмя="text-xs break-all font-mono">
                        {note}
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {payload.prompt !== undefined && (
              <div>
                <div classИмя="text-xs text-muted-foreground mb-1">Prompt</div>
                <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">
                  {typeof payload.prompt === "string"
                    ? redactПутьText(payload.prompt, censorUsernameInLogs)
                    : JSON.stringify(redactПутьЗначение(payload.prompt, censorUsernameInLogs), null, 2)}
                </pre>
              </div>
            )}
            {payload.context !== undefined && (
              <div>
                <div classИмя="text-xs text-muted-foreground mb-1">Context</div>
                <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(redactПутьЗначение(payload.context, censorUsernameInLogs), null, 2)}
                </pre>
              </div>
            )}
            {payload.env !== undefined && (
              <div>
                <div classИмя="text-xs text-muted-foreground mb-1">Окружение</div>
                <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  {formatEnvForDisplay(payload.env, censorUsernameInLogs)}
                </pre>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function parseStoredLogContent(content: string): ЗапуститьLogChunk[] {
  const parsed: ЗапуститьLogChunk[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
      const stream =
        raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
      const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
      const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
      if (!chunk) continue;
      parsed.push({ ts, stream, chunk });
    } catch {
      // Ignore malformed log lines.
    }
  }
  return parsed;
}

function workspaceOperationPhaseLabel(phase: Рабочая областьOperation["phase"]) {
  switch (phase) {
    case "worktree_prepare":
      return "Работаtree setup";
    case "workspace_provision":
      return "Provision";
    case "workspace_teardown":
      return "Teardown";
    case "worktree_cleanup":
      return "Работаtree cleanup";
    default:
      return phase;
  }
}

function workspaceOperationСтатусTone(status: Рабочая областьOperation["status"]) {
  switch (status) {
    case "succeeded":
      return "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300";
    case "failed":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
    case "running":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
    case "skipped":
      return "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function Рабочая областьOperationСтатусBadge({ status }: { status: Рабочая областьOperation["status"] }) {
  return (
    <span
      classИмя={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        workspaceOperationСтатусTone(status),
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Рабочая областьOperationLogViewer({
  operation,
  censorUsernameInLogs,
}: {
  operation: Рабочая областьOperation;
  censorUsernameInLogs: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: logData, isЗагрузка, error } = useQuery({
    queryКлюч: ["workspace-operation-log", operation.id],
    queryFn: () => heartbeatsApi.workspaceOperationLog(operation.id),
    enabled: open && Boolean(operation.logRef),
    refetchInterval: open && operation.status === "running" ? 2000 : false,
  });

  const chunks = useMemo(
    () => (logData?.content ? parseStoredLogContent(logData.content) : []),
    [logData?.content],
  );

  return (
    <div classИмя="space-y-2">
      <button
        type="button"
        classИмя="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Скрыть полный лог" : "Показать полный лог"}
      </button>
      {open && (
        <div classИмя="rounded-md border border-border bg-background/70 p-2">
          {isЗагрузка && <div classИмя="text-xs text-muted-foreground">Загрузка log...</div>}
          {error && (
            <div classИмя="text-xs text-destructive">
              {error instanceof Ошибка ? error.message : "Ошибка to load workspace operation log"}
            </div>
          )}
          {!isЗагрузка && !error && chunks.length === 0 && (
            <div classИмя="text-xs text-muted-foreground">Нет persisted log lines.</div>
          )}
          {chunks.length > 0 && (
            <div classИмя="max-h-64 overflow-y-auto rounded bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-950">
              {chunks.map((chunk, index) => (
                <div key={`${chunk.ts}-${index}`} classИмя="flex gap-2">
                  <span classИмя="shrink-0 text-neutral-500">
                    {new Date(chunk.ts).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span
                    classИмя={cn(
                      "shrink-0 w-14",
                      chunk.stream === "stderr"
                        ? "text-red-600 dark:text-red-300"
                        : chunk.stream === "system"
                          ? "text-blue-600 dark:text-blue-300"
                          : "text-muted-foreground",
                    )}
                  >
                    [{chunk.stream}]
                  </span>
                  <span classИмя="whitespace-pre-wrap break-all">{redactПутьText(chunk.chunk, censorUsernameInLogs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Рабочая областьOperationsSection({
  operations,
  censorUsernameInLogs,
}: {
  operations: Рабочая областьOperation[];
  censorUsernameInLogs: boolean;
}) {
  if (operations.length === 0) return null;

  return (
    <div classИмя="rounded-lg border border-border bg-background/60 p-3 space-y-3">
      <div classИмя="text-xs font-medium text-muted-foreground">
        Рабочая область ({operations.length})
      </div>
      <div classИмя="space-y-3">
        {operations.map((operation) => {
          const metadata = asRecord(operation.metadata);
          return (
            <div key={operation.id} classИмя="rounded-md border border-border/70 bg-background/70 p-3 space-y-2">
              <div classИмя="flex flex-wrap items-center gap-2">
                <div classИмя="text-sm font-medium">{workspaceOperationPhaseLabel(operation.phase)}</div>
                <Рабочая областьOperationСтатусBadge status={operation.status} />
                <div classИмя="text-[11px] text-muted-foreground">
                  {relativeTime(operation.startedAt)}
                  {operation.finishedAt && ` to ${relativeTime(operation.finishedAt)}`}
                </div>
              </div>
              {operation.command && (
                <div classИмя="text-xs break-all">
                  <span classИмя="text-muted-foreground">Команда: </span>
                  <span classИмя="font-mono">{operation.command}</span>
                </div>
              )}
              {operation.cwd && (
                <div classИмя="text-xs break-all">
                  <span classИмя="text-muted-foreground">Работаing dir: </span>
                  <span classИмя="font-mono">{operation.cwd}</span>
                </div>
              )}
              {(asНетnEmptyString(metadata?.branchИмя)
                || asНетnEmptyString(metadata?.baseRef)
                || asНетnEmptyString(metadata?.worktreeПуть)
                || asНетnEmptyString(metadata?.repoRoot)
                || asНетnEmptyString(metadata?.cleanupAction)) && (
                <div classИмя="grid gap-1 text-xs sm:grid-cols-2">
                  {asНетnEmptyString(metadata?.branchИмя) && (
                    <div><span classИмя="text-muted-foreground">Ветка: </span><span classИмя="font-mono">{metadata?.branchИмя as string}</span></div>
                  )}
                  {asНетnEmptyString(metadata?.baseRef) && (
                    <div><span classИмя="text-muted-foreground">Base ref: </span><span classИмя="font-mono">{metadata?.baseRef as string}</span></div>
                  )}
                  {asНетnEmptyString(metadata?.worktreeПуть) && (
                    <div classИмя="break-all"><span classИмя="text-muted-foreground">Работаtree: </span><span classИмя="font-mono">{metadata?.worktreeПуть as string}</span></div>
                  )}
                  {asНетnEmptyString(metadata?.repoRoot) && (
                    <div classИмя="break-all"><span classИмя="text-muted-foreground">Репозиторий root: </span><span classИмя="font-mono">{metadata?.repoRoot as string}</span></div>
                  )}
                  {asНетnEmptyString(metadata?.cleanupAction) && (
                    <div><span classИмя="text-muted-foreground">Cleanup: </span><span classИмя="font-mono">{metadata?.cleanupAction as string}</span></div>
                  )}
                </div>
              )}
              {typeof metadata?.created === "boolean" && (
                <div classИмя="text-xs text-muted-foreground">
                  {metadata.created ? "Создано by this run" : "Reused existing workspace"}
                </div>
              )}
              {operation.stderrExcerpt && operation.stderrExcerpt.trim() && (
                <div>
                  <div classИмя="mb-1 text-xs text-red-700 dark:text-red-300">stderr excerpt</div>
                  <pre classИмя="rounded-md bg-red-50 p-2 text-xs whitespace-pre-wrap break-all text-red-800 dark:bg-neutral-950 dark:text-red-100">
                    {redactПутьText(operation.stderrExcerpt, censorUsernameInLogs)}
                  </pre>
                </div>
              )}
              {operation.stdoutExcerpt && operation.stdoutExcerpt.trim() && (
                <div>
                  <div classИмя="mb-1 text-xs text-muted-foreground">stdout excerpt</div>
                  <pre classИмя="rounded-md bg-neutral-100 p-2 text-xs whitespace-pre-wrap break-all dark:bg-neutral-950">
                    {redactПутьText(operation.stdoutExcerpt, censorUsernameInLogs)}
                  </pre>
                </div>
              )}
              {operation.logRef && (
                <Рабочая областьOperationLogViewer
                  operation={operation}
                  censorUsernameInLogs={censorUsernameInLogs}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function АгентDetail() {
  const { companyPrefix, agentId, tab: urlTab, runId: urlЗапуститьId } = useParams<{
    companyPrefix?: string;
    agentId: string;
    tab?: string;
    runId?: string;
  }>();
  const { companies, selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const { closePanel } = usePanel();
  const { openNewЗадача } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const activeView = urlЗапуститьId ? "runs" as АгентDetailView : parseАгентDetailView(urlTab ?? null);
  const needsПанель управленияData = activeView === "dashboard";
  const needsЗапуститьData = activeView === "runs" || Boolean(urlЗапуститьId);
  const shouldLoadHeartbeats = needsПанель управленияData || needsЗапуститьData;
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const saveConfigActionRef = useRef<(() => void) | null>(null);
  const cancelConfigActionRef = useRef<(() => void) | null>(null);
  const { isMobile } = useSidebar();
  const routeАгентRef = agentId ?? "";
  const routeКомпанияId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);
  const lookupКомпанияId = routeКомпанияId ?? selectedКомпанияId ?? undefined;
  const canFetchАгент = routeАгентRef.length > 0 && (isUuidLike(routeАгентRef) || Boolean(lookupКомпанияId));
  const setСохранитьConfigAction = useCallback((fn: (() => void) | null) => { saveConfigActionRef.current = fn; }, []);
  const setОтменаConfigAction = useCallback((fn: (() => void) | null) => { cancelConfigActionRef.current = fn; }, []);

  const { data: agent, isЗагрузка, error } = useQuery<АгентDetailRecord>({
    queryКлюч: [...queryКлючs.agents.detail(routeАгентRef), lookupКомпанияId ?? null],
    queryFn: () => agentsApi.get(routeАгентRef, lookupКомпанияId),
    enabled: canFetchАгент,
  });
  const resolvedКомпанияId = agent?.companyId ?? selectedКомпанияId;
  const canonicalАгентRef = agent ? agentRouteRef(agent) : routeАгентRef;
  const agentLookupRef = agent?.id ?? routeАгентRef;
  const resolvedАгентId = agent?.id ?? null;

  const { data: runtimeState } = useQuery({
    queryКлюч: queryКлючs.agents.runtimeState(resolvedАгентId ?? routeАгентRef),
    queryFn: () => agentsApi.runtimeState(resolvedАгентId!, resolvedКомпанияId ?? undefined),
    enabled: Boolean(resolvedАгентId) && needsПанель управленияData,
  });

  const { data: heartbeats } = useQuery({
    queryКлюч: queryКлючs.heartbeats(resolvedКомпанияId!, agent?.id ?? undefined),
    queryFn: () => heartbeatsApi.list(resolvedКомпанияId!, agent?.id ?? undefined),
    enabled: !!resolvedКомпанияId && !!agent?.id && shouldLoadHeartbeats,
  });

  const { data: allЗадачи } = useQuery({
    queryКлюч: [...queryКлючs.issues.list(resolvedКомпанияId!), "participant-agent", resolvedАгентId ?? "__none__"],
    queryFn: () => issuesApi.list(resolvedКомпанияId!, { participantАгентId: resolvedАгентId! }),
    enabled: !!resolvedКомпанияId && !!resolvedАгентId && needsПанель управленияData,
  });

  const { data: allАгенты } = useQuery({
    queryКлюч: queryКлючs.agents.list(resolvedКомпанияId!),
    queryFn: () => agentsApi.list(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId && needsПанель управленияData,
  });

  const { data: budgetОбзор } = useQuery({
    queryКлюч: queryКлючs.budgets.overview(resolvedКомпанияId ?? "__none__"),
    queryFn: () => budgetsApi.overview(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const assignedЗадачи = (allЗадачи ?? [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const reportsToАгент = (allАгенты ?? []).find((a) => a.id === agent?.reportsTo);
  const directРепозиторийrts = (allАгенты ?? []).filter((a) => a.reportsTo === agent?.id && a.status !== "terminated");
  const agentБюджетSummary = useMemo(() => {
    const matched = budgetОбзор?.policies.find(
      (policy) => policy.scopeТип === "agent" && policy.scopeId === (agent?.id ?? routeАгентRef),
    );
    if (matched) return matched;
    const budgetMonthlyCents = agent?.budgetMonthlyCents ?? 0;
    const spentMonthlyCents = agent?.spentMonthlyCents ?? 0;
    return {
      policyId: "",
      companyId: resolvedКомпанияId ?? "",
      scopeТип: "agent",
      scopeId: agent?.id ?? routeАгентRef,
      scopeИмя: agent?.name ?? "Агент",
      metric: "billed_cents",
      windowKind: "calendar_month_utc",
      amount: budgetMonthlyCents,
      observedAmount: spentMonthlyCents,
      remainingAmount: Math.max(0, budgetMonthlyCents - spentMonthlyCents),
      utilizationPercent:
        budgetMonthlyCents > 0 ? Number(((spentMonthlyCents / budgetMonthlyCents) * 100).toFixed(2)) : 0,
      warnPercent: 80,
      hardОстановитьВключитьd: true,
      notifyВключитьd: true,
      isАктивен: budgetMonthlyCents > 0,
      status: budgetMonthlyCents > 0 && spentMonthlyCents >= budgetMonthlyCents ? "hard_stop" : "ok",
      paused: agent?.status === "paused",
      pauseReason: agent?.pauseReason ?? null,
      windowНачать: new Date(),
      windowEnd: new Date(),
    } satisfies БюджетPolicySummary;
  }, [agent, budgetОбзор?.policies, resolvedКомпанияId, routeАгентRef]);
  const mobileLiveЗапустить = useMemo(
    () => (heartbeats ?? []).find((r) => r.status === "running" || r.status === "queued") ?? null,
    [heartbeats],
  );

  useEffect(() => {
    if (!agent) return;
    if (urlЗапуститьId) {
      if (routeАгентRef !== canonicalАгентRef) {
        navigate(`/agents/${canonicalАгентRef}/runs/${urlЗапуститьId}`, { replace: true });
      }
      return;
    }
    const canonicalTab =
      activeView === "instructions"
        ? "instructions"
        : activeView === "configuration"
          ? "configuration"
          : activeView === "skills"
            ? "skills"
            : activeView === "runs"
              ? "runs"
              : activeView === "budget"
                ? "budget"
              : "dashboard";
    if (routeАгентRef !== canonicalАгентRef || urlTab !== canonicalTab) {
      navigate(`/agents/${canonicalАгентRef}/${canonicalTab}`, { replace: true });
      return;
    }
  }, [agent, routeАгентRef, canonicalАгентRef, urlЗапуститьId, urlTab, activeView, navigate]);

  useEffect(() => {
    if (!agent?.companyId || agent.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(agent.companyId, { source: "route_sync" });
  }, [agent?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  const agentAction = useMutation({
    mutationFn: async (action: "invoke" | "pause" | "resume" | "approve" | "terminate") => {
      if (!agentLookupRef) return Promise.reject(new Ошибка("Нет agent reference"));
      switch (action) {
        case "invoke": return agentsApi.invoke(agentLookupRef, resolvedКомпанияId ?? undefined);
        case "pause": return agentsApi.pause(agentLookupRef, resolvedКомпанияId ?? undefined);
        case "resume": return agentsApi.resume(agentLookupRef, resolvedКомпанияId ?? undefined);
        case "approve": return agentsApi.approve(agentLookupRef, resolvedКомпанияId ?? undefined);
        case "terminate": return agentsApi.terminate(agentLookupRef, resolvedКомпанияId ?? undefined);
      }
    },
    onУспешно: (data, action) => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(routeАгентRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentLookupRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.runtimeState(agentLookupRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.taskSessions(agentLookupRef) });
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(resolvedКомпанияId) });
        if (agent?.id) {
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(resolvedКомпанияId, agent.id) });
        }
      }
      if (action === "invoke" && data && typeof data === "object" && "id" in data) {
        navigate(`/agents/${canonicalАгентRef}/runs/${(data as HeartbeatЗапустить).id}`);
      }
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Действие не удалось");
    },
  });

  const budgetMutation = useMutation({
    mutationFn: (amount: number) =>
      budgetsApi.upsertPolicy(resolvedКомпанияId!, {
        scopeТип: "agent",
        scopeId: agent?.id ?? routeАгентRef,
        amount,
        windowKind: "calendar_month_utc",
      }),
    onУспешно: () => {
      if (!resolvedКомпанияId) return;
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.budgets.overview(resolvedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(routeАгентRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentLookupRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(resolvedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(resolvedКомпанияId) });
    },
  });

  const updateIcon = useMutation({
    mutationFn: (icon: string) => agentsApi.update(agentLookupRef, { icon }, resolvedКомпанияId ?? undefined),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(routeАгентRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentLookupRef) });
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(resolvedКомпанияId) });
      }
    },
  });

  const resetЗадачаSession = useMutation({
    mutationFn: (taskКлюч: string | null) =>
      agentsApi.resetSession(agentLookupRef, taskКлюч, resolvedКомпанияId ?? undefined),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.runtimeState(agentLookupRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.taskSessions(agentLookupRef) });
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to reset session");
    },
  });

  const updatePermissions = useMutation({
    mutationFn: (permissions: АгентPermissionОбновить) =>
      agentsApi.updatePermissions(agentLookupRef, permissions, resolvedКомпанияId ?? undefined),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(routeАгентRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentLookupRef) });
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(resolvedКомпанияId) });
      }
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to update permissions");
    },
  });

  useEffect(() => {
    const crumbs: { label: string; href?: string }[] = [
      { label: "Агенты", href: "/agents" },
    ];
    const agentИмя = agent?.name ?? routeАгентRef ?? "Агент";
    if (activeView === "dashboard" && !urlЗапуститьId) {
      crumbs.push({ label: agentИмя });
    } else {
      crumbs.push({ label: agentИмя, href: `/agents/${canonicalАгентRef}/dashboard` });
      if (urlЗапуститьId) {
        crumbs.push({ label: "Запуститьs", href: `/agents/${canonicalАгентRef}/runs` });
        crumbs.push({ label: `Запустить ${urlЗапуститьId.slice(0, 8)}` });
      } else if (activeView === "instructions") {
        crumbs.push({ label: "Instructions" });
      } else if (activeView === "configuration") {
        crumbs.push({ label: "Конфигурация" });
      // } else if (activeView === "skills") { // TODO: bring back later
      //   crumbs.push({ label: "Навыки" });
      } else if (activeView === "runs") {
        crumbs.push({ label: "Запуститьs" });
      } else if (activeView === "budget") {
        crumbs.push({ label: "Бюджет" });
      } else {
        crumbs.push({ label: "Панель управления" });
      }
    }
    setBreadcrumbs(crumbs);
  }, [setBreadcrumbs, agent, routeАгентRef, canonicalАгентRef, activeView, urlЗапуститьId]);

  useEffect(() => {
    closePanel();
    return () => closePanel();
  }, [closePanel]);

  useBeforeUnload(
    useCallback((event) => {
      if (!configDirty) return;
      event.preventПо умолчанию();
      event.returnЗначение = "";
    }, [configDirty]),
  );

  if (isЗагрузка) return <PageSkeleton variant="detail" />;
  if (error) return <p classИмя="text-sm text-destructive">{error.message}</p>;
  if (!agent) return null;
  if (!urlЗапуститьId && !urlTab) {
    return <Navigate to={`/agents/${canonicalАгентRef}/dashboard`} replace />;
  }
  const isОжиданиеСогласование = agent.status === "pending_approval";
  const showConfigActionBar = (activeView === "configuration" || activeView === "instructions") && (configDirty || configSaving);

  return (
    <div classИмя={cn("space-y-6", isMobile && showConfigActionBar && "pb-24")}>
      {/* Header */}
      <div classИмя="flex items-center justify-between gap-2">
        <div classИмя="flex items-center gap-3 min-w-0">
          <АгентIconPicker
            value={agent.icon}
            onChange={(icon) => updateIcon.mutate(icon)}
          >
            <button classИмя="shrink-0 flex items-center justify-center h-12 w-12 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
              <АгентIcon icon={agent.icon} classИмя="h-6 w-6" />
            </button>
          </АгентIconPicker>
          <div classИмя="min-w-0">
            <h2 classИмя="text-2xl font-bold truncate">{agent.name}</h2>
            <p classИмя="text-sm text-muted-foreground truncate">
              {roleЯрлыки[agent.role] ?? agent.role}
              {agent.title ? ` - ${agent.title}` : ""}
            </p>
          </div>
        </div>
        <div classИмя="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewЗадача({ assigneeАгентId: agent.id })}
          >
            <Plus classИмя="h-3.5 w-3.5 sm:mr-1" />
            <span classИмя="hidden sm:inline">Assign Задача</span>
          </Button>
          <ЗапуститьButton
            onClick={() => agentAction.mutate("invoke")}
            disabled={agentAction.isОжидание || isОжиданиеСогласование}
            label="Запустить Heartbeat"
          />
          <ПаузаПродолжитьButton
            isПриостановлен={agent.status === "paused"}
            onПауза={() => agentAction.mutate("pause")}
            onПродолжить={() => agentAction.mutate("resume")}
            disabled={agentAction.isОжидание || isОжиданиеСогласование}
          />
          <span classИмя="hidden sm:inline"><СтатусBadge status={agent.status} /></span>
          {mobileLiveЗапустить && (
            <Link
              to={`/agents/${canonicalАгентRef}/runs/${mobileLiveЗапустить.id}`}
              classИмя="sm:hidden flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors no-underline"
            >
              <span classИмя="relative flex h-2 w-2">
                <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span classИмя="text-[11px] font-medium text-blue-600 dark:text-blue-400">Live</span>
            </Link>
          )}

          {/* Overflow menu */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal classИмя="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-44 p-1" align="end">
              <button
                classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  navigator.clipboard.writeText(agent.id);
                  setMoreOpen(false);
                }}
              >
                <Копировать classИмя="h-3 w-3" />
                Копировать Агент ID
              </button>
              <button
                classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                onClick={() => {
                  resetЗадачаSession.mutate(null);
                  setMoreOpen(false);
                }}
              >
                <RotateCcw classИмя="h-3 w-3" />
                Сбросить Sessions
              </button>
              <button
                classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                onClick={() => {
                  agentAction.mutate("terminate");
                  setMoreOpen(false);
                }}
              >
                <Trash2 classИмя="h-3 w-3" />
                Terminate
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!urlЗапуститьId && (
        <Tabs
          value={activeView}
          onЗначениеChange={(value) => navigate(`/agents/${canonicalАгентRef}/${value}`)}
        >
          <PageTabBar
            items={[
              { value: "dashboard", label: "Панель управления" },
              { value: "instructions", label: "Instructions" },
              { value: "skills", label: "Навыки" },
              { value: "configuration", label: "Конфигурация" },
              { value: "runs", label: "Запуститьs" },
              { value: "budget", label: "Бюджет" },
            ]}
            value={activeView}
            onЗначениеChange={(value) => navigate(`/agents/${canonicalАгентRef}/${value}`)}
          />
        </Tabs>
      )}

      {actionОшибка && <p classИмя="text-sm text-destructive">{actionОшибка}</p>}
      {isОжиданиеСогласование && (
        <div classИмя="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-200">
          <span>This agent is pending board approval and cannot be invoked yet.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => agentAction.mutate("approve")}
            disabled={agentAction.isОжидание}
          >
            <CheckCircle2 classИмя="h-3.5 w-3.5 sm:mr-1" />
            <span>Одобрить agent</span>
          </Button>
        </div>
      )}

      {/* Floating Сохранить/Отмена (desktop) */}
      {!isMobile && showConfigActionBar && (
        <div classИмя="fixed bottom-6 right-6 z-30">
          <div classИмя="flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving…" : "Сохранить"}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile bottom Сохранить/Отмена bar */}
      {isMobile && showConfigActionBar && (
        <div classИмя="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
          <div
            classИмя="flex items-center justify-end gap-2 px-3 py-2"
            style={{ paddingБотtom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelConfigActionRef.current?.()}
              disabled={configSaving}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigActionRef.current?.()}
              disabled={configSaving}
            >
              {configSaving ? "Saving…" : "Сохранить"}
            </Button>
          </div>
        </div>
      )}

      {/* View content */}
      {activeView === "dashboard" && (
        <АгентОбзор
          agent={agent}
          runs={heartbeats ?? []}
          assignedЗадачи={assignedЗадачи}
          runtimeState={runtimeState}
          agentId={agent.id}
          agentRouteId={canonicalАгентRef}
        />
      )}

      {activeView === "instructions" && (
        <PromptsTab
          agent={agent}
          companyId={resolvedКомпанияId ?? undefined}
          onDirtyChange={setConfigDirty}
          onСохранитьActionChange={setСохранитьConfigAction}
          onОтменаActionChange={setОтменаConfigAction}
          onSavingChange={setConfigSaving}
        />
      )}

      {activeView === "configuration" && (
        <АгентConfigurePage
          agent={agent}
          agentId={agent.id}
          companyId={resolvedКомпанияId ?? undefined}
          onDirtyChange={setConfigDirty}
          onСохранитьActionChange={setСохранитьConfigAction}
          onОтменаActionChange={setОтменаConfigAction}
          onSavingChange={setConfigSaving}
          updatePermissions={updatePermissions}
        />
      )}

      {activeView === "skills" && (
        <АгентНавыкиTab
          agent={agent}
          companyId={resolvedКомпанияId ?? undefined}
        />
      )}

      {activeView === "runs" && (
        <ЗапуститьsTab
          runs={heartbeats ?? []}
          companyId={resolvedКомпанияId!}
          agentId={agent.id}
          agentRouteId={canonicalАгентRef}
          selectedЗапуститьId={urlЗапуститьId ?? null}
          adapterТип={agent.adapterТип}
          adapterConfig={agent.adapterConfig}
        />
      )}

      {activeView === "budget" && resolvedКомпанияId ? (
        <div classИмя="max-w-3xl">
          <БюджетPolicyCard
            summary={agentБюджетSummary}
            isSaving={budgetMutation.isОжидание}
            onСохранить={(amount) => budgetMutation.mutate(amount)}
            variant="plain"
          />
        </div>
      ) : null}
    </div>
  );
}

/* ---- Helper components ---- */

function SummaryRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex items-center justify-between">
      <span classИмя="text-muted-foreground text-xs">{label}</span>
      <div classИмя="flex items-center gap-1">{children}</div>
    </div>
  );
}

function LatestЗапуститьCard({ runs, agentId }: { runs: HeartbeatЗапустить[]; agentId: string }) {
  if (runs.length === 0) return null;

  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const liveЗапустить = sorted.find((r) => r.status === "running" || r.status === "queued");
  const run = liveЗапустить ?? sorted[0];
  const isLive = run.status === "running" || run.status === "queued";
  const statusInfo = runСтатусIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const СтатусIcon = statusInfo.icon;
  const summaryRaw = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  // Extract a clean 2-3 line excerpt: first non-empty, non-header, non-list-mark lines
  const summary = useMemo(() => {
    if (!summaryRaw) return "";
    const lines = summaryRaw
      .replace(/^#{1,6}\s+/gm, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("|") && !l.startsWith("```") && !/^[-*>]/.test(l) && !/^\d+\./.test(l));
    const excerpt: string[] = [];
    let chars = 0;
    for (const line of lines) {
      if (excerpt.length >= 3 || chars + line.length > 280) break;
      excerpt.push(line);
      chars += line.length;
    }
    return excerpt.join(" ");
  }, [summaryRaw]);

  return (
    <div classИмя="space-y-3">
      <div classИмя="flex w-full items-center justify-between">
        <h3 classИмя="flex items-center gap-2 text-sm font-medium">
          {isLive && (
            <span classИмя="relative flex h-2 w-2">
              <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
          )}
          {isLive ? "Live Запустить" : "Latest Запустить"}
        </h3>
        <Link
          to={`/agents/${agentId}/runs/${run.id}`}
          classИмя="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          View details &rarr;
        </Link>
      </div>

      <Link
        to={`/agents/${agentId}/runs/${run.id}`}
        classИмя={cn(
          "block border rounded-lg p-4 space-y-2 w-full no-underline transition-colors hover:bg-muted/50 cursor-pointer",
          isLive ? "border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.08)]" : "border-border"
        )}
      >
        <div classИмя="flex items-center gap-2">
          <СтатусIcon classИмя={cn("h-3.5 w-3.5", statusInfo.color, run.status === "running" && "animate-spin")} />
          <СтатусBadge status={run.status} />
          <span classИмя="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}</span>
          <span classИмя={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
              : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
              : "bg-muted text-muted-foreground"
          )}>
            {sourceЯрлыки[run.invocationSource] ?? run.invocationSource}
          </span>
          <span classИмя="ml-auto text-xs text-muted-foreground">{relativeTime(run.createdAt)}</span>
        </div>

        {summary && (
          <div classИмя="overflow-hidden max-h-16">
            <MarkdownBody classИмя="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{summary}</MarkdownBody>
          </div>
        )}
      </Link>
    </div>
  );
}

/* ---- Агент Обзор (main single-page view) ---- */

function АгентОбзор({
  agent,
  runs,
  assignedЗадачи,
  runtimeState,
  agentId,
  agentRouteId,
}: {
  agent: АгентDetailRecord;
  runs: HeartbeatЗапустить[];
  assignedЗадачи: { id: string; title: string; status: string; priority: string; identifier?: string | null; createdAt: Date }[];
  runtimeState?: АгентЗапуститьtimeState;
  agentId: string;
  agentRouteId: string;
}) {
  return (
    <div classИмя="space-y-8">
      {/* Latest Запустить */}
      <LatestЗапуститьCard runs={runs} agentId={agentRouteId} />

      {/* Charts */}
      <div classИмя="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartCard title="Запустить Активность" subtitle="Last 14 days">
          <ЗапуститьАктивностьChart runs={runs} />
        </ChartCard>
        <ChartCard title="Задачи by Приоритет" subtitle="Last 14 days">
          <ПриоритетChart issues={assignedЗадачи} />
        </ChartCard>
        <ChartCard title="Задачи by Статус" subtitle="Last 14 days">
          <ЗадачаСтатусChart issues={assignedЗадачи} />
        </ChartCard>
        <ChartCard title="Успешно Rate" subtitle="Last 14 days">
          <УспешноRateChart runs={runs} />
        </ChartCard>
      </div>

      {/* Recent Задачи */}
      <div classИмя="space-y-3">
        <div classИмя="flex items-center justify-between">
          <h3 classИмя="text-sm font-medium">Recent Задачи</h3>
          <Link
            to={`/issues?participantАгентId=${agentId}`}
            classИмя="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See Все &rarr;
          </Link>
        </div>
        {assignedЗадачи.length === 0 ? (
          <p classИмя="text-sm text-muted-foreground">Нет recent issues.</p>
        ) : (
          <div classИмя="border border-border rounded-lg">
            {assignedЗадачи.slice(0, 10).map((issue) => (
              <EntityRow
                key={issue.id}
                identifier={issue.identifier ?? issue.id.slice(0, 8)}
                title={issue.title}
                to={`/issues/${issue.identifier ?? issue.id}`}
                trailing={<СтатусBadge status={issue.status} />}
              />
            ))}
            {assignedЗадачи.length > 10 && (
              <div classИмя="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                +{assignedЗадачи.length - 10} more issues
              </div>
            )}
          </div>
        )}
      </div>

      {/* Расходы */}
      <div classИмя="space-y-3">
        <h3 classИмя="text-sm font-medium">Расходы</h3>
        <РасходыSection runtimeState={runtimeState} runs={runs} />
      </div>
    </div>
  );
}

/* ---- Расходы Section (inline) ---- */

function РасходыSection({
  runtimeState,
  runs,
}: {
  runtimeState?: АгентЗапуститьtimeState;
  runs: HeartbeatЗапустить[];
}) {
  const runsWithCost = runs
    .filter((r) => {
      const metrics = runMetrics(r);
      return metrics.cost > 0 || metrics.input > 0 || metrics.output > 0 || metrics.cached > 0;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div classИмя="space-y-4">
      {runtimeState && (
        <div classИмя="border border-border rounded-lg p-4">
          <div classИмя="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
            <div>
              <span classИмя="text-xs text-muted-foreground block">Input tokens</span>
              <span classИмя="text-lg font-semibold">{formatТокенs(runtimeState.totalInputТокенs)}</span>
            </div>
            <div>
              <span classИмя="text-xs text-muted-foreground block">Output tokens</span>
              <span classИмя="text-lg font-semibold">{formatТокенs(runtimeState.totalOutputТокенs)}</span>
            </div>
            <div>
              <span classИмя="text-xs text-muted-foreground block">Cached tokens</span>
              <span classИмя="text-lg font-semibold">{formatТокенs(runtimeState.totalCachedInputТокенs)}</span>
            </div>
            <div>
              <span classИмя="text-xs text-muted-foreground block">Total cost</span>
              <span classИмя="text-lg font-semibold">{formatCents(runtimeState.totalCostCents)}</span>
            </div>
          </div>
        </div>
      )}
      {runsWithCost.length > 0 && (
        <div classИмя="border border-border rounded-lg overflow-hidden">
          <table classИмя="w-full text-xs">
            <thead>
              <tr classИмя="border-b border-border bg-accent/20">
                <th classИмя="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th classИмя="text-left px-3 py-2 font-medium text-muted-foreground">Запустить</th>
                <th classИмя="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
                <th classИмя="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
                <th classИмя="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runsWithCost.slice(0, 10).map((run) => {
                const metrics = runMetrics(run);
                return (
                  <tr key={run.id} classИмя="border-b border-border last:border-b-0">
                    <td classИмя="px-3 py-2">{formatDate(run.createdAt)}</td>
                    <td classИмя="px-3 py-2 font-mono">{run.id.slice(0, 8)}</td>
                    <td classИмя="px-3 py-2 text-right tabular-nums">{formatТокенs(metrics.input)}</td>
                    <td classИмя="px-3 py-2 text-right tabular-nums">{formatТокенs(metrics.output)}</td>
                    <td classИмя="px-3 py-2 text-right tabular-nums">
                      {metrics.cost > 0
                        ? `$${metrics.cost.toFixed(4)}`
                        : "-"
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---- Агент Configure Page ---- */

function АгентConfigurePage({
  agent,
  agentId,
  companyId,
  onDirtyChange,
  onСохранитьActionChange,
  onОтменаActionChange,
  onSavingChange,
  updatePermissions,
}: {
  agent: АгентDetailRecord;
  agentId: string;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onСохранитьActionChange: (save: (() => void) | null) => void;
  onОтменаActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
  updatePermissions: { mutate: (permissions: АгентPermissionОбновить) => void; isОжидание: boolean };
}) {
  const queryClient = useQueryClient();
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  const { data: configRevisions } = useQuery({
    queryКлюч: queryКлючs.agents.configRevisions(agent.id),
    queryFn: () => agentsApi.listConfigRevisions(agent.id, companyId),
  });

  const rollbackConfig = useMutation({
    mutationFn: (revisionId: string) => agentsApi.rollbackConfigRevision(agent.id, revisionId, companyId),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.configRevisions(agent.id) });
    },
  });

  return (
    <div classИмя="max-w-3xl space-y-6">
      <КонфигурацияTab
        agent={agent}
        onDirtyChange={onDirtyChange}
        onСохранитьActionChange={onСохранитьActionChange}
        onОтменаActionChange={onОтменаActionChange}
        onSavingChange={onSavingChange}
        updatePermissions={updatePermissions}
        companyId={companyId}
        hidePromptTemplate
        hideInstructionsFile
      />
      <div>
        <h3 classИмя="text-sm font-medium mb-3">API Ключs</h3>
        <КлючsTab agentId={agentId} companyId={companyId} />
      </div>

      {/* Конфигурация Revisions — collapsible at the bottom */}
      <div>
        <button
          classИмя="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
          onClick={() => setRevisionsOpen((v) => !v)}
        >
          {revisionsOpen
            ? <ChevronDown classИмя="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight classИмя="h-3.5 w-3.5 text-muted-foreground" />
          }
          Конфигурация Revisions
          <span classИмя="text-xs font-normal text-muted-foreground">{configRevisions?.length ?? 0}</span>
        </button>
        {revisionsOpen && (
          <div classИмя="mt-3">
            {(configRevisions ?? []).length === 0 ? (
              <p classИмя="text-sm text-muted-foreground">Нет configuration revisions yet.</p>
            ) : (
              <div classИмя="space-y-2">
                {(configRevisions ?? []).slice(0, 10).map((revision) => (
                  <div key={revision.id} classИмя="border border-border/70 rounded-md p-3 space-y-2">
                    <div classИмя="flex items-center justify-between gap-3">
                      <div classИмя="text-xs text-muted-foreground">
                        <span classИмя="font-mono">{revision.id.slice(0, 8)}</span>
                        <span classИмя="mx-1">·</span>
                        <span>{formatDate(revision.createdAt)}</span>
                        <span classИмя="mx-1">·</span>
                        <span>{revision.source}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        classИмя="h-7 px-2.5 text-xs"
                        onClick={() => rollbackConfig.mutate(revision.id)}
                        disabled={rollbackConfig.isОжидание}
                      >
                        Restore
                      </Button>
                    </div>
                    <p classИмя="text-xs text-muted-foreground">
                      Changed:{" "}
                      {revision.changedКлючs.length > 0 ? revision.changedКлючs.join(", ") : "no tracked changes"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Конфигурация Tab ---- */

function КонфигурацияTab({
  agent,
  companyId,
  onDirtyChange,
  onСохранитьActionChange,
  onОтменаActionChange,
  onSavingChange,
  updatePermissions,
  hidePromptTemplate,
  hideInstructionsFile,
}: {
  agent: АгентDetailRecord;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onСохранитьActionChange: (save: (() => void) | null) => void;
  onОтменаActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
  updatePermissions: { mutate: (permissions: АгентPermissionОбновить) => void; isОжидание: boolean };
  hidePromptTemplate?: boolean;
  hideInstructionsFile?: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [awaitingОбновитьAfterСохранить, setAwaitingОбновитьAfterСохранить] = useState(false);
  const lastАгентRef = useRef(agent);

  const { data: adapterМодельs } = useQuery({
    queryКлюч:
      companyId
        ? queryКлючs.agents.adapterМодельs(companyId, agent.adapterТип)
        : ["agents", "none", "adapter-models", agent.adapterТип],
    queryFn: () => agentsApi.adapterМодельs(companyId!, agent.adapterТип),
    enabled: Boolean(companyId),
  });

  const updateАгент = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentsApi.update(agent.id, data, companyId),
    onMutate: () => {
      setAwaitingОбновитьAfterСохранить(true);
    },
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.configRevisions(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(agent.companyId) });
    },
    onОшибка: (err) => {
      setAwaitingОбновитьAfterСохранить(false);
      const message =
        err instanceof ApiОшибка
          ? err.message
          : err instanceof Ошибка
            ? err.message
            : "Could not save agent";
      pushToast({ title: "Ошибка сохранения", body: message, tone: "error" });
    },
  });

  useEffect(() => {
    if (awaitingОбновитьAfterСохранить && agent !== lastАгентRef.current) {
      setAwaitingОбновитьAfterСохранить(false);
    }
    lastАгентRef.current = agent;
  }, [agent, awaitingОбновитьAfterСохранить]);
  const isConfigSaving = updateАгент.isОжидание || awaitingОбновитьAfterСохранить;

  useEffect(() => {
    onSavingChange(isConfigSaving);
  }, [onSavingChange, isConfigSaving]);

  const canСоздатьАгенты = Boolean(agent.permissions?.canСоздатьАгенты);
  const canAssignЗадачи = Boolean(agent.access?.canAssignЗадачи);
  const taskAssignSource = agent.access?.taskAssignSource ?? "none";
  const taskAssignLocked = agent.role === "ceo" || canСоздатьАгенты;
  const taskAssignHint =
    taskAssignSource === "ceo_role"
      ? "Включитьd automatically for CEO agents."
      : taskAssignSource === "agent_creator"
        ? "Включитьd automatically while this agent can create new agents."
        : taskAssignSource === "explicit_grant"
          ? "Включитьd via explicit company permission grant."
          : "Отключитьd unless explicitly granted.";

  return (
    <div classИмя="space-y-6">
      <АгентConfigForm
        mode="edit"
        agent={agent}
        onСохранить={(patch) => updateАгент.mutate(patch)}
        isSaving={isConfigSaving}
        adapterМодельs={adapterМодельs}
        onDirtyChange={onDirtyChange}
        onСохранитьActionChange={onСохранитьActionChange}
        onОтменаActionChange={onОтменаActionChange}
        hideInlineСохранить
        hidePromptTemplate={hidePromptTemplate}
        hideInstructionsFile={hideInstructionsFile}
        sectionLayout="cards"
      />

      <div>
        <h3 classИмя="text-sm font-medium mb-3">Permissions</h3>
        <div classИмя="border border-border rounded-lg p-4 space-y-4">
          <div classИмя="flex items-center justify-between gap-4 text-sm">
            <div classИмя="space-y-1">
              <div>Can create new agents</div>
              <p classИмя="text-xs text-muted-foreground">
                Lets this agent create or hire agents and implicitly assign tasks.
              </p>
            </div>
            <ToggleSwitch
              checked={canСоздатьАгенты}
              onCheckedChange={() =>
                updatePermissions.mutate({
                  canСоздатьАгенты: !canСоздатьАгенты,
                  canAssignЗадачи: !canСоздатьАгенты ? true : canAssignЗадачи,
                })
              }
              disabled={updatePermissions.isОжидание}
            />
          </div>
          <div classИмя="flex items-center justify-between gap-4 text-sm">
            <div classИмя="space-y-1">
              <div>Can assign tasks</div>
              <p classИмя="text-xs text-muted-foreground">
                {taskAssignHint}
              </p>
            </div>
            <ToggleSwitch
              checked={canAssignЗадачи}
              onCheckedChange={() =>
                updatePermissions.mutate({
                  canСоздатьАгенты,
                  canAssignЗадачи: !canAssignЗадачи,
                })
              }
              disabled={updatePermissions.isОжидание || taskAssignLocked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Prompts Tab ---- */

function PromptsTab({
  agent,
  companyId,
  onDirtyChange,
  onСохранитьActionChange,
  onОтменаActionChange,
  onSavingChange,
}: {
  agent: Агент;
  companyId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onСохранитьActionChange: (save: (() => void) | null) => void;
  onОтменаActionChange: (cancel: (() => void) | null) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { selectedКомпанияId } = useКомпания();
  const { isMobile } = useSidebar();
  const [selectedFile, setSelectedFile] = useState<string>("AGENTS.md");
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [draft, setЧерновик] = useState<string | null>(null);
  const [bundleЧерновик, setBundleЧерновик] = useState<{
    mode: "managed" | "external";
    rootПуть: string;
    entryFile: string;
  } | null>(null);
  const [newFileПуть, setNewFileПуть] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [pendingФайлы, setОжиданиеФайлы] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [filePanelWidth, setFilePanelWidth] = useState(260);
  const [instructionPaneWidth, setInstructionPaneWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [awaitingОбновить, setAwaitingОбновить] = useState(false);
  const lastFileВерсияRef = useRef<string | null>(null);
  const externalBundleRef = useRef<{
    rootПуть: string;
    entryFile: string;
    selectedFile: string;
  } | null>(null);

  useEffect(() => {
    setSelectedFile("AGENTS.md");
    setShowFilePanel(false);
    setЧерновик(null);
    setBundleЧерновик(null);
    setNewFileПуть("");
    setShowNewFileInput(false);
    setОжиданиеФайлы([]);
    setExpandedDirs(new Set());
    setAwaitingОбновить(false);
    lastFileВерсияRef.current = null;
    externalBundleRef.current = null;
  }, [agent.id]);

  const getCapabilities = useАдаптерCapabilities();
  const isLocal = getCapabilities(agent.adapterТип).supportsInstructionsBundle;

  const { data: bundle, isЗагрузка: bundleЗагрузка } = useQuery({
    queryКлюч: queryКлючs.agents.instructionsBundle(agent.id),
    queryFn: () => agentsApi.instructionsBundle(agent.id, companyId),
    enabled: Boolean(companyId && isLocal),
  });

  const persistedMode = bundle?.mode ?? "managed";
  const persistedRootПуть = persistedMode === "managed"
    ? (bundle?.managedRootПуть ?? bundle?.rootПуть ?? "")
    : (bundle?.rootПуть ?? "");
  const currentMode = bundleЧерновик?.mode ?? persistedMode;
  const currentEntryFile = bundleЧерновик?.entryFile ?? bundle?.entryFile ?? "AGENTS.md";
  const currentRootПуть = bundleЧерновик?.rootПуть ?? persistedRootПуть;
  const fileOptions = useMemo(
    () => bundle?.files.map((file) => file.path) ?? [],
    [bundle],
  );
  const bundleMatchesЧерновик = Boolean(
    bundle &&
    currentMode === persistedMode &&
    currentEntryFile === bundle.entryFile &&
    currentRootПуть === persistedRootПуть,
  );
  const visibleFileПутьs = useMemo(
    () => bundleMatchesЧерновик
      ? [...new Set([currentEntryFile, ...fileOptions, ...pendingФайлы])]
      : [currentEntryFile, ...pendingФайлы],
    [bundleMatchesЧерновик, currentEntryFile, fileOptions, pendingФайлы],
  );
  const fileTree = useMemo(
    () => buildFileTree(Object.fromEntries(visibleFileПутьs.map((fileПуть) => [fileПуть, ""]))),
    [visibleFileПутьs],
  );
  const selectedOrEntryFile = selectedFile || currentEntryFile;
  const selectedFileExists = bundleMatchesЧерновик && fileOptions.includes(selectedOrEntryFile);
  const selectedFileSummary = bundle?.files.find((file) => file.path === selectedOrEntryFile) ?? null;

  const { data: selectedFileDetail, isЗагрузка: fileЗагрузка } = useQuery({
    queryКлюч: queryКлючs.agents.instructionsFile(agent.id, selectedOrEntryFile),
    queryFn: () => agentsApi.instructionsFile(agent.id, selectedOrEntryFile, companyId),
    enabled: Boolean(companyId && isLocal && selectedFileExists),
  });

  const updateBundle = useMutation({
    mutationFn: (data: {
      mode?: "managed" | "external";
      rootПуть?: string | null;
      entryFile?: string;
      clearLegacyPromptTemplate?: boolean;
    }) => agentsApi.updateInstructionsBundle(agent.id, data, companyId),
    onMutate: () => setAwaitingОбновить(true),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.instructionsBundle(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) });
    },
    onОшибка: () => setAwaitingОбновить(false),
  });

  const saveFile = useMutation({
    mutationFn: (data: { path: string; content: string; clearLegacyPromptTemplate?: boolean }) =>
      agentsApi.saveInstructionsFile(agent.id, data, companyId),
    onMutate: () => setAwaitingОбновить(true),
    onУспешно: (_, variables) => {
      setОжиданиеФайлы((prev) => prev.filter((f) => f !== variables.path));
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.instructionsBundle(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.instructionsFile(agent.id, variables.path) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) });
    },
    onОшибка: () => setAwaitingОбновить(false),
  });

  const deleteFile = useMutation({
    mutationFn: (relativeПуть: string) => agentsApi.deleteInstructionsFile(agent.id, relativeПуть, companyId),
    onMutate: () => setAwaitingОбновить(true),
    onУспешно: (_, relativeПуть) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.instructionsBundle(agent.id) });
      queryClient.removeQueries({ queryКлюч: queryКлючs.agents.instructionsFile(agent.id, relativeПуть) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) });
    },
    onОшибка: () => setAwaitingОбновить(false),
  });

  const uploadMarkdownImage = useMutation({
    mutationFn: async ({ file, namespace }: { file: File; namespace: string }) => {
      if (!selectedКомпанияId) throw new Ошибка("Select a company to upload images");
      return assetsApi.uploadImage(selectedКомпанияId, file, namespace);
    },
  });

  useEffect(() => {
    if (!bundle) return;
    if (!bundleMatchesЧерновик) {
      if (selectedFile !== currentEntryFile) setSelectedFile(currentEntryFile);
      return;
    }
    const availableПутьs = bundle.files.map((file) => file.path);
    if (availableПутьs.length === 0) {
      if (selectedFile !== bundle.entryFile) setSelectedFile(bundle.entryFile);
      return;
    }
    if (!availableПутьs.includes(selectedFile) && selectedFile !== currentEntryFile && !pendingФайлы.includes(selectedFile)) {
      setSelectedFile(availableПутьs.includes(bundle.entryFile) ? bundle.entryFile : availableПутьs[0]!);
    }
  }, [bundle, bundleMatchesЧерновик, currentEntryFile, pendingФайлы, selectedFile]);

  useEffect(() => {
    const nextExpanded = new Set<string>();
    for (const fileПуть of visibleFileПутьs) {
      const parts = fileПуть.split("/");
      let currentПуть = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentПуть = currentПуть ? `${currentПуть}/${parts[i]}` : parts[i]!;
        nextExpanded.add(currentПуть);
      }
    }
    setExpandedDirs((current) => (setsEqual(current, nextExpanded) ? current : nextExpanded));
  }, [visibleFileПутьs]);

  useEffect(() => {
    if (isMobile) {
      setInstructionPaneWidth(null);
      return;
    }
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setInstructionPaneWidth(element.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setInstructionPaneWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [bundleЗагрузка, isMobile, visibleFileПутьs.length]);

  useEffect(() => {
    const versionКлюч = selectedFileExists && selectedFileDetail
      ? `${selectedFileDetail.path}:${selectedFileDetail.content}`
      : `draft:${currentMode}:${currentRootПуть}:${selectedOrEntryFile}`;
    if (awaitingОбновить) {
      setAwaitingОбновить(false);
      setBundleЧерновик(null);
      setЧерновик(null);
      lastFileВерсияRef.current = versionКлюч;
      return;
    }
    if (lastFileВерсияRef.current !== versionКлюч) {
      setЧерновик(null);
      lastFileВерсияRef.current = versionКлюч;
    }
  }, [awaitingОбновить, currentMode, currentRootПуть, selectedFileDetail, selectedFileExists, selectedOrEntryFile]);

  useEffect(() => {
    if (!bundle) return;
    setBundleЧерновик((current) => {
      if (current) return current;
      return {
        mode: persistedMode,
        rootПуть: persistedRootПуть,
        entryFile: bundle.entryFile,
      };
    });
  }, [bundle, persistedMode, persistedRootПуть]);

  useEffect(() => {
    if (!bundle || currentMode !== "external") return;
    externalBundleRef.current = {
      rootПуть: currentRootПуть,
      entryFile: currentEntryFile,
      selectedFile: selectedOrEntryFile,
    };
  }, [bundle, currentEntryFile, currentMode, currentRootПуть, selectedOrEntryFile]);

  const currentContent = selectedFileExists ? (selectedFileDetail?.content ?? "") : "";
  const displayЗначение = draft ?? currentContent;
  const bundleDirty = Boolean(
    bundleЧерновик &&
      (
        bundleЧерновик.mode !== persistedMode ||
        bundleЧерновик.rootПуть !== persistedRootПуть ||
        bundleЧерновик.entryFile !== (bundle?.entryFile ?? "AGENTS.md")
      ),
  );
  const fileDirty = draft !== null && draft !== currentContent;
  const isDirty = bundleDirty || fileDirty;
  const isSaving = updateBundle.isОжидание || saveFile.isОжидание || deleteFile.isОжидание || awaitingОбновить;

  useEffect(() => { onSavingChange(isSaving); }, [onSavingChange, isSaving]);
  useEffect(() => { onDirtyChange(isDirty); }, [onDirtyChange, isDirty]);

  useEffect(() => {
    onСохранитьActionChange(isDirty ? () => {
      const save = async () => {
        const shouldОчиститьLegacy =
          Boolean(bundle?.legacyPromptTemplateАктивен) || Boolean(bundle?.legacyBootstrapPromptTemplateАктивен);
        if (bundleDirty && bundleЧерновик) {
          await updateBundle.mutateAsync({
            mode: bundleЧерновик.mode,
            rootПуть: bundleЧерновик.mode === "external" ? bundleЧерновик.rootПуть : null,
            entryFile: bundleЧерновик.entryFile,
          });
        }
        if (fileDirty) {
          await saveFile.mutateAsync({
            path: selectedOrEntryFile,
            content: displayЗначение,
            clearLegacyPromptTemplate: shouldОчиститьLegacy,
          });
        }
      };
      void save().catch(() => undefined);
    } : null);
  }, [
    bundle,
    bundleDirty,
    bundleЧерновик,
    displayЗначение,
    fileDirty,
    isDirty,
    onСохранитьActionChange,
    saveFile,
    selectedOrEntryFile,
    updateBundle,
  ]);

  useEffect(() => {
    onОтменаActionChange(isDirty ? () => {
      setЧерновик(null);
      if (bundle) {
        setBundleЧерновик({
          mode: persistedMode,
          rootПуть: persistedRootПуть,
          entryFile: bundle.entryFile,
        });
      }
    } : null);
  }, [bundle, isDirty, onОтменаActionChange, persistedMode, persistedRootПуть]);

  const handleSeparatorDrag = useCallback((event: React.MouseEvent) => {
    event.preventПо умолчанию();
    const startX = event.clientX;
    const startWidth = filePanelWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.max(180, Math.min(500, startWidth + delta));
      setFilePanelWidth(next);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [filePanelWidth]);

  const instructionsSideBySide =
    !isMobile && instructionPaneWidth !== null && instructionPaneWidth >= filePanelWidth + 520;

  if (!isLocal) {
    return (
      <div classИмя="max-w-3xl">
        <p classИмя="text-sm text-muted-foreground">
          Instructions bundles are only available for local adapters.
        </p>
      </div>
    );
  }

  if (bundleЗагрузка && !bundle) {
    return <PromptsTabSkeleton />;
  }

  return (
    <div classИмя="space-y-6">
      {(bundle?.warnings ?? []).length > 0 && (
        <div classИмя="space-y-2">
          {(bundle?.warnings ?? []).map((warning) => (
            <div key={warning} classИмя="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
              {warning}
            </div>
          ))}
        </div>
      )}

      <Collapsible defaultOpen={currentMode === "external"}>
        <CollapsibleTrigger classИмя="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronRight classИмя="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          Дополнительно
        </CollapsibleTrigger>
        <CollapsibleContent classИмя="pt-4 pb-6">
          <TooltipПровайдер>
            <div classИмя="grid gap-x-6 gap-y-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,0.65fr)]">
              <label classИмя="space-y-1.5 min-w-0">
                <span classИмя="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Mode
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle classИмя="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      Managed: Paperclip stores and serves the instructions bundle. External: you provide a path on disk where the instructions live.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <div classИмя="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentMode === "managed" ? "default" : "outline"}
                    onClick={() => {
                      if (currentMode === "external") {
                        externalBundleRef.current = {
                          rootПуть: currentRootПуть,
                          entryFile: currentEntryFile,
                          selectedFile: selectedOrEntryFile,
                        };
                      }
                      const nextEntryFile = currentEntryFile || "AGENTS.md";
                      setBundleЧерновик({
                        mode: "managed",
                        rootПуть: bundle?.managedRootПуть ?? currentRootПуть,
                        entryFile: nextEntryFile,
                      });
                      setSelectedFile(nextEntryFile);
                    }}
                  >
                    Managed
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentMode === "external" ? "default" : "outline"}
                    onClick={() => {
                      const externalBundle = externalBundleRef.current;
                      const nextEntryFile = externalBundle?.entryFile ?? currentEntryFile ?? "AGENTS.md";
                      setBundleЧерновик({
                        mode: "external",
                        rootПуть: externalBundle?.rootПуть ?? (bundle?.mode === "external" ? (bundle.rootПуть ?? "") : ""),
                        entryFile: nextEntryFile,
                      });
                      setSelectedFile(externalBundle?.selectedFile ?? nextEntryFile);
                    }}
                  >
                    External
                  </Button>
                </div>
              </label>
              <label classИмя="space-y-1.5 min-w-0">
                <span classИмя="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Root path
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle classИмя="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      The absolute directory on disk where the instructions bundle lives. In managed mode this is set by Paperclip automatically.
                    </TooltipContent>
                  </Tooltip>
                </span>
                {currentMode === "managed" ? (
                  <div classИмя="flex items-center gap-1.5 font-mono text-xs text-muted-foreground pt-1.5">
                    <span classИмя="min-w-0 truncate" title={currentRootПуть || undefined}>{currentRootПуть || "(managed)"}</span>
                    {currentRootПуть && (
                      <КопироватьText text={currentRootПуть} classИмя="shrink-0">
                        <Копировать classИмя="h-3.5 w-3.5" />
                      </КопироватьText>
                    )}
                  </div>
                ) : (
                  <div classИмя="flex items-center gap-1.5">
                    <Input
                      value={currentRootПуть}
                      onChange={(event) => {
                        const nextRootПуть = event.target.value;
                        externalBundleRef.current = {
                          rootПуть: nextRootПуть,
                          entryFile: currentEntryFile,
                          selectedFile: selectedOrEntryFile,
                        };
                        setBundleЧерновик({
                          mode: "external",
                          rootПуть: nextRootПуть,
                          entryFile: currentEntryFile,
                        });
                      }}
                      classИмя="font-mono text-sm"
                      placeholder="/absolute/path/to/agent/prompts"
                    />
                    {currentRootПуть && (
                      <КопироватьText text={currentRootПуть} classИмя="shrink-0">
                        <Копировать classИмя="h-3.5 w-3.5" />
                      </КопироватьText>
                    )}
                  </div>
                )}
              </label>
              <label classИмя="space-y-1.5">
                <span classИмя="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Entry file
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle classИмя="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      The main file the agent reads first when loading instructions. По умолчаниюs to AGENTS.md.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <Input
                  value={currentEntryFile}
                  onChange={(event) => {
                    const nextEntryFile = event.target.value || "AGENTS.md";
                    const nextSelectedFile = selectedOrEntryFile === currentEntryFile
                      ? nextEntryFile
                      : selectedOrEntryFile;
                    if (currentMode === "external") {
                      externalBundleRef.current = {
                        rootПуть: currentRootПуть,
                        entryFile: nextEntryFile,
                        selectedFile: nextSelectedFile,
                      };
                    }
                    if (selectedOrEntryFile === currentEntryFile) setSelectedFile(nextEntryFile);
                    setBundleЧерновик({
                      mode: currentMode,
                      rootПуть: currentRootПуть,
                      entryFile: nextEntryFile,
                    });
                  }}
                  classИмя="font-mono text-sm"
                />
              </label>
            </div>
          </TooltipПровайдер>
        </CollapsibleContent>
      </Collapsible>

      <div
        ref={containerRef}
        classИмя="grid min-w-0 gap-3"
        style={
          instructionsSideBySide
            ? { gridTemplateColumns: `${filePanelWidth}px 0.5rem minmax(0, 1fr)` }
            : undefined
        }
      >
        <div classИмя={cn(
          "min-w-0 w-full border border-border rounded-lg p-3 space-y-3",
          isMobile && showFilePanel && "block",
          isMobile && !showFilePanel && "hidden",
        )}>
          <div classИмя="flex items-center justify-between">
            <h4 classИмя="text-sm font-medium">Файлы</h4>
            <div classИмя="flex items-center gap-1">
              {!showNewFileInput && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  classИмя="h-7 w-7"
                  onClick={() => setShowNewFileInput(true)}
                >
                  +
                </Button>
              )}
              {isMobile && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  classИмя="h-7 w-7"
                  onClick={() => setShowFilePanel(false)}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
          {showNewFileInput && (
            <div classИмя="space-y-2">
              <Input
                value={newFileПуть}
                onChange={(event) => setNewFileПуть(event.target.value)}
                placeholder="TOOLS.md"
                classИмя="font-mono text-sm"
                autoFocus
                onКлючDown={(event) => {
                  if (event.key === "Escape") {
                    setShowNewFileInput(false);
                    setNewFileПуть("");
                  }
                }}
              />
              <div classИмя="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  classИмя="flex-1"
                  disabled={!newFileПуть.trim() || newFileПуть.includes("..")}
                  onClick={() => {
                    const candidate = newFileПуть.trim();
                    if (!candidate || candidate.includes("..")) return;
                    setОжиданиеФайлы((prev) => prev.includes(candidate) ? prev : [...prev, candidate]);
                    setSelectedFile(candidate);
                    setЧерновик("");
                    setNewFileПуть("");
                    setShowNewFileInput(false);
                  }}
                >
                  Создать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  classИмя="flex-1"
                  onClick={() => {
                    setShowNewFileInput(false);
                    setNewFileПуть("");
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
          <FileTree
            nodes={fileTree}
            selectedFile={selectedOrEntryFile}
            expandedDirs={expandedDirs}
            checkedФайлы={new Set()}
            onToggleDir={(dirПуть) => setExpandedDirs((current) => {
              const next = new Set(current);
              if (next.has(dirПуть)) next.delete(dirПуть);
              else next.add(dirПуть);
              return next;
            })}
            onSelectFile={(fileПуть) => {
              setSelectedFile(fileПуть);
              if (!fileOptions.includes(fileПуть)) setЧерновик("");
              if (isMobile) setShowFilePanel(false);
            }}
            onToggleCheck={() => {}}
            showCheckboxes={false}
            wrapЯрлыки
            renderFileExtra={(node) => {
              const file = bundle?.files.find((entry) => entry.path === node.path);
              if (!file) return null;
              if (file.deprecated) {
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span classИмя="ml-3 shrink-0 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide cursor-help">
                        virtual file
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4}>
                      Legacy inline prompt — this deprecated virtual file preserves the old promptTemplate content
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <span classИмя="ml-3 shrink-0 rounded border border-border text-muted-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {file.isEntryFile ? "entry" : `${file.size}b`}
                </span>
              );
            }}
          />
        </div>

        {/* Draggable separator */}
        {instructionsSideBySide && (
          <div
            classИмя="w-1 cursor-col-resize rounded transition-colors hover:bg-border active:bg-primary/50"
            onMouseDown={handleSeparatorDrag}
          />
        )}

        <div classИмя={cn("min-w-0 w-full overflow-hidden border border-border rounded-lg p-4 space-y-3", isMobile && showFilePanel && "hidden")}>
          <div classИмя="flex items-center justify-between gap-3">
            <div classИмя="flex items-center gap-2 min-w-0">
              {isMobile && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  classИмя="h-7 w-7 shrink-0"
                  onClick={() => setShowFilePanel(true)}
                >
                  <ПапкаOpen classИмя="h-3.5 w-3.5" />
                </Button>
              )}
              <div classИмя="min-w-0">
                <h4 classИмя="text-sm font-medium font-mono truncate">{selectedOrEntryFile}</h4>
                <p classИмя="text-xs text-muted-foreground">
                  {selectedFileExists
                    ? selectedFileSummary?.deprecated
                      ? "Deprecated virtual file"
                      : `${selectedFileDetail?.language ?? "text"} file`
                    : "New file in this bundle"}
                </p>
              </div>
            </div>
            <div classИмя="flex items-center gap-2">
              {!fileЗагрузка && (
                <КопироватьText
                  text={displayЗначение}
                  ariaLabel="Копировать instructions file as markdown"
                  title="Копировать as markdown"
                  copiedLabel="Copied"
                  classИмя="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Копировать classИмя="h-3.5 w-3.5" />
                </КопироватьText>
              )}
              {selectedFileExists && !selectedFileSummary?.deprecated && selectedOrEntryFile !== currentEntryFile && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Удалить ${selectedOrEntryFile}?`)) {
                      deleteFile.mutate(selectedOrEntryFile, {
                        onУспешно: () => {
                          setSelectedFile(currentEntryFile);
                          setЧерновик(null);
                        },
                      });
                    }
                  }}
                  disabled={deleteFile.isОжидание}
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>

          {selectedFileExists && fileЗагрузка && !selectedFileDetail ? (
            <PromptИзменитьorSkeleton />
          ) : isMarkdown(selectedOrEntryFile) ? (
            <MarkdownИзменитьor
              key={selectedOrEntryFile}
              value={displayЗначение}
              onChange={(value) => setЧерновик(value ?? "")}
              placeholder="# Агент instructions"
              classИмя="min-w-0 overflow-hidden"
              contentClassИмя="min-h-[420px] max-w-full break-words text-sm font-mono"
              imageЗагрузитьHandler={async (file) => {
                const namespace = `agents/${agent.id}/instructions/${selectedOrEntryFile.replaceВсе("/", "-")}`;
                const asset = await uploadMarkdownImage.mutateAsync({ file, namespace });
                return asset.contentПуть;
              }}
            />
          ) : (
            <textarea
              value={displayЗначение}
              onChange={(event) => setЧерновик(event.target.value)}
              classИмя="min-h-[420px] w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm outline-none"
              placeholder="File contents"
            />
          )}
        </div>
      </div>

    </div>
  );
}

function PromptsTabSkeleton() {
  return (
    <div classИмя="max-w-5xl space-y-4">
      <div classИмя="rounded-lg border border-border p-4 space-y-4">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-2">
            <Skeleton classИмя="h-4 w-40" />
            <Skeleton classИмя="h-4 w-[30rem] max-w-full" />
          </div>
          <Skeleton classИмя="h-4 w-16" />
        </div>
        <div classИмя="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} classИмя="space-y-2">
              <Skeleton classИмя="h-3 w-20" />
              <Skeleton classИмя="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div classИмя="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div classИмя="rounded-lg border border-border p-3 space-y-3">
          <div classИмя="flex items-center justify-between">
            <Skeleton classИмя="h-4 w-12" />
            <Skeleton classИмя="h-8 w-16" />
          </div>
          <Skeleton classИмя="h-10 w-full" />
          <div classИмя="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} classИмя="h-9 w-full rounded-none" />
            ))}
          </div>
        </div>
        <div classИмя="rounded-lg border border-border p-4 space-y-3">
          <div classИмя="space-y-2">
            <Skeleton classИмя="h-4 w-48" />
            <Skeleton classИмя="h-3 w-28" />
          </div>
          <PromptИзменитьorSkeleton />
        </div>
      </div>
    </div>
  );
}

function PromptИзменитьorSkeleton() {
  return (
    <div classИмя="space-y-3">
      <Skeleton classИмя="h-10 w-full" />
      <Skeleton classИмя="h-[420px] w-full" />
    </div>
  );
}

export function АгентНавыкиTab({
  agent,
  companyId,
}: {
  agent: Агент;
  companyId?: string;
}) {
  type НавыкRow = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    detail: string | null;
    locationLabel: string | null;
    originLabel: string | null;
    linkTo: string | null;
    readOnly: boolean;
    adapterEntry: АгентНавыкEntry | null;
  };

  const queryClient = useQueryClient();
  const [skillЧерновик, setНавыкЧерновик] = useState<string[]>([]);
  const [lastСохранитьdНавыки, setLastСохранитьdНавыки] = useState<string[]>([]);
  const [unmanagedOpen, setUnmanagedOpen] = useState(false);
  const lastСохранитьdНавыкиRef = useRef<string[]>([]);
  const hasHydratedНавыкSnapshotRef = useRef(false);
  const skipДалееНавыкАвтоsaveRef = useRef(true);

  const { data: skillSnapshot, isЗагрузка } = useQuery({
    queryКлюч: queryКлючs.agents.skills(agent.id),
    queryFn: () => agentsApi.skills(agent.id, companyId),
    enabled: Boolean(companyId),
  });

  const { data: companyНавыки } = useQuery({
    queryКлюч: queryКлючs.companyНавыки.list(companyId ?? ""),
    queryFn: () => companyНавыкиApi.list(companyId!),
    enabled: Boolean(companyId),
  });

  const syncНавыки = useMutation({
    mutationFn: (desiredНавыки: string[]) => agentsApi.syncНавыки(agent.id, desiredНавыки, companyId),
    onУспешно: async (snapshot) => {
      queryClient.setQueryData(queryКлючs.agents.skills(agent.id), snapshot);
      lastСохранитьdНавыкиRef.current = snapshot.desiredНавыки;
      setLastСохранитьdНавыки(snapshot.desiredНавыки);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.urlКлюч) }),
      ]);
    },
  });

  useEffect(() => {
    setНавыкЧерновик([]);
    setLastСохранитьdНавыки([]);
    lastСохранитьdНавыкиRef.current = [];
    hasHydratedНавыкSnapshotRef.current = false;
    skipДалееНавыкАвтоsaveRef.current = true;
  }, [agent.id]);

  useEffect(() => {
    if (!skillSnapshot) return;
    const nextState = applyАгентНавыкSnapshot(
      {
        draft: skillЧерновик,
        lastСохранитьd: lastСохранитьdНавыкиRef.current,
        hasHydratedSnapshot: hasHydratedНавыкSnapshotRef.current,
      },
      skillSnapshot.desiredНавыки,
    );
    skipДалееНавыкАвтоsaveRef.current = nextState.shouldSkipАвтоsave;
    hasHydratedНавыкSnapshotRef.current = nextState.hasHydratedSnapshot;
    setНавыкЧерновик(nextState.draft);
    lastСохранитьdНавыкиRef.current = nextState.lastСохранитьd;
    setLastСохранитьdНавыки(nextState.lastСохранитьd);
  }, [skillЧерновик, skillSnapshot]);

  useEffect(() => {
    if (!skillSnapshot) return;
    if (skipДалееНавыкАвтоsaveRef.current) {
      skipДалееНавыкАвтоsaveRef.current = false;
      return;
    }
    if (syncНавыки.isОжидание) return;
    if (arraysEqual(skillЧерновик, lastСохранитьdНавыкиRef.current)) return;

    const timeout = window.setTimeout(() => {
      if (!arraysEqual(skillЧерновик, lastСохранитьdНавыкиRef.current)) {
        syncНавыки.mutate(skillЧерновик);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [skillЧерновик, skillSnapshot, syncНавыки.isОжидание, syncНавыки.mutate]);

  const companyНавыкByКлюч = useMemo(
    () => new Map((companyНавыки ?? []).map((skill) => [skill.key, skill])),
    [companyНавыки],
  );
  const companyНавыкКлючs = useMemo(
    () => new Set((companyНавыки ?? []).map((skill) => skill.key)),
    [companyНавыки],
  );
  const adapterEntryByКлюч = useMemo(
    () => new Map((skillSnapshot?.entries ?? []).map((entry) => [entry.key, entry])),
    [skillSnapshot],
  );
  const optionalНавыкRows = useMemo<НавыкRow[]>(
    () =>
      (companyНавыки ?? [])
        .filter((skill) => !adapterEntryByКлюч.get(skill.key)?.required)
        .map((skill) => ({
          id: skill.id,
          key: skill.key,
          name: skill.name,
          description: skill.description,
          detail: adapterEntryByКлюч.get(skill.key)?.detail ?? null,
          locationLabel: adapterEntryByКлюч.get(skill.key)?.locationLabel ?? null,
          originLabel: adapterEntryByКлюч.get(skill.key)?.originLabel ?? null,
          linkTo: `/skills/${skill.id}`,
          readOnly: false,
          adapterEntry: adapterEntryByКлюч.get(skill.key) ?? null,
        })),
    [adapterEntryByКлюч, companyНавыки],
  );
  const requiredНавыкRows = useMemo<НавыкRow[]>(
    () =>
      (skillSnapshot?.entries ?? [])
        .filter((entry) => entry.required)
        .map((entry) => {
          const companyНавык = companyНавыкByКлюч.get(entry.key);
          return {
            id: companyНавык?.id ?? `required:${entry.key}`,
            key: entry.key,
            name: companyНавык?.name ?? entry.key,
            description: companyНавык?.description ?? null,
            detail: entry.detail ?? null,
            locationLabel: entry.locationLabel ?? null,
            originLabel: entry.originLabel ?? null,
            linkTo: companyНавык ? `/skills/${companyНавык.id}` : null,
            readOnly: false,
            adapterEntry: entry,
          };
        }),
    [companyНавыкByКлюч, skillSnapshot],
  );
  const unmanagedНавыкRows = useMemo<НавыкRow[]>(
    () =>
      (skillSnapshot?.entries ?? [])
        .filter((entry) => isReadOnlyUnmanagedНавыкEntry(entry, companyНавыкКлючs))
        .map((entry) => ({
          id: `external:${entry.key}`,
          key: entry.key,
          name: entry.runtimeИмя ?? entry.key,
          description: null,
          detail: entry.detail ?? null,
          locationLabel: entry.locationLabel ?? null,
          originLabel: entry.originLabel ?? null,
          linkTo: null,
          readOnly: true,
          adapterEntry: entry,
        })),
    [companyНавыкКлючs, skillSnapshot],
  );
  const desiredOnlyMissingНавыки = useMemo(
    () => skillЧерновик.filter((key) => !companyНавыкByКлюч.has(key)),
    [companyНавыкByКлюч, skillЧерновик],
  );
  const skillApplicationLabel = useMemo(() => {
    switch (skillSnapshot?.mode) {
      case "persistent":
        return "Kept in the workspace";
      case "ephemeral":
        return "Applied when the agent runs";
      case "unsupported":
        return "Tracked only";
      default:
        return "Неизвестно";
    }
  }, [skillSnapshot?.mode]);
  const unsupportedНавыкMessage = useMemo(() => {
    if (skillSnapshot?.mode !== "unsupported") return null;
    if (
      agent.adapterТип === "acpx_local" &&
      typeof agent.adapterConfig.agent === "string" &&
      agent.adapterConfig.agent === "custom"
    ) {
      return "Paperclip cannot manage skills for custom ACP commands yet.";
    }
    if (agent.adapterТип === "openclaw_gateway") {
      return "Paperclip cannot manage OpenClaw skills here. Visit your OpenClaw instance to manage this agent's skills.";
    }
    return "Paperclip cannot manage skills for this adapter yet. Manage them in the adapter directly.";
  }, [agent.adapterConfig.agent, agent.adapterТип, skillSnapshot?.mode]);
  const hasUnsavedChanges = !arraysEqual(skillЧерновик, lastСохранитьdНавыки);
  const saveСтатусLabel = syncНавыки.isОжидание
    ? "Saving changes..."
    : hasUnsavedChanges
      ? "Saving soon..."
      : null;

  return (
    <div classИмя="max-w-4xl space-y-5">
      <div classИмя="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/skills"
          classИмя="text-sm font-medium text-foreground underline-offset-4 no-underline transition-colors hover:text-foreground/70 hover:underline"
        >
          View company skills library
        </Link>
        {saveСтатусLabel ? (
          <div classИмя="flex items-center gap-2 text-xs text-muted-foreground">
            {syncНавыки.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{saveСтатусLabel}</span>
          </div>
        ) : null}
      </div>

      {skillSnapshot?.warnings.length ? (
        <div classИмя="space-y-1 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
          {skillSnapshot.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      {unsupportedНавыкMessage ? (
        <div classИмя="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
          {unsupportedНавыкMessage}
        </div>
      ) : null}

      {isЗагрузка ? (
        <PageSkeleton variant="list" />
      ) : (
        <>
          {(() => {
            const renderНавыкRow = (skill: НавыкRow) => {
              const adapterEntry = skill.adapterEntry ?? adapterEntryByКлюч.get(skill.key);
              const required = Boolean(adapterEntry?.required);
              const rowClassИмя = cn(
                "flex items-start gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0",
                skill.readOnly ? "bg-muted/20" : "hover:bg-accent/20",
              );
              const body = (
                <div classИмя="min-w-0 flex-1">
                  <div classИмя="flex items-center justify-between gap-3">
                    <div classИмя="min-w-0">
                      <span classИмя="truncate font-medium">{skill.name}</span>
                    </div>
                    {skill.linkTo ? (
                      <Link
                        to={skill.linkTo}
                        classИмя="shrink-0 text-xs text-muted-foreground no-underline hover:text-foreground"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                  {skill.description && (
                    <MarkdownBody classИмя="mt-1 text-xs text-muted-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {skill.description}
                    </MarkdownBody>
                  )}
                  {skill.readOnly && skill.originLabel && (
                    <p classИмя="mt-1 text-xs text-muted-foreground">{skill.originLabel}</p>
                  )}
                  {skill.readOnly && skill.locationLabel && (
                    <p classИмя="mt-1 text-xs text-muted-foreground">Location: {skill.locationLabel}</p>
                  )}
                  {skill.detail && (
                    <p classИмя="mt-1 text-xs text-muted-foreground">{skill.detail}</p>
                  )}
                </div>
              );

              if (skill.readOnly) {
                return (
                  <div key={skill.id} classИмя={rowClassИмя}>
                    <span classИмя="mt-1 h-2 w-2 rounded-full bg-muted-foreground/40" />
                    {body}
                  </div>
                );
              }

              const checked = required || skillЧерновик.includes(skill.key);
              const disabled = required || skillSnapshot?.mode === "unsupported";
              const checkbox = (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? Array.from(new Set([...skillЧерновик, skill.key]))
                      : skillЧерновик.filter((value) => value !== skill.key);
                    setНавыкЧерновик(next);
                  }}
                  classИмя="mt-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                />
              );

              return (
                <label key={skill.id} classИмя={rowClassИмя}>
                  {required && adapterEntry?.requiredReason ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{checkbox}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{adapterEntry.requiredReason}</TooltipContent>
                    </Tooltip>
                  ) : skillSnapshot?.mode === "unsupported" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{checkbox}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {unsupportedНавыкMessage ?? "Manage skills in the adapter directly."}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    checkbox
                  )}
                  {body}
                </label>
              );
            };

            if (optionalНавыкRows.length === 0 && requiredНавыкRows.length === 0 && unmanagedНавыкRows.length === 0) {
              return (
                <section classИмя="border-y border-border">
                  <div classИмя="px-3 py-6 text-sm text-muted-foreground">
                    Импорт skills into the company library first, then attach them here.
                  </div>
                </section>
              );
            }

            return (
              <>
                {optionalНавыкRows.length > 0 && (
                  <section classИмя="border-y border-border">
                    {optionalНавыкRows.map(renderНавыкRow)}
                  </section>
                )}

                {requiredНавыкRows.length > 0 && (
                  <section classИмя="border-y border-border">
                    <div classИмя="border-b border-border bg-muted/40 px-3 py-2">
                      <span classИмя="text-xs font-medium text-muted-foreground">
                        Обязательно by Paperclip
                      </span>
                    </div>
                    {requiredНавыкRows.map(renderНавыкRow)}
                  </section>
                )}

                {unmanagedНавыкRows.length > 0 && (
                  <section classИмя="border-y border-border">
                    <div
                      role="button"
                      tabIndex={0}
                      classИмя="flex cursor-pointer items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 select-none"
                      onClick={() => setUnmanagedOpen((v) => !v)}
                      onКлючDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventПо умолчанию(); setUnmanagedOpen((v) => !v); } }}
                    >
                      <span classИмя="text-xs font-medium text-muted-foreground">
                        ({unmanagedНавыкRows.length}) User-installed skills, not managed by Paperclip
                      </span>
                      {unmanagedOpen ? <ChevronDown classИмя="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight classИмя="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    {unmanagedOpen && unmanagedНавыкRows.map(renderНавыкRow)}
                  </section>
                )}
              </>
            );
          })()}

          {desiredOnlyMissingНавыки.length > 0 && (
            <div classИмя="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
              <div classИмя="font-medium">Requested skills missing from the company library</div>
              <div classИмя="mt-1 text-xs">
                {desiredOnlyMissingНавыки.join(", ")}
              </div>
            </div>
          )}

          <section classИмя="border-t border-border pt-4">
            <div classИмя="grid gap-2 text-sm sm:grid-cols-2">
              <div classИмя="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span classИмя="text-muted-foreground">Адаптер</span>
                <span classИмя="font-medium">{adapterЯрлыки[agent.adapterТип] ?? agent.adapterТип}</span>
              </div>
              <div classИмя="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span classИмя="text-muted-foreground">Навыки applied</span>
                <span>{skillApplicationLabel}</span>
              </div>
              <div classИмя="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span classИмя="text-muted-foreground">Selected skills</span>
                <span>{skillЧерновик.length}</span>
              </div>
            </div>

            {syncНавыки.isОшибка && (
              <p classИмя="mt-3 text-xs text-destructive">
                {syncНавыки.error instanceof Ошибка ? syncНавыки.error.message : "Ошибка to update skills"}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ---- Запуститьs Tab ---- */

function ЗапуститьListItem({ run, isSelected, agentId }: { run: HeartbeatЗапустить; isSelected: boolean; agentId: string }) {
  const statusInfo = runСтатусIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
  const СтатусIcon = statusInfo.icon;
  const metrics = runMetrics(run);
  const summary = run.resultJson
    ? String((run.resultJson as Record<string, unknown>).summary ?? (run.resultJson as Record<string, unknown>).result ?? "")
    : run.error ?? "";

  return (
    <Link
      to={isSelected ? `/agents/${agentId}/runs` : `/agents/${agentId}/runs/${run.id}`}
      classИмя={cn(
        "flex flex-col gap-1 w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 transition-colors no-underline text-inherit",
        isSelected ? "bg-accent/40" : "hover:bg-accent/20",
      )}
    >
      <div classИмя="flex items-center gap-2">
        <СтатусIcon classИмя={cn("h-3.5 w-3.5 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
        <span classИмя="font-mono text-xs text-muted-foreground">
          {run.id.slice(0, 8)}
        </span>
        <span classИмя={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
          run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
            : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
            : "bg-muted text-muted-foreground"
        )}>
          {sourceЯрлыки[run.invocationSource] ?? run.invocationSource}
        </span>
        <span classИмя="ml-auto text-[11px] text-muted-foreground shrink-0">
          {relativeTime(run.createdAt)}
        </span>
      </div>
      {summary && (
        <span classИмя="text-xs text-muted-foreground truncate pl-5.5">
          {summary.slice(0, 60)}
        </span>
      )}
      {(metrics.totalТокенs > 0 || metrics.cost > 0) && (
        <div classИмя="flex items-center gap-2 pl-5.5 text-[11px] text-muted-foreground tabular-nums">
          {metrics.totalТокенs > 0 && <span>{formatТокенs(metrics.totalТокенs)} tok</span>}
          {metrics.cost > 0 && <span>${metrics.cost.toFixed(3)}</span>}
        </div>
      )}
    </Link>
  );
}

function ЗапуститьsTab({
  runs,
  companyId,
  agentId,
  agentRouteId,
  selectedЗапуститьId,
  adapterТип,
  adapterConfig,
}: {
  runs: HeartbeatЗапустить[];
  companyId: string;
  agentId: string;
  agentRouteId: string;
  selectedЗапуститьId: string | null;
  adapterТип: string;
  adapterConfig: Record<string, unknown>;
}) {
  const { isMobile } = useSidebar();

  if (runs.length === 0) {
    return <p classИмя="text-sm text-muted-foreground">Нет runs yet.</p>;
  }

  // Сортировка by created descending
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // On mobile, don't auto-select so the list shows first; on desktop, auto-select latest
  const effectiveЗапуститьId = isMobile ? selectedЗапуститьId : (selectedЗапуститьId ?? sorted[0]?.id ?? null);
  const selectedЗапустить = sorted.find((r) => r.id === effectiveЗапуститьId) ?? null;

  // Mobile: show either run list OR run detail with back button
  if (isMobile) {
    if (selectedЗапустить) {
      return (
        <div classИмя="space-y-3 min-w-0 overflow-x-hidden">
          <Link
            to={`/agents/${agentRouteId}/runs`}
            classИмя="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <ArrowLeft classИмя="h-3.5 w-3.5" />
            Назад to runs
          </Link>
          <ЗапуститьDetail key={selectedЗапустить.id} run={selectedЗапустить} agentRouteId={agentRouteId} adapterТип={adapterТип} adapterConfig={adapterConfig} />
        </div>
      );
    }
    return (
      <div classИмя="border border-border rounded-lg overflow-x-hidden">
        {sorted.map((run) => (
          <ЗапуститьListItem key={run.id} run={run} isSelected={false} agentId={agentRouteId} />
        ))}
      </div>
    );
  }

  // Desktop: side-by-side layout
  return (
    <div classИмя="flex gap-0">
      {/* Left: run list — border stretches full height, content sticks */}
      <div classИмя={cn(
        "shrink-0 border border-border rounded-lg",
        selectedЗапустить ? "w-72" : "w-full",
      )}>
        <div classИмя="sticky top-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        {sorted.map((run) => (
          <ЗапуститьListItem key={run.id} run={run} isSelected={run.id === effectiveЗапуститьId} agentId={agentRouteId} />
        ))}
        </div>
      </div>

      {/* Right: run detail — natural height, page scrolls */}
      {selectedЗапустить && (
        <div classИмя="flex-1 min-w-0 pl-4">
          <ЗапуститьDetail key={selectedЗапустить.id} run={selectedЗапустить} agentRouteId={agentRouteId} adapterТип={adapterТип} adapterConfig={adapterConfig} />
        </div>
      )}
    </div>
  );
}

/* ---- Запустить Detail (expanded) ---- */

function ЗапуститьDetail({ run: initialЗапустить, agentRouteId, adapterТип, adapterConfig }: { run: HeartbeatЗапустить; agentRouteId: string; adapterТип: string; adapterConfig: Record<string, unknown> }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: hydratedЗапустить } = useQuery({
    queryКлюч: queryКлючs.runDetail(initialЗапустить.id),
    queryFn: () => heartbeatsApi.get(initialЗапустить.id),
    enabled: Boolean(initialЗапустить.id),
  });
  const run = hydratedЗапустить ?? initialЗапустить;
  const metrics = runMetrics(run);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [claudeLoginResult, setClaudeLoginResult] = useState<ClaudeLoginResult | null>(null);

  useEffect(() => {
    setClaudeLoginResult(null);
  }, [run.id]);

  const cancelЗапустить = useMutation({
    mutationFn: () => heartbeatsApi.cancel(run.id),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(run.companyId, run.agentId) });
    },
  });
  const canПродолжитьLostЗапустить = run.errorCode === "process_lost" && run.status === "failed";
  const resumePayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      resumeFromЗапуститьId: run.id,
    };
    const context = asRecord(run.contextSnapshot);
    if (!context) return payload;
    const issueId = asНетnEmptyString(context.issueId);
    const taskId = asНетnEmptyString(context.taskId);
    const taskКлюч = asНетnEmptyString(context.taskКлюч);
    const commentId = asНетnEmptyString(context.wakeCommentId) ?? asНетnEmptyString(context.commentId);
    if (issueId) payload.issueId = issueId;
    if (taskId) payload.taskId = taskId;
    if (taskКлюч) payload.taskКлюч = taskКлюч;
    if (commentId) payload.commentId = commentId;
    return payload;
  }, [run.contextSnapshot, run.id]);
  const resumeЗапустить = useMutation({
    mutationFn: async () => {
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "resume_process_lost_run",
        payload: resumePayload,
      }, run.companyId);
      if (!("id" in result)) {
        throw new Ошибка(result.message ?? "Продолжить request was skipped.");
      }
      return result;
    },
    onУспешно: (resumedЗапустить) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(run.companyId, run.agentId) });
      navigate(`/agents/${agentRouteId}/runs/${resumedЗапустить.id}`);
    },
  });

  const canПовторитьЗапустить = run.status === "failed" || run.status === "timed_out";
  const retryPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const context = asRecord(run.contextSnapshot);
    if (!context) return payload;
    const issueId = asНетnEmptyString(context.issueId);
    const taskId = asНетnEmptyString(context.taskId);
    const taskКлюч = asНетnEmptyString(context.taskКлюч);
    if (issueId) payload.issueId = issueId;
    if (taskId) payload.taskId = taskId;
    if (taskКлюч) payload.taskКлюч = taskКлюч;
    return payload;
  }, [run.contextSnapshot]);
  const retryЗапустить = useMutation({
    mutationFn: async () => {
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload: retryPayload,
      }, run.companyId);
      if (!("id" in result)) {
        throw new Ошибка(result.message ?? "Повторить was skipped.");
      }
      return result;
    },
    onУспешно: (newЗапустить) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(run.companyId, run.agentId) });
      navigate(`/agents/${agentRouteId}/runs/${newЗапустить.id}`);
    },
  });

  const { data: touchedЗадачи } = useQuery({
    queryКлюч: queryКлючs.runЗадачи(run.id),
    queryFn: () => activityApi.issuesForЗапустить(run.id),
  });
  const touchedЗадачаIds = useMemo(
    () => Array.from(new Set((touchedЗадачи ?? []).map((issue) => issue.issueId))),
    [touchedЗадачи],
  );

  const clearSessionsForTouchedЗадачи = useMutation({
    mutationFn: async () => {
      if (touchedЗадачаIds.length === 0) return 0;
      await Promise.all(touchedЗадачаIds.map((issueId) => agentsApi.resetSession(run.agentId, issueId, run.companyId)));
      return touchedЗадачаIds.length;
    },
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.runtimeState(run.agentId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.taskSessions(run.agentId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.runЗадачи(run.id) });
    },
  });

  const runClaudeLogin = useMutation({
    mutationFn: () => agentsApi.loginWithClaude(run.agentId, run.companyId),
    onУспешно: (data) => {
      setClaudeLoginResult(data);
    },
  });

  const isВыполняется = run.status === "running" && !!run.startedAt && !run.finishedAt;
  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    if (!run.startedAt) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000));
  });

  useEffect(() => {
    if (!isВыполняется || !run.startedAt) return;
    const startMs = new Date(run.startedAt).getTime();
    setElapsedSec(Math.max(0, Math.round((Date.now() - startMs) / 1000)));
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.round((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [isВыполняется, run.startedAt]);

  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const startTime = run.startedAt ? new Date(run.startedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const endTime = run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString("en-US", timeFormat) : null;
  const durationSec = run.startedAt && run.finishedAt
    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;
  const displayDurationSec = durationSec ?? (isВыполняется ? elapsedSec : null);
  const hasMetrics = metrics.input > 0 || metrics.output > 0 || metrics.cached > 0 || metrics.cost > 0;
  const hasSession = !!(run.sessionIdBefore || run.sessionIdAfter);
  const sessionChanged = run.sessionIdBefore && run.sessionIdAfter && run.sessionIdBefore !== run.sessionIdAfter;
  const sessionId = run.sessionIdAfter || run.sessionIdBefore;
  const hasНетnZeroExit = run.exitCode !== null && run.exitCode !== 0;
  const retryState = describeЗапуститьПовторитьState(run);

  return (
    <div classИмя="space-y-4 min-w-0">
      {/* Запустить summary card */}
      <div classИмя="border border-border rounded-lg overflow-hidden">
        <div classИмя="flex flex-col sm:flex-row">
          {/* Left column: status + timing */}
          <div classИмя="flex-1 p-4 space-y-3">
            <div classИмя="flex items-center gap-2">
              <СтатусBadge status={run.status} />
              {(run.status === "running" || run.status === "queued") && (
                <Button
                  variant="ghost"
                  size="sm"
                  classИмя="text-destructive hover:text-destructive text-xs h-6 px-2"
                  onClick={() => cancelЗапустить.mutate()}
                  disabled={cancelЗапустить.isОжидание}
                >
                  {cancelЗапустить.isОжидание ? "Отменаling…" : "Отмена"}
                </Button>
              )}
              {canПродолжитьLostЗапустить && (
                <Button
                  variant="ghost"
                  size="sm"
                  classИмя="text-xs h-6 px-2"
                  onClick={() => resumeЗапустить.mutate()}
                  disabled={resumeЗапустить.isОжидание}
                >
                  <RotateCcw classИмя="h-3.5 w-3.5 mr-1" />
                  {resumeЗапустить.isОжидание ? "Resuming…" : "Продолжить"}
                </Button>
              )}
              {canПовторитьЗапустить && !canПродолжитьLostЗапустить && (
                <Button
                  variant="ghost"
                  size="sm"
                  classИмя="text-xs h-6 px-2"
                  onClick={() => retryЗапустить.mutate()}
                  disabled={retryЗапустить.isОжидание}
                >
                  <RotateCcw classИмя="h-3.5 w-3.5 mr-1" />
                  {retryЗапустить.isОжидание ? "Повторитьing…" : "Повторить"}
                </Button>
              )}
            </div>
            {/* Адаптер type · provider · model */}
            {(() => {
              const displayПровайдер = metrics.provider
                ?? asНетnEmptyString(adapterConfig?.provider);
              const displayМодель = metrics.model
                ?? asНетnEmptyString(adapterConfig?.model);
              if (!adapterТип && !displayПровайдер && !displayМодель) return null;
              return (
                <div classИмя="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                  {adapterТип && (
                    <span classИмя="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">{adapterТип.replace(/_/g, " ")}</span>
                  )}
                  {displayПровайдер && displayМодель && (
                    <span>{displayПровайдер}/{displayМодель}</span>
                  )}
                  {!displayПровайдер && displayМодель && (
                    <span>{displayМодель}</span>
                  )}
                </div>
              );
            })()}
            {resumeЗапустить.isОшибка && (
              <div classИмя="text-xs text-destructive">
                {resumeЗапустить.error instanceof Ошибка ? resumeЗапустить.error.message : "Ошибка to resume run"}
              </div>
            )}
            {retryЗапустить.isОшибка && (
              <div classИмя="text-xs text-destructive">
                {retryЗапустить.error instanceof Ошибка ? retryЗапустить.error.message : "Ошибка to retry run"}
              </div>
            )}
            {startTime && (
              <div classИмя="space-y-0.5">
                <div classИмя="text-sm font-mono">
                  {startTime}
                  {endTime && <span classИмя="text-muted-foreground"> &rarr; </span>}
                  {endTime}
                </div>
                <div classИмя="text-[11px] text-muted-foreground">
                  {relativeTime(run.startedAt!)}
                  {run.finishedAt && <> &rarr; {relativeTime(run.finishedAt)}</>}
                </div>
                {displayDurationSec !== null && (
                  <div classИмя="text-xs text-muted-foreground">
                    Duration: {displayDurationSec >= 60 ? `${Math.floor(displayDurationSec / 60)}m ${displayDurationSec % 60}s` : `${displayDurationSec}s`}
                  </div>
                )}
              </div>
            )}
            {run.error && (
              <div classИмя="text-xs">
                <span classИмя="text-red-600 dark:text-red-400">{run.error}</span>
                {run.errorCode && <span classИмя="text-muted-foreground ml-1">({run.errorCode})</span>}
              </div>
            )}
            {run.errorCode === "claude_auth_required" && adapterТип === "claude_local" && (
              <div classИмя="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  classИмя="h-7 px-2 text-xs"
                  onClick={() => runClaudeLogin.mutate()}
                  disabled={runClaudeLogin.isОжидание}
                >
                  {runClaudeLogin.isОжидание ? "Выполняется claude login..." : "Login to Claude Code"}
                </Button>
                {runClaudeLogin.isОшибка && (
                  <p classИмя="text-xs text-destructive">
                    {runClaudeLogin.error instanceof Ошибка
                      ? runClaudeLogin.error.message
                      : "Ошибка to run Claude login"}
                  </p>
                )}
                {claudeLoginResult?.loginUrl && (
                  <p classИмя="text-xs">
                    Login URL:
                    <a
                      href={claudeLoginResult.loginUrl}
                      classИмя="text-blue-600 underline underline-offset-2 ml-1 break-all dark:text-blue-400"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {claudeLoginResult.loginUrl}
                    </a>
                  </p>
                )}
                {claudeLoginResult && (
                  <>
                    {!!claudeLoginResult.stdout && (
                      <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                        {claudeLoginResult.stdout}
                      </pre>
                    )}
                    {!!claudeLoginResult.stderr && (
                      <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap">
                        {claudeLoginResult.stderr}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
            {hasНетnZeroExit && (
              <div classИмя="text-xs text-red-600 dark:text-red-400">
                Exit code {run.exitCode}
                {run.signal && <span classИмя="text-muted-foreground ml-1">(signal: {run.signal})</span>}
              </div>
            )}
            {retryState && (
              <div classИмя="rounded-md border border-border/70 bg-accent/20 px-3 py-2 text-xs leading-5">
                <div classИмя="flex flex-wrap items-center gap-2">
                  <span
                    classИмя={cn(
                      "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                      retryState.tone,
                    )}
                  >
                    {retryState.badgeLabel}
                  </span>
                  {retryState.retryOfЗапуститьId ? (
                    <Link
                      to={`/agents/${agentRouteId}/runs/${retryState.retryOfЗапуститьId}`}
                      classИмя="font-mono text-foreground hover:underline"
                    >
                      {retryState.retryOfЗапуститьId.slice(0, 8)}
                    </Link>
                  ) : null}
                </div>
                {retryState.detail ? <p classИмя="mt-2 text-muted-foreground">{retryState.detail}</p> : null}
                {retryState.secondary ? <p classИмя="text-muted-foreground">{retryState.secondary}</p> : null}
              </div>
            )}
          </div>

          {/* Right column: metrics */}
          {hasMetrics && (
            <div classИмя="border-t sm:border-t-0 sm:border-l border-border p-4 grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 content-center tabular-nums">
              <div>
                <div classИмя="text-xs text-muted-foreground">Input</div>
                <div classИмя="text-sm font-medium font-mono">{formatТокенs(metrics.input)}</div>
              </div>
              <div>
                <div classИмя="text-xs text-muted-foreground">Output</div>
                <div classИмя="text-sm font-medium font-mono">{formatТокенs(metrics.output)}</div>
              </div>
              <div>
                <div classИмя="text-xs text-muted-foreground">Cached</div>
                <div classИмя="text-sm font-medium font-mono">{formatТокенs(metrics.cached)}</div>
              </div>
              <div>
                <div classИмя="text-xs text-muted-foreground">Cost</div>
                <div classИмя="text-sm font-medium font-mono">{metrics.cost > 0 ? `$${metrics.cost.toFixed(4)}` : "-"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible session row */}
        {hasSession && (
          <div classИмя="border-t border-border">
            <button
              classИмя="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSessionOpen((v) => !v)}
            >
              <ChevronRight classИмя={cn("h-3 w-3 transition-transform", sessionOpen && "rotate-90")} />
              Session
              {sessionChanged && <span classИмя="text-yellow-400 ml-1">(changed)</span>}
            </button>
            {sessionOpen && (
              <div classИмя="px-4 pb-3 space-y-1 text-xs">
                {run.sessionIdBefore && (
                  <div classИмя="flex items-center gap-2">
                    <span classИмя="text-muted-foreground w-12">{sessionChanged ? "Before" : "ID"}</span>
                    <КопироватьText text={run.sessionIdBefore} classИмя="font-mono" />
                  </div>
                )}
                {sessionChanged && run.sessionIdAfter && (
                  <div classИмя="flex items-center gap-2">
                    <span classИмя="text-muted-foreground w-12">After</span>
                    <КопироватьText text={run.sessionIdAfter} classИмя="font-mono" />
                  </div>
                )}
                {touchedЗадачаIds.length > 0 && (
                  <div classИмя="pt-1">
                    <button
                      type="button"
                      classИмя="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
                      disabled={clearSessionsForTouchedЗадачи.isОжидание}
                      onClick={() => {
                        const issueCount = touchedЗадачаIds.length;
                        const confirmed = window.confirm(
                          `Очистить session for ${issueCount} issue${issueCount === 1 ? "" : "s"} touched by this run?`,
                        );
                        if (!confirmed) return;
                        clearSessionsForTouchedЗадачи.mutate();
                      }}
                    >
                      {clearSessionsForTouchedЗадачи.isОжидание
                        ? "clearing session..."
                        : "clear session for these issues"}
                    </button>
                    {clearSessionsForTouchedЗадачи.isОшибка && (
                      <p classИмя="text-[11px] text-destructive mt-1">
                        {clearSessionsForTouchedЗадачи.error instanceof Ошибка
                          ? clearSessionsForTouchedЗадачи.error.message
                          : "Ошибка to clear sessions"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Задачи touched by this run */}
      {touchedЗадачи && touchedЗадачи.length > 0 && (
        <div classИмя="space-y-2">
          <span classИмя="text-xs font-medium text-muted-foreground">Задачи Touched ({touchedЗадачи.length})</span>
          <div classИмя="border border-border rounded-lg divide-y divide-border">
            {touchedЗадачи.map((issue) => (
              <Link
                key={issue.issueId}
                to={`/issues/${issue.identifier ?? issue.issueId}`}
                classИмя="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent/20 transition-colors text-left no-underline text-inherit"
              >
                <div classИмя="flex items-center gap-2 min-w-0">
                  <СтатусBadge status={issue.status} />
                  <span classИмя="truncate">{issue.title}</span>
                </div>
                <span classИмя="font-mono text-muted-foreground shrink-0 ml-2">{issue.identifier ?? issue.issueId.slice(0, 8)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* stderr excerpt for failed runs */}
      {run.stderrExcerpt && (
        <div classИмя="space-y-1">
          <span classИмя="text-xs font-medium text-red-600 dark:text-red-400">stderr</span>
          <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap">{run.stderrExcerpt}</pre>
        </div>
      )}

      {/* stdout excerpt when no log is available */}
      {run.stdoutExcerpt && !run.logRef && (
        <div classИмя="space-y-1">
          <span classИмя="text-xs font-medium text-muted-foreground">stdout</span>
          <pre classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{run.stdoutExcerpt}</pre>
        </div>
      )}

      {/* Log viewer */}
      <LogViewer run={run} adapterТип={adapterТип} />
      <ScrollToБотtom />
    </div>
  );
}

/* ---- Log Viewer ---- */

function LogViewer({ run, adapterТип }: { run: HeartbeatЗапустить; adapterТип: string }) {
  const [events, setEvents] = useState<HeartbeatЗапуститьEvent[]>([]);
  const [logLines, setLogLines] = useState<Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }>>([]);
  const [loading, setЗагрузка] = useState(true);
  const [logЗагрузка, setLogЗагрузка] = useState(!!run.logRef);
  const [logОшибка, setLogОшибка] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const [hasMoreLog, setHasMoreLog] = useState(false);
  const [loadingMoreLog, setЗагрузкаMoreLog] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isStreamingConnected, setIsStreamingConnected] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("nice");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pendingLogLineRef = useRef("");
  const scrollContainerRef = useRef<ScrollContainer | null>(null);
  const isFollowingRef = useRef(false);
  const lastMetricsRef = useRef<{ scrollHeight: number; distanceFromБотtom: number }>({
    scrollHeight: 0,
    distanceFromБотtom: Number.POSITIVE_INFINITY,
  });
  const isLive = run.status === "running" || run.status === "queued";
  const { data: workspaceOperations = [] } = useQuery({
    queryКлюч: queryКлючs.runРабочая областьOperations(run.id),
    queryFn: () => heartbeatsApi.workspaceOperations(run.id),
    refetchInterval: isLive ? 2000 : false,
  });

  function isЗапуститьLogUnavailable(err: unknown): boolean {
    return err instanceof ApiОшибка && err.status === 404;
  }

  function appendLogContent(content: string, finalize = false) {
    if (!content && !finalize) return;
    const combined = `${pendingLogLineRef.current}${content}`;
    const split = combined.split("\n");
    pendingLogLineRef.current = split.pop() ?? "";
    if (finalize && pendingLogLineRef.current) {
      split.push(pendingLogLineRef.current);
      pendingLogLineRef.current = "";
    }

    const parsed: Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }> = [];
    for (const line of split) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
        const stream =
          raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
        const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
        const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
        if (!chunk) continue;
        parsed.push({ ts, stream, chunk });
      } catch {
        // ignore malformed lines
      }
    }

    if (parsed.length > 0) {
      setLogLines((prev) => [...prev, ...parsed]);
    }
  }

  // Fetch events
  const { data: initialEvents } = useQuery({
    queryКлюч: ["run-events", run.id],
    queryFn: () => heartbeatsApi.events(run.id, 0, 200),
  });

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setЗагрузка(false);
    }
  }, [initialEvents]);

  const getScrollContainer = useCallback((): ScrollContainer => {
    if (scrollContainerRef.current) return scrollContainerRef.current;
    const container = findScrollContainer(logEndRef.current);
    scrollContainerRef.current = container;
    return container;
  }, []);

  const updateFollowingState = useCallback(() => {
    const container = getScrollContainer();
    const metrics = readScrollMetrics(container);
    lastMetricsRef.current = metrics;
    const nearБотtom = metrics.distanceFromБотtom <= LIVE_SCROLL_BOTTOM_TOLERANCE_PX;
    isFollowingRef.current = nearБотtom;
    setIsFollowing((prev) => (prev === nearБотtom ? prev : nearБотtom));
  }, [getScrollContainer]);

  useEffect(() => {
    scrollContainerRef.current = null;
    lastMetricsRef.current = {
      scrollHeight: 0,
      distanceFromБотtom: Number.POSITIVE_INFINITY,
    };

    if (!isLive) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      return;
    }

    updateFollowingState();
  }, [isLive, run.id, updateFollowingState]);

  useEffect(() => {
    if (!isLive) return;
    const container = getScrollContainer();
    updateFollowingState();

    if (container === window) {
      window.addEventListener("scroll", updateFollowingState, { passive: true });
    } else {
      container.addEventListener("scroll", updateFollowingState, { passive: true });
    }
    window.addEventListener("resize", updateFollowingState);
    return () => {
      if (container === window) {
        window.removeEventListener("scroll", updateFollowingState);
      } else {
        container.removeEventListener("scroll", updateFollowingState);
      }
      window.removeEventListener("resize", updateFollowingState);
    };
  }, [isLive, run.id, getScrollContainer, updateFollowingState]);

  // Авто-scroll only for live runs when following
  useEffect(() => {
    if (!isLive || !isFollowingRef.current) return;

    const container = getScrollContainer();
    const previous = lastMetricsRef.current;
    const current = readScrollMetrics(container);
    const growth = Math.max(0, current.scrollHeight - previous.scrollHeight);
    const expectedDistance = previous.distanceFromБотtom + growth;
    const movedAwayBy = current.distanceFromБотtom - expectedDistance;

    // If user moved away from bottom between updates, release auto-follow immediately.
    if (movedAwayBy > LIVE_SCROLL_BOTTOM_TOLERANCE_PX) {
      isFollowingRef.current = false;
      setIsFollowing(false);
      lastMetricsRef.current = current;
      return;
    }

    scrollToContainerБотtom(container, "auto");
    const after = readScrollMetrics(container);
    lastMetricsRef.current = after;
    if (!isFollowingRef.current) {
      isFollowingRef.current = true;
    }
    setIsFollowing((prev) => (prev ? prev : true));
  }, [events.length, logLines.length, isLive, getScrollContainer]);

  // Fetch persisted shell log
  useEffect(() => {
    let cancelled = false;
    pendingLogLineRef.current = "";
    setLogLines([]);
    setLogOffset(0);
    setHasMoreLog(false);
    setЗагрузкаMoreLog(false);
    setLogОшибка(null);

    if (!run.logRef && !isLive) {
      setLogЗагрузка(false);
      return () => {
        cancelled = true;
      };
    }

    setLogЗагрузка(true);
    const load = async () => {
      try {
        const result = await heartbeatsApi.log(run.id, 0, RUN_LOG_PAGE_BYTES);
        if (cancelled) return;
        appendLogContent(result.content, result.nextOffset === undefined);
        const next = result.nextOffset ?? result.content.length;
        setLogOffset(next);
        setHasMoreLog(!isLive && result.nextOffset !== undefined);
      } catch (err) {
        if (!cancelled) {
          if (isLive && isЗапуститьLogUnavailable(err)) {
            setLogЗагрузка(false);
            return;
          }
          setLogОшибка(err instanceof Ошибка ? err.message : "Ошибка to load run log");
        }
      } finally {
        if (!cancelled) setLogЗагрузка(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [run.id, run.logRef, run.logBytes, isLive]);

  async function loadMorePersistedLog() {
    if (loadingMoreLog || !hasMoreLog) return;
    setЗагрузкаMoreLog(true);
    setLogОшибка(null);
    try {
      const result = await heartbeatsApi.log(run.id, logOffset, RUN_LOG_PAGE_BYTES);
      appendLogContent(result.content, result.nextOffset === undefined);
      const next = result.nextOffset ?? logOffset + result.content.length;
      setLogOffset(next);
      setHasMoreLog(result.nextOffset !== undefined);
    } catch (err) {
      setLogОшибка(err instanceof Ошибка ? err.message : "Ошибка to load more run log");
    } finally {
      setЗагрузкаMoreLog(false);
    }
  }

  // Poll for live updates
  useEffect(() => {
    if (!isLive || isStreamingConnected) return;
    const interval = setInterval(async () => {
      const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
      try {
        const newEvents = await heartbeatsApi.events(run.id, maxSeq, 100);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, isStreamingConnected, events]);

  // Poll shell log for running runs
  useEffect(() => {
    if (!isLive || isStreamingConnected) return;
    const interval = setInterval(async () => {
      try {
        const result = await heartbeatsApi.log(run.id, logOffset, 256_000);
        if (result.content) {
          appendLogContent(result.content, result.nextOffset === undefined);
        }
        if (result.nextOffset !== undefined) {
          setLogOffset(result.nextOffset);
        } else if (result.content.length > 0) {
          setLogOffset((prev) => prev + result.content.length);
        }
      } catch (err) {
        if (isЗапуститьLogUnavailable(err)) return;
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, isStreamingConnected, logOffset]);

  // Stream live updates from websocket (primary path for running runs).
  useEffect(() => {
    if (!isLive) return;

    let closed = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectTimer = window.setTimeout(connect, 1500);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(run.companyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        setIsStreamingConnected(true);
      };

      socket.onmessage = (message) => {
        const rawMessage = typeof message.data === "string" ? message.data : "";
        if (!rawMessage) return;

        let event: LiveEvent;
        try {
          event = JSON.parse(rawMessage) as LiveEvent;
        } catch {
          return;
        }

        if (event.companyId !== run.companyId) return;
        const payload = asRecord(event.payload);
        const eventЗапуститьId = asНетnEmptyString(payload?.runId);
        if (!payload || eventЗапуститьId !== run.id) return;

        if (event.type === "heartbeat.run.log") {
          const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
          if (!chunk) return;
          const streamRaw = asНетnEmptyString(payload.stream);
          const stream = streamRaw === "stderr" || streamRaw === "system" ? streamRaw : "stdout";
          const ts = asНетnEmptyString((payload as Record<string, unknown>).ts) ?? event.createdAt;
          setLogLines((prev) => [...prev, { ts, stream, chunk }]);
          return;
        }

        if (event.type !== "heartbeat.run.event") return;

        const seq = typeof payload.seq === "number" ? payload.seq : null;
        if (seq === null || !Number.isFinite(seq)) return;

        const streamRaw = asНетnEmptyString(payload.stream);
        const stream =
          streamRaw === "stdout" || streamRaw === "stderr" || streamRaw === "system"
            ? streamRaw
            : null;
        const levelRaw = asНетnEmptyString(payload.level);
        const level =
          levelRaw === "info" || levelRaw === "warn" || levelRaw === "error"
            ? levelRaw
            : null;

        const liveEvent: HeartbeatЗапуститьEvent = {
          id: seq,
          companyId: run.companyId,
          runId: run.id,
          agentId: run.agentId,
          seq,
          eventТип: asНетnEmptyString(payload.eventТип) ?? "event",
          stream,
          level,
          color: asНетnEmptyString(payload.color),
          message: asНетnEmptyString(payload.message),
          payload: asRecord(payload.payload),
          createdAt: new Date(event.createdAt),
        };

        setEvents((prev) => {
          if (prev.some((existing) => existing.seq === seq)) return prev;
          return [...prev, liveEvent];
        });
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        setIsStreamingConnected(false);
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      setIsStreamingConnected(false);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "run_detail_unmount");
      }
    };
  }, [isLive, run.companyId, run.id, run.agentId]);

  const censorUsernameInLogs = useQuery({
    queryКлюч: queryКлючs.instance.generalНастройки,
    queryFn: () => instanceНастройкиApi.getОбщие(),
  }).data?.censorUsernameInLogs === true;

  const adapterInvokePayload = useMemo(() => {
    const evt = events.find((e) => e.eventТип === "adapter.invoke");
    return redactПутьЗначение(asRecord(evt?.payload ?? null), censorUsernameInLogs);
  }, [censorUsernameInLogs, events]);

  // NOTE: adapter is NOT memoized because external adapters replace their
  // parseStdoutLine asynchronously after dynamic parser loading. Memoizing
  // on adapterТип alone would stale the transcript with the fallback parser.
  // We subscribe to adapter registry changes to force transcript recomputation.
  const [parserTick, setParserTick] = useState(0);
  const adapter = getUIАдаптер(adapterТип);

  useEffect(() => {
    return onАдаптерChange(() => setParserTick((t) => t + 1));
  }, []);

  const transcript = useMemo(
    () => buildTranscript(logLines, adapter, { censorUsernameInLogs }),
    [adapter, censorUsernameInLogs, logLines, parserTick],
  );

  useEffect(() => {
    setTranscriptMode("nice");
  }, [run.id]);

  if (loading && logЗагрузка) {
    return <p classИмя="text-xs text-muted-foreground">Загрузка run logs...</p>;
  }

  if (events.length === 0 && logLines.length === 0 && !logОшибка) {
    return <p classИмя="text-xs text-muted-foreground">Нет log events.</p>;
  }

  const levelColors: Record<string, string> = {
    info: "text-foreground",
    warn: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  };

  const streamColors: Record<string, string> = {
    stdout: "text-foreground",
    stderr: "text-red-600 dark:text-red-300",
    system: "text-blue-600 dark:text-blue-300",
  };

  return (
    <div classИмя="space-y-3">
      <Рабочая областьOperationsSection
        operations={workspaceOperations}
        censorUsernameInLogs={censorUsernameInLogs}
      />
      {adapterInvokePayload && (
        <ЗапуститьInvocationCard payload={adapterInvokePayload} censorUsernameInLogs={censorUsernameInLogs} />
      )}

      <div classИмя="flex items-center justify-between">
        <span classИмя="text-xs font-medium text-muted-foreground">
          Transcript ({transcript.length})
        </span>
        <div classИмя="flex items-center gap-2">
          <div classИмя="inline-flex rounded-lg border border-border/70 bg-background/70 p-0.5">
            {(["nice", "raw"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                classИмя={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  transcriptMode === mode
                    ? "bg-accent text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTranscriptMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          {isLive && !isFollowing && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                const container = getScrollContainer();
                isFollowingRef.current = true;
                setIsFollowing(true);
                scrollToContainerБотtom(container, "auto");
                lastMetricsRef.current = readScrollMetrics(container);
              }}
            >
              Jump to live
            </Button>
          )}
          {isLive && (
            <span classИмя="flex items-center gap-1 text-xs text-cyan-400">
              <span classИмя="relative flex h-2 w-2">
                <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              Live
            </span>
          )}
        </div>
      </div>
      <div classИмя="max-h-[38rem] overflow-y-auto rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-4">
        <ЗапуститьTranscriptView
          entries={transcript}
          mode={transcriptMode}
          streaming={isLive}
          emptyMessage={run.logRef ? "Waiting for transcript..." : "Нет persisted transcript for this run."}
        />
        {hasMoreLog && (
          <div classИмя="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={loadMorePersistedLog}
              disabled={loadingMoreLog}
            >
              {loadingMoreLog ? "Загрузка..." : "Load more log"}
            </Button>
            <span classИмя="text-xs text-muted-foreground">
              Showing the first {Math.round(logOffset / 1024).toLocaleString("en-US")} KB
              {typeof run.logBytes === "number" && run.logBytes > 0
                ? ` of ${Math.round(run.logBytes / 1024).toLocaleString("en-US")} KB`
                : ""}
            </span>
          </div>
        )}
        {logОшибка && (
          <div classИмя="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {logОшибка}
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {(run.status === "failed" || run.status === "timed_out") && (
        <div classИмя="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
          <div classИмя="text-xs font-medium text-red-700 dark:text-red-300">Failure details</div>
          {run.error && (
            <div classИмя="text-xs text-red-600 dark:text-red-200">
              <span classИмя="text-red-700 dark:text-red-300">Ошибка: </span>
              {redactПутьText(run.error, censorUsernameInLogs)}
            </div>
          )}
          {run.stderrExcerpt && run.stderrExcerpt.trim() && (
            <div>
              <div classИмя="text-xs text-red-700 dark:text-red-300 mb-1">stderr excerpt</div>
              <pre classИмя="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">
                {redactПутьText(run.stderrExcerpt, censorUsernameInLogs)}
              </pre>
            </div>
          )}
          {run.resultJson && (
            <div>
              <div classИмя="text-xs text-red-700 dark:text-red-300 mb-1">adapter result JSON</div>
              <pre classИмя="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">
                {JSON.stringify(redactПутьЗначение(run.resultJson, censorUsernameInLogs), null, 2)}
              </pre>
            </div>
          )}
          {run.stdoutExcerpt && run.stdoutExcerpt.trim() && !run.resultJson && (
            <div>
              <div classИмя="text-xs text-red-700 dark:text-red-300 mb-1">stdout excerpt</div>
              <pre classИмя="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">
                {redactПутьText(run.stdoutExcerpt, censorUsernameInLogs)}
              </pre>
            </div>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div>
          <div classИмя="mb-2 text-xs font-medium text-muted-foreground">Events ({events.length})</div>
          <div classИмя="bg-neutral-100 dark:bg-neutral-950 rounded-lg p-3 font-mono text-xs space-y-0.5">
            {events.map((evt) => {
              const color = evt.color
                ?? (evt.level ? levelColors[evt.level] : null)
                ?? (evt.stream ? streamColors[evt.stream] : null)
                ?? "text-foreground";

              return (
                <div key={evt.id} classИмя="flex gap-2">
                  <span classИмя="text-neutral-400 dark:text-neutral-600 shrink-0 select-none w-16">
                    {new Date(evt.createdAt).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span classИмя={cn("shrink-0 w-14", evt.stream ? (streamColors[evt.stream] ?? "text-neutral-500") : "text-neutral-500")}>
                    {evt.stream ? `[${evt.stream}]` : ""}
                  </span>
                  <span classИмя={cn("break-all", color)}>
                    {evt.message
                      ? redactПутьText(evt.message, censorUsernameInLogs)
                      : evt.payload
                        ? JSON.stringify(redactПутьЗначение(evt.payload, censorUsernameInLogs))
                        : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Ключs Tab ---- */

function КлючsTab({ agentId, companyId }: { agentId: string; companyId?: string }) {
  const queryClient = useQueryClient();
  const [newКлючИмя, setNewКлючИмя] = useState("");
  const [newТокен, setNewТокен] = useState<string | null>(null);
  const [tokenVisible, setТокенVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keys, isЗагрузка } = useQuery({
    queryКлюч: queryКлючs.agents.keys(agentId),
    queryFn: () => agentsApi.listКлючs(agentId, companyId),
  });

  const createКлюч = useMutation({
    mutationFn: () => agentsApi.createКлюч(agentId, newКлючИмя.trim() || "По умолчанию", companyId),
    onУспешно: (data) => {
      setNewТокен(data.token);
      setТокенVisible(true);
      setNewКлючИмя("");
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.keys(agentId) });
    },
  });

  const revokeКлюч = useMutation({
    mutationFn: (keyId: string) => agentsApi.revokeКлюч(agentId, keyId, companyId),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.keys(agentId) });
    },
  });

  function copyТокен() {
    if (!newТокен) return;
    navigator.clipboard.writeText(newТокен);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeКлючs = (keys ?? []).filter((k: АгентКлюч) => !k.revokedAt);
  const revokedКлючs = (keys ?? []).filter((k: АгентКлюч) => k.revokedAt);

  return (
    <div classИмя="space-y-6">
      {/* New token banner */}
      {newТокен && (
        <div classИмя="border border-yellow-300 dark:border-yellow-600/40 bg-yellow-50 dark:bg-yellow-500/5 rounded-lg p-4 space-y-2">
          <p classИмя="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            API key created — copy it now, it will not be shown again.
          </p>
          <div classИмя="flex items-center gap-2">
            <code classИмя="flex-1 bg-neutral-100 dark:bg-neutral-950 rounded px-3 py-1.5 text-xs font-mono text-green-700 dark:text-green-300 truncate">
              {tokenVisible ? newТокен : newТокен.replace(/./g, "•")}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setТокенVisible((v) => !v)}
              title={tokenVisible ? "Hide" : "Show"}
            >
              {tokenVisible ? <EyeOff classИмя="h-3.5 w-3.5" /> : <Eye classИмя="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyТокен}
              title="Копировать"
            >
              <Копировать classИмя="h-3.5 w-3.5" />
            </Button>
            {copied && <span classИмя="text-xs text-green-400">Copied!</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            classИмя="text-muted-foreground text-xs"
            onClick={() => setNewТокен(null)}
          >
            Закрыть
          </Button>
        </div>
      )}

      {/* Создать new key */}
      <div classИмя="border border-border rounded-lg p-4 space-y-3">
        <h3 classИмя="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Ключ classИмя="h-3.5 w-3.5" />
          Создать API Ключ
        </h3>
        <p classИмя="text-xs text-muted-foreground">
          API keys allow this agent to authenticate calls to the Paperclip server.
        </p>
        <div classИмя="flex items-center gap-2">
          <Input
            placeholder="Ключ name (e.g. production)"
            value={newКлючИмя}
            onChange={(e) => setNewКлючИмя(e.target.value)}
            classИмя="h-8 text-sm"
            onКлючDown={(e) => {
              if (e.key === "Enter") createКлюч.mutate();
            }}
          />
          <Button
            size="sm"
            onClick={() => createКлюч.mutate()}
            disabled={createКлюч.isОжидание}
          >
            <Plus classИмя="h-3.5 w-3.5 mr-1" />
            Создать
          </Button>
        </div>
      </div>

      {/* Активен keys */}
      {isЗагрузка && <p classИмя="text-sm text-muted-foreground">Загрузка keys...</p>}

      {!isЗагрузка && activeКлючs.length === 0 && !newТокен && (
        <p classИмя="text-sm text-muted-foreground">Нет active API keys.</p>
      )}

      {activeКлючs.length > 0 && (
        <div>
          <h3 classИмя="text-xs font-medium text-muted-foreground mb-2">
            Активен Ключs
          </h3>
          <div classИмя="border border-border rounded-lg divide-y divide-border">
            {activeКлючs.map((key: АгентКлюч) => (
              <div key={key.id} classИмя="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span classИмя="text-sm font-medium">{key.name}</span>
                  <span classИмя="text-xs text-muted-foreground ml-3">
                    Создано {formatDate(key.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  classИмя="text-destructive hover:text-destructive text-xs"
                  onClick={() => revokeКлюч.mutate(key.id)}
                  disabled={revokeКлюч.isОжидание}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked keys */}
      {revokedКлючs.length > 0 && (
        <div>
          <h3 classИмя="text-xs font-medium text-muted-foreground mb-2">
            Revoked Ключs
          </h3>
          <div classИмя="border border-border rounded-lg divide-y divide-border opacity-50">
            {revokedКлючs.map((key: АгентКлюч) => (
              <div key={key.id} classИмя="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span classИмя="text-sm line-through">{key.name}</span>
                  <span classИмя="text-xs text-muted-foreground ml-3">
                    Revoked {key.revokedAt ? formatDate(key.revokedAt) : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
