import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useПоискParams } from "@/lib/router";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, Layers, Plus, Repeat } from "lucide-react";
import { routinesApi } from "../api/routines";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { heartbeatsApi } from "../api/heartbeats";
import { accessApi } from "../api/access";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import { buildMarkdownMentionOptions } from "../lib/company-members";
import { queryКлючs } from "../lib/queryКлючs";
import { groupBy } from "../lib/groupBy";
import { createЗадачаDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import { getRecentИсполнительIds, sortАгентыByRecency, trackRecentИсполнитель } from "../lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { EmptyState } from "../components/EmptyState";
import { ЗадачиList } from "../components/ЗадачиList";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { АгентIcon } from "../components/АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "../components/InlineEntitySelector";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "../components/MarkdownИзменитьor";
import { ПроцедураListRow, nextПроцедураСтатус } from "../components/ПроцедураList";
import {
  ПроцедураЗапуститьVariablesDialog,
  type ПроцедураЗапуститьDialogОтправитьData,
} from "../components/ПроцедураЗапуститьVariablesDialog";
import { ПроцедураVariablesИзменитьor, ПроцедураVariablesHint } from "../components/ПроцедураVariablesИзменитьor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ПроцедураListItem, ПроцедураVariable } from "@paperclipai/shared";

const concurrencyPolicies = ["coalesce_if_active", "always_enqueue", "skip_if_active"];
const catchUpPolicies = ["skip_missed", "enqueue_missed_with_cap"];
const concurrencyPolicyОписаниеs: Record<string, string> = {
  coalesce_if_active: "If a run is already active, keep just one follow-up run queued.",
  always_enqueue: "Queue every trigger occurrence, even if the routine is already running.",
  skip_if_active: "Drop new trigger occurrences while a run is still active.",
};
const catchUpPolicyОписаниеs: Record<string, string> = {
  skip_missed: "Ignore windows that were missed while the scheduler or routine was paused.",
  enqueue_missed_with_cap: "Catch up missed schedule windows in capped batches after recovery.",
};

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

type ПроцедурыTab = "routines" | "runs";
type ПроцедураGroupBy = "none" | "project" | "assignee";
type ПроцедураСортировкаField = "updated" | "created" | "title" | "lastЗапустить";
type ПроцедураСортировкаDir = "asc" | "desc";

type ПроцедураViewState = {
  sortField: ПроцедураСортировкаField;
  sortDir: ПроцедураСортировкаDir;
  groupBy: ПроцедураGroupBy;
  collapsedGroups: string[];
};

type ПроцедураGroup = {
  key: string;
  label: string | null;
  items: ПроцедураListItem[];
};

const defaultПроцедураViewState: ПроцедураViewState = {
  sortField: "updated",
  sortDir: "desc",
  groupBy: "none",
  collapsedGroups: [],
};

function getПроцедураViewState(key: string): ПроцедураViewState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaultПроцедураViewState, ...JSON.parse(raw) };
  } catch {
    // Ignore malformed local state and fall back to defaults.
  }
  return { ...defaultПроцедураViewState };
}

function saveПроцедураViewState(key: string, state: ПроцедураViewState) {
  localStorage.setItem(key, JSON.stringify(state));
}

function timestampЗначение(value: Date | string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function compareNullableText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
}

function buildПроцедураMutationPayload(input: {
  title: string;
  description: string;
  projectId: string;
  assigneeАгентId: string;
  priority: string;
  concurrencyPolicy: string;
  catchUpPolicy: string;
  variables: ПроцедураVariable[];
}) {
  return {
    ...input,
    description: input.description.trim() || null,
    projectId: input.projectId || null,
    assigneeАгентId: input.assigneeАгентId || null,
  };
}

