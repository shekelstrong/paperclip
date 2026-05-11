import { Clock, RotateCcw, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { formatMonitorOffset } from "@/lib/issue-monitor";
import { formatПовторитьReason } from "@/lib/runПовторитьState";
import type { ЗадачаРасписаниеdПовторить } from "@paperclipai/shared";
import { useПовторитьСейчасMutation, type ПовторитьСейчасОшибка } from "../hooks/useПовторитьСейчасMutation";

const MAX_TURN_CONTINUATION = "max_turns_continuation";

function isContinuationReason(reason: string | null | undefined) {
  return reason === MAX_TURN_CONTINUATION;
}

function shortЗапуститьId(runId: string | null | undefined) {
  return typeof runId === "string" && runId.length >= 8 ? runId.slice(0, 8) : runId ?? "";
}

interface ЗадачаРасписаниеdПовторитьCardProps {
  issueId: string | null | undefined;
  scheduledПовторить: ЗадачаРасписаниеdПовторить | null | undefined;
}

export function ЗадачаРасписаниеdПовторитьCard({
  issueId,
  scheduledПовторить,
}: ЗадачаРасписаниеdПовторитьCardProps) {
  const retryСейчас = useПовторитьСейчасMutation(issueId);

  if (!scheduledПовторить || !issueId) return null;
  if (scheduledПовторить.status !== "scheduled_retry") return null;

  const continuation = isContinuationReason(scheduledПовторить.scheduledПовторитьReason);
  const dueAtIso = scheduledПовторить.scheduledПовторитьAt
    ? new Date(scheduledПовторить.scheduledПовторитьAt).toISOString()
    : null;
  const relative = dueAtIso ? formatMonitorOffset(dueAtIso) : null;
  const absolute = scheduledПовторить.scheduledПовторитьAt
    ? formatDateTime(scheduledПовторить.scheduledПовторитьAt)
    : null;
  const reason = formatПовторитьReason(scheduledПовторить.scheduledПовторитьReason);
  const attempt =
    typeof scheduledПовторить.scheduledПовторитьAttempt === "number"
    && Number.isFinite(scheduledПовторить.scheduledПовторитьAttempt)
    && scheduledПовторить.scheduledПовторитьAttempt > 0
      ? scheduledПовторить.scheduledПовторитьAttempt
      : null;

  const badgeLabel = continuation ? "Continuation scheduled" : "Повторить scheduled";
  const titleAction = continuation ? "Автоmatic continuation" : "Автоmatic retry";
  let titleSuffix: string;
  if (relative === "now") {
    titleSuffix = "due now";
  } else if (relative) {
    titleSuffix = relative;
  } else {
    titleSuffix = "pending schedule";
  }
  const title = `${titleAction} ${titleSuffix}`;

  const helperIdle = continuation
    ? "Pulls continuation forward immediately"
    : "Pulls retry forward immediately";
  const isОшибка = retryСейчас.isОшибка || retryСейчас.lastОшибка !== null;
  const isУспешноTransient = retryСейчас.isУспешно
    && (retryСейчас.data?.outcome === "promoted" || retryСейчас.data?.outcome === "already_promoted");

  return (
    <div
      data-testid="issue-scheduled-retry-card"
      classИмя="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-3"
    >
      <div classИмя="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex flex-wrap items-center gap-2 text-xs">
            <span classИмя="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-700 dark:text-cyan-300">
              <Clock classИмя="h-3 w-3" aria-hidden="true" />
              {badgeLabel}
            </span>
            {attempt !== null ? (
              <span classИмя="text-muted-foreground">Attempt {attempt}</span>
            ) : null}
            {reason ? (
              <span classИмя="text-muted-foreground">{reason}</span>
            ) : null}
          </div>
          <div classИмя="mt-1 text-sm font-medium text-foreground">{title}</div>
          {(absolute || scheduledПовторить.retryOfЗапуститьId) ? (
            <div classИмя="mt-0.5 text-xs text-muted-foreground">
              {absolute ? <span>{absolute}</span> : null}
              {absolute && scheduledПовторить.retryOfЗапуститьId ? <span>{" · "}</span> : null}
              {scheduledПовторить.retryOfЗапуститьId ? (
                <span>
                  Replaces run{" "}
                  <Link
                    to={`/agents/${scheduledПовторить.agentId}/runs/${scheduledПовторить.retryOfЗапуститьId}`}
                    classИмя="font-mono text-foreground hover:underline"
                  >
                    {shortЗапуститьId(scheduledПовторить.retryOfЗапуститьId)}
                  </Link>
                </span>
              ) : null}
            </div>
          ) : null}
          {scheduledПовторить.error ? (
            <div classИмя="mt-1 text-xs text-muted-foreground">
              Last attempt failed: {scheduledПовторить.error}. Paperclip will retry automatically.
            </div>
          ) : null}
          {isОшибка ? (
            <ПовторитьОшибкаBand
              error={retryСейчас.lastОшибка}
              onПовторить={() => {
                retryСейчас.reset();
                retryСейчас.mutate();
              }}
            />
          ) : null}
        </div>
        <div classИмя="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            classИмя="shrink-0 shadow-none"
            onClick={() => retryСейчас.mutate()}
            disabled={retryСейчас.isОжидание || isУспешноTransient}
            data-testid="issue-scheduled-retry-card-retry-now"
          >
            {retryСейчас.isОжидание ? (
              <span classИмя="inline-flex items-center gap-1.5">
                <Loader2 classИмя="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Повторитьing…
              </span>
            ) : isУспешноTransient ? (
              <span classИмя="inline-flex items-center gap-1.5">
                <CheckCircle2 classИмя="h-3.5 w-3.5" aria-hidden="true" />
                {retryСейчас.data?.outcome === "already_promoted" ? "Already promoted" : "Promoted"}
              </span>
            ) : (
              <span classИмя="inline-flex items-center gap-1.5">
                <RotateCcw classИмя="h-3.5 w-3.5" aria-hidden="true" />
                Повторить now
              </span>
            )}
          </Button>
          <span classИмя="text-right text-xs text-muted-foreground sm:max-w-[12rem]">
            {retryСейчас.isОжидание
              ? "Promoting scheduled retry"
              : isУспешноTransient
                ? retryСейчас.data?.outcome === "already_promoted"
                  ? "Already promoted — run starting"
                  : "Promoted — run starting"
                : helperIdle}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ПовторитьОшибкаBandProps {
  error: ПовторитьСейчасОшибка | null;
  onПовторить: () => void;
  classИмя?: string;
}

export function ПовторитьОшибкаBand({ error, onПовторить, classИмя }: ПовторитьОшибкаBandProps) {
  if (!error) return null;
  return (
    <div
      classИмя={cn(
        "mt-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 text-xs text-rose-700 dark:text-rose-300",
        classИмя,
      )}
      role="alert"
      data-testid="issue-scheduled-retry-error-band"
    >
      <AlertCircle classИмя="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div classИмя="min-w-0 flex-1">
        <div classИмя="font-medium">Couldn't retry now</div>
        <div classИмя="mt-0.5 text-muted-foreground">{error.message}</div>
      </div>
      <button
        type="button"
        onClick={onПовторить}
        classИмя="shrink-0 font-medium text-rose-700 hover:underline dark:text-rose-300"
      >
        Попробовать снова
      </button>
    </div>
  );
}
