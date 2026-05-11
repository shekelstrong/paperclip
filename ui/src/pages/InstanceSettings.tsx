import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ExternalLink, Настройки } from "lucide-react";
import type { InstanceРасписаниеrHeartbeatАгент } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryКлючs } from "../lib/queryКлючs";
import { formatDateTime, relativeTime } from "../lib/utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanize(value: string) {
  return value.replaceВсе("_", " ");
}

function buildАгентHref(agent: InstanceРасписаниеrHeartbeatАгент) {
  return `/${agent.companyЗадачаPrefix}/agents/${encodeURIComponent(agent.agentUrlКлюч)}`;
}

export function InstanceНастройки() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Настройки" },
      { label: "Heartbeats" },
    ]);
  }, [setBreadcrumbs]);

  const heartbeatsQuery = useQuery({
    queryКлюч: queryКлючs.instance.schedulerHeartbeats,
    queryFn: () => heartbeatsApi.listInstanceРасписаниеrАгенты(),
    refetchInterval: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (agentRow: InstanceРасписаниеrHeartbeatАгент) => {
      const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
      const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
      const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};

      return agentsApi.update(
        agentRow.id,
        {
          runtimeConfig: {
            ...runtimeConfig,
            heartbeat: {
              ...heartbeat,
              enabled: !agentRow.heartbeatВключитьd,
            },
          },
        },
        agentRow.companyId,
      );
    },
    onУспешно: async (_, agentRow) => {
      setActionОшибка(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.schedulerHeartbeats }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(agentRow.companyId) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentRow.id) }),
      ]);
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to update heartbeat.");
    },
  });

  const disableВсеMutation = useMutation({
    mutationFn: async (agentRows: InstanceРасписаниеrHeartbeatАгент[]) => {
      const enabled = agentRows.filter((a) => a.heartbeatВключитьd);
      if (enabled.length === 0) return enabled;

      const results = await Promise.allSettled(
        enabled.map(async (agentRow) => {
          const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
          const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
          const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};
          await agentsApi.update(
            agentRow.id,
            {
              runtimeConfig: {
                ...runtimeConfig,
                heartbeat: { ...heartbeat, enabled: false },
              },
            },
            agentRow.companyId,
          );
        }),
      );

      const failures = results.filter((result): result is PromiseОтклонитьedResult => result.status === "rejected");
      if (failures.length > 0) {
        const firstОшибка = failures[0]?.reason;
        const detail = firstОшибка instanceof Ошибка ? firstОшибка.message : "Неизвестно error";
        throw new Ошибка(
          failures.length === 1
            ? `Ошибка to disable 1 timer heartbeat: ${detail}`
            : `Ошибка to disable ${failures.length} of ${enabled.length} timer heartbeats. First error: ${detail}`,
        );
      }
      return enabled;
    },
    onУспешно: async (updatedRows) => {
      setActionОшибка(null);
      const companies = new Set(updatedRows.map((row) => row.companyId));
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.schedulerHeartbeats }),
        ...Array.from(companies, (companyId) =>
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(companyId) }),
        ),
        ...updatedRows.map((row) =>
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(row.id) }),
        ),
      ]);
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to disable all heartbeats.");
    },
  });

  const agents = heartbeatsQuery.data ?? [];
  const activeCount = agents.filter((agent) => agent.schedulerАктивен).length;
  const disabledCount = agents.length - activeCount;
  const enabledCount = agents.filter((agent) => agent.heartbeatВключитьd).length;
  const anyВключитьd = enabledCount > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, { companyИмя: string; agents: InstanceРасписаниеrHeartbeatАгент[] }>();
    for (const agent of agents) {
      let group = map.get(agent.companyId);
      if (!group) {
        group = { companyИмя: agent.companyИмя, agents: [] };
        map.set(agent.companyId, group);
      }
      group.agents.push(agent);
    }
    return [...map.values()];
  }, [agents]);

  if (heartbeatsQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка scheduler heartbeats...</div>;
  }

  if (heartbeatsQuery.error) {
    return (
      <div classИмя="text-sm text-destructive">
        {heartbeatsQuery.error instanceof Ошибка
          ? heartbeatsQuery.error.message
          : "Ошибка to load scheduler heartbeats."}
      </div>
    );
  }

  return (
    <div classИмя="max-w-5xl space-y-6">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <Настройки classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Расписаниеr Heartbeats</h1>
        </div>
        <p classИмя="text-sm text-muted-foreground">
          Агенты with a timer heartbeat enabled across all of your companies.
        </p>
      </div>

      <div classИмя="flex items-center gap-4 text-sm text-muted-foreground">
        <span><span classИмя="font-semibold text-foreground">{activeCount}</span> active</span>
        <span><span classИмя="font-semibold text-foreground">{disabledCount}</span> disabled</span>
        <span><span classИмя="font-semibold text-foreground">{grouped.length}</span> {grouped.length === 1 ? "company" : "companies"}</span>
        {anyВключитьd && (
          <Button
            variant="destructive"
            size="sm"
            classИмя="ml-auto h-7 text-xs"
            disabled={disableВсеMutation.isОжидание}
            onClick={() => {
              const noun = enabledCount === 1 ? "agent" : "agents";
              if (!window.confirm(`Отключить timer heartbeats for all ${enabledCount} enabled ${noun}?`)) {
                return;
              }
              disableВсеMutation.mutate(agents);
            }}
          >
            {disableВсеMutation.isОжидание ? "Disabling..." : "Отключить Все"}
          </Button>
        )}
      </div>

      {actionОшибка && (
        <div classИмя="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionОшибка}
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Clock3}
          message="Нет scheduler heartbeats match the current criteria."
        />
      ) : (
        <div classИмя="space-y-4">
          {grouped.map((group) => (
            <Card key={group.companyИмя}>
              <CardContent classИмя="p-0">
                <div classИмя="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.companyИмя}
                </div>
                <div classИмя="divide-y">
                  {group.agents.map((agent) => {
                    const saving = toggleMutation.isОжидание && toggleMutation.variables?.id === agent.id;
                    return (
                      <div
                        key={agent.id}
                        classИмя="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <Badge
                          variant={agent.schedulerАктивен ? "default" : "outline"}
                          classИмя="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {agent.schedulerАктивен ? "On" : "Off"}
                        </Badge>
                        <Link
                          to={buildАгентHref(agent)}
                          classИмя="font-medium truncate hover:underline"
                        >
                          {agent.agentИмя}
                        </Link>
                        <span classИмя="hidden sm:inline text-muted-foreground truncate">
                          {humanize(agent.title ?? agent.role)}
                        </span>
                        <span classИмя="text-muted-foreground tabular-nums shrink-0">
                          {agent.intervalSec}s
                        </span>
                        <span
                          classИмя="hidden md:inline text-muted-foreground truncate"
                          title={agent.lastHeartbeatAt ? formatDateTime(agent.lastHeartbeatAt) : undefined}
                        >
                          {agent.lastHeartbeatAt
                            ? relativeTime(agent.lastHeartbeatAt)
                            : "never"}
                        </span>
                        <span classИмя="ml-auto flex items-center gap-1.5 shrink-0">
                          <Link
                            to={buildАгентHref(agent)}
                            classИмя="text-muted-foreground hover:text-foreground"
                            title="Full agent config"
                          >
                            <ExternalLink classИмя="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            classИмя="h-6 px-2 text-xs"
                            disabled={saving}
                            onClick={() => toggleMutation.mutate(agent)}
                          >
                            {saving ? "..." : agent.heartbeatВключитьd ? "Отключить Timer Heartbeat" : "Включить Timer Heartbeat"}
                          </Button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
