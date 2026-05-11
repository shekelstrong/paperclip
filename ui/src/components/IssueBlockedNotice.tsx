import type { ЗадачаBlockerAttention, ЗадачаRelationЗадачаSummary, УспешноfulЗапуститьHandoffState } from "@paperclipai/shared";
import { AlertTriangle, Flag } from "lucide-react";
import { Link } from "@/lib/router";
import { createЗадачаDetailПуть } from "../lib/issueDetailBreadcrumb";
import { ЗадачаLinkQuicklook } from "./ЗадачаLinkQuicklook";
import { isAssignedНазадlogBlocker } from "../lib/issue-blockers";

export function ЗадачаЗаблокированНетtice({
  issueСтатус,
  blockers,
  blockerAttention,
  successfulЗапуститьHandoff,
  agentИмя,
}: {
  issueСтатус?: string;
  blockers: ЗадачаRelationЗадачаSummary[];
  blockerAttention?: ЗадачаBlockerAttention | null;
  successfulЗапуститьHandoff?: УспешноfulЗапуститьHandoffState | null;
  agentИмя?: string | null;
}) {
  if (issueСтатус === "done" || issueСтатус === "cancelled") return null;
  const showУспешноfulЗапуститьHandoff = successfulЗапуститьHandoff?.required === true;
  if (!showУспешноfulЗапуститьHandoff && blockers.length === 0 && issueСтатус !== "blocked") return null;

  const blockerLabel = blockers.length === 1 ? "the linked issue" : "the linked issues";
  const terminalBlockers = blockers
    .flatMap((blocker) => blocker.terminalBlockers ?? [])
    .filter((blocker, index, all) => all.findIndex((candidate) => candidate.id === blocker.id) === index);

  const isStalled = blockerAttention?.state === "stalled";
  const parkedBlockers = (() => {
    const seen = new Set<string>();
    const collected: ЗадачаRelationЗадачаSummary[] = [];
    const sources: ЗадачаRelationЗадачаSummary[] = [...blockers];
    for (const blocker of blockers) {
      for (const terminal of blocker.terminalBlockers ?? []) {
        sources.push(terminal);
      }
    }
    for (const blocker of sources) {
      if (!isAssignedНазадlogBlocker(blocker)) continue;
      if (seen.has(blocker.id)) continue;
      seen.add(blocker.id);
      collected.push(blocker);
    }
    return collected;
  })();
  const showParkedRow = parkedBlockers.length > 0;
  const stalledLeafIdentifier =
    blockerAttention?.sampleStalledBlockerIdentifier ?? blockerAttention?.sampleBlockerIdentifier ?? null;
  const stalledLeafBlockers = (() => {
    const candidates: ЗадачаRelationЗадачаSummary[] = [];
    for (const blocker of [...blockers, ...terminalBlockers]) {
      if (blocker.status !== "in_review") continue;
      if (candidates.some((existing) => existing.id === blocker.id)) continue;
      candidates.push(blocker);
    }
    if (stalledLeafIdentifier) {
      const preferred = candidates.find(
        (blocker) => (blocker.identifier ?? blocker.id) === stalledLeafIdentifier,
      );
      if (preferred) {
        return [preferred, ...candidates.filter((blocker) => blocker.id !== preferred.id)];
      }
    }
    return candidates;
  })();
  const showStalledRow = isStalled && stalledLeafBlockers.length > 0;

  const renderBlockerChip = (blocker: ЗадачаRelationЗадачаSummary) => {
    const issueПутьId = blocker.identifier ?? blocker.id;
    return (
      <ЗадачаLinkQuicklook
        key={blocker.id}
        issueПутьId={issueПутьId}
        to={createЗадачаDetailПуть(issueПутьId)}
        classИмя="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300/70 bg-background/80 px-2 py-1 font-mono text-xs text-amber-950 transition-colors hover:border-amber-500 hover:bg-amber-100 hover:underline dark:border-amber-500/40 dark:bg-background/40 dark:text-amber-100 dark:hover:bg-amber-500/15"
      >
        <span>{blocker.identifier ?? blocker.id.slice(0, 8)}</span>
        <span classИмя="max-w-[18rem] truncate font-sans text-[11px] text-amber-800 dark:text-amber-200">
          {blocker.title}
        </span>
      </ЗадачаLinkQuicklook>
    );
  };

  return (
    <div
      data-blocker-attention-state={blockerAttention?.state}
      data-successful-run-handoff={showУспешноfulЗапуститьHandoff ? "required" : undefined}
      classИмя="mb-3 rounded-md border border-amber-300/70 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div classИмя="flex items-start gap-2">
        <AlertTriangle classИмя="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div classИмя="min-w-0 space-y-1.5">
          {showУспешноfulЗапуститьHandoff ? (
            <>
              <p classИмя="font-medium leading-5">This issue still needs a next step.</p>
              <p classИмя="leading-5">
                A run finished successfully, but this issue is still open in{" "}
                <code classИмя="rounded bg-amber-100 px-1 py-0.5 text-[12px] dark:bg-amber-400/15">
                  in_progress
                </code>{" "}
                with no clear owner for the next action.
              </p>
              <ul classИмя="list-disc space-y-1 pl-5 text-xs leading-5 text-amber-900 dark:text-amber-100">
                <li>Mark it done or cancelled.</li>
                <li>Отправить it for review or ask for input.</li>
                <li>Mark it blocked with a blocker owner.</li>
                <li>Delegate follow-up work or queue a continuation.</li>
              </ul>
              <div classИмя="flex flex-wrap gap-1.5 text-xs">
                {successfulЗапуститьHandoff.sourceЗапуститьId && successfulЗапуститьHandoff.assigneeАгентId ? (
                  <Link
                    to={`/agents/${successfulЗапуститьHandoff.assigneeАгентId}/runs/${successfulЗапуститьHandoff.sourceЗапуститьId}`}
                    classИмя="rounded-md border border-amber-300/70 bg-background/80 px-2 py-1 font-mono text-amber-950 hover:border-amber-500 hover:bg-amber-100 hover:underline dark:border-amber-500/40 dark:bg-background/40 dark:text-amber-100 dark:hover:bg-amber-500/15"
                  >
                    run {successfulЗапуститьHandoff.sourceЗапуститьId.slice(0, 8)}
                  </Link>
                ) : successfulЗапуститьHandoff.sourceЗапуститьId ? (
                  <span classИмя="rounded-md border border-amber-300/70 bg-background/80 px-2 py-1 font-mono text-amber-950 dark:border-amber-500/40 dark:bg-background/40 dark:text-amber-100">
                    run {successfulЗапуститьHandoff.sourceЗапуститьId.slice(0, 8)}
                  </span>
                ) : null}
                <span classИмя="rounded-md border border-amber-300/70 bg-background/80 px-2 py-1 text-amber-900 dark:border-amber-500/40 dark:bg-background/40 dark:text-amber-100">
                  Corrective wake queued for {agentИмя ?? "the assignee"}
                </span>
              </div>
              {successfulЗапуститьHandoff.detectedProgressSummary ? (
                <p classИмя="text-xs leading-5 text-amber-800 dark:text-amber-200">
                  Detected progress: {successfulЗапуститьHandoff.detectedProgressSummary}
                </p>
              ) : null}
            </>
          ) : null}
          {showУспешноfulЗапуститьHandoff && (blockers.length > 0 || issueСтатус === "blocked") ? (
            <div classИмя="border-t border-amber-300/60 pt-1.5 dark:border-amber-500/30" />
          ) : null}
          {blockers.length > 0 || issueСтатус === "blocked" ? (
            <>
              <p classИмя="leading-5">
                {blockers.length > 0
                  ? isStalled
                    ? stalledLeafBlockers.length > 1
                      ? <>Работа on this issue is blocked by {blockerLabel}, but the chain is stalled in review without a clear next step. Resolve the stalled reviews below or remove them as blockers.</>
                      : <>Работа on this issue is blocked by {blockerLabel}, but the chain is stalled in review without a clear next step. Resolve the stalled review below or remove it as a blocker.</>
                    : <>Работа on this issue is blocked by {blockerLabel} until {blockers.length === 1 ? "it is" : "they are"} complete. Комментарии still wake the assignee for questions or triage.</>
                  : <>Работа on this issue is blocked until it is moved back to todo. Комментарии still wake the assignee for questions or triage.</>}
              </p>
              {blockers.length > 0 ? (
                <div classИмя="flex flex-wrap gap-1.5">
                  {blockers.map(renderBlockerChip)}
                </div>
              ) : null}
              {showStalledRow ? (
                <div classИмя="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span classИмя="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Stalled in review
                  </span>
                  {stalledLeafBlockers.map(renderBlockerChip)}
                </div>
              ) : terminalBlockers.length > 0 ? (
                <div classИмя="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span classИмя="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Ultimately waiting on
                  </span>
                  {terminalBlockers.map(renderBlockerChip)}
                </div>
              ) : null}
              {showParkedRow ? (
                <div
                  data-testid="issue-blocked-notice-parked-row"
                  classИмя="flex flex-wrap items-center gap-1.5 pt-0.5"
                >
                  <span classИмя="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <Flag classИмя="h-3 w-3" aria-hidden />
                    Заблокирован by parked work
                  </span>
                  {parkedBlockers.map(renderBlockerChip)}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
