import type {
  Project,
  ProjectРабочая область,
  Рабочая областьOperation,
  Рабочая областьЗапуститьtimeControlЦель,
} from "@paperclipai/shared";
import { api } from "./client";
import { sanitizeРабочая областьЗапуститьtimeControlЦель } from "./workspace-runtime-control";

function withКомпанияОбласть(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

function projectПуть(id: string, companyId?: string, suffix = "") {
  return withКомпанияОбласть(`/projects/${encodeURIComponent(id)}${suffix}`, companyId);
}

export const projectsApi = {
  list: (companyId: string) => api.get<Project[]>(`/companies/${companyId}/projects`),
  get: (id: string, companyId?: string) => api.get<Project>(projectПуть(id, companyId)),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Project>(`/companies/${companyId}/projects`, data),
  update: (id: string, data: Record<string, unknown>, companyId?: string) =>
    api.patch<Project>(projectПуть(id, companyId), data),
  listРабочие области: (projectId: string, companyId?: string) =>
    api.get<ProjectРабочая область[]>(projectПуть(projectId, companyId, "/workspaces")),
  createРабочая область: (projectId: string, data: Record<string, unknown>, companyId?: string) =>
    api.post<ProjectРабочая область>(projectПуть(projectId, companyId, "/workspaces"), data),
  updateРабочая область: (projectId: string, workspaceId: string, data: Record<string, unknown>, companyId?: string) =>
    api.patch<ProjectРабочая область>(
      projectПуть(projectId, companyId, `/workspaces/${encodeURIComponent(workspaceId)}`),
      data,
    ),
  controlРабочая областьЗапуститьtimeServices: (
    projectId: string,
    workspaceId: string,
    action: "start" | "stop" | "restart",
    companyId?: string,
    target: Рабочая областьЗапуститьtimeControlЦель = {},
  ) =>
    api.post<{ workspace: ProjectРабочая область; operation: Рабочая областьOperation }>(
      projectПуть(projectId, companyId, `/workspaces/${encodeURIComponent(workspaceId)}/runtime-services/${action}`),
      sanitizeРабочая областьЗапуститьtimeControlЦель(target),
    ),
  controlРабочая областьКоманды: (
    projectId: string,
    workspaceId: string,
    action: "start" | "stop" | "restart" | "run",
    companyId?: string,
    target: Рабочая областьЗапуститьtimeControlЦель = {},
  ) =>
    api.post<{ workspace: ProjectРабочая область; operation: Рабочая областьOperation }>(
      projectПуть(projectId, companyId, `/workspaces/${encodeURIComponent(workspaceId)}/runtime-commands/${action}`),
      sanitizeРабочая областьЗапуститьtimeControlЦель(target),
    ),
  removeРабочая область: (projectId: string, workspaceId: string, companyId?: string) =>
    api.delete<ProjectРабочая область>(projectПуть(projectId, companyId, `/workspaces/${encodeURIComponent(workspaceId)}`)),
  remove: (id: string, companyId?: string) => api.delete<Project>(projectПуть(id, companyId)),
};
