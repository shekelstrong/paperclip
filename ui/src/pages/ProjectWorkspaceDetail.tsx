import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isUuidLike, type ProjectРабочая область } from "@paperclipai/shared";
import { ArrowLeft, Check, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChooseПутьButton } from "../components/ПутьInstructionsModal";
import { projectsApi } from "../api/projects";
import {
  buildРабочая областьЗапуститьtimeControlSections,
  Рабочая областьЗапуститьtimeControls,
  type Рабочая областьЗапуститьtimeControlRequest,
} from "../components/Рабочая областьЗапуститьtimeControls";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { projectRouteRef, projectРабочая областьUrl } from "../lib/utils";

type Рабочая областьFormState = {
  name: string;
  sourceТип: ProjectРабочая областьSourceТип;
  cwd: string;
  repoUrl: string;
  repoRef: string;
  defaultRef: string;
  visibility: ProjectРабочая областьVisibility;
  setupКоманда: string;
  cleanupКоманда: string;
  remoteПровайдер: string;
  remoteРабочая областьRef: string;
  sharedРабочая областьКлюч: string;
  runtimeConfig: string;
};

type ProjectРабочая областьSourceТип = ProjectРабочая область["sourceТип"];
type ProjectРабочая областьVisibility = ProjectРабочая область["visibility"];

const SOURCE_TYPE_OPTIONS: Array<{ value: ProjectРабочая областьSourceТип; label: string; description: string }> = [
  { value: "local_path", label: "Local git checkout", description: "A local path Paperclip can use directly." },
  { value: "non_git_path", label: "Local non-git path", description: "A local folder without git semantics." },
  { value: "git_repo", label: "Remote git repo", description: "A repo URL with optional refs and local checkout." },
  { value: "remote_managed", label: "Remote-managed workspace", description: "A hosted workspace tracked by external reference." },
];

