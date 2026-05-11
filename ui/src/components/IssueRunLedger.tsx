import { useMemo, useState, type ReactНетde } from "react";
import type { АктивностьEvent, Задача, Агент } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { accessApi, type CurrentСоветДоступ } from "../api/access";
import { activityApi, type ЗапуститьForЗадача, type ЗапуститьLivenessState } from "../api/activity";
import { ApiОшибка } from "../api/client";
import {
  heartbeatsApi,
  type АктивенЗапуститьForЗадача,
  type LiveЗапуститьForЗадача,
  type WatchdogDecisionInput,
} from "../api/heartbeats";
import { useToastActions } from "../context/ToastContext";
import { cn, relativeTime } from "../lib/utils";
import { queryКлючs } from "../lib/queryКлючs";
import { keepPreviousDataForSameQueryTail } from "../lib/query-placeholder-data";
import { describeЗапуститьПовторитьState } from "../lib/runПовторитьState";

type ЗадачаЗапуститьLedgerProps = {
  issueId: string;
  companyId: string;
  issueСтатус: Задача["status"];
  childЗадачи: Задача[];
  agentMap: ReadonlyMap<string, Агент>;
  hasLiveЗапуститьs: boolean;
  activityEvents?: АктивностьEvent[];
  renderАктивностьEvent?: (event: АктивностьEvent) => ReactНетde;
};

type ЗадачаЗапуститьLedgerContentProps = {
  runs: ЗапуститьForЗадача[];
  liveЗапуститьs?: LiveЗапуститьForЗадача[];
  activeЗапустить?: АктивенЗапуститьForЗадача | null;
  issueСтатус: Задача["status"];
  childЗадачи: Задача[];
  agentMap: ReadonlyMap<string, Pick<Агент, "name">>;
  activityEvents?: АктивностьEvent[];
  renderАктивностьEvent?: (event: АктивностьEvent) => ReactНетde;
  pendingWatchdogDecision?: WatchdogDecisionInput["decision"] | null;
  canRecordWatchdogDecisions?: boolean;
  watchdogDecisionОшибка?: string | null;
  onWatchdogDecision?: (input: WatchdogDecisionInput) => void;
};

type LedgerЗапустить = ЗапуститьForЗадача & {
  isLive?: boolean;
  agentИмя?: string;
  outputSilence?: АктивенЗапуститьForЗадача["outputSilence"];
};

type LedgerFeedItem =
  | {
      kind: "run";
      id: string;
      timestamp: string;
      run: LedgerЗапустить;
    }
  | {
      kind: "activity";
      id: string;
      timestamp: string;
      event: АктивностьEvent;
    };

type LivenessКопировать = {
  label: string;
  tone: string;
  description: string;
};

const LIVENESS_COPY: Record<ЗапуститьLivenessState, LivenessКопировать> = {
  completed: {
    label: "Завершён",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "Задача reached a terminal state.",
  },
  advanced: {
    label: "Дополнительно",
    tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    description: "Запустить produced concrete evidence of progress.",
  },
  plan_only: {
    label: "Plan only",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "Запустить described future work without concrete action evidence.",
  },
  empty_response: {
    label: "Empty response",
    tone: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    description: "Запустить finished without useful output.",
  },
  blocked: {
    label: "Заблокирован",
    tone: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    description: "Запустить or issue declared a blocker.",
  },
  failed: {
    label: "Ошибка",
    tone: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    description: "Запустить ended unsuccessfully.",
  },
  needs_followup: {
    label: "Needs follow-up",
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    description: "Запустить produced useful output but did not prove concrete progress.",
  },
};

const PENDING_LIVENESS_COPY: LivenessКопировать = {
  label: "Checks after finish",
  tone: "border-border bg-background text-muted-foreground",
  description: "Liveness is evaluated after the run finishes.",
};

const RETRY_PENDING_LIVENESS_COPY: LivenessКопировать = {
  label: "Повторить pending",
  tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  description: "Paperclip queued an automatic retry that has not started yet.",
};

const MISSING_LIVENESS_COPY: LivenessКопировать = {
  label: "Нет liveness data",
  tone: "border-border bg-background text-muted-foreground",
  description: "This run has no persisted liveness classification.",
};

