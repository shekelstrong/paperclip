import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { heartbeatsApi, type LiveЗапуститьForЗадача } from "../api/heartbeats";
import { queryКлючs } from "../lib/queryКлючs";
import { formatDateTime } from "../lib/utils";
import { ExternalLink, Square } from "lucide-react";
import { Identity } from "./Identity";
import { ЗапуститьChatSurface } from "./ЗапуститьChatSurface";
import { СтатусBadge } from "./СтатусBadge";
import { useLiveЗапуститьTranscripts } from "./transcript/useLiveЗапуститьTranscripts";

interface LiveЗапуститьWidgetProps {
  issueId: string;
  companyId?: string | null;
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function isЗапуститьАктивен(status: string): boolean {
  return status === "queued" || status === "running";
}

export function LiveЗапуститьWidget({ issueId, companyId }: LiveЗапуститьWidgetProps) {
  const queryClient = useQueryClient();
  const [cancellingЗапуститьIds, setОтменаlingЗапуститьIds] = useState(new Set<string>());

  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId),
    queryFn: () => heartbeatsApi.liveЗапуститьsForЗадача(issueId),
    enabled: !!issueId,
    refetchInterval: 3000,
  });

  const { data: activeЗапустить } = useQuery({
    queryКлюч: queryКлючs.issues.activeЗапустить(issueId),
    queryFn: () => heartbeatsApi.activeЗапуститьForЗадача(issueId),
    enabled: !!issueId,
    refetchInterval: 3000,
  });

  const runs = useMemo(() => {
    const deduped = new Map<string, LiveЗапуститьForЗадача>();
    for (const run of liveЗапуститьs ?? []) {
      deduped.set(run.id, run);
    }
    if (activeЗапустить) {
      deduped.set(activeЗапустить.id, {
        id: activeЗапустить.id,
        status: activeЗапустить.status,
        invocationSource: activeЗапустить.invocationSource,
        triggerDetail: activeЗапустить.triggerDetail,
        startedAt: toIsoString(activeЗапустить.startedAt),
        finishedAt: toIsoString(activeЗапустить.finishedAt),
        createdAt: toIsoString(activeЗапустить.createdAt) ?? new Date().toISOString(),
        agentId: activeЗапустить.agentId,
        agentИмя: activeЗапустить.agentИмя,
        adapterТип: activeЗапустить.adapterТип,
        logBytes: activeЗапустить.logBytes,
        lastOutputBytes: activeЗапустить.lastOutputBytes,
        issueId,
      });
    }
    return [...deduped.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeЗапустить, issueId, liveЗапуститьs]);

  const { transcriptByЗапустить, hasOutputForЗапустить } = useLiveЗапуститьTranscripts({ runs, companyId });

  const handleОтменаЗапустить = async (runId: string) => {
    setОтменаlingЗапуститьIds((prev) => new Set(prev).add(runId));
    try {
      await heartbeatsApi.cancel(runId);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueId) });
    } finally {
      setОтменаlingЗапуститьIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  };

  if (runs.length === 0) return null;

  return (
    <div classИмя="overflow-hidden rounded-xl border border-cyan-500/25 bg-background/80 shadow-[0_18px_50px_rgba(6,182,212,0.08)]">
      <div classИмя="border-b border-border/60 bg-cyan-500/[0.04] px-4 py-3">
        <div classИмя="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
          Live Запуститьs
        </div>
        <div classИмя="mt-1 text-xs text-muted-foreground">
          Uses the shared chat-style run surface from issue activity.
        </div>
      </div>

      <div classИмя="divide-y divide-border/60">
        {runs.map((run) => {
          const isАктивен = isЗапуститьАктивен(run.status);
          const transcript = transcriptByЗапустить.get(run.id) ?? [];
          return (
            <section key={run.id} classИмя="px-4 py-4">
              <div classИмя="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div classИмя="min-w-0">
                  <Link to={`/agents/${run.agentId}`} classИмя="inline-flex hover:underline">
                    <Identity name={run.agentИмя} size="sm" />
                  </Link>
                  <div classИмя="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Link
                      to={`/agents/${run.agentId}/runs/${run.id}`}
                      classИмя="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-1 font-mono hover:border-cyan-500/30 hover:text-foreground"
                    >
                      {run.id.slice(0, 8)}
                    </Link>
                    <СтатусBadge status={run.status} />
                    <span>{formatDateTime(run.startedAt ?? run.createdAt)}</span>
                  </div>
                </div>

                <div classИмя="flex items-center gap-2">
                  {isАктивен && (
                    <button
                      onClick={() => handleОтменаЗапустить(run.id)}
                      disabled={cancellingЗапуститьIds.has(run.id)}
                      classИмя="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-500/[0.12] dark:text-red-300 disabled:opacity-50"
                    >
                      <Square classИмя="h-2.5 w-2.5" fill="currentColor" />
                      {cancellingЗапуститьIds.has(run.id) ? "Остановитьping…" : "Остановить"}
                    </button>
                  )}
                  <Link
                    to={`/agents/${run.agentId}/runs/${run.id}`}
                    classИмя="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-cyan-700 transition-colors hover:border-cyan-500/30 hover:text-cyan-600 dark:text-cyan-300"
                  >
                    Open run
                    <ExternalLink classИмя="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div classИмя="max-h-[320px] overflow-y-auto pr-1">
                <ЗапуститьChatSurface
                  run={run}
                  transcript={transcript}
                  hasOutput={hasOutputForЗапустить(run.id)}
                  companyId={companyId}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
