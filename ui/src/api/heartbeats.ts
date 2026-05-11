import type {
  HeartbeatЗапустить,
  HeartbeatЗапуститьEvent,
  InstanceРасписаниеrHeartbeatАгент,
  Рабочая областьOperation,
} from "@paperclipai/shared";
import { api } from "./client";

export interface ЗапуститьLivenessFields {
  livenessState: HeartbeatЗапустить["livenessState"];
  livenessReason: string | null;
  continuationAttempt: number;
  lastUsefulActionAt: string | Date | null;
  nextAction: string | null;
}

export interface АктивенЗапуститьForЗадача {
  id: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  contextCommentId?: string | null;
  contextWakeCommentId?: string | null;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
  createdAt: string | Date;
  agentId: string;
  agentИмя: string;
  adapterТип: string;
  logBytes?: number | null;
  lastOutputBytes?: number | null;
  issueId?: string | null;
  livenessState?: ЗапуститьLivenessFields["livenessState"];
  livenessReason?: string | null;
  continuationAttempt?: number;
  lastUsefulActionAt?: string | Date | null;
  nextAction?: string | null;
  outputSilence?: HeartbeatЗапустить["outputSilence"];
}

export interface LiveЗапуститьForЗадача {
  id: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  contextCommentId?: string | null;
  contextWakeCommentId?: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  agentId: string;
  agentИмя: string;
  adapterТип: string;
  logBytes?: number | null;
  lastOutputBytes?: number | null;
  issueId?: string | null;
  livenessState?: ЗапуститьLivenessFields["livenessState"];
  livenessReason?: string | null;
  continuationAttempt?: number;
  lastUsefulActionAt?: string | null;
  nextAction?: string | null;
  outputSilence?: HeartbeatЗапустить["outputSilence"];
}

export interface WatchdogDecisionInput {
  runId: string;
  decision: "snooze" | "continue" | "dismissed_false_positive";
  evaluationЗадачаId?: string | null;
  reason?: string | null;
  snoozedUntil?: string | null;
}

export const heartbeatsApi = {
  list: (companyId: string, agentId?: string, limit?: number) => {
    const searchParams = new URLПоискParams();
    if (agentId) searchParams.set("agentId", agentId);
    if (limit) searchParams.set("limit", String(limit));
    const qs = searchParams.toString();
    return api.get<HeartbeatЗапустить[]>(`/companies/${companyId}/heartbeat-runs${qs ? `?${qs}` : ""}`);
  },
  get: (runId: string) => api.get<HeartbeatЗапустить>(`/heartbeat-runs/${runId}`),
  events: (runId: string, afterSeq = 0, limit = 200) =>
    api.get<HeartbeatЗапуститьEvent[]>(
      `/heartbeat-runs/${runId}/events?afterSeq=${encodeURIComponent(String(afterSeq))}&limit=${encodeURIComponent(String(limit))}`,
    ),
  log: (runId: string, offset = 0, limitBytes = 256000) =>
    api.get<{ runId: string; store: string; logRef: string; content: string; nextOffset?: number }>(
      `/heartbeat-runs/${runId}/log?offset=${encodeURIComponent(String(offset))}&limitBytes=${encodeURIComponent(String(limitBytes))}`,
    ),
  workspaceOperations: (runId: string) =>
    api.get<Рабочая областьOperation[]>(`/heartbeat-runs/${runId}/workspace-operations`),
  workspaceOperationLog: (operationId: string, offset = 0, limitBytes = 256000) =>
    api.get<{ operationId: string; store: string; logRef: string; content: string; nextOffset?: number }>(
      `/workspace-operations/${operationId}/log?offset=${encodeURIComponent(String(offset))}&limitBytes=${encodeURIComponent(String(limitBytes))}`,
    ),
  cancel: (runId: string) => api.post<void>(`/heartbeat-runs/${runId}/cancel`, {}),
  recordWatchdogDecision: (input: WatchdogDecisionInput) =>
    api.post(`/heartbeat-runs/${input.runId}/watchdog-decisions`, {
      decision: input.decision,
      evaluationЗадачаId: input.evaluationЗадачаId ?? null,
      reason: input.reason ?? null,
      snoozedUntil: input.snoozedUntil ?? null,
    }),
  liveЗапуститьsForЗадача: (issueId: string) =>
    api.get<LiveЗапуститьForЗадача[]>(`/issues/${issueId}/live-runs`),
  activeЗапуститьForЗадача: (issueId: string) =>
    api.get<АктивенЗапуститьForЗадача | null>(`/issues/${issueId}/active-run`),
  liveЗапуститьsForКомпания: (
    companyId: string,
    options?: number | { minCount?: number; limit?: number },
  ) => {
    const searchParams = new URLПоискParams();
    if (typeof options === "number") {
      searchParams.set("minCount", String(options));
    } else if (options) {
      if (options.minCount) searchParams.set("minCount", String(options.minCount));
      if (options.limit) searchParams.set("limit", String(options.limit));
    }
    const qs = searchParams.toString();
    return api.get<LiveЗапуститьForЗадача[]>(`/companies/${companyId}/live-runs${qs ? `?${qs}` : ""}`);
  },
  listInstanceРасписаниеrАгенты: () =>
    api.get<InstanceРасписаниеrHeartbeatАгент[]>("/instance/scheduler-heartbeats"),
};
