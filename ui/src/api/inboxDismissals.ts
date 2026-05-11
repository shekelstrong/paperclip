import type { ВходящиеЗакрытьal } from "@paperclipai/shared";
import { api } from "./client";

export const inboxЗакрытьalsApi = {
  list: (companyId: string) => api.get<ВходящиеЗакрытьal[]>(`/companies/${companyId}/inbox-dismissals`),
  dismiss: (companyId: string, itemКлюч: string) =>
    api.post<ВходящиеЗакрытьal>(`/companies/${companyId}/inbox-dismissals`, { itemКлюч }),
};
