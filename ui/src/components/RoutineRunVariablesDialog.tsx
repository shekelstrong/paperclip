import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WORKSPACE_BRANCH_ROUTINE_VARIABLE,
  type Агент,
  type ExecutionРабочая область,
  type ExecutionРабочая областьMode,
  type ЗадачаExecutionРабочая областьНастройки,
  type Project,
  type ПроцедураVariable,
} from "@paperclipai/shared";
import { useQuery } from "@tanstack/react-query";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { queryКлючs } from "../lib/queryКлючs";
import { ЗадачаРабочая областьCard } from "./ЗадачаРабочая областьCard";
import { АгентIcon } from "./АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "./InlineEntitySelector";
import { getRecentИсполнительIds, sortАгентыByRecency, trackRecentИсполнитель } from "../lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function buildInitialЗначениеs(variables: ПроцедураVariable[]) {
  return Object.fromEntries(variables.map((variable) => [variable.name, variable.defaultЗначение ?? ""]));
}

function buildInitialЗапуститьSelection(input: {
  defaultИсполнительАгентId?: string | null;
  defaultProjectId?: string | null;
}) {
  return {
    assigneeАгентId: input.defaultИсполнительАгентId ?? "",
    projectId: input.defaultProjectId ?? "",
  };
}

function defaultProjectРабочая областьIdForProject(project: Project | null | undefined) {
  if (!project) return null;
  return project.executionРабочая областьPolicy?.defaultProjectРабочая областьId
    ?? project.workspaces?.find((workspace) => workspace.isPrimary)?.id
    ?? project.workspaces?.[0]?.id
    ?? null;
}

function defaultExecutionРабочая областьModeForProject(project: Project | null | undefined): ExecutionРабочая областьMode {
  const defaultMode = project?.executionРабочая областьPolicy?.enabled ? project.executionРабочая областьPolicy.defaultMode : null;
  if (
    defaultMode === "isolated_workspace" ||
    defaultMode === "operator_branch" ||
    defaultMode === "adapter_default"
  ) {
    return defaultMode === "adapter_default" ? "agent_default" : defaultMode;
  }
  return "shared_workspace";
}

function issueModeForExistingРабочая область(mode: string | null | undefined): ExecutionРабочая областьMode {
  if (mode === "isolated_workspace" || mode === "operator_branch" || mode === "shared_workspace") return mode;
  if (mode === "adapter_managed" || mode === "cloud_sandbox") return "agent_default";
  return "shared_workspace";
}

function issueРабочая областьPreferenceFromЧерновик(value: unknown, fallback: ExecutionРабочая областьMode): ExecutionРабочая областьMode {
  if (
    value === "inherit" ||
    value === "shared_workspace" ||
    value === "isolated_workspace" ||
    value === "operator_branch" ||
    value === "reuse_existing" ||
    value === "agent_default"
  ) {
    return value;
  }
  return fallback;
}

type ПроцедураЗапуститьРабочая областьConfig = {
  executionРабочая областьId: string | null;
  executionРабочая областьPreference: ExecutionРабочая областьMode;
  executionРабочая областьНастройки: ЗадачаExecutionРабочая областьНастройки;
  projectРабочая областьId: string | null;
};

function buildInitialРабочая областьConfig(
  project: Project | null | undefined,
  defaultExecutionРабочая область?: ExecutionРабочая область | null,
): ПроцедураЗапуститьРабочая областьConfig {
  if (defaultExecutionРабочая область && defaultExecutionРабочая область.projectId === project?.id) {
    return {
      executionРабочая областьId: defaultExecutionРабочая область.id,
      executionРабочая областьPreference: "reuse_existing",
      executionРабочая областьНастройки: {
        mode: issueModeForExistingРабочая область(defaultExecutionРабочая область.mode),
      },
      projectРабочая областьId: defaultExecutionРабочая область.projectРабочая областьId ?? defaultProjectРабочая областьIdForProject(project),
    };
  }

  const defaultMode = defaultExecutionРабочая областьModeForProject(project);
  return {
    executionРабочая областьId: null as string | null,
    executionРабочая областьPreference: defaultMode,
    executionРабочая областьНастройки: { mode: defaultMode },
    projectРабочая областьId: defaultProjectРабочая областьIdForProject(project),
  };
}

