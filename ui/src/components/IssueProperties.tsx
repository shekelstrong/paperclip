import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickTextColorForPillBg } from "@/lib/color-contrast";
import { Link } from "@/lib/router";
import type { Задача, ЗадачаLabel, Project, Рабочая областьЗапуститьtimeService } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { АдаптерМодель } from "../api/agents";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { buildКомпанияUserInlineOptions, buildКомпанияUserLabelMap } from "../lib/company-members";
import { ISSUE_OVERRIDE_ADAPTER_TYPES, type ЗадачаМодельLane } from "../lib/issue-assignee-overrides";
import { useProjectOrder } from "../hooks/useProjectOrder";
import {
  getRecentИсполнительIds,
  getRecentИсполнительSelectionIds,
  sortАгентыByRecency,
  trackRecentИсполнитель,
  trackRecentИсполнительUser,
} from "../lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { orderItemsBySelectedAndRecent } from "../lib/recent-selections";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { buildExecutionPolicy, stageParticipantЗначениеs } from "../lib/issue-execution-policy";
import { formatMonitorOffset } from "../lib/issue-monitor";
import { formatПовторитьReason } from "../lib/runПовторитьState";
import { useПовторитьСейчасMutation } from "../hooks/useПовторитьСейчасMutation";
import { ПовторитьОшибкаBand } from "./ЗадачаРасписаниеdПовторитьCard";
import { extractПровайдерIdWithFallback } from "../lib/model-utils";
import { СтатусIcon } from "./СтатусIcon";
import { ПриоритетIcon } from "./ПриоритетIcon";
import { Identity } from "./Identity";
import { ЗадачаReferencePill } from "./ЗадачаReferencePill";
import { formatDate, formatDateTime, cn, projectUrl } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogЗакрыть,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, Hexagon, ArrowUpRight, Tag, Plus, GitВетка, ПапкаOpen, Check, ExternalLink, X, Clock, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { АгентIcon } from "./АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "./InlineEntitySelector";

function TruncatedКопироватьable({ value, icon: Icon }: { value: string; icon: React.ComponentТип<{ classИмя?: string }> }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnТип<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const handleКопировать = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }, [value]);

  return (
    <div classИмя="flex items-start gap-1.5 min-w-0 flex-1">
      <Icon classИмя="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <button
        type="button"
        classИмя="text-sm font-mono min-w-0 break-all text-left cursor-pointer hover:text-foreground transition-colors"
        onClick={handleКопировать}
        title={copied ? "Copied!" : "Click to copy"}
      >
        {value}
      </button>
      {copied && <Check classИмя="h-3 w-3 text-green-500 shrink-0 mt-0.5" />}
    </div>
  );
}

function defaultProjectРабочая областьIdForProject(project: {
  workspaces?: Array<{ id: string; isPrimary: boolean }>;
  executionРабочая областьPolicy?: { defaultProjectРабочая областьId?: string | null } | null;
} | null | undefined) {
  if (!project) return null;
  return project.executionРабочая областьPolicy?.defaultProjectРабочая областьId
    ?? project.workspaces?.find((workspace) => workspace.isPrimary)?.id
    ?? project.workspaces?.[0]?.id
    ?? null;
}

function defaultExecutionРабочая областьModeForProject(project: { executionРабочая областьPolicy?: { enabled?: boolean; defaultMode?: string | null } | null } | null | undefined) {
  const defaultMode = project?.executionРабочая областьPolicy?.enabled ? project.executionРабочая областьPolicy.defaultMode : null;
  if (defaultMode === "isolated_workspace" || defaultMode === "operator_branch") return defaultMode;
  if (defaultMode === "adapter_default") return "agent_default";
  return "shared_workspace";
}

function primaryРабочая областьIdForProject(project: Pick<Project, "primaryРабочая область" | "workspaces"> | null | undefined) {
  return project?.primaryРабочая область?.id
    ?? project?.workspaces.find((workspace) => workspace.isPrimary)?.id
    ?? project?.workspaces[0]?.id
    ?? null;
}

function isMainЗадачаРабочая область(input: {
  issue: Pick<Задача, "projectРабочая областьId" | "currentExecutionРабочая область">;
  project: Pick<Project, "primaryРабочая область" | "workspaces"> | null | undefined;
}) {
  const workspace = input.issue.currentExecutionРабочая область ?? null;
  const primaryРабочая областьId = primaryРабочая областьIdForProject(input.project);
  const linkedProjectРабочая областьId = workspace?.projectРабочая областьId ?? input.issue.projectРабочая областьId ?? null;
  if (workspace) {
    if (workspace.mode !== "shared_workspace") return false;
    if (!linkedProjectРабочая областьId || !primaryРабочая областьId) return true;
    return workspace.mode === "shared_workspace" && linkedProjectРабочая областьId === primaryРабочая областьId;
  }
  if (!linkedProjectРабочая областьId || !primaryРабочая областьId) return true;
  return linkedProjectРабочая областьId === primaryРабочая областьId;
}

function runningЗапуститьtimeServiceWithUrl(
  runtimeServices: Рабочая областьЗапуститьtimeService[] | null | undefined,
) {
  return runtimeServices?.find((service) => service.status === "running" && service.url?.trim()) ?? null;
}

function toDateTimeLocalЗначение(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface ЗадачаPropertiesProps {
  issue: Задача;
  childЗадачи?: Задача[];
  onДобавитьSubЗадача?: () => void;
  onОбновить: (data: Record<string, unknown>) => void;
  inline?: boolean;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex items-start gap-3 py-1.5">
      <span classИмя="text-xs text-muted-foreground shrink-0 w-20 mt-0.5">{label}</span>
      <div classИмя="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">{children}</div>
    </div>
  );
}

