import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, UserRound } from "lucide-react";
import type { UserПрофильDailyPoint, UserПрофильWindowStats } from "@paperclipai/shared";
import { Link, useParams } from "@/lib/router";
import { userПрофильsApi } from "../api/userПрофильs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { СтатусBadge } from "../components/СтатусBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import {
  formatCents,
  formatDate,
  formatNumber,
  formatShortDate,
  formatТокенs,
  issueUrl,
  providerDisplayИмя,
  relativeTime,
} from "../lib/utils";

const NO_COMPANY = "__none__";

function initials(name: string | null | undefined) {
  const value = name?.trim() || "User";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function totalТокенs(stats: Pick<UserПрофильWindowStats, "inputТокенs" | "cachedInputТокенs" | "outputТокенs">) {
  return stats.inputТокенs + stats.cachedInputТокенs + stats.outputТокенs;
}

function completionRate(stats: UserПрофильWindowStats) {
  if (stats.touchedЗадачи === 0) return "0%";
  return `${Math.round((stats.completedЗадачи / stats.touchedЗадачи) * 100)}%`;
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div classИмя="min-w-0">
      <div classИмя="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</div>
      <div classИмя="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint ? <div classИмя="mt-0.5 text-xs text-muted-foreground/70">{hint}</div> : null}
    </div>
  );
}

