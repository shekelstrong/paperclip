import { memo, useMemo } from "react";
import { Link } from "@/lib/router";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Задача } from "@paperclipai/shared";
import { heartbeatsApi, type LiveЗапуститьForЗадача } from "../api/heartbeats";
import type { TranscriptEntry } from "../adapters";
import { issuesApi } from "../api/issues";
import { queryКлючs } from "../lib/queryКлючs";
import { cn, relativeTime } from "../lib/utils";
import { ExternalLink } from "lucide-react";
import { Identity } from "./Identity";
import { ЗапуститьChatSurface } from "./ЗапуститьChatSurface";
import { useLiveЗапуститьTranscripts } from "./transcript/useLiveЗапуститьTranscripts";

const MIN_DASHBOARD_RUNS = 4;
const DASHBOARD_RUN_CARD_LIMIT = 4;
const DASHBOARD_LOG_POLL_INTERVAL_MS = 15_000;
const DASHBOARD_LOG_READ_LIMIT_BYTES = 64_000;
const DASHBOARD_MAX_CHUNKS_PER_RUN = 40;
const EMPTY_TRANSCRIPT: TranscriptEntry[] = [];

function isЗапуститьАктивен(run: LiveЗапуститьForЗадача): boolean {
  return run.status === "queued" || run.status === "running";
}

interface АктивенАгентыPanelProps {
  companyId: string;
  title?: string;
  minЗапуститьCount?: number;
  fetchLimit?: number;
  cardLimit?: number;
  gridClassИмя?: string;
  cardClassИмя?: string;
  emptyMessage?: string;
  queryОбласть?: string;
  showMoreLink?: boolean;
}

export function АктивенАгентыPanel({
  companyId,
  title = "Агенты",
  minЗапуститьCount = MIN_DASHBOARD_RUNS,
  fetchLimit,
  cardLimit = DASHBOARD_RUN_CARD_LIMIT,
  gridClassИмя,
  cardClassИмя,
  emptyMessage = "Нет recent agent runs.",
  queryОбласть = "dashboard",
  showMoreLink = true,
}: АктивенАгентыPanelProps) {
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: [...queryКлючs.liveЗапуститьs(companyId), queryОбласть, { minЗапуститьCount, fetchLimit }],
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(companyId, { minCount: minЗапуститьCount, limit: fetchLimit }),
  });

  const runs = liveЗапуститьs ?? [];
  const visibleЗапуститьs = useMemo(() => runs.slice(0, cardLimit), [cardLimit, runs]);
  const hiddenЗапуститьCount = Math.max(0, runs.length - visibleЗапуститьs.length);
  const visibleЗадачаIds = useMemo(
    () => [...new Set(visibleЗапуститьs.map((run) => run.issueId).filter((issueId): issueId is string => Boolean(issueId)))],
    [visibleЗапуститьs],
  );

  const issueQueries = useQueries({
    queries: visibleЗадачаIds.map((issueId) => ({
      queryКлюч: queryКлючs.issues.detail(issueId),
      queryFn: () => issuesApi.get(issueId),
      staleTime: 30_000,
      retry: false,
    })),
  });

  const issueById = useMemo(() => {
    const map = new Map<string, Задача>();
    for (const query of issueQueries) {
      const issue = query.data;
      if (issue) map.set(issue.id, issue);
    }
    return map;
  }, [issueQueries]);

  const { transcriptByЗапустить, hasOutputForЗапустить } = useLiveЗапуститьTranscripts({
    runs: visibleЗапуститьs,
    companyId,
    maxChunksPerЗапустить: DASHBOARD_MAX_CHUNKS_PER_RUN,
    logPollIntervalMs: DASHBOARD_LOG_POLL_INTERVAL_MS,
    logReadLimitBytes: DASHBOARD_LOG_READ_LIMIT_BYTES,
    enableRealtimeОбновитьs: false,
  });

  return (
    <div>
      <h3 classИмя="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {runs.length === 0 ? (
        <div classИмя="rounded-xl border border-border p-4">
          <p classИмя="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div classИмя={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4", gridClassИмя)}>
          {visibleЗапуститьs.map((run) => (
            <АгентЗапуститьCard
              key={run.id}
              companyId={companyId}
              run={run}
              issue={run.issueId ? issueById.get(run.issueId) : undefined}
              transcript={transcriptByЗапустить.get(run.id) ?? EMPTY_TRANSCRIPT}
              hasOutput={hasOutputForЗапустить(run.id)}
              isАктивен={isЗапуститьАктивен(run)}
              classИмя={cardClassИмя}
            />
          ))}
        </div>
      )}
      {showMoreLink && hiddenЗапуститьCount > 0 && (
        <div classИмя="mt-3 flex justify-end text-xs text-muted-foreground">
          <Link to="/dashboard/live" classИмя="hover:text-foreground hover:underline">
            {hiddenЗапуститьCount} more active/recent run{hiddenЗапуститьCount === 1 ? "" : "s"}
          </Link>
        </div>
      )}
    </div>
  );
}

