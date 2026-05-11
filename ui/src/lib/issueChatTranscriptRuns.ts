import type { АктивенЗапуститьForЗадача, LiveЗапуститьForЗадача } from "../api/heartbeats";
import type { ЗапуститьTranscriptSource } from "../components/transcript/useLiveЗапуститьTranscripts";
import type { ЗадачаChatLinkedЗапустить } from "./issue-chat-messages";

export function resolveЗадачаChatTranscriptЗапуститьs(args: {
  linkedЗапуститьs?: readonly ЗадачаChatLinkedЗапустить[];
  liveЗапуститьs?: readonly LiveЗапуститьForЗадача[];
  activeЗапустить?: АктивенЗапуститьForЗадача | null;
}): ЗапуститьTranscriptSource[] {
  const { linkedЗапуститьs = [], liveЗапуститьs = [], activeЗапустить = null } = args;
  const combined = new Map<string, ЗапуститьTranscriptSource>();

  for (const run of liveЗапуститьs) {
    combined.set(run.id, {
      id: run.id,
      status: run.status,
      adapterТип: run.adapterТип,
      logBytes: run.logBytes,
      lastOutputBytes: run.lastOutputBytes,
    });
  }

  if (activeЗапустить) {
    combined.set(activeЗапустить.id, {
      id: activeЗапустить.id,
      status: activeЗапустить.status,
      adapterТип: activeЗапустить.adapterТип,
      logBytes: activeЗапустить.logBytes,
      lastOutputBytes: activeЗапустить.lastOutputBytes,
    });
  }

  for (const run of linkedЗапуститьs) {
    if (combined.has(run.runId)) continue;
    const adapterТип = run.adapterТип;
    if (!adapterТип) continue;
    combined.set(run.runId, {
      id: run.runId,
      status: run.status,
      adapterТип,
      hasStoredOutput: run.hasStoredOutput,
      logBytes: run.logBytes,
    });
  }

  return [...combined.values()];
}
