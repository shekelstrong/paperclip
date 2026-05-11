import type { Согласование, СогласованиеComment, Задача } from "@paperclipai/shared";
import { api } from "./client";

export const approvalsApi = {
  list: (companyId: string, status?: string) =>
    api.get<Согласование[]>(
      `/companies/${companyId}/approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Согласование>(`/companies/${companyId}/approvals`, data),
  get: (id: string) => api.get<Согласование>(`/approvals/${id}`),
  approve: (id: string, decisionНетte?: string) =>
    api.post<Согласование>(`/approvals/${id}/approve`, { decisionНетte }),
  reject: (id: string, decisionНетte?: string) =>
    api.post<Согласование>(`/approvals/${id}/reject`, { decisionНетte }),
  requestRevision: (id: string, decisionНетte?: string) =>
    api.post<Согласование>(`/approvals/${id}/request-revision`, { decisionНетte }),
  resubmit: (id: string, payload?: Record<string, unknown>) =>
    api.post<Согласование>(`/approvals/${id}/resubmit`, { payload }),
  listКомментарии: (id: string) => api.get<СогласованиеComment[]>(`/approvals/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.post<СогласованиеComment>(`/approvals/${id}/comments`, { body }),
  listЗадачи: (id: string) => api.get<Задача[]>(`/approvals/${id}/issues`),
};
