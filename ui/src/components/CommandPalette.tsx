import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { queryКлючs } from "../lib/queryКлючs";
import {
  КомандаDialog,
  КомандаEmpty,
  КомандаGroup,
  КомандаInput,
  КомандаItem,
  КомандаList,
  КомандаSeparator,
} from "@/components/ui/command";
import {
  CircleDot,
  Бот,
  Hexagon,
  Цель,
  LayoutПанель управления,
  Входящие,
  DollarSign,
  История,
  SquarePen,
  Plus,
  Поиск,
} from "lucide-react";
import { Identity } from "./Identity";
import { agentUrl, projectUrl } from "../lib/utils";

const SEARCH_ALL_VALUE = "__paperclip-search-all__";

export function buildFullПоискПуть(query: string) {
  const trimmed = query.trim();
  return trimmed.length === 0 ? "/search" : `/search?q=${encodeURIComponent(trimmed)}`;
}

export function КомандаPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { selectedКомпанияId } = useКомпания();
  const { openNewЗадача, openNewАгент } = useDialogActions();
  const { isMobile, setSidebarOpen } = useSidebar();
  const searchQuery = query.trim();

  useEffect(() => {
    function handleКлючDown(e: КлючboardEvent) {
      if (e.key === "k" && (e.metaКлюч || e.ctrlКлюч)) {
        e.preventПо умолчанию();
        setOpen(true);
        if (isMobile) setSidebarOpen(false);
      }
    }
    document.addEventListener("keydown", handleКлючDown);
    return () => document.removeEventListener("keydown", handleКлючDown);
  }, [isMobile, setSidebarOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data: issues = [] } = useQuery({
    queryКлюч: queryКлючs.issues.list(selectedКомпанияId!),
    queryFn: () => issuesApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && open && searchQuery.length === 0,
  });

  const { data: searchedЗадачи = [] } = useQuery({
    queryКлюч: queryКлючs.issues.search(selectedКомпанияId!, searchQuery, undefined, 10),
    queryFn: () => issuesApi.list(selectedКомпанияId!, { q: searchQuery, limit: 10, includeПроцедураExecutions: true }),
    enabled: !!selectedКомпанияId && open && searchQuery.length > 0,
  });

  const { data: agents = [] } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && open,
  });

  const { data: allПроекты = [] } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && open,
  });
  const projects = useMemo(
    () => allПроекты.filter((p) => !p.archivedAt),
    [allПроекты],
  );

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  function goFullПоиск() {
    go(buildFullПоискПуть(searchQuery));
  }

  const agentИмя = (id: string | null) => {
    if (!id) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  const visibleЗадачи = useMemo(
    () => (searchQuery.length > 0 ? searchedЗадачи : issues),
    [issues, searchedЗадачи, searchQuery],
  );

  const showПоискВсе = searchQuery.length > 0;
  const showEmptyHint = showПоискВсе && visibleЗадачи.length === 0;

  return (
    <КомандаDialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (v && isMobile) setSidebarOpen(false);
      }}>
      <КомандаInput
        placeholder="Поиск issues, agents, projects..."
        value={query}
        onЗначениеChange={setQuery}
        onКлючDown={(event) => {
          if (event.key === "Enter" && showEmptyHint) {
            event.preventПо умолчанию();
            goFullПоиск();
          }
        }}
      />
      <КомандаList>
        <КомандаEmpty>
          {showПоискВсе ? (
            <span>
              Нет quick issue matches. Press{" "}
              <kbd classИмя="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↵</kbd>{" "}
              to <span classИмя="font-medium">search all</span> or keep typing to refine.
            </span>
          ) : (
            "Результаты не найдены."
          )}
        </КомандаEmpty>

        {showПоискВсе ? (
          <КомандаGroup heading="Поиск">
            <КомандаItem
              value={`${SEARCH_ALL_VALUE} ${searchQuery}`}
              onSelect={goFullПоиск}
              classИмя="bg-accent/40 border border-accent data-[selected=true]:bg-accent/60"
              data-testid="command-search-all"
            >
              <Поиск classИмя="mr-2 h-4 w-4" />
              <span classИмя="flex-1 truncate">
                Поиск all for <span classИмя="font-semibold">&ldquo;{searchQuery}&rdquo;</span>
              </span>
              <span classИмя="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span>open full search</span>
                <kbd classИмя="rounded border border-border bg-background px-1 py-0.5 text-[10px]">↵</kbd>
              </span>
            </КомандаItem>
          </КомандаGroup>
        ) : null}

        {showПоискВсе ? <КомандаSeparator /> : null}

        <КомандаGroup heading="Actions">
          <КомандаItem
            onSelect={() => {
              setOpen(false);
              openNewЗадача();
            }}
          >
            <SquarePen classИмя="mr-2 h-4 w-4" />
            Создать new issue
            <span classИмя="ml-auto text-xs text-muted-foreground">C</span>
          </КомандаItem>
          <КомандаItem
            onSelect={() => {
              setOpen(false);
              openNewАгент();
            }}
          >
            <Plus classИмя="mr-2 h-4 w-4" />
            Создать new agent
          </КомандаItem>
          <КомандаItem onSelect={() => go("/projects")}>
            <Plus classИмя="mr-2 h-4 w-4" />
            Создать new project
          </КомандаItem>
        </КомандаGroup>

        <КомандаSeparator />

        <КомандаGroup heading="Pages">
          <КомандаItem onSelect={() => go("/dashboard")}>
            <LayoutПанель управления classИмя="mr-2 h-4 w-4" />
            Панель управления
          </КомандаItem>
          <КомандаItem onSelect={() => go("/inbox")}>
            <Входящие classИмя="mr-2 h-4 w-4" />
            Входящие
          </КомандаItem>
          <КомандаItem onSelect={() => go("/issues")}>
            <CircleDot classИмя="mr-2 h-4 w-4" />
            Задачи
          </КомандаItem>
          <КомандаItem onSelect={() => go("/projects")}>
            <Hexagon classИмя="mr-2 h-4 w-4" />
            Проекты
          </КомандаItem>
          <КомандаItem onSelect={() => go("/goals")}>
            <Цель classИмя="mr-2 h-4 w-4" />
            Цели
          </КомандаItem>
          <КомандаItem onSelect={() => go("/agents")}>
            <Бот classИмя="mr-2 h-4 w-4" />
            Агенты
          </КомандаItem>
          <КомандаItem onSelect={() => go("/costs")}>
            <DollarSign classИмя="mr-2 h-4 w-4" />
            Расходы
          </КомандаItem>
          <КомандаItem onSelect={() => go("/activity")}>
            <История classИмя="mr-2 h-4 w-4" />
            Активность
          </КомандаItem>
        </КомандаGroup>

        {visibleЗадачи.length > 0 && (
          <>
            <КомандаSeparator />
            <КомандаGroup heading="Задачи">
              {visibleЗадачи.slice(0, 10).map((issue) => (
                <КомандаItem
                  key={issue.id}
                  value={
                    searchQuery.length > 0
                      ? `${searchQuery} ${issue.identifier ?? ""} ${issue.title}`
                      : undefined
                  }
                  onSelect={() => go(`/issues/${issue.identifier ?? issue.id}`)}
                >
                  <CircleDot classИмя="mr-2 h-4 w-4" />
                  <span classИмя="text-muted-foreground mr-2 font-mono text-xs">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  <span classИмя="flex-1 truncate">{issue.title}</span>
                  {issue.assigneeАгентId && (() => {
                    const name = agentИмя(issue.assigneeАгентId);
                    return name ? <Identity name={name} size="sm" classИмя="ml-2 hidden sm:inline-flex" /> : null;
                  })()}
                </КомандаItem>
              ))}
            </КомандаGroup>
          </>
        )}

        {agents.length > 0 && (
          <>
            <КомандаSeparator />
            <КомандаGroup heading="Агенты">
              {agents.slice(0, 10).map((agent) => (
                <КомандаItem key={agent.id} onSelect={() => go(agentUrl(agent))}>
                  <Бот classИмя="mr-2 h-4 w-4" />
                  {agent.name}
                  <span classИмя="text-xs text-muted-foreground ml-2">{agent.role}</span>
                </КомандаItem>
              ))}
            </КомандаGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <КомандаSeparator />
            <КомандаGroup heading="Проекты">
              {projects.slice(0, 10).map((project) => (
                <КомандаItem key={project.id} onSelect={() => go(projectUrl(project))}>
                  <Hexagon classИмя="mr-2 h-4 w-4" />
                  {project.name}
                </КомандаItem>
              ))}
            </КомандаGroup>
          </>
        )}
      </КомандаList>
    </КомандаDialog>
  );
}