const АгентЗапуститьCard = memo(function АгентЗапуститьCard({
  companyId,
  run,
  issue,
  transcript,
  hasOutput,
  isАктивен,
  classИмя,
}: {
  companyId: string;
  run: LiveЗапуститьForЗадача;
  issue?: Задача;
  transcript: TranscriptEntry[];
  hasOutput: boolean;
  isАктивен: boolean;
  classИмя?: string;
}) {
  return (
    <div classИмя={cn(
      "flex h-[320px] flex-col overflow-hidden rounded-xl border shadow-sm",
      isАктивен
        ? "border-cyan-500/25 bg-cyan-500/[0.04] shadow-[0_16px_40px_rgba(6,182,212,0.08)]"
        : "border-border bg-background/70",
      classИмя,
    )}>
      <div classИмя="border-b border-border/60 px-3 py-3">
        <div classИмя="flex items-start justify-between gap-2">
          <div classИмя="min-w-0">
            <div classИмя="flex items-center gap-2">
              {isАктивен ? (
                <span classИмя="relative flex h-2.5 w-2.5 shrink-0">
                  <span classИмя="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
                  <span classИмя="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
                </span>
              ) : (
                <span classИмя="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
              )}
              <Identity name={run.agentИмя} size="sm" classИмя="[&>span:last-child]:!text-[11px]" />
            </div>
            <div classИмя="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{isАктивен ? "Live now" : run.finishedAt ? `Finished ${relativeTime(run.finishedAt)}` : `Запущен ${relativeTime(run.createdAt)}`}</span>
            </div>
          </div>

          <Link
            to={`/agents/${run.agentId}/runs/${run.id}`}
            classИмя="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink classИмя="h-2.5 w-2.5" />
          </Link>
        </div>

        {run.issueId && (
          <div classИмя="mt-3 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 text-xs">
            <Link
              to={`/issues/${issue?.identifier ?? run.issueId}`}
              classИмя={cn(
                "line-clamp-2 hover:underline",
                isАктивен ? "text-cyan-700 dark:text-cyan-300" : "text-muted-foreground hover:text-foreground",
              )}
              title={issue?.title ? `${issue?.identifier ?? run.issueId.slice(0, 8)} - ${issue.title}` : issue?.identifier ?? run.issueId.slice(0, 8)}
            >
              {issue?.identifier ?? run.issueId.slice(0, 8)}
              {issue?.title ? ` - ${issue.title}` : ""}
            </Link>
          </div>
        )}
      </div>

      <div classИмя="min-h-0 flex-1 overflow-y-auto p-3">
        <ЗапуститьChatSurface
          run={run}
          transcript={transcript}
          hasOutput={hasOutput}
          companyId={companyId}
        />
      </div>
    </div>
  );
});
