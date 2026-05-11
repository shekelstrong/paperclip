import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExecutionРабочая область, Задача, Project, ProjectРабочая область, ПроцедураListItem } from "@paperclipai/shared";
import { Копировать, ExternalLink, Loader2, Play, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание, CardAction } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { КопироватьText } from "../components/КопироватьText";
import { ExecutionРабочая областьЗакрытьDialog } from "../components/ExecutionРабочая областьЗакрытьDialog";
import { agentsApi } from "../api/agents";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { routinesApi } from "../api/routines";
import { ЗадачиList } from "../components/ЗадачиList";
import { PageTabBar } from "../components/PageTabBar";
import {
  ПроцедураЗапуститьVariablesDialog,
  type ПроцедураЗапуститьDialogОтправитьData,
} from "../components/ПроцедураЗапуститьVariablesDialog";
import {
  buildРабочая областьЗапуститьtimeControlSections,
  Рабочая областьЗапуститьtimeQuickControls,
  Рабочая областьЗапуститьtimeControls,
  type Рабочая областьЗапуститьtimeControlRequest,
} from "../components/Рабочая областьЗапуститьtimeControls";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { useToastActions } from "../context/ToastContext";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import { queryКлючs } from "../lib/queryКлючs";
import { cn, formatDateTime, issueUrl, projectRouteRef, projectРабочая областьUrl } from "../lib/utils";
import {
  getРабочая областьSpecificПроцедураVariableИмяs,
  routineHasРабочая областьSpecificVariables,
} from "../lib/workspace-routines";

type Рабочая областьFormState = {
  name: string;
  cwd: string;
  repoUrl: string;
  baseRef: string;
  branchИмя: string;
  providerRef: string;
  provisionКоманда: string;
  teardownКоманда: string;
  cleanupКоманда: string;
  inheritЗапуститьtime: boolean;
  workspaceЗапуститьtime: string;
};

type ExecutionРабочая областьTab = "services" | "configuration" | "runtime_logs" | "issues" | "routines";

function resolveExecutionРабочая областьTab(pathname: string, workspaceId: string): ExecutionРабочая областьTab | null {
  const segments = pathname.split("/").filter(Boolean);
  const executionРабочие областиIndex = segments.indexOf("execution-workspaces");
  if (executionРабочие областиIndex === -1 || segments[executionРабочие областиIndex + 1] !== workspaceId) return null;
  const tab = segments[executionРабочие областиIndex + 2];
  if (tab === "services") return "services";
  if (tab === "issues") return "issues";
  if (tab === "routines") return "routines";
  if (tab === "runtime-logs") return "runtime_logs";
  if (tab === "configuration") return "configuration";
  return null;
}

function executionРабочая областьTabПуть(workspaceId: string, tab: ExecutionРабочая областьTab) {
  const segment = tab === "runtime_logs" ? "runtime-logs" : tab;
  return `/execution-workspaces/${workspaceId}/${segment}`;
}

function LegacyРабочая областьTabRedirect({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(`paperclip:execution-workspace-tab:${workspaceId}`);
    } catch {}
  }, [workspaceId]);

  return <Navigate to={executionРабочая областьTabПуть(workspaceId, "issues")} replace />;
}

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readText(value: string | null | undefined) {
  return value ?? "";
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function formatОпциональноDateTime(value: Date | string | null | undefined) {
  return value ? formatDateTime(value) : "Никогда";
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseРабочая областьЗапуститьtimeJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null as Record<string, unknown> | null };

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false as const,
        error: "Рабочая область commands JSON must be a JSON object.",
      };
    }
    return { ok: true as const, value: parsed as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Ошибка ? error.message : "Invalid JSON.",
    };
  }
}

function formStateFromРабочая область(workspace: ExecutionРабочая область): Рабочая областьFormState {
  return {
    name: workspace.name,
    cwd: readText(workspace.cwd),
    repoUrl: readText(workspace.repoUrl),
    baseRef: readText(workspace.baseRef),
    branchИмя: readText(workspace.branchИмя),
    providerRef: readText(workspace.providerRef),
    provisionКоманда: readText(workspace.config?.provisionКоманда),
    teardownКоманда: readText(workspace.config?.teardownКоманда),
    cleanupКоманда: readText(workspace.config?.cleanupКоманда),
    inheritЗапуститьtime: !workspace.config?.workspaceЗапуститьtime,
    workspaceЗапуститьtime: formatJson(workspace.config?.workspaceЗапуститьtime),
  };
}

