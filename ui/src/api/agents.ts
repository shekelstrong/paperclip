import type {
  Агент,
  АгентDetail,
  АгентInstructionsBundle,
  АгентInstructionsFileDetail,
  АгентНавыкSnapshot,
  АдаптерОкружениеПроверитьResult,
  АгентКлючСоздано,
  АгентЗапуститьtimeState,
  АгентЗадачаSession,
  АгентWakeupResponse,
  HeartbeatЗапустить,
  Согласование,
  АгентConfigRevision,
} from "@paperclipai/shared";
import type {
  АдаптерМодельПрофильDefinition,
  АдаптерМодельПрофильКлюч,
} from "@paperclipai/adapter-utils";
import { isUuidLike, normalizeАгентUrlКлюч } from "@paperclipai/shared";
import { ApiОшибка, api } from "./client";

export interface АгентКлюч {
  id: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface АдаптерМодель {
  id: string;
  label: string;
}

export type { АдаптерМодельПрофильКлюч };
export type АдаптерМодельПрофиль = АдаптерМодельПрофильDefinition;

export interface DetectedАдаптерМодель {
  model: string;
  provider: string;
  source: string;
  candidates?: string[];
}

export interface ClaudeLoginResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  loginUrl: string | null;
  stdout: string;
  stderr: string;
}

export interface ОргструктураНетde {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: ОргструктураНетde[];
}

export interface АгентHireResponse {
  agent: Агент;
  approval: Согласование | null;
}

export interface АгентPermissionОбновить {
  canСоздатьАгенты: boolean;
  canAssignЗадачи: boolean;
}

export interface АгентWakeRequest {
  source?: "timer" | "assignment" | "on_demand" | "automation";
  triggerDetail?: "manual" | "ping" | "callback" | "system";
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  idempotencyКлюч?: string | null;
  forceFreshSession?: boolean;
}

