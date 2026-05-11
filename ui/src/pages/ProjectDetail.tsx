import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams, useNavigate, useLocation, Navigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_COLORS, isUuidLike, type БюджетPolicySummary } from "@paperclipai/shared";
import { budgetsApi } from "../api/budgets";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { assetsApi } from "../api/assets";
import { usePanel } from "../context/PanelContext";
import { useКомпания } from "../context/КомпанияContext";
import { useToastActions } from "../context/ToastContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { ProjectProperties, type ProjectConfigFieldКлюч, type ProjectFieldСохранитьState } from "../components/ProjectProperties";
import { InlineИзменитьor } from "../components/InlineИзменитьor";
import { СтатусBadge } from "../components/СтатусBadge";
import { БюджетPolicyCard } from "../components/БюджетPolicyCard";
import { ЗадачиList } from "../components/ЗадачиList";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { ProjectРабочие областиContent } from "../components/ProjectРабочие областиContent";
import { buildProjectРабочая областьSummaries } from "../lib/project-workspaces-tab";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import { projectRouteRef } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { PluginSlotMount, PluginSlotOutlet, usePluginSlots } from "@/plugins/slots";

/* ── Top-level tab types ── */

type ProjectBaseTab = "overview" | "list" | "plugin-operations" | "workspaces" | "configuration" | "budget";
type ProjectPluginTab = `plugin:${string}`;
type ProjectTab = ProjectBaseTab | ProjectPluginTab;

function isProjectPluginTab(value: string | null): value is ProjectPluginTab {
  return typeof value === "string" && value.startsWith("plugin:");
}

function resolveProjectTab(pathname: string, projectId: string): ProjectTab | null {
  const segments = pathname.split("/").filter(Boolean);
  const projectsIdx = segments.indexOf("projects");
  if (projectsIdx === -1 || segments[projectsIdx + 1] !== projectId) return null;
  const tab = segments[projectsIdx + 2];
  if (tab === "overview") return "overview";
  if (tab === "configuration") return "configuration";
  if (tab === "budget") return "budget";
  if (tab === "issues") return "list";
  if (tab === "plugin-operations") return "plugin-operations";
  if (tab === "workspaces") return "workspaces";
  return null;
}

/* ── Обзор tab content ── */

