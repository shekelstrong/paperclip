import type { АктивностьEvent, ЗапуститьLivenessState } from "@paperclipai/shared";
import { api } from "./client";

export type { ЗапуститьLivenessState } from "@paperclipai/shared";

export interface ЗапуститьForЗадача {
  runId: string;
  status: string;
  agentId: string;
  adapterТип: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  invocationSource: string;
  usageJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
  logBytes?: number | null;
  retryOfЗапуститьId?: string | null;
  scheduledПовторитьAt?: string | null;
  scheduledПовторитьAttempt?: number;
  scheduledПовторитьReason?: string | null;
  retryExhaustedReason?: string | null;
  livenessState?: ЗапуститьLivenessState | null;
  livenessReason?: string | null;
  continuationAttempt?: number;
  lastUsefulActionAt?: string | null;
  nextAction?: string | null;
  contextSnapshot?: Record<string, unknown> | null;
  environment?: {
    id: string;
    name: string;
    driver: string;
  } | null;
  environmentLease?: {
    id: string;
    status: string;
    leasePolicy: string;
    provider: string | null;
    providerLeaseId: string | null;
    executionРабочая областьId: string | null;
    workspaceПуть: string | null;
    failureReason: string | null;
    cleanupСтатус: string | null;
    acquiredAt: string | Date;
    releasedAt: string | Date | null;
  } | null;
}

export interface ЗадачаForЗапустить {
  issueId: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
}

export const activityApi = {
  list: (companyId: string, filters?: { entityТип?: string; entityId?: string; agentId?: string; limit?: number }) => {
    const params = new URLПоискParams();
    if (filters?.entityТип) params.set("entityТип", filters.entityТип);
    if (filters?.entityId) params.set("entityId", filters.entityId);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return api.get<АктивностьEvent[]>(`/companies/${companyId}/activity${qs ? `?${qs}` : ""}`);
  },
  forЗадача: (issueId: string) => api.get<АктивностьEvent[]>(`/issues/${issueId}/activity`),
  runsForЗадача: (issueId: string) => api.get<ЗапуститьForЗадача[]>(`/issues/${issueId}/runs`),
  issuesForЗапустить: (runId: string) => api.get<ЗадачаForЗапустить[]>(`/heartbeat-runs/${runId}/issues`),
};
