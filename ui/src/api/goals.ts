import type { Цель } from "@paperclipai/shared";
import { api } from "./client";

export const goalsApi = {
  list: (companyId: string) => api.get<Цель[]>(`/companies/${companyId}/goals`),
  get: (id: string) => api.get<Цель>(`/goals/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Цель>(`/companies/${companyId}/goals`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Цель>(`/goals/${id}`, data),
  remove: (id: string) => api.delete<Цель>(`/goals/${id}`),
};