const TERMINAL_CHILD_STATUSES = new Set<Задача["status"]>(["done", "cancelled"]);
const ACTIVE_RUN_STATUSES = new Set(["queued", "running"]);

type ЗапуститьOutputSilenceLevel = НетnNullable<АктивенЗапуститьForЗадача["outputSilence"]>["level"];

type ЗапуститьOutputSilenceКопировать = {
  label: string;
  tone: string;
};

const RUN_OUTPUT_SILENCE_COPY: Partial<Record<ЗапуститьOutputSilenceLevel, ЗапуститьOutputSilenceКопировать>> = {
  suspicious: {
    label: "Silence watch",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  critical: {
    label: "Stale run",
    tone: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  snoozed: {
    label: "Silence snoozed",
    tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

interface МодельПрофильSummary {
  requested: string;
  applied: string | null;
  configSource: string | null;
  fallbackReason: string | null;
}

function modelПрофильForЗапустить(run: ЗапуститьForЗадача): МодельПрофильSummary | null {
  const result = asRecord(run.resultJson);
  const profile = asRecord(result?.modelПрофиль);
  if (!profile) return null;
  const requested = readString(profile.requested);
  if (!requested) return null;
  return {
    requested,
    applied: readString(profile.applied),
    configSource: readString(profile.configSource),
    fallbackReason: readString(profile.fallbackReason),
  };
}

function modelПрофильBadgeTone(summary: МодельПрофильSummary) {
  if (summary.applied === summary.requested) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (summary.fallbackReason) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-border bg-background text-muted-foreground";
}

function modelПрофильНазвание(summary: МодельПрофильSummary) {
  const lines = [`Requested: ${summary.requested}`];
  if (summary.applied) lines.push(`Applied: ${summary.applied}`);
  if (summary.configSource) lines.push(`Source: ${summary.configSource}`);
  if (summary.fallbackReason) lines.push(`Fallback: ${summary.fallbackReason}`);
  return lines.join("\n");
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDuration(start: string | Date | null | undefined, end: string | Date | null | undefined) {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const totalSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function liveЗапуститьToLedgerЗапустить(run: LiveЗапуститьForЗадача | АктивенЗапуститьForЗадача): LedgerЗапустить {
  return {
    runId: run.id,
    status: run.status,
    agentId: run.agentId,
    agentИмя: run.agentИмя,
    adapterТип: run.adapterТип,
    startedAt: toIsoString(run.startedAt),
    finishedAt: toIsoString(run.finishedAt),
    createdAt: toIsoString(run.createdAt) ?? new Date().toISOString(),
    invocationSource: run.invocationSource,
    usageJson: null,
    resultJson: null,
    isLive: run.status === "queued" || run.status === "running",
    outputSilence: run.outputSilence,
  };
}

function mergeЗапуститьs(
  runs: ЗапуститьForЗадача[],
  liveЗапуститьs: LiveЗапуститьForЗадача[] | undefined,
  activeЗапустить: АктивенЗапуститьForЗадача | null | undefined,
) {
  const byId = new Map<string, LedgerЗапустить>();
  for (const run of runs) byId.set(run.runId, run);
  for (const run of liveЗапуститьs ?? []) {
    const existing = byId.get(run.id);
    byId.set(
      run.id,
      existing
        ? { ...existing, isLive: true, agentИмя: run.agentИмя, outputSilence: run.outputSilence }
        : liveЗапуститьToLedgerЗапустить(run),
    );
  }
  if (activeЗапустить) {
    const existing = byId.get(activeЗапустить.id);
    if (existing) {
      byId.set(activeЗапустить.id, {
        ...existing,
        isLive: isАктивенЗапустить(existing) || isАктивенЗапустить(activeЗапустить),
        agentИмя: activeЗапустить.agentИмя,
        outputSilence: activeЗапустить.outputSilence,
      });
    } else {
      byId.set(activeЗапустить.id, liveЗапуститьToLedgerЗапустить(activeЗапустить));
    }
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = new Date(a.startedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.startedAt ?? b.createdAt).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.runId.localeCompare(a.runId);
  });
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function isАктивенЗапустить(run: Pick<LedgerЗапустить, "status" | "isLive">) {
  return run.isLive || ACTIVE_RUN_STATUSES.has(run.status);
}

function runSummary(run: LedgerЗапустить, agentMap: ReadonlyMap<string, Pick<Агент, "name">>) {
  const agentИмя = compactАгентИмя(run, agentMap);
  if (run.status === "running") return `Выполняется now by ${agentИмя}`;
  if (run.status === "queued") return `Queued for ${agentИмя}`;
  if (run.status === "scheduled_retry") return `Автоmatic retry scheduled for ${agentИмя}`;
  return `${statusLabel(run.status)} by ${agentИмя}`;
}

function livenessКопироватьForЗапустить(run: LedgerЗапустить) {
  if (run.status === "scheduled_retry") return RETRY_PENDING_LIVENESS_COPY;
  if (run.livenessState) return LIVENESS_COPY[run.livenessState];
  return isАктивенЗапустить(run) ? PENDING_LIVENESS_COPY : MISSING_LIVENESS_COPY;
}

function stopReasonLabel(run: ЗапуститьForЗадача) {
  const result = asRecord(run.resultJson);
  const stopReason = readString(result?.stopReason);
  const timeoutFired = result?.timeoutFired === true;
  const effectiveTimeoutSec = readNumber(result?.effectiveTimeoutSec);
  const timeoutText =
    effectiveTimeoutSec && effectiveTimeoutSec > 0 ? `${effectiveTimeoutSec}s timeout` : null;

  if (timeoutFired || stopReason === "timeout") {
    return timeoutText ? `timeout (${timeoutText})` : "timeout";
  }
  if (stopReason === "max_turns_exhausted" || stopReason === "turn_limit_exhausted") return "max turns exhausted";
  if (stopReason === "budget_paused") return "budget paused";
  if (stopReason === "cancelled") return "cancelled";
  if (stopReason === "paused") return "paused by board";
  if (stopReason === "process_lost") return "process lost";
  if (stopReason === "adapter_failed") return "adapter failed";
  if (stopReason === "completed") return timeoutText ? `completed (${timeoutText})` : "completed";
  return timeoutText;
}

function stopСтатусLabel(run: LedgerЗапустить, stopReason: string | null) {
  if (stopReason) return stopReason;
  if (run.status === "scheduled_retry") return "Повторить pending";
  if (run.status === "queued") return "Waiting to start";
  if (run.status === "running") return "Still running";
  if (!run.livenessState) return "Unavailable";
  return "Нет stop reason";
}

function lastUsefulActionLabel(run: LedgerЗапустить) {
  if (run.status === "scheduled_retry") return "Waiting for next attempt";
  if (run.lastUsefulActionAt) return relativeTime(run.lastUsefulActionAt);
  if (isАктивенЗапустить(run)) return "Нет action recorded yet";
  if (run.livenessState === "plan_only" || run.livenessState === "needs_followup") {
    return "Нет concrete action";
  }
  if (run.livenessState === "empty_response") return "Нет useful output";
  if (!run.livenessState) return "Unavailable";
  return "Не записано";
}

function continuationLabel(run: LedgerЗапустить) {
  if (!run.continuationAttempt || run.continuationAttempt <= 0) return null;
  return `Continuation attempt ${run.continuationAttempt}`;
}

function hasExhaustedContinuation(run: ЗапуститьForЗадача) {
  return /continuation attempts exhausted/i.test(run.livenessReason ?? "");
}

function childЗадачаSummary(childЗадачи: Задача[]) {
  const active = childЗадачи.filter((issue) => !TERMINAL_CHILD_STATUSES.has(issue.status));
  const done = childЗадачи.filter((issue) => issue.status === "done").length;
  const cancelled = childЗадачи.filter((issue) => issue.status === "cancelled").length;
  return { active, done, cancelled, total: childЗадачи.length };
}

function compactАгентИмя(run: LedgerЗапустить, agentMap: ReadonlyMap<string, Pick<Агент, "name">>) {
  return run.agentИмя ?? agentMap.get(run.agentId)?.name ?? run.agentId.slice(0, 8);
}

function formatSilenceAge(ms: number | null | undefined) {
  if (!ms || ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "under 1 minute";
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${minutes}m`;
}

function canСоветRecordWatchdogDecision(
  companyId: string,
  boardДоступ: CurrentСоветДоступ | undefined,
) {
  if (!boardДоступ) return false;
  if (boardДоступ.source === "local_implicit" || boardДоступ.isInstanceAdmin) return true;

  const membership = boardДоступ.memberships?.find(
    (item) => item.companyId === companyId && item.status === "active",
  );
  if (!membership) return boardДоступ.companyIds.includes(companyId) && !boardДоступ.memberships;
  return membership.membershipRole !== "viewer" && membership.membershipRole !== null;
}

function watchdogDecisionОшибкаMessage(error: unknown) {
  if (error instanceof ApiОшибка && error.status === 403) {
    return "Only the board or the assigned recovery owner can record watchdog decisions";
  }
  return error instanceof Ошибка && error.message.trim().length > 0
    ? error.message
    : "Paperclip could not record the watchdog decision.";
}

export function ЗадачаЗапуститьLedger({
  issueId,
  companyId,
  issueСтатус,
  childЗадачи,
  agentMap,
  hasLiveЗапуститьs,
  activityEvents,
  renderАктивностьEvent,
}: ЗадачаЗапуститьLedgerProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [watchdogDecisionОшибка, setWatchdogDecisionОшибка] = useState<string | null>(null);
  const { data: boardДоступ } = useQuery({
    queryКлюч: queryКлючs.access.currentСоветДоступ,
    queryFn: () => accessApi.getCurrentСоветДоступ(),
    retry: false,
  });
  const { data: runs } = useQuery({
    queryКлюч: queryКлючs.issues.runs(issueId),
    queryFn: () => activityApi.runsForЗадача(issueId),
    refetchInterval: hasLiveЗапуститьs || issueСтатус === "in_progress" ? 5000 : false,
    placeholderData: keepPreviousDataForSameQueryTail<ЗапуститьForЗадача[]>(issueId),
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId),
    queryFn: () => heartbeatsApi.liveЗапуститьsForЗадача(issueId),
    enabled: hasLiveЗапуститьs,
    refetchInterval: 3000,
    placeholderData: keepPreviousDataForSameQueryTail<LiveЗапуститьForЗадача[]>(issueId),
  });
  const { data: activeЗапустить = null } = useQuery({
    queryКлюч: queryКлючs.issues.activeЗапустить(issueId),
    queryFn: () => heartbeatsApi.activeЗапуститьForЗадача(issueId),
    enabled: hasLiveЗапуститьs || issueСтатус === "in_progress",
    refetchInterval: hasLiveЗапуститьs ? false : 3000,
    placeholderData: keepPreviousDataForSameQueryTail<АктивенЗапуститьForЗадача | null>(issueId),
  });
  const watchdogDecision = useMutation({
    mutationFn: (input: WatchdogDecisionInput) => heartbeatsApi.recordWatchdogDecision(input),
    onMutate: () => {
      setWatchdogDecisionОшибка(null);
    },
    onУспешно: () => {
      setWatchdogDecisionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId) });
    },
    onОшибка: (error) => {
      const message = watchdogDecisionОшибкаMessage(error);
      const dedupeSuffix = error instanceof ApiОшибка ? String(error.status) : "error";
      setWatchdogDecisionОшибка(message);
      pushToast({
        title: "Watchdog decision not recorded",
        body: message,
        tone: "error",
        dedupeКлюч: `watchdog-decision:${issueId}:${dedupeSuffix}`,
      });
    },
  });

  return (
    <ЗадачаЗапуститьLedgerContent
      runs={runs ?? []}
      liveЗапуститьs={liveЗапуститьs}
      activeЗапустить={activeЗапустить}
      issueСтатус={issueСтатус}
      childЗадачи={childЗадачи}
      agentMap={agentMap}
      activityEvents={activityEvents}
      renderАктивностьEvent={renderАктивностьEvent}
      pendingWatchdogDecision={watchdogDecision.variables?.decision ?? null}
      canRecordWatchdogDecisions={canСоветRecordWatchdogDecision(companyId, boardДоступ)}
      watchdogDecisionОшибка={watchdogDecisionОшибка}
      onWatchdogDecision={(input) => watchdogDecision.mutate(input)}
    />
  );
}

export function ЗадачаЗапуститьLedgerContent({
  runs,
  liveЗапуститьs,
  activeЗапустить,
  issueСтатус,
  childЗадачи,
  agentMap,
  activityEvents,
  renderАктивностьEvent,
  pendingWatchdogDecision,
  canRecordWatchdogDecisions = true,
  watchdogDecisionОшибка,
  onWatchdogDecision,
}: ЗадачаЗапуститьLedgerContentProps) {
  const ledgerЗапуститьs = useMemo(() => mergeЗапуститьs(runs, liveЗапуститьs, activeЗапустить), [activeЗапустить, liveЗапуститьs, runs]);
  const latestЗапустить = ledgerЗапуститьs[0] ?? null;
  const latestSilentЗапустить = useMemo(
    () =>
      ledgerЗапуститьs.find((run) =>
        isАктивенЗапустить(run)
        && (run.outputSilence?.level === "critical" || run.outputSilence?.level === "suspicious"),
      ) ?? null,
    [ledgerЗапуститьs],
  );
  const children = childЗадачаSummary(childЗадачи);
  const canRenderАктивностьEvents = Boolean(renderАктивностьEvent);
  const feedItems = useMemo<LedgerFeedItem[]>(() => {
    const items: LedgerFeedItem[] = [];
    for (const run of ledgerЗапуститьs) {
      items.push({
        kind: "run",
        id: run.runId,
        timestamp: run.startedAt ?? run.createdAt,
        run,
      });
    }
    if (canRenderАктивностьEvents) {
      for (const event of activityEvents ?? []) {
        items.push({
          kind: "activity",
          id: event.id,
          timestamp: event.createdAt instanceof Date
            ? event.createdAt.toISOString()
            : String(event.createdAt),
          event,
        });
      }
    }
    return items.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      if (aTime !== bTime) return bTime - aTime;
      if (a.kind !== b.kind) return a.kind === "run" ? -1 : 1;
      return b.id.localeCompare(a.id);
    });
  }, [activityEvents, canRenderАктивностьEvents, ledgerЗапуститьs]);

  return (
    <section classИмя="space-y-3" aria-label="Задача run ledger">
      <div classИмя="flex items-center justify-between gap-2">
        <div classИмя="min-w-0">
          <h3 classИмя="text-sm font-medium text-muted-foreground">Запустить ledger</h3>
          <p classИмя="text-xs text-muted-foreground">
            {latestЗапустить
              ? runSummary(latestЗапустить, agentMap)
              : issueСтатус === "in_progress"
                ? "Waiting for the first run record."
                : "Нет runs linked yet."}
          </p>
        </div>
        {latestЗапустить ? (
          <Link
            to={`/agents/${latestЗапустить.agentId}/runs/${latestЗапустить.runId}`}
            classИмя="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Latest run
          </Link>
        ) : null}
      </div>

      {children.total > 0 ? (
        <div classИмя="rounded-md border border-border/70 px-3 py-2">
          <div classИмя="flex flex-wrap items-center gap-2 text-xs">
            <span classИмя="font-medium text-foreground">Child work</span>
            <span classИмя="text-muted-foreground">
              {children.active.length > 0
                ? `${children.active.length} active, ${children.done} done, ${children.cancelled} cancelled`
                : `all ${children.total} terminal (${children.done} done, ${children.cancelled} cancelled)`}
            </span>
          </div>
          {children.active.length > 0 ? (
            <div classИмя="mt-2 flex flex-wrap gap-1.5">
              {children.active.slice(0, 4).map((child) => (
                <Link
                  key={child.id}
                  to={`/issues/${child.identifier ?? child.id}`}
                  classИмя="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent/40"
                >
                  <span classИмя="shrink-0 font-mono text-muted-foreground">{child.identifier ?? child.id.slice(0, 8)}</span>
                  <span classИмя="truncate">{child.title}</span>
                  <span classИмя="shrink-0 text-muted-foreground">{statusLabel(child.status)}</span>
                </Link>
              ))}
              {children.active.length > 4 ? (
                <span classИмя="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                  +{children.active.length - 4} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {latestSilentЗапустить?.outputSilence ? (
        <div
          classИмя={cn(
            "rounded-md border px-3 py-2 text-xs",
            latestSilentЗапустить.outputSilence.level === "critical"
              ? "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
          )}
        >
          <p classИмя="font-medium">
            {latestSilentЗапустить.outputSilence.level === "critical"
              ? "Stale-run watchdog alert"
              : "Output silence watchdog warning"}
          </p>
          <p classИмя="mt-1">
            Latest active run has been silent for{" "}
            {formatSilenceAge(latestSilentЗапустить.outputSilence.silenceAgeMs) ?? "an extended period"}.
            {latestSilentЗапустить.outputSilence.evaluationЗадачаIdentifier ? (
              <>
                {" "}
                Review{" "}
                <Link
                  to={`/issues/${latestSilentЗапустить.outputSilence.evaluationЗадачаIdentifier}`}
                  classИмя="font-medium underline underline-offset-2"
                >
                  {latestSilentЗапустить.outputSilence.evaluationЗадачаIdentifier}
                </Link>
                {" "}for recovery context.
              </>
            ) : null}
          </p>
          {onWatchdogDecision && canRecordWatchdogDecisions ? (
            <div classИмя="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                classИмя="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-foreground hover:bg-background"
                onClick={() =>
                  onWatchdogDecision({
                    runId: latestSilentЗапустить.runId,
                    decision: "continue",
                    evaluationЗадачаId: latestSilentЗапустить.outputSilence?.evaluationЗадачаId ?? null,
                  })}
                disabled={pendingWatchdogDecision != null}
              >
                Продолжить monitoring
              </button>
              <button
                type="button"
                classИмя="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-foreground hover:bg-background"
                onClick={() =>
                  onWatchdogDecision({
                    runId: latestSilentЗапустить.runId,
                    decision: "snooze",
                    evaluationЗадачаId: latestSilentЗапустить.outputSilence?.evaluationЗадачаId ?? null,
                    snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    reason: "Snoozed from issue run ledger",
                  })}
                disabled={pendingWatchdogDecision != null}
              >
                Snooze 1h
              </button>
              <button
                type="button"
                classИмя="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-foreground hover:bg-background"
                onClick={() =>
                  onWatchdogDecision({
                    runId: latestSilentЗапустить.runId,
                    decision: "dismissed_false_positive",
                    evaluationЗадачаId: latestSilentЗапустить.outputSilence?.evaluationЗадачаId ?? null,
                    reason: "Закрытьed from issue run ledger",
                  })}
                disabled={pendingWatchdogDecision != null}
              >
                Mark false positive
              </button>
            </div>
          ) : null}
          {watchdogDecisionОшибка ? (
            <p classИмя="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-900 dark:text-red-200">
              {watchdogDecisionОшибка}
            </p>
          ) : null}
        </div>
      ) : null}

      {feedItems.length === 0 ? (
        <div classИмя="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          {renderАктивностьEvent
            ? "Запуститьs and activity will appear here once this issue has history."
            : "Historical runs without liveness metadata will appear here once linked to this issue."}
        </div>
      ) : (
        <div classИмя="space-y-1.5">
          {feedItems.slice(0, 20).map((item) => {
            if (item.kind === "activity") {
              return <div key={`activity:${item.id}`}>{renderАктивностьEvent?.(item.event)}</div>;
            }
            const run = item.run;
            const liveness = livenessКопироватьForЗапустить(run);
            const stopReason = stopReasonLabel(run);
            const duration = formatDuration(run.startedAt, run.finishedAt);
            const exhausted = hasExhaustedContinuation(run);
            const continuation = continuationLabel(run);
            const retryState = describeЗапуститьПовторитьState(run);
            const agentИмя = compactАгентИмя(run, agentMap);
            return (
              <article
                key={`run:${run.runId}`}
                classИмя="space-y-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground"
              >
                <div classИмя="flex flex-wrap items-center gap-1.5">
                  <span classИмя="font-medium text-foreground">Запустить</span>
                  <Link
                    to={`/agents/${run.agentId}/runs/${run.runId}`}
                    classИмя="min-w-0 max-w-full truncate font-mono text-foreground hover:underline"
                  >
                    {run.runId.slice(0, 8)}
                  </Link>
                  <span>by {agentИмя}</span>
                  <span classИмя="rounded-md border border-border px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
                    {statusLabel(run.status)}
                  </span>
                  {run.isLive ? (
                    <span classИмя="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] text-cyan-700 dark:text-cyan-300">
                      <span classИмя="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      live
                    </span>
                  ) : null}
                  <span
                    classИмя={cn(
                      "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                      liveness.tone,
                    )}
                    title={liveness.description}
                  >
                    {liveness.label}
                  </span>
                  {exhausted ? (
                    <span classИмя="rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                      Exhausted
                    </span>
                  ) : null}
                  {continuation ? (
                    <span classИмя="text-[11px] text-muted-foreground">{continuation}</span>
                  ) : null}
                  {retryState ? (
                    <span
                      classИмя={cn(
                        "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                        retryState.tone,
                      )}
                    >
                      {retryState.badgeLabel}
                    </span>
                  ) : null}
                  {run.outputSilence && RUN_OUTPUT_SILENCE_COPY[run.outputSilence.level] ? (
                    <span
                      classИмя={cn(
                        "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                        RUN_OUTPUT_SILENCE_COPY[run.outputSilence.level]?.tone,
                      )}
                    >
                      {RUN_OUTPUT_SILENCE_COPY[run.outputSilence.level]?.label}
                    </span>
                  ) : null}
                  {(() => {
                    const profile = modelПрофильForЗапустить(run);
                    if (!profile) return null;
                    const label = profile.applied === profile.requested
                      ? `Профиль: ${profile.requested}`
                      : profile.applied
                        ? `Профиль: ${profile.requested} → ${profile.applied}`
                        : `Профиль: ${profile.requested} (unavailable)`;
                    return (
                      <span
                        classИмя={cn(
                          "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                          modelПрофильBadgeTone(profile),
                        )}
                        title={modelПрофильНазвание(profile)}
                      >
                        {label}
                      </span>
                    );
                  })()}
                  <span classИмя="ml-auto shrink-0">{relativeTime(item.timestamp)}</span>
                </div>

                <div classИмя="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div classИмя="min-w-0">
                    <span classИмя="text-foreground">Elapsed</span>{" "}
                    {duration ?? "unknown"}
                  </div>
                  <div classИмя="min-w-0">
                    <span classИмя="text-foreground">Last useful action</span>{" "}
                    {lastUsefulActionLabel(run)}
                  </div>
                  <div classИмя="min-w-0">
                    <span classИмя="text-foreground">Остановить</span>{" "}
                    {stopСтатусLabel(run, stopReason)}
                  </div>
                </div>

                {retryState ? (
                  <div classИмя="rounded-md border border-border/70 bg-accent/20 px-2 py-2 text-xs leading-5 text-muted-foreground">
                    {retryState.detail ? <p>{retryState.detail}</p> : null}
                    {retryState.secondary ? <p>{retryState.secondary}</p> : null}
                    {retryState.retryOfЗапуститьId ? (
                      <p>
                        Повторить of{" "}
                        <Link
                          to={`/agents/${run.agentId}/runs/${retryState.retryOfЗапуститьId}`}
                          classИмя="font-mono text-foreground hover:underline"
                        >
                          {retryState.retryOfЗапуститьId.slice(0, 8)}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {(() => {
                  const profile = modelПрофильForЗапустить(run);
                  if (!profile?.fallbackReason || profile.applied === profile.requested) return null;
                  return (
                    <p classИмя="min-w-0 break-words text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                      {profile.requested === "cheap"
                        ? "Cheap profile fell back to primary"
                        : `${profile.requested} profile unavailable`}
                      {": "}
                      <span classИмя="font-mono">{profile.fallbackReason}</span>
                    </p>
                  );
                })()}

                {run.livenessReason ? (
                  <p classИмя="min-w-0 break-words text-xs leading-5 text-muted-foreground">
                    {run.livenessReason}
                  </p>
                ) : null}

                {run.nextAction ? (
                  <div classИмя="min-w-0 rounded-md bg-accent/40 px-2 py-1.5 text-xs leading-5">
                    <span classИмя="font-medium text-foreground">Далее action: </span>
                    <span classИмя="break-words text-muted-foreground">{run.nextAction}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
          {feedItems.length > 20 ? (
            <div classИмя="px-3 py-2 text-xs text-muted-foreground">
              {feedItems.length - 20} older items not shown
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