function buildРабочая областьPatch(initialState: Рабочая областьFormState, nextState: Рабочая областьFormState) {
  const patch: Record<string, unknown> = {};
  const configPatch: Record<string, unknown> = {};

  const maybeAssign = (
    key: keyof Pick<Рабочая областьFormState, "name" | "cwd" | "repoUrl" | "baseRef" | "branchИмя" | "providerRef">,
  ) => {
    if (initialState[key] === nextState[key]) return;
    patch[key] = key === "name" ? (normalizeText(nextState[key]) ?? initialState.name) : normalizeText(nextState[key]);
  };

  maybeAssign("name");
  maybeAssign("cwd");
  maybeAssign("repoUrl");
  maybeAssign("baseRef");
  maybeAssign("branchИмя");
  maybeAssign("providerRef");

  const maybeAssignConfigText = (key: keyof Pick<Рабочая областьFormState, "provisionКоманда" | "teardownКоманда" | "cleanupКоманда">) => {
    if (initialState[key] === nextState[key]) return;
    configPatch[key] = normalizeText(nextState[key]);
  };

  maybeAssignConfigText("provisionКоманда");
  maybeAssignConfigText("teardownКоманда");
  maybeAssignConfigText("cleanupКоманда");

  if (initialState.inheritЗапуститьtime !== nextState.inheritЗапуститьtime || initialState.workspaceЗапуститьtime !== nextState.workspaceЗапуститьtime) {
    const parsed = parseРабочая областьЗапуститьtimeJson(nextState.workspaceЗапуститьtime);
    if (!parsed.ok) throw new Ошибка(parsed.error);
    configPatch.workspaceЗапуститьtime = nextState.inheritЗапуститьtime ? null : parsed.value;
  }

  if (Object.keys(configPatch).length > 0) {
    patch.config = configPatch;
  }

  return patch;
}

function validateForm(form: Рабочая областьFormState) {
  const repoUrl = normalizeText(form.repoUrl);
  if (repoUrl) {
    try {
      new URL(repoUrl);
    } catch {
      return "URL репозитория must be a valid URL.";
    }
  }

  if (!form.inheritЗапуститьtime) {
    const runtimeJson = parseРабочая областьЗапуститьtimeJson(form.workspaceЗапуститьtime);
    if (!runtimeJson.ok) {
      return runtimeJson.error;
    }
  }

  return null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactНетde;
}) {
  return (
    <label classИмя="block space-y-2">
      <div classИмя="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span classИмя="text-sm font-medium text-foreground">{label}</span>
        {hint ? <span classИмя="text-xs text-muted-foreground sm:text-right">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-start sm:gap-3">
      <div classИмя="shrink-0 text-xs text-muted-foreground sm:w-32">{label}</div>
      <div classИмя="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

function СтатусPill({ children, classИмя }: { children: React.ReactНетde; classИмя?: string }) {
  return (
    <div classИмя={cn("inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground", classИмя)}>
      {children}
    </div>
  );
}

function MonoЗначение({ value, copy }: { value: string; copy?: boolean }) {
  return (
    <div classИмя="inline-flex max-w-full items-start gap-2">
      <span classИмя="break-all font-mono text-xs">{value}</span>
      {copy ? (
        <КопироватьText text={value} classИмя="shrink-0 text-muted-foreground hover:text-foreground" copiedLabel="Copied">
          <Копировать classИмя="h-3.5 w-3.5" />
        </КопироватьText>
      ) : null}
    </div>
  );
}

function Рабочая областьLink({
  project,
  workspace,
}: {
  project: Project;
  workspace: ProjectРабочая область;
}) {
  return <Link to={projectРабочая областьUrl(project, workspace.id)} classИмя="hover:underline">{workspace.name}</Link>;
}

function ExecutionРабочая областьЗадачиList({
  companyId,
  workspace,
  issues,
  isЗагрузка,
  error,
  project,
}: {
  companyId: string;
  workspace: ExecutionРабочая область;
  issues: Задача[];
  isЗагрузка: boolean;
  error: Ошибка | null;
  project: Project | null;
}) {
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

  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);

  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => issuesApi.update(id, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByExecutionРабочая область(companyId, workspace.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
      if (project?.id) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, project.id) });
      }
    },
  });

  const projectOptions = useMemo(
    () => (project ? [{ id: project.id, name: project.name, workspaces: project.workspaces ?? [] }] : undefined),
    [project],
  );
  const createЗадачаПо умолчаниюs = useMemo(
    () => ({
      projectId: workspace.projectId,
      ...(workspace.projectРабочая областьId ? { projectРабочая областьId: workspace.projectРабочая областьId } : {}),
      executionРабочая областьId: workspace.id,
      executionРабочая областьMode: "reuse_existing",
    }),
    [workspace.id, workspace.projectId, workspace.projectРабочая областьId],
  );

  return (
    <ЗадачиList
      issues={issues}
      isЗагрузка={isЗагрузка}
      error={error}
      agents={agents}
      projects={projectOptions}
      liveЗадачаIds={liveЗадачаIds}
      projectId={project?.id}
      viewStateКлюч="paperclip:execution-workspace-issues-view"
      baseСоздатьЗадачаПо умолчаниюs={createЗадачаПо умолчаниюs}
      onОбновитьЗадача={(id, data) => updateЗадача.mutate({ id, data })}
    />
  );
}