function ОбзорContent({
  project,
  onОбновить,
  imageЗагрузитьHandler,
}: {
  project: { description: string | null; status: string; targetDate: string | null };
  onОбновить: (data: Record<string, unknown>) => void;
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
}) {
  return (
    <div classИмя="space-y-6">
      <InlineИзменитьor
        value={project.description ?? ""}
        onСохранить={(description) => onОбновить({ description })}
        nullable
        as="p"
        classИмя="text-sm text-muted-foreground"
        placeholder="Добавить a description..."
        multiline
        imageЗагрузитьHandler={imageЗагрузитьHandler}
      />

      <div classИмя="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span classИмя="text-muted-foreground">Статус</span>
          <div classИмя="mt-1">
            <СтатусBadge status={project.status} />
          </div>
        </div>
        {project.targetDate && (
          <div>
            <span classИмя="text-muted-foreground">Цель Date</span>
            <p>{project.targetDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Color picker popover ── */

function ColorPicker({
  currentColor,
  onSelect,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Нетde)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div classИмя="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        classИмя="shrink-0 h-5 w-5 rounded-md cursor-pointer hover:ring-2 hover:ring-foreground/20 transition-[box-shadow]"
        style={{ backgroundColor: currentColor }}
        aria-label="Change project color"
      />
      {open && (
        <div classИмя="absolute top-full left-0 mt-2 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 w-max">
          <div classИмя="grid grid-cols-5 gap-1.5">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onSelect(color);
                  setOpen(false);
                }}
                classИмя={`h-6 w-6 rounded-md cursor-pointer transition-[transform,box-shadow] duration-150 hover:scale-110 ${
                  color === currentColor
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                    : "hover:ring-2 hover:ring-foreground/30"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── List (issues) tab content ── */

function ProjectЗадачиList({ projectId, companyId }: { projectId: string; companyId: string }) {
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(companyId),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(companyId),
    enabled: !!companyId,
    refetchInterval: 5000,
  });
  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);

  const { data: issues, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.issues.listByProject(companyId, projectId),
    queryFn: () => issuesApi.list(companyId, { projectId }),
    enabled: !!companyId,
  });

  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, projectId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
    },
  });

  return (
    <ЗадачиList
      issues={issues ?? []}
      isЗагрузка={isЗагрузка}
      error={error as Ошибка | null}
      agents={agents}
      projects={projects}
      liveЗадачаIds={liveЗадачаIds}
      projectId={projectId}
      viewStateКлюч="paperclip:project-issues-view"
      onОбновитьЗадача={(id, data) => updateЗадача.mutate({ id, data })}
    />
  );
}

function ProjectPluginOperationsList({
  projectId,
  companyId,
  pluginКлюч,
}: {
  projectId: string;
  companyId: string;
  pluginКлюч: string;
}) {
  const queryClient = useQueryClient();
  const originKindPrefix = `plugin:${pluginКлюч}`;

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(companyId),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(companyId),
    enabled: !!companyId,
    refetchInterval: 5000,
  });
  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);

  const { data: issues, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.issues.listPluginOperationsByProject(companyId, projectId, originKindPrefix),
    queryFn: () => issuesApi.list(companyId, { projectId, originKindPrefix }),
    enabled: !!companyId && !!projectId,
  });

  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listPluginOperationsByProject(companyId, projectId, originKindPrefix) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, projectId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
    },
  });

  return (
    <ЗадачиList
      issues={issues ?? []}
      isЗагрузка={isЗагрузка}
      error={error as Ошибка | null}
      agents={agents}
      projects={projects}
      liveЗадачаIds={liveЗадачаIds}
      projectId={projectId}
      viewStateКлюч={`paperclip:project-plugin-operations-view:${pluginКлюч}`}
      onОбновитьЗадача={(id, data) => updateЗадача.mutate({ id, data })}
    />
  );
}

/* ── Main project page ── */

export function ProjectDetail() {
  const { companyPrefix, projectId, filter } = useParams<{
    companyPrefix?: string;
    projectId: string;
    filter?: string;
  }>();
  const { companies, selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const { closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [fieldСохранитьStates, setFieldСохранитьStates] = useState<Partial<Record<ProjectConfigFieldКлюч, ProjectFieldСохранитьState>>>({});
  const fieldСохранитьRequestIds = useRef<Partial<Record<ProjectConfigFieldКлюч, number>>>({});
  const fieldСохранитьTimers = useRef<Partial<Record<ProjectConfigFieldКлюч, ReturnТип<typeof setTimeout>>>>({});
  const routeProjectRef = projectId ?? "";
  const routeКомпанияId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);
  const lookupКомпанияId = routeКомпанияId ?? selectedКомпанияId ?? undefined;
  const canFetchProject = routeProjectRef.length > 0 && (isUuidLike(routeProjectRef) || Boolean(lookupКомпанияId));
  const activeRouteTab = routeProjectRef ? resolveProjectTab(location.pathname, routeProjectRef) : null;
  const pluginTabFromПоиск = useMemo(() => {
    const tab = new URLПоискParams(location.search).get("tab");
    return isProjectPluginTab(tab) ? tab : null;
  }, [location.search]);
  const activeTab = activeRouteTab ?? pluginTabFromПоиск;

  const { data: project, isЗагрузка, error } = useQuery({
    queryКлюч: [...queryКлючs.projects.detail(routeProjectRef), lookupКомпанияId ?? null],
    queryFn: () => projectsApi.get(routeProjectRef, lookupКомпанияId),
    enabled: canFetchProject,
  });
  const canonicalProjectRef = project ? projectRouteRef(project) : routeProjectRef;
  const projectLookupRef = project?.id ?? routeProjectRef;
  const resolvedКомпанияId = project?.companyId ?? selectedКомпанияId;
  const experimentalНастройкиQuery = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
  });
  const {
    slots: pluginDetailSlots,
    isЗагрузка: pluginDetailSlotsЗагрузка,
  } = usePluginSlots({
    slotТипs: ["detailTab"],
    entityТип: "project",
    companyId: resolvedКомпанияId,
    enabled: !!resolvedКомпанияId,
  });
  const pluginTabItems = useMemo(
    () => pluginDetailSlots.map((slot) => ({
      value: `plugin:${slot.pluginКлюч}:${slot.id}` as ProjectPluginTab,
      label: slot.displayИмя,
      slot,
    })),
    [pluginDetailSlots],
  );
  const activePluginTab = pluginTabItems.find((item) => item.value === activeTab) ?? null;
  const isolatedРабочие областиВключитьd = experimentalНастройкиQuery.data?.enableIsolatedРабочие области === true;
  const workspaceTabProjectId = project?.id ?? null;
  const { data: workspaceTabЗадачи = [], isЗагрузка: isРабочая областьTabЗадачиЗагрузка, error: workspaceTabЗадачиОшибка } = useQuery({
    queryКлюч: workspaceTabProjectId && resolvedКомпанияId
      ? queryКлючs.issues.listByProject(resolvedКомпанияId, workspaceTabProjectId)
      : ["issues", "__workspace-tab__", "disabled"],
    queryFn: () => issuesApi.list(resolvedКомпанияId!, { projectId: workspaceTabProjectId! }),
    enabled: Boolean(resolvedКомпанияId && workspaceTabProjectId && isolatedРабочие областиВключитьd),
  });
  const {
    data: workspaceTabExecutionРабочие области = [],
    isЗагрузка: isРабочая областьTabExecutionРабочие областиЗагрузка,
    error: workspaceTabExecutionРабочие областиОшибка,
  } = useQuery({
    queryКлюч: workspaceTabProjectId && resolvedКомпанияId
      ? queryКлючs.executionРабочие области.list(resolvedКомпанияId, { projectId: workspaceTabProjectId })
      : ["execution-workspaces", "__workspace-tab__", "disabled"],
    queryFn: () => executionРабочие областиApi.list(resolvedКомпанияId!, { projectId: workspaceTabProjectId! }),
    enabled: Boolean(resolvedКомпанияId && workspaceTabProjectId && isolatedРабочие областиВключитьd),
  });
  const workspaceSummaries = useMemo(() => {
    if (!project || !isolatedРабочие областиВключитьd) return [];
    return buildProjectРабочая областьSummaries({
      project,
      issues: workspaceTabЗадачи,
      executionРабочие области: workspaceTabExecutionРабочие области,
    });
  }, [project, isolatedРабочие областиВключитьd, workspaceTabЗадачи, workspaceTabExecutionРабочие области]);
  const showРабочие областиTab = isolatedРабочие областиВключитьd && workspaceSummaries.length > 0;
  const workspaceTabDecisionLoaded =
    experimentalНастройкиQuery.isFetched &&
    (!isolatedРабочие областиВключитьd || (!isРабочая областьTabЗадачиЗагрузка && !isРабочая областьTabExecutionРабочие областиЗагрузка));
  const workspaceTabОшибка = (workspaceTabЗадачиОшибка ?? workspaceTabExecutionРабочие областиОшибка) as Ошибка | null;

  useEffect(() => {
    if (!project?.companyId || project.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(project.companyId, { source: "route_sync" });
  }, [project?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(routeProjectRef) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(projectLookupRef) });
    if (resolvedКомпанияId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(resolvedКомпанияId) });
    }
  };

  const updateProject = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      projectsApi.update(projectLookupRef, data, resolvedКомпанияId ?? lookupКомпанияId),
    onУспешно: invalidateProject,
  });

  const archiveProject = useMutation({
    mutationFn: (archived: boolean) =>
      projectsApi.update(
        projectLookupRef,
        { archivedAt: archived ? new Date().toISOString() : null },
        resolvedКомпанияId ?? lookupКомпанияId,
      ),
    onУспешно: (updatedProject, archived) => {
      invalidateProject();
      const name = updatedProject?.name ?? project?.name ?? "Project";
      if (archived) {
        pushToast({ title: `"${name}" has been archived`, tone: "success" });
        navigate("/dashboard");
      } else {
        pushToast({ title: `"${name}" has been unarchived`, tone: "success" });
      }
    },
    onОшибка: (_, archived) => {
      pushToast({
        title: archived ? "Ошибка to archive project" : "Ошибка to unarchive project",
        tone: "error",
      });
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedКомпанияId) throw new Ошибка("Нет company selected");
      return assetsApi.uploadImage(resolvedКомпанияId, file, `projects/${projectLookupRef || "draft"}`);
    },
  });

  const { data: budgetОбзор } = useQuery({
    queryКлюч: queryКлючs.budgets.overview(resolvedКомпанияId ?? "__none__"),
    queryFn: () => budgetsApi.overview(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Проекты", href: "/projects" },
      { label: project?.name ?? routeProjectRef ?? "Project" },
    ]);
  }, [setBreadcrumbs, project, routeProjectRef]);

  useEffect(() => {
    if (!project) return;
    if (routeProjectRef === canonicalProjectRef) return;
    if (isProjectPluginTab(activeTab)) {
      navigate(`/projects/${canonicalProjectRef}?tab=${encodeURIComponent(activeTab)}`, { replace: true });
      return;
    }
    if (activeTab === "overview") {
      navigate(`/projects/${canonicalProjectRef}/overview`, { replace: true });
      return;
    }
    if (activeTab === "configuration") {
      navigate(`/projects/${canonicalProjectRef}/configuration`, { replace: true });
      return;
    }
    if (activeTab === "budget") {
      navigate(`/projects/${canonicalProjectRef}/budget`, { replace: true });
      return;
    }
    if (activeTab === "plugin-operations") {
      navigate(`/projects/${canonicalProjectRef}/plugin-operations`, { replace: true });
      return;
    }
    if (activeTab === "workspaces") {
      navigate(`/projects/${canonicalProjectRef}/workspaces`, { replace: true });
      return;
    }
    if (activeTab === "list") {
      if (filter) {
        navigate(`/projects/${canonicalProjectRef}/issues/${filter}`, { replace: true });
        return;
      }
      navigate(`/projects/${canonicalProjectRef}/issues`, { replace: true });
      return;
    }
    navigate(`/projects/${canonicalProjectRef}`, { replace: true });
  }, [project, routeProjectRef, canonicalProjectRef, activeTab, filter, navigate]);

  useEffect(() => {
    closePanel();
    return () => closePanel();
  }, [closePanel]);

  useEffect(() => {
    return () => {
      Object.values(fieldСохранитьTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const setFieldState = useCallback((field: ProjectConfigFieldКлюч, state: ProjectFieldСохранитьState) => {
    setFieldСохранитьStates((current) => ({ ...current, [field]: state }));
  }, []);

  const scheduleFieldСбросить = useCallback((field: ProjectConfigFieldКлюч, delayMs: number) => {
    const existing = fieldСохранитьTimers.current[field];
    if (existing) clearTimeout(existing);
    fieldСохранитьTimers.current[field] = setTimeout(() => {
      setFieldСохранитьStates((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
      delete fieldСохранитьTimers.current[field];
    }, delayMs);
  }, []);

  const updateProjectField = useCallback(async (field: ProjectConfigFieldКлюч, data: Record<string, unknown>) => {
    const requestId = (fieldСохранитьRequestIds.current[field] ?? 0) + 1;
    fieldСохранитьRequestIds.current[field] = requestId;
    setFieldState(field, "saving");
    try {
      await projectsApi.update(projectLookupRef, data, resolvedКомпанияId ?? lookupКомпанияId);
      invalidateProject();
      if (fieldСохранитьRequestIds.current[field] !== requestId) return;
      setFieldState(field, "saved");
      scheduleFieldСбросить(field, 1800);
    } catch (error) {
      if (fieldСохранитьRequestIds.current[field] !== requestId) return;
      setFieldState(field, "error");
      scheduleFieldСбросить(field, 3000);
      throw error;
    }
  }, [invalidateProject, lookupКомпанияId, projectLookupRef, resolvedКомпанияId, scheduleFieldСбросить, setFieldState]);

  const projectБюджетSummary = useMemo(() => {
    const matched = budgetОбзор?.policies.find(
      (policy) => policy.scopeТип === "project" && policy.scopeId === (project?.id ?? routeProjectRef),
    );
    if (matched) return matched;
    return {
      policyId: "",
      companyId: resolvedКомпанияId ?? "",
      scopeТип: "project",
      scopeId: project?.id ?? routeProjectRef,
      scopeИмя: project?.name ?? "Project",
      metric: "billed_cents",
      windowKind: "lifetime",
      amount: 0,
      observedAmount: 0,
      remainingAmount: 0,
      utilizationPercent: 0,
      warnPercent: 80,
      hardОстановитьВключитьd: true,
      notifyВключитьd: true,
      isАктивен: false,
      status: "ok",
      paused: Boolean(project?.pausedAt),
      pauseReason: project?.pauseReason ?? null,
      windowНачать: new Date(),
      windowEnd: new Date(),
    } satisfies БюджетPolicySummary;
  }, [budgetОбзор?.policies, project, resolvedКомпанияId, routeProjectRef]);

  const budgetMutation = useMutation({
    mutationFn: (amount: number) =>
      budgetsApi.upsertPolicy(resolvedКомпанияId!, {
        scopeТип: "project",
        scopeId: project?.id ?? routeProjectRef,
        amount,
        windowKind: "lifetime",
      }),
    onУспешно: () => {
      if (!resolvedКомпанияId) return;
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.budgets.overview(resolvedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(routeProjectRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(projectLookupRef) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(resolvedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(resolvedКомпанияId) });
    },
  });

  if (pluginTabFromПоиск && !pluginDetailSlotsЗагрузка && !activePluginTab) {
    return <Navigate to={`/projects/${canonicalProjectRef}/issues`} replace />;
  }

  if (activeTab === "workspaces" && workspaceTabDecisionLoaded && !showРабочие областиTab) {
    return <Navigate to={`/projects/${canonicalProjectRef}/issues`} replace />;
  }

  // Redirect bare /projects/:id to cached tab or default /issues
  if (routeProjectRef && activeTab === null) {
    let cachedTab: string | null = null;
    if (project?.id) {
      try { cachedTab = localStorage.getItem(`paperclip:project-tab:${project.id}`); } catch {}
    }
    if (cachedTab === "overview") {
      return <Navigate to={`/projects/${canonicalProjectRef}/overview`} replace />;
    }
    if (cachedTab === "configuration") {
      return <Navigate to={`/projects/${canonicalProjectRef}/configuration`} replace />;
    }
    if (cachedTab === "budget") {
      return <Navigate to={`/projects/${canonicalProjectRef}/budget`} replace />;
    }
    if (cachedTab === "plugin-operations" && project?.managedByPlugin) {
      return <Navigate to={`/projects/${canonicalProjectRef}/plugin-operations`} replace />;
    }
    if (cachedTab === "workspaces" && workspaceTabDecisionLoaded && showРабочие областиTab) {
      return <Navigate to={`/projects/${canonicalProjectRef}/workspaces`} replace />;
    }
    if (cachedTab === "workspaces" && !workspaceTabDecisionLoaded) {
      return <PageSkeleton variant="detail" />;
    }
    if (isProjectPluginTab(cachedTab)) {
      return <Navigate to={`/projects/${canonicalProjectRef}?tab=${encodeURIComponent(cachedTab)}`} replace />;
    }
    return <Navigate to={`/projects/${canonicalProjectRef}/issues`} replace />;
  }

  if (isЗагрузка) return <PageSkeleton variant="detail" />;
  if (error) return <p classИмя="text-sm text-destructive">{error.message}</p>;
  if (!project) return null;

  const handleTabChange = (tab: ProjectTab) => {
    // Cache the active tab per project
    if (project?.id) {
      try { localStorage.setItem(`paperclip:project-tab:${project.id}`, tab); } catch {}
    }
    if (isProjectPluginTab(tab)) {
      navigate(`/projects/${canonicalProjectRef}?tab=${encodeURIComponent(tab)}`);
      return;
    }
    if (tab === "overview") {
      navigate(`/projects/${canonicalProjectRef}/overview`);
    } else if (tab === "workspaces") {
      navigate(`/projects/${canonicalProjectRef}/workspaces`);
    } else if (tab === "budget") {
      navigate(`/projects/${canonicalProjectRef}/budget`);
    } else if (tab === "plugin-operations") {
      navigate(`/projects/${canonicalProjectRef}/plugin-operations`);
    } else if (tab === "configuration") {
      navigate(`/projects/${canonicalProjectRef}/configuration`);
    } else {
      navigate(`/projects/${canonicalProjectRef}/issues`);
    }
  };

  return (
    <div classИмя="space-y-6">
      <div classИмя="flex items-start gap-3">
        <div classИмя="h-7 flex items-center">
          <ColorPicker
            currentColor={project.color ?? "#6366f1"}
            onSelect={(color) => updateProject.mutate({ color })}
          />
        </div>
        <div classИмя="min-w-0 space-y-2">
          <InlineИзменитьor
            value={project.name}
            onСохранить={(name) => updateProject.mutate({ name })}
            as="h2"
            classИмя="text-xl font-bold"
          />
          {project.pauseReason === "budget" ? (
            <div classИмя="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-red-200">
              <span classИмя="h-2 w-2 rounded-full bg-red-400" />
              Приостановлен by budget hard stop
            </div>
          ) : null}
          {project.managedByPlugin ? (
            <div classИмя="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <span classИмя="h-2 w-2 rounded-full" style={{ backgroundColor: project.color ?? "#6366f1" }} />
              Managed by {project.managedByPlugin.pluginDisplayИмя}
            </div>
          ) : null}
        </div>
      </div>

      <PluginSlotOutlet
        slotТипs={["toolbarButton", "contextMenuItem"]}
        entityТип="project"
        context={{
          companyId: resolvedКомпанияId ?? null,
          companyPrefix: companyPrefix ?? null,
          projectId: project.id,
          projectRef: canonicalProjectRef,
          entityId: project.id,
          entityТип: "project",
        }}
        classИмя="flex flex-wrap gap-2"
        itemClassИмя="inline-flex"
        missingBehavior="placeholder"
      />

      <PluginLauncherOutlet
        placementZones={["toolbarButton"]}
        entityТип="project"
        context={{
          companyId: resolvedКомпанияId ?? null,
          companyPrefix: companyPrefix ?? null,
          projectId: project.id,
          projectRef: canonicalProjectRef,
          entityId: project.id,
          entityТип: "project",
        }}
        classИмя="flex flex-wrap gap-2"
        itemClassИмя="inline-flex"
      />

      <Tabs value={activeTab ?? "list"} onЗначениеChange={(value) => handleTabChange(value as ProjectTab)}>
        <PageTabBar
          items={[
            { value: "list", label: "Задачи" },
            { value: "overview", label: "Обзор" },
            ...(project.managedByPlugin ? [{ value: "plugin-operations", label: "Plugin operations" }] : []),
            ...(showРабочие областиTab ? [{ value: "workspaces", label: "Рабочие области" }] : []),
            { value: "configuration", label: "Конфигурация" },
            { value: "budget", label: "Бюджет" },
            ...pluginTabItems.map((item) => ({
              value: item.value,
              label: item.label,
            })),
          ]}
          align="start"
          value={activeTab ?? "list"}
          onЗначениеChange={(value) => handleTabChange(value as ProjectTab)}
        />
      </Tabs>

      {activeTab === "overview" && (
        <ОбзорContent
          project={project}
          onОбновить={(data) => updateProject.mutate(data)}
          imageЗагрузитьHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentПуть;
          }}
        />
      )}

      {activeTab === "list" && project?.id && resolvedКомпанияId && (
        <ProjectЗадачиList projectId={project.id} companyId={resolvedКомпанияId} />
      )}

      {activeTab === "plugin-operations" && project?.id && resolvedКомпанияId && project.managedByPlugin && (
        <ProjectPluginOperationsList
          projectId={project.id}
          companyId={resolvedКомпанияId}
          pluginКлюч={project.managedByPlugin.pluginКлюч}
        />
      )}

      {activeTab === "workspaces" ? (
        workspaceTabDecisionLoaded ? (
          workspaceTabОшибка ? (
            <p classИмя="text-sm text-destructive">{workspaceTabОшибка.message}</p>
          ) : (
            <ProjectРабочие областиContent
              companyId={resolvedКомпанияId!}
              projectId={project.id}
              projectRef={canonicalProjectRef}
              summaries={workspaceSummaries}
            />
          )
        ) : (
          <p classИмя="text-sm text-muted-foreground">Загрузка workspaces...</p>
        )
      ) : null}

      {activeTab === "configuration" && (
        <div classИмя="max-w-4xl">
          <ProjectProperties
            project={project}
            onОбновить={(data) => updateProject.mutate(data)}
            onFieldОбновить={updateProjectField}
            getFieldСохранитьState={(field) => fieldСохранитьStates[field] ?? "idle"}
            onАрхивировать={(archived) => archiveProject.mutate(archived)}
            archiveОжидание={archiveProject.isОжидание}
          />
        </div>
      )}

      {activeTab === "budget" && resolvedКомпанияId ? (
        <div classИмя="max-w-3xl">
          <БюджетPolicyCard
            summary={projectБюджетSummary}
            variant="plain"
            isSaving={budgetMutation.isОжидание}
            onСохранить={(amount) => budgetMutation.mutate(amount)}
          />
        </div>
      ) : null}

      {activePluginTab && (
        <PluginSlotMount
          slot={activePluginTab.slot}
          context={{
            companyId: resolvedКомпанияId,
            companyPrefix: companyPrefix ?? null,
            projectId: project.id,
            projectRef: canonicalProjectRef,
            entityId: project.id,
            entityТип: "project",
          }}
          missingBehavior="placeholder"
        />
      )}
    </div>
  );
}
