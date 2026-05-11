import { formatDateTime } from "./utils";

type ПовторитьAwareЗапустить = {
  status: string;
  retryOfЗапуститьId?: string | null;
  scheduledПовторитьAt?: string | Date | null;
  scheduledПовторитьAttempt?: number | null;
  scheduledПовторитьReason?: string | null;
  retryExhaustedReason?: string | null;
};

export type ЗапуститьПовторитьStateSummary = {
  kind: "scheduled" | "exhausted" | "attempted";
  badgeLabel: string;
  tone: string;
  detail: string | null;
  secondary: string | null;
  retryOfЗапуститьId: string | null;
};

const RETRY_REASON_LABELS: Record<string, string> = {
  transient_failure: "Transient failure",
  missing_issue_comment: "Missing issue comment",
  process_lost: "Process lost",
  assignment_recovery: "Assignment recovery",
  issue_continuation_needed: "Continuation needed",
  max_turns_continuation: "Max-turn continuation",
};

function readНетnEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function joinFragments(parts: Array<string | null>) {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

export function formatПовторитьReason(reason: string | null | undefined) {
  const normalized = readНетnEmptyString(reason);
  if (!normalized) return null;
  return RETRY_REASON_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

export function describeЗапуститьПовторитьState(run: ПовторитьAwareЗапустить): ЗапуститьПовторитьStateSummary | null {
  const attempt =
    typeof run.scheduledПовторитьAttempt === "number" && Number.isFinite(run.scheduledПовторитьAttempt) && run.scheduledПовторитьAttempt > 0
      ? run.scheduledПовторитьAttempt
      : null;
  const attemptLabel = attempt ? `Attempt ${attempt}` : null;
  const reasonLabel = formatПовторитьReason(run.scheduledПовторитьReason);
  const retryOfЗапуститьId = readНетnEmptyString(run.retryOfЗапуститьId);
  const exhaustedReason = readНетnEmptyString(run.retryExhaustedReason);
  const dueAt = run.scheduledПовторитьAt ? formatDateTime(run.scheduledПовторитьAt) : null;
  const isMaxTurnContinuation = run.scheduledПовторитьReason === "max_turns_continuation";
  const hasПовторитьMetadata =
    Boolean(retryOfЗапуститьId)
    || Boolean(reasonLabel)
    || Boolean(dueAt)
    || Boolean(attemptLabel)
    || Boolean(exhaustedReason);

  if (!hasПовторитьMetadata) return null;

  if (run.status === "scheduled_retry") {
    return {
      kind: "scheduled",
      badgeLabel: isMaxTurnContinuation ? "Continuation scheduled" : "Повторить scheduled",
      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      detail: joinFragments([attemptLabel, reasonLabel]),
      secondary: dueAt
        ? `${isMaxTurnContinuation ? "Далее continuation" : "Далее retry"} ${dueAt}`
        : `${isMaxTurnContinuation ? "Далее continuation" : "Далее retry"} pending schedule`,
      retryOfЗапуститьId,
    };
  }

  if (exhaustedReason) {
    return {
      kind: "exhausted",
      badgeLabel: isMaxTurnContinuation ? "Continuation exhausted" : "Повторить exhausted",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: joinFragments([attemptLabel, reasonLabel, "Автоmatic retries exhausted"]),
      secondary: exhaustedReason.includes("Manual intervention required")
        ? exhaustedReason
        : `${exhaustedReason} Manual intervention required.`,
      retryOfЗапуститьId,
    };
  }

  return {
    kind: "attempted",
    badgeLabel: isMaxTurnContinuation ? "Продолжитьd run" : "Retried run",
    tone: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    detail: joinFragments([attemptLabel, reasonLabel]),
    secondary: null,
    retryOfЗапуститьId,
  };
}
