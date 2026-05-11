import { AlertTriangle, RotateCcw, TimerСбросить } from "lucide-react";
import type { DevServerHealthСтатус } from "../api/health";

function formatRelativeTimestamp(value: string | null): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) return "just now";
  const deltaMinutes = Math.round(deltaMs / 60_000);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function describeReason(devServer: DevServerHealthСтатус): string {
  if (devServer.reason === "backend_changes_and_pending_migrations") {
    return "backend files changed and migrations are pending";
  }
  if (devServer.reason === "pending_migrations") {
    return "pending migrations need a fresh boot";
  }
  return "backend files changed since this server booted";
}

export function DevПерезапуститьBanner({ devServer }: { devServer?: DevServerHealthСтатус }) {
  if (!devServer?.enabled || !devServer.restartОбязательно) return null;

  const changedAt = formatRelativeTimestamp(devServer.lastChangedAt);
  const sample = devServer.changedПутьsSample.slice(0, 3);

  return (
    <div classИмя="border-b border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
      <div classИмя="flex flex-col gap-3 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
        <div classИмя="min-w-0">
          <div classИмя="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]">
            <AlertTriangle classИмя="h-3.5 w-3.5 shrink-0" />
            <span>Перезапустить Обязательно</span>
            {devServer.autoПерезапуститьВключитьd ? (
              <span classИмя="rounded-full bg-amber-900/10 px-2 py-0.5 text-[10px] tracking-[0.14em] dark:bg-amber-100/10">
                Авто-Перезапустить On
              </span>
            ) : null}
          </div>
          <p classИмя="mt-1 text-sm">
            {describeReason(devServer)}
            {changedAt ? ` · updated ${changedAt}` : ""}
          </p>
          <div classИмя="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-900/80 dark:text-amber-100/75">
            {sample.length > 0 ? (
              <span>
                Changed: {sample.join(", ")}
                {devServer.changedПутьCount > sample.length ? ` +${devServer.changedПутьCount - sample.length} more` : ""}
              </span>
            ) : null}
            {devServer.pendingMigrations.length > 0 ? (
              <span>
                Ожидание migrations: {devServer.pendingMigrations.slice(0, 2).join(", ")}
                {devServer.pendingMigrations.length > 2 ? ` +${devServer.pendingMigrations.length - 2} more` : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div classИмя="flex shrink-0 items-center gap-2 text-xs font-medium">
          {devServer.waitingForIdle ? (
            <div classИмя="inline-flex items-center gap-2 rounded-full bg-amber-900/10 px-3 py-1.5 dark:bg-amber-100/10">
              <TimerСбросить classИмя="h-3.5 w-3.5" />
              <span>Waiting for {devServer.activeЗапуститьCount} live run{devServer.activeЗапуститьCount === 1 ? "" : "s"} to finish</span>
            </div>
          ) : devServer.autoПерезапуститьВключитьd ? (
            <div classИмя="inline-flex items-center gap-2 rounded-full bg-amber-900/10 px-3 py-1.5 dark:bg-amber-100/10">
              <RotateCcw classИмя="h-3.5 w-3.5" />
              <span>Авто-restart will trigger when the instance is idle</span>
            </div>
          ) : (
            <div classИмя="inline-flex items-center gap-2 rounded-full bg-amber-900/10 px-3 py-1.5 dark:bg-amber-100/10">
              <RotateCcw classИмя="h-3.5 w-3.5" />
              <span>Перезапустить <code>pnpm dev:once</code> after the active work is safe to interrupt</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