const ISSUE_THINKING_EFFORT_OPTIONS = {
  claude_local: [
    { value: "", label: "По умолчанию" },
    { value: "low", label: "Низкий" },
    { value: "medium", label: "Средний" },
    { value: "high", label: "Высокий" },
  ],
  codex_local: [
    { value: "", label: "По умолчанию" },
    { value: "minimal", label: "Minimal" },
    { value: "low", label: "Низкий" },
    { value: "medium", label: "Средний" },
    { value: "high", label: "Высокий" },
    { value: "xhigh", label: "X-Высокий" },
  ],
  opencode_local: [
    { value: "", label: "По умолчанию" },
    { value: "minimal", label: "Minimal" },
    { value: "low", label: "Низкий" },
    { value: "medium", label: "Средний" },
    { value: "high", label: "Высокий" },
    { value: "xhigh", label: "X-Высокий" },
    { value: "max", label: "Max" },
  ],
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function thinkingEffortOptionsFor(adapterТип: string | null | undefined) {
  if (adapterТип === "codex_local") return ISSUE_THINKING_EFFORT_OPTIONS.codex_local;
  if (adapterТип === "opencode_local") return ISSUE_THINKING_EFFORT_OPTIONS.opencode_local;
  return ISSUE_THINKING_EFFORT_OPTIONS.claude_local;
}

function thinkingEffortКлючFor(adapterТип: string | null | undefined) {
  if (adapterТип === "codex_local") return "modelReasoningEffort";
  if (adapterТип === "opencode_local") return "variant";
  return "effort";
}

function thinkingEffortЗначениеFor(adapterТип: string | null | undefined, adapterConfig: Record<string, unknown>) {
  if (adapterТип === "codex_local") {
    return String(adapterConfig.modelReasoningEffort ?? adapterConfig.reasoningEffort ?? adapterConfig.effort ?? "");
  }
  if (adapterТип === "opencode_local") {
    return String(adapterConfig.variant ?? "");
  }
  return String(adapterConfig.effort ?? "");
}

function overrideLane(overrides: Задача["assigneeАдаптерOverrides"]): ЗадачаМодельLane {
  if (overrides?.modelПрофиль === "cheap") return "cheap";
  if (overrides?.adapterConfig) return "custom";
  return "primary";
}

function sortАдаптерМодельs(models: АдаптерМодель[]) {
  return [...models].sort((a, b) => {
    const providerA = extractПровайдерIdWithFallback(a.id);
    const providerB = extractПровайдерIdWithFallback(b.id);
    const byПровайдер = providerA.localeCompare(providerB);
    if (byПровайдер !== 0) return byПровайдер;
    return a.id.localeCompare(b.id);
  });
}

function RemovableЗадачаReferencePill({
  issue,
  onУдалить,
}: {
  issue: НетnNullable<Задача["blockedBy"]>[number];
  onУдалить: (issueId: string) => void;
}) {
  const [isПодтвердитьOpen, setIsПодтвердитьOpen] = useState(false);
  const issueLabel = issue.identifier ?? issue.title;
  const confirmLabel = issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title;
  const content = (
    <>
      <СтатусIcon status={issue.status} classИмя="h-3 w-3 shrink-0" />
      <span classИмя="truncate">{issueLabel}</span>
    </>
  );
  const removeLabel = `Удалить ${issueLabel} as blocker`;
  const handleУдалить = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventПо умолчанию();
    event.stopPropagation();
    setIsПодтвердитьOpen(true);
  };
  const confirmУдалить = () => {
    onУдалить(issue.id);
    setIsПодтвердитьOpen(false);
  };

  return (
    <>
      <span
        data-mention-kind="issue"
        classИмя={cn(
          "paperclip-mention-chip paperclip-mention-chip--issue group",
          "inline-flex items-center gap-1 rounded-full border border-border py-0.5 pl-1 pr-2 text-xs",
        )}
        title={issue.title}
        aria-label={`Задача ${issueLabel}: ${issue.title}`}
      >
        <button
          type="button"
          classИмя="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-colors transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring group-hover:opacity-100"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={handleУдалить}
        >
          <X classИмя="h-3 w-3" />
        </button>
        {issue.identifier ? (
          <Link
            to={`/issues/${issueLabel}`}
            classИмя="inline-flex min-w-0 items-center gap-1 no-underline hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            aria-label={`Задача ${issueLabel}: ${issue.title}`}
          >
            {content}
          </Link>
        ) : (
          <span classИмя="inline-flex min-w-0 items-center gap-1">{content}</span>
        )}
      </span>
      <Dialog open={isПодтвердитьOpen} onOpenChange={setIsПодтвердитьOpen}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>Удалить blocker?</DialogНазвание>
            <DialogОписание>
              Удалить {confirmLabel} as a blocker for this issue.
            </DialogОписание>
          </DialogHeader>
          <DialogFooter>
            <DialogЗакрыть asChild>
              <Button type="button" variant="outline">Отмена</Button>
            </DialogЗакрыть>
            <Button type="button" variant="destructive" onClick={confirmУдалить}>
              Удалить blocker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Renders a Popover on desktop, or an inline collapsible section on mobile (inline mode). */
function PropertyPicker({
  inline,
  label,
  open,
  onOpenChange,
  triggerContent,
  triggerClassИмя,
  popoverClassИмя,
  popoverAlign = "end",
  extra,
  children,
}: {
  inline?: boolean;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerContent: React.ReactНетde;
  triggerClassИмя?: string;
  popoverClassИмя?: string;
  popoverAlign?: "start" | "center" | "end";
  extra?: React.ReactНетde;
  children: React.ReactНетde;
}) {
  const btnCn = cn(
    "inline-flex items-start gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors min-w-0 max-w-full text-left",
    triggerClassИмя,
  );

  if (inline) {
    return (
      <div>
        <PropertyRow label={label}>
          <button classИмя={btnCn} onClick={() => onOpenChange(!open)}>
            {triggerContent}
          </button>
          {extra}
        </PropertyRow>
        {open && (
          <div classИмя={cn("rounded-md border border-border bg-popover p-1 mb-2", popoverClassИмя)}>
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <PropertyRow label={label}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button classИмя={btnCn}>{triggerContent}</button>
        </PopoverTrigger>
        <PopoverContent classИмя={cn("p-1", popoverClassИмя)} align={popoverAlign} collisionPadding={16}>
          {children}
        </PopoverContent>
      </Popover>
      {extra}
    </PropertyRow>
  );
}

export function ЗадачаProperties({
  issue,
  childЗадачи = [],
  onДобавитьSubЗадача,
  onОбновить,
  inline,
}: ЗадачаPropertiesProps) {
  const { selectedКомпанияId } = useКомпания();
  const queryClient = useQueryClient();
  const companyId = issue.companyId ?? selectedКомпанияId;
  const [assigneeOpen, setИсполнительOpen] = useState(false);
  const [assigneeПоиск, setИсполнительПоиск] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectПоиск, setProjectПоиск] = useState("");
  const [blockedByOpen, setЗаблокированByOpen] = useState(false);
  const [blockedByПоиск, setЗаблокированByПоиск] = useState("");
  const [parentOpen, setРодительOpen] = useState(false);
  const [parentПоиск, setРодительПоиск] = useState("");
  const [reviewersOpen, setРецензентыOpen] = useState(false);
  const [reviewerПоиск, setРецензентПоиск] = useState("");
  const [approversOpen, setУтверждающиеOpen] = useState(false);
  const [approverПоиск, setУтверждающийПоиск] = useState("");
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [scheduledПовторитьOpen, setРасписаниеdПовторитьOpen] = useState(false);
  const [labelsOpen, setЯрлыкиOpen] = useState(false);
  const [assigneeOptionsOpen, setИсполнительOptionsOpen] = useState(false);
  const [labelПоиск, setLabelПоиск] = useState("");
  const [newLabelИмя, setNewLabelИмя] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [monitorAtInput, setMonitorAtInput] = useState(() => toDateTimeLocalЗначение(issue.executionPolicy?.monitor?.nextCheckAt));
  const [monitorНетtesInput, setMonitorНетtesInput] = useState(issue.executionPolicy?.monitor?.notes ?? "");
  const [monitorServiceInput, setMonitorServiceInput] = useState(issue.executionPolicy?.monitor?.serviceИмя ?? "");

  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId;

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(companyId!),
    queryFn: () => accessApi.listUserDirectory(companyId!),
    enabled: !!companyId,
  });
  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(companyId!),
    queryFn: () => projectsApi.list(companyId!),
    enabled: !!companyId,
  });
  const activeПроекты = useMemo(
    () => (projects ?? []).filter((p) => !p.archivedAt || p.id === issue.projectId),
    [projects, issue.projectId],
  );
  const { orderedПроекты } = useProjectOrder({
    projects: activeПроекты,
    companyId,
    userId: currentUserId,
  });

  const { data: labels } = useQuery({
    queryКлюч: queryКлючs.issues.labels(companyId!),
    queryFn: () => issuesApi.listЯрлыки(companyId!),
    enabled: !!companyId,
  });

  const { data: allЗадачи } = useQuery({
    queryКлюч: queryКлючs.issues.list(companyId!),
    queryFn: () => issuesApi.list(companyId!),
    enabled: !!companyId && (blockedByOpen || parentOpen),
  });

  const createLabel = useMutation({
    mutationFn: (data: { name: string; color: string }) => issuesApi.createLabel(companyId!, data),
    onУспешно: async (created) => {
      queryClient.setQueryData<ЗадачаLabel[] | undefined>(
        queryКлючs.issues.labels(companyId!),
        (current) => {
          if (!current) return [created];
          if (current.some((label) => label.id === created.id)) return current;
          return [...current, created];
        },
      );
      onОбновить({ labelIds: [...(issue.labelIds ?? []), created.id] });
      void queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.labels(companyId!) });
      setNewLabelИмя("");
    },
  });

  const toggleLabel = (labelId: string) => {
    const ids = issue.labelIds ?? [];
    const next = ids.includes(labelId)
      ? ids.filter((id) => id !== labelId)
      : [...ids, labelId];
    onОбновить({ labelIds: next });
  };

  const agentИмя = (id: string | null) => {
    if (!id || !agents) return null;
    const agent = agents.find((a) => a.id === id);
    return agent?.name ?? id.slice(0, 8);
  };

  const projectИмя = (id: string | null) => {
    if (!id) return id?.slice(0, 8) ?? "Нет";
    const project = orderedПроекты.find((p) => p.id === id);
    return project?.name ?? id.slice(0, 8);
  };
  const currentProject = issue.projectId
    ? orderedПроекты.find((project) => project.id === issue.projectId) ?? null
    : null;
  const issueProject = issue.project ?? currentProject;
  const issueUsesMainРабочая область = useMemo(
    () => isMainЗадачаРабочая область({ issue, project: issueProject }),
    [issue, issueProject],
  );
  const showРабочая областьDetailLink = Boolean(issue.executionРабочая областьId) && !issueUsesMainРабочая область;
  const liveРабочая областьService = useMemo(() => {
    if (issueUsesMainРабочая область) return null;
    return runningЗапуститьtimeServiceWithUrl(issue.currentExecutionРабочая область?.runtimeServices);
  }, [issue.currentExecutionРабочая область?.runtimeServices, issueUsesMainРабочая область]);
  const referencedЗадачаIdentifiers = issue.referencedЗадачаIdentifiers ?? [];
  const relatedЗадачи = useMemo(() => {
    const excluded = new Set<string>();
    const addExcluded = (candidate: { id: string; identifier?: string | null }) => {
      excluded.add(candidate.id);
      if (candidate.identifier) excluded.add(candidate.identifier);
    };

    for (const blocker of issue.blockedBy ?? []) addExcluded(blocker);
    for (const blocked of issue.blocks ?? []) addExcluded(blocked);
    for (const child of childЗадачи) addExcluded(child);

    const referencedЗадачи = issue.relatedРабота?.outbound.map((item) => item.issue) ?? [];
    if (referencedЗадачи.length > 0) {
      return referencedЗадачи.filter((referenced) => {
        const label = referenced.identifier ?? referenced.id;
        return !excluded.has(referenced.id) && !excluded.has(label);
      });
    }

    return referencedЗадачаIdentifiers
      .filter((identifier) => !excluded.has(identifier))
      .map((identifier) => ({ id: identifier, identifier, title: identifier }));
  }, [childЗадачи, issue.blockedBy, issue.blocks, issue.relatedРабота?.outbound, referencedЗадачаIdentifiers]);
  const projectLink = (id: string | null) => {
    if (!id) return null;
    const project = projects?.find((p) => p.id === id) ?? null;
    return project ? projectUrl(project) : `/projects/${id}`;
  };

  const recentИсполнительIds = useMemo(() => getRecentИсполнительIds(), [assigneeOpen]);
  const recentИсполнительSelectionIds = useMemo(() => getRecentИсполнительSelectionIds(), [assigneeOpen]);
  const sortedАгенты = useMemo(
    () => sortАгентыByRecency((agents ?? []).filter((a) => a.status !== "terminated"), recentИсполнительIds),
    [agents, recentИсполнительIds],
  );
  const recentИсполнительЗначениеs = useMemo(
    () => recentИсполнительSelectionIds,
    [recentИсполнительSelectionIds],
  );
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [projectOpen]);
  const userLabelMap = useMemo(
    () => buildКомпанияUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const otherUserOptions = useMemo(
    () => buildКомпанияUserInlineOptions(companyMembers?.users, { excludeUserIds: [currentUserId, issue.createdByUserId] }),
    [companyMembers?.users, currentUserId, issue.createdByUserId],
  );

  const assignee = issue.assigneeАгентId
    ? agents?.find((a) => a.id === issue.assigneeАгентId)
    : null;
  const assigneeАдаптерТип = assignee?.adapterТип ?? null;
  const assigneeАдаптерOverrides = issue.assigneeАдаптерOverrides ?? null;
  const showИсполнительАдаптерOptions = assigneeАдаптерOverrides !== null;
  const supportsИсполнительOverrides = Boolean(
    assigneeАдаптерТип && ISSUE_OVERRIDE_ADAPTER_TYPES.has(assigneeАдаптерТип),
  );
  const assigneeSupportsCheapLane = Boolean(
    supportsИсполнительOverrides
      && (assigneeАдаптерТип === "claude_local"
        || assigneeАдаптерТип === "codex_local"
        || assigneeАдаптерТип === "opencode_local"),
  );
  const assigneeOverrideLane = overrideLane(assigneeАдаптерOverrides);
  const assigneeOverrideАдаптерConfig = asRecord(assigneeАдаптерOverrides?.adapterConfig);
  const assigneeOverrideМодель =
    typeof assigneeOverrideАдаптерConfig.model === "string" ? assigneeOverrideАдаптерConfig.model : "";
  const assigneeOverrideThinkingEffort = thinkingEffortЗначениеFor(
    assigneeАдаптерТип,
    assigneeOverrideАдаптерConfig,
  );
  const assigneeOverrideChrome = assigneeАдаптерТип === "claude_local"
    && assigneeOverrideАдаптерConfig.chrome === true;
  const { data: assigneeАдаптерМодельs } = useQuery({
    queryКлюч:
      companyId && assigneeАдаптерТип
        ? queryКлючs.agents.adapterМодельs(companyId, assigneeАдаптерТип)
        : ["agents", "none", "adapter-models", assigneeАдаптерТип ?? "none"],
    queryFn: () => agentsApi.adapterМодельs(companyId!, assigneeАдаптерТип!),
    enabled: Boolean(companyId) && showИсполнительАдаптерOptions && supportsИсполнительOverrides,
  });
  const { data: assigneeCheapПрофильs } = useQuery({
    queryКлюч: companyId && assigneeАдаптерТип
      ? queryКлючs.agents.adapterМодельПрофильs(companyId, assigneeАдаптерТип)
      : ["agents", "none", "adapter-model-profiles", assigneeАдаптерТип ?? "none"],
    queryFn: () => agentsApi.adapterМодельПрофильs(companyId!, assigneeАдаптерТип!),
    enabled: Boolean(companyId) && showИсполнительАдаптерOptions && assigneeSupportsCheapLane,
  });
  const assigneeCheapПрофиль = useMemo(
    () => (assigneeCheapПрофильs ?? []).find((profile) => profile.key === "cheap") ?? null,
    [assigneeCheapПрофильs],
  );
  const modelOverrideOptions = useMemo<InlineEntityOption[]>(() => {
    const models = sortАдаптерМодельs(assigneeАдаптерМодельs ?? []);
    const options = models.map((model) => ({
      id: model.id,
      label: model.label,
      searchText: `${model.id} ${extractПровайдерIdWithFallback(model.id)}`,
    }));
    if (assigneeOverrideМодель && !options.some((option) => option.id === assigneeOverrideМодель)) {
      options.unshift({
        id: assigneeOverrideМодель,
        label: assigneeOverrideМодель,
        searchText: assigneeOverrideМодель,
      });
    }
    return options;
  }, [assigneeАдаптерМодельs, assigneeOverrideМодель]);
  const updateИсполнительАдаптерOverrides = (next: Задача["assigneeАдаптерOverrides"]) => {
    onОбновить({ assigneeАдаптерOverrides: next });
  };
  const buildИсполнительOverrideWithConfig = (adapterConfig: Record<string, unknown>) => {
    const nextConfig = compactRecord(adapterConfig);
    const next = compactRecord({
      useProjectРабочая область: assigneeАдаптерOverrides?.useProjectРабочая область,
      ...(Object.keys(nextConfig).length > 0 ? { adapterConfig: nextConfig } : {}),
    });
    return Object.keys(next).length > 0 ? next : null;
  };
  const updateИсполнительOverrideConfig = (patch: Record<string, unknown>) => {
    updateИсполнительАдаптерOverrides(
      buildИсполнительOverrideWithConfig({
        ...assigneeOverrideАдаптерConfig,
        ...patch,
      }),
    );
  };
  const updateИсполнительOverrideThinkingEffort = (nextЗначение: string) => {
    const nextConfig = { ...assigneeOverrideАдаптерConfig };
    delete nextConfig.modelReasoningEffort;
    delete nextConfig.reasoningEffort;
    delete nextConfig.effort;
    delete nextConfig.variant;
    if (nextЗначение) {
      nextConfig[thinkingEffortКлючFor(assigneeАдаптерТип)] = nextЗначение;
    }
    updateИсполнительАдаптерOverrides(buildИсполнительOverrideWithConfig(nextConfig));
  };
  const setИсполнительOverrideLane = (lane: ЗадачаМодельLane) => {
    if (lane === "primary") {
      updateИсполнительАдаптерOverrides(null);
      return;
    }
    if (lane === "cheap") {
      updateИсполнительАдаптерOverrides(
        compactRecord({
          useProjectРабочая область: assigneeАдаптерOverrides?.useProjectРабочая область,
          modelПрофиль: "cheap",
        }),
      );
      return;
    }
    updateИсполнительАдаптерOverrides(buildИсполнительOverrideWithConfig(assigneeOverrideАдаптерConfig) ?? { adapterConfig: {} });
  };
  const assigneeOptionsTrigger = (() => {
    if (assigneeOverrideLane === "cheap") {
      return <span classИмя="text-sm">Cheap model</span>;
    }
    if (assigneeOverrideLane === "custom") {
      const details = [
        assigneeOverrideМодель,
        assigneeOverrideThinkingEffort,
        assigneeOverrideChrome ? "Chrome" : "",
      ].filter(Boolean);
      return (
        <span classИмя="min-w-0 text-sm break-words">
          Свой{details.length > 0 ? ` · ${details.join(" · ")}` : " adapter options"}
        </span>
      );
    }
    return <span classИмя="text-sm text-muted-foreground">Primary model</span>;
  })();
  const assigneeOptionsContent = supportsИсполнительOverrides ? (
    <div classИмя="w-full space-y-3 p-2">
      <div classИмя="space-y-1.5">
        <div classИмя="text-xs text-muted-foreground">Модель lane</div>
        <div classИмя="flex w-full overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="Модель lane">
          {(["primary", ...(assigneeSupportsCheapLane ? (["cheap"] as const) : ([] as const)), "custom"] as const).map((lane) => (
            <button
              key={lane}
              type="button"
              role="radio"
              aria-checked={assigneeOverrideLane === lane}
              classИмя={cn(
                "flex-1 px-2 py-1 text-xs capitalize transition-colors hover:bg-accent/40",
                assigneeOverrideLane === lane && "bg-accent text-foreground",
              )}
              onClick={() => setИсполнительOverrideLane(lane)}
            >
              {lane === "primary" ? "Primary" : lane === "cheap" ? "Cheap" : "Свой"}
            </button>
          ))}
        </div>
        {assigneeOverrideLane === "cheap" ? (
          <p classИмя="text-[11px] text-muted-foreground">
            Отправитьs <code>modelПрофиль: "cheap"</code>{" "}
            {assigneeCheapПрофиль?.adapterConfig && typeof (assigneeCheapПрофиль.adapterConfig as Record<string, unknown>).model === "string"
              ? <>· adapter default <code>{String((assigneeCheapПрофиль.adapterConfig as Record<string, unknown>).model)}</code></>
              : assigneeCheapПрофиль
                ? <>· uses the agent&apos;s configured cheap profile</>
                : <>· falls back to the primary model if no cheap profile is configured</>}
          </p>
        ) : null}
      </div>
      {assigneeOverrideLane === "custom" ? (
        <>
          <div classИмя="space-y-1.5">
            <div classИмя="text-xs text-muted-foreground">Модель</div>
            <InlineEntitySelector
              value={assigneeOverrideМодель}
              options={modelOverrideOptions}
              placeholder="По умолчанию model"
              disableПортal
              noneLabel="По умолчанию model"
              searchPlaceholder="Поиск models..."
              emptyMessage="Нет models found."
              onChange={(model) => updateИсполнительOverrideConfig({ model: model || undefined })}
            />
          </div>
          <div classИмя="space-y-1.5">
            <div classИмя="text-xs text-muted-foreground">Thinking effort</div>
            <div classИмя="flex items-center gap-1.5 flex-wrap">
              {thinkingEffortOptionsFor(assigneeАдаптерТип).map((option) => (
                <button
                  key={option.value || "default"}
                  classИмя={cn(
                    "px-2 py-1 rounded-md text-xs border border-border hover:bg-accent/50 transition-colors",
                    assigneeOverrideThinkingEffort === option.value && "bg-accent",
                  )}
                  onClick={() => updateИсполнительOverrideThinkingEffort(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {assigneeАдаптерТип === "claude_local" ? (
            <div classИмя="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
              <div classИмя="text-xs text-muted-foreground">Включить Chrome (--chrome)</div>
              <ToggleSwitch
                checked={assigneeOverrideChrome}
                onCheckedChange={(next) => updateИсполнительOverrideConfig({ chrome: next ? true : undefined })}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  ) : (
    <div classИмя="w-full space-y-2 p-2">
      <p classИмя="text-xs text-muted-foreground">
        {assignee
          ? "This assignee's adapter does not expose editable issue overrides."
          : "Select a compatible agent assignee to edit these overrides."}
      </p>
      <button
        type="button"
        classИмя="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        onClick={() => updateИсполнительАдаптерOverrides(null)}
      >
        Очистить adapter options
      </button>
    </div>
  );
  const reviewerЗначениеs = stageParticipantЗначениеs(issue.executionPolicy, "review");
  const approverЗначениеs = stageParticipantЗначениеs(issue.executionPolicy, "approval");
  const userLabel = (userId: string | null | undefined) => formatИсполнительUserLabel(userId, currentUserId, userLabelMap);
  const assigneeUserLabel = userLabel(issue.assigneeUserId);
  const creatorUserLabel = userLabel(issue.createdByUserId);
  const selectedИсполнительЗначение = issue.assigneeАгентId
    ? `agent:${issue.assigneeАгентId}`
    : issue.assigneeUserId
      ? `user:${issue.assigneeUserId}`
      : "";
  const updateExecutionPolicy = (nextРецензенты: string[], nextУтверждающие: string[]) => {
    onОбновить({
      executionPolicy: buildExecutionPolicy({
        existingPolicy: issue.executionPolicy ?? null,
        reviewerЗначениеs: nextРецензенты,
        approverЗначениеs: nextУтверждающие,
      }),
    });
  };
  const toggleExecutionParticipant = (stageТип: "review" | "approval", value: string) => {
    const currentЗначениеs = stageТип === "review" ? reviewerЗначениеs : approverЗначениеs;
    const nextЗначениеs = currentЗначениеs.includes(value)
      ? currentЗначениеs.filter((candidate) => candidate !== value)
      : [...currentЗначениеs, value];
    updateExecutionPolicy(
      stageТип === "review" ? nextЗначениеs : reviewerЗначениеs,
      stageТип === "approval" ? nextЗначениеs : approverЗначениеs,
    );
  };
  const executionParticipantLabel = (value: string) => {
    if (value.startsWith("agent:")) {
      return agentИмя(value.slice("agent:".length)) ?? value.slice("agent:".length, "agent:".length + 8);
    }
    if (value.startsWith("user:")) {
      return userLabel(value.slice("user:".length)) ?? "User";
    }
    return value;
  };
  const reviewerTrigger = reviewerЗначениеs.length > 0
    ? <span classИмя="text-sm break-words min-w-0">{reviewerЗначениеs.map((value) => executionParticipantLabel(value)).join(", ")}</span>
    : <span classИмя="text-sm text-muted-foreground">Нет</span>;
  const approverTrigger = approverЗначениеs.length > 0
    ? <span classИмя="text-sm break-words min-w-0">{approverЗначениеs.map((value) => executionParticipantLabel(value)).join(", ")}</span>
    : <span classИмя="text-sm text-muted-foreground">Нет</span>;
  const nextЗапуститьnableExecutionStage = (() => {
    if (issue.executionState?.status === "changes_requested" && issue.executionState.currentStageТип) {
      return issue.executionState.currentStageТип;
    }
    if (issue.executionState) return null;
    if (reviewerЗначениеs.length > 0) return "review";
    if (approverЗначениеs.length > 0) return "approval";
    return null;
  })();
  const runExecutionButton = (stageТип: "review" | "approval") => (
    <PropertyRow label="">
      <button
        type="button"
        classИмя="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        onClick={() => onОбновить({ status: "in_review" })}
      >
        {stageТип === "review" ? "Запустить review now" : "Запустить approval now"}
      </button>
    </PropertyRow>
  );
  const currentExecutionLabel = (() => {
    if (!issue.executionState?.currentStageТип) return null;
    const stageLabel = issue.executionState.currentStageТип === "review" ? "Review" : "Согласование";
    const participant = issue.executionState.currentParticipant;
    const participantLabel = participant
      ? (participant.type === "agent"
        ? agentИмя(participant.agentId ?? null)
        : userLabel(participant.userId ?? null))
      : null;
    if (issue.executionState.status === "changes_requested") {
      return `${stageLabel} requested changes${participantLabel ? ` by ${participantLabel}` : ""}`;
    }
    return `${stageLabel} pending${participantLabel ? ` with ${participantLabel}` : ""}`;
  })();
  useEffect(() => {
    setMonitorAtInput(toDateTimeLocalЗначение(issue.executionPolicy?.monitor?.nextCheckAt));
    setMonitorНетtesInput(issue.executionPolicy?.monitor?.notes ?? "");
    setMonitorServiceInput(issue.executionPolicy?.monitor?.serviceИмя ?? "");
  }, [
    issue.executionPolicy?.monitor?.nextCheckAt,
    issue.executionPolicy?.monitor?.notes,
    issue.executionPolicy?.monitor?.serviceИмя,
  ]);

  const updateMonitor = (nextMonitor: Задача["executionPolicy"] extends infer T
    ? T extends { monitor?: infer M | null } | null | undefined
      ? M | null
      : never
    : never) => {
    const basePolicy = buildExecutionPolicy({
      existingPolicy: issue.executionPolicy ?? null,
      reviewerЗначениеs,
      approverЗначениеs,
    });
    if (!basePolicy && !nextMonitor) {
      onОбновить({ executionPolicy: null });
      return;
    }
    onОбновить({
      executionPolicy: {
        mode: basePolicy?.mode ?? issue.executionPolicy?.mode ?? "normal",
        commentОбязательно: true,
        stages: basePolicy?.stages ?? [],
        ...(nextMonitor ? { monitor: nextMonitor } : {}),
      },
    });
  };
  const saveMonitor = () => {
    if (!monitorAtInput) return;
    const nextCheckAt = new Date(monitorAtInput);
    if (Number.isNaN(nextCheckAt.getTime())) return;
    const serviceИмя = monitorServiceInput.trim() || null;
    updateMonitor({
      nextCheckAt: nextCheckAt.toISOString(),
      notes: monitorНетtesInput.trim() || null,
      scheduledBy: "board",
      kind: serviceИмя ? "external_service" : null,
      serviceИмя,
      externalRef: null,
    });
    setMonitorOpen(false);
  };
  const clearMonitor = () => {
    updateMonitor(null);
    setMonitorOpen(false);
  };
  const currentMonitorLabel = (() => {
    if (issue.executionPolicy?.monitor?.nextCheckAt) {
      return `Далее check ${formatDate(new Date(issue.executionPolicy.monitor.nextCheckAt))}`;
    }
    if (issue.executionState?.monitor?.status === "cleared") {
      return "Очиститьed";
    }
    if (issue.monitorLastTriggeredAt) {
      return `Last triggered ${timeAgo(issue.monitorLastTriggeredAt)}`;
    }
    return "Нетt scheduled";
  })();
  const monitorДалееCheckAt = issue.executionPolicy?.monitor?.nextCheckAt ?? null;
  const monitorTrigger = (
    <span classИмя="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {monitorДалееCheckAt ? (
        <Clock classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <span
        classИмя={cn(
          "min-w-0 text-sm break-words",
          monitorДалееCheckAt ? "text-foreground" : "text-muted-foreground",
        )}
        title={monitorДалееCheckAt ? currentMonitorLabel : undefined}
      >
        {monitorДалееCheckAt ? `Далее check ${formatMonitorOffset(monitorДалееCheckAt)}` : currentMonitorLabel}
      </span>
      {monitorДалееCheckAt ? (
        <span classИмя="text-xs text-muted-foreground" title={currentMonitorLabel}>
          {formatDate(new Date(monitorДалееCheckAt))}
        </span>
      ) : null}
    </span>
  );
  const monitorAttemptBadge = issue.monitorAttemptCount && issue.monitorAttemptCount > 0 ? (
    <span classИмя="text-xs text-muted-foreground">
      Attempt {issue.monitorAttemptCount}
    </span>
  ) : null;

  const scheduledПовторить = issue.scheduledПовторить ?? null;
  const retryСейчас = useПовторитьСейчасMutation(issue.id);
  const showРасписаниеdПовторитьRow = scheduledПовторить && scheduledПовторить.status === "scheduled_retry";
  const scheduledПовторитьDueAtIso = scheduledПовторить?.scheduledПовторитьAt
    ? new Date(scheduledПовторить.scheduledПовторитьAt).toISOString()
    : null;
  const scheduledПовторитьRelative = scheduledПовторитьDueAtIso
    ? formatMonitorOffset(scheduledПовторитьDueAtIso)
    : null;
  const scheduledПовторитьAbsolute = scheduledПовторить?.scheduledПовторитьAt
    ? formatDateTime(scheduledПовторить.scheduledПовторитьAt)
    : null;
  const scheduledПовторитьShortDate = scheduledПовторить?.scheduledПовторитьAt
    ? formatDate(new Date(scheduledПовторить.scheduledПовторитьAt))
    : null;
  const scheduledПовторитьReasonLabel = formatПовторитьReason(scheduledПовторить?.scheduledПовторитьReason);
  const scheduledПовторитьAttempt =
    typeof scheduledПовторить?.scheduledПовторитьAttempt === "number"
    && Number.isFinite(scheduledПовторить.scheduledПовторитьAttempt)
    && scheduledПовторить.scheduledПовторитьAttempt > 0
      ? scheduledПовторить.scheduledПовторитьAttempt
      : null;
  const scheduledПовторитьIsContinuation =
    scheduledПовторить?.scheduledПовторитьReason === "max_turns_continuation";
  const scheduledПовторитьRelativeLabel = (() => {
    if (!scheduledПовторитьRelative) return "Ожидание schedule";
    const action = scheduledПовторитьIsContinuation ? "Continuation" : "Повторить";
    if (scheduledПовторитьRelative === "now") return `${action} due now`;
    return `${action} ${scheduledПовторитьRelative}`;
  })();
  const scheduledПовторитьПовторитьСейчасУспешно = retryСейчас.isУспешно
    && (retryСейчас.data?.outcome === "promoted" || retryСейчас.data?.outcome === "already_promoted");
  const scheduledПовторитьAttemptBadge = scheduledПовторитьAttempt !== null ? (
    <span classИмя="text-xs text-muted-foreground">Attempt {scheduledПовторитьAttempt}</span>
  ) : null;
  const scheduledПовторитьTrigger = (
    <span classИмя="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Clock classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
      <span
        classИмя="min-w-0 text-sm break-words text-foreground"
        title={scheduledПовторитьAbsolute ?? undefined}
      >
        {scheduledПовторитьRelativeLabel}
      </span>
      {scheduledПовторитьShortDate ? (
        <span classИмя="text-xs text-muted-foreground" title={scheduledПовторитьAbsolute ?? undefined}>
          {scheduledПовторитьShortDate}
        </span>
      ) : null}
    </span>
  );
  const scheduledПовторитьContent = scheduledПовторить ? (
    <div classИмя="flex w-full flex-col gap-2 p-2 text-xs">
      <div classИмя="flex items-center justify-between">
        <span classИмя="text-sm font-medium text-foreground">
          {scheduledПовторитьIsContinuation ? "Расписаниеd continuation" : "Расписаниеd retry"}
        </span>
        {scheduledПовторитьAttempt !== null ? (
          <span classИмя="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
            Attempt {scheduledПовторитьAttempt}
          </span>
        ) : null}
      </div>
      <dl classИмя="grid grid-cols-[6rem_1fr] gap-y-1">
        {scheduledПовторитьReasonLabel ? (
          <>
            <dt classИмя="text-muted-foreground">Reason</dt>
            <dd classИмя="text-foreground">{scheduledПовторитьReasonLabel}</dd>
          </>
        ) : null}
        {scheduledПовторитьAbsolute ? (
          <>
            <dt classИмя="text-muted-foreground">Далее attempt</dt>
            <dd classИмя="text-foreground">
              {scheduledПовторитьAbsolute}
              {scheduledПовторитьRelative ? (
                <span classИмя="ml-1 text-muted-foreground">· {scheduledПовторитьRelative}</span>
              ) : null}
            </dd>
          </>
        ) : null}
        {scheduledПовторить.retryOfЗапуститьId ? (
          <>
            <dt classИмя="text-muted-foreground">Replaces run</dt>
            <dd classИмя="text-foreground">
              <Link
                to={`/agents/${scheduledПовторить.agentId}/runs/${scheduledПовторить.retryOfЗапуститьId}`}
                classИмя="font-mono text-foreground hover:underline"
              >
                {scheduledПовторить.retryOfЗапуститьId.slice(0, 8)}
              </Link>
            </dd>
          </>
        ) : null}
        {scheduledПовторить.agentИмя ? (
          <>
            <dt classИмя="text-muted-foreground">Агент</dt>
            <dd classИмя="text-foreground">
              <Link
                to={`/agents/${scheduledПовторить.agentId}`}
                classИмя="text-foreground hover:underline"
              >
                {scheduledПовторить.agentИмя}
              </Link>
            </dd>
          </>
        ) : null}
        {scheduledПовторить.error ? (
          <>
            <dt classИмя="text-muted-foreground">Last error</dt>
            <dd classИмя="text-foreground break-words">{scheduledПовторить.error}</dd>
          </>
        ) : null}
      </dl>
      <ПовторитьОшибкаBand
        error={retryСейчас.lastОшибка}
        onПовторить={() => {
          retryСейчас.reset();
          retryСейчас.mutate();
        }}
      />
      <Separator classИмя="my-1" />
      <div classИмя="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => retryСейчас.mutate()}
          disabled={retryСейчас.isОжидание || scheduledПовторитьПовторитьСейчасУспешно}
          data-testid="issue-scheduled-retry-properties-retry-now"
        >
          {retryСейчас.isОжидание ? (
            <span classИмя="inline-flex items-center gap-1.5">
              <Loader2 classИмя="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Повторитьing…
            </span>
          ) : scheduledПовторитьПовторитьСейчасУспешно ? (
            <span classИмя="inline-flex items-center gap-1.5">
              <CheckCircle2 classИмя="h-3.5 w-3.5" aria-hidden="true" />
              {retryСейчас.data?.outcome === "already_promoted" ? "Already promoted" : "Promoted"}
            </span>
          ) : (
            <span classИмя="inline-flex items-center gap-1.5">
              <RotateCcw classИмя="h-3.5 w-3.5" aria-hidden="true" />
              Повторить now
            </span>
          )}
        </Button>
        <span classИмя="text-right text-xs text-muted-foreground">
          {retryСейчас.isОжидание
            ? "Promoting scheduled retry"
            : scheduledПовторитьПовторитьСейчасУспешно
              ? retryСейчас.data?.outcome === "already_promoted"
                ? "Already promoted — run starting"
                : "Promoted — run starting"
              : scheduledПовторитьIsContinuation
                ? "Pulls continuation forward immediately"
                : "Pulls retry forward immediately"}
        </span>
      </div>
    </div>
  ) : null;
  const monitorContent = (
    <div classИмя="flex w-full flex-col gap-2">
      <div classИмя="flex flex-col gap-2 md:flex-row">
        <input
          type="datetime-local"
          classИмя="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
          value={monitorAtInput}
          onChange={(e) => setMonitorAtInput(e.target.value)}
        />
        <input
          type="text"
          classИмя="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs"
          placeholder="What should the agent re-check?"
          value={monitorНетtesInput}
          onChange={(e) => setMonitorНетtesInput(e.target.value)}
        />
      </div>
      <div classИмя="flex flex-col gap-2 md:flex-row">
        <input
          type="text"
          classИмя="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs"
          placeholder="External service"
          value={monitorServiceInput}
          onChange={(e) => setMonitorServiceInput(e.target.value)}
        />
        <div classИмя="flex items-center gap-2">
          <button
            type="button"
            classИмя="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
            disabled={!monitorAtInput}
            onClick={saveMonitor}
          >
            Расписание
          </button>
          {issue.executionPolicy?.monitor ? (
            <button
              type="button"
              classИмя="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              onClick={clearMonitor}
            >
              Очистить
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const selectedЗадачаЯрлыки = useMemo(() => {
    const selectedIds = issue.labelIds ?? [];
    if (selectedIds.length === 0) return issue.labels ?? [];

    const labelById = new Map<string, ЗадачаLabel>();
    for (const label of labels ?? []) labelById.set(label.id, label);
    for (const label of issue.labels ?? []) labelById.set(label.id, label);

    return selectedIds
      .map((id) => labelById.get(id))
      .filter((label): label is ЗадачаLabel => Boolean(label));
  }, [issue.labelIds, issue.labels, labels]);

  const labelsTrigger = selectedЗадачаЯрлыки.length > 0 ? (
    <div classИмя="flex items-center gap-1 flex-wrap">
      {selectedЗадачаЯрлыки.slice(0, 3).map((label) => (
        <span
          key={label.id}
          classИмя="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border"
          style={{
            borderColor: label.color,
            backgroundColor: `${label.color}22`,
            color: pickTextColorForPillBg(label.color, 0.13),
          }}
        >
          {label.name}
        </span>
      ))}
      {selectedЗадачаЯрлыки.length > 3 && (
        <span classИмя="text-xs text-muted-foreground">+{selectedЗадачаЯрлыки.length - 3}</span>
      )}
    </div>
  ) : (
    <>
      <Tag classИмя="h-3.5 w-3.5 text-muted-foreground" />
      <span classИмя="text-sm text-muted-foreground">Нет labels</span>
    </>
  );
  const labelsExtra = (issue.labelIds ?? []).length > 0 ? (
    <button
      type="button"
      classИмя="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
      onClick={() => setЯрлыкиOpen(true)}
      aria-label="Добавить метку"
      title="Добавить метку"
    >
      <Plus classИмя="h-3 w-3" />
    </button>
  ) : undefined;

  const labelsContent = (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder="Поиск labels..."
        value={labelПоиск}
        onChange={(e) => setLabelПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-44 overflow-y-auto overscroll-contain space-y-0.5">
        {(labels ?? [])
          .filter((label) => {
            if (!labelПоиск.trim()) return true;
            return label.name.toНизкийerCase().includes(labelПоиск.toНизкийerCase());
          })
          .map((label) => {
            const selected = (issue.labelIds ?? []).includes(label.id);
            return (
              <button
                key={label.id}
                classИмя={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-left",
                  selected && "bg-accent"
                )}
                onClick={() => toggleLabel(label.id)}
              >
                <span classИмя="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                <span classИмя="truncate flex-1">{label.name}</span>
                {selected && <Check classИмя="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />}
              </button>
            );
          })}
      </div>
      <div classИмя="mt-2 border-t border-border pt-2 space-y-1">
        <div classИмя="flex items-center gap-1">
          <input
            classИмя="h-7 w-7 p-0 rounded bg-transparent"
            type="color"
            value={newLabelColor}
            onChange={(e) => setNewLabelColor(e.target.value)}
          />
          <input
            classИмя="flex-1 px-2 py-1.5 text-xs bg-transparent outline-none rounded placeholder:text-muted-foreground/50"
            placeholder="New label"
            value={newLabelИмя}
            onChange={(e) => setNewLabelИмя(e.target.value)}
          />
        </div>
        <button
          classИмя="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs rounded border border-border hover:bg-accent/50 disabled:opacity-50"
          disabled={!newLabelИмя.trim() || createLabel.isОжидание}
          onClick={() =>
            createLabel.mutate({
              name: newLabelИмя.trim(),
              color: newLabelColor,
            })
          }
        >
          <Plus classИмя="h-3 w-3" />
          {createLabel.isОжидание ? "Creating…" : "Создать label"}
        </button>
      </div>
    </>
  );

  const assigneeTrigger = assignee ? (
    <Identity name={assignee.name} size="sm" />
  ) : assigneeUserLabel ? (
    <>
      <User classИмя="h-3.5 w-3.5 text-muted-foreground" />
      <span classИмя="text-sm">{assigneeUserLabel}</span>
    </>
  ) : (
    <>
      <User classИмя="h-3.5 w-3.5 text-muted-foreground" />
      <span classИмя="text-sm text-muted-foreground">Не назначен</span>
    </>
  );

  const assigneePickerOptions = orderItemsBySelectedAndRecent(
    [
      { id: "", kind: "none" as const, label: "Нет assignee", searchText: "" },
      ...(currentUserId
        ? [{
            id: `user:${currentUserId}`,
            kind: "user" as const,
            userId: currentUserId,
            label: "Назначить мне",
            searchText: userLabel(currentUserId) ?? "",
          }]
        : []),
      ...(issue.createdByUserId && issue.createdByUserId !== currentUserId
        ? [{
            id: `user:${issue.createdByUserId}`,
            kind: "user" as const,
            userId: issue.createdByUserId,
            label: creatorUserLabel ? `Assign to ${creatorUserLabel}` : "Назначить заявителю",
            searchText: creatorUserLabel ?? "requester",
          }]
        : []),
      ...otherUserOptions.map((option) => ({
        id: option.id,
        kind: "user" as const,
        userId: option.id.slice("user:".length),
        label: option.label,
        searchText: option.searchText ?? "",
      })),
      ...sortedАгенты.map((agent) => ({
        id: `agent:${agent.id}`,
        kind: "agent" as const,
        agent,
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    ],
    selectedИсполнительЗначение,
    recentИсполнительЗначениеs,
  );

  const assigneeContent = (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder="Поиск assignees..."
        value={assigneeПоиск}
        onChange={(e) => setИсполнительПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
        {assigneePickerOptions
          .filter((option) => {
            if (!assigneeПоиск.trim()) return true;
            const q = assigneeПоиск.toНизкийerCase();
            return `${option.label} ${option.searchText}`.toНизкийerCase().includes(q);
          })
          .map((option) => (
            <button
              key={option.id || "__none__"}
              classИмя={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                option.id === selectedИсполнительЗначение && "bg-accent",
              )}
              onClick={() => {
                if (option.kind === "agent") {
                  trackRecentИсполнитель(option.agent.id);
                  onОбновить({ assigneeАгентId: option.agent.id, assigneeUserId: null });
                } else if (option.kind === "user") {
                  trackRecentИсполнительUser(option.userId);
                  onОбновить({ assigneeАгентId: null, assigneeUserId: option.userId });
                } else {
                  onОбновить({ assigneeАгентId: null, assigneeUserId: null });
                }
                setИсполнительOpen(false);
              }}
            >
              {option.kind === "agent" ? (
                <АгентIcon icon={option.agent.icon} classИмя="shrink-0 h-3 w-3 text-muted-foreground" />
              ) : option.kind === "user" ? (
                <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : null}
              {option.label}
            </button>
          ))}
      </div>
    </>
  );

  const executionParticipantsContent = (
    stageТип: "review" | "approval",
    values: string[],
    search: string,
    setПоиск: (value: string) => void,
    onОчистить: () => void,
  ) => (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder={`Поиск ${stageТип === "review" ? "reviewers" : "approvers"}...`}
        value={search}
        onChange={(e) => setПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
        <button
          classИмя={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
            values.length === 0 && "bg-accent",
          )}
          onClick={onОчистить}
        >
          Нет {stageТип === "review" ? "reviewers" : "approvers"}
        </button>
        {currentUserId && (
          <button
            classИмя={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
              values.includes(`user:${currentUserId}`) && "bg-accent",
            )}
            onClick={() => toggleExecutionParticipant(stageТип, `user:${currentUserId}`)}
          >
            <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
            Назначить мне
          </button>
        )}
        {issue.createdByUserId && issue.createdByUserId !== currentUserId && (
          <button
            classИмя={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
              values.includes(`user:${issue.createdByUserId}`) && "bg-accent",
            )}
            onClick={() => toggleExecutionParticipant(stageТип, `user:${issue.createdByUserId}`)}
          >
            <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
            {creatorUserLabel ? creatorUserLabel : "Заявитель"}
          </button>
        )}
        {otherUserOptions
          .filter((option) => {
            if (!search.trim()) return true;
            return `${option.label} ${option.searchText ?? ""}`.toНизкийerCase().includes(search.toНизкийerCase());
          })
          .map((option) => (
            <button
              key={`${stageТип}:${option.id}`}
              classИмя={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                values.includes(option.id) && "bg-accent",
              )}
              onClick={() => toggleExecutionParticipant(stageТип, option.id)}
            >
              <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              {option.label}
            </button>
          ))}
        {sortedАгенты
          .filter((agent) => {
            if (!search.trim()) return true;
            return agent.name.toНизкийerCase().includes(search.toНизкийerCase());
          })
          .map((agent) => {
            const encoded = `agent:${agent.id}`;
            return (
              <button
                key={`${stageТип}:${agent.id}`}
                classИмя={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  values.includes(encoded) && "bg-accent",
                )}
                onClick={() => toggleExecutionParticipant(stageТип, encoded)}
              >
                <АгентIcon icon={agent.icon} classИмя="shrink-0 h-3 w-3 text-muted-foreground" />
                {agent.name}
              </button>
            );
          })}
      </div>
    </>
  );

  const projectTrigger = issue.projectId ? (
    <>
      <span
        classИмя="shrink-0 h-3 w-3 rounded-sm"
        style={{ backgroundColor: orderedПроекты.find((p) => p.id === issue.projectId)?.color ?? "#6366f1" }}
      />
      <span classИмя="text-sm break-words min-w-0">{projectИмя(issue.projectId)}</span>
    </>
  ) : (
    <>
      <Hexagon classИмя="h-3.5 w-3.5 text-muted-foreground" />
      <span classИмя="text-sm text-muted-foreground">Нет project</span>
    </>
  );
  const projectPickerOptions = orderItemsBySelectedAndRecent(
    [
      { id: "", kind: "none" as const, name: "Нет project", color: null as string | null },
      ...orderedПроекты.map((project) => ({
        id: project.id,
        kind: "project" as const,
        project,
        name: project.name,
        color: project.color ?? null,
      })),
    ],
    issue.projectId ?? "",
    recentProjectIds,
  );

  const projectContent = (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder="Поиск projects..."
        value={projectПоиск}
        onChange={(e) => setProjectПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
        {projectPickerOptions
          .filter((option) => {
            if (!projectПоиск.trim()) return true;
            const q = projectПоиск.toНизкийerCase();
            return option.name.toНизкийerCase().includes(q);
          })
          .map((option) => (
            <button
              key={option.id || "__none__"}
              classИмя={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 whitespace-nowrap",
                option.id === (issue.projectId ?? "") && "bg-accent",
              )}
              onClick={() => {
                if (option.kind === "project") {
                  const defaultMode = defaultExecutionРабочая областьModeForProject(option.project);
                  trackRecentProject(option.project.id);
                  onОбновить({
                    projectId: option.project.id,
                    projectРабочая областьId: defaultProjectРабочая областьIdForProject(option.project),
                    executionРабочая областьId: null,
                    executionРабочая областьPreference: defaultMode,
                    executionРабочая областьНастройки: option.project.executionРабочая областьPolicy?.enabled
                      ? { mode: defaultMode }
                      : null,
                  });
                } else {
                  onОбновить({
                    projectId: null,
                    projectРабочая областьId: null,
                    executionРабочая областьId: null,
                    executionРабочая областьPreference: null,
                    executionРабочая областьНастройки: null,
                  });
                }
                setProjectOpen(false);
              }}
            >
              {option.kind === "project" ? (
                <span
                  classИмя="shrink-0 h-3 w-3 rounded-sm"
                  style={{ backgroundColor: option.color ?? "#6366f1" }}
                />
              ) : null}
              {option.name}
            </button>
          ))}
      </div>
    </>
  );

  const blockedByIds = issue.blockedBy?.map((relation) => relation.id) ?? [];
  const descendantЗадачаIds = useMemo(() => {
    if (!allЗадачи?.length) return new Set<string>();
    const childrenByРодительId = new Map<string, string[]>();
    for (const candidate of allЗадачи) {
      if (!candidate.parentId) continue;
      const children = childrenByРодительId.get(candidate.parentId) ?? [];
      children.push(candidate.id);
      childrenByРодительId.set(candidate.parentId, children);
    }

    const descendants = new Set<string>();
    const stack = [...(childrenByРодительId.get(issue.id) ?? [])];
    while (stack.length > 0) {
      const candidateId = stack.pop();
      if (!candidateId || descendants.has(candidateId)) continue;
      descendants.add(candidateId);
      stack.push(...(childrenByРодительId.get(candidateId) ?? []));
    }
    return descendants;
  }, [allЗадачи, issue.id]);
  const currentРодительЗадача = useMemo(() => {
    if (!issue.parentId) return null;
    return allЗадачи?.find((candidate) => candidate.id === issue.parentId) ?? null;
  }, [allЗадачи, issue.parentId]);
  const parentIdentifier = issue.ancestors?.[0]?.identifier ?? currentРодительЗадача?.identifier;
  const parentНазвание = issue.ancestors?.[0]?.title ?? currentРодительЗадача?.title ?? issue.parentId?.slice(0, 8);
  const parentTrigger = issue.parentId ? (
    <span classИмя="text-sm break-words min-w-0 inline">
      {parentIdentifier ? `${parentIdentifier} ` : ""}
      {parentНазвание}
    </span>
  ) : (
    <span classИмя="text-sm text-muted-foreground">Нет parent</span>
  );
  const parentLink = issue.parentId ? (
    <Link
      to={`/issues/${parentIdentifier ?? issue.parentId}`}
      classИмя="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      <ArrowUpRight classИмя="h-3 w-3" />
    </Link>
  ) : undefined;
  const parentOptions = (allЗадачи ?? [])
    .filter((candidate) => candidate.id !== issue.id)
    .filter((candidate) => !descendantЗадачаIds.has(candidate.id))
    .filter((candidate) => {
      if (!parentПоиск.trim()) return true;
      const query = parentПоиск.toНизкийerCase();
      return (
        (candidate.identifier ?? "").toНизкийerCase().includes(query) ||
        candidate.title.toНизкийerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aLabel = `${a.identifier ?? ""} ${a.title}`.trim();
      const bLabel = `${b.identifier ?? ""} ${b.title}`.trim();
      return aLabel.localeCompare(bLabel);
    });
  const parentContent = (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder="Поиск issues..."
        value={parentПоиск}
        onChange={(e) => setРодительПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
        <button
          classИмя={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
            !issue.parentId && "bg-accent",
          )}
          onClick={() => {
            onОбновить({ parentId: null });
            setРодительOpen(false);
          }}
        >
          Нет parent
        </button>
        {parentOptions.map((candidate) => (
          <button
            key={candidate.id}
            classИмя={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs rounded hover:bg-accent/50",
              candidate.id === issue.parentId && "bg-accent",
            )}
            onClick={() => {
              onОбновить({ parentId: candidate.id });
              setРодительOpen(false);
            }}
          >
            <СтатусIcon status={candidate.status} />
            <span classИмя="truncate">
              {candidate.identifier ? `${candidate.identifier} ` : ""}
              {candidate.title}
            </span>
          </button>
        ))}
      </div>
    </>
  );
  const blockingЗадачи = issue.blocks ?? [];
  const blockerOptions = (allЗадачи ?? [])
    .filter((candidate) => candidate.id !== issue.id)
    .filter((candidate) => {
      if (!blockedByПоиск.trim()) return true;
      const query = blockedByПоиск.toНизкийerCase();
      return (
        (candidate.identifier ?? "").toНизкийerCase().includes(query) ||
        candidate.title.toНизкийerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aLabel = `${a.identifier ?? ""} ${a.title}`.trim();
      const bLabel = `${b.identifier ?? ""} ${b.title}`.trim();
      return aLabel.localeCompare(bLabel);
    });

  const toggleЗаблокированBy = (blockedByЗадачаId: string) => {
    const nextЗаблокированByIds = blockedByIds.includes(blockedByЗадачаId)
      ? blockedByIds.filter((candidate) => candidate !== blockedByЗадачаId)
      : [...blockedByIds, blockedByЗадачаId];
    onОбновить({ blockedByЗадачаIds: nextЗаблокированByIds });
  };
  const removeЗаблокированBy = (blockedByЗадачаId: string) => {
    onОбновить({ blockedByЗадачаIds: blockedByIds.filter((candidate) => candidate !== blockedByЗадачаId) });
  };

  const blockedByContent = (
    <>
      <input
        classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
        placeholder="Поиск issues..."
        value={blockedByПоиск}
        onChange={(e) => setЗаблокированByПоиск(e.target.value)}
        autoFocus={!inline}
      />
      <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
        <button
          classИмя={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
            blockedByIds.length === 0 && "bg-accent",
          )}
          onClick={() => onОбновить({ blockedByЗадачаIds: [] })}
        >
          Нет blockers
        </button>
        {blockerOptions.map((candidate) => {
          const selected = blockedByIds.includes(candidate.id);
          return (
            <button
              key={candidate.id}
              classИмя={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs rounded hover:bg-accent/50",
                selected && "bg-accent",
              )}
              onClick={() => toggleЗаблокированBy(candidate.id)}
            >
              <СтатусIcon status={candidate.status} />
              <span classИмя="truncate">
                {candidate.identifier ? `${candidate.identifier} ` : ""}
                {candidate.title}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
  const renderДобавитьЗаблокированByButton = (onClick?: () => void) => (
    <button
      type="button"
      classИмя="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
      onClick={onClick}
    >
      <Plus classИмя="h-3 w-3" />
      Добавить blocker
    </button>
  );

  return (
    <div classИмя="space-y-4">
      <div classИмя="space-y-1">
        <PropertyRow label="Статус">
          <СтатусIcon
            status={issue.status}
            blockerAttention={issue.blockerAttention}
            onChange={(status) => onОбновить({ status })}
            showLabel
          />
        </PropertyRow>

        <PropertyRow label="Приоритет">
          <ПриоритетIcon
            priority={issue.priority}
            onChange={(priority) => onОбновить({ priority })}
            showLabel
          />
        </PropertyRow>

        <PropertyPicker
          inline={inline}
          label="Ярлыки"
          open={labelsOpen}
          onOpenChange={(open) => { setЯрлыкиOpen(open); if (!open) setLabelПоиск(""); }}
          triggerContent={labelsTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя="w-64"
          extra={labelsExtra}
        >
          {labelsContent}
        </PropertyPicker>

        <PropertyPicker
          inline={inline}
          label="Исполнитель"
          open={assigneeOpen}
          onOpenChange={(open) => { setИсполнительOpen(open); if (!open) setИсполнительПоиск(""); }}
          triggerContent={assigneeTrigger}
          popoverClassИмя="w-52"
          extra={issue.assigneeАгентId ? (
            <Link
              to={`/agents/${issue.assigneeАгентId}`}
              classИмя="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight classИмя="h-3 w-3" />
            </Link>
          ) : undefined}
        >
          {assigneeContent}
        </PropertyPicker>

        {showИсполнительАдаптерOptions ? (
          <PropertyPicker
            inline={inline}
            label="Модель"
            open={assigneeOptionsOpen}
            onOpenChange={setИсполнительOptionsOpen}
            triggerContent={assigneeOptionsTrigger}
            triggerClassИмя="min-w-0 max-w-full"
            popoverClassИмя={cn("max-w-full", inline ? "w-full" : "w-72")}
            extra={
              <button
                type="button"
                classИмя="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => updateИсполнительАдаптерOverrides(null)}
                aria-label="Очистить adapter options"
                title="Очистить adapter options"
              >
                <X classИмя="h-3 w-3" />
              </button>
            }
          >
            {assigneeOptionsContent}
          </PropertyPicker>
        ) : null}

        <PropertyPicker
          inline={inline}
          label="Project"
          open={projectOpen}
          onOpenChange={(open) => { setProjectOpen(open); if (!open) setProjectПоиск(""); }}
          triggerContent={projectTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя="w-fit min-w-[11rem]"
          extra={issue.projectId ? (
            <Link
              to={projectLink(issue.projectId)!}
              classИмя="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight classИмя="h-3 w-3" />
            </Link>
          ) : undefined}
        >
          {projectContent}
        </PropertyPicker>

        <PropertyPicker
          inline={inline}
          label="Родитель"
          open={parentOpen}
          onOpenChange={(open) => {
            setРодительOpen(open);
            if (!open) setРодительПоиск("");
          }}
          triggerContent={parentTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя="w-72"
          extra={parentLink}
        >
          {parentContent}
        </PropertyPicker>

        {inline ? (
          <div>
            <PropertyRow label="Заблокирован by">
              {(issue.blockedBy ?? []).map((relation) => (
                <RemovableЗадачаReferencePill key={relation.id} issue={relation} onУдалить={removeЗаблокированBy} />
              ))}
              {renderДобавитьЗаблокированByButton(() => setЗаблокированByOpen((open) => !open))}
            </PropertyRow>
            {blockedByOpen && (
              <div classИмя="rounded-md border border-border bg-popover p-1 mb-2">
                {blockedByContent}
              </div>
            )}
          </div>
        ) : (
          <PropertyRow label="Заблокирован by">
            {(issue.blockedBy ?? []).map((relation) => (
              <RemovableЗадачаReferencePill key={relation.id} issue={relation} onУдалить={removeЗаблокированBy} />
            ))}
            <Popover
              open={blockedByOpen}
              onOpenChange={(open) => {
                setЗаблокированByOpen(open);
                if (!open) setЗаблокированByПоиск("");
              }}
            >
              <PopoverTrigger asChild>
                {renderДобавитьЗаблокированByButton()}
              </PopoverTrigger>
              <PopoverContent classИмя="w-72 p-1" align="end" collisionPadding={16}>
                {blockedByContent}
              </PopoverContent>
            </Popover>
          </PropertyRow>
        )}

        <PropertyRow label="Blocking">
          {blockingЗадачи.length > 0 ? (
            <div classИмя="flex flex-wrap gap-1">
              {blockingЗадачи.map((relation) => (
                <ЗадачаReferencePill key={relation.id} issue={relation} />
              ))}
            </div>
          ) : null}
        </PropertyRow>

        <PropertyRow label="Подзадачи">
          <div classИмя="flex flex-wrap items-center gap-1.5">
            {childЗадачи.length > 0
              ? childЗадачи.map((child) => (
                <ЗадачаReferencePill key={child.id} issue={child} />
              ))
              : null}
            {onДобавитьSubЗадача ? (
              <button
                type="button"
                classИмя="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={onДобавитьSubЗадача}
              >
                <Plus classИмя="h-3 w-3" />
              Добавить sub-issue
              </button>
            ) : null}
          </div>
        </PropertyRow>

        {relatedЗадачи.length > 0 ? (
          <PropertyRow label="Related Задачи">
            <div classИмя="flex flex-wrap gap-1">
              {relatedЗадачи.map((related) => (
                <ЗадачаReferencePill key={related.id} issue={related} />
              ))}
            </div>
          </PropertyRow>
        ) : null}

        <PropertyPicker
          inline={inline}
          label="Рецензенты"
          open={reviewersOpen}
          onOpenChange={(open) => { setРецензентыOpen(open); if (!open) setРецензентПоиск(""); }}
          triggerContent={reviewerTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя="w-56"
        >
          {executionParticipantsContent(
            "review",
            reviewerЗначениеs,
            reviewerПоиск,
            setРецензентПоиск,
            () => updateExecutionPolicy([], approverЗначениеs),
          )}
        </PropertyPicker>
        {nextЗапуститьnableExecutionStage === "review" && reviewerЗначениеs.length > 0 ? runExecutionButton("review") : null}

        <PropertyPicker
          inline={inline}
          label="Утверждающие"
          open={approversOpen}
          onOpenChange={(open) => { setУтверждающиеOpen(open); if (!open) setУтверждающийПоиск(""); }}
          triggerContent={approverTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя="w-56"
        >
          {executionParticipantsContent(
            "approval",
            approverЗначениеs,
            approverПоиск,
            setУтверждающийПоиск,
            () => updateExecutionPolicy(reviewerЗначениеs, []),
          )}
        </PropertyPicker>
        {nextЗапуститьnableExecutionStage === "approval" && approverЗначениеs.length > 0 ? runExecutionButton("approval") : null}

        {currentExecutionLabel && (
          <PropertyRow label="Execution">
            <span classИмя="text-sm">{currentExecutionLabel}</span>
          </PropertyRow>
        )}

        {showРасписаниеdПовторитьRow && scheduledПовторитьContent ? (
          <PropertyPicker
            inline={inline}
            label="Расписаниеd retry"
            open={scheduledПовторитьOpen}
            onOpenChange={setРасписаниеdПовторитьOpen}
            triggerContent={scheduledПовторитьTrigger}
            triggerClassИмя="min-w-0 max-w-full"
            popoverClassИмя={cn("max-w-full", inline ? "w-full" : "w-80 sm:w-[32rem]")}
            extra={scheduledПовторитьAttemptBadge}
          >
            {scheduledПовторитьContent}
          </PropertyPicker>
        ) : null}

        <PropertyPicker
          inline={inline}
          label="Monitor"
          open={monitorOpen}
          onOpenChange={setMonitorOpen}
          triggerContent={monitorTrigger}
          triggerClassИмя="min-w-0 max-w-full"
          popoverClassИмя={cn("max-w-full", inline ? "w-full" : "w-80 sm:w-[32rem]")}
          extra={monitorAttemptBadge}
        >
          {monitorContent}
        </PropertyPicker>

        {issue.requestDepth > 0 && (
          <PropertyRow label="Depth">
            <span classИмя="text-sm font-mono">{issue.requestDepth}</span>
          </PropertyRow>
        )}
      </div>

      {liveРабочая областьService || issue.currentExecutionРабочая область?.branchИмя || issue.currentExecutionРабочая область?.cwd || issue.executionРабочая областьId ? (
        <>
          <Separator />
          <div classИмя="space-y-1">
            {liveРабочая областьService?.url && (
              <PropertyRow label="Service">
                <a
                  href={liveРабочая областьService.url}
                  target="_blank"
                  rel="noreferrer"
                  classИмя="inline-flex min-w-0 items-start gap-1 text-sm font-mono text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  <span classИмя="min-w-0 break-all">{liveРабочая областьService.url}</span>
                  <ExternalLink classИмя="mt-1 h-3 w-3 shrink-0" />
                </a>
              </PropertyRow>
            )}
            {showРабочая областьDetailLink && issue.executionРабочая областьId && (
              <PropertyRow label="Рабочая область">
                <Link
                  to={`/execution-workspaces/${issue.executionРабочая областьId}`}
                  classИмя="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  View workspace
                  <ExternalLink classИмя="h-3 w-3" />
                </Link>
              </PropertyRow>
            )}
            {issue.currentExecutionРабочая область?.branchИмя && (
              <PropertyRow label="Ветка">
                <TruncatedКопироватьable
                  value={issue.currentExecutionРабочая область.branchИмя}
                  icon={GitВетка}
                />
              </PropertyRow>
            )}
            {issue.currentExecutionРабочая область?.cwd && (
              <PropertyRow label="Папка">
                <TruncatedКопироватьable
                  value={issue.currentExecutionРабочая область.cwd}
                  icon={ПапкаOpen}
                />
              </PropertyRow>
            )}
          </div>
        </>
      ) : null}

      <Separator />

      <div classИмя="space-y-1">
        {(issue.createdByАгентId || issue.createdByUserId) && (
          <PropertyRow label="Создано by">
            {issue.createdByАгентId ? (
              <Link
                to={`/agents/${issue.createdByАгентId}`}
                classИмя="hover:underline"
              >
                <Identity name={agentИмя(issue.createdByАгентId) ?? issue.createdByАгентId.slice(0, 8)} size="sm" />
              </Link>
            ) : (
              <>
                <User classИмя="h-3.5 w-3.5 text-muted-foreground" />
                <span classИмя="text-sm">{creatorUserLabel ?? "User"}</span>
              </>
            )}
          </PropertyRow>
        )}
        {issue.startedAt && (
          <PropertyRow label="Запущен">
            <span classИмя="text-sm">{formatDateTime(issue.startedAt)}</span>
          </PropertyRow>
        )}
        {issue.completedAt && (
          <PropertyRow label="Завершён">
            <span classИмя="text-sm">{formatDateTime(issue.completedAt)}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Создано">
          <span classИмя="text-sm">{formatDateTime(issue.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Обновлено">
          <span classИмя="text-sm">{timeAgo(issue.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
