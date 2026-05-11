import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchInstanceОбщиеНастройки, НазадupRetentionPolicy } from "@paperclipai/shared";
import {
  DAILY_RETENTION_PRESETS,
  WEEKLY_RETENTION_PRESETS,
  MONTHLY_RETENTION_PRESETS,
  DEFAULT_BACKUP_RETENTION,
} from "@paperclipai/shared";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { authApi } from "@/api/auth";
import { healthApi } from "@/api/health";
import { instanceНастройкиApi } from "@/api/instanceНастройки";
import { ModeBadge } from "@/components/access/ModeBadge";
import { Button } from "../components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://paperclip.ing/tos";

export function InstanceОбщиеНастройки() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to sign out.");
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Настройки" },
      { label: "Общие" },
    ]);
  }, [setBreadcrumbs]);

  const generalQuery = useQuery({
    queryКлюч: queryКлючs.instance.generalНастройки,
    queryFn: () => instanceНастройкиApi.getОбщие(),
  });
  const healthQuery = useQuery({
    queryКлюч: queryКлючs.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const updateОбщиеMutation = useMutation({
    mutationFn: instanceНастройкиApi.updateОбщие,
    onУспешно: async () => {
      setActionОшибка(null);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.generalНастройки });
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to update general settings.");
    },
  });

  if (generalQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка general settings...</div>;
  }

  if (generalQuery.error) {
    return (
      <div classИмя="text-sm text-destructive">
        {generalQuery.error instanceof Ошибка
          ? generalQuery.error.message
          : "Ошибка to load general settings."}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const keyboardShortcuts = generalQuery.data?.keyboardShortcuts === true;
  const feedbackDataSharingPreference = generalQuery.data?.feedbackDataSharingPreference ?? "prompt";
  const backupRetention: НазадupRetentionPolicy = generalQuery.data?.backupRetention ?? DEFAULT_BACKUP_RETENTION;

  return (
    <div classИмя="max-w-4xl space-y-6">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <SlidersHorizontal classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Общие</h1>
        </div>
        <p classИмя="text-sm text-muted-foreground">
          Configure instance-wide preferences including log display, keyboard shortcuts, backup
          retention, and data sharing.
        </p>
      </div>

      {actionОшибка && (
        <div classИмя="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionОшибка}
        </div>
      )}

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="space-y-3">
          <div classИмя="flex items-center gap-2">
            <h2 classИмя="text-sm font-semibold">Deployment and auth</h2>
            <ModeBadge
              deploymentMode={healthQuery.data?.deploymentMode}
              deploymentExposure={healthQuery.data?.deploymentExposure}
            />
          </div>
          <div classИмя="text-sm text-muted-foreground">
            {healthQuery.data?.deploymentMode === "local_trusted"
              ? "Local trusted mode is optimized for a local operator. Browser requests run as local board context and no sign-in is required."
              : healthQuery.data?.deploymentExposure === "public"
                ? "Authenticated public mode requires sign-in for board access and is intended for public URLs."
                : "Authenticated private mode requires sign-in and is intended for LAN, VPN, or other private-network deployments."}
          </div>
          <div classИмя="grid gap-3 md:grid-cols-3">
            <СтатусBox
              label="Auth readiness"
              value={healthQuery.data?.authГотово ? "Готово" : "Нетt ready"}
            />
            <СтатусBox
              label="Bootstrap status"
              value={healthQuery.data?.bootstrapСтатус === "bootstrap_pending" ? "Setup required" : "Готово"}
            />
            <СтатусBox
              label="Bootstrap invite"
              value={healthQuery.data?.bootstrapInviteАктивен ? "Активен" : "Нет"}
            />
          </div>
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Censor username in logs</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Hide the username segment in home-directory paths and similar operator-visible log output. Standalone
              username mentions outside of paths are not yet masked in the live transcript view. This is off by
              default.
            </p>
          </div>
          <ToggleSwitch
            checked={censorUsernameInLogs}
            onCheckedChange={() => updateОбщиеMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
            disabled={updateОбщиеMutation.isОжидание}
            aria-label="Toggle username log censoring"
          />
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Ключboard shortcuts</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Включить app keyboard shortcuts, including inbox navigation and global shortcuts like creating issues or
              toggling panels. This is off by default.
            </p>
          </div>
          <ToggleSwitch
            checked={keyboardShortcuts}
            onCheckedChange={() => updateОбщиеMutation.mutate({ keyboardShortcuts: !keyboardShortcuts })}
            disabled={updateОбщиеMutation.isОжидание}
            aria-label="Toggle keyboard shortcuts"
          />
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="space-y-5">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Назадup retention</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Configure how long automatic database backups are retained. Назадups run roughly
              every hour and are compressed with gzip. Within the daily window all backups are
              kept; beyond that, one backup per week and one per month are preserved.
            </p>
          </div>

          <div classИмя="space-y-1.5">
            <h3 classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daily</h3>
            <div classИмя="flex flex-wrap gap-2">
              {DAILY_RETENTION_PRESETS.map((days) => {
                const active = backupRetention.dailyDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={updateОбщиеMutation.isОжидание}
                    classИмя={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateОбщиеMutation.mutate({
                        backupRetention: { ...backupRetention, dailyDays: days },
                      })
                    }
                  >
                    <div classИмя="text-sm font-medium">{days} days</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div classИмя="space-y-1.5">
            <h3 classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly</h3>
            <div classИмя="flex flex-wrap gap-2">
              {WEEKLY_RETENTION_PRESETS.map((weeks) => {
                const active = backupRetention.weeklyWeeks === weeks;
                const label = weeks === 1 ? "1 week" : `${weeks} weeks`;
                return (
                  <button
                    key={weeks}
                    type="button"
                    disabled={updateОбщиеMutation.isОжидание}
                    classИмя={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateОбщиеMutation.mutate({
                        backupRetention: { ...backupRetention, weeklyWeeks: weeks },
                      })
                    }
                  >
                    <div classИмя="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div classИмя="space-y-1.5">
            <h3 classИмя="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly</h3>
            <div classИмя="flex flex-wrap gap-2">
              {MONTHLY_RETENTION_PRESETS.map((months) => {
                const active = backupRetention.monthlyMonths === months;
                const label = months === 1 ? "1 month" : `${months} months`;
                return (
                  <button
                    key={months}
                    type="button"
                    disabled={updateОбщиеMutation.isОжидание}
                    classИмя={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateОбщиеMutation.mutate({
                        backupRetention: { ...backupRetention, monthlyMonths: months },
                      })
                    }
                  >
                    <div classИмя="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="space-y-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">AI feedback sharing</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Control whether thumbs up and thumbs down votes can send the voted AI output to
              Paperclip Labs. Votes are always saved locally.
            </p>
            {FEEDBACK_TERMS_URL ? (
              <a
                href={FEEDBACK_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                classИмя="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Read our terms of service
              </a>
            ) : null}
          </div>
          {feedbackDataSharingPreference === "prompt" ? (
            <div classИмя="rounded-lg border border-border/70 bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
              Нет default is saved yet. The next thumbs up or thumbs down choice will ask once and
              then save the answer here.
            </div>
          ) : null}
          <div classИмя="flex flex-wrap gap-2">
            {[
              {
                value: "allowed",
                label: "Always allow",
                description: "Share voted AI outputs automatically.",
              },
              {
                value: "not_allowed",
                label: "Don't allow",
                description: "Keep voted AI outputs local only.",
              },
            ].map((option) => {
              const active = feedbackDataSharingPreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={updateОбщиеMutation.isОжидание}
                  classИмя={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() =>
                    updateОбщиеMutation.mutate({
                      feedbackDataSharingPreference: option.value as
                        | "allowed"
                        | "not_allowed",
                    })
                  }
                >
                  <div classИмя="text-sm font-medium">{option.label}</div>
                  <div classИмя="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <p classИмя="text-xs text-muted-foreground">
            To retest the first-use prompt in local dev, remove the{" "}
            <code>feedbackDataSharingPreference</code> key from the{" "}
            <code>instance_settings.general</code> JSON row for this instance, or set it back to{" "}
            <code>"prompt"</code>. Не задан and <code>"prompt"</code> both mean no default has been
            chosen yet.
          </p>
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Выйти</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Выйти of this Paperclip instance. You will be redirected to the login page.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isОжидание}
            onClick={() => signOutMutation.mutate()}
          >
            <LogOut classИмя="size-4" />
            {signOutMutation.isОжидание ? "Signing out..." : "Выйти"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function СтатусBox({ label, value }: { label: string; value: string }) {
  return (
    <div classИмя="rounded-lg border border-border bg-background px-3 py-3">
      <div classИмя="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div classИмя="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}
