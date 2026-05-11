import type {
  ExecutionРабочая область,
  ExecutionРабочая областьSummary,
  ExecutionРабочая областьЗакрытьReadiness,
  Рабочая областьOperation,
  Рабочая областьЗапуститьtimeControlЦель,
} from "@paperclipai/shared";
import { api } from "./client";
import { sanitizeРабочая областьЗапуститьtimeControlЦель } from "./workspace-runtime-control";

export const executionРабочие областиApi = {
  listSummaries: (
    companyId: string,
    filters?: {
      projectId?: string;
      projectРабочая областьId?: string;
      issueId?: string;
      status?: string;
      reuseEligible?: boolean;
    },
  ) => {
    const params = new URLПоискParams();
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.projectРабочая областьId) params.set("projectРабочая областьId", filters.projectРабочая областьId);
    if (filters?.issueId) params.set("issueId", filters.issueId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.reuseEligible) params.set("reuseEligible", "true");
    params.set("summary", "true");
    const qs = params.toString();
    return api.get<ExecutionРабочая областьSummary[]>(
      `/companies/${companyId}/execution-workspaces${qs ? `?${qs}` : ""}`,
    );
  },
  list: (
    companyId: string,
    filters?: {
      projectId?: string;
      projectРабочая областьId?: string;
      issueId?: string;
      status?: string;
      reuseEligible?: boolean;
    },
  ) => {
    const params = new URLПоискParams();
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.projectРабочая областьId) params.set("projectРабочая областьId", filters.projectРабочая областьId);
    if (filters?.issueId) params.set("issueId", filters.issueId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.reuseEligible) params.set("reuseEligible", "true");
    const qs = params.toString();
    return api.get<ExecutionРабочая область[]>(`/companies/${companyId}/execution-workspaces${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api.get<ExecutionРабочая область>(`/execution-workspaces/${id}`),
  getЗакрытьReadiness: (id: string) =>
    api.get<ExecutionРабочая областьЗакрытьReadiness>(`/execution-workspaces/${id}/close-readiness`),
  listРабочая областьOperations: (id: string) =>
    api.get<Рабочая областьOperation[]>(`/execution-workspaces/${id}/workspace-operations`),
  controlЗапуститьtimeServices: (
    id: string,
    action: "start" | "stop" | "restart",
    target: Рабочая областьЗапуститьtimeControlЦель = {},
  ) =>
    api.post<{ workspace: ExecutionРабочая область; operation: Рабочая областьOperation }>(
      `/execution-workspaces/${id}/runtime-services/${action}`,
      sanitizeРабочая областьЗапуститьtimeControlЦель(target),
    ),
  controlЗапуститьtimeКоманды: (
    id: string,
    action: "start" | "stop" | "restart" | "run",
    target: Рабочая областьЗапуститьtimeControlЦель = {},
  ) =>
    api.post<{ workspace: ExecutionРабочая область; operation: Рабочая областьOperation }>(
      `/execution-workspaces/${id}/runtime-commands/${action}`,
      sanitizeРабочая областьЗапуститьtimeControlЦель(target),
    ),
  update: (id: string, data: Record<string, unknown>) => api.patch<ExecutionРабочая область>(`/execution-workspaces/${id}`, data),
};