function Рабочая областьПроцедураRow({
  routine,
  variableИмяs,
  runningПроцедураId,
  onЗапуститьСейчас,
}: {
  routine: ПроцедураListItem;
  variableИмяs: string[];
  runningПроцедураId: string | null;
  onЗапуститьСейчас: (routine: ПроцедураListItem) => void;
}) {
  const isАрхивирован = routine.status === "archived";
  const isВыполняется = runningПроцедураId === routine.id;

  return (
    <div classИмя="flex flex-col gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:flex-row sm:items-center">
      <div classИмя="min-w-0 flex-1 space-y-1.5">
        <div classИмя="flex flex-wrap items-center gap-2">
          <Link to={`/routines/${routine.id}`} classИмя="truncate text-sm font-medium hover:underline">
            {routine.title}
          </Link>
          {routine.status !== "active" ? (
            <span classИмя="text-xs text-muted-foreground">{routine.status}</span>
          ) : null}
        </div>
        <div classИмя="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{routine.assigneeАгентId ? "Агент по умолчанию задан" : "Choose agent when running"}</span>
          <span>Last run {formatОпциональноDateTime(routine.lastЗапустить?.triggeredAt ?? routine.lastTriggeredAt)}</span>
          <span classИмя="flex flex-wrap gap-1">
            {variableИмяs.map((name) => (
              <span key={name} classИмя="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {name}
              </span>
            ))}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        classИмя="w-full sm:w-auto"
        disabled={isАрхивирован || isВыполняется}
        onClick={() => onЗапуститьСейчас(routine)}
      >
        {isВыполняется ? <Loader2 classИмя="mr-2 h-4 w-4 animate-spin" /> : <Play classИмя="mr-2 h-4 w-4" />}
        {isВыполняется ? "Выполняется..." : "Запустить сейчас"}
      </Button>
    </div>
  );
}