export function buildПроцедураGroups(
  routines: ПроцедураListItem[],
  groupByЗначение: ПроцедураGroupBy,
  projectById: Map<string, { name: string }>,
  agentById: Map<string, { name: string }>,
): ПроцедураGroup[] {
  if (groupByЗначение === "none") {
    return [{ key: "__all", label: null, items: routines }];
  }

  if (groupByЗначение === "project") {
    const groups = groupBy(routines, (routine) => routine.projectId ?? "__no_project");
    return Object.keys(groups)
      .sort((left, right) => {
        const leftLabel = left === "__no_project" ? "Нет project" : (projectById.get(left)?.name ?? "Неизвестно project");
        const rightLabel = right === "__no_project" ? "Нет project" : (projectById.get(right)?.name ?? "Неизвестно project");
        return leftLabel.localeCompare(rightLabel);
      })
      .map((key) => ({
        key,
        label: key === "__no_project" ? "Нет project" : (projectById.get(key)?.name ?? "Неизвестно project"),
        items: groups[key]!,
      }));
  }

  const groups = groupBy(routines, (routine) => routine.assigneeАгентId ?? "__unassigned");
  return Object.keys(groups)
    .sort((left, right) => {
      const leftLabel = left === "__unassigned" ? "Не назначен" : (agentById.get(left)?.name ?? "Неизвестно agent");
      const rightLabel = right === "__unassigned" ? "Не назначен" : (agentById.get(right)?.name ?? "Неизвестно agent");
      return leftLabel.localeCompare(rightLabel);
    })
    .map((key) => ({
      key,
      label: key === "__unassigned" ? "Не назначен" : (agentById.get(key)?.name ?? "Неизвестно agent"),
      items: groups[key]!,
    }));
}

export function sortПроцедуры(
  routines: ПроцедураListItem[],
  sortField: ПроцедураСортировкаField,
  sortDir: ПроцедураСортировкаDir,
): ПроцедураListItem[] {
  const direction = sortDir === "asc" ? 1 : -1;
  return [...routines].sort((left, right) => {
    let result = 0;

    if (sortField === "title") {
      result = compareNullableText(left.title, right.title);
    } else if (sortField === "created") {
      result = timestampЗначение(left.createdAt) - timestampЗначение(right.createdAt);
    } else if (sortField === "lastЗапустить") {
      result = timestampЗначение(left.lastЗапустить?.triggeredAt ?? left.lastTriggeredAt) -
        timestampЗначение(right.lastЗапустить?.triggeredAt ?? right.lastTriggeredAt);
    } else {
      result = timestampЗначение(left.updatedAt) - timestampЗначение(right.updatedAt);
    }

    if (result !== 0) return result * direction;
    return compareNullableText(left.title, right.title);
  });
}

function buildПроцедурыTabHref(tab: ПроцедурыTab) {
  return tab === "runs" ? "/routines?tab=runs" : "/routines";
}

