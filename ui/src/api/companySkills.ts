import type {
  КомпанияНавык,
  КомпанияНавыкСоздатьRequest,
  КомпанияНавыкDetail,
  КомпанияНавыкFileDetail,
  КомпанияНавыкИмпортResult,
  КомпанияНавыкListItem,
  КомпанияНавыкProjectScanRequest,
  КомпанияНавыкProjectScanResult,
  КомпанияНавыкОбновитьСтатус,
} from "@paperclipai/shared";
import { api } from "./client";

export const companyНавыкиApi = {
  list: (companyId: string) =>
    api.get<КомпанияНавыкListItem[]>(`/companies/${encodeURIComponent(companyId)}/skills`),
  detail: (companyId: string, skillId: string) =>
    api.get<КомпанияНавыкDetail>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}`,
    ),
  updateСтатус: (companyId: string, skillId: string) =>
    api.get<КомпанияНавыкОбновитьСтатус>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/update-status`,
    ),
  file: (companyId: string, skillId: string, relativeПуть: string) =>
    api.get<КомпанияНавыкFileDetail>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/files?path=${encodeURIComponent(relativeПуть)}`,
    ),
  updateFile: (companyId: string, skillId: string, path: string, content: string) =>
    api.patch<КомпанияНавыкFileDetail>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/files`,
      { path, content },
    ),
  create: (companyId: string, payload: КомпанияНавыкСоздатьRequest) =>
    api.post<КомпанияНавык>(
      `/companies/${encodeURIComponent(companyId)}/skills`,
      payload,
    ),
  importFromSource: (companyId: string, source: string) =>
    api.post<КомпанияНавыкИмпортResult>(
      `/companies/${encodeURIComponent(companyId)}/skills/import`,
      { source },
    ),
  scanПроекты: (companyId: string, payload: КомпанияНавыкProjectScanRequest = {}) =>
    api.post<КомпанияНавыкProjectScanResult>(
      `/companies/${encodeURIComponent(companyId)}/skills/scan-projects`,
      payload,
    ),
  installОбновить: (companyId: string, skillId: string) =>
    api.post<КомпанияНавык>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}/install-update`,
      {},
    ),
  delete: (companyId: string, skillId: string) =>
    api.delete<КомпанияНавык>(
      `/companies/${encodeURIComponent(companyId)}/skills/${encodeURIComponent(skillId)}`,
    ),
};