function ExecutionРабочая областьПроцедурыList({
  workspace,
  project,
}: {
  workspace: ExecutionРабочая область;
  project: Project | null;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [runDialogПроцедура, setЗапуститьDialogПроцедура] = useState<ПроцедураListItem | null>(null);
  const [runningПроцедураId, setВыполняетсяПроцедураId] = useState<string | null>(null);

  const { data: routines, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.routines.list(workspace.companyId, { projectId: workspace.projectId }),
    queryFn: () => routinesApi.list(workspace.companyId, { projectId: workspace.projectId }),
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(workspace.companyId),
    queryFn: () => agentsApi.list(workspace.companyId),
  });

  const workspaceПроцедуры = useMemo(
    () => (routines ?? []).filter(routineHasРабочая областьSpecificVariables),
    [routines],
  );

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
        queryClient.invalidateQueries({ queryКлюч: ["routines", workspace.companyId] }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(id) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByExecutionРабочая область(workspace.companyId, workspace.id) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(workspace.companyId) }),
      ]);
      pushToast({
        title: "Процедура started",
        body: "Paperclip created a run using this execution workspace.",
        tone: "success",
      });
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

  return (
    <>
      <Card classИмя="rounded-none">
        <CardHeader>
          <CardНазвание>Рабочая область routines</CardНазвание>
          <CardОписание>
            Процедуры that use workspace-specific variables can be run against this execution workspace.
          </CardОписание>
        </CardHeader>
        <CardContent>
          {isЗагрузка ? (
            <p classИмя="text-sm text-muted-foreground">Загрузка routines...</p>
          ) : error ? (
            <p classИмя="text-sm text-destructive">
              {error instanceof Ошибка ? error.message : "Ошибка to load routines."}
            </p>
          ) : workspaceПроцедуры.length === 0 ? (
            <div classИмя="flex flex-col items-center gap-2 py-10 text-center">
              <Repeat classИмя="h-5 w-5 text-muted-foreground" />
              <p classИмя="text-sm text-muted-foreground">
                Нет routines use workspace-specific variables yet.
              </p>
            </div>
          ) : (
            <div classИмя="rounded-lg border border-border">
              {workspaceПроцедуры.map((routine) => (
                <Рабочая областьПроцедураRow
                  key={routine.id}
                  routine={routine}
                  variableИмяs={getРабочая областьSpecificПроцедураVariableИмяs(routine)}
                  runningПроцедураId={runningПроцедураId}
                  onЗапуститьСейчас={setЗапуститьDialogПроцедура}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ПроцедураЗапуститьVariablesDialog
        open={runDialogПроцедура !== null}
        onOpenChange={(next) => {
          if (!next) setЗапуститьDialogПроцедура(null);
        }}
        companyId={workspace.companyId}
        routineИмя={runDialogПроцедура?.title ?? null}
        agents={agents ?? []}
        projects={project ? [project] : []}
        defaultProjectId={workspace.projectId}
        defaultИсполнительАгентId={runDialogПроцедура?.assigneeАгентId ?? null}
        defaultExecutionРабочая область={workspace}
        variables={runDialogПроцедура?.variables ?? []}
        isОжидание={runПроцедура.isОжидание}
        onОтправить={(data) => {
          if (!runDialogПроцедура) return;
          runПроцедура.mutate({ id: runDialogПроцедура.id, data });
        }}
      />
    </>
  );
}

export function ExecutionРабочая областьDetail() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const [form, setForm] = useState<Рабочая областьFormState | null>(null);
  const [closeDialogOpen, setЗакрытьDialogOpen] = useState(false);
  const [errorMessage, setОшибкаMessage] = useState<string | null>(null);
  const [runtimeActionОшибкаMessage, setЗапуститьtimeActionОшибкаMessage] = useState<string | null>(null);
  const [runtimeActionMessage, setЗапуститьtimeActionMessage] = useState<string | null>(null);
  const activeTab = workspaceId ? resolveExecutionРабочая областьTab(location.pathname, workspaceId) : null;

  const workspaceQuery = useQuery({
    queryКлюч: queryКлючs.executionРабочие области.detail(workspaceId!),
    queryFn: () => executionРабочие областиApi.get(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const workspace = workspaceQuery.data ?? null;

  const projectQuery = useQuery({
    queryКлюч: workspace ? [...queryКлючs.projects.detail(workspace.projectId), workspace.companyId] : ["projects", "detail", "__pending__"],
    queryFn: () => projectsApi.get(workspace!.projectId, workspace!.companyId),
    enabled: Boolean(workspace?.projectId),
  });
  const project = projectQuery.data ?? null;

  const sourceЗадачаQuery = useQuery({
    queryКлюч: workspace?.sourceЗадачаId ? queryКлючs.issues.detail(workspace.sourceЗадачаId) : ["issues", "detail", "__none__"],
    queryFn: () => issuesApi.get(workspace!.sourceЗадачаId!),
    enabled: Boolean(workspace?.sourceЗадачаId),
  });
  const sourceЗадача = sourceЗадачаQuery.data ?? null;

  const derivedРабочая областьQuery = useQuery({
    queryКлюч: workspace?.derivedFromExecutionРабочая областьId
      ? queryКлючs.executionРабочие области.detail(workspace.derivedFromExecutionРабочая областьId)
      : ["execution-workspaces", "detail", "__none__"],
    queryFn: () => executionРабочие областиApi.get(workspace!.derivedFromExecutionРабочая областьId!),
    enabled: Boolean(workspace?.derivedFromExecutionРабочая областьId),
  });
  const derivedРабочая область = derivedРабочая областьQuery.data ?? null;
  const linkedЗадачиQuery = useQuery({
    queryКлюч: workspace
      ? queryКлючs.issues.listByExecutionРабочая область(workspace.companyId, workspace.id)
      : ["issues", "__execution-workspace__", "__none__"],
    queryFn: () => issuesApi.list(workspace!.companyId, { executionРабочая областьId: workspace!.id }),
    enabled: Boolean(workspace?.companyId),
  });
  const linkedЗадачи = linkedЗадачиQuery.data ?? [];

  const linkedProjectРабочая область = useMemo(
    () => project?.workspaces.find((item) => item.id === workspace?.projectРабочая областьId) ?? null,
    [project, workspace?.projectРабочая областьId],
  );
  const inheritedЗапуститьtimeConfig = linkedProjectРабочая область?.runtimeConfig?.workspaceЗапуститьtime ?? null;
  const effectiveЗапуститьtimeConfig = workspace?.config?.workspaceЗапуститьtime ?? inheritedЗапуститьtimeConfig;
  const runtimeConfigSource =
    workspace?.config?.workspaceЗапуститьtime
      ? "execution_workspace"
      : inheritedЗапуститьtimeConfig
        ? "project_workspace"
        : "none";

  const initialState = useMemo(() => (workspace ? formStateFromРабочая область(workspace) : null), [workspace]);
  const isDirty = Boolean(form && initialState && JSON.stringify(form) !== JSON.stringify(initialState));
  const projectRef = project ? projectRouteRef(project) : workspace?.projectId ?? "";

  useEffect(() => {
    if (!workspace?.companyId || workspace.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(workspace.companyId, { source: "route_sync" });
  }, [workspace?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  useEffect(() => {
    if (!workspace) return;
    setForm(formStateFromРабочая область(workspace));
    setОшибкаMessage(null);
    setЗапуститьtimeActionОшибкаMessage(null);
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    const crumbs = [
      { label: "Проекты", href: "/projects" },
      ...(project ? [{ label: project.name, href: `/projects/${projectRef}` }] : []),
      ...(project ? [{ label: "Рабочие области", href: `/projects/${projectRef}/workspaces` }] : []),
      { label: workspace.name },
    ];
    setBreadcrumbs(crumbs);
  }, [setBreadcrumbs, workspace, project, projectRef]);

  const updateРабочая область = useMutation({
    mutationFn: (patch: Record<string, unknown>) => executionРабочие областиApi.update(workspace!.id, patch),
    onУспешно: (nextРабочая область) => {
      queryClient.setQueryData(queryКлючs.executionРабочие области.detail(nextРабочая область.id), nextРабочая область);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.closeReadiness(nextРабочая область.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.workspaceOperations(nextРабочая область.id) });
      if (project) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.id) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.urlКлюч) });
      }
      if (sourceЗадача) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(sourceЗадача.id) });
      }
      setОшибкаMessage(null);
    },
    onОшибка: (error) => {
      setОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to save execution workspace.");
    },
  });
  const workspaceOperationsQuery = useQuery({
    queryКлюч: queryКлючs.executionРабочие области.workspaceOperations(workspaceId!),
    queryFn: () => executionРабочие областиApi.listРабочая областьOperations(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const controlЗапуститьtimeServices = useMutation({
    mutationFn: (request: Рабочая областьЗапуститьtimeControlRequest) =>
      executionРабочие областиApi.controlЗапуститьtimeКоманды(workspace!.id, request.action, request),
    onУспешно: (result, request) => {
      queryClient.setQueryData(queryКлючs.executionРабочие области.detail(result.workspace.id), result.workspace);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.workspaceOperations(result.workspace.id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(result.workspace.projectId) });
      setЗапуститьtimeActionОшибкаMessage(null);
      setЗапуститьtimeActionMessage(
        request.action === "run"
          ? "Рабочая область job completed."
          : request.action === "stop"
            ? "Рабочая область service stopped."
            : request.action === "restart"
              ? "Рабочая область service restarted."
              : "Рабочая область service started.",
      );
    },
    onОшибка: (error) => {
      setЗапуститьtimeActionMessage(null);
      setЗапуститьtimeActionОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to control workspace commands.");
    },
  });

  if (workspaceQuery.isЗагрузка) return <p classИмя="text-sm text-muted-foreground">Загрузка workspace…</p>;
  if (workspaceQuery.error) {
    return (
      <p classИмя="text-sm text-destructive">
        {workspaceQuery.error instanceof Ошибка ? workspaceQuery.error.message : "Ошибка to load workspace"}
      </p>
    );
  }
  if (!workspace || !form || !initialState) return null;

  const canЗапуститьРабочая областьКоманды = Boolean(workspace.cwd);
  const canНачатьЗапуститьtimeServices = Boolean(effectiveЗапуститьtimeConfig) && canЗапуститьРабочая областьКоманды;
  const runtimeControlSections = buildРабочая областьЗапуститьtimeControlSections({
    runtimeConfig: effectiveЗапуститьtimeConfig,
    runtimeServices: workspace.runtimeServices ?? [],
    canНачатьServices: canНачатьЗапуститьtimeServices,
    canЗапуститьJobs: canЗапуститьРабочая областьКоманды,
  });
  const pendingЗапуститьtimeAction = controlЗапуститьtimeServices.isОжидание ? controlЗапуститьtimeServices.variables ?? null : null;

  if (workspaceId && activeTab === null) {
    return <LegacyРабочая областьTabRedirect workspaceId={workspaceId} />;
  }

  const handleTabChange = (tab: ExecutionРабочая областьTab) => {
    navigate(executionРабочая областьTabПуть(workspace.id, tab));
  };

  const saveChanges = () => {
    const validationОшибка = validateForm(form);
    if (validationОшибка) {
      setОшибкаMessage(validationОшибка);
      return;
    }

    let patch: Record<string, unknown>;
    try {
      patch = buildРабочая областьPatch(initialState, form);
    } catch (error) {
      setОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to build workspace update.");
      return;
    }

    if (Object.keys(patch).length === 0) return;
    updateРабочая область.mutate(patch);
  };

  return (
    <>
      <div classИмя="space-y-4 overflow-hidden sm:space-y-6">
        <div classИмя="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div classИмя="min-w-0 space-y-2">
            <div classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Execution workspace
            </div>
            <h1 classИмя="truncate text-xl font-semibold sm:text-2xl">{workspace.name}</h1>
          </div>
          <Рабочая областьЗапуститьtimeQuickControls
            sections={runtimeControlSections}
            isОжидание={controlЗапуститьtimeServices.isОжидание}
            pendingRequest={pendingЗапуститьtimeAction}
            onAction={(request) => controlЗапуститьtimeServices.mutate(request)}
          />
        </div>
        {runtimeActionОшибкаMessage ? <p classИмя="text-sm text-destructive">{runtimeActionОшибкаMessage}</p> : null}
        {!runtimeActionОшибкаMessage && runtimeActionMessage ? <p classИмя="text-sm text-muted-foreground">{runtimeActionMessage}</p> : null}

        <Tabs value={activeTab ?? "issues"} onЗначениеChange={(value) => handleTabChange(value as ExecutionРабочая областьTab)}>
          <PageTabBar
            items={[
              { value: "issues", label: "Задачи" },
              { value: "services", label: "Services" },
              { value: "configuration", label: "Конфигурация" },
              { value: "runtime_logs", label: "Запуститьtime logs" },
              { value: "routines", label: "Процедуры" },
            ]}
            align="start"
            value={activeTab ?? "issues"}
            onЗначениеChange={(value) => handleTabChange(value as ExecutionРабочая областьTab)}
          />
        </Tabs>

        {activeTab === "services" ? (
          <Рабочая областьЗапуститьtimeControls
            sections={runtimeControlSections}
            isОжидание={controlЗапуститьtimeServices.isОжидание}
            pendingRequest={pendingЗапуститьtimeAction}
            serviceEmptyMessage={
              effectiveЗапуститьtimeConfig
                ? "Нет services have been started for this execution workspace yet."
                : "Нет workspace command config is defined for this execution workspace yet."
            }
            jobEmptyMessage="Нет one-shot jobs are configured for this execution workspace yet."
            disabledHint={
              canНачатьЗапуститьtimeServices
                ? null
                : "Execution workspaces need a working directory before local commands can run, and services also need runtime config."
            }
            onAction={(request) => controlЗапуститьtimeServices.mutate(request)}
          />
        ) : activeTab === "configuration" ? (
          <div classИмя="space-y-4 sm:space-y-6">
            <Card classИмя="rounded-none">
              <CardHeader>
                <CardНазвание>Рабочая область settings</CardНазвание>
                <CardОписание>
                  Изменить the concrete path, repo, branch, provisioning, teardown, and runtime overrides attached to this execution workspace.
                </CardОписание>
                <CardAction>
                  <Button
                    variant="destructive"
                    size="sm"
                    classИмя="w-full sm:w-auto"
                    onClick={() => setЗакрытьDialogOpen(true)}
                    disabled={workspace.status === "archived"}
                  >
                    {workspace.status === "cleanup_failed" ? "Повторить close" : "Закрыть workspace"}
                  </Button>
                </CardAction>
              </CardHeader>

              <CardContent>

              <div classИмя="space-y-6">
                <div classИмя="space-y-4">
                  <div classИмя="text-xs font-medium uppercase tracking-widest text-muted-foreground">Общие</div>
                  <Field label="Название области">
                    <Input
                      value={form.name}
                      onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                      placeholder="Execution workspace name"
                    />
                  </Field>
                </div>

                <Separator />

                <div classИмя="space-y-4">
                  <div classИмя="text-xs font-medium uppercase tracking-widest text-muted-foreground">Source control</div>
                  <div classИмя="grid gap-4 sm:grid-cols-2">
                    <Field label="Ветка name" hint="Useful for isolated worktrees">
                      <Input
                        classИмя="font-mono"
                        value={form.branchИмя}
                        onChange={(event) => setForm((current) => current ? { ...current, branchИмя: event.target.value } : current)}
                        placeholder="PAP-946-workspace"
                      />
                    </Field>

                    <Field label="Base ref">
                      <Input
                        classИмя="font-mono"
                        value={form.baseRef}
                        onChange={(event) => setForm((current) => current ? { ...current, baseRef: event.target.value } : current)}
                        placeholder="origin/main"
                      />
                    </Field>
                  </div>

                  <Field label="URL репозитория">
                    <Input
                      value={form.repoUrl}
                      onChange={(event) => setForm((current) => current ? { ...current, repoUrl: event.target.value } : current)}
                      placeholder="https://github.com/org/repo"
                    />
                  </Field>
                </div>

                <Separator />

                <div classИмя="space-y-4">
                  <div classИмя="text-xs font-medium uppercase tracking-widest text-muted-foreground">Путьs</div>
                  <Field label="Рабочая директория">
                    <Input
                      classИмя="font-mono"
                      value={form.cwd}
                      onChange={(event) => setForm((current) => current ? { ...current, cwd: event.target.value } : current)}
                      placeholder="/absolute/path/to/workspace"
                    />
                  </Field>

                  <Field label="Провайдер path / ref">
                    <Input
                      classИмя="font-mono"
                      value={form.providerRef}
                      onChange={(event) => setForm((current) => current ? { ...current, providerRef: event.target.value } : current)}
                      placeholder="/path/to/worktree or provider ref"
                    />
                  </Field>
                </div>

                <Separator />

                <div classИмя="space-y-4">
                  <div classИмя="text-xs font-medium uppercase tracking-widest text-muted-foreground">Lifecycle commands</div>
                  <Field label="Provision command" hint="Запуститьs when Paperclip prepares this execution workspace">
                    <Textarea
                      classИмя="min-h-20 font-mono"
                      value={form.provisionКоманда}
                      onChange={(event) => setForm((current) => current ? { ...current, provisionКоманда: event.target.value } : current)}
                      placeholder="bash ./scripts/provision-worktree.sh"
                    />
                  </Field>

                  <Field label="Teardown command" hint="Запуститьs when the execution workspace is archived or cleaned up">
                    <Textarea
                      classИмя="min-h-20 font-mono"
                      value={form.teardownКоманда}
                      onChange={(event) => setForm((current) => current ? { ...current, teardownКоманда: event.target.value } : current)}
                      placeholder="bash ./scripts/teardown-worktree.sh"
                    />
                  </Field>

                  <Field label="Cleanup command" hint="Рабочая область-specific cleanup before teardown">
                    <Textarea
                      classИмя="min-h-16 font-mono"
                      value={form.cleanupКоманда}
                      onChange={(event) => setForm((current) => current ? { ...current, cleanupКоманда: event.target.value } : current)}
                      placeholder="pkill -f vite || true"
                    />
                  </Field>
                </div>

                <Separator />

                <div classИмя="space-y-4">
                  <div classИмя="text-xs font-medium uppercase tracking-widest text-muted-foreground">Запуститьtime config</div>
                  <div classИмя="rounded-md border border-dashed border-border/70 bg-background px-4 py-3">
                    <div classИмя="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div classИмя="space-y-1">
                        <div classИмя="text-sm font-medium text-foreground">
                          Запуститьtime config source
                        </div>
                        <p classИмя="text-sm text-muted-foreground">
                          {runtimeConfigSource === "execution_workspace"
                            ? "This execution workspace currently overrides the project workspace runtime config."
                            : runtimeConfigSource === "project_workspace"
                              ? "This execution workspace is inheriting the project workspace runtime config."
                              : "Нет runtime config is currently defined on this execution workspace or its project workspace."}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        classИмя="w-full sm:w-auto"
                        size="sm"
                        disabled={!linkedProjectРабочая область?.runtimeConfig?.workspaceЗапуститьtime}
                        onClick={() =>
                          setForm((current) => current ? {
                            ...current,
                            inheritЗапуститьtime: true,
                            workspaceЗапуститьtime: "",
                          } : current)
                        }
                      >
                        Сбросить to inherit
                      </Button>
                    </div>
                  </div>

                  <details classИмя="rounded-md border border-dashed border-border/70 bg-background px-4 py-3">
                    <summary classИмя="cursor-pointer text-sm font-medium">Дополнительно runtime JSON</summary>
                    <p classИмя="mt-2 text-sm text-muted-foreground">
                      Override the inherited workspace command model only when this execution workspace truly needs different service or job behavior.
                    </p>
                    <div classИмя="mt-3">
                      <Field label="Рабочая область commands JSON" hint="Legacy `services` arrays still work, but `commands` supports both services and jobs.">
                        <div classИмя="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            id="inherit-runtime-config"
                            type="checkbox"
                            classИмя="rounded border-border"
                            checked={form.inheritЗапуститьtime}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setForm((current) => {
                                if (!current) return current;
                                if (!checked && !current.workspaceЗапуститьtime.trim() && inheritedЗапуститьtimeConfig) {
                                  return { ...current, inheritЗапуститьtime: checked, workspaceЗапуститьtime: formatJson(inheritedЗапуститьtimeConfig) };
                                }
                                return { ...current, inheritЗапуститьtime: checked };
                              });
                            }}
                          />
                          <label htmlFor="inherit-runtime-config">Inherit project workspace runtime config</label>
                        </div>
                        <Textarea
                          classИмя="min-h-64 font-mono sm:min-h-96"
                          value={form.workspaceЗапуститьtime}
                          onChange={(event) => setForm((current) => current ? { ...current, workspaceЗапуститьtime: event.target.value } : current)}
                          disabled={form.inheritЗапуститьtime}
                          placeholder={'{\n  "commands": [\n    {\n      "id": "web",\n      "name": "web",\n      "kind": "service",\n      "command": "pnpm dev",\n      "cwd": ".",\n      "port": { "type": "auto" }\n    },\n    {\n      "id": "db-migrate",\n      "name": "db:migrate",\n      "kind": "job",\n      "command": "pnpm db:migrate",\n      "cwd": "."\n    }\n  ]\n}'}
                        />
                      </Field>
                    </div>
                  </details>
                </div>
              </div>

              <div classИмя="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button classИмя="w-full sm:w-auto" disabled={!isDirty || updateРабочая область.isОжидание} onClick={saveChanges}>
                  {updateРабочая область.isОжидание ? <Loader2 classИмя="mr-2 h-4 w-4 animate-spin" /> : null}
                  Сохранить изменения
                </Button>
                <Button
                  variant="outline"
                  classИмя="w-full sm:w-auto"
                  disabled={!isDirty || updateРабочая область.isОжидание}
                  onClick={() => {
                    setForm(initialState);
                    setОшибкаMessage(null);
                    setЗапуститьtimeActionОшибкаMessage(null);
                    setЗапуститьtimeActionMessage(null);
                  }}
                >
                  Сбросить
                </Button>
                {errorMessage ? <p classИмя="text-sm text-destructive">{errorMessage}</p> : null}
                {!errorMessage && !isDirty ? <p classИмя="text-sm text-muted-foreground">Нет unsaved changes.</p> : null}
              </div>
              </CardContent>
            </Card>

            <Card classИмя="rounded-none">
              <CardHeader>
                <CardНазвание>Рабочая область context</CardНазвание>
                <CardОписание>Linked objects and relationships</CardОписание>
              </CardHeader>
              <CardContent>
              <DetailRow label="Project">
                {project ? <Link to={`/projects/${projectRef}`} classИмя="hover:underline">{project.name}</Link> : <MonoЗначение value={workspace.projectId} />}
              </DetailRow>
              <DetailRow label="Project workspace">
                {project && linkedProjectРабочая область ? (
                  <Рабочая областьLink project={project} workspace={linkedProjectРабочая область} />
                ) : workspace.projectРабочая областьId ? (
                  <MonoЗначение value={workspace.projectРабочая областьId} />
                ) : (
                  "Нет"
                )}
              </DetailRow>
              <DetailRow label="Source issue">
                {sourceЗадача ? (
                  <Link to={issueUrl(sourceЗадача)} classИмя="hover:underline">
                    {sourceЗадача.identifier ?? sourceЗадача.id} · {sourceЗадача.title}
                  </Link>
                ) : workspace.sourceЗадачаId ? (
                  <MonoЗначение value={workspace.sourceЗадачаId} />
                ) : (
                  "Нет"
                )}
              </DetailRow>
              <DetailRow label="Derived from">
                {derivedРабочая область ? (
                  <Link to={executionРабочая областьTabПуть(derivedРабочая область.id, "configuration")} classИмя="hover:underline">
                    {derivedРабочая область.name}
                  </Link>
                ) : workspace.derivedFromExecutionРабочая областьId ? (
                  <MonoЗначение value={workspace.derivedFromExecutionРабочая областьId} />
                ) : (
                  "Нет"
                )}
              </DetailRow>
              <DetailRow label="ID области">
                <MonoЗначение value={workspace.id} />
              </DetailRow>
              </CardContent>
            </Card>

            <Card classИмя="rounded-none">
              <CardHeader>
                <CardНазвание>Concrete location</CardНазвание>
                <CardОписание>Путьs and refs</CardОписание>
              </CardHeader>
              <CardContent>
              <DetailRow label="Работаing dir">
                {workspace.cwd ? <MonoЗначение value={workspace.cwd} copy /> : "Нет"}
              </DetailRow>
              <DetailRow label="Провайдер ref">
                {workspace.providerRef ? <MonoЗначение value={workspace.providerRef} copy /> : "Нет"}
              </DetailRow>
              <DetailRow label="URL репозитория">
                {workspace.repoUrl && isSafeExternalUrl(workspace.repoUrl) ? (
                  <div classИмя="inline-flex max-w-full items-start gap-2">
                    <a href={workspace.repoUrl} target="_blank" rel="noreferrer" classИмя="inline-flex min-w-0 items-center gap-1 break-all hover:underline">
                      {workspace.repoUrl}
                      <ExternalLink classИмя="h-3.5 w-3.5 shrink-0" />
                    </a>
                    <КопироватьText text={workspace.repoUrl} classИмя="shrink-0 text-muted-foreground hover:text-foreground" copiedLabel="Copied">
                      <Копировать classИмя="h-3.5 w-3.5" />
                    </КопироватьText>
                  </div>
                ) : workspace.repoUrl ? (
                  <MonoЗначение value={workspace.repoUrl} copy />
                ) : (
                  "Нет"
                )}
              </DetailRow>
              <DetailRow label="Base ref">
                {workspace.baseRef ? <MonoЗначение value={workspace.baseRef} copy /> : "Нет"}
              </DetailRow>
              <DetailRow label="Ветка">
                {workspace.branchИмя ? <MonoЗначение value={workspace.branchИмя} copy /> : "Нет"}
              </DetailRow>
              <DetailRow label="Opened">{formatDateTime(workspace.openedAt)}</DetailRow>
              <DetailRow label="Last used">{formatDateTime(workspace.lastUsedAt)}</DetailRow>
              <DetailRow label="Cleanup">
                {workspace.cleanupEligibleAt
                  ? `${formatDateTime(workspace.cleanupEligibleAt)}${workspace.cleanupReason ? ` · ${workspace.cleanupReason}` : ""}`
                  : "Нетt scheduled"}
              </DetailRow>
              </CardContent>
            </Card>
          </div>
        ) : activeTab === "runtime_logs" ? (
          <Card classИмя="rounded-none">
            <CardHeader>
              <CardНазвание>Запуститьtime and cleanup logs</CardНазвание>
              <CardОписание>Recent operations</CardОписание>
            </CardHeader>
            <CardContent>
            {workspaceOperationsQuery.isЗагрузка ? (
              <p classИмя="text-sm text-muted-foreground">Загрузка workspace operations…</p>
            ) : workspaceOperationsQuery.error ? (
              <p classИмя="text-sm text-destructive">
                {workspaceOperationsQuery.error instanceof Ошибка
                  ? workspaceOperationsQuery.error.message
                  : "Ошибка to load workspace operations."}
              </p>
            ) : workspaceOperationsQuery.data && workspaceOperationsQuery.data.length > 0 ? (
              <div classИмя="space-y-3">
                {workspaceOperationsQuery.data.map((operation) => (
                  <div key={operation.id} classИмя="rounded-none border border-border/80 bg-background px-4 py-3">
                    <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div classИмя="space-y-1">
                        <div classИмя="text-sm font-medium">{operation.command ?? operation.phase}</div>
                        <div classИмя="text-xs text-muted-foreground">
                          {formatDateTime(operation.startedAt)}
                          {operation.finishedAt ? ` → ${formatDateTime(operation.finishedAt)}` : ""}
                        </div>
                        {operation.stderrExcerpt ? (
                          <div classИмя="whitespace-pre-wrap break-words text-xs text-destructive">{operation.stderrExcerpt}</div>
                        ) : operation.stdoutExcerpt ? (
                          <div classИмя="whitespace-pre-wrap break-words text-xs text-muted-foreground">{operation.stdoutExcerpt}</div>
                        ) : null}
                      </div>
                      <СтатусPill classИмя="self-start">{operation.status}</СтатусPill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p classИмя="text-sm text-muted-foreground">Нет workspace operations have been recorded yet.</p>
            )}
            </CardContent>
          </Card>
        ) : activeTab === "issues" ? (
          <ExecutionРабочая областьЗадачиList
            companyId={workspace.companyId}
            workspace={workspace}
            issues={linkedЗадачи}
            isЗагрузка={linkedЗадачиQuery.isЗагрузка}
            error={linkedЗадачиQuery.error as Ошибка | null}
            project={project}
          />
        ) : (
          <ExecutionРабочая областьПроцедурыList
            workspace={workspace}
            project={project}
          />
        )}
      </div>
      <ExecutionРабочая областьЗакрытьDialog
        workspaceId={workspace.id}
        workspaceИмя={workspace.name}
        currentСтатус={workspace.status}
        open={closeDialogOpen}
        onOpenChange={setЗакрытьDialogOpen}
        onЗакрытьd={(nextРабочая область) => {
          queryClient.setQueryData(queryКлючs.executionРабочие области.detail(nextРабочая область.id), nextРабочая область);
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.closeReadiness(nextРабочая область.id) });
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.workspaceOperations(nextРабочая область.id) });
          if (project) {
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.id) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.list(project.companyId, { projectId: project.id }) });
          }
          if (sourceЗадача) {
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(sourceЗадача.id) });
          }
        }}
      />
    </>
  );
}