function workspaceConfigEquals(
  a: ПроцедураЗапуститьРабочая областьConfig,
  b: ПроцедураЗапуститьРабочая областьConfig,
) {
  return a.executionРабочая областьId === b.executionРабочая областьId
    && a.executionРабочая областьPreference === b.executionРабочая областьPreference
    && a.projectРабочая областьId === b.projectРабочая областьId
    && JSON.stringify(a.executionРабочая областьНастройки ?? null) === JSON.stringify(b.executionРабочая областьНастройки ?? null);
}

function applyРабочая областьЧерновик(
  current: ПроцедураЗапуститьРабочая областьConfig,
  data: Record<string, unknown>,
) {
  const next = {
    ...current,
    executionРабочая областьId: (data.executionРабочая областьId as string | null | undefined) ?? null,
    executionРабочая областьPreference: issueРабочая областьPreferenceFromЧерновик(
      data.executionРабочая областьPreference,
      current.executionРабочая областьPreference,
    ),
    executionРабочая областьНастройки:
      (data.executionРабочая областьНастройки as ЗадачаExecutionРабочая областьНастройки | null | undefined)
      ?? current.executionРабочая областьНастройки,
  };
  return workspaceConfigEquals(current, next) ? current : next;
}

function isMissingОбязательноЗначение(value: unknown) {
  return value == null || (typeof value === "string" && value.trim().length === 0);
}

function supportsПроцедураЗапуститьРабочая областьSelection(
  project: Project | null | undefined,
  isolatedРабочие областиВключитьd: boolean,
) {
  return isolatedРабочие областиВключитьd && Boolean(project?.executionРабочая областьPolicy?.enabled);
}

export function routineЗапуститьNeedsКонфигурация(input: {
  variables: ПроцедураVariable[];
  project: Project | null | undefined;
  isolatedРабочие областиВключитьd: boolean;
}) {
  return input.variables.length > 0
    || supportsПроцедураЗапуститьРабочая областьSelection(input.project, input.isolatedРабочие областиВключитьd);
}

export interface ПроцедураЗапуститьDialogОтправитьData {
  variables?: Record<string, string | number | boolean>;
  assigneeАгентId?: string | null;
  projectId?: string | null;
  executionРабочая областьId?: string | null;
  executionРабочая областьPreference?: string | null;
  executionРабочая областьНастройки?: ЗадачаExecutionРабочая областьНастройки | null;
}

