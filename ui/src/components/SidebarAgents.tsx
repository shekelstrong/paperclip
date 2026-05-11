import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  ПаузаCircle,
  Pencil,
  PlayCircle,
  Plus,
  Users,
} from "lucide-react";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { useToastActions } from "../context/ToastContext";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { heartbeatsApi } from "../api/heartbeats";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { queryКлючs } from "../lib/queryКлючs";
import { cn, agentRouteRef, agentUrl } from "../lib/utils";
import { useАгентOrder } from "../hooks/useАгентOrder";
import {
  AGENT_SORT_MODE_UPDATED_EVENT,
  getАгентСортировкаModeStorageКлюч,
  readАгентСортировкаMode,
  type АгентСортировкаModeОбновленоDetail,
  type АгентSidebarСортировкаMode,
  writeАгентСортировкаMode,
} from "../lib/agent-order";
import { АгентIcon } from "./АгентIconPicker";
import { БюджетSidebarMarker } from "./БюджетSidebarMarker";
import { SidebarSection, type SidebarSectionRadioChoice } from "./SidebarSection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Агент } from "@paperclipai/shared";

const AGENT_SORT_CHOICES: SidebarSectionRadioChoice[] = [
  { value: "top", label: "Top" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "recent", label: "Recent" },
];

