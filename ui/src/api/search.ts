import type { КомпанияПоискResponse, КомпанияПоискОбласть } from "@paperclipai/shared";
import { api } from "./client";

export interface КомпанияПоискParams {
  q: string;
  scope?: КомпанияПоискОбласть;
  limit?: number;
  offset?: number;
}

export const searchApi = {
  search: (companyId: string, params: КомпанияПоискParams) => {
    const search = new URLПоискParams();
    search.set("q", params.q);
    if (params.scope) search.set("scope", params.scope);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.offset !== undefined) search.set("offset", String(params.offset));
    const qs = search.toString();
    return api.get<КомпанияПоискResponse>(
      `/companies/${companyId}/search${qs ? `?${qs}` : ""}`,
    );
  },
};
