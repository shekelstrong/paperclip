import { useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { СтатусBadge } from "./СтатусBadge";
import { cn, formatDate } from "../lib/utils";
import { environmentsApi } from "../api/environments";
import { goalsApi } from "../api/goals";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { projectsApi } from "../api/projects";
import { secretsApi } from "../api/secrets";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { statusBadge, statusBadgeПо умолчанию } from "../lib/status-colors";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Архивировать, АрхивироватьRestore, Check, ExternalLink, Github, Loader2, Plus, Trash2, X } from "lucide-react";
import { ChooseПутьButton } from "./ПутьInstructionsModal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ЧерновикInput } from "./agent-config-primitives";
import { InlineИзменитьor } from "./InlineИзменитьor";
import { EnvVarИзменитьor } from "./EnvVarИзменитьor";

const PROJECT_STATUSES = [
  { value: "backlog", label: "Назадlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
];

interface ProjectPropertiesProps {
  project: Project;
  onОбновить?: (data: Record<string, unknown>) => void;
  onFieldОбновить?: (field: ProjectConfigFieldКлюч, data: Record<string, unknown>) => void;
  getFieldСохранитьState?: (field: ProjectConfigFieldКлюч) => ProjectFieldСохранитьState;
  onАрхивировать?: (archived: boolean) => void;
  archiveОжидание?: boolean;
}

export type ProjectFieldСохранитьState = "idle" | "saving" | "saved" | "error";
export type ProjectConfigFieldКлюч =
  | "name"
  | "description"
  | "status"
  | "goals"
  | "env"
  | "execution_workspace_enabled"
  | "execution_workspace_default_mode"
  | "execution_workspace_environment"
  | "execution_workspace_base_ref"
  | "execution_workspace_branch_template"
  | "execution_workspace_worktree_parent_dir"
  | "execution_workspace_provision_command"
  | "execution_workspace_teardown_command";

function СохранитьIndicator({ state }: { state: ProjectFieldСохранитьState }) {
  if (state === "saving") {
    return (
      <span classИмя="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 classИмя="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span classИмя="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
        <Check classИмя="h-3 w-3" />
        Сохранитьd
      </span>
    );
  }
  if (state === "error") {
    return (
      <span classИмя="inline-flex items-center gap-1 text-[11px] text-destructive">
        <AlertCircle classИмя="h-3 w-3" />
        Ошибка
      </span>
    );
  }
  return null;
}

function FieldLabel({
  label,
  state,
}: {
  label: string;
  state: ProjectFieldСохранитьState;
}) {
  return (
    <div classИмя="flex items-center gap-1.5">
      <span classИмя="text-xs text-muted-foreground">{label}</span>
      <СохранитьIndicator state={state} />
    </div>
  );
}

function PropertyRow({
  label,
  children,
  alignНачать = false,
  valueClassИмя = "",
}: {
  label: React.ReactНетde;
  children: React.ReactНетde;
  alignНачать?: boolean;
  valueClassИмя?: string;
}) {
  return (
    <div classИмя={cn("flex gap-3 py-1.5 items-start")}>
      <div classИмя="shrink-0 w-20 mt-0.5">{label}</div>
      <div classИмя={cn("min-w-0 flex-1", alignНачать ? "pt-0.5" : "flex items-center gap-1.5 flex-wrap", valueClassИмя)}>
        {children}
      </div>
    </div>
  );
}

function ProjectСтатусPicker({ status, onChange }: { status: string; onChange: (status: string) => void }) {
  const [open, setOpen] = useState(false);
  const colorClass = statusBadge[status] ?? statusBadgeПо умолчанию;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          classИмя={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
            colorClass,
          )}
        >
          {status.replace("_", " ")}
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="w-40 p-1" align="start">
        {PROJECT_STATUSES.map((s) => (
          <Button
            key={s.value}
            variant="ghost"
            size="sm"
            classИмя={cn("w-full justify-start gap-2 text-xs", s.value === status && "bg-accent")}
            onClick={() => {
              onChange(s.value);
              setOpen(false);
            }}
          >
            {s.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function АрхивироватьDangerZone({
  project,
  onАрхивировать,
  archiveОжидание,
}: {
  project: Project;
  onАрхивировать: (archived: boolean) => void;
  archiveОжидание?: boolean;
}) {
  const [confirming, setПодтвердитьing] = useState(false);
  const isАрхивировать = !project.archivedAt;
  const action = isАрхивировать ? "Архивировать" : "Разархивировать";

  return (
    <div classИмя="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
      <p classИмя="text-sm text-muted-foreground">
        {isАрхивировать
          ? "Архивировать this project to hide it from the sidebar and project selectors."
          : "Разархивировать this project to restore it in the sidebar and project selectors."}
      </p>
      {archiveОжидание ? (
        <Button size="sm" variant="destructive" disabled>
          <Loader2 classИмя="h-3 w-3 animate-spin mr-1" />
          {isАрхивировать ? "Archiving..." : "Unarchiving..."}
        </Button>
      ) : confirming ? (
        <div classИмя="flex items-center gap-2">
          <span classИмя="text-sm text-destructive font-medium">
            {action} &ldquo;{project.name}&rdquo;?
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setПодтвердитьing(false);
              onАрхивировать(isАрхивировать);
            }}
          >
            Подтвердить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setПодтвердитьing(false)}
          >
            Отмена
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setПодтвердитьing(true)}
        >
          {isАрхивировать ? (
            <><Архивировать classИмя="h-3 w-3 mr-1" />{action} project</>
          ) : (
            <><АрхивироватьRestore classИмя="h-3 w-3 mr-1" />{action} project</>
          )}
        </Button>
      )}
    </div>
  );
}

export function ProjectProperties({ project, onОбновить, onFieldОбновить, getFieldСохранитьState, onАрхивировать, archiveОжидание }: ProjectPropertiesProps) {
  const { selectedКомпанияId } = useКомпания();
  const queryClient = useQueryClient();
  const [goalOpen, setЦельOpen] = useState(false);
  const [executionРабочая областьДополнительноOpen, setExecutionРабочая областьДополнительноOpen] = useState(false);
  const [workspaceMode, setРабочая областьMode] = useState<"local" | "repo" | null>(null);
  const [workspaceCwd, setРабочая областьCwd] = useState("");
  const [workspaceРепозиторийUrl, setРабочая областьРепозиторийUrl] = useState("");
  const [workspaceОшибка, setРабочая областьОшибка] = useState<string | null>(null);

  const commitField = (field: ProjectConfigFieldКлюч, data: Record<string, unknown>) => {
    if (onFieldОбновить) {
      onFieldОбновить(field, data);
      return;
    }
    onОбновить?.(data);
  };
  const fieldState = (field: ProjectConfigFieldКлюч): ProjectFieldСохранитьState => getFieldСохранитьState?.(field) ?? "idle";

  const { data: allЦели } = useQuery({
    queryКлюч: queryКлючs.goals.list(selectedКомпанияId!),
    queryFn: () => goalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });
  const environmentsВключитьd = experimentalНастройки?.enableОкружения === true;
  const { data: availableСекреты = [] } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.secrets.list(selectedКомпанияId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });
  const createСекрет = useMutation({
    mutationFn: (input: { name: string; value: string }) => {
      if (!selectedКомпанияId) throw new Ошибка("Select a company to create secrets");
      return secretsApi.create(selectedКомпанияId, input);
    },
    onУспешно: () => {
      if (!selectedКомпанияId) return;
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.list(selectedКомпанияId) });
    },
  });
  const { data: environments } = useQuery({
    queryКлюч: queryКлючs.environments.list(selectedКомпанияId!),
    queryFn: () => environmentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && environmentsВключитьd,
  });

  const linkedЦельIds = project.goalIds.length > 0
    ? project.goalIds
    : project.goalId
      ? [project.goalId]
      : [];

  const linkedЦели = project.goals.length > 0
    ? project.goals
    : linkedЦельIds.map((id) => ({
        id,
        title: allЦели?.find((g) => g.id === id)?.title ?? id.slice(0, 8),
      }));

  const availableЦели = (allЦели ?? []).filter((g) => !linkedЦельIds.includes(g.id));
  const workspaces = project.workspaces ?? [];
  const codebase = project.codebase;
  const primaryCodebaseРабочая область = project.primaryРабочая область ?? null;
  const hasДобавитьitionalLegacyРабочие области = workspaces.some((workspace) => workspace.id !== primaryCodebaseРабочая область?.id);
  const executionРабочая областьPolicy = project.executionРабочая областьPolicy ?? null;
  const executionРабочие областиВключитьd = executionРабочая областьPolicy?.enabled === true;
  const isolatedРабочие областиВключитьd = experimentalНастройки?.enableIsolatedРабочие области === true;
  const executionРабочая областьПо умолчаниюMode =
    executionРабочая областьPolicy?.defaultMode === "isolated_workspace" ? "isolated_workspace" : "shared_workspace";
  const executionРабочая областьОкружениеId = executionРабочая областьPolicy?.environmentId ?? "";
  const executionРабочая областьStrategy = executionРабочая областьPolicy?.workspaceStrategy ?? {
    type: "git_worktree",
    baseRef: "",
    branchTemplate: "",
    worktreeРодительDir: "",
  };
  const runSelectableОкружения = (environments ?? []).filter((environment) => {
    if (environment.driver === "local" || environment.driver === "ssh") return true;
    if (environment.driver !== "sandbox") return false;
    const provider = typeof environment.config?.provider === "string" ? environment.config.provider : null;
    return provider !== null && provider !== "fake";
  });

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.id) });
    if (project.urlКлюч !== project.id) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.urlКлюч) });
    }
    if (selectedКомпанияId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(selectedКомпанияId) });
    }
  };

  const createРабочая область = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.createРабочая область(project.id, data),
    onУспешно: () => {
      setРабочая областьCwd("");
      setРабочая областьРепозиторийUrl("");
      setРабочая областьMode(null);
      setРабочая областьОшибка(null);
      invalidateProject();
    },
  });

  const removeРабочая область = useMutation({
    mutationFn: (workspaceId: string) => projectsApi.removeРабочая область(project.id, workspaceId),
    onУспешно: () => {
      setРабочая областьCwd("");
      setРабочая областьРепозиторийUrl("");
      setРабочая областьMode(null);
      setРабочая областьОшибка(null);
      invalidateProject();
    },
  });
  const updateРабочая область = useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: Record<string, unknown> }) =>
      projectsApi.updateРабочая область(project.id, workspaceId, data),
    onУспешно: () => {
      setРабочая областьCwd("");
      setРабочая областьРепозиторийUrl("");
      setРабочая областьMode(null);
      setРабочая областьОшибка(null);
      invalidateProject();
    },
  });

  const removeЦель = (goalId: string) => {
    if (!onОбновить && !onFieldОбновить) return;
    commitField("goals", { goalIds: linkedЦельIds.filter((id) => id !== goalId) });
  };

  const addЦель = (goalId: string) => {
    if ((!onОбновить && !onFieldОбновить) || linkedЦельIds.includes(goalId)) return;
    commitField("goals", { goalIds: [...linkedЦельIds, goalId] });
    setЦельOpen(false);
  };

  const updateExecutionРабочая областьPolicy = (patch: Record<string, unknown>) => {
    if (!onОбновить && !onFieldОбновить) return;
    return {
      executionРабочая областьPolicy: {
        enabled: executionРабочие областиВключитьd,
        defaultMode: executionРабочая областьПо умолчаниюMode,
        allowЗадачаOverride: executionРабочая областьPolicy?.allowЗадачаOverride ?? true,
        ...executionРабочая областьPolicy,
        ...patch,
      },
    };
  };

  const isAbsoluteПуть = (value: string) => value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);

  const looksLikeРепозиторийUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };

  const isSafeExternalUrl = (value: string | null | undefined) => {
    if (!value) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const formatРепозиторийUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return parsed.host;
      const owner = segments[0];
      const repo = segments[1]?.replace(/\.git$/i, "");
      if (!owner || !repo) return parsed.host;
      return `${parsed.host}/${owner}/${repo}`;
    } catch {
      return value;
    }
  };

  const deriveSourceТип = (cwd: string | null, repoUrl: string | null) => {
    if (repoUrl) return "git_repo";
    if (cwd) return "local_path";
    return undefined;
  };

  const persistCodebase = (patch: { cwd?: string | null; repoUrl?: string | null }) => {
    const nextCwd = patch.cwd !== undefined ? patch.cwd : codebase.localПапка;
    const nextРепозиторийUrl = patch.repoUrl !== undefined ? patch.repoUrl : codebase.repoUrl;
    if (!nextCwd && !nextРепозиторийUrl) {
      if (primaryCodebaseРабочая область) {
        removeРабочая область.mutate(primaryCodebaseРабочая область.id);
      }
      return;
    }

    const data: Record<string, unknown> = {
      ...(patch.cwd !== undefined ? { cwd: patch.cwd } : {}),
      ...(patch.repoUrl !== undefined ? { repoUrl: patch.repoUrl } : {}),
      ...(deriveSourceТип(nextCwd, nextРепозиторийUrl) ? { sourceТип: deriveSourceТип(nextCwd, nextРепозиторийUrl) } : {}),
      isPrimary: true,
    };

    if (primaryCodebaseРабочая область) {
      updateРабочая область.mutate({ workspaceId: primaryCodebaseРабочая область.id, data });
      return;
    }

    createРабочая область.mutate(data);
  };

  const submitLocalРабочая область = () => {
    const cwd = workspaceCwd.trim();
    if (!cwd) {
      setРабочая областьОшибка(null);
      persistCodebase({ cwd: null });
      return;
    }
    if (!isAbsoluteПуть(cwd)) {
      setРабочая областьОшибка("Локальная папка must be a full absolute path.");
      return;
    }
    setРабочая областьОшибка(null);
    persistCodebase({ cwd });
  };

  const submitРепозиторийРабочая область = () => {
    const repoUrl = workspaceРепозиторийUrl.trim();
    if (!repoUrl) {
      setРабочая областьОшибка(null);
      persistCodebase({ repoUrl: null });
      return;
    }
    if (!looksLikeРепозиторийUrl(repoUrl)) {
      setРабочая областьОшибка("Репозиторий must use a valid GitHub or GitHub Enterprise repo URL.");
      return;
    }
    setРабочая областьОшибка(null);
    persistCodebase({ repoUrl });
  };

  const clearLocalРабочая область = () => {
    const confirmed = window.confirm(
      codebase.repoUrl
        ? "Очистить папку from this workspace?"
        : "Удалить this workspace local folder?",
    );
    if (!confirmed) return;
    persistCodebase({ cwd: null });
  };

  const clearРепозиторийРабочая область = () => {
    const hasLocalПапка = Boolean(codebase.localПапка);
    const confirmed = window.confirm(
      hasLocalПапка
        ? "Очистить репозиторий from this workspace?"
        : "Удалить this workspace repo?",
    );
    if (!confirmed) return;
    if (primaryCodebaseРабочая область && hasLocalПапка) {
      updateРабочая область.mutate({
        workspaceId: primaryCodebaseРабочая область.id,
        data: { repoUrl: null, repoRef: null, defaultRef: null, sourceТип: deriveSourceТип(codebase.localПапка, null) },
      });
      return;
    }
    persistCodebase({ repoUrl: null });
  };

  return (
    <div>
      <div classИмя="space-y-1 pb-4">
        <PropertyRow label={<FieldLabel label="Имя" state={fieldState("name")} />}>
          {onОбновить || onFieldОбновить ? (
            <ЧерновикInput
              value={project.name}
              onCommit={(name) => commitField("name", { name })}
              immediate
              classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none"
              placeholder="Project name"
            />
          ) : (
            <span classИмя="text-sm">{project.name}</span>
          )}
        </PropertyRow>
        <PropertyRow
          label={<FieldLabel label="Описание" state={fieldState("description")} />}
          alignНачать
          valueClassИмя="space-y-0.5"
        >
          {onОбновить || onFieldОбновить ? (
            <InlineИзменитьor
              value={project.description ?? ""}
              onСохранить={(description) => commitField("description", { description })}
              nullable
              as="p"
              classИмя="text-sm text-muted-foreground"
              placeholder="Добавить a description..."
              multiline
            />
          ) : (
            <p classИмя="text-sm text-muted-foreground">
              {project.description?.trim() || "Нет описания"}
            </p>
          )}
        </PropertyRow>
        <PropertyRow label={<FieldLabel label="Статус" state={fieldState("status")} />}>
          {onОбновить || onFieldОбновить ? (
            <ProjectСтатусPicker
              status={project.status}
              onChange={(status) => commitField("status", { status })}
            />
          ) : (
            <СтатусBadge status={project.status} />
          )}
        </PropertyRow>
        {project.leadАгентId && (
          <PropertyRow label="Lead">
            <span classИмя="text-sm font-mono">{project.leadАгентId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        <PropertyRow
          label={<FieldLabel label="Цели" state={fieldState("goals")} />}
          alignНачать
          valueClassИмя="space-y-2"
        >
          {linkedЦели.length > 0 && (
            <div classИмя="flex flex-wrap gap-1.5">
              {linkedЦели.map((goal) => (
                <span
                  key={goal.id}
                  classИмя="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                >
                  <Link to={`/goals/${goal.id}`} classИмя="hover:underline break-words min-w-0">
                    {goal.title}
                  </Link>
                  {(onОбновить || onFieldОбновить) && (
                    <button
                      classИмя="text-muted-foreground hover:text-foreground"
                      type="button"
                      onClick={() => removeЦель(goal.id)}
                      aria-label={`Удалить goal ${goal.title}`}
                    >
                      <X classИмя="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {(onОбновить || onFieldОбновить) && (
            <Popover open={goalOpen} onOpenChange={setЦельOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  classИмя={cn("h-6 w-fit px-2", linkedЦели.length > 0 && "ml-1")}
                  disabled={availableЦели.length === 0}
                >
                  <Plus classИмя="h-3 w-3 mr-1" />
                  Цель
                </Button>
              </PopoverTrigger>
              <PopoverContent classИмя="w-56 p-1" align="start">
                {availableЦели.length === 0 ? (
                  <div classИмя="px-2 py-1.5 text-xs text-muted-foreground">
                    Все goals linked.
                  </div>
                ) : (
                  availableЦели.map((goal) => (
                    <button
                      key={goal.id}
                      classИмя="flex items-center w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => addЦель(goal.id)}
                    >
                      {goal.title}
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>
          )}
        </PropertyRow>
        <PropertyRow
          label={<FieldLabel label="Env" state={fieldState("env")} />}
          alignНачать
          valueClassИмя="space-y-2"
        >
          <div classИмя="space-y-2">
            <EnvVarИзменитьor
              value={project.env ?? {}}
              secrets={availableСекреты}
              onСоздатьСекрет={async (name, value) => {
                const created = await createСекрет.mutateAsync({ name, value });
                return created;
              }}
              onChange={(env) => commitField("env", { env: env ?? null })}
            />
            <p classИмя="text-[11px] text-muted-foreground">
              Applied to all runs for issues in this project. Project values override agent env on key conflicts.
            </p>
          </div>
        </PropertyRow>
        <PropertyRow label={<FieldLabel label="Создано" state="idle" />}>
          <span classИмя="text-sm">{formatDate(project.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label={<FieldLabel label="Обновлено" state="idle" />}>
          <span classИмя="text-sm">{formatDate(project.updatedAt)}</span>
        </PropertyRow>
        {project.targetDate && (
          <PropertyRow label={<FieldLabel label="Цель Date" state="idle" />}>
            <span classИмя="text-sm">{formatDate(project.targetDate)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator classИмя="my-4" />

      <div classИмя="space-y-1 py-4">
        <div classИмя="space-y-2">
          <div classИмя="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Codebase</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  classИмя="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                  aria-label="Codebase help"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Репозиторий identifies the source of truth. Локальная папка is the default place agents write code.
              </TooltipContent>
            </Tooltip>
          </div>
          <div classИмя="space-y-2 rounded-md border border-border/70 p-3">
            <div classИмя="space-y-1">
              <div classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">Репозиторий</div>
              {codebase.repoUrl ? (
                <div classИмя="flex items-center justify-between gap-2">
                  {isSafeExternalUrl(codebase.repoUrl) ? (
                    <a
                      href={codebase.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      classИмя="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <Github classИмя="h-3 w-3 shrink-0" />
                      <span classИмя="break-all min-w-0">{formatРепозиторийUrl(codebase.repoUrl)}</span>
                      <ExternalLink classИмя="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <div classИмя="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Github classИмя="h-3 w-3 shrink-0" />
                      <span classИмя="break-all min-w-0">{codebase.repoUrl}</span>
                    </div>
                  )}
                  <div classИмя="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      classИмя="h-6 px-2"
                      onClick={() => {
                        setРабочая областьMode("repo");
                        setРабочая областьРепозиторийUrl(codebase.repoUrl ?? "");
                        setРабочая областьОшибка(null);
                      }}
                    >
                      Change repo
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={clearРепозиторийРабочая область}
                      aria-label="Очистить репозиторий"
                    >
                      <Trash2 classИмя="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div classИмя="flex items-center justify-between gap-2">
                  <div classИмя="text-xs text-muted-foreground">Не задано.</div>
                  <Button
                    variant="outline"
                    size="xs"
                    classИмя="h-6 px-2"
                    onClick={() => {
                      setРабочая областьMode("repo");
                      setРабочая областьРепозиторийUrl(codebase.repoUrl ?? "");
                      setРабочая областьОшибка(null);
                    }}
                  >
                    Set repo
                  </Button>
                </div>
              )}
            </div>

            <div classИмя="space-y-1">
              <div classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">Локальная папка</div>
              <div classИмя="flex items-center justify-between gap-2">
                <div classИмя="min-w-0 space-y-1">
                  <div classИмя="min-w-0 break-all font-mono text-xs text-muted-foreground">
                    {codebase.effectiveLocalПапка}
                  </div>
                  {codebase.origin === "managed_checkout" && (
                    <div classИмя="text-[11px] text-muted-foreground">Paperclip-managed folder.</div>
                  )}
                </div>
                <div classИмя="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    classИмя="h-6 px-2"
                    onClick={() => {
                      setРабочая областьMode("local");
                      setРабочая областьCwd(codebase.localПапка ?? "");
                      setРабочая областьОшибка(null);
                    }}
                  >
                    {codebase.localПапка ? "Сменить папку" : "Задать папку"}
                  </Button>
                  {codebase.localПапка ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={clearLocalРабочая область}
                      aria-label="Очистить папку"
                    >
                      <Trash2 classИмя="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {hasДобавитьitionalLegacyРабочие области && (
              <div classИмя="text-[11px] text-muted-foreground">
                Добавитьitional legacy workspace records exist on this project. Paperclip is using the primary workspace as the codebase view.
              </div>
            )}

            {primaryCodebaseРабочая область?.runtimeServices && primaryCodebaseРабочая область.runtimeServices.length > 0 ? (
              <div classИмя="space-y-1">
                {primaryCodebaseРабочая область.runtimeServices.map((service) => (
                  <div
                    key={service.id}
                    classИмя="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1"
                  >
                    <div classИмя="min-w-0 space-y-0.5">
                      <div classИмя="flex items-center gap-2">
                        <span classИмя="text-[11px] font-medium">{service.serviceИмя}</span>
                        <span
                          classИмя={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            service.status === "running"
                              ? "bg-green-500/15 text-green-700 dark:text-green-300"
                              : service.status === "failed"
                                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {service.status}
                        </span>
                      </div>
                      <div classИмя="text-[11px] text-muted-foreground">
                        {service.url ? (
                          <a
                            href={service.url}
                            target="_blank"
                            rel="noreferrer"
                            classИмя="hover:text-foreground hover:underline"
                          >
                            {service.url}
                          </a>
                        ) : (
                          service.command ?? "Нет URL"
                        )}
                      </div>
                    </div>
                    <div classИмя="text-[10px] text-muted-foreground whitespace-nowrap">
                      {service.lifecycle}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {workspaceMode === "local" && (
            <div classИмя="space-y-1.5 rounded-md border border-border p-2">
              <div classИмя="flex items-center gap-2">
                <input
                  classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                  value={workspaceCwd}
                  onChange={(e) => setРабочая областьCwd(e.target.value)}
                  placeholder="/absolute/path/to/workspace"
                />
                <ChooseПутьButton />
              </div>
              <div classИмя="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  classИмя="h-6 px-2"
                  disabled={(!workspaceCwd.trim() && !primaryCodebaseРабочая область) || createРабочая область.isОжидание || updateРабочая область.isОжидание}
                  onClick={submitLocalРабочая область}
                >
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  classИмя="h-6 px-2"
                  onClick={() => {
                    setРабочая областьMode(null);
                    setРабочая областьCwd("");
                    setРабочая областьОшибка(null);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
          {workspaceMode === "repo" && (
            <div classИмя="space-y-1.5 rounded-md border border-border p-2">
              <input
                classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
                value={workspaceРепозиторийUrl}
                onChange={(e) => setРабочая областьРепозиторийUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
              <div classИмя="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  classИмя="h-6 px-2"
                  disabled={(!workspaceРепозиторийUrl.trim() && !primaryCodebaseРабочая область) || createРабочая область.isОжидание || updateРабочая область.isОжидание}
                  onClick={submitРепозиторийРабочая область}
                >
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  classИмя="h-6 px-2"
                  onClick={() => {
                    setРабочая областьMode(null);
                    setРабочая областьРепозиторийUrl("");
                    setРабочая областьОшибка(null);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
          {workspaceОшибка && (
            <p classИмя="text-xs text-destructive">{workspaceОшибка}</p>
          )}
          {createРабочая область.isОшибка && (
            <p classИмя="text-xs text-destructive">Ошибка to save workspace.</p>
          )}
          {removeРабочая область.isОшибка && (
            <p classИмя="text-xs text-destructive">Ошибка to delete workspace.</p>
          )}
          {updateРабочая область.isОшибка && (
            <p classИмя="text-xs text-destructive">Ошибка to update workspace.</p>
          )}
        </div>

        {isolatedРабочие областиВключитьd ? (
          <>
            <Separator classИмя="my-4" />

            <div classИмя="py-1.5 space-y-2">
              <div classИмя="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Execution Рабочие области</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      classИмя="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                      aria-label="Execution workspaces help"
                    >
                      ?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Project-owned defaults for isolated issue checkouts and execution workspace behavior.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div classИмя="space-y-3">
                <div classИмя="flex items-center justify-between gap-3">
                  <div classИмя="space-y-0.5">
                    <div classИмя="flex items-center gap-2 text-sm font-medium">
                      <span>Включить isolated issue checkouts</span>
                      <СохранитьIndicator state={fieldState("execution_workspace_enabled")} />
                    </div>
                    <div classИмя="text-xs text-muted-foreground">
                      Let issues choose between the project's primary checkout and an isolated execution workspace.
                    </div>
                  </div>
                  {onОбновить || onFieldОбновить ? (
                    <ToggleSwitch
                      checked={executionРабочие областиВключитьd}
                      onCheckedChange={() =>
                        commitField(
                          "execution_workspace_enabled",
                          updateExecutionРабочая областьPolicy({ enabled: !executionРабочие областиВключитьd })!,
                        )}
                    />
                  ) : (
                    <span classИмя="text-xs text-muted-foreground">
                      {executionРабочие областиВключитьd ? "Включитьd" : "Отключитьd"}
                    </span>
                  )}
                </div>

                {executionРабочие областиВключитьd ? (
                  <div classИмя="space-y-3">
                    <div classИмя="flex items-center justify-between gap-3">
                      <div classИмя="space-y-0.5">
                        <div classИмя="flex items-center gap-2 text-sm">
                          <span>Новая задачаs default to isolated checkout</span>
                          <СохранитьIndicator state={fieldState("execution_workspace_default_mode")} />
                        </div>
                        <div classИмя="text-[11px] text-muted-foreground">
                          If disabled, new issues stay on the project's primary checkout unless someone opts in.
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={executionРабочая областьПо умолчаниюMode === "isolated_workspace"}
                        onCheckedChange={() =>
                          commitField(
                            "execution_workspace_default_mode",
                            updateExecutionРабочая областьPolicy({
                              defaultMode:
                                executionРабочая областьПо умолчаниюMode === "isolated_workspace"
                                  ? "shared_workspace"
                                  : "isolated_workspace",
                            })!,
                          )}
                      />
                    </div>

                    <div classИмя="border-t border-border/60 pt-2">
                      <button
                        type="button"
                        classИмя="flex w-full items-center gap-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setExecutionРабочая областьДополнительноOpen((open) => !open)}
                      >
                        {executionРабочая областьДополнительноOpen
                          ? "Hide advanced checkout settings"
                          : "Show advanced checkout settings"}
                      </button>
                    </div>

                    {executionРабочая областьДополнительноOpen ? (
                      <div classИмя="space-y-3">
                        <div classИмя="text-xs text-muted-foreground">
                          Хост-managed implementation: <span classИмя="text-foreground">Git worktree</span>
                        </div>
                        {environmentsВключитьd ? (
                          <div>
                            <div classИмя="mb-1 flex items-center gap-1.5">
                              <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Окружение</span>
                                <СохранитьIndicator state={fieldState("execution_workspace_environment")} />
                              </label>
                            </div>
                            <select
                              classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
                              value={executionРабочая областьОкружениеId}
                              onChange={(e) =>
                                commitField(
                                  "execution_workspace_environment",
                                  updateExecutionРабочая областьPolicy({
                                    environmentId: e.target.value || null,
                                  })!,
                                )}
                            >
                              <option value="">Нет environment</option>
                              {runSelectableОкружения.map((environment) => (
                                <option key={environment.id} value={environment.id}>
                                  {environment.name} · {environment.driver}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <div classИмя="mb-1 flex items-center gap-1.5">
                            <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Base ref</span>
                              <СохранитьIndicator state={fieldState("execution_workspace_base_ref")} />
                            </label>
                          </div>
                          <ЧерновикInput
                            value={executionРабочая областьStrategy.baseRef ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_base_ref", {
                                ...updateExecutionРабочая областьPolicy({
                                  workspaceStrategy: {
                                    ...executionРабочая областьStrategy,
                                    type: "git_worktree",
                                    baseRef: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="origin/main"
                          />
                        </div>
                        <div>
                          <div classИмя="mb-1 flex items-center gap-1.5">
                            <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Ветка template</span>
                              <СохранитьIndicator state={fieldState("execution_workspace_branch_template")} />
                            </label>
                          </div>
                          <ЧерновикInput
                            value={executionРабочая областьStrategy.branchTemplate ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_branch_template", {
                                ...updateExecutionРабочая областьPolicy({
                                  workspaceStrategy: {
                                    ...executionРабочая областьStrategy,
                                    type: "git_worktree",
                                    branchTemplate: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="{{issue.identifier}}-{{slug}}"
                          />
                        </div>
                        <div>
                          <div classИмя="mb-1 flex items-center gap-1.5">
                            <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Работаtree parent dir</span>
                              <СохранитьIndicator state={fieldState("execution_workspace_worktree_parent_dir")} />
                            </label>
                          </div>
                          <ЧерновикInput
                            value={executionРабочая областьStrategy.worktreeРодительDir ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_worktree_parent_dir", {
                                ...updateExecutionРабочая областьPolicy({
                                  workspaceStrategy: {
                                    ...executionРабочая областьStrategy,
                                    type: "git_worktree",
                                    worktreeРодительDir: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder=".paperclip/worktrees"
                          />
                        </div>
                        <div>
                          <div classИмя="mb-1 flex items-center gap-1.5">
                            <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Provision command</span>
                              <СохранитьIndicator state={fieldState("execution_workspace_provision_command")} />
                            </label>
                          </div>
                          <ЧерновикInput
                            value={executionРабочая областьStrategy.provisionКоманда ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_provision_command", {
                                ...updateExecutionРабочая областьPolicy({
                                  workspaceStrategy: {
                                    ...executionРабочая областьStrategy,
                                    type: "git_worktree",
                                    provisionКоманда: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="bash ./scripts/provision-worktree.sh"
                          />
                        </div>
                        <div>
                          <div classИмя="mb-1 flex items-center gap-1.5">
                            <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Teardown command</span>
                              <СохранитьIndicator state={fieldState("execution_workspace_teardown_command")} />
                            </label>
                          </div>
                          <ЧерновикInput
                            value={executionРабочая областьStrategy.teardownКоманда ?? ""}
                            onCommit={(value) =>
                              commitField("execution_workspace_teardown_command", {
                                ...updateExecutionРабочая областьPolicy({
                                  workspaceStrategy: {
                                    ...executionРабочая областьStrategy,
                                    type: "git_worktree",
                                    teardownКоманда: value || null,
                                  },
                                })!,
                              })}
                            immediate
                            classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                            placeholder="bash ./scripts/teardown-worktree.sh"
                          />
                        </div>
                        <p classИмя="text-[11px] text-muted-foreground">
                          Provision runs inside the derived worktree before agent execution. Teardown is stored here for
                          future cleanup flows.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

      </div>

      {onАрхивировать && (
        <>
          <Separator classИмя="my-4" />
          <div classИмя="space-y-4 py-4">
            <div classИмя="text-xs font-medium text-destructive uppercase tracking-wide">
              Danger Zone
            </div>
            <АрхивироватьDangerZone
              project={project}
              onАрхивировать={onАрхивировать}
              archiveОжидание={archiveОжидание}
            />
          </div>
        </>
      )}
    </div>
  );
}
