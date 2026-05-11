import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import type { Задача, ExecutionРабочая область } from "@paperclipai/shared";
import { useQuery } from "@tanstack/react-query";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { environmentsApi } from "../api/environments";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { orderReusableExecutionРабочие области } from "../lib/reusable-execution-workspaces";
import { cn, projectРабочая областьUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Копировать, GitВетка, ПапкаOpen, Pencil, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Utility helpers (mirrored from ЗадачаProperties for self-containment)      */
/* -------------------------------------------------------------------------- */

const EXECUTION_WORKSPACE_OPTIONS = [
  { value: "shared_workspace", label: "По умолчанию проекта" },
  { value: "isolated_workspace", label: "New isolated workspace" },
  { value: "reuse_existing", label: "Reuse existing workspace" },
] as const;

function issueModeForExistingРабочая область(mode: string | null | undefined) {
  if (mode === "isolated_workspace" || mode === "operator_branch" || mode === "shared_workspace") return mode;
  if (mode === "adapter_managed" || mode === "cloud_sandbox") return "agent_default";
  return "shared_workspace";
}

function shouldPresentExistingРабочая областьSelection(
  issue: Pick<
    Задача,
    "executionРабочая областьId" | "executionРабочая областьPreference" | "executionРабочая областьНастройки" | "currentExecutionРабочая область"
  >,
) {
  const persistedMode =
    issue.currentExecutionРабочая область?.mode
    ?? issue.executionРабочая областьНастройки?.mode
    ?? issue.executionРабочая областьPreference;
  return Boolean(
    issue.executionРабочая областьId &&
    (persistedMode === "isolated_workspace" || persistedMode === "operator_branch"),
  );
}

function defaultExecutionРабочая областьModeForProject(project: { executionРабочая областьPolicy?: { enabled?: boolean; defaultMode?: string | null } | null } | null | undefined) {
  const defaultMode = project?.executionРабочая областьPolicy?.enabled ? project.executionРабочая областьPolicy.defaultMode : null;
  if (defaultMode === "isolated_workspace" || defaultMode === "operator_branch") return defaultMode;
  if (defaultMode === "adapter_default") return "agent_default";
  return "shared_workspace";
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function BreakableПуть({ text }: { text: string }) {
  const parts: React.ReactНетde[] = [];
  const segments = text.split(/(?<=[\/-])/);
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) parts.push(<wbr key={i} />);
    parts.push(segments[i]);
  }
  return <>{parts}</>;
}

function КопироватьableInline({ value, label, mono }: { value: string; label?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnТип<typeof setTimeout>>(undefined);
  const handleКопировать = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }, [value]);

  return (
    <span classИмя="inline-flex items-center gap-1 group/copy">
      {label && <span classИмя="text-muted-foreground">{label}</span>}
      <span classИмя={cn("min-w-0", mono && "font-mono")} style={{ overflowWrap: "anywhere" }}>
        <BreakableПуть text={value} />
      </span>
      <button
        type="button"
        classИмя="shrink-0 p-0.5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover/copy:opacity-100 focus:opacity-100"
        onClick={handleКопировать}
        title={copied ? "Copied!" : "Копировать"}
      >
        {copied ? <Check classИмя="h-3 w-3 text-green-500" /> : <Копировать classИмя="h-3 w-3" />}
      </button>
    </span>
  );
}

function workspaceModeLabel(mode: string | null | undefined) {
  switch (mode) {
    case "isolated_workspace": return "Isolated workspace";
    case "operator_branch": return "Operator branch";
    case "cloud_sandbox": return "Cloud sandbox";
    case "adapter_managed": return "Адаптер managed";
    default: return "Рабочая область";
  }
}

function configuredРабочая областьLabel(
  selection: string | null | undefined,
  reusableРабочая область: ExecutionРабочая область | null,
) {
  switch (selection) {
    case "isolated_workspace":
      return "New isolated workspace";
    case "reuse_existing":
      return reusableРабочая область?.mode === "isolated_workspace"
        ? "Existing isolated workspace"
        : "Reuse existing workspace";
    default:
      return "По умолчанию проекта";
  }
}

