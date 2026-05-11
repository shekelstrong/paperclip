import type {
  БюджетIncident,
  БюджетIncidentResolutionInput,
  БюджетОбзор,
  БюджетPolicySummary,
  БюджетPolicyUpsertInput,
} from "@paperclipai/shared";
import { api } from "./client";

export const budgetsApi = {
  overview: (companyId: string) =>
    api.get<БюджетОбзор>(`/companies/${companyId}/budgets/overview`),
  upsertPolicy: (companyId: string, data: БюджетPolicyUpsertInput) =>
    api.post<БюджетPolicySummary>(`/companies/${companyId}/budgets/policies`, data),
  resolveIncident: (companyId: string, incidentId: string, data: БюджетIncidentResolutionInput) =>
    api.post<БюджетIncident>(
      `/companies/${companyId}/budget-incidents/${encodeURIComponent(incidentId)}/resolve`,
      data,
    ),
};