function WindowColumn({ stats }: { stats: UserПрофильWindowStats }) {
  const tokens = totalТокенs(stats);
  return (
    <div classИмя="flex min-w-0 flex-col gap-4 border-l border-border pl-5 first:border-l-0 first:pl-0">
      <div classИмя="flex items-baseline justify-between gap-3">
        <h2 classИмя="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stats.label}</h2>
        <span classИмя="text-[11px] text-muted-foreground tabular-nums">{completionRate(stats)} done</span>
      </div>

      <div classИмя="grid grid-cols-2 gap-x-5 gap-y-3">
        <Metric value={formatNumber(stats.touchedЗадачи)} label="Touched" />
        <Metric value={formatNumber(stats.completedЗадачи)} label="Завершён" />
        <Metric value={formatNumber(stats.commentCount)} label="Комментарии" />
        <Metric value={formatNumber(stats.activityCount)} label="Actions" />
      </div>

      <div classИмя="grid grid-cols-2 gap-x-5 gap-y-1.5 pt-3 text-xs tabular-nums text-muted-foreground">
        <span>Токенs</span>
        <span classИмя="text-right text-foreground">{formatТокенs(tokens)}</span>
        <span>Spend</span>
        <span classИмя="text-right text-foreground">{formatCents(stats.costCents)}</span>
        <span>Создано</span>
        <span classИмя="text-right text-foreground">{formatNumber(stats.createdЗадачи)}</span>
        <span>Open</span>
        <span classИмя="text-right text-foreground">{formatNumber(stats.assignedOpenЗадачи)}</span>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div classИмя="min-w-0">
      <div classИмя="truncate text-xl font-semibold tabular-nums">{value}</div>
      <div classИмя="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ИспользованиеChart({ points }: { points: UserПрофильDailyPoint[] }) {
  const totals = points.map((point) => totalТокенs(point));
  const maxТокенs = Math.max(1, ...totals);
  const maxЗавершён = Math.max(1, ...points.map((point) => point.completedЗадачи));
  const totalТокенsSum = totals.reduce((sum, value) => sum + value, 0);

  return (
    <section>
      <div classИмя="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 classИмя="text-sm font-semibold">Last 14 days</h2>
        <div classИмя="flex items-baseline gap-4 text-xs text-muted-foreground">
          <span classИмя="tabular-nums text-foreground">{formatТокенs(totalТокенsSum)}</span>
          <span>tokens total</span>
        </div>
      </div>
      <div classИмя="mt-6 grid grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5 sm:gap-2">
        {points.map((point) => {
          const tokens = totalТокенs(point);
          const heightPct = tokens === 0 ? 0 : Math.max(2, Math.round((tokens / maxТокенs) * 100));
          const completedPct = point.completedЗадачи === 0
            ? 0
            : Math.max(8, Math.round((point.completedЗадачи / maxЗавершён) * 36));
          return (
            <div key={point.date} classИмя="group flex h-36 flex-col justify-end">
              <div
                classИмя="w-full bg-foreground/80 transition-opacity group-hover:bg-foreground"
                style={{ height: `${heightPct}%`, minHeight: tokens === 0 ? 1 : undefined }}
                title={`${formatShortDate(point.date)}: ${formatТокенs(tokens)} tokens, ${point.completedЗадачи} completed`}
              />
              {completedPct > 0 ? (
                <div
                  classИмя="mt-1 w-full rounded-full bg-emerald-500/80"
                  style={{ height: 2, opacity: Math.min(1, 0.35 + completedPct / 100) }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div classИмя="mt-2 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5 text-[10px] tabular-nums text-muted-foreground sm:gap-2">
        {points.map((point, index) => (
          <div key={point.date} classИмя="text-center">
            {index === 0 || index === 6 || index === 13 ? formatShortDate(point.date) : null}
          </div>
        ))}
      </div>
      <div classИмя="mt-4 flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span classИмя="inline-flex items-center gap-1.5">
          <span classИмя="h-2 w-2 bg-foreground/80" /> tokens / day
        </span>
        <span classИмя="inline-flex items-center gap-1.5">
          <span classИмя="h-[3px] w-4 rounded-full bg-emerald-500/80" /> completions
        </span>
      </div>
    </section>
  );
}

interface ИспользованиеRow {
  key: string;
  label: string;
  sublabel: string;
  costCents: number;
  inputТокенs: number;
  cachedInputТокенs: number;
  outputТокенs: number;
}

function ИспользованиеList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: ИспользованиеRow[];
}) {
  return (
    <section>
      <div classИмя="flex items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 classИмя="text-sm font-semibold">{title}</h2>
        <span classИмя="text-xs text-muted-foreground tabular-nums">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div classИмя="pt-4 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul classИмя="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} classИмя="grid gap-2 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div classИмя="min-w-0">
                <div classИмя="truncate text-sm font-medium">{row.label}</div>
                <div classИмя="truncate text-xs text-muted-foreground">{row.sublabel}</div>
              </div>
              <div classИмя="flex items-baseline gap-4 text-xs tabular-nums sm:justify-end">
                <span classИмя="text-muted-foreground">{formatТокенs(totalТокенs(row))}</span>
                <span classИмя="font-medium">{formatCents(row.costCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UserПрофиль() {
  const { userSlug = "" } = useParams<{ userSlug: string }>();
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const companyId = selectedКомпанияId ?? NO_COMPANY;

  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.userПрофиль(companyId, userSlug),
    queryFn: () => userПрофильsApi.get(companyId, userSlug),
    enabled: !!selectedКомпанияId && !!userSlug,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Users" }, { label: data?.user.name ?? userSlug }]);
  }, [data?.user.name, setBreadcrumbs, userSlug]);

  const allTime = data?.stats.find((entry) => entry.key === "all");
  const last7 = data?.stats.find((entry) => entry.key === "last7");
  const displayИмя = data?.user.name?.trim() || data?.user.email?.split("@")[0] || "User";

  const agentИспользованиеRows = useMemo<ИспользованиеRow[]>(
    () =>
      (data?.topАгенты ?? []).map((row) => ({
        key: row.agentId ?? "unknown",
        label: row.agentИмя ?? (row.agentId ? row.agentId.slice(0, 8) : "unknown"),
        sublabel: "Задача-linked usage",
        costCents: row.costCents,
        inputТокенs: row.inputТокенs,
        cachedInputТокенs: row.cachedInputТокенs,
        outputТокенs: row.outputТокенs,
      })),
    [data?.topАгенты],
  );

  const providerИспользованиеRows = useMemo<ИспользованиеRow[]>(
    () =>
      (data?.topПровайдерs ?? []).map((row) => ({
        key: `${row.provider}:${row.biller}:${row.model}`,
        label: `${providerDisplayИмя(row.provider)} / ${row.model}`,
        sublabel: `Billed through ${providerDisplayИмя(row.biller)}`,
        costCents: row.costCents,
        inputТокенs: row.inputТокенs,
        cachedInputТокенs: row.cachedInputТокенs,
        outputТокенs: row.outputТокенs,
      })),
    [data?.topПровайдерs],
  );

  if (!selectedКомпанияId) {
    return <EmptyState icon={UserRound} message="Select a company to view user profiles." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="dashboard" />;
  }

  if (error || !data) {
    return <EmptyState icon={AlertCircle} message="User profile not found for this company." />;
  }

  const allTimeТокенs = allTime ? totalТокенs(allTime) : 0;
  const metaParts = [
    data.user.membershipRole ?? "member",
    data.user.membershipСтатус,
    `joined ${formatDate(data.user.joinedAt)}`,
  ];

  return (
    <div classИмя="space-y-10 pb-10">
      <section classИмя="flex flex-col gap-7 border-b border-border pb-8">
        <div classИмя="flex flex-wrap items-center gap-5">
          <Avatar classИмя="size-16 border border-border" size="lg">
            {data.user.image ? <AvatarImage src={data.user.image} alt={displayИмя} /> : null}
            <AvatarFallback classИмя="text-lg font-semibold">{initials(displayИмя)}</AvatarFallback>
          </Avatar>
          <div classИмя="min-w-0 flex-1">
            <div classИмя="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 classИмя="truncate text-2xl font-semibold">{displayИмя}</h1>
              <span classИмя="text-sm text-muted-foreground">@{data.user.slug}</span>
            </div>
            <div classИмя="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {data.user.email ? <span classИмя="truncate">{data.user.email}</span> : null}
              {data.user.email ? <span aria-hidden>·</span> : null}
              <span>{metaParts.join(" · ")}</span>
            </div>
          </div>
        </div>

        <div classИмя="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <HeroStat label="Токены за всё время" value={formatТокенs(allTimeТокенs)} hint={formatCents(allTime?.costCents ?? 0) + " spent"} />
          <HeroStat label="Завершён" value={formatNumber(allTime?.completedЗадачи ?? 0)} hint={allTime ? `${completionRate(allTime)} rate` : undefined} />
          <HeroStat label="Open assigned" value={formatNumber(allTime?.assignedOpenЗадачи ?? 0)} hint={`${formatNumber(allTime?.createdЗадачи ?? 0)} created`} />
          <HeroStat label="7-day actions" value={formatNumber(last7?.activityCount ?? 0)} hint={`${formatNumber(last7?.commentCount ?? 0)} comments`} />
        </div>
      </section>

      <section classИмя="grid gap-8 border-b border-border pb-8 lg:grid-cols-3">
        {data.stats.map((entry) => <WindowColumn key={entry.key} stats={entry} />)}
      </section>

      <ИспользованиеChart points={data.daily} />

      <div classИмя="grid gap-10 pt-2 xl:grid-cols-2">
        <section>
          <div classИмя="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <h2 classИмя="text-sm font-semibold">Recent tasks</h2>
            <span classИмя="text-xs text-muted-foreground tabular-nums">{data.recentЗадачи.length}</span>
          </div>
          {data.recentЗадачи.length === 0 ? (
            <div classИмя="pt-4 text-sm text-muted-foreground">Нет touched tasks yet.</div>
          ) : (
            <ul classИмя="divide-y divide-border">
              {data.recentЗадачи.map((issue) => (
                <li key={issue.id}>
                  <Link
                    to={issueUrl(issue)}
                    classИмя="grid gap-2 py-2.5 transition-colors hover:bg-accent/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <span classИмя="font-mono text-xs text-muted-foreground">{issue.identifier ?? issue.id.slice(0, 8)}</span>
                    <span classИмя="truncate text-sm">{issue.title}</span>
                    <span classИмя="flex items-center gap-3 sm:justify-end">
                      <СтатусBadge status={issue.status} />
                      <span classИмя="text-xs tabular-nums text-muted-foreground">{relativeTime(issue.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div classИмя="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <h2 classИмя="text-sm font-semibold">Recent activity</h2>
            <span classИмя="text-xs text-muted-foreground tabular-nums">{data.recentАктивность.length}</span>
          </div>
          {data.recentАктивность.length === 0 ? (
            <div classИмя="pt-4 text-sm text-muted-foreground">Нет direct user actions recorded yet.</div>
          ) : (
            <ul classИмя="divide-y divide-border">
              {data.recentАктивность.map((event) => (
                <li key={event.id} classИмя="grid gap-2 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div classИмя="min-w-0">
                    <div classИмя="truncate text-sm">{event.action.replaceВсе("_", " ")}</div>
                    <div classИмя="truncate text-xs text-muted-foreground">
                      {event.entityТип} · {event.entityId.slice(0, 12)}
                    </div>
                  </div>
                  <span classИмя="text-xs tabular-nums text-muted-foreground sm:justify-self-end">{relativeTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div classИмя="grid gap-10 xl:grid-cols-2">
        <ИспользованиеList title="Агент attribution" empty="Нет issue-linked token usage yet." rows={agentИспользованиеRows} />
        <ИспользованиеList title="Провайдер mix" empty="Нет provider usage attributed yet." rows={providerИспользованиеRows} />
      </div>
    </div>
  );
}