function projectРабочая областьDetailLink(input: {
  projectId: string | null | undefined;
  projectРабочая областьId: string | null | undefined;
}) {
  if (!input.projectId || !input.projectРабочая областьId) return null;
  return projectРабочая областьUrl({ id: input.projectId, urlКлюч: input.projectId }, input.projectРабочая областьId);
}

function workspaceDetailLink(input: {
  projectId: string | null | undefined;
  issueProjectРабочая областьId: string | null | undefined;
  workspace: ExecutionРабочая область | null | undefined;
}) {
  const linkedProjectРабочая областьId = input.workspace?.projectРабочая областьId ?? input.issueProjectРабочая областьId ?? null;
  if (input.workspace?.mode === "shared_workspace") {
    return projectРабочая областьDetailLink({
      projectId: input.projectId,
      projectРабочая областьId: linkedProjectРабочая областьId,
    });
  }
  return input.workspace ? `/execution-workspaces/${input.workspace.id}` : null;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: "bg-green-500/15 text-green-700 dark:text-green-400",
    idle: "bg-muted text-muted-foreground",
    in_review: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    archived: "bg-muted text-muted-foreground",
  };
  return (
    <span classИмя={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", colors[status] ?? colors.idle)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

interface ЗадачаРабочая областьCardProps {
  issue: Omit<
    Pick<
      Задача,
      | "companyId"
      | "projectId"
      | "projectРабочая областьId"
      | "executionРабочая областьId"
      | "executionРабочая областьPreference"
      | "executionРабочая областьНастройки"
    >,
    "companyId"
  > & {
    companyId: string | null;
    currentExecutionРабочая область?: ExecutionРабочая область | null;
  };
  project: {
    id: string;
    executionРабочая областьPolicy?: {
      enabled?: boolean;
      defaultMode?: string | null;
      defaultProjectРабочая областьId?: string | null;
      environmentId?: string | null;
    } | null;
    workspaces?: Array<{ id: string; isPrimary: boolean }>;
  } | null;
  onОбновить: (data: Record<string, unknown>) => void;
  initialИзменитьing?: boolean;
  liveПредпросмотр?: boolean;
  onЧерновикChange?: (data: Record<string, unknown>, meta: { canСохранить: boolean; workspaceВеткаИмя?: string | null }) => void;
}

export function ЗадачаРабочая областьCard({
  issue,
  project,
  onОбновить,
  initialИзменитьing = false,
  liveПредпросмотр = false,
  onЧерновикChange,
}: ЗадачаРабочая областьCardProps) {
  const { selectedКомпанияId } = useКомпания();
  const companyId = issue.companyId ?? selectedКомпанияId;
  const [editing, setИзменитьing] = useState(initialИзменитьing);

  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
  });

  const environmentsВключитьd = experimentalНастройки?.enableОкружения === true;
  const policyВключитьd = experimentalНастройки?.enableIsolatedРабочие области === true
    && Boolean(project?.executionРабочая областьPolicy?.enabled);

  const workspace = issue.currentExecutionРабочая область as ExecutionРабочая область | null | undefined;
  const { data: environments } = useQuery({
    queryКлюч: queryКлючs.environments.list(companyId!),
    queryFn: () => environmentsApi.list(companyId!),
    enabled: Boolean(companyId) && environmentsВключитьd,
  });

  const { data: reusableExecutionРабочие области } = useQuery({
    queryКлюч: queryКлючs.executionРабочие области.list(companyId!, {
      projectId: issue.projectId ?? undefined,
      projectРабочая областьId: issue.projectРабочая областьId ?? undefined,
      reuseEligible: true,
    }),
    queryFn: () =>
      executionРабочие областиApi.list(companyId!, {
        projectId: issue.projectId ?? undefined,
        projectРабочая областьId: issue.projectРабочая областьId ?? undefined,
        reuseEligible: true,
      }),
    enabled: Boolean(companyId) && Boolean(issue.projectId) && editing,
  });

  const deduplicatedReusableРабочие области = useMemo(() => {
    return orderReusableExecutionРабочие области(reusableExecutionРабочие области ?? []);
  }, [reusableExecutionРабочие области]);

  const selectedReusableExecutionРабочая область =
    deduplicatedReusableРабочие области.find((w) => w.id === issue.executionРабочая областьId)
    ?? workspace
    ?? null;

  const currentSelection = shouldPresentExistingРабочая областьSelection(issue)
    ? "reuse_existing"
    : (
        issue.executionРабочая областьPreference
        ?? issue.executionРабочая областьНастройки?.mode
        ?? defaultExecutionРабочая областьModeForProject(project)
      );

  const [draftSelection, setЧерновикSelection] = useState(currentSelection);
  const [draftExecutionРабочая областьId, setЧерновикExecutionРабочая областьId] = useState(issue.executionРабочая областьId ?? "");
  const [draftОкружениеId, setЧерновикОкружениеId] = useState(issue.executionРабочая областьНастройки?.environmentId ?? "");
  const projectОкружениеId = environmentsВключитьd
    ? project?.executionРабочая областьPolicy?.environmentId ?? null
    : null;
  const currentReusableОкружениеId = selectedReusableExecutionРабочая область?.config?.environmentId ?? null;
  const currentОкружениеId = environmentsВключитьd
    ? (
        (currentSelection === "reuse_existing" && currentReusableОкружениеId)
        ?? workspace?.config?.environmentId
        ?? issue.executionРабочая областьНастройки?.environmentId
        ?? projectОкружениеId
      )
    : null;
  const currentОкружение =
    environments?.find((environment) => environment.id === currentОкружениеId)
    ?? null;

  useEffect(() => {
    if (editing) return;
    setЧерновикSelection(currentSelection);
    setЧерновикExecutionРабочая областьId(issue.executionРабочая областьId ?? "");
    setЧерновикОкружениеId(issue.executionРабочая областьНастройки?.environmentId ?? "");
  }, [currentSelection, editing, issue.executionРабочая областьId, issue.executionРабочая областьНастройки?.environmentId]);

  const activeНетnПо умолчаниюРабочая область = Boolean(workspace && workspace.mode !== "shared_workspace");

  const configuredReusableРабочая область =
    deduplicatedReusableРабочие области.find((w) => w.id === draftExecutionРабочая областьId)
    ?? (draftExecutionРабочая областьId === issue.executionРабочая областьId ? selectedReusableExecutionРабочая область : null);

  const selectedReusableРабочая областьLink = workspaceDetailLink({
    projectId: project?.id,
    issueProjectРабочая областьId: issue.projectРабочая областьId,
    workspace: selectedReusableExecutionРабочая область,
  });
  const currentРабочая областьLink = workspaceDetailLink({
    projectId: project?.id,
    issueProjectРабочая областьId: issue.projectРабочая областьId,
    workspace,
  });

  const canСохранитьРабочая областьConfig = draftSelection !== "reuse_existing" || draftExecutionРабочая областьId.length > 0;
  const reuseExistingSelection = draftSelection === "reuse_existing";
  const selectedReusableОкружениеId = configuredReusableРабочая область?.config?.environmentId ?? "";
  const runSelectableОкружения = useMemo(
    () => environmentsВключитьd ? (environments ?? []).filter((environment) => {
      if (environment.driver === "local" || environment.driver === "ssh") return true;
      if (environment.driver !== "sandbox") return false;
      const provider = typeof environment.config?.provider === "string" ? environment.config.provider : null;
      return provider !== null && provider !== "fake";
    }) : [],
    [environments, environmentsВключитьd],
  );
  const draftРабочая областьВеткаИмя =
    draftSelection === "reuse_existing" && configuredReusableРабочая область?.mode !== "shared_workspace"
      ? configuredReusableРабочая область?.branchИмя ?? null
      : null;

  const buildРабочая областьЧерновикОбновить = useCallback(() => ({
    executionРабочая областьPreference: draftSelection,
    executionРабочая областьId: draftSelection === "reuse_existing" ? draftExecutionРабочая областьId || null : null,
    executionРабочая областьНастройки: {
      mode:
        draftSelection === "reuse_existing"
          ? issueModeForExistingРабочая область(configuredReusableРабочая область?.mode)
          : draftSelection,
      environmentId: draftSelection === "reuse_existing" ? null : draftОкружениеId || null,
    },
  }), [
    configuredReusableРабочая область?.mode,
    draftОкружениеId,
    draftExecutionРабочая областьId,
    draftSelection,
  ]);

  useEffect(() => {
    if (!onЧерновикChange) return;
    onЧерновикChange(buildРабочая областьЧерновикОбновить(), {
      canСохранить: canСохранитьРабочая областьConfig,
      workspaceВеткаИмя: draftРабочая областьВеткаИмя,
    });
  }, [buildРабочая областьЧерновикОбновить, canСохранитьРабочая областьConfig, draftРабочая областьВеткаИмя, onЧерновикChange]);

  const handleСохранить = useCallback(() => {
    if (!canСохранитьРабочая областьConfig) return;
    onОбновить(buildРабочая областьЧерновикОбновить());
    setИзменитьing(false);
  }, [
    buildРабочая областьЧерновикОбновить,
    canСохранитьРабочая областьConfig,
    onОбновить,
  ]);

  const handleОтмена = useCallback(() => {
    setЧерновикSelection(currentSelection);
    setЧерновикExecutionРабочая областьId(issue.executionРабочая областьId ?? "");
    setЧерновикОкружениеId(issue.executionРабочая областьНастройки?.environmentId ?? "");
    setИзменитьing(false);
  }, [currentSelection, issue.executionРабочая областьId, issue.executionРабочая областьНастройки?.environmentId]);

  if (!policyВключитьd || !project) return null;

  const showИзменитьingControls = liveПредпросмотр || editing;

  return (
    <div classИмя="rounded-lg border border-border p-3 space-y-2">
      {/* Header row */}
      <div classИмя="flex items-center justify-between gap-2">
        <div classИмя="flex items-center gap-2 text-sm font-medium text-foreground">
          <GitВетка classИмя="h-3.5 w-3.5 text-muted-foreground" />
          {activeНетnПо умолчаниюРабочая область && workspace
            ? workspaceModeLabel(workspace.mode)
            : configuredРабочая областьLabel(currentSelection, selectedReusableExecutionРабочая область)}
          {workspace ? statusBadge(workspace.status) : statusBadge("idle")}
        </div>
        <div classИмя="flex items-center gap-1">
          {showИзменитьingControls ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                classИмя="h-6 px-2 text-xs text-muted-foreground"
                onClick={handleОтмена}
              >
                <X classИмя="h-3 w-3 mr-1" />Отмена
              </Button>
              <Button
                size="sm"
                classИмя="h-6 px-2 text-xs"
                onClick={handleСохранить}
                disabled={!canСохранитьРабочая областьConfig}
              >
                Сохранить
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              classИмя="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setИзменитьing(true)}
            >
              <Pencil classИмя="h-3 w-3 mr-1" />Изменить
            </Button>
          )}
        </div>
      </div>

      {/* Read-only info */}
      {!showИзменитьingControls && (
        <div classИмя="space-y-1.5 text-xs">
          {workspace?.branchИмя && (
            <div classИмя="flex items-center gap-1.5">
              <GitВетка classИмя="h-3 w-3 text-muted-foreground shrink-0" />
              <КопироватьableInline value={workspace.branchИмя} mono />
            </div>
          )}
          {workspace?.cwd && (
            <div classИмя="flex items-center gap-1.5">
              <ПапкаOpen classИмя="h-3 w-3 text-muted-foreground shrink-0" />
              <КопироватьableInline value={workspace.cwd} mono />
            </div>
          )}
          {workspace?.repoUrl && (
            <div classИмя="flex items-center gap-1.5 text-muted-foreground">
              <span classИмя="text-[11px]">Репозиторий:</span>
              <КопироватьableInline value={workspace.repoUrl} mono />
            </div>
          )}
          {environmentsВключитьd && currentОкружениеId && (
            <div classИмя="text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
              Окружение: <span classИмя="text-foreground">{currentОкружение?.name ?? currentОкружениеId}</span>
              {currentSelection === "reuse_existing" && currentReusableОкружениеId === currentОкружениеId
                ? " · reused workspace"
                : !issue.executionРабочая областьНастройки?.environmentId && projectОкружениеId === currentОкружениеId
                ? " · project default"
                : null}
            </div>
          )}
          {!workspace && (
            <div classИмя="text-muted-foreground">
              {currentSelection === "isolated_workspace"
                ? "A fresh isolated workspace will be created when this issue runs."
                : currentSelection === "reuse_existing"
                  ? "This issue will reuse an existing workspace when it runs."
                  : "This issue will use the project default workspace configuration when it runs."}
            </div>
          )}
          {currentSelection === "reuse_existing" && selectedReusableExecutionРабочая область && (
            <div classИмя="text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
              Reusing:{" "}
              {selectedReusableРабочая областьLink ? (
                <Link
                  to={selectedReusableРабочая областьLink}
                  classИмя="hover:text-foreground hover:underline"
                >
                  <BreakableПуть text={selectedReusableExecutionРабочая область.name} />
                </Link>
              ) : (
                <BreakableПуть text={selectedReusableExecutionРабочая область.name} />
              )}
            </div>
          )}
          {workspace && currentРабочая областьLink && (
            <div classИмя="pt-0.5">
              <Link
                to={currentРабочая областьLink}
                classИмя="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                View workspace details →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Изменитьing controls */}
      {editing && (
        <div classИмя="space-y-2 pt-1">
          <select
            classИмя="w-full rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
            value={draftSelection}
            onChange={(e) => {
              const nextMode = e.target.value;
              setЧерновикSelection(nextMode);
              if (nextMode !== "reuse_existing") {
                setЧерновикExecutionРабочая областьId("");
              } else if (!draftExecutionРабочая областьId && issue.executionРабочая областьId) {
                setЧерновикExecutionРабочая областьId(issue.executionРабочая областьId);
              }
            }}
          >
            {EXECUTION_WORKSPACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === "reuse_existing" && configuredReusableРабочая область?.mode === "isolated_workspace"
                  ? "Existing isolated workspace"
                  : option.label}
              </option>
            ))}
          </select>

          {draftSelection === "reuse_existing" && (
            <select
              classИмя="w-full rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
              value={draftExecutionРабочая областьId}
              onChange={(e) => {
                setЧерновикExecutionРабочая областьId(e.target.value);
              }}
            >
              <option value="">Choose an existing workspace</option>
              {deduplicatedReusableРабочие области.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.status} · {w.branchИмя ?? w.cwd ?? w.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}

          {environmentsВключитьd ? (
            <>
              <select
                classИмя={cn(
                  "w-full rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none",
                  reuseExistingSelection && "cursor-not-allowed opacity-70",
                )}
                value={reuseExistingSelection ? selectedReusableОкружениеId : draftОкружениеId}
                onChange={(e) => setЧерновикОкружениеId(e.target.value)}
                disabled={reuseExistingSelection}
              >
                <option value="">
                  {reuseExistingSelection
                    ? configuredReusableРабочая область
                      ? "Нет environment on reused workspace"
                      : "Select an existing workspace to inspect its environment"
                    : projectОкружениеId
                      ? "По умолчанию проекта environment"
                      : "Нет environment"}
                </option>
                {runSelectableОкружения.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name} · {environment.driver}
                  </option>
                ))}
              </select>
              {reuseExistingSelection && (
                <div classИмя="text-[11px] text-muted-foreground">
                  {configuredReusableРабочая область
                    ? "Окружение selection is locked while reusing an existing workspace. The next run will use that workspace's persisted environment config."
                    : "Choose an existing workspace first. Its persisted environment config will determine the next run."}
                </div>
              )}
            </>
          ) : null}

          {/* Current workspace summary when editing */}
          {workspace && (
            <div classИмя="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
              <div style={{ overflowWrap: "anywhere" }}>
                Current:{" "}
                {currentРабочая областьLink ? (
                  <Link
                    to={currentРабочая областьLink}
                    classИмя="hover:text-foreground hover:underline"
                  >
                    <BreakableПуть text={workspace.name} />
                  </Link>
                ) : (
                  <BreakableПуть text={workspace.name} />
                )}
                {" · "}
                {workspace.status}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