function agentTimestamp(agent: Агент, field: "lastHeartbeatAt" | "updatedAt" | "createdAt"): number {
  const raw = agent[field];
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortАгенты(agents: Агент[], sortMode: АгентSidebarСортировкаMode): Агент[] {
  if (sortMode === "top") return agents;
  const sorted = [...agents];
  if (sortMode === "alphabetical") {
    sorted.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    return sorted;
  }
  sorted.sort((left, right) => {
    const heartbeatDiff = agentTimestamp(right, "lastHeartbeatAt") - agentTimestamp(left, "lastHeartbeatAt");
    if (heartbeatDiff !== 0) return heartbeatDiff;

    const updatedDiff = agentTimestamp(right, "updatedAt") - agentTimestamp(left, "updatedAt");
    if (updatedDiff !== 0) return updatedDiff;

    const createdDiff = agentTimestamp(right, "createdAt") - agentTimestamp(left, "createdAt");
    return createdDiff !== 0
      ? createdDiff
      : left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
  return sorted;
}

function SidebarАгентItem({
  activeАгентId,
  activeTab,
  agent,
  disabled,
  isMobile,
  onПаузаПродолжить,
  runCount,
  setSidebarOpen,
}: {
  activeАгентId: string | null;
  activeTab: string | null;
  agent: Агент;
  disabled: boolean;
  isMobile: boolean;
  onПаузаПродолжить: (agent: Агент, action: "pause" | "resume") => void;
  runCount: number;
  setSidebarOpen: (open: boolean) => void;
}) {
  const routeRef = agentRouteRef(agent);
  const href = activeTab ? `${agentUrl(agent)}/${activeTab}` : agentUrl(agent);
  const editHref = `${agentUrl(agent)}/configuration`;
  const isАктивен = activeАгентId === routeRef;
  const isПриостановлен = agent.status === "paused";
  const isБюджетПриостановлен = isПриостановлен && agent.pauseReason === "budget";
  const pauseПродолжитьLabel = isПриостановлен ? "Продолжить agent" : "Пауза agent";
  const pauseПродолжитьОтключитьd = disabled || agent.status === "pending_approval" || isБюджетПриостановлен;
  const pauseПродолжитьОтключитьdLabel = disabled
    ? "Updating..."
    : isБюджетПриостановлен
      ? "Бюджет приостановлен"
      : pauseПродолжитьLabel;

  return (
    <div classИмя="group/agent relative flex items-center">
      <NavLink
        to={href}
        state={SIDEBAR_SCROLL_RESET_STATE}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        classИмя={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 pr-8 text-[13px] font-medium transition-colors",
          isАктивен
            ? "bg-accent text-foreground"
            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <АгентIcon icon={agent.icon} classИмя="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
        <span classИмя="flex-1 truncate">{agent.name}</span>
        {(agent.pauseReason === "budget" || runCount > 0) && (
          <span classИмя="ml-auto flex items-center gap-1.5 shrink-0">
            {agent.pauseReason === "budget" ? (
              <БюджетSidebarMarker title="Агент приостановлен (бюджет)" />
            ) : null}
            {runCount > 0 ? (
              <span classИмя="relative flex h-2 w-2">
                <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            ) : null}
            {runCount > 0 ? (
              <span classИмя="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                {runCount} live
              </span>
            ) : null}
          </span>
        )}
      </NavLink>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            classИмя={cn(
              "absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 transition-opacity data-[state=open]:pointer-events-auto data-[state=open]:opacity-100",
              isMobile
                ? "opacity-100"
                : "pointer-events-none opacity-0 group-hover/agent:pointer-events-auto group-hover/agent:opacity-100 group-focus-within/agent:pointer-events-auto group-focus-within/agent:opacity-100",
            )}
            aria-label={`Open actions for ${agent.name}`}
          >
            <MoreHorizontal classИмя="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" classИмя="w-44">
          <DropdownMenuItem asChild>
            <Link
              to={editHref}
              onClick={() => {
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <Pencil classИмя="size-4" />
              <span>Изменить agent</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              if (pauseПродолжитьОтключитьd) return;
              onПаузаПродолжить(agent, isПриостановлен ? "resume" : "pause");
            }}
            disabled={pauseПродолжитьОтключитьd}
            title={isБюджетПриостановлен ? "Агент приостановлен из-за лимитов" : undefined}
          >
            {isПриостановлен ? <PlayCircle classИмя="size-4" /> : <ПаузаCircle classИмя="size-4" />}
            <span>{pauseПродолжитьОтключитьdLabel}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SidebarАгенты() {
  const [open, setOpen] = useState(true);
  const [pendingАгентIds, setОжиданиеАгентIds] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();
  const { selectedКомпанияId } = useКомпания();
  const { openNewАгент } = useDialogActions();
  const { isMobile, setSidebarOpen } = useSidebar();
  const { pushToast } = useToastActions();
  const location = useLocation();

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
    refetchInterval: 10_000,
  });

  const liveCountByАгент = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of liveЗапуститьs ?? []) {
      counts.set(run.agentId, (counts.get(run.agentId) ?? 0) + 1);
    }
    return counts;
  }, [liveЗапуститьs]);

  const visibleАгенты = useMemo(() => {
    const filtered = (agents ?? []).filter(
      (a: Агент) => a.status !== "terminated"
    );
    return filtered;
  }, [agents]);
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const sortModeStorageКлюч = useMemo(() => {
    if (!selectedКомпанияId) return null;
    return getАгентСортировкаModeStorageКлюч(selectedКомпанияId, currentUserId);
  }, [currentUserId, selectedКомпанияId]);
  const [sortMode, setСортировкаMode] = useState<АгентSidebarСортировкаMode>(() => {
    if (!sortModeStorageКлюч) return "top";
    return readАгентСортировкаMode(sortModeStorageКлюч);
  });
  const { orderedАгенты } = useАгентOrder({
    agents: visibleАгенты,
    companyId: selectedКомпанияId,
    userId: currentUserId,
  });
  const sortedАгенты = useMemo(
    () => sortАгенты(orderedАгенты, sortMode),
    [orderedАгенты, sortMode],
  );

  const agentMatch = location.pathname.match(/^\/(?:[^/]+\/)?agents\/([^/]+)(?:\/([^/]+))?/);
  const activeАгентId = agentMatch?.[1] ?? null;
  const activeTab = agentMatch?.[2] ?? null;

  useEffect(() => {
    if (!sortModeStorageКлюч) {
      setСортировкаMode("top");
      return;
    }
    setСортировкаMode(readАгентСортировкаMode(sortModeStorageКлюч));
  }, [sortModeStorageКлюч]);

  useEffect(() => {
    if (!sortModeStorageКлюч) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sortModeStorageКлюч) return;
      setСортировкаMode(readАгентСортировкаMode(sortModeStorageКлюч));
    };
    const onСвойEvent = (event: Event) => {
      const detail = (event as СвойEvent<АгентСортировкаModeОбновленоDetail>).detail;
      if (!detail || detail.storageКлюч !== sortModeStorageКлюч) return;
      setСортировкаMode(detail.sortMode);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(AGENT_SORT_MODE_UPDATED_EVENT, onСвойEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AGENT_SORT_MODE_UPDATED_EVENT, onСвойEvent);
    };
  }, [sortModeStorageКлюч]);

  const persistСортировкаMode = useCallback(
    (value: string) => {
      const nextСортировкаMode: АгентSidebarСортировкаMode =
        value === "alphabetical" || value === "recent" ? value : "top";
      setСортировкаMode(nextСортировкаMode);
      if (sortModeStorageКлюч) {
        writeАгентСортировкаMode(sortModeStorageКлюч, nextСортировкаMode);
      }
    },
    [sortModeStorageКлюч],
  );

  const pauseПродолжитьАгент = useMutation({
    mutationFn: ({ agent, action }: { agent: Агент; action: "pause" | "resume" }) =>
      action === "pause"
        ? agentsApi.pause(agent.id, selectedКомпанияId ?? undefined)
        : agentsApi.resume(agent.id, selectedКомпанияId ?? undefined),
    onMutate: ({ agent }) => {
      setОжиданиеАгентIds((current) => {
        const next = new Set(current);
        next.add(agent.id);
        return next;
      });
    },
    onУспешно: async (_agent, { agent, action }) => {
      if (selectedКомпанияId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(selectedКомпанияId) }),
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId) }),
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(selectedКомпанияId) }),
        ]);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agent.id) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentRouteRef(agent)) }),
      ]);
      pushToast({
        title: action === "pause" ? "Агент приостановлен" : "Агент возобновлён",
        body: agent.name,
        tone: "success",
      });
    },
    onОшибка: (error, { agent, action }) => {
      pushToast({
        title: action === "pause" ? "Could not pause agent" : "Could not resume agent",
        body: error instanceof Ошибка ? error.message : agent.name,
        tone: "error",
      });
    },
    onSettled: (_data, _error, { agent }) => {
      setОжиданиеАгентIds((current) => {
        const next = new Set(current);
        next.delete(agent.id);
        return next;
      });
    },
  });

  return (
    <SidebarSection
      label="Агенты"
      collapsible={{ open, onOpenChange: setOpen }}
      headerAction={{
        ariaLabel: "Новый агент",
        icon: Plus,
        onClick: openNewАгент,
      }}
      menu={{
        ariaLabel: "Агенты section actions",
        actions: [
          { type: "item", label: "Browse agents", icon: Users, href: "/agents/all" },
          { type: "separator" },
        ],
        radioLabel: "Сортировка агентов",
        radioChoices: AGENT_SORT_CHOICES,
        radioЗначение: sortMode,
        onRadioЗначениеChange: persistСортировкаMode,
      }}
    >
      {sortedАгенты.map((agent: Агент) => {
        const runCount = liveCountByАгент.get(agent.id) ?? 0;
        return (
          <SidebarАгентItem
            key={agent.id}
            activeАгентId={activeАгентId}
            activeTab={activeTab}
            agent={agent}
            disabled={pendingАгентIds.has(agent.id)}
            isMobile={isMobile}
            onПаузаПродолжить={(targetАгент, action) => pauseПродолжитьАгент.mutate({ agent: targetАгент, action })}
            runCount={runCount}
            setSidebarOpen={setSidebarOpen}
          />
        );
      })}
    </SidebarSection>
  );
}