function withКомпанияОбласть(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

function agentПуть(id: string, companyId?: string, suffix = "") {
  return withКомпанияОбласть(`/agents/${encodeURIComponent(id)}${suffix}`, companyId);
}

export const agentsApi = {
  list: (companyId: string) => api.get<Агент[]>(`/companies/${companyId}/agents`),
  org: (companyId: string) => api.get<ОргструктураНетde[]>(`/companies/${companyId}/org`),
  listКонфигурацияs: (companyId: string) =>
    api.get<Record<string, unknown>[]>(`/companies/${companyId}/agent-configurations`),
  get: async (id: string, companyId?: string) => {
    try {
      return await api.get<АгентDetail>(agentПуть(id, companyId));
    } catch (error) {
      // Назадward-compat fallback: if backend shortname lookup reports ambiguity,
      // resolve using company agent list while ignoring terminated agents.
      if (
        !(error instanceof ApiОшибка) ||
        error.status !== 409 ||
        !companyId ||
        isUuidLike(id)
      ) {
        throw error;
      }

      const urlКлюч = normalizeАгентUrlКлюч(id);
      if (!urlКлюч) throw error;

      const agents = await api.get<Агент[]>(`/companies/${companyId}/agents`);
      const matches = agents.filter(
        (agent) => agent.status !== "terminated" && normalizeАгентUrlКлюч(agent.urlКлюч) === urlКлюч,
      );
      if (matches.length !== 1) throw error;
      return api.get<АгентDetail>(agentПуть(matches[0]!.id, companyId));
    }
  },
  getКонфигурация: (id: string, companyId?: string) =>
    api.get<Record<string, unknown>>(agentПуть(id, companyId, "/configuration")),
  listConfigRevisions: (id: string, companyId?: string) =>
    api.get<АгентConfigRevision[]>(agentПуть(id, companyId, "/config-revisions")),
  getConfigRevision: (id: string, revisionId: string, companyId?: string) =>
    api.get<АгентConfigRevision>(agentПуть(id, companyId, `/config-revisions/${revisionId}`)),
  rollbackConfigRevision: (id: string, revisionId: string, companyId?: string) =>
    api.post<Агент>(agentПуть(id, companyId, `/config-revisions/${revisionId}/rollback`), {}),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Агент>(`/companies/${companyId}/agents`, data),
  hire: (companyId: string, data: Record<string, unknown>) =>
    api.post<АгентHireResponse>(`/companies/${companyId}/agent-hires`, data),
  update: (id: string, data: Record<string, unknown>, companyId?: string) =>
    api.patch<Агент>(agentПуть(id, companyId), data),
  updatePermissions: (id: string, data: АгентPermissionОбновить, companyId?: string) =>
    api.patch<АгентDetail>(agentПуть(id, companyId, "/permissions"), data),
  instructionsBundle: (id: string, companyId?: string) =>
    api.get<АгентInstructionsBundle>(agentПуть(id, companyId, "/instructions-bundle")),
  updateInstructionsBundle: (
    id: string,
    data: {
      mode?: "managed" | "external";
      rootПуть?: string | null;
      entryFile?: string;
      clearLegacyPromptTemplate?: boolean;
    },
    companyId?: string,
  ) => api.patch<АгентInstructionsBundle>(agentПуть(id, companyId, "/instructions-bundle"), data),
  instructionsFile: (id: string, relativeПуть: string, companyId?: string) =>
    api.get<АгентInstructionsFileDetail>(
      agentПуть(id, companyId, `/instructions-bundle/file?path=${encodeURIComponent(relativeПуть)}`),
    ),
  saveInstructionsFile: (
    id: string,
    data: { path: string; content: string; clearLegacyPromptTemplate?: boolean },
    companyId?: string,
  ) => api.put<АгентInstructionsFileDetail>(agentПуть(id, companyId, "/instructions-bundle/file"), data),
  deleteInstructionsFile: (id: string, relativeПуть: string, companyId?: string) =>
    api.delete<АгентInstructionsBundle>(
      agentПуть(id, companyId, `/instructions-bundle/file?path=${encodeURIComponent(relativeПуть)}`),
    ),
  pause: (id: string, companyId?: string) => api.post<Агент>(agentПуть(id, companyId, "/pause"), {}),
  resume: (id: string, companyId?: string) => api.post<Агент>(agentПуть(id, companyId, "/resume"), {}),
  approve: (id: string, companyId?: string) => api.post<Агент>(agentПуть(id, companyId, "/approve"), {}),
  terminate: (id: string, companyId?: string) => api.post<Агент>(agentПуть(id, companyId, "/terminate"), {}),
  remove: (id: string, companyId?: string) => api.delete<{ ok: true }>(agentПуть(id, companyId)),
  listКлючs: (id: string, companyId?: string) => api.get<АгентКлюч[]>(agentПуть(id, companyId, "/keys")),
  skills: (id: string, companyId?: string) =>
    api.get<АгентНавыкSnapshot>(agentПуть(id, companyId, "/skills")),
  syncНавыки: (id: string, desiredНавыки: string[], companyId?: string) =>
    api.post<АгентНавыкSnapshot>(agentПуть(id, companyId, "/skills/sync"), { desiredНавыки }),
  createКлюч: (id: string, name: string, companyId?: string) =>
    api.post<АгентКлючСоздано>(agentПуть(id, companyId, "/keys"), { name }),
  revokeКлюч: (agentId: string, keyId: string, companyId?: string) =>
    api.delete<{ ok: true }>(agentПуть(agentId, companyId, `/keys/${encodeURIComponent(keyId)}`)),
  runtimeState: (id: string, companyId?: string) =>
    api.get<АгентЗапуститьtimeState>(agentПуть(id, companyId, "/runtime-state")),
  taskSessions: (id: string, companyId?: string) =>
    api.get<АгентЗадачаSession[]>(agentПуть(id, companyId, "/task-sessions")),
  resetSession: (id: string, taskКлюч?: string | null, companyId?: string) =>
    api.post<void>(agentПуть(id, companyId, "/runtime-state/reset-session"), { taskКлюч: taskКлюч ?? null }),
  adapterМодельs: (
    companyId: string,
    type: string,
    options?: { refresh?: boolean; environmentId?: string | null },
  ) => {
    const params = new URLПоискParams();
    if (options?.refresh) params.set("refresh", "1");
    if (options?.environmentId) params.set("environmentId", options.environmentId);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return api.get<АдаптерМодель[]>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/models${query}`,
    );
  },
  detectМодель: (companyId: string, type: string) =>
    api.get<DetectedАдаптерМодель | null>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/detect-model`,
    ),
  adapterМодельПрофильs: (companyId: string, type: string) =>
    api.get<АдаптерМодельПрофиль[]>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/model-profiles`,
    ),
  testОкружение: (
    companyId: string,
    type: string,
    data: {
      adapterConfig: Record<string, unknown>;
      environmentId?: string | null;
    },
  ) =>
    api.post<АдаптерОкружениеПроверитьResult>(
      `/companies/${companyId}/adapters/${type}/test-environment`,
      data,
    ),
  invoke: (id: string, companyId?: string, data: АгентWakeRequest = {}) =>
    api.post<HeartbeatЗапустить>(agentПуть(id, companyId, "/heartbeat/invoke"), data),
  wakeup: (
    id: string,
    data: АгентWakeRequest,
    companyId?: string,
  ) => api.post<АгентWakeupResponse>(agentПуть(id, companyId, "/wakeup"), data),
  loginWithClaude: (id: string, companyId?: string) =>
    api.post<ClaudeLoginResult>(agentПуть(id, companyId, "/claude-login"), {}),
  availableНавыки: () =>
    api.get<{ skills: AvailableНавык[] }>("/skills/available"),
};

export interface AvailableНавык {
  name: string;
  description: string;
  isPaperclipManaged: boolean;
}