export function Процедуры() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useПоискParams();
  const { pushToast } = useToastActions();
  const descriptionИзменитьorRef = useRef<MarkdownИзменитьorRef>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const assigneeSelectorRef = useRef<HTMLButtonElement | null>(null);
  const projectSelectorRef = useRef<HTMLButtonElement | null>(null);
  const [runningПроцедураId, setВыполняетсяПроцедураId] = useState<string | null>(null);
  const [statusMutationПроцедураId, setСтатусMutationПроцедураId] = useState<string | null>(null);
  const [runDialogПроцедура, setЗапуститьDialogПроцедура] = useState<ПроцедураListItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [advancedOpen, setДополнительноOpen] = useState(false);
  const activeTab: ПроцедурыTab = searchParams.get("tab") === "runs" ? "runs" : "routines";
  const [draft, setЧерновик] = useState<{
    title: string;
    description: string;
    projectId: string;
    assigneeАгентId: string;
    priority: string;
    concurrencyPolicy: string;
    catchUpPolicy: string;
    variables: ПроцедураVariable[];
  }>({
    title: "",
    description: "",
    projectId: "",
    assigneeАгентId: "",
    priority: "medium",
    concurrencyPolicy: "coalesce_if_active",
    catchUpPolicy: "skip_missed",
    variables: [],
  });
  const routineViewStateКлюч = selectedКомпанияId
    ? `paperclip:routines-view:${selectedКомпанияId}`
    : "paperclip:routines-view";
  const [routineViewState, setПроцедураViewState] = useState<ПроцедураViewState>(() => getПроцедураViewState(routineViewStateКлюч));

  useEffect(() => {
    setBreadcrumbs([{ label: "Процедуры" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    setПроцедураViewState(getПроцедураViewState(routineViewStateКлюч));
  }, [routineViewStateКлюч]);

  const { data: routines, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.routines.list(selectedКомпанияId!),
    queryFn: () => routinesApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
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
  const { data: routineExecutionЗадачи, isЗагрузка: recentЗапуститьsЗагрузка, error: recentЗапуститьsОшибка } = useQuery({
    queryКлюч: [...queryКлючs.issues.list(selectedКомпанияId!), "routine-executions"],
    queryFn: () => issuesApi.list(selectedКомпанияId!, { originKind: "routine_execution" }),
    enabled: !!selectedКомпанияId && activeTab === "runs",
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && activeTab === "runs",
    refetchInterval: 5000,
  });

  useEffect(() => {
    autoResizeTextarea(titleInputRef.current);
  }, [draft.title, composerOpen]);

  const mentionOptions = useMemo<MentionOption[]>(() => {
    return buildMarkdownMentionOptions({
      agents,
      projects,
      members: companyMembers?.users,
    });
  }, [agents, companyMembers?.users, projects]);

  const createПроцедура = useMutation({
    mutationFn: () =>
      routinesApi.create(selectedКомпанияId!, buildПроцедураMutationPayload(draft)),
    onУспешно: async (routine) => {
      setЧерновик({
        title: "",
        description: "",
        projectId: "",
        assigneeАгентId: "",
        priority: "medium",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
        variables: [],
      });
      setComposerOpen(false);
      setДополнительноOpen(false);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) });
      pushToast({
        title: "Процедура создана",
        body: routine.assigneeАгентId
          ? "Добавить the first trigger to turn it into a live workflow."
          : "Черновик saved. Добавить a default agent before enabling automation.",
        tone: "success",
      });
      navigate(`/routines/${routine.id}?tab=triggers`);
    },
  });
  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: [...queryКлючs.issues.list(selectedКомпанияId!), "routine-executions"] });
    },
  });

  const updateПроцедураСтатус = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => routinesApi.update(id, { status }),
    onMutate: ({ id }) => {
      setСтатусMutationПроцедураId(id);
    },
    onУспешно: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(variables.id) }),
      ]);
    },
    onSettled: () => {
      setСтатусMutationПроцедураId(null);
    },
    onОшибка: (mutationОшибка) => {
      pushToast({
        title: "Ошибка to update routine",
        body: mutationОшибка instanceof Ошибка ? mutationОшибка.message : "Paperclip could not update the routine.",
        tone: "error",
      });
    },
  });

  const runПроцедура = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ПроцедураЗапуститьDialogОтправитьData }) => routinesApi.run(id, {
      ...(data?.variables && Object.keys(data.variables).length > 0 ? { variables: data.variables } : {}),
      ...(data?.assigneeАгентId !== undefined ? { assigneeАгентId: data.assigneeАгентId } : {}),
      ...(data?.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data?.executionРабочая областьId !== undefined ? { executionРабочая областьId: data.executionРабочая областьId } : {}),
      ...(data?.executionРабочая областьPreference !== undefined
        ? { executionРабочая областьPreference: data.executionРабочая областьPreference }
        : {}),
      ...(data?.executionРабочая областьНастройки !== undefined
        ? { executionРабочая областьНастройки: data.executionРабочая областьНастройки }
        : {}),
    }),
    onMutate: ({ id }) => {
      setВыполняетсяПроцедураId(id);
    },
    onУспешно: async (_, { id }) => {
      setЗапуститьDialogПроцедура(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(id) }),
      ]);
    },
    onSettled: () => {
      setВыполняетсяПроцедураId(null);
    },
    onОшибка: (mutationОшибка) => {
      pushToast({
        title: "Запуск процедуры не удался",
        body: mutationОшибка instanceof Ошибка ? mutationОшибка.message : "Paperclip could not start the routine run.",
        tone: "error",
      });
    },
  });

  const recentИсполнительIds = useMemo(() => getRecentИсполнительIds(), [composerOpen]);
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [composerOpen]);
  const assigneeOptions = useMemo<InlineEntityOption[]>(
    () =>
      sortАгентыByRecency(
        (agents ?? []).filter((agent) => agent.status !== "terminated"),
        recentИсполнительIds,
      ).map((agent) => ({
        id: agent.id,
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    [agents, recentИсполнительIds],
  );
  const projectOptions = useMemo<InlineEntityOption[]>(
    () =>
      (projects ?? []).map((project) => ({
        id: project.id,
        label: project.name,
        searchText: project.description ?? "",
      })),
    [projects],
  );
  const agentById = useMemo(
    () => new Map((agents ?? []).map((agent) => [agent.id, agent])),
    [agents],
  );
  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);
  const sortedПроцедуры = useMemo(
    () => sortПроцедуры(routines ?? [], routineViewState.sortField, routineViewState.sortDir),
    [routineViewState.sortDir, routineViewState.sortField, routines],
  );
  const routineGroups = useMemo(
    () => buildПроцедураGroups(sortedПроцедуры, routineViewState.groupBy, projectById, agentById),
    [agentById, projectById, routineViewState.groupBy, sortedПроцедуры],
  );
  const recentЗапуститьsЗадачаLinkState = useMemo(
    () =>
      createЗадачаDetailLocationState(
        "Недавние запуски",
        buildПроцедурыTabHref("runs"),
        "issues",
      ),
    [],
  );
  const currentИсполнитель = draft.assigneeАгентId ? agentById.get(draft.assigneeАгентId) ?? null : null;
  const currentProject = draft.projectId ? projectById.get(draft.projectId) ?? null : null;

  function updateПроцедураView(patch: Partial<ПроцедураViewState>) {
    setПроцедураViewState((current) => {
      const next = { ...current, ...patch };
      saveПроцедураViewState(routineViewStateКлюч, next);
      return next;
    });
  }

  function handleTabChange(tab: string) {
    const nextTab = tab === "runs" ? "runs" : "routines";
    startTransition(() => {
      navigate(buildПроцедурыTabHref(nextTab));
    });
  }

  function handleЗапуститьСейчас(routine: ПроцедураListItem) {
    setЗапуститьDialogПроцедура(routine);
  }

  function handleToggleВключитьd(routine: ПроцедураListItem, enabled: boolean) {
    if (!enabled && !routine.assigneeАгентId) {
      pushToast({
        title: "Требуется агент по умолчанию",
        body: "Set a default agent before enabling routine automation.",
        tone: "warn",
      });
      return;
    }
    updateПроцедураСтатус.mutate({
      id: routine.id,
      status: nextПроцедураСтатус(routine.status, !enabled),
    });
  }

  function handleToggleАрхивирован(routine: ПроцедураListItem) {
    updateПроцедураСтатус.mutate({
      id: routine.id,
      status: routine.status === "archived" ? "active" : "archived",
    });
  }

  if (!selectedКомпанияId) {
    return <EmptyState icon={Repeat} message="Select a company to view routines." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="issues-list" />;
  }

  return (
    <div classИмя="space-y-6">
      <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div classИмя="space-y-1">
          <h1 classИмя="text-2xl font-semibold tracking-tight">
            Процедуры
          </h1>
          <p classИмя="text-sm text-muted-foreground">
            Recurring work definitions that materialize into auditable execution issues.
          </p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>
          <Plus classИмя="mr-2 h-4 w-4" />
          Создать routine
        </Button>
      </div>

      <Tabs value={activeTab} onЗначениеChange={handleTabChange}>
        <PageTabBar
          align="start"
          value={activeTab}
          onЗначениеChange={handleTabChange}
          items={[
            { value: "routines", label: "Процедуры" },
            { value: "runs", label: "Недавние запуски" },
          ]}
        />
        <TabsContent value="routines" classИмя="space-y-4">
          <div classИмя="flex items-center justify-between gap-3">
            <p classИмя="text-sm text-muted-foreground">
              {(routines ?? []).length} routine{(routines ?? []).length === 1 ? "" : "s"}
            </p>
            <div classИмя="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" classИмя="text-xs" title="Сортировка">
                    <ArrowUpDown classИмя="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                    <span classИмя="hidden sm:inline">Сортировка</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" classИмя="w-44 p-0">
                  <div classИмя="p-2 space-y-0.5">
                    {([
                      ["updated", "Обновлено"],
                      ["created", "Создано"],
                      ["lastЗапустить", "Last run"],
                      ["title", "Название"],
                    ] as const).map(([field, label]) => (
                      <button
                        key={field}
                        classИмя={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                          routineViewState.sortField === field
                            ? "bg-accent/50 text-foreground"
                            : "text-muted-foreground hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          updateПроцедураView(
                            routineViewState.sortField === field
                              ? { sortDir: routineViewState.sortDir === "asc" ? "desc" : "asc" }
                              : { sortField: field, sortDir: field === "title" ? "asc" : "desc" },
                          );
                        }}
                      >
                        <span>{label}</span>
                        {routineViewState.sortField === field ? (
                          <span classИмя="text-xs text-muted-foreground">
                            {routineViewState.sortDir === "asc" ? "Asc" : "Desc"}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" classИмя="text-xs" title="Group">
                    <Layers classИмя="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                    <span classИмя="hidden sm:inline">Group</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" classИмя="w-44 p-0">
                  <div classИмя="p-2 space-y-0.5">
                    {([
                      ["project", "Project"],
                      ["assignee", "Агент"],
                      ["none", "Нет"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        classИмя={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                          routineViewState.groupBy === value
                            ? "bg-accent/50 text-foreground"
                            : "text-muted-foreground hover:bg-accent/50"
                        }`}
                        onClick={() => updateПроцедураView({ groupBy: value, collapsedGroups: [] })}
                      >
                        <span>{label}</span>
                        {routineViewState.groupBy === value ? <Check classИмя="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="runs">
          <ЗадачиList
            issues={routineExecutionЗадачи ?? []}
            isЗагрузка={recentЗапуститьsЗагрузка}
            error={recentЗапуститьsОшибка as Ошибка | null}
            agents={agents}
            projects={projects}
            liveЗадачаIds={liveЗадачаIds}
            viewStateКлюч="paperclip:routine-recent-runs-view"
            issueLinkState={recentЗапуститьsЗадачаLinkState}
            onОбновитьЗадача={(id, data) => updateЗадача.mutate({ id, data })}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          if (!createПроцедура.isОжидание) {
            setComposerOpen(open);
          }
        }}
      >
        <DialogContent
          showЗакрытьButton={false}
          classИмя="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        >
          <div classИмя="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
            <div>
              <p classИмя="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Новая процедура</p>
              <p classИмя="text-sm text-muted-foreground">
                Define the recurring work first. По умолчанию project and agent are optional for draft routines.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setComposerOpen(false);
                setДополнительноOpen(false);
              }}
              disabled={createПроцедура.isОжидание}
            >
              Отмена
            </Button>
          </div>

          <div classИмя="min-h-0 flex-1 overflow-y-auto">
            <div classИмя="px-5 pt-5 pb-3">
              <textarea
                ref={titleInputRef}
                classИмя="w-full resize-none overflow-hidden bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground/50"
                placeholder="Процедура title"
                rows={1}
                value={draft.title}
                onChange={(event) => {
                  setЧерновик((current) => ({ ...current, title: event.target.value }));
                  autoResizeTextarea(event.target);
                }}
                onКлючDown={(event) => {
                  if (event.key === "Enter" && !event.metaКлюч && !event.ctrlКлюч && !event.nativeEvent.isComposing) {
                    event.preventПо умолчанию();
                    descriptionИзменитьorRef.current?.focus();
                    return;
                  }
                  if (event.key === "Tab" && !event.shiftКлюч) {
                    event.preventПо умолчанию();
                    if (draft.assigneeАгентId) {
                      if (draft.projectId) {
                        descriptionИзменитьorRef.current?.focus();
                      } else {
                        projectSelectorRef.current?.focus();
                      }
                    } else {
                      assigneeSelectorRef.current?.focus();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            <div classИмя="px-5 pb-3">
              <div classИмя="overflow-x-auto overscroll-x-contain">
                <div classИмя="inline-flex min-w-full flex-wrap items-center gap-2 text-sm text-muted-foreground sm:min-w-max sm:flex-nowrap">
                  <span>For</span>
                  <InlineEntitySelector
                    ref={assigneeSelectorRef}
                    value={draft.assigneeАгентId}
                    options={assigneeOptions}
                    recentOptionIds={recentИсполнительIds}
                    placeholder="Исполнитель"
                    noneLabel="Нет assignee"
                    searchPlaceholder="Поиск assignees..."
                    emptyMessage="Нет assignees found."
                    onChange={(assigneeАгентId) => {
                      if (assigneeАгентId) trackRecentИсполнитель(assigneeАгентId);
                      setЧерновик((current) => ({ ...current, assigneeАгентId }));
                    }}
                    onПодтвердить={() => {
                      if (draft.projectId) {
                        descriptionИзменитьorRef.current?.focus();
                      } else {
                        projectSelectorRef.current?.focus();
                      }
                    }}
                    renderTriggerЗначение={(option) =>
                      option ? (
                        currentИсполнитель ? (
                          <>
                            <АгентIcon icon={currentИсполнитель.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span classИмя="truncate">{option.label}</span>
                          </>
                        ) : (
                          <span classИмя="truncate">{option.label}</span>
                        )
                      ) : (
                        <span classИмя="text-muted-foreground">Исполнитель</span>
                      )
                    }
                    renderOption={(option) => {
                      if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                      const assignee = agentById.get(option.id);
                      return (
                        <>
                          {assignee ? <АгентIcon icon={assignee.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                          <span classИмя="truncate">{option.label}</span>
                        </>
                      );
                    }}
                  />
                  <span>in</span>
                  <InlineEntitySelector
                    ref={projectSelectorRef}
                    value={draft.projectId}
                    options={projectOptions}
                    recentOptionIds={recentProjectIds}
                    placeholder="Project"
                    noneLabel="Нет project"
                    searchPlaceholder="Поиск projects..."
                    emptyMessage="Проекты не найдены."
                    onChange={(projectId) => {
                      if (projectId) trackRecentProject(projectId);
                      setЧерновик((current) => ({ ...current, projectId }));
                    }}
                    onПодтвердить={() => descriptionИзменитьorRef.current?.focus()}
                    renderTriggerЗначение={(option) =>
                      option && currentProject ? (
                        <>
                          <span
                            classИмя="h-3.5 w-3.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: currentProject.color ?? "#64748b" }}
                          />
                          <span classИмя="truncate">{option.label}</span>
                        </>
                      ) : (
                        <span classИмя="text-muted-foreground">Project</span>
                      )
                    }
                    renderOption={(option) => {
                      if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                      const project = projectById.get(option.id);
                      return (
                        <>
                          <span
                            classИмя="h-3.5 w-3.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: project?.color ?? "#64748b" }}
                          />
                          <span classИмя="truncate">{option.label}</span>
                        </>
                      );
                    }}
                  />
                </div>
              </div>
            </div>

            <div classИмя="border-t border-border/60 px-5 py-4">
              <MarkdownИзменитьor
                ref={descriptionИзменитьorRef}
                value={draft.description}
                onChange={(description) => setЧерновик((current) => ({ ...current, description }))}
                placeholder="Добавить instructions..."
                bordered={false}
                contentClassИмя="min-h-[160px] text-sm text-muted-foreground"
                mentions={mentionOptions}
                onОтправить={() => {
                  if (!createПроцедура.isОжидание && draft.title.trim() && draft.projectId && draft.assigneeАгентId) {
                    createПроцедура.mutate();
                  }
                }}
              />
            </div>

            <div classИмя="border-t border-border/60 px-5 py-3">
              <Collapsible open={advancedOpen} onOpenChange={setДополнительноOpen}>
                <CollapsibleTrigger classИмя="flex w-full items-center justify-between text-left">
                  <div>
                    <p classИмя="text-sm font-medium">Дополнительно delivery settings</p>
                    <p classИмя="text-sm text-muted-foreground">Keep policy controls secondary to the work definition.</p>
                  </div>
                  {advancedOpen ? <ChevronDown classИмя="h-4 w-4 text-muted-foreground" /> : <ChevronRight classИмя="h-4 w-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent classИмя="pt-3">
                  <div classИмя="grid gap-4 md:grid-cols-2">
                    <div classИмя="space-y-2">
                      <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Concurrency</p>
                      <Select
                        value={draft.concurrencyPolicy}
                        onЗначениеChange={(concurrencyPolicy) => setЧерновик((current) => ({ ...current, concurrencyPolicy }))}
                      >
                        <SelectTrigger>
                          <SelectЗначение />
                        </SelectTrigger>
                        <SelectContent>
                          {concurrencyPolicies.map((value) => (
                            <SelectItem key={value} value={value}>{value.replaceВсе("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p classИмя="text-xs text-muted-foreground">{concurrencyPolicyОписаниеs[draft.concurrencyPolicy]}</p>
                    </div>
                    <div classИмя="space-y-2">
                      <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Catch-up</p>
                      <Select
                        value={draft.catchUpPolicy}
                        onЗначениеChange={(catchUpPolicy) => setЧерновик((current) => ({ ...current, catchUpPolicy }))}
                      >
                        <SelectTrigger>
                          <SelectЗначение />
                        </SelectTrigger>
                        <SelectContent>
                          {catchUpPolicies.map((value) => (
                            <SelectItem key={value} value={value}>{value.replaceВсе("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p classИмя="text-xs text-muted-foreground">{catchUpPolicyОписаниеs[draft.catchUpPolicy]}</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <div classИмя="shrink-0 flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div classИмя="text-sm text-muted-foreground">
              After creation, Paperclip takes you straight to trigger setup. Черновик routines stay paused until you add a default agent.
            </div>
            <div classИмя="flex flex-col gap-2 sm:items-end">
              <Button
                onClick={() => createПроцедура.mutate()}
                disabled={
                  createПроцедура.isОжидание ||
                  !draft.title.trim()
                }
              >
                <Plus classИмя="mr-2 h-4 w-4" />
                {createПроцедура.isОжидание ? "Creating..." : "Создать routine"}
              </Button>
              {createПроцедура.isОшибка ? (
                <p classИмя="text-sm text-destructive">
                  {createПроцедура.error instanceof Ошибка ? createПроцедура.error.message : "Ошибка to create routine"}
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {error ? (
        <Card>
          <CardContent classИмя="pt-6 text-sm text-destructive">
            {error instanceof Ошибка ? error.message : "Ошибка to load routines"}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "routines" ? (
        <div>
          {(routines ?? []).length === 0 ? (
            <div classИмя="py-12">
              <EmptyState
                icon={Repeat}
                message="Пока нет процедур. Use Создать routine to define the first recurring workflow."
              />
            </div>
          ) : (
            <div classИмя="rounded-lg border border-border">
              {routineGroups.map((group) => (
                <Collapsible
                  key={group.key}
                  open={!routineViewState.collapsedGroups.includes(group.key)}
                  onOpenChange={(open) => {
                    updateПроцедураView({
                      collapsedGroups: open
                        ? routineViewState.collapsedGroups.filter((item) => item !== group.key)
                        : [...routineViewState.collapsedGroups, group.key],
                    });
                  }}
                >
                  {group.label ? (
                    <div classИмя="flex items-center gap-2 border-b border-border px-3 py-2">
                      <CollapsibleTrigger classИмя="flex items-center gap-1.5">
                        <ChevronRight classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                        <span classИмя="text-sm font-semibold uppercase tracking-wide">
                          {group.label}
                        </span>
                      </CollapsibleTrigger>
                      <span classИмя="text-xs text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                  ) : null}
                  <CollapsibleContent>
                    {group.items.map((routine) => (
                      <ПроцедураListRow
                        key={routine.id}
                        routine={routine}
                        projectById={projectById}
                        agentById={agentById}
                        runningПроцедураId={runningПроцедураId}
                        statusMutationПроцедураId={statusMutationПроцедураId}
                        href={`/routines/${routine.id}`}
                        runСейчасButton
                        onЗапуститьСейчас={handleЗапуститьСейчас}
                        onToggleВключитьd={handleToggleВключитьd}
                        onToggleАрхивирован={handleToggleАрхивирован}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <ПроцедураЗапуститьVariablesDialog
        open={runDialogПроцедура !== null}
        onOpenChange={(next) => {
          if (!next) setЗапуститьDialogПроцедура(null);
        }}
        companyId={selectedКомпанияId}
        routineИмя={runDialogПроцедура?.title ?? null}
        agents={agents ?? []}
        projects={projects ?? []}
        defaultProjectId={runDialogПроцедура?.projectId ?? null}
        defaultИсполнительАгентId={runDialogПроцедура?.assigneeАгентId ?? null}
        variables={runDialogПроцедура?.variables ?? []}
        isОжидание={runПроцедура.isОжидание}
        onОтправить={(data) => {
          if (!runDialogПроцедура) return;
          runПроцедура.mutate({ id: runDialogПроцедура.id, data });
        }}
      />
    </div>
  );
}
