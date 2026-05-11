import type {
  АктивностьEvent,
  Процедура,
  ПроцедураDetail,
  ПроцедураListItem,
  ПроцедураRevision,
  ПроцедураЗапустить,
  ПроцедураЗапуститьSummary,
  ПроцедураTrigger,
  ПроцедураTriggerСекретMaterial,
} from "@paperclipai/shared";
import { activityApi } from "./activity";
import { api } from "./client";

export interface ПроцедураTriggerResponse {
  trigger: ПроцедураTrigger;
  secretMaterial: ПроцедураTriggerСекретMaterial | null;
}

export interface RotateПроцедураTriggerResponse {
  trigger: ПроцедураTrigger;
  secretMaterial: ПроцедураTriggerСекретMaterial;
}

export interface RestoreПроцедураRevisionСекретMaterial extends ПроцедураTriggerСекретMaterial {
  triggerId: string;
}

export interface RestoreПроцедураRevisionResponse {
  routine: Процедура;
  revision: ПроцедураRevision;
  restoredFromRevisionId: string;
  restoredFromRevisionNumber: number;
  secretMaterials: RestoreПроцедураRevisionСекретMaterial[];
}

export const routinesApi = {
  list: (companyId: string, filters?: { projectId?: string | null }) => {
    const params = new URLПоискParams();
    if (filters?.projectId) params.set("projectId", filters.projectId);
    const query = params.toString();
    return api.get<ПроцедураListItem[]>(`/companies/${companyId}/routines${query ? `?${query}` : ""}`);
  },
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Процедура>(`/companies/${companyId}/routines`, data),
  get: (id: string) => api.get<ПроцедураDetail>(`/routines/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.patch<Процедура>(`/routines/${id}`, data),
  listRevisions: (id: string) => api.get<ПроцедураRevision[]>(`/routines/${id}/revisions`),
  restoreRevision: (
    id: string,
    revisionId: string,
    body: { changeSummary?: string | null } = {},
  ) =>
    api.post<RestoreПроцедураRevisionResponse>(
      `/routines/${id}/revisions/${revisionId}/restore`,
      body,
    ),
  listЗапуститьs: (id: string, limit: number = 50) => api.get<ПроцедураЗапуститьSummary[]>(`/routines/${id}/runs?limit=${limit}`),
  createTrigger: (id: string, data: Record<string, unknown>) =>
    api.post<ПроцедураTriggerResponse>(`/routines/${id}/triggers`, data),
  updateTrigger: (id: string, data: Record<string, unknown>) =>
    api.patch<ПроцедураTrigger>(`/routine-triggers/${id}`, data),
  deleteTrigger: (id: string) => api.delete<void>(`/routine-triggers/${id}`),
  rotateTriggerСекрет: (id: string) =>
    api.post<RotateПроцедураTriggerResponse>(`/routine-triggers/${id}/rotate-secret`, {}),
  run: (id: string, data?: Record<string, unknown>) =>
    api.post<ПроцедураЗапустить>(`/routines/${id}/run`, data ?? {}),
  activity: async (
    companyId: string,
    routineId: string,
    related?: { triggerIds?: string[]; runIds?: string[] },
  ) => {
    const requests = [
      activityApi.list(companyId, { entityТип: "routine", entityId: routineId }),
      ...(related?.triggerIds ?? []).map((triggerId) =>
        activityApi.list(companyId, { entityТип: "routine_trigger", entityId: triggerId })),
      ...(related?.runIds ?? []).map((runId) =>
        activityApi.list(companyId, { entityТип: "routine_run", entityId: runId })),
    ];
    const events = (await Promise.all(requests)).flat();
    const deduped = new Map(events.map((event) => [event.id, event]));
    return [...deduped.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
};
