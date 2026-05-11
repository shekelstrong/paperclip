import type { UserПрофильResponse } from "@paperclipai/shared";
import { api } from "./client";

export const userПрофильsApi = {
  get: (companyId: string, userSlug: string) =>
    api.get<UserПрофильResponse>(
      `/companies/${companyId}/users/${encodeURIComponent(userSlug)}/profile`,
    ),
};
