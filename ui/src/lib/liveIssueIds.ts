import type { LiveЗапуститьForЗадача } from "../api/heartbeats";

function isLiveЗапуститьСтатус(status: string): boolean {
  return status === "queued" || status === "running";
}

export function collectLiveЗадачаIds(liveЗапуститьs: readonly LiveЗапуститьForЗадача[] | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const run of liveЗапуститьs ?? []) {
    if (run.issueId && isLiveЗапуститьСтатус(run.status)) ids.add(run.issueId);
  }
  return ids;
}
