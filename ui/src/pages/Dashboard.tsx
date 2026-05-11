import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { buildКомпанияUserПрофильMap } from "../lib/company-members";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { СтатусIcon } from "../components/СтатусIcon";

import { АктивностьRow } from "../components/АктивностьRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Бот, CircleDot, DollarSign, ShieldCheck, LayoutПанель управления, ПаузаCircle } from "lucide-react";
import { АктивенАгентыPanel } from "../components/АктивенАгентыPanel";
import { ChartCard, ЗапуститьАктивностьChart, ПриоритетChart, ЗадачаСтатусChart, УспешноRateChart } from "../components/АктивностьCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Агент, Задача } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

const DASHBOARD_ACTIVITY_LIMIT = 10;

function getRecentЗадачи(issues: Задача[]): Задача[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function Панель управления() {
  const { selectedКомпанияId, companies } = useКомпания();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedАктивностьIds, setAnimatedАктивностьIds] = useState<Set<string>>(new Set());
  const seenАктивностьIdsRef = useRef<Set<string>>(new Set());
  const hydratedАктивностьRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Панель управления" }]);
  }, [setBreadcrumbs]);

  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.dashboard(selectedКомпанияId!),
    queryFn: () => dashboardApi.summary(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: activity } = useQuery({
    queryКлюч: [...queryКлючs.activity(selectedКомпанияId!), { limit: DASHBOARD_ACTIVITY_LIMIT }],
    queryFn: () => activityApi.list(selectedКомпанияId!, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    enabled: !!selectedКомпанияId,
  });

  const { data: issues } = useQuery({
    queryКлюч: queryКлючs.issues.list(selectedКомпанияId!),
    queryFn: () => issuesApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const userПрофильMap = useMemo(
    () => buildКомпанияUserПрофильMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const recentЗадачи = issues ? getRecentЗадачи(issues) : [];
  const recentАктивность = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenАктивностьIdsRef.current = new Set();
    hydratedАктивностьRef.current = false;
    setAnimatedАктивностьIds(new Set());
  }, [selectedКомпанияId]);

  useEffect(() => {
    if (recentАктивность.length === 0) return;

    const seen = seenАктивностьIdsRef.current;
    const currentIds = recentАктивность.map((event) => event.id);

    if (!hydratedАктивностьRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedАктивностьRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedАктивностьIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedАктивностьIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentАктивность]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Агент>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityИмяMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityНазваниеMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentИмя = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedКомпанияId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutПанель управления}
          message="Добро пожаловать в Paperclip. Set up your first company and agent to get started."
          action="Начать"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutПанель управления} message="Создать or select a company to view the dashboard." />
    );
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasНетАгенты = agents !== undefined && agents.length === 0;

  return (
    <div classИмя="space-y-6">
      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {hasНетАгенты && (
        <div classИмя="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div classИмя="flex items-center gap-2.5">
            <Бот classИмя="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p classИмя="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedКомпанияId! })}
            classИмя="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Создать задачу here
          </button>
        </div>
      )}

      <АктивенАгентыPanel companyId={selectedКомпанияId!} />

      {data && (
        <>
          {data.budgets.activeIncidents > 0 ? (
            <div classИмя="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div classИмя="flex items-start gap-2.5">
                <ПаузаCircle classИмя="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p classИмя="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p classИмя="text-xs text-red-100/70">
                    {data.budgets.pausedАгенты} agents paused · {data.budgets.pausedПроекты} projects paused · {data.budgets.pendingСогласования} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" classИмя="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <div classИмя="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Бот}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Агенты Включитьd"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Задачи In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthБюджетCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthБюджетCents)} budget`
                    : "Безлимит budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingСогласования + data.budgets.pendingСогласования}
              label="Ожидание Согласования"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingСогласования > 0
                    ? `${data.budgets.pendingСогласования} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div classИмя="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Запустить Активность" subtitle="Last 14 days">
              <ЗапуститьАктивностьChart activity={data.runАктивность} />
            </ChartCard>
            <ChartCard title="Задачи by Приоритет" subtitle="Last 14 days">
              <ПриоритетChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Задачи by Статус" subtitle="Last 14 days">
              <ЗадачаСтатусChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Успешно Rate" subtitle="Last 14 days">
              <УспешноRateChart activity={data.runАктивность} />
            </ChartCard>
          </div>

          <PluginSlotOutlet
            slotТипs={["dashboardWidget"]}
            context={{ companyId: selectedКомпанияId }}
            classИмя="grid gap-4 md:grid-cols-2"
            itemClassИмя="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div classИмя="grid md:grid-cols-2 gap-4">
            {/* Recent Активность */}
            {recentАктивность.length > 0 && (
              <div classИмя="min-w-0">
                <h3 classИмя="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Активность
                </h3>
                <div classИмя="border border-border divide-y divide-border overflow-hidden">
                  {recentАктивность.map((event) => (
                    <АктивностьRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      userПрофильMap={userПрофильMap}
                      entityИмяMap={entityИмяMap}
                      entityНазваниеMap={entityНазваниеMap}
                      classИмя={animatedАктивностьIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Задачи */}
            <div classИмя="min-w-0">
              <h3 classИмя="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Задачи
              </h3>
              {recentЗадачи.length === 0 ? (
                <div classИмя="border border-border p-4">
                  <p classИмя="text-sm text-muted-foreground">Нет tasks yet.</p>
                </div>
              ) : (
                <div classИмя="border border-border divide-y divide-border overflow-hidden">
                  {recentЗадачи.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      classИмя="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div classИмя="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Статус icon - left column on mobile */}
                        <span classИмя="shrink-0 sm:hidden">
                          <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span classИмя="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span classИмя="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span classИмя="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span classИмя="hidden sm:inline-flex"><СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} /></span>
                            <span classИмя="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeАгентId && (() => {
                              const name = agentИмя(issue.assigneeАгентId);
                              return name
                                ? <span classИмя="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span classИмя="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span classИмя="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
