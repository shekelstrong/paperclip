import type { Окружение, ОкружениеCapabilities, ОкружениеLease, ОкружениеProbeResult } from "@paperclipai/shared";
import { api } from "./client";

export const environmentsApi = {
  list: (companyId: string) => api.get<Окружение[]>(`/companies/${companyId}/environments`),
  capabilities: (companyId: string) =>
    api.get<ОкружениеCapabilities>(`/companies/${companyId}/environments/capabilities`),
  lease: (leaseId: string) => api.get<ОкружениеLease>(`/environment-leases/${leaseId}`),
  create: (companyId: string, body: {
    name: string;
    description?: string | null;
    driver: "local" | "ssh" | "sandbox" | "plugin";
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown> | null;
  }) => api.post<Окружение>(`/companies/${companyId}/environments`, body),
  update: (environmentId: string, body: {
    name?: string;
    description?: string | null;
    driver?: "local" | "ssh" | "sandbox" | "plugin";
    status?: "active" | "archived";
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown> | null;
  }) => api.patch<Окружение>(`/environments/${environmentId}`, body),
  probe: (environmentId: string) => api.post<ОкружениеProbeResult>(`/environments/${environmentId}/probe`, {}),
  probeConfig: (companyId: string, body: {
    name?: string;
    driver: "local" | "ssh" | "sandbox" | "plugin";
    description?: string | null;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown> | null;
  }) => api.post<ОкружениеProbeResult>(`/companies/${companyId}/environments/probe-config`, body),
};