export function ПроцедураЗапуститьVariablesDialog({
  open,
  onOpenChange,
  companyId,
  routineИмя,
  projects,
  agents,
  defaultProjectId,
  defaultИсполнительАгентId,
  defaultExecutionРабочая область,
  variables,
  isОжидание,
  onОтправить,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null | undefined;
  routineИмя?: string | null;
  projects: Project[];
  agents: Агент[];
  defaultProjectId?: string | null;
  defaultИсполнительАгентId?: string | null;
  defaultExecutionРабочая область?: ExecutionРабочая область | null;
  variables: ПроцедураVariable[];
  isОжидание: boolean;
  onОтправить: (data: ПроцедураЗапуститьDialogОтправитьData) => void;
}) {
  const [values, setЗначениеs] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState(() => buildInitialЗапуститьSelection({
    defaultИсполнительАгентId,
    defaultProjectId,
  }));
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selection.projectId) ?? null,
    [projects, selection.projectId],
  );
  const recentИсполнительIds = useMemo(() => getRecentИсполнительIds(), [open]);
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [open]);
  const assigneeOptions = useMemo<InlineEntityOption[]>(
    () =>
      sortАгентыByRecency(
        agents.filter((agent) => agent.status !== "terminated"),
        recentИсполнительIds,
      ).map((agent) => ({
        id: agent.id,
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    [agents, recentИсполнительIds],
  );
  const projectOptions = useMemo<InlineEntityOption[]>(
    () => projects.map((project) => ({
      id: project.id,
      label: project.name,
      searchText: project.description ?? "",
    })),
    [projects],
  );
  const currentИсполнитель = selection.assigneeАгентId
    ? agents.find((agent) => agent.id === selection.assigneeАгентId) ?? null
    : null;
  const [workspaceConfig, setРабочая областьConfig] = useState(() =>
    buildInitialРабочая областьConfig(selectedProject, defaultExecutionРабочая область));
  const [workspaceConfigValid, setРабочая областьConfigValid] = useState(true);
  const [workspaceВеткаИмя, setРабочая областьВеткаИмя] = useState<string | null>(null);

  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });

  const workspaceSelectionВключитьd = supportsПроцедураЗапуститьРабочая областьSelection(
    selectedProject,
    experimentalНастройки?.enableIsolatedРабочие области === true,
  );

  useEffect(() => {
    if (!open) return;
    setЗначениеs(buildInitialЗначениеs(variables));
    const nextSelection = buildInitialЗапуститьSelection({ defaultИсполнительАгентId, defaultProjectId });
    setSelection(nextSelection);
    setРабочая областьConfig(buildInitialРабочая областьConfig(
      projects.find((project) => project.id === nextSelection.projectId) ?? null,
      defaultExecutionРабочая область,
    ));
    setРабочая областьConfigValid(true);
    setРабочая областьВеткаИмя(defaultExecutionРабочая область?.branchИмя ?? null);
  }, [defaultИсполнительАгентId, defaultExecutionРабочая область, defaultProjectId, open, projects, variables]);

  const workspaceВеткаАвтоЗначение = workspaceSelectionВключитьd && workspaceВеткаИмя
    ? workspaceВеткаИмя
    : null;

  const isАвтоРабочая областьВеткаVariable = useCallback(
    (variable: ПроцедураVariable) =>
      variable.name === WORKSPACE_BRANCH_ROUTINE_VARIABLE && Boolean(workspaceВеткаАвтоЗначение),
    [workspaceВеткаАвтоЗначение],
  );

  const missingОбязательно = useMemo(
    () =>
      variables
        .filter((variable) => variable.required)
        .filter((variable) => !isАвтоРабочая областьВеткаVariable(variable))
        .filter((variable) => isMissingОбязательноЗначение(values[variable.name]))
        .map((variable) => variable.label || variable.name),
    [isАвтоРабочая областьВеткаVariable, values, variables],
  );

  const workspaceЗадача = useMemo(() => ({
    companyId: companyId ?? null,
    projectId: selectedProject?.id ?? null,
    projectРабочая областьId: workspaceConfig.projectРабочая областьId,
    executionРабочая областьId: workspaceConfig.executionРабочая областьId,
    executionРабочая областьPreference: workspaceConfig.executionРабочая областьPreference,
    executionРабочая областьНастройки: workspaceConfig.executionРабочая областьНастройки,
    currentExecutionРабочая область:
      workspaceConfig.executionРабочая областьId && workspaceConfig.executionРабочая областьId === defaultExecutionРабочая область?.id
        ? defaultExecutionРабочая область
        : null,
  }), [
    companyId,
    defaultExecutionРабочая область,
    selectedProject?.id,
    workspaceConfig.executionРабочая областьId,
    workspaceConfig.executionРабочая областьPreference,
    workspaceConfig.executionРабочая областьНастройки,
    workspaceConfig.projectРабочая областьId,
  ]);

  const canОтправить =
    selection.assigneeАгентId.trim().length > 0 &&
    missingОбязательно.length === 0 &&
    (!workspaceSelectionВключитьd || workspaceConfigValid);

  const handleРабочая областьОбновить = useCallback((data: Record<string, unknown>) => {
    setРабочая областьConfig((current) => applyРабочая областьЧерновик(current, data));
  }, []);

  const handleРабочая областьЧерновикChange = useCallback((
    data: Record<string, unknown>,
    meta: { canСохранить: boolean; workspaceВеткаИмя?: string | null },
  ) => {
    setРабочая областьConfig((current) => applyРабочая областьЧерновик(current, data));
    setРабочая областьConfigValid((current) => (current === meta.canСохранить ? current : meta.canСохранить));
    setРабочая областьВеткаИмя((current) => {
      const defaultРабочая областьВеткаИмя = defaultExecutionРабочая область?.branchИмя ?? null;
      const next = meta.workspaceВеткаИмя
        ?? (data.executionРабочая областьId === defaultExecutionРабочая область?.id ? defaultРабочая областьВеткаИмя : null)
        ?? null;
      return current === next ? current : next;
    });
  }, [defaultExecutionРабочая область]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isОжидание && onOpenChange(next)}>
      <DialogContent classИмя="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[min(calc(100dvh-2rem),42rem)]">
        <DialogHeader classИмя="shrink-0 border-b border-border/60 px-6 pb-4 pr-12 pt-6">
          {routineИмя && (
            <p classИмя="text-muted-foreground text-sm">{routineИмя}</p>
          )}
          <DialogНазвание>Запустить процедуру</DialogНазвание>
          <DialogОписание>
            Choose the agent and optional project for this one run. Процедура defaults are prefilled and won&apos;t be changed.
          </DialogОписание>
        </DialogHeader>

        <div classИмя="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
          <div classИмя="grid gap-4 md:grid-cols-2">
            <div classИмя="space-y-1.5">
              <Label classИмя="text-xs">Агент *</Label>
              <InlineEntitySelector
                value={selection.assigneeАгентId}
                options={assigneeOptions}
                recentOptionIds={recentИсполнительIds}
                placeholder="Агент"
                noneLabel="Select an agent"
                searchPlaceholder="Поиск agents..."
                emptyMessage="Агенты не найдены."
                disableПортal
                openOnFocus={false}
                onChange={(assigneeАгентId) => {
                  if (assigneeАгентId) trackRecentИсполнитель(assigneeАгентId);
                  setSelection((current) => ({ ...current, assigneeАгентId }));
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
                    <span classИмя="text-muted-foreground">Select an agent</span>
                  )
                }
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const assignee = agents.find((agent) => agent.id === option.id);
                  return (
                    <>
                      {assignee ? <АгентIcon icon={assignee.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
              />
            </div>
            <div classИмя="space-y-1.5">
              <Label classИмя="text-xs">Project</Label>
              <InlineEntitySelector
                value={selection.projectId}
                options={projectOptions}
                recentOptionIds={recentProjectIds}
                placeholder="Project"
                noneLabel="Нет project"
                searchPlaceholder="Поиск projects..."
                emptyMessage="Проекты не найдены."
                disableПортal
                openOnFocus={false}
                onChange={(projectId) => {
                  const project = projects.find((entry) => entry.id === projectId) ?? null;
                  if (projectId) trackRecentProject(projectId);
                  setSelection((current) => ({ ...current, projectId }));
                  setРабочая областьConfig(buildInitialРабочая областьConfig(project, defaultExecutionРабочая область));
                  setРабочая областьConfigValid(true);
                  setРабочая областьВеткаИмя(
                    defaultExecutionРабочая область && defaultExecutionРабочая область.projectId === project?.id
                      ? defaultExecutionРабочая область.branchИмя
                      : null,
                  );
                }}
                renderTriggerЗначение={(option) =>
                  option && selectedProject ? (
                    <>
                      <span
                        classИмя="h-3.5 w-3.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: selectedProject.color ?? "#64748b" }}
                      />
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  ) : (
                    <span classИмя="text-muted-foreground">Нет project</span>
                  )
                }
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const project = projects.find((entry) => entry.id === option.id);
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

          {variables.map((variable) => (
            <div key={variable.name} classИмя="space-y-1.5">
              <Label classИмя="text-xs">
                {variable.label || variable.name}
                {variable.required ? " *" : ""}
              </Label>
              {isАвтоРабочая областьВеткаVariable(variable) ? (
                <Input
                  readOnly
                  disabled
                  value={workspaceВеткаАвтоЗначение ?? ""}
                />
              ) : variable.type === "textarea" ? (
                <Textarea
                  rows={4}
                  value={typeof values[variable.name] === "string" ? values[variable.name] as string : ""}
                  onChange={(event) => setЗначениеs((current) => ({ ...current, [variable.name]: event.target.value }))}
                />
              ) : variable.type === "boolean" ? (
                <Select
                  value={values[variable.name] === true ? "true" : values[variable.name] === false ? "false" : "__unset__"}
                  onЗначениеChange={(next) => setЗначениеs((current) => ({
                    ...current,
                    [variable.name]: next === "__unset__" ? "" : next === "true",
                  }))}
                >
                  <SelectTrigger>
                    <SelectЗначение />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Нет value</SelectItem>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : variable.type === "select" ? (
                <Select
                  value={typeof values[variable.name] === "string" && values[variable.name] ? values[variable.name] as string : "__unset__"}
                  onЗначениеChange={(next) => setЗначениеs((current) => ({
                    ...current,
                    [variable.name]: next === "__unset__" ? "" : next,
                  }))}
                >
                  <SelectTrigger>
                    <SelectЗначение placeholder="Choose a value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Нет value</SelectItem>
                    {variable.options.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={variable.type === "number" ? "number" : "text"}
                  value={values[variable.name] == null ? "" : String(values[variable.name])}
                  onChange={(event) => setЗначениеs((current) => ({ ...current, [variable.name]: event.target.value }))}
                />
              )}
            </div>
          ))}

          {workspaceSelectionВключитьd && selectedProject && companyId ? (
            <ЗадачаРабочая областьCard
              key={`${open ? "open" : "closed"}:${selectedProject.id}`}
              issue={workspaceЗадача}
              project={selectedProject}
              initialИзменитьing
              liveПредпросмотр
              onОбновить={handleРабочая областьОбновить}
              onЧерновикChange={handleРабочая областьЧерновикChange}
            />
          ) : null}
        </div>

        <DialogFooter
          showЗакрытьButton={false}
          classИмя="shrink-0 border-t border-border/60 bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
        >
          {!selection.assigneeАгентId ? (
            <p classИмя="mr-auto text-xs text-amber-600">Требуется агент по умолчанию for this run.</p>
          ) : missingОбязательно.length > 0 ? (
            <p classИмя="mr-auto text-xs text-amber-600">
              Missing: {missingОбязательно.join(", ")}
            </p>
          ) : workspaceSelectionВключитьd && !workspaceConfigValid ? (
            <p classИмя="mr-auto text-xs text-amber-600">
              Choose an existing workspace before running.
            </p>
          ) : (
            <span classИмя="mr-auto" />
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isОжидание}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              const nextVariables: Record<string, string | number | boolean> = {};
              for (const variable of variables) {
                if (isАвтоРабочая областьВеткаVariable(variable)) {
                  nextVariables[variable.name] = workspaceВеткаАвтоЗначение!;
                  continue;
                }
                const rawЗначение = values[variable.name];
                if (isMissingОбязательноЗначение(rawЗначение)) continue;
                if (variable.type === "number") {
                  nextVariables[variable.name] = Number(rawЗначение);
                } else if (variable.type === "boolean") {
                  nextVariables[variable.name] = rawЗначение === true;
                } else {
                  nextVariables[variable.name] = String(rawЗначение);
                }
              }
              onОтправить({
                variables: nextVariables,
                assigneeАгентId: selection.assigneeАгентId,
                projectId: selection.projectId || null,
                ...(workspaceSelectionВключитьd
                  ? {
                    executionРабочая областьId: workspaceConfig.executionРабочая областьId,
                    executionРабочая областьPreference: workspaceConfig.executionРабочая областьPreference,
                    executionРабочая областьНастройки: workspaceConfig.executionРабочая областьНастройки,
                  }
                  : {}),
              });
            }}
            disabled={isОжидание || !canОтправить}
          >
            {isОжидание ? "Выполняется..." : "Запустить процедуру"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
