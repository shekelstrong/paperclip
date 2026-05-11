import type {
  Компания,
  КомпанияПортabilityЭкспортRequest,
  КомпанияПортabilityЭкспортПредпросмотрResult,
  КомпанияПортabilityЭкспортResult,
  КомпанияПортabilityИмпортRequest,
  КомпанияПортabilityИмпортResult,
  КомпанияПортabilityПредпросмотрRequest,
  КомпанияПортabilityПредпросмотрResult,
  ОбновитьКомпанияBranding,
} from "@paperclipai/shared";
import { api } from "./client";

export type КомпанияStats = Record<string, { agentCount: number; issueCount: number }>;

export const companiesApi = {
  list: () => api.get<Компания[]>("/companies"),
  get: (companyId: string) => api.get<Компания>(`/companies/${companyId}`),
  stats: () => api.get<КомпанияStats>("/companies/stats"),
  create: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) =>
    api.post<Компания>("/companies", data),
  update: (
    companyId: string,
    data: Partial<
      Pick<
        Компания,
        | "name"
        | "description"
        | "status"
        | "budgetMonthlyCents"
        | "attachmentMaxBytes"
        | "requireСоветСогласованиеForNewАгенты"
        | "feedbackDataSharingВключитьd"
        | "brandColor"
        | "logoAssetId"
      >
    >,
  ) => api.patch<Компания>(`/companies/${companyId}`, data),
  updateBranding: (companyId: string, data: ОбновитьКомпанияBranding) =>
    api.patch<Компания>(`/companies/${companyId}/branding`, data),
  archive: (companyId: string) => api.post<Компания>(`/companies/${companyId}/archive`, {}),
  remove: (companyId: string) => api.delete<{ ok: true }>(`/companies/${companyId}`),
  exportBundle: (
    companyId: string,
    data: КомпанияПортabilityЭкспортRequest,
  ) =>
    api.post<КомпанияПортabilityЭкспортResult>(`/companies/${companyId}/exports`, data),
  exportПредпросмотр: (
    companyId: string,
    data: КомпанияПортabilityЭкспортRequest,
  ) =>
    api.post<КомпанияПортabilityЭкспортПредпросмотрResult>(`/companies/${companyId}/exports/preview`, data),
  importПредпросмотр: (data: КомпанияПортabilityПредпросмотрRequest) =>
    api.post<КомпанияПортabilityПредпросмотрResult>("/companies/import/preview", data),
  importBundle: (data: КомпанияПортabilityИмпортRequest) =>
    api.post<КомпанияПортabilityИмпортResult>("/companies/import", data),
};
