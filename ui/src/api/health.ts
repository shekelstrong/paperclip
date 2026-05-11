export type DevServerHealthСтатус = {
  enabled: true;
  restartОбязательно: boolean;
  reason: "backend_changes" | "pending_migrations" | "backend_changes_and_pending_migrations" | null;
  lastChangedAt: string | null;
  changedПутьCount: number;
  changedПутьsSample: string[];
  pendingMigrations: string[];
  autoПерезапуститьВключитьd: boolean;
  activeЗапуститьCount: number;
  waitingForIdle: boolean;
  lastПерезапуститьAt: string | null;
};

export type HealthСтатус = {
  status: "ok";
  version?: string;
  deploymentMode?: "local_trusted" | "authenticated";
  deploymentExposure?: "private" | "public";
  authГотово?: boolean;
  bootstrapСтатус?: "ready" | "bootstrap_pending";
  bootstrapInviteАктивен?: boolean;
  features?: {
    companyDeletionВключитьd?: boolean;
  };
  devServer?: DevServerHealthСтатус;
};

export const healthApi = {
  get: async (): Promise<HealthСтатус> => {
    const res = await fetch("/api/health", {
      credentials: "include",
      headers: { Принять: "application/json" },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Ошибка(payload?.error ?? `Ошибка to load health (${res.status})`);
    }
    return res.json();
  },
};
