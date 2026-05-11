import type {
  КомпанияСекрет,
  КомпанияСекретИспользованиеBinding,
  КомпанияСекретПровайдерConfig,
  RemoteСекретИмпортПредпросмотрResult,
  RemoteСекретИмпортResult,
  СекретДоступEvent,
  СекретManagedMode,
  СекретПровайдер,
  СекретПровайдерConfigСтатус,
  СекретПровайдерConfigHealthResponse,
  СекретПровайдерDescriptor,
  СекретСтатус,
} from "@paperclipai/shared";
import { api } from "./client";

export interface СекретИспользованиеResponse {
  secretId: string;
  bindings: КомпанияСекретИспользованиеBinding[];
}

export interface СоздатьСекретInput {
  name: string;
  key?: string;
  provider?: СекретПровайдер;
  managedMode?: СекретManagedMode;
  value?: string | null;
  description?: string | null;
  externalRef?: string | null;
  providerВерсияRef?: string | null;
  providerConfigId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface СекретПровайдерHealthResponse {
  providers: Array<{
    provider: СекретПровайдер;
    status: "ok" | "warn" | "error";
    message: string;
    warnings?: string[];
    backupGuidance?: string[];
    details?: Record<string, unknown>;
  }>;
}

export interface ОбновитьСекретInput {
  name?: string;
  key?: string;
  status?: СекретСтатус;
  description?: string | null;
  externalRef?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface RotateСекретInput {
  value?: string | null;
  externalRef?: string | null;
  providerВерсияRef?: string | null;
  providerConfigId?: string | null;
}

export interface СоздатьСекретПровайдерConfigInput {
  provider: СекретПровайдер;
  displayИмя: string;
  status?: СекретПровайдерConfigСтатус;
  isПо умолчанию?: boolean;
  config?: Record<string, unknown>;
}

export interface ОбновитьСекретПровайдерConfigInput {
  displayИмя?: string;
  status?: СекретПровайдерConfigСтатус;
  isПо умолчанию?: boolean;
  config?: Record<string, unknown>;
}

export interface RemoteИмпортПредпросмотрInput {
  providerConfigId: string;
  query?: string | null;
  nextТокен?: string | null;
  pageSize?: number;
}

export interface RemoteИмпортSelectionInput {
  externalRef: string;
  name?: string | null;
  key?: string | null;
  description?: string | null;
  providerВерсияRef?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface RemoteИмпортInput {
  providerConfigId: string;
  secrets: RemoteИмпортSelectionInput[];
}

export const secretsApi = {
  list: (companyId: string) => api.get<КомпанияСекрет[]>(`/companies/${companyId}/secrets`),
  providers: (companyId: string) =>
    api.get<СекретПровайдерDescriptor[]>(`/companies/${companyId}/secret-providers`),
  providerHealth: (companyId: string) =>
    api.get<СекретПровайдерHealthResponse>(`/companies/${companyId}/secret-providers/health`),
  providerConfigs: (companyId: string) =>
    api.get<КомпанияСекретПровайдерConfig[]>(`/companies/${companyId}/secret-provider-configs`),
  createПровайдерConfig: (companyId: string, data: СоздатьСекретПровайдерConfigInput) =>
    api.post<КомпанияСекретПровайдерConfig>(`/companies/${companyId}/secret-provider-configs`, data),
  updateПровайдерConfig: (id: string, data: ОбновитьСекретПровайдерConfigInput) =>
    api.patch<КомпанияСекретПровайдерConfig>(`/secret-provider-configs/${id}`, data),
  disableПровайдерConfig: (id: string) =>
    api.delete<КомпанияСекретПровайдерConfig>(`/secret-provider-configs/${id}`),
  setПо умолчаниюПровайдерConfig: (id: string) =>
    api.post<КомпанияСекретПровайдерConfig>(`/secret-provider-configs/${id}/default`, {}),
  checkПровайдерConfigHealth: (id: string) =>
    api.post<СекретПровайдерConfigHealthResponse>(`/secret-provider-configs/${id}/health`, {}),
  create: (companyId: string, data: СоздатьСекретInput) =>
    api.post<КомпанияСекрет>(`/companies/${companyId}/secrets`, data),
  update: (id: string, data: ОбновитьСекретInput) =>
    api.patch<КомпанияСекрет>(`/secrets/${id}`, data),
  rotate: (id: string, data: RotateСекретInput) =>
    api.post<КомпанияСекрет>(`/secrets/${id}/rotate`, data),
  disable: (id: string) =>
    api.patch<КомпанияСекрет>(`/secrets/${id}`, { status: "disabled" satisfies СекретСтатус }),
  enable: (id: string) =>
    api.patch<КомпанияСекрет>(`/secrets/${id}`, { status: "active" satisfies СекретСтатус }),
  archive: (id: string) =>
    api.patch<КомпанияСекрет>(`/secrets/${id}`, { status: "archived" satisfies СекретСтатус }),
  remove: (id: string) => api.delete<{ ok: true }>(`/secrets/${id}`),
  usage: (id: string) => api.get<СекретИспользованиеResponse>(`/secrets/${id}/usage`),
  accessEvents: (id: string) => api.get<СекретДоступEvent[]>(`/secrets/${id}/access-events`),
  remoteИмпортПредпросмотр: (companyId: string, data: RemoteИмпортПредпросмотрInput) =>
    api.post<RemoteСекретИмпортПредпросмотрResult>(
      `/companies/${companyId}/secrets/remote-import/preview`,
      data,
    ),
  remoteИмпорт: (companyId: string, data: RemoteИмпортInput) =>
    api.post<RemoteСекретИмпортResult>(`/companies/${companyId}/secrets/remote-import`, data),
};
