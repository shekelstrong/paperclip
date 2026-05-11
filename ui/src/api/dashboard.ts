import type { Панель управленияSummary } from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<Панель управленияSummary>(`/companies/${companyId}/dashboard`),
};