const VISIBILITY_OPTIONS: Array<{ value: ProjectРабочая областьVisibility; label: string }> = [
  { value: "default", label: "По умолчанию" },
  { value: "advanced", label: "Дополнительно" },
];

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isAbsoluteПуть(value: string) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function readText(value: string | null | undefined) {
  return value ?? "";
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function formStateFromРабочая область(workspace: ProjectРабочая область): Рабочая областьFormState {
  return {
    name: workspace.name,
    sourceТип: workspace.sourceТип,
    cwd: readText(workspace.cwd),
    repoUrl: readText(workspace.repoUrl),
    repoRef: readText(workspace.repoRef),
    defaultRef: readText(workspace.defaultRef),
    visibility: workspace.visibility,
    setupКоманда: readText(workspace.setupКоманда),
    cleanupКоманда: readText(workspace.cleanupКоманда),
    remoteПровайдер: readText(workspace.remoteПровайдер),
    remoteРабочая областьRef: readText(workspace.remoteРабочая областьRef),
    sharedРабочая областьКлюч: readText(workspace.sharedРабочая областьКлюч),
    runtimeConfig: formatJson(workspace.runtimeConfig?.workspaceЗапуститьtime),
  };
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseЗапуститьtimeConfigJson(value: string) {
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

function buildРабочая областьPatch(initialState: Рабочая областьFormState, nextState: Рабочая областьFormState) {
  const patch: Record<string, unknown> = {};
  const maybeAssign = (key: keyof Рабочая областьFormState, transform?: (value: string) => unknown) => {
    const initialЗначение = initialState[key];
    const nextЗначение = nextState[key];
    if (initialЗначение === nextЗначение) return;
    patch[key] = transform ? transform(nextЗначение) : nextЗначение;
  };

  maybeAssign("name", normalizeText);
  maybeAssign("sourceТип");
  maybeAssign("cwd", normalizeText);
  maybeAssign("repoUrl", normalizeText);
  maybeAssign("repoRef", normalizeText);
  maybeAssign("defaultRef", normalizeText);
  maybeAssign("visibility");
  maybeAssign("setupКоманда", normalizeText);
  maybeAssign("cleanupКоманда", normalizeText);
  maybeAssign("remoteПровайдер", normalizeText);
  maybeAssign("remoteРабочая областьRef", normalizeText);
  maybeAssign("sharedРабочая областьКлюч", normalizeText);
  if (initialState.runtimeConfig !== nextState.runtimeConfig) {
    const parsed = parseЗапуститьtimeConfigJson(nextState.runtimeConfig);
    if (!parsed.ok) throw new Ошибка(parsed.error);
    patch.runtimeConfig = {
      workspaceЗапуститьtime: parsed.value,
    };
  }

  return patch;
}

function validateРабочая областьForm(form: Рабочая областьFormState) {
  const cwd = normalizeText(form.cwd);
  const repoUrl = normalizeText(form.repoUrl);
  const remoteРабочая областьRef = normalizeText(form.remoteРабочая областьRef);

  if (form.sourceТип === "remote_managed") {
    if (!remoteРабочая областьRef && !repoUrl) {
      return "Remote-managed workspaces require a remote workspace ref or repo URL.";
    }
  } else if (!cwd && !repoUrl) {
    return "Рабочая область requires at least one local path or repo URL.";
  }

  if (cwd && (form.sourceТип === "local_path" || form.sourceТип === "non_git_path") && !isAbsoluteПуть(cwd)) {
    return "Local workspace path must be absolute.";
  }

  if (repoUrl) {
    try {
      new URL(repoUrl);
    } catch {
      return "URL репозитория must be a valid URL.";
    }
  }

  const runtimeConfig = parseЗапуститьtimeConfigJson(form.runtimeConfig);
  if (!runtimeConfig.ok) {
    return runtimeConfig.error;
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
    <label classИмя="space-y-1.5">
      <div classИмя="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        {hint ? <span classИмя="text-[11px] leading-relaxed text-muted-foreground sm:text-right">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-start sm:gap-3">
      <div classИмя="shrink-0 text-xs text-muted-foreground sm:w-28">{label}</div>
      <div classИмя="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

export function ProjectРабочая областьDetail() {
  const { companyPrefix, projectId, workspaceId } = useParams<{
    companyPrefix?: string;
    projectId: string;
    workspaceId: string;
  }>();
  const { companies, selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Рабочая областьFormState | null>(null);
  const [errorMessage, setОшибкаMessage] = useState<string | null>(null);
  const [runtimeActionMessage, setЗапуститьtimeActionMessage] = useState<string | null>(null);
  const routeProjectRef = projectId ?? "";
  const routeРабочая областьId = workspaceId ?? "";

  const routeКомпанияId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);

  const lookupКомпанияId = routeКомпанияId ?? selectedКомпанияId ?? undefined;
  const canFetchProject = routeProjectRef.length > 0 && (isUuidLike(routeProjectRef) || Boolean(lookupКомпанияId));
  const projectQuery = useQuery({
    queryКлюч: [...queryКлючs.projects.detail(routeProjectRef), lookupКомпанияId ?? null],
    queryFn: () => projectsApi.get(routeProjectRef, lookupКомпанияId),
    enabled: canFetchProject,
  });

  const project = projectQuery.data ?? null;
  const workspace = useMemo(
    () => project?.workspaces.find((item) => item.id === routeРабочая областьId) ?? null,
    [project, routeРабочая областьId],
  );
  const canonicalProjectRef = project ? projectRouteRef(project) : routeProjectRef;
  const initialState = useMemo(() => (workspace ? formStateFromРабочая область(workspace) : null), [workspace]);
  const isDirty = Boolean(form && initialState && JSON.stringify(form) !== JSON.stringify(initialState));

  useEffect(() => {
    if (!project?.companyId || project.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(project.companyId, { source: "route_sync" });
  }, [project?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  useEffect(() => {
    if (!workspace) return;
    setForm(formStateFromРабочая область(workspace));
    setОшибкаMessage(null);
  }, [workspace]);

  useEffect(() => {
    if (!project) return;
    setBreadcrumbs([
      { label: "Проекты", href: "/projects" },
      { label: project.name, href: `/projects/${canonicalProjectRef}` },
      { label: "Рабочие области", href: `/projects/${canonicalProjectRef}/workspaces` },
      { label: workspace?.name ?? routeРабочая областьId },
    ]);
  }, [setBreadcrumbs, project, canonicalProjectRef, workspace?.name, routeРабочая областьId]);

  useEffect(() => {
    if (!project) return;
    if (routeProjectRef === canonicalProjectRef) return;
    navigate(projectРабочая областьUrl(project, routeРабочая областьId), { replace: true });
  }, [project, routeProjectRef, canonicalProjectRef, routeРабочая областьId, navigate]);

  const invalidateProject = () => {
    if (!project) return;
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.id) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(project.urlКлюч) });
    if (lookupКомпанияId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(lookupКомпанияId) });
    }
  };

  const updateРабочая область = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      projectsApi.updateРабочая область(project!.id, routeРабочая областьId, patch, lookupКомпанияId),
    onУспешно: () => {
      invalidateProject();
      setОшибкаMessage(null);
    },
    onОшибка: (error) => {
      setОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to save workspace.");
    },
  });

  const setPrimaryРабочая область = useMutation({
    mutationFn: () => projectsApi.updateРабочая область(project!.id, routeРабочая областьId, { isPrimary: true }, lookupКомпанияId),
    onУспешно: () => {
      invalidateProject();
      setОшибкаMessage(null);
    },
    onОшибка: (error) => {
      setОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to update workspace.");
    },
  });

  const controlЗапуститьtimeServices = useMutation({
    mutationFn: (request: Рабочая областьЗапуститьtimeControlRequest) =>
      projectsApi.controlРабочая областьКоманды(project!.id, routeРабочая областьId, request.action, lookupКомпанияId, request),
    onУспешно: (result, request) => {
      invalidateProject();
      setОшибкаMessage(null);
      setЗапуститьtimeActionMessage(
        request.action === "run"
          ? "Рабочая область job completed."
          : request.action === "stop"
            ? "Рабочая область service stopped. Задача execution is not paused."
            : request.action === "restart"
              ? "Рабочая область service restarted. Задача execution is not paused."
              : "Рабочая область service started.",
      );
    },
    onОшибка: (error) => {
      setЗапуститьtimeActionMessage(null);
      setОшибкаMessage(error instanceof Ошибка ? error.message : "Ошибка to control workspace commands.");
    },
  });

  if (projectQuery.isЗагрузка) return <p classИмя="text-sm text-muted-foreground">Загрузка workspace…</p>;
  if (projectQuery.error) {
    return (
      <p classИмя="text-sm text-destructive">
        {projectQuery.error instanceof Ошибка ? projectQuery.error.message : "Ошибка to load workspace"}
      </p>
    );
  }
  if (!project || !workspace || !form || !initialState) {
    return <p classИмя="text-sm text-muted-foreground">Рабочая область not found for this project.</p>;
  }

  const canЗапуститьРабочая областьКоманды = Boolean(workspace.cwd);
  const canНачатьЗапуститьtimeServices = Boolean(workspace.runtimeConfig?.workspaceЗапуститьtime) && canЗапуститьРабочая областьКоманды;
  const runtimeControlSections = buildРабочая областьЗапуститьtimeControlSections({
    runtimeConfig: workspace.runtimeConfig?.workspaceЗапуститьtime ?? null,
    runtimeServices: workspace.runtimeServices ?? [],
    canНачатьServices: canНачатьЗапуститьtimeServices,
    canЗапуститьJobs: canЗапуститьРабочая областьКоманды,
  });
  const pendingЗапуститьtimeAction = controlЗапуститьtimeServices.isОжидание ? controlЗапуститьtimeServices.variables ?? null : null;

  const saveChanges = () => {
    const validationОшибка = validateРабочая областьForm(form);
    if (validationОшибка) {
      setОшибкаMessage(validationОшибка);
      return;
    }
    const patch = buildРабочая областьPatch(initialState, form);
    if (Object.keys(patch).length === 0) return;
    updateРабочая область.mutate(patch);
  };

  const sourceТипОписание = SOURCE_TYPE_OPTIONS.find((option) => option.value === form.sourceТип)?.description ?? null;

  return (
    <div classИмя="mx-auto max-w-5xl space-y-6">
      <div classИмя="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/projects/${canonicalProjectRef}/workspaces`}>
            <ArrowLeft classИмя="mr-1 h-4 w-4" />
            Назад to workspaces
          </Link>
        </Button>
        <div classИмя="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          {workspace.isPrimary ? "Primary workspace" : "Secondary workspace"}
        </div>
      </div>

      <div classИмя="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div classИмя="space-y-6">
          <div classИмя="rounded-2xl border border-border bg-card p-5">
            <div classИмя="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div classИмя="space-y-2">
                <div classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Project workspace
                </div>
                <h1 classИмя="text-2xl font-semibold">{workspace.name}</h1>
                <p classИмя="max-w-2xl text-sm text-muted-foreground">
                  Configure the concrete workspace Paperclip attaches to this project. These values drive per-workspace
                  checkout behavior, default runtime services for child execution workspaces, and let you override setup
                  or cleanup commands when one workspace needs special handling.
                </p>
              </div>
              {!workspace.isPrimary ? (
                <Button
                  variant="outline"
                  classИмя="w-full sm:w-auto"
                  disabled={setPrimaryРабочая область.isОжидание}
                  onClick={() => setPrimaryРабочая область.mutate()}
                >
                  {setPrimaryРабочая область.isОжидание
                    ? <Loader2 classИмя="mr-2 h-4 w-4 animate-spin" />
                    : <Check classИмя="mr-2 h-4 w-4" />}
                  Make primary
                </Button>
              ) : (
                <div classИмя="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 sm:max-w-sm">
                  <Sparkles classИмя="h-4 w-4" />
                  This is the project’s primary codebase workspace.
                </div>
              )}
            </div>

            <Separator classИмя="my-5" />

            <div classИмя="grid gap-4 md:grid-cols-2">
              <Field label="Название области">
                <input
                  classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                  value={form.name}
                  onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                  placeholder="Название области"
                />
              </Field>

              <Field label="Visibility">
                <select
                  classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((current) => current ? { ...current, visibility: event.target.value as ProjectРабочая областьVisibility } : current)
                  }
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div classИмя="mt-4 grid gap-4">
              <Field label="Source type" hint={sourceТипОписание ?? undefined}>
                <select
                  classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                  value={form.sourceТип}
                  onChange={(event) =>
                    setForm((current) => current ? { ...current, sourceТип: event.target.value as ProjectРабочая областьSourceТип } : current)
                  }
                >
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>

              <div classИмя="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Local path">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.cwd}
                    onChange={(event) => setForm((current) => current ? { ...current, cwd: event.target.value } : current)}
                    placeholder="/absolute/path/to/workspace"
                  />
                </Field>
                <div classИмя="flex items-end">
                  <ChooseПутьButton />
                </div>
              </div>

              <div classИмя="grid gap-4 md:grid-cols-2">
                <Field label="URL репозитория">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    value={form.repoUrl}
                    onChange={(event) => setForm((current) => current ? { ...current, repoUrl: event.target.value } : current)}
                    placeholder="https://github.com/org/repo"
                  />
                </Field>
                <Field label="Репозиторий ref">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.repoRef}
                    onChange={(event) => setForm((current) => current ? { ...current, repoRef: event.target.value } : current)}
                    placeholder="origin/main"
                  />
                </Field>
              </div>

              <div classИмя="grid gap-4 md:grid-cols-2">
                <Field label="По умолчанию ref">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.defaultRef}
                    onChange={(event) => setForm((current) => current ? { ...current, defaultRef: event.target.value } : current)}
                    placeholder="origin/main"
                  />
                </Field>
                <Field label="Shared workspace key">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.sharedРабочая областьКлюч}
                    onChange={(event) => setForm((current) => current ? { ...current, sharedРабочая областьКлюч: event.target.value } : current)}
                    placeholder="frontend"
                  />
                </Field>
              </div>

              <div classИмя="grid gap-4 md:grid-cols-2">
                <Field label="Remote provider">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    value={form.remoteПровайдер}
                    onChange={(event) => setForm((current) => current ? { ...current, remoteПровайдер: event.target.value } : current)}
                    placeholder="codespaces"
                  />
                </Field>
                <Field label="Remote workspace ref">
                  <input
                    classИмя="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.remoteРабочая областьRef}
                    onChange={(event) => setForm((current) => current ? { ...current, remoteРабочая областьRef: event.target.value } : current)}
                    placeholder="workspace-123"
                  />
                </Field>
              </div>

              <div classИмя="grid gap-4 md:grid-cols-2">
                <Field label="Setup command" hint="Запуститьs when this workspace needs custom bootstrap">
                  <textarea
                    classИмя="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.setupКоманда}
                    onChange={(event) => setForm((current) => current ? { ...current, setupКоманда: event.target.value } : current)}
                    placeholder="pnpm install && pnpm dev"
                  />
                </Field>
                <Field label="Cleanup command" hint="Запуститьs before project-level execution workspace teardown">
                  <textarea
                    classИмя="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.cleanupКоманда}
                    onChange={(event) => setForm((current) => current ? { ...current, cleanupКоманда: event.target.value } : current)}
                    placeholder="pkill -f vite || true"
                  />
                </Field>
              </div>

              <details classИмя="rounded-xl border border-dashed border-border/70 bg-background px-3 py-3">
                <summary classИмя="cursor-pointer text-sm font-medium">Дополнительно runtime JSON</summary>
                <p classИмя="mt-2 text-sm text-muted-foreground">
                  Paperclip derives Services and Jobs from this JSON. Prefer editing named commands first; use raw JSON for advanced lifecycle, port, readiness, or environment settings.
                </p>
                <div classИмя="mt-3">
                  <Field label="Рабочая область commands JSON" hint="Execution workspaces inherit this config unless they override it. Legacy `services` arrays still work, but `commands` supports both services and jobs.">
                    <textarea
                      classИмя="min-h-96 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                      value={form.runtimeConfig}
                      onChange={(event) => setForm((current) => current ? { ...current, runtimeConfig: event.target.value } : current)}
                      placeholder={"{\n  \"commands\": [\n    {\n      \"id\": \"web\",\n      \"name\": \"web\",\n      \"kind\": \"service\",\n      \"command\": \"pnpm dev\",\n      \"cwd\": \".\",\n      \"port\": { \"type\": \"auto\" },\n      \"readiness\": {\n        \"type\": \"http\",\n        \"urlTemplate\": \"http://127.0.0.1:${port}\"\n      },\n      \"expose\": {\n        \"type\": \"url\",\n        \"urlTemplate\": \"http://127.0.0.1:${port}\"\n      },\n      \"lifecycle\": \"shared\",\n      \"reuseОбласть\": \"project_workspace\"\n    },\n    {\n      \"id\": \"db-migrate\",\n      \"name\": \"db:migrate\",\n      \"kind\": \"job\",\n      \"command\": \"pnpm db:migrate\",\n      \"cwd\": \".\"\n    }\n  ]\n}"}
                    />
                  </Field>
                </div>
              </details>
            </div>

            <div classИмя="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
                }}
              >
                Сбросить
              </Button>
              {errorMessage ? <p classИмя="text-sm text-destructive">{errorMessage}</p> : null}
              {!errorMessage && runtimeActionMessage ? <p classИмя="text-sm text-muted-foreground">{runtimeActionMessage}</p> : null}
              {!errorMessage && !isDirty ? <p classИмя="text-sm text-muted-foreground">Нет unsaved changes.</p> : null}
            </div>
          </div>
        </div>

        <div classИмя="space-y-6">
          <div classИмя="rounded-2xl border border-border bg-card p-5">
            <div classИмя="space-y-1">
              <div classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Рабочая область facts</div>
              <h2 classИмя="text-lg font-semibold">Current state</h2>
            </div>
            <Separator classИмя="my-4" />
            <DetailRow label="Project">
              <Link to={`/projects/${canonicalProjectRef}`} classИмя="hover:underline">{project.name}</Link>
            </DetailRow>
            <DetailRow label="ID области">
              <span classИмя="break-all font-mono text-xs">{workspace.id}</span>
            </DetailRow>
            <DetailRow label="Local path">
              <span classИмя="break-all font-mono text-xs">{workspace.cwd ?? "Нет"}</span>
            </DetailRow>
            <DetailRow label="Репозиторий">
              {workspace.repoUrl && isSafeExternalUrl(workspace.repoUrl) ? (
                <a href={workspace.repoUrl} target="_blank" rel="noreferrer" classИмя="inline-flex items-center gap-1 hover:underline">
                  {workspace.repoUrl}
                  <ExternalLink classИмя="h-3 w-3" />
                </a>
              ) : workspace.repoUrl ? (
                <span classИмя="break-all font-mono text-xs">{workspace.repoUrl}</span>
              ) : "Нет"}
            </DetailRow>
            <DetailRow label="По умолчанию ref">{workspace.defaultRef ?? "Нет"}</DetailRow>
            <DetailRow label="Обновлено">{new Date(workspace.updatedAt).toLocaleString()}</DetailRow>
          </div>

          <div classИмя="rounded-2xl border border-border bg-card p-5">
            <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div classИмя="space-y-1">
                <div classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Рабочая область commands</div>
                <h2 classИмя="text-lg font-semibold">Services and jobs</h2>
                <p classИмя="text-sm text-muted-foreground">
                  Long-running services stay supervised here, while one-shot jobs run on demand against this workspace. Execution workspaces inherit this config unless they override it.
                </p>
              </div>
            </div>
            <Рабочая областьЗапуститьtimeControls
              classИмя="mt-4"
              sections={runtimeControlSections}
              isОжидание={controlЗапуститьtimeServices.isОжидание}
              pendingRequest={pendingЗапуститьtimeAction}
              serviceEmptyMessage={
                workspace.runtimeConfig?.workspaceЗапуститьtime
                  ? "Нет services have been started for this workspace yet."
                  : "Нет workspace command config is defined for this workspace yet."
              }
              jobEmptyMessage="Нет one-shot jobs are configured for this workspace yet."
              disabledHint="Project workspaces need a working directory before local commands can run, and services also need runtime config."
              onAction={(request) => controlЗапуститьtimeServices.mutate(request)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
