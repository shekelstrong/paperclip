import { memo, useMemo } from "react";
import type { TranscriptEntry } from "../adapters";
import type { LiveЗапуститьForЗадача } from "../api/heartbeats";
import { ЗадачаChatThread } from "./ЗадачаChatThread";
import type { ЗадачаChatLinkedЗапустить } from "../lib/issue-chat-messages";

const EMPTY_COMMENTS: [] = [];
const EMPTY_TIMELINE_EVENTS: [] = [];
const EMPTY_LIVE_RUNS: [] = [];
const EMPTY_LINKED_RUNS: [] = [];
const handleEmbeddedДобавить = async () => {};

function isЗапуститьАктивен(run: LiveЗапуститьForЗадача) {
  return run.status === "queued" || run.status === "running";
}

interface ЗапуститьChatSurfaceProps {
  run: LiveЗапуститьForЗадача;
  transcript: TranscriptEntry[];
  hasOutput: boolean;
  companyId?: string | null;
}

export const ЗапуститьChatSurface = memo(function ЗапуститьChatSurface({
  run,
  transcript,
  hasOutput,
  companyId,
}: ЗапуститьChatSurfaceProps) {
  const active = isЗапуститьАктивен(run);
  const liveЗапуститьs = useMemo(() => (active ? [run] : EMPTY_LIVE_RUNS), [active, run]);
  const linkedЗапуститьs = useMemo<ЗадачаChatLinkedЗапустить[]>(
    () =>
      active
        ? EMPTY_LINKED_RUNS
        : [{
            runId: run.id,
            status: run.status,
            agentId: run.agentId,
            agentИмя: run.agentИмя,
            createdAt: run.createdAt,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
          }],
    [active, run],
  );
  const transcriptsByЗапуститьId = useMemo(
    () => new Map([[run.id, transcript as readonly TranscriptEntry[]]]),
    [run.id, transcript],
  );

  return (
    <ЗадачаChatThread
      comments={EMPTY_COMMENTS}
      linkedЗапуститьs={linkedЗапуститьs}
      timelineEvents={EMPTY_TIMELINE_EVENTS}
      liveЗапуститьs={liveЗапуститьs}
      companyId={companyId}
      onДобавить={handleEmbeddedДобавить}
      showComposer={false}
      showJumpToLatest={false}
      variant="embedded"
      emptyMessage={active ? "Waiting for run output..." : "Нет run output captured."}
      enableLiveTranscriptPolling={false}
      transcriptsByЗапуститьId={transcriptsByЗапуститьId}
      hasOutputForЗапустить={(runId) => runId === run.id && hasOutput}
      includeSucceededЗапуститьsWithoutOutput
    />
  );
});
