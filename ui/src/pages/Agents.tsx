import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type ОргструктураНетde } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусBadge } from "../components/СтатусBadge";
import { agentСтатусDot, agentСтатусDotПо умолчанию } from "../lib/status-colors";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime, cn, agentRouteRef, agentUrl } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Бот, Plus, List, GitВетка, SlidersHorizontal } from "lucide-react";
import { AGENT_ROLE_LABELS, type Агент } from "@paperclipai/shared";

import { getАдаптерLabel } from "../adapters/adapter-display-registry";

const roleЯрлыки = AGENT_ROLE_LABELS as Record<string, string>;

type ФильтрTab = "all" | "active" | "paused" | "error";

function matchesФильтр(status: string, tab: ФильтрTab, showTerminated: boolean): boolean {
  if (status === "terminated") return showTerminated;
  if (tab === "all") return true;
  if (tab === "active") return status === "active" || status === "running" || status === "idle";
  if (tab === "paused") return status === "paused";
  if (tab === "error") return status === "error";
  return true;
}

function filterАгенты(agents: Агент[], tab: ФильтрTab, showTerminated: boolean): Агент[] {
  return agents
    .filter((a) => matchesФильтр(a.status, tab, showTerminated))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getConfiguredМодель(agent: Агент): string | null {
  const value = agent.adapterConfig?.model;
  if (typeof value !== "string") return null;
  const model = value.trim();
  return model.length > 0 ? model : null;
}

function filterОргструктураTree(nodes: ОргструктураНетde[], tab: ФильтрTab, showTerminated: boolean): ОргструктураНетde[] {
  return nodes
    .reduce<ОргструктураНетde[]>((acc, node) => {
      const filteredРепозиторийrts = filterОргструктураTree(node.reports, tab, showTerminated);
      if (matchesФильтр(node.status, tab, showTerminated) || filteredРепозиторийrts.length > 0) {
        acc.push({ ...node, reports: filteredРепозиторийrts });
      }
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function Агенты() {
  const { selectedКомпанияId } = useКомпания();
  const { openNewАгент } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useSidebar();
  const pathSegment = location.pathname.split("/").pop() ?? "all";
  const tab: ФильтрTab = (pathSegment === "all" || pathSegment === "active" || pathSegment === "paused" || pathSegment === "error") ? pathSegment : "all";
  const [view, setView] = useState<"list" | "org">("org");
  const forceListView = isMobile;
  const effectiveView: "list" | "org" = forceListView ? "list" : view;
  const [showTerminated, setShowTerminated] = useState(false);
  const [filtersOpen, setФильтрsOpen] = useState(false);

  const { data: agents, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: orgTree } = useQuery({
    queryКлюч: queryКлючs.org(selectedКомпанияId!),
    queryFn: () => agentsApi.org(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && effectiveView === "org",
  });

  const { data: runs } = useQuery({
    queryКлюч: [...queryКлючs.liveЗапуститьs(selectedКомпанияId!), "agents-page"],
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
    refetchInterval: 15_000,
  });

  // Map agentId -> first live run + live run count
  const liveЗапуститьByАгент = useMemo(() => {
    const map = new Map<string, { runId: string; liveCount: number }>();
    for (const r of runs ?? []) {
      if (r.status !== "running" && r.status !== "queued") continue;
      const existing = map.get(r.agentId);
      if (existing) {
        existing.liveCount += 1;
        continue;
      }
      map.set(r.agentId, { runId: r.id, liveCount: 1 });
    }
    return map;
  }, [runs]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Агент>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Агенты" }]);
  }, [setBreadcrumbs]);

  if (!selectedКомпанияId) {
    return <EmptyState icon={Бот} message="Select a company to view agents." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  const filtered = filterАгенты(agents ?? [], tab, showTerminated);
  const filteredОргструктура = filterОргструктураTree(orgTree ?? [], tab, showTerminated);

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onЗначениеChange={(v) => navigate(`/agents/${v}`)}>
          <PageTabBar
            items={[
              { value: "all", label: "Все" },
              { value: "active", label: "Активен" },
              { value: "paused", label: "Приостановлен" },
              { value: "error", label: "Ошибка" },
            ]}
            value={tab}
            onЗначениеChange={(v) => navigate(`/agents/${v}`)}
          />
        </Tabs>
        <div classИмя="flex items-center gap-2">
          {/* Фильтрs */}
          <div classИмя="relative">
            <button
              classИмя={cn(
                "flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors border border-border",
                filtersOpen || showTerminated ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-accent/50"
              )}
              onClick={() => setФильтрsOpen(!filtersOpen)}
            >
              <SlidersHorizontal classИмя="h-3 w-3" />
              Фильтрs
              {showTerminated && <span classИмя="ml-0.5 px-1 bg-foreground/10 rounded text-[10px]">1</span>}
            </button>
            {filtersOpen && (
              <div classИмя="absolute right-0 top-full mt-1 z-50 w-48 border border-border bg-popover shadow-md p-1">
                <button
                  classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
                  onClick={() => setShowTerminated(!showTerminated)}
                >
                  <span classИмя={cn(
                    "flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm",
                    showTerminated && "bg-foreground"
                  )}>
                    {showTerminated && <span classИмя="text-background text-[10px] leading-none">&#10003;</span>}
                  </span>
                  Show terminated
                </button>
              </div>
            )}
          </div>
          {/* View toggle */}
          {!forceListView && (
            <div classИмя="flex items-center border border-border">
              <button
                classИмя={cn(
                  "p-1.5 transition-colors",
                  effectiveView === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setView("list")}
              >
                <List classИмя="h-3.5 w-3.5" />
              </button>
              <button
                classИмя={cn(
                  "p-1.5 transition-colors",
                  effectiveView === "org" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setView("org")}
              >
                <GitВетка classИмя="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={openNewАгент}>
            <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
            Новый агент
          </Button>
        </div>
      </div>

      {filtered.length > 0 && (
        <p classИмя="text-xs text-muted-foreground">{filtered.length} agent{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Бот}
          message="Создать your first agent to get started."
          action="Новый агент"
          onAction={openNewАгент}
        />
      )}

      {/* List view */}
      {effectiveView === "list" && filtered.length > 0 && (
        <div classИмя="border border-border">
          {filtered.map((agent) => {
            return (
              <EntityRow
                key={agent.id}
                title={agent.name}
                subtitle={`${roleЯрлыки[agent.role] ?? agent.role}${agent.title ? ` - ${agent.title}` : ""}`}
                to={agentUrl(agent)}
                classИмя={agent.pausedAt && tab !== "paused" ? "opacity-50" : ""}
                leading={
                  <span classИмя="relative flex h-2.5 w-2.5">
                    <span
                      classИмя={`absolute inline-flex h-full w-full rounded-full ${agentСтатусDot[agent.status] ?? agentСтатусDotПо умолчанию}`}
                    />
                  </span>
                }
                trailing={
                  <div classИмя="flex items-center gap-3">
                    <span classИмя="sm:hidden">
                      {liveЗапуститьByАгент.has(agent.id) ? (
                        <LiveЗапуститьIndicator
                          agentRef={agentRouteRef(agent)}
                          runId={liveЗапуститьByАгент.get(agent.id)!.runId}
                          liveCount={liveЗапуститьByАгент.get(agent.id)!.liveCount}
                        />
                      ) : (
                        <СтатусBadge status={agent.status} />
                      )}
                    </span>
                    <div classИмя="hidden sm:flex items-center gap-3">
                      {liveЗапуститьByАгент.has(agent.id) && (
                        <LiveЗапуститьIndicator
                          agentRef={agentRouteRef(agent)}
                          runId={liveЗапуститьByАгент.get(agent.id)!.runId}
                          liveCount={liveЗапуститьByАгент.get(agent.id)!.liveCount}
                        />
                      )}
                      <span classИмя="w-28 whitespace-nowrap text-left font-mono text-xs text-muted-foreground">
                        {getАдаптерLabel(agent.adapterТип)}
                      </span>
                      <span
                        classИмя="w-36 truncate text-left font-mono text-xs text-muted-foreground"
                        title={getConfiguredМодель(agent) ?? undefined}
                      >
                        {getConfiguredМодель(agent) ?? "—"}
                      </span>
                      <span classИмя="text-xs text-muted-foreground w-16 text-right">
                        {agent.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "—"}
                      </span>
                      <span classИмя="w-20 flex justify-end">
                        <СтатусBadge status={agent.status} />
                      </span>
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {effectiveView === "list" && agents && agents.length > 0 && filtered.length === 0 && (
        <p classИмя="text-sm text-muted-foreground text-center py-8">
          Нет agents match the selected filter.
        </p>
      )}

      {/* Оргструктура chart view */}
      {effectiveView === "org" && filteredОргструктура.length > 0 && (
        <div classИмя="border border-border py-1">
          {filteredОргструктура.map((node) => (
            <ОргструктураTreeНетde key={node.id} node={node} depth={0} agentMap={agentMap} liveЗапуститьByАгент={liveЗапуститьByАгент} tab={tab} />
          ))}
        </div>
      )}

      {effectiveView === "org" && orgTree && orgTree.length > 0 && filteredОргструктура.length === 0 && (
        <p classИмя="text-sm text-muted-foreground text-center py-8">
          Нет agents match the selected filter.
        </p>
      )}

      {effectiveView === "org" && orgTree && orgTree.length === 0 && (
        <p classИмя="text-sm text-muted-foreground text-center py-8">
          Нет organizational hierarchy defined.
        </p>
      )}
    </div>
  );
}

function ОргструктураTreeНетde({
  node,
  depth,
  agentMap,
  liveЗапуститьByАгент,
  tab,
}: {
  node: ОргструктураНетde;
  depth: number;
  agentMap: Map<string, Агент>;
  liveЗапуститьByАгент: Map<string, { runId: string; liveCount: number }>;
  tab: ФильтрTab;
}) {
  const agent = agentMap.get(node.id);

  const statusColor = agentСтатусDot[node.status] ?? agentСтатусDotПо умолчанию;

  return (
    <div style={{ paddingLeft: depth * 24 }}>
      <Link
        to={agent ? agentUrl(agent) : `/agents/${node.id}`}
        classИмя={cn("flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors w-full text-left no-underline text-inherit", agent?.pausedAt && tab !== "paused" && "opacity-50")}
      >
        <span classИмя="relative flex h-2.5 w-2.5 shrink-0">
          <span classИмя={`absolute inline-flex h-full w-full rounded-full ${statusColor}`} />
        </span>
        <div classИмя="flex-1 min-w-0">
          <span classИмя="text-sm font-medium">{node.name}</span>
          <span classИмя="text-xs text-muted-foreground ml-2">
            {roleЯрлыки[node.role] ?? node.role}
            {agent?.title ? ` - ${agent.title}` : ""}
          </span>
        </div>
        <div classИмя="flex items-center gap-3 shrink-0">
          <span classИмя="sm:hidden">
            {liveЗапуститьByАгент.has(node.id) ? (
              <LiveЗапуститьIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveЗапуститьByАгент.get(node.id)!.runId}
                liveCount={liveЗапуститьByАгент.get(node.id)!.liveCount}
              />
            ) : (
              <СтатусBadge status={node.status} />
            )}
          </span>
          <div classИмя="hidden sm:flex items-center gap-3">
            {liveЗапуститьByАгент.has(node.id) && (
              <LiveЗапуститьIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveЗапуститьByАгент.get(node.id)!.runId}
                liveCount={liveЗапуститьByАгент.get(node.id)!.liveCount}
              />
            )}
            {agent && (
              <>
                <span classИмя="w-28 whitespace-nowrap text-left font-mono text-xs text-muted-foreground">
                  {getАдаптерLabel(agent.adapterТип)}
                </span>
                <span
                  classИмя="w-36 truncate text-left font-mono text-xs text-muted-foreground"
                  title={getConfiguredМодель(agent) ?? undefined}
                >
                  {getConfiguredМодель(agent) ?? "—"}
                </span>
                <span classИмя="text-xs text-muted-foreground w-16 text-right">
                  {agent.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "—"}
                </span>
              </>
            )}
            <span classИмя="w-20 flex justify-end">
              <СтатусBadge status={node.status} />
            </span>
          </div>
        </div>
      </Link>
      {node.reports && node.reports.length > 0 && (
        <div classИмя="border-l border-border/50 ml-4">
          {node.reports.map((child) => (
            <ОргструктураTreeНетde key={child.id} node={child} depth={depth + 1} agentMap={agentMap} liveЗапуститьByАгент={liveЗапуститьByАгент} tab={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveЗапуститьIndicator({
  agentRef,
  runId,
  liveCount,
}: {
  agentRef: string;
  runId: string;
  liveCount: number;
}) {
  return (
    <Link
      to={`/agents/${agentRef}/runs/${runId}`}
      classИмя="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <span classИмя="relative flex h-2 w-2">
        <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span classИмя="text-[11px] font-medium text-blue-600 dark:text-blue-400">
        Live{liveCount > 1 ? ` (${liveCount})` : ""}
      </span>
    </Link>
  );
}
