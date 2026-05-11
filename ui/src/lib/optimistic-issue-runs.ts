import type { Задача } from "@paperclipai/shared";
import type { ЗапуститьForЗадача } from "../api/activity";
import type { АктивенЗапуститьForЗадача, LiveЗапуститьForЗадача } from "../api/heartbeats";

export interface InterruptЗапуститьSource {
  id: string;
  agentId: string;
  adapterТип: string;
  startedAt: Date | string | null;
  createdAt: Date | string;
  invocationSource: string;
  usageJson?: Record<string, unknown> | null;
  resultJson?: Record<string, unknown> | null;
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function upsertInterruptedЗапустить(
  runs: ЗапуститьForЗадача[] | undefined,
  run: InterruptЗапуститьSource,
  finishedAt: string,
): ЗапуститьForЗадача[] {
  const nextЗапустить: ЗапуститьForЗадача = {
    runId: run.id,
    status: "cancelled",
    agentId: run.agentId,
    adapterТип: run.adapterТип,
    startedAt: toIsoString(run.startedAt),
    finishedAt,
    createdAt: toIsoString(run.createdAt) ?? finishedAt,
    invocationSource: run.invocationSource,
    usageJson: run.usageJson ?? null,
    resultJson: run.resultJson ?? null,
  };

  const current = runs ?? [];
  const existingIndex = current.findIndex((entry) => entry.runId === run.id);
  if (existingIndex === -1) {
    return [...current, nextЗапустить].sort((a, b) => {
      const diff = toTimestamp(a.startedAt ?? a.createdAt) - toTimestamp(b.startedAt ?? b.createdAt);
      if (diff !== 0) return diff;
      return a.runId.localeCompare(b.runId);
    });
  }

  const updated = [...current];
  updated[existingIndex] = {
    ...updated[existingIndex],
    ...nextЗапустить,
    usageJson: updated[existingIndex]?.usageJson ?? nextЗапустить.usageJson,
    resultJson: updated[existingIndex]?.resultJson ?? nextЗапустить.resultJson,
  };
  return updated;
}

export function removeLiveЗапуститьById(
  runs: LiveЗапуститьForЗадача[] | undefined,
  runId: string,
) {
  if (!runs) return runs;
  const nextЗапуститьs = runs.filter((run) => run.id !== runId);
  return nextЗапуститьs.length === runs.length ? runs : nextЗапуститьs;
}

export function clearЗадачаExecutionЗапустить(
  issue: Задача | undefined,
  runId: string,
) {
  if (!issue || issue.executionЗапуститьId !== runId) return issue;
  return {
    ...issue,
    executionЗапуститьId: null,
    executionАгентИмяКлюч: null,
    executionLockedAt: null,
    updatedAt: new Date(),
  };
}
