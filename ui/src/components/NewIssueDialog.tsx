import { memo, useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ЗадачаРаботаMode } from "@paperclipai/shared";
import { pickTextColorForSolidBg } from "@/lib/color-contrast";
import { useDialog } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { useАдаптерCapabilities } from "../adapters/use-adapter-capabilities";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { issuesApi } from "../api/issues";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { assetsApi } from "../api/assets";
import { buildКомпанияUserInlineOptions, buildMarkdownMentionOptions } from "../lib/company-members";
import { queryКлючs } from "../lib/queryКлючs";
import { orderReusableExecutionРабочие области } from "../lib/reusable-execution-workspaces";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { getRecentИсполнительIds, sortАгентыByRecency, trackRecentИсполнитель } from "../lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { buildExecutionPolicy } from "../lib/issue-execution-policy";
import { useToastActions } from "../context/ToastContext";
import {
  assigneeЗначениеFromSelection,
  currentUserИсполнительOption,
  parseИсполнительЗначение,
} from "../lib/assignees";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Hammer,
  Minus,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Tag,
  Calendar,
  Paperclip,
  FileText,
  Flag,
  Loader2,
  ListTree,
  X,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { extractПровайдерIdWithFallback } from "../lib/model-utils";
import { issueСтатусText, issueСтатусTextПо умолчанию, priorityColor, priorityColorПо умолчанию } from "../lib/status-colors";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "./MarkdownИзменитьor";
import { АгентIcon } from "./АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "./InlineEntitySelector";

const DRAFT_KEY = "paperclip:issue-draft";
const DEBOUNCE_MS = 800;


interface ЗадачаЧерновик {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeЗначение: string;
  reviewerЗначение: string;
  approverЗначение: string;
  assigneeId?: string;
  projectId: string;
  projectРабочая областьId?: string;
  assigneeМодельLane?: ЗадачаМодельLane;
  assigneeМодельOverride: string;
  assigneeThinkingEffort: string;
  assigneeChrome: boolean;
  executionРабочая областьMode?: string;
  selectedExecutionРабочая областьId?: string;
  useIsolatedExecutionРабочая область?: boolean;
  workMode?: ЗадачаРаботаMode;
}

type StagedЗадачаFile = {
  id: string;
  file: File;
  kind: "document" | "attachment";
  documentКлюч?: string;
  title?: string | null;
};

import {
  buildИсполнительАдаптерOverrides,
  ISSUE_OVERRIDE_ADAPTER_TYPES,
  type ЗадачаМодельLane,
} from "../lib/issue-assignee-overrides";

const STAGED_FILE_ACCEPT = "image/*,application/pdf,text/plain,text/markdown,application/json,text/csv,text/html,.md,.markdown";

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

function isЗадачаРаботаMode(value: unknown): value is ЗадачаРаботаMode {
  return value === "standard" || value === "planning";
}

const ISSUE_WORK_MODE_OPTIONS: ReadonlyArray<{
  value: ЗадачаРаботаMode;
  label: string;
  icon: typeof Hammer;
}> = [
  { value: "standard", label: "Standard", icon: Hammer },
  { value: "planning", label: "Planning", icon: ClipboardList },
];

function loadЧерновик(): ЗадачаЧерновик | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ЗадачаЧерновик;
  } catch {
    return null;
  }
}

function saveЧерновик(draft: ЗадачаЧерновик) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearЧерновик() {
  localStorage.removeItem(DRAFT_KEY);
}

function isTextDocumentFile(file: File) {
  const name = file.name.toНизкийerCase();
  return (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".txt") ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
}

function fileBaseИмя(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function slugifyDocumentКлюч(input: string) {
  const slug = input
    .trim()
    .toНизкийerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}

function titleizeFilename(input: string) {
  return input
    .split(/[-_ ]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createUniqueDocumentКлюч(baseКлюч: string, stagedФайлы: StagedЗадачаFile[]) {
  const existingКлючs = new Set(
    stagedФайлы
      .filter((file) => file.kind === "document")
      .map((file) => file.documentКлюч)
      .filter((key): key is string => Boolean(key)),
  );
  if (!existingКлючs.has(baseКлюч)) return baseКлюч;
  let suffix = 2;
  while (existingКлючs.has(`${baseКлюч}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseКлюч}-${suffix}`;
}

function formatFileSize(file: File) {
  if (file.size < 1024) return `${file.size} B`;
  if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
  return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}

const statuses: ReadonlyArray<{ value: string; label: string; color: string; description?: string }> = [
  {
    value: "backlog",
    label: "Назадlog",
    color: issueСтатусText.backlog ?? issueСтатусTextПо умолчанию,
    description: "Parked — assignee will not be woken",
  },
  {
    value: "todo",
    label: "Todo",
    color: issueСтатусText.todo ?? issueСтатусTextПо умолчанию,
    description: "Executable — assignee will be woken",
  },
  { value: "in_progress", label: "In Progress", color: issueСтатусText.in_progress ?? issueСтатусTextПо умолчанию },
  { value: "in_review", label: "In Review", color: issueСтатусText.in_review ?? issueСтатусTextПо умолчанию },
  { value: "done", label: "Готово", color: issueСтатусText.done ?? issueСтатусTextПо умолчанию },
];

const priorities = [
  { value: "critical", label: "Критично", icon: AlertTriangle, color: priorityColor.critical ?? priorityColorПо умолчанию },
  { value: "high", label: "Высокий", icon: ArrowUp, color: priorityColor.high ?? priorityColorПо умолчанию },
  { value: "medium", label: "Средний", icon: Minus, color: priorityColor.medium ?? priorityColorПо умолчанию },
  { value: "low", label: "Низкий", icon: ArrowDown, color: priorityColor.low ?? priorityColorПо умолчанию },
];

const EXECUTION_WORKSPACE_MODES = [
  { value: "shared_workspace", label: "По умолчанию проекта" },
  { value: "isolated_workspace", label: "New isolated workspace" },
  { value: "reuse_existing", label: "Reuse existing workspace" },
] as const;

function defaultProjectРабочая областьIdForProject(project: { workspaces?: Array<{ id: string; isPrimary: boolean }>; executionРабочая областьPolicy?: { defaultProjectРабочая областьId?: string | null } | null } | null | undefined) {
  if (!project) return "";
  return project.executionРабочая областьPolicy?.defaultProjectРабочая областьId
    ?? project.workspaces?.find((workspace) => workspace.isPrimary)?.id
    ?? project.workspaces?.[0]?.id
    ?? "";
}

function defaultExecutionРабочая областьModeForProject(project: { executionРабочая областьPolicy?: { enabled?: boolean; defaultMode?: string | null } | null } | null | undefined) {
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

function defaultExecutionРабочая областьModeForЗадачаПо умолчаниюs(
  defaults: {
    executionРабочая областьId?: unknown;
    executionРабочая областьMode?: unknown;
  },
  project: { executionРабочая областьPolicy?: { enabled?: boolean; defaultMode?: string | null } | null } | null | undefined,
) {
  if (typeof defaults.executionРабочая областьId === "string" && defaults.executionРабочая областьId.length > 0) {
    return "reuse_existing";
  }
  return typeof defaults.executionРабочая областьMode === "string" && defaults.executionРабочая областьMode.length > 0
    ? defaults.executionРабочая областьMode
    : defaultExecutionРабочая областьModeForProject(project);
}

const ЗадачаНазваниеTextarea = memo(function ЗадачаНазваниеTextarea({
  value,
  pending,
  assigneeЗначение,
  projectId,
  descriptionИзменитьorRef,
  assigneeSelectorRef,
  projectSelectorRef,
  onChange,
}: {
  value: string;
  pending: boolean;
  assigneeЗначение: string;
  projectId: string;
  descriptionИзменитьorRef: RefObject<MarkdownИзменитьorRef | null>;
  assigneeSelectorRef: RefObject<HTMLButtonElement | null>;
  projectSelectorRef: RefObject<HTMLButtonElement | null>;
  onChange: (value: string) => void;
}) {
  const [draftЗначение, setЧерновикЗначение] = useState(value);

  useEffect(() => {
    setЧерновикЗначение(value);
  }, [value]);

  return (
    <textarea
      classИмя="w-full text-lg font-semibold bg-transparent outline-none resize-none overflow-hidden placeholder:text-muted-foreground/50"
      placeholder="Задача title"
      rows={1}
      value={draftЗначение}
      onChange={(e) => {
        const nextЗначение = e.target.value;
        setЧерновикЗначение(nextЗначение);
        onChange(nextЗначение);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      readOnly={pending}
      onКлючDown={(e) => {
        if (
          e.key === "Enter" &&
          !e.metaКлюч &&
          !e.ctrlКлюч &&
          !e.nativeEvent.isComposing
        ) {
          e.preventПо умолчанию();
          descriptionИзменитьorRef.current?.focus();
        }
        if (e.key === "Tab" && !e.shiftКлюч) {
          e.preventПо умолчанию();
          if (assigneeЗначение) {
            if (projectId) {
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
  );
});

const ЗадачаОписаниеИзменитьor = memo(function ЗадачаОписаниеИзменитьor({
  value,
  expanded,
  mentions,
  descriptionИзменитьorRef,
  imageЗагрузитьHandler,
  onChange,
}: {
  value: string;
  expanded: boolean;
  mentions: MentionOption[];
  descriptionИзменитьorRef: RefObject<MarkdownИзменитьorRef | null>;
  imageЗагрузитьHandler: (file: File) => Promise<string>;
  onChange: (value: string) => void;
}) {
  const [draftЗначение, setЧерновикЗначение] = useState(value);

  useEffect(() => {
    setЧерновикЗначение(value);
  }, [value]);

  return (
    <MarkdownИзменитьor
      ref={descriptionИзменитьorRef}
      value={draftЗначение}
      onChange={(nextЗначение) => {
        setЧерновикЗначение(nextЗначение);
        onChange(nextЗначение);
      }}
      placeholder="Добавить description..."
      bordered={false}
      mentions={mentions}
      contentClassИмя={cn("text-sm text-muted-foreground pb-12", expanded ? "min-h-[220px]" : "min-h-[120px]")}
      imageЗагрузитьHandler={imageЗагрузитьHandler}
    />
  );
});

function issueExecutionРабочая областьModeForExistingРабочая область(mode: string | null | undefined) {
  if (mode === "isolated_workspace" || mode === "operator_branch" || mode === "shared_workspace") {
    return mode;
  }
  if (mode === "adapter_managed" || mode === "cloud_sandbox") {
    return "agent_default";
  }
  return "shared_workspace";
}

export function NewЗадачаDialog() {
  const { newЗадачаOpen, newЗадачаПо умолчаниюs, closeNewЗадача } = useDialog();
  const { companies, selectedКомпанияId, selectedКомпания } = useКомпания();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [title, setНазвание] = useState("");
  const [description, setОписание] = useState("");
  const titleRef = useRef("");
  const descriptionRef = useRef("");
  const [titleHasText, setНазваниеHasText] = useState(false);
  const [draftHasText, setЧерновикHasText] = useState(false);
  const [status, setСтатус] = useState("todo");
  const [priority, setПриоритет] = useState("");
  const [assigneeЗначение, setИсполнительЗначение] = useState("");
  const [reviewerЗначение, setРецензентЗначение] = useState("");
  const [approverЗначение, setУтверждающийЗначение] = useState("");
  const [showРецензентRow, setShowРецензентRow] = useState(false);
  const [showУтверждающийRow, setShowУтверждающийRow] = useState(false);
  const [participantMenuOpen, setParticipantMenuOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [projectРабочая областьId, setProjectРабочая областьId] = useState("");
  const [assigneeOptionsOpen, setИсполнительOptionsOpen] = useState(false);
  const [assigneeМодельLane, setИсполнительМодельLane] = useState<ЗадачаМодельLane>("primary");
  const [assigneeМодельOverride, setИсполнительМодельOverride] = useState("");
  const [assigneeThinkingEffort, setИсполнительThinkingEffort] = useState("");
  const [assigneeChrome, setИсполнительChrome] = useState(false);
  const [executionРабочая областьMode, setExecutionРабочая областьMode] = useState<string>("shared_workspace");
  const [selectedExecutionРабочая областьId, setSelectedExecutionРабочая областьId] = useState("");
  const [workMode, setРаботаMode] = useState<ЗадачаРаботаMode>("standard");
  const [expanded, setExpanded] = useState(false);
  const [dialogКомпанияId, setDialogКомпанияId] = useState<string | null>(null);
  const [stagedФайлы, setStagedФайлы] = useState<StagedЗадачаFile[]>([]);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const draftTimer = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const executionРабочая областьПо умолчаниюProjectId = useRef<string | null>(null);
  const initializationКлючRef = useRef<string | null>(null);

  const effectiveКомпанияId = dialogКомпанияId ?? selectedКомпанияId;
  const dialogКомпания = companies.find((c) => c.id === effectiveКомпанияId) ?? selectedКомпания;
  const isSubЗадачаMode = Boolean(newЗадачаПо умолчаниюs.parentId);
  const parentЗадачаLabel = newЗадачаПо умолчаниюs.parentIdentifier
    ?? (newЗадачаПо умолчаниюs.parentId ? newЗадачаПо умолчаниюs.parentId.slice(0, 8) : "");
  const parentExecutionРабочая областьId = newЗадачаПо умолчаниюs.executionРабочая областьId ?? "";
  const parentExecutionРабочая областьLabel = newЗадачаПо умолчаниюs.parentExecutionРабочая областьLabel ?? parentExecutionРабочая областьId;

  // Popover states
  const [statusOpen, setСтатусOpen] = useState(false);
  const [priorityOpen, setПриоритетOpen] = useState(false);
  const [workModeOpen, setРаботаModeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [companyOpen, setКомпанияOpen] = useState(false);
  const descriptionИзменитьorRef = useRef<MarkdownИзменитьorRef>(null);
  const stageFileInputRef = useRef<HTMLInputElement | null>(null);
  const assigneeSelectorRef = useRef<HTMLButtonElement | null>(null);
  const projectSelectorRef = useRef<HTMLButtonElement | null>(null);

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(effectiveКомпанияId!),
    queryFn: () => agentsApi.list(effectiveКомпанияId!),
    enabled: !!effectiveКомпанияId && newЗадачаOpen,
  });

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(effectiveКомпанияId!),
    queryFn: () => projectsApi.list(effectiveКомпанияId!),
    enabled: !!effectiveКомпанияId && newЗадачаOpen,
  });
  const { data: reusableExecutionРабочие области } = useQuery({
    queryКлюч: queryКлючs.executionРабочие области.list(effectiveКомпанияId!, {
      projectId,
      projectРабочая областьId: projectРабочая областьId || undefined,
      reuseEligible: true,
    }),
    queryFn: () =>
      executionРабочие областиApi.list(effectiveКомпанияId!, {
        projectId,
        projectРабочая областьId: projectРабочая областьId || undefined,
        reuseEligible: true,
      }),
    enabled: Boolean(effectiveКомпанияId) && newЗадачаOpen && Boolean(projectId),
  });
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(effectiveКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(effectiveКомпанияId!),
    enabled: Boolean(effectiveКомпанияId) && newЗадачаOpen,
  });
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    enabled: newЗадачаOpen,
    retry: false,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const activeПроекты = useMemo(
    () => (projects ?? []).filter((p) => !p.archivedAt),
    [projects],
  );
  const { orderedПроекты } = useProjectOrder({
    projects: activeПроекты,
    companyId: effectiveКомпанияId,
    userId: currentUserId,
  });

  const selectedИсполнитель = useMemo(() => parseИсполнительЗначение(assigneeЗначение), [assigneeЗначение]);
  const selectedИсполнительАгентId = selectedИсполнитель.assigneeАгентId;
  const selectedИсполнительUserId = selectedИсполнитель.assigneeUserId;

  const assigneeАдаптерТип = (agents ?? []).find((agent) => agent.id === selectedИсполнительАгентId)?.adapterТип ?? null;
  const supportsИсполнительOverrides = Boolean(
    assigneeАдаптерТип && ISSUE_OVERRIDE_ADAPTER_TYPES.has(assigneeАдаптерТип),
  );
  const getАдаптерCapabilities = useАдаптерCapabilities();
  const assigneeАдаптерCapabilities = assigneeАдаптерТип
    ? getАдаптерCapabilities(assigneeАдаптерТип)
    : null;
  const assigneeSupportsCheapLane = Boolean(
    supportsИсполнительOverrides && assigneeАдаптерCapabilities?.supportsМодельПрофильs,
  );

  const { data: assigneeCheapПрофильs } = useQuery({
    queryКлюч: effectiveКомпанияId && assigneeАдаптерТип
      ? queryКлючs.agents.adapterМодельПрофильs(effectiveКомпанияId, assigneeАдаптерТип)
      : ["agents", "none", "adapter-model-profiles", assigneeАдаптерТип ?? "none"],
    queryFn: () => agentsApi.adapterМодельПрофильs(effectiveКомпанияId!, assigneeАдаптерТип!),
    enabled: Boolean(effectiveКомпанияId) && newЗадачаOpen && assigneeSupportsCheapLane,
  });
  const assigneeCheapПрофиль = useMemo(
    () => (assigneeCheapПрофильs ?? []).find((profile) => profile.key === "cheap") ?? null,
    [assigneeCheapПрофильs],
  );
  const mentionOptions = useMemo<MentionOption[]>(() => {
    return buildMarkdownMentionOptions({
      agents,
      projects: orderedПроекты,
      members: companyMembers?.users,
    });
  }, [agents, companyMembers?.users, orderedПроекты]);

  const { data: assigneeАдаптерМодельs } = useQuery({
    queryКлюч:
      effectiveКомпанияId && assigneeАдаптерТип
        ? queryКлючs.agents.adapterМодельs(effectiveКомпанияId, assigneeАдаптерТип)
        : ["agents", "none", "adapter-models", assigneeАдаптерТип ?? "none"],
    queryFn: () => agentsApi.adapterМодельs(effectiveКомпанияId!, assigneeАдаптерТип!),
    enabled: Boolean(effectiveКомпанияId) && newЗадачаOpen && supportsИсполнительOverrides,
  });

  const createЗадача = useMutation({
    mutationFn: async ({
      companyId,
      stagedФайлы: pendingStagedФайлы,
      ...data
    }: { companyId: string; stagedФайлы: StagedЗадачаFile[] } & Record<string, unknown>) => {
      const issue = await issuesApi.create(companyId, data);
      const failures: string[] = [];

      for (const stagedFile of pendingStagedФайлы) {
        try {
          if (stagedFile.kind === "document") {
            const body = await stagedFile.file.text();
            await issuesApi.upsertDocument(issue.id, stagedFile.documentКлюч ?? "document", {
              title: stagedFile.documentКлюч === "plan" ? null : stagedFile.title ?? null,
              format: "markdown",
              body,
              baseRevisionId: null,
            });
          } else {
            await issuesApi.uploadAttachment(companyId, issue.id, stagedFile.file);
          }
        } catch {
          failures.push(stagedFile.file.name);
        }
      }

      return { issue, companyId, failures };
    },
    onУспешно: ({ issue, companyId, failures }) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listMineByMe(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listUnreadTouchedByMe(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(companyId) });
      if (draftTimer.current) clearTimeout(draftTimer.current);
      if (failures.length > 0) {
        const prefix = (companies.find((company) => company.id === companyId)?.issuePrefix ?? "").trim();
        const issueRef = issue.identifier ?? issue.id;
        pushToast({
          title: `Создано ${issueRef} with upload warnings`,
          body: `${failures.length} staged ${failures.length === 1 ? "file" : "files"} could not be added.`,
          tone: "warn",
          action: prefix
            ? { label: `Open ${issueRef}`, href: `/${prefix}/issues/${issueRef}` }
            : undefined,
        });
      }
      clearЧерновик();
      reset();
      closeNewЗадача();
    },
  });

  const uploadОписаниеImage = useMutation({
    mutationFn: async (file: File) => {
      if (!effectiveКомпанияId) throw new Ошибка("Нет company selected");
      return assetsApi.uploadImage(effectiveКомпанияId, file, "issues/drafts");
    },
  });
  const uploadОписаниеImageHandler = useCallback(async (file: File) => {
    const asset = await uploadОписаниеImage.mutateAsync(file);
    return asset.contentПуть;
  }, [uploadОписаниеImage.mutateAsync]);

  // Debounced draft saving
  const scheduleСохранить = useCallback(
    (draft: ЗадачаЧерновик) => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        if (draft.title.trim()) saveЧерновик(draft);
      }, DEBOUNCE_MS);
    },
    [],
  );

  const setЗадачаText = useCallback((nextНазвание: string, nextОписание: string) => {
    titleRef.current = nextНазвание;
    descriptionRef.current = nextОписание;
    setНазвание(nextНазвание);
    setОписание(nextОписание);
    setНазваниеHasText(nextНазвание.trim().length > 0);
    setЧерновикHasText(nextНазвание.trim().length > 0 || nextОписание.trim().length > 0);
  }, []);

  const queueЧерновикСохранить = useCallback((overrides: { title?: string; description?: string } = {}) => {
    if (!newЗадачаOpen) return;
    const nextНазвание = overrides.title ?? titleRef.current;
    const nextОписание = overrides.description ?? descriptionRef.current;
    scheduleСохранить({
      title: nextНазвание,
      description: nextОписание,
      status,
      priority,
      assigneeЗначение,
      reviewerЗначение,
      approverЗначение,
      projectId,
      projectРабочая областьId,
      assigneeМодельLane,
      assigneeМодельOverride,
      assigneeThinkingEffort,
      assigneeChrome,
      executionРабочая областьMode,
      selectedExecutionРабочая областьId,
      workMode,
    });
  }, [
    newЗадачаOpen,
    scheduleСохранить,
    status,
    priority,
    assigneeЗначение,
    reviewerЗначение,
    approverЗначение,
    projectId,
    projectРабочая областьId,
    assigneeМодельOverride,
    assigneeThinkingEffort,
    assigneeChrome,
    executionРабочая областьMode,
    selectedExecutionРабочая областьId,
    workMode,
  ]);

  const handleНазваниеChange = useCallback((nextНазвание: string) => {
    titleRef.current = nextНазвание;
    const nextНазваниеHasText = nextНазвание.trim().length > 0;
    const nextЧерновикHasText = nextНазваниеHasText || descriptionRef.current.trim().length > 0;
    setНазваниеHasText((current) => current === nextНазваниеHasText ? current : nextНазваниеHasText);
    setЧерновикHasText((current) => current === nextЧерновикHasText ? current : nextЧерновикHasText);
    queueЧерновикСохранить({ title: nextНазвание });
  }, [queueЧерновикСохранить]);

  const handleОписаниеChange = useCallback((nextОписание: string) => {
    descriptionRef.current = nextОписание;
    const nextЧерновикHasText = titleRef.current.trim().length > 0 || nextОписание.trim().length > 0;
    setЧерновикHasText((current) => current === nextЧерновикHasText ? current : nextЧерновикHasText);
    queueЧерновикСохранить({ description: nextОписание });
  }, [queueЧерновикСохранить]);

  // Сохранить draft on meaningful changes
  useEffect(() => {
    if (!newЗадачаOpen) return;
    queueЧерновикСохранить();
  }, [
    status,
    priority,
    assigneeЗначение,
    reviewerЗначение,
    approverЗначение,
    projectId,
    projectРабочая областьId,
    assigneeМодельLane,
    assigneeМодельOverride,
    assigneeThinkingEffort,
    assigneeChrome,
    executionРабочая областьMode,
    selectedExecutionРабочая областьId,
    workMode,
    newЗадачаOpen,
    queueЧерновикСохранить,
  ]);

  // Restore draft or apply defaults when dialog opens
  useEffect(() => {
    if (!newЗадачаOpen) {
      initializationКлючRef.current = null;
      return;
    }
    const initializationКлюч = `${selectedКомпанияId ?? ""}:${JSON.stringify(newЗадачаПо умолчаниюs)}`;
    if (initializationКлючRef.current === initializationКлюч) return;
    initializationКлючRef.current = initializationКлюч;
    setDialogКомпанияId(selectedКомпанияId);
    executionРабочая областьПо умолчаниюProjectId.current = null;

    const draft = loadЧерновик();
    if (newЗадачаПо умолчаниюs.parentId) {
      const nextРаботаMode = isЗадачаРаботаMode(newЗадачаПо умолчаниюs.workMode) ? newЗадачаПо умолчаниюs.workMode : "standard";
      const defaultProjectId = newЗадачаПо умолчаниюs.projectId ?? "";
      const defaultProject = orderedПроекты.find((project) => project.id === defaultProjectId);
      const hasExplicitProjectРабочая областьId = newЗадачаПо умолчаниюs.projectРабочая областьId !== undefined;
      const defaultProjectРабочая областьId = newЗадачаПо умолчаниюs.projectРабочая областьId
        ?? defaultProjectРабочая областьIdForProject(defaultProject);
      const defaultExecutionРабочая областьMode = defaultExecutionРабочая областьModeForЗадачаПо умолчаниюs(newЗадачаПо умолчаниюs, defaultProject);
      setЗадачаText(newЗадачаПо умолчаниюs.title ?? "", newЗадачаПо умолчаниюs.description ?? "");
      setСтатус(newЗадачаПо умолчаниюs.status ?? "todo");
      setПриоритет(newЗадачаПо умолчаниюs.priority ?? "");
      setProjectId(defaultProjectId);
      setProjectРабочая областьId(defaultProjectРабочая областьId);
      setИсполнительЗначение(assigneeЗначениеFromSelection(newЗадачаПо умолчаниюs));
      setИсполнительМодельLane("primary");
      setИсполнительМодельOverride("");
      setИсполнительThinkingEffort("");
      setИсполнительChrome(false);
      setExecutionРабочая областьMode(defaultExecutionРабочая областьMode);
      setРаботаMode(nextРаботаMode);
      setSelectedExecutionРабочая областьId(newЗадачаПо умолчаниюs.executionРабочая областьId ?? "");
      executionРабочая областьПо умолчаниюProjectId.current = hasExplicitProjectРабочая областьId || defaultProject
        ? defaultProjectId || null
        : null;
    } else if (newЗадачаПо умолчаниюs.title) {
      const nextРаботаMode = isЗадачаРаботаMode(newЗадачаПо умолчаниюs.workMode) ? newЗадачаПо умолчаниюs.workMode : "standard";
      setЗадачаText(newЗадачаПо умолчаниюs.title, newЗадачаПо умолчаниюs.description ?? "");
      setСтатус(newЗадачаПо умолчаниюs.status ?? "todo");
      setПриоритет(newЗадачаПо умолчаниюs.priority ?? "");
      const defaultProjectId = newЗадачаПо умолчаниюs.projectId ?? "";
      const defaultProject = orderedПроекты.find((project) => project.id === defaultProjectId);
      const hasExplicitProjectРабочая областьId = newЗадачаПо умолчаниюs.projectРабочая областьId !== undefined;
      setProjectId(defaultProjectId);
      setProjectРабочая областьId(newЗадачаПо умолчаниюs.projectРабочая областьId ?? defaultProjectРабочая областьIdForProject(defaultProject));
      setИсполнительЗначение(assigneeЗначениеFromSelection(newЗадачаПо умолчаниюs));
      setРецензентЗначение("");
      setУтверждающийЗначение("");
      setShowРецензентRow(false);
      setShowУтверждающийRow(false);
      setИсполнительМодельOverride("");
      setИсполнительThinkingEffort("");
      setИсполнительChrome(false);
      setExecutionРабочая областьMode(defaultExecutionРабочая областьModeForЗадачаПо умолчаниюs(newЗадачаПо умолчаниюs, defaultProject));
      setРаботаMode(nextРаботаMode);
      setSelectedExecutionРабочая областьId(newЗадачаПо умолчаниюs.executionРабочая областьId ?? "");
      executionРабочая областьПо умолчаниюProjectId.current = hasExplicitProjectРабочая областьId || newЗадачаПо умолчаниюs.executionРабочая областьId || defaultProject
        ? defaultProjectId || null
        : null;
    } else if (draft && draft.title.trim()) {
      const nextРаботаMode = isЗадачаРаботаMode(draft.workMode) ? draft.workMode : "standard";
      const restoredProjectId = newЗадачаПо умолчаниюs.projectId ?? draft.projectId;
      const restoredProject = orderedПроекты.find((project) => project.id === restoredProjectId);
      const hasExplicitProjectРабочая областьId = newЗадачаПо умолчаниюs.projectРабочая областьId !== undefined;
      const hasExplicitExecutionРабочая областьId = newЗадачаПо умолчаниюs.executionРабочая областьId !== undefined;
      const hasExplicitExecutionРабочая областьMode = newЗадачаПо умолчаниюs.executionРабочая областьMode !== undefined;
      setЗадачаText(draft.title, draft.description);
      setСтатус(draft.status || "todo");
      setПриоритет(draft.priority);
      setИсполнительЗначение(
        newЗадачаПо умолчаниюs.assigneeАгентId || newЗадачаПо умолчаниюs.assigneeUserId
          ? assigneeЗначениеFromSelection(newЗадачаПо умолчаниюs)
          : (draft.assigneeЗначение ?? draft.assigneeId ?? ""),
      );
      setРецензентЗначение(draft.reviewerЗначение ?? "");
      setУтверждающийЗначение(draft.approverЗначение ?? "");
      setShowРецензентRow(!!(draft.reviewerЗначение));
      setShowУтверждающийRow(!!(draft.approverЗначение));
      setProjectId(restoredProjectId);
      setProjectРабочая областьId(
        hasExplicitProjectРабочая областьId
          ? (newЗадачаПо умолчаниюs.projectРабочая областьId ?? "")
          : (draft.projectРабочая областьId ?? defaultProjectРабочая областьIdForProject(restoredProject)),
      );
      setИсполнительМодельLane(draft.assigneeМодельLane ?? "primary");
      setИсполнительМодельOverride(draft.assigneeМодельOverride ?? "");
      setИсполнительThinkingEffort(draft.assigneeThinkingEffort ?? "");
      setИсполнительChrome(draft.assigneeChrome ?? false);
      setExecutionРабочая областьMode(
        hasExplicitExecutionРабочая областьId || hasExplicitExecutionРабочая областьMode
          ? defaultExecutionРабочая областьModeForЗадачаПо умолчаниюs(newЗадачаПо умолчаниюs, restoredProject)
          : (
              draft.executionРабочая областьMode
              ?? (draft.useIsolatedExecutionРабочая область ? "isolated_workspace" : defaultExecutionРабочая областьModeForProject(restoredProject))
            ),
      );
      setРаботаMode(nextРаботаMode);
      setSelectedExecutionРабочая областьId(
        hasExplicitExecutionРабочая областьId
          ? (newЗадачаПо умолчаниюs.executionРабочая областьId ?? "")
          : (draft.selectedExecutionРабочая областьId ?? ""),
      );
      executionРабочая областьПо умолчаниюProjectId.current = hasExplicitProjectРабочая областьId || hasExplicitExecutionРабочая областьId || draft.projectРабочая областьId || restoredProject
        ? restoredProjectId || null
        : null;
    } else {
      setРаботаMode("standard");
      const defaultProjectId = newЗадачаПо умолчаниюs.projectId ?? "";
      const defaultProject = orderedПроекты.find((project) => project.id === defaultProjectId);
      const hasExplicitProjectРабочая областьId = newЗадачаПо умолчаниюs.projectРабочая областьId !== undefined;
      setЗадачаText("", "");
      setСтатус(newЗадачаПо умолчаниюs.status ?? "todo");
      setПриоритет(newЗадачаПо умолчаниюs.priority ?? "");
      setProjectId(defaultProjectId);
      setProjectРабочая областьId(newЗадачаПо умолчаниюs.projectРабочая областьId ?? defaultProjectРабочая областьIdForProject(defaultProject));
      setИсполнительЗначение(assigneeЗначениеFromSelection(newЗадачаПо умолчаниюs));
      setРецензентЗначение("");
      setУтверждающийЗначение("");
      setShowРецензентRow(false);
      setShowУтверждающийRow(false);
      setИсполнительМодельOverride("");
      setИсполнительThinkingEffort("");
      setИсполнительChrome(false);
      setExecutionРабочая областьMode(defaultExecutionРабочая областьModeForЗадачаПо умолчаниюs(newЗадачаПо умолчаниюs, defaultProject));
      setSelectedExecutionРабочая областьId(newЗадачаПо умолчаниюs.executionРабочая областьId ?? "");
      executionРабочая областьПо умолчаниюProjectId.current = hasExplicitProjectРабочая областьId || newЗадачаПо умолчаниюs.executionРабочая областьId || defaultProject
        ? defaultProjectId || null
        : null;
    }
  }, [newЗадачаOpen, newЗадачаПо умолчаниюs, orderedПроекты, selectedКомпанияId, setЗадачаText]);

  useEffect(() => {
    if (!supportsИсполнительOverrides) {
      setИсполнительOptionsOpen(false);
      setИсполнительМодельLane("primary");
      setИсполнительМодельOverride("");
      setИсполнительThinkingEffort("");
      setИсполнительChrome(false);
      return;
    }
    if (!assigneeSupportsCheapLane && assigneeМодельLane === "cheap") {
      setИсполнительМодельLane("primary");
    }

    const validThinkingЗначениеs =
      assigneeАдаптерТип === "codex_local"
        ? ISSUE_THINKING_EFFORT_OPTIONS.codex_local
        : assigneeАдаптерТип === "opencode_local"
          ? ISSUE_THINKING_EFFORT_OPTIONS.opencode_local
          : ISSUE_THINKING_EFFORT_OPTIONS.claude_local;
    if (!validThinkingЗначениеs.some((option) => option.value === assigneeThinkingEffort)) {
      setИсполнительThinkingEffort("");
    }
  }, [
    supportsИсполнительOverrides,
    assigneeАдаптерТип,
    assigneeThinkingEffort,
    assigneeSupportsCheapLane,
    assigneeМодельLane,
  ]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, []);

  function reset() {
    setЗадачаText("", "");
    setСтатус("todo");
    setПриоритет("");
    setИсполнительЗначение("");
    setРецензентЗначение("");
    setУтверждающийЗначение("");
    setShowРецензентRow(false);
    setShowУтверждающийRow(false);
    setProjectId("");
    setProjectРабочая областьId("");
    setИсполнительOptionsOpen(false);
    setИсполнительМодельLane("primary");
    setИсполнительМодельOverride("");
    setИсполнительThinkingEffort("");
    setИсполнительChrome(false);
    setExecutionРабочая областьMode("shared_workspace");
    setSelectedExecutionРабочая областьId("");
    setРаботаMode("standard");
    setExpanded(false);
    setDialogКомпанияId(null);
    setStagedФайлы([]);
    setIsFileDragOver(false);
    setКомпанияOpen(false);
    executionРабочая областьПо умолчаниюProjectId.current = null;
    initializationКлючRef.current = null;
  }

  function handleКомпанияChange(companyId: string) {
    if (isSubЗадачаMode) return;
    if (companyId === effectiveКомпанияId) return;
    setDialogКомпанияId(companyId);
    setИсполнительЗначение("");
    setРецензентЗначение("");
    setУтверждающийЗначение("");
    setShowРецензентRow(false);
    setShowУтверждающийRow(false);
    setProjectId("");
    setProjectРабочая областьId("");
    setИсполнительМодельLane("primary");
    setИсполнительМодельOverride("");
    setИсполнительThinkingEffort("");
    setИсполнительChrome(false);
    setExecutionРабочая областьMode("shared_workspace");
    setSelectedExecutionРабочая областьId("");
    setРаботаMode("standard");
  }

  function discardЧерновик() {
    clearЧерновик();
    reset();
    closeNewЗадача();
  }

  function handleОтправить() {
    const currentНазвание = titleRef.current.trim();
    const currentОписание = descriptionRef.current.trim();
    if (!effectiveКомпанияId || !currentНазвание || createЗадача.isОжидание) return;
    const effectiveLane = assigneeSupportsCheapLane
      ? assigneeМодельLane
      : assigneeМодельLane === "cheap"
        ? "primary"
        : assigneeМодельLane;
    const assigneeАдаптерOverrides = buildИсполнительАдаптерOverrides({
      adapterТип: assigneeАдаптерТип,
      lane: effectiveLane,
      modelOverride: assigneeМодельOverride,
      thinkingEffortOverride: assigneeThinkingEffort,
      chrome: assigneeChrome,
    });
    const selectedProject = orderedПроекты.find((project) => project.id === projectId);
    const executionРабочая областьPolicy =
      experimentalНастройки?.enableIsolatedРабочие области === true
        ? selectedProject?.executionРабочая областьPolicy ?? null
        : null;
    const selectedReusableExecutionРабочая область = deduplicatedReusableРабочие области.find(
      (workspace) => workspace.id === selectedExecutionРабочая областьId,
    );
    const requestedExecutionРабочая областьMode =
      executionРабочая областьMode === "reuse_existing"
        ? issueExecutionРабочая областьModeForExistingРабочая область(selectedReusableExecutionРабочая область?.mode)
        : executionРабочая областьMode;
    const executionРабочая областьНастройки = executionРабочая областьPolicy?.enabled
      ? { mode: requestedExecutionРабочая областьMode }
      : null;
    const executionPolicy = buildExecutionPolicy({
      reviewerЗначениеs: reviewerЗначение ? [reviewerЗначение] : [],
      approverЗначениеs: approverЗначение ? [approverЗначение] : [],
    });
    createЗадача.mutate({
      companyId: effectiveКомпанияId,
      stagedФайлы,
      title: currentНазвание,
      description: currentОписание || undefined,
      status,
      priority: priority || "medium",
      workMode,
      ...(selectedИсполнительАгентId ? { assigneeАгентId: selectedИсполнительАгентId } : {}),
      ...(selectedИсполнительUserId ? { assigneeUserId: selectedИсполнительUserId } : {}),
      ...(newЗадачаПо умолчаниюs.parentId ? { parentId: newЗадачаПо умолчаниюs.parentId } : {}),
      ...(newЗадачаПо умолчаниюs.goalId ? { goalId: newЗадачаПо умолчаниюs.goalId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(projectРабочая областьId ? { projectРабочая областьId } : {}),
      ...(assigneeАдаптерOverrides ? { assigneeАдаптерOverrides } : {}),
      ...(executionРабочая областьPolicy?.enabled ? { executionРабочая областьPreference: executionРабочая областьMode } : {}),
      ...(executionРабочая областьMode === "reuse_existing" && selectedExecutionРабочая областьId
        ? { executionРабочая областьId: selectedExecutionРабочая областьId }
        : {}),
      ...(executionРабочая областьНастройки ? { executionРабочая областьНастройки } : {}),
      ...(executionPolicy ? { executionPolicy } : {}),
    });
  }

  function handleКлючDown(e: React.КлючboardEvent) {
    if (e.key === "Enter" && (e.metaКлюч || e.ctrlКлюч)) {
      e.preventПо умолчанию();
      handleОтправить();
    }
  }

  function stageФайлы(files: File[]) {
    if (files.length === 0) return;
    setStagedФайлы((current) => {
      const next = [...current];
      for (const file of files) {
        if (isTextDocumentFile(file)) {
          const baseИмя = fileBaseИмя(file.name);
          const documentКлюч = createUniqueDocumentКлюч(slugifyDocumentКлюч(baseИмя), next);
          next.push({
            id: `${file.name}:${file.size}:${file.lastModified}:${documentКлюч}`,
            file,
            kind: "document",
            documentКлюч,
            title: titleizeFilename(baseИмя),
          });
          continue;
        }
        next.push({
          id: `${file.name}:${file.size}:${file.lastModified}`,
          file,
          kind: "attachment",
        });
      }
      return next;
    });
  }

  function handleStageФайлыPicked(evt: ChangeEvent<HTMLInputElement>) {
    stageФайлы(Array.from(evt.target.files ?? []));
    if (stageFileInputRef.current) {
      stageFileInputRef.current.value = "";
    }
  }

  function handleFileDragEnter(evt: DragEvent<HTMLDivElement>) {
    if (!evt.dataTransfer.types.includes("Файлы")) return;
    evt.preventПо умолчанию();
    setIsFileDragOver(true);
  }

  function handleFileDragOver(evt: DragEvent<HTMLDivElement>) {
    if (!evt.dataTransfer.types.includes("Файлы")) return;
    evt.preventПо умолчанию();
    evt.dataTransfer.dropEffect = "copy";
    setIsFileDragOver(true);
  }

  function handleFileDragLeave(evt: DragEvent<HTMLDivElement>) {
    if (evt.currentЦель.contains(evt.relatedЦель as Нетde | null)) return;
    setIsFileDragOver(false);
  }

  function handleFileDrop(evt: DragEvent<HTMLDivElement>) {
    if (!evt.dataTransfer.files.length) return;
    evt.preventПо умолчанию();
    setIsFileDragOver(false);
    stageФайлы(Array.from(evt.dataTransfer.files));
  }

  function removeStagedFile(id: string) {
    setStagedФайлы((current) => current.filter((file) => file.id !== id));
  }

  const hasЧерновик = draftHasText || stagedФайлы.length > 0;
  const currentСтатус = statuses.find((s) => s.value === status) ?? statuses[1]!;
  const currentПриоритет = priorities.find((p) => p.value === priority);
  const currentИсполнитель = selectedИсполнительАгентId
    ? (agents ?? []).find((a) => a.id === selectedИсполнительАгентId)
    : null;
  const currentProject = orderedПроекты.find((project) => project.id === projectId);
  const currentProjectExecutionРабочая областьPolicy =
    experimentalНастройки?.enableIsolatedРабочие области === true
      ? currentProject?.executionРабочая областьPolicy ?? null
      : null;
  const currentProjectSupportsExecutionРабочая область = Boolean(currentProjectExecutionРабочая областьPolicy?.enabled);
  const deduplicatedReusableРабочие области = useMemo(() => {
    return orderReusableExecutionРабочие области(reusableExecutionРабочие области ?? []);
  }, [reusableExecutionРабочие области]);
  const selectedReusableExecutionРабочая область = deduplicatedReusableРабочие области.find(
    (workspace) => workspace.id === selectedExecutionРабочая областьId,
  );
  const isUsingРодительExecutionРабочая область = isSubЗадачаMode && parentExecutionРабочая областьId
    ? executionРабочая областьMode === "reuse_existing" && selectedExecutionРабочая областьId === parentExecutionРабочая областьId
    : false;
  const showРодительРабочая областьПредупреждение = isSubЗадачаMode
    && currentProjectSupportsExecutionРабочая область
    && Boolean(parentExecutionРабочая областьId)
    && !isUsingРодительExecutionРабочая область;
  const assigneeOptionsНазвание =
    assigneeАдаптерТип === "claude_local"
      ? "Claude options"
      : assigneeАдаптерТип === "codex_local"
        ? "Codex options"
        : assigneeАдаптерТип === "opencode_local"
          ? "OpenCode options"
        : "Параметры агента";
  const thinkingEffortOptions =
    assigneeАдаптерТип === "codex_local"
      ? ISSUE_THINKING_EFFORT_OPTIONS.codex_local
      : assigneeАдаптерТип === "opencode_local"
        ? ISSUE_THINKING_EFFORT_OPTIONS.opencode_local
      : ISSUE_THINKING_EFFORT_OPTIONS.claude_local;
  const recentИсполнительIds = useMemo(() => getRecentИсполнительIds(), [newЗадачаOpen]);
  const recentИсполнительOptionIds = useMemo(
    () => recentИсполнительIds.map((id) => assigneeЗначениеFromSelection({ assigneeАгентId: id })),
    [recentИсполнительIds],
  );
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [newЗадачаOpen]);
  const assigneeOptions = useMemo<InlineEntityOption[]>(
    () => [
      ...currentUserИсполнительOption(currentUserId),
      ...buildКомпанияUserInlineOptions(companyMembers?.users, { excludeUserIds: [currentUserId] }),
      ...sortАгентыByRecency(
        (agents ?? []).filter((agent) => agent.status !== "terminated"),
        recentИсполнительIds,
      ).map((agent) => ({
        id: assigneeЗначениеFromSelection({ assigneeАгентId: agent.id }),
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    ],
    [agents, companyMembers?.users, currentUserId, recentИсполнительIds],
  );
  const projectOptions = useMemo<InlineEntityOption[]>(
    () =>
      orderedПроекты.map((project) => ({
        id: project.id,
        label: project.name,
        searchText: project.description ?? "",
      })),
    [orderedПроекты],
  );
  const savedЧерновик = useMemo(() => newЗадачаOpen ? loadЧерновик() : null, [newЗадачаOpen]);
  const hasСохранитьdЧерновик = Boolean(savedЧерновик?.title.trim() || savedЧерновик?.description.trim());
  const canDiscardЧерновик = hasЧерновик || hasСохранитьdЧерновик;
  const createЗадачаОшибкаMessage =
    createЗадача.error instanceof Ошибка ? createЗадача.error.message : "Ошибка to create issue. Попробовать снова.";
  const stagedДокументы = stagedФайлы.filter((file) => file.kind === "document");
  const stagedAttachments = stagedФайлы.filter((file) => file.kind === "attachment");

  const handleProjectChange = useCallback((nextProjectId: string) => {
    if (nextProjectId) trackRecentProject(nextProjectId);
    setProjectId(nextProjectId);
    const nextProject = orderedПроекты.find((project) => project.id === nextProjectId);
    executionРабочая областьПо умолчаниюProjectId.current = nextProjectId || null;
    setProjectРабочая областьId(defaultProjectРабочая областьIdForProject(nextProject));
    setExecutionРабочая областьMode(defaultExecutionРабочая областьModeForProject(nextProject));
    setSelectedExecutionРабочая областьId("");
  }, [orderedПроекты]);

  useEffect(() => {
    if (
      !newЗадачаOpen ||
      !projectId ||
      selectedExecutionРабочая областьId ||
      executionРабочая областьПо умолчаниюProjectId.current === projectId
    ) {
      return;
    }
    const project = orderedПроекты.find((entry) => entry.id === projectId);
    if (!project) return;
    executionРабочая областьПо умолчаниюProjectId.current = projectId;
    setProjectРабочая областьId(defaultProjectРабочая областьIdForProject(project));
    setExecutionРабочая областьMode(defaultExecutionРабочая областьModeForProject(project));
    setSelectedExecutionРабочая областьId("");
  }, [newЗадачаOpen, orderedПроекты, projectId, selectedExecutionРабочая областьId]);
  const modelOverrideOptions = useMemo<InlineEntityOption[]>(
    () => {
      return [...(assigneeАдаптерМодельs ?? [])]
        .sort((a, b) => {
          const providerA = extractПровайдерIdWithFallback(a.id);
          const providerB = extractПровайдерIdWithFallback(b.id);
          const byПровайдер = providerA.localeCompare(providerB);
          if (byПровайдер !== 0) return byПровайдер;
          return a.id.localeCompare(b.id);
        })
        .map((model) => ({
          id: model.id,
          label: model.label,
          searchText: `${model.id} ${extractПровайдерIdWithFallback(model.id)}`,
        }));
    },
    [assigneeАдаптерМодельs],
  );
  const currentРаботаMode = ISSUE_WORK_MODE_OPTIONS[workMode === "planning" ? 1 : 0]!;
  const CurrentРаботаModeIcon = currentРаботаMode.icon;

  return (
    <Dialog
      open={newЗадачаOpen}
      onOpenChange={(open) => {
        if (!open && !createЗадача.isОжидание) closeNewЗадача();
      }}
    >
      <DialogContent
        showЗакрытьButton={false}
        aria-describedby={undefined}
        classИмя={cn(
          "flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:h-auto",
          expanded
            ? "sm:max-w-2xl sm:h-[calc(100dvh-2rem)]"
            : "sm:max-w-lg"
        )}
        onКлючDown={handleКлючDown}
        onEscapeКлючDown={(event) => {
          if (createЗадача.isОжидание) {
            event.preventПо умолчанию();
          }
        }}
        onPointerDownOutside={(event) => {
          if (createЗадача.isОжидание) {
            event.preventПо умолчанию();
            return;
          }
          // Radix Dialog's modal ЗакрытьableLayer calls preventПо умолчанию() on
          // pointerdown events that originate outside the Dialog DOM tree.
          // Popover portals render at the body level (outside the Dialog), so
          // touch events on popover content get their default prevented — which
          // kills scroll gesture recognition on mobile.  Telling Radix "this
          // event is handled" skips that preventПо умолчанию, restoring touch scroll.
          const target = event.detail.originalEvent.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            event.preventПо умолчанию();
          }
        }}
      >
        {/* Header bar */}
        <div classИмя="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div classИмя="flex items-center gap-2 text-sm text-muted-foreground">
            <Popover open={companyOpen} onOpenChange={setКомпанияOpen}>
              <PopoverTrigger asChild>
                <button
                  classИмя={cn(
                    "px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity",
                    !dialogКомпания?.brandColor && "bg-muted",
                  )}
                  disabled={isSubЗадачаMode}
                  style={
                    dialogКомпания?.brandColor
                      ? {
                          backgroundColor: dialogКомпания.brandColor,
                          color: pickTextColorForSolidBg(dialogКомпания.brandColor),
                        }
                      : undefined
                  }
                >
                  {(dialogКомпания?.name ?? "").slice(0, 3).toUpperCase()}
                </button>
              </PopoverTrigger>
              <PopoverContent classИмя="w-48 p-1" align="start">
                {companies.filter((c) => c.status !== "archived").map((c) => (
                  <button
                    key={c.id}
                    classИмя={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      c.id === effectiveКомпанияId && "bg-accent",
                    )}
                    onClick={() => {
                      handleКомпанияChange(c.id);
                      setКомпанияOpen(false);
                    }}
                  >
                    <span
                      classИмя={cn(
                        "px-1 py-0.5 rounded text-[10px] font-semibold leading-none",
                        !c.brandColor && "bg-muted",
                      )}
                      style={
                        c.brandColor
                          ? {
                              backgroundColor: c.brandColor,
                              color: pickTextColorForSolidBg(c.brandColor),
                            }
                          : undefined
                      }
                    >
                      {c.name.slice(0, 3).toUpperCase()}
                    </span>
                    <span classИмя="truncate">{c.name}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <span classИмя="text-muted-foreground/60">&rsaquo;</span>
            <span>{isSubЗадачаMode ? "New sub-issue" : "Новая задача"}</span>
          </div>
          <div classИмя="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              classИмя="text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
              disabled={createЗадача.isОжидание}
            >
              {expanded ? <Minimize2 classИмя="h-3.5 w-3.5" /> : <Maximize2 classИмя="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              classИмя="text-muted-foreground"
              onClick={() => closeNewЗадача()}
              disabled={createЗадача.isОжидание}
            >
              <span classИмя="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        <div classИмя="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Название */}
          <div classИмя="px-4 pt-4 pb-2">
            <ЗадачаНазваниеTextarea
              value={title}
              pending={createЗадача.isОжидание}
              assigneeЗначение={assigneeЗначение}
              projectId={projectId}
              descriptionИзменитьorRef={descriptionИзменитьorRef}
              assigneeSelectorRef={assigneeSelectorRef}
              projectSelectorRef={projectSelectorRef}
              onChange={handleНазваниеChange}
            />
          </div>

          <div classИмя="px-4 pb-2">
            <div classИмя="overflow-x-auto overscroll-x-contain">
              <div classИмя="inline-flex items-center gap-2 text-sm text-muted-foreground flex-wrap sm:flex-nowrap sm:min-w-max">
              <span classИмя="w-6 shrink-0 text-center">For</span>
              <InlineEntitySelector
                ref={assigneeSelectorRef}
                value={assigneeЗначение}
                options={assigneeOptions}
                recentOptionIds={recentИсполнительOptionIds}
                placeholder="Исполнитель"
                disableПортal
                noneLabel="Нет assignee"
                searchPlaceholder="Поиск assignees..."
                emptyMessage="Нет assignees found."
                onChange={(value) => {
                  const nextИсполнитель = parseИсполнительЗначение(value);
                  if (nextИсполнитель.assigneeАгентId) {
                    trackRecentИсполнитель(nextИсполнитель.assigneeАгентId);
                  }
                  setИсполнительЗначение(value);
                  const hasИсполнитель = Boolean(nextИсполнитель.assigneeАгентId || nextИсполнитель.assigneeUserId);
                  if (hasИсполнитель && status === "backlog") {
                    setСтатус("todo");
                  }
                }}
                onПодтвердить={() => {
                  if (projectId) {
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
                  const assignee = parseИсполнительЗначение(option.id).assigneeАгентId
                    ? (agents ?? []).find((agent) => agent.id === parseИсполнительЗначение(option.id).assigneeАгентId)
                    : null;
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
                value={projectId}
                options={projectOptions}
                recentOptionIds={recentProjectIds}
                placeholder="Project"
                disableПортal
                noneLabel="Нет project"
                searchPlaceholder="Поиск projects..."
                emptyMessage="Проекты не найдены."
                onChange={handleProjectChange}
                onПодтвердить={() => {
                  descriptionИзменитьorRef.current?.focus();
                }}
                renderTriggerЗначение={(option) =>
                  option && currentProject ? (
                    <>
                      <span
                        classИмя="h-3.5 w-3.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: currentProject.color ?? "#6366f1" }}
                      />
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  ) : (
                    <span classИмя="text-muted-foreground">Project</span>
                  )
                }
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const project = orderedПроекты.find((item) => item.id === option.id);
                  return (
                    <>
                      <span
                        classИмя="h-3.5 w-3.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: project?.color ?? "#6366f1" }}
                      />
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
              />

              {/* Three-dot menu to add Рецензент / Утверждающий rows */}
              <Popover open={participantMenuOpen} onOpenChange={setParticipantMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    classИмя="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent/50 transition-colors"
                    title="Добавить reviewer or approver"
                  >
                    <MoreHorizontal classИмя="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent classИмя="w-44 p-1" align="start">
                  <button
                    classИмя={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      showРецензентRow && "bg-accent",
                    )}
                    onClick={() => {
                      setShowРецензентRow((v) => !v);
                      if (showРецензентRow) setРецензентЗначение("");
                      setParticipantMenuOpen(false);
                    }}
                  >
                    <Eye classИмя="h-3 w-3" />
                    Рецензент
                  </button>
                  <button
                    classИмя={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      showУтверждающийRow && "bg-accent",
                    )}
                    onClick={() => {
                      setShowУтверждающийRow((v) => !v);
                      if (showУтверждающийRow) setУтверждающийЗначение("");
                      setParticipantMenuOpen(false);
                    }}
                  >
                    <ShieldCheck classИмя="h-3 w-3" />
                    Утверждающий
                  </button>
                </PopoverContent>
              </Popover>
              </div>
            </div>

            {/* Рецензент row */}
            {showРецензентRow && (
              <div classИмя="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span classИмя="w-6 shrink-0 flex items-center justify-center"><Eye classИмя="h-3.5 w-3.5" /></span>
                <InlineEntitySelector
                value={reviewerЗначение}
                options={assigneeOptions}
                recentOptionIds={recentИсполнительOptionIds}
                placeholder="Рецензент"
                disableПортal
                noneLabel="Нет reviewer"
                searchPlaceholder="Поиск reviewers..."
                emptyMessage="Нет reviewers found."
                onChange={setРецензентЗначение}
                renderTriggerЗначение={(option) =>
                  option ? (
                    <>
                      {(() => {
                        const reviewer = parseИсполнительЗначение(option.id).assigneeАгентId
                          ? (agents ?? []).find((a) => a.id === parseИсполнительЗначение(option.id).assigneeАгентId)
                          : null;
                        return reviewer ? <АгентIcon icon={reviewer.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null;
                      })()}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  ) : (
                    <span classИмя="text-muted-foreground">Рецензент</span>
                  )
                }
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const reviewer = parseИсполнительЗначение(option.id).assigneeАгентId
                    ? (agents ?? []).find((agent) => agent.id === parseИсполнительЗначение(option.id).assigneeАгентId)
                    : null;
                  return (
                    <>
                      {reviewer ? <АгентIcon icon={reviewer.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
                />
              </div>
            )}

            {/* Утверждающий row */}
            {showУтверждающийRow && (
              <div classИмя="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span classИмя="w-6 shrink-0 flex items-center justify-center"><ShieldCheck classИмя="h-3.5 w-3.5" /></span>
                <InlineEntitySelector
                value={approverЗначение}
                options={assigneeOptions}
                recentOptionIds={recentИсполнительOptionIds}
                placeholder="Утверждающий"
                disableПортal
                noneLabel="Нет approver"
                searchPlaceholder="Поиск approvers..."
                emptyMessage="Нет approvers found."
                onChange={setУтверждающийЗначение}
                renderTriggerЗначение={(option) =>
                  option ? (
                    <>
                      {(() => {
                        const approver = parseИсполнительЗначение(option.id).assigneeАгентId
                          ? (agents ?? []).find((a) => a.id === parseИсполнительЗначение(option.id).assigneeАгентId)
                          : null;
                        return approver ? <АгентIcon icon={approver.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null;
                      })()}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  ) : (
                    <span classИмя="text-muted-foreground">Утверждающий</span>
                  )
                }
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const approver = parseИсполнительЗначение(option.id).assigneeАгентId
                    ? (agents ?? []).find((agent) => agent.id === parseИсполнительЗначение(option.id).assigneeАгентId)
                    : null;
                  return (
                    <>
                      {approver ? <АгентIcon icon={approver.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
                />
              </div>
            )}
          </div>

          {isSubЗадачаMode ? (
            <div classИмя="px-4 pb-2">
            <div classИмя="max-w-full rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
              <div classИмя="flex items-center gap-1.5">
                <ListTree classИмя="h-3.5 w-3.5 shrink-0" />
                <span classИмя="shrink-0">Подзадача of</span>
                <span classИмя="font-medium text-foreground">{parentЗадачаLabel}</span>
              </div>
              {newЗадачаПо умолчаниюs.parentНазвание ? (
                <div classИмя="pl-5 text-foreground/80 truncate">
                  {newЗадачаПо умолчаниюs.parentНазвание}
                </div>
              ) : null}
            </div>
            </div>
          ) : null}

          {currentProject && currentProjectSupportsExecutionРабочая область && (
            <div classИмя="px-4 py-3 space-y-2">
            <div classИмя="space-y-1.5">
              <div classИмя="text-xs font-medium">Execution workspace</div>
              <div classИмя="text-[11px] text-muted-foreground">
                Control whether this issue runs in the shared workspace, a new isolated workspace, or an existing one.
              </div>
              <select
                classИмя="w-full rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
                value={executionРабочая областьMode}
                onChange={(e) => {
                  setExecutionРабочая областьMode(e.target.value);
                  if (e.target.value !== "reuse_existing") {
                    setSelectedExecutionРабочая областьId("");
                  }
                }}
              >
                {EXECUTION_WORKSPACE_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {executionРабочая областьMode === "reuse_existing" && (
                <select
                  classИмя="w-full rounded border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
                  value={selectedExecutionРабочая областьId}
                  onChange={(e) => setSelectedExecutionРабочая областьId(e.target.value)}
                >
                  <option value="">Choose an existing workspace</option>
                  {deduplicatedReusableРабочие области.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name} · {workspace.status} · {workspace.branchИмя ?? workspace.cwd ?? workspace.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
              {executionРабочая областьMode === "reuse_existing" && selectedReusableExecutionРабочая область && (
                <div classИмя="text-[11px] text-muted-foreground">
                  Reusing {selectedReusableExecutionРабочая область.name} from {selectedReusableExecutionРабочая область.branchИмя ?? selectedReusableExecutionРабочая область.cwd ?? "existing execution workspace"}.
                </div>
              )}
              {showРодительРабочая областьПредупреждение ? (
                <div classИмя="rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
                  Предупреждение: this sub-issue will no longer use the parent issue workspace{parentExecutionРабочая областьLabel ? ` (${parentExecutionРабочая областьLabel})` : ""}.
                </div>
              ) : null}
            </div>
            </div>
          )}

          {supportsИсполнительOverrides && (
            <div classИмя="px-4 pb-2">
            <button
              classИмя="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setИсполнительOptionsOpen((open) => !open)}
            >
              {assigneeOptionsOpen ? <ChevronDown classИмя="h-3 w-3" /> : <ChevronRight classИмя="h-3 w-3" />}
              {assigneeOptionsНазвание}
            </button>
            {assigneeOptionsOpen && (
              <div classИмя="mt-2 rounded-md border border-border p-3 bg-muted/20 space-y-3">
                <div classИмя="space-y-1.5">
                  <div classИмя="text-xs text-muted-foreground">Модель lane</div>
                  <div
                    classИмя="flex w-full overflow-hidden rounded-md border border-border"
                    role="radiogroup"
                    aria-label="Модель lane"
                  >
                    {(["primary", ...(assigneeSupportsCheapLane ? (["cheap"] as const) : ([] as const)), "custom"] as const).map((lane) => (
                      <button
                        key={lane}
                        type="button"
                        role="radio"
                        aria-checked={assigneeМодельLane === lane}
                        classИмя={cn(
                          "flex-1 px-2 py-1 text-xs capitalize transition-colors hover:bg-accent/40",
                          assigneeМодельLane === lane && "bg-accent text-foreground",
                        )}
                        onClick={() => setИсполнительМодельLane(lane)}
                      >
                        {lane === "primary"
                          ? "Primary"
                          : lane === "cheap"
                            ? "Cheap"
                            : "Свой"}
                      </button>
                    ))}
                  </div>
                  {assigneeМодельLane === "cheap" && (
                    <p classИмя="text-[11px] text-muted-foreground">
                      Отправитьs <code>modelПрофиль: "cheap"</code>{" "}
                      {assigneeCheapПрофиль?.adapterConfig && typeof (assigneeCheapПрофиль.adapterConfig as Record<string, unknown>).model === "string"
                        ? <>· adapter default <code>{String((assigneeCheapПрофиль.adapterConfig as Record<string, unknown>).model)}</code></>
                        : assigneeCheapПрофиль
                          ? <>· uses the agent's configured cheap profile</>
                          : <>· falls back to the primary model if no cheap profile is configured</>}
                    </p>
                  )}
                  {assigneeМодельLane === "primary" && (
                    <p classИмя="text-[11px] text-muted-foreground">Запуститьs on the agent's primary model.</p>
                  )}
                  {assigneeМодельLane === "custom" && (
                    <p classИмя="text-[11px] text-muted-foreground">Override the model and effort for this issue only.</p>
                  )}
                </div>
                {assigneeМодельLane === "custom" && (
                  <div classИмя="space-y-1.5">
                    <div classИмя="text-xs text-muted-foreground">Модель</div>
                    <InlineEntitySelector
                      value={assigneeМодельOverride}
                      options={modelOverrideOptions}
                      placeholder="По умолчанию model"
                      disableПортal
                      noneLabel="По умолчанию model"
                      searchPlaceholder="Поиск models..."
                      emptyMessage="Нет models found."
                      onChange={setИсполнительМодельOverride}
                    />
                  </div>
                )}
                {assigneeМодельLane === "custom" && (
                  <div classИмя="space-y-1.5">
                    <div classИмя="text-xs text-muted-foreground">Thinking effort</div>
                    <div classИмя="flex items-center gap-1.5 flex-wrap">
                      {thinkingEffortOptions.map((option) => (
                        <button
                          key={option.value || "default"}
                          classИмя={cn(
                            "px-2 py-1 rounded-md text-xs border border-border hover:bg-accent/50 transition-colors",
                            assigneeThinkingEffort === option.value && "bg-accent"
                          )}
                          onClick={() => setИсполнительThinkingEffort(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {assigneeАдаптерТип === "claude_local" && assigneeМодельLane === "custom" && (
                  <div classИмя="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                    <div classИмя="text-xs text-muted-foreground">Включить Chrome (--chrome)</div>
                    <ToggleSwitch
                      checked={assigneeChrome}
                      onCheckedChange={() => setИсполнительChrome((value) => !value)}
                    />
                  </div>
                )}
              </div>
            )}
            </div>
          )}

          {/* Описание */}
          <div
            classИмя="border-t border-border/60 px-4 pb-2 pt-3"
            onDragEnter={handleFileDragEnter}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
            <div
              classИмя={cn(
                "rounded-md transition-colors",
                isFileDragOver && "bg-accent/20",
              )}
            >
              <ЗадачаОписаниеИзменитьor
                value={description}
                expanded={expanded}
                mentions={mentionOptions}
                descriptionИзменитьorRef={descriptionИзменитьorRef}
                imageЗагрузитьHandler={uploadОписаниеImageHandler}
                onChange={handleОписаниеChange}
              />
            </div>
            {stagedФайлы.length > 0 ? (
              <div classИмя="mt-4 space-y-3 rounded-lg border border-border/70 p-3">
              {stagedДокументы.length > 0 ? (
                <div classИмя="space-y-2">
                  <div classИмя="text-xs font-medium text-muted-foreground">Документы</div>
                  <div classИмя="space-y-2">
                    {stagedДокументы.map((file) => (
                      <div key={file.id} classИмя="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                        <div classИмя="min-w-0">
                          <div classИмя="flex items-center gap-2">
                            <span classИмя="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              {file.documentКлюч}
                            </span>
                            <span classИмя="truncate text-sm">{file.file.name}</span>
                          </div>
                          <div classИмя="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <FileText classИмя="h-3.5 w-3.5" />
                            <span>{file.title || file.file.name}</span>
                            <span>•</span>
                            <span>{formatFileSize(file.file)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          classИмя="shrink-0 text-muted-foreground"
                          onClick={() => removeStagedFile(file.id)}
                          disabled={createЗадача.isОжидание}
                          title="Удалить document"
                        >
                          <X classИмя="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {stagedAttachments.length > 0 ? (
                <div classИмя="space-y-2">
                  <div classИмя="text-xs font-medium text-muted-foreground">Attachments</div>
                  <div classИмя="space-y-2">
                    {stagedAttachments.map((file) => (
                      <div key={file.id} classИмя="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                        <div classИмя="min-w-0">
                          <div classИмя="flex items-center gap-2">
                            <Paperclip classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span classИмя="truncate text-sm">{file.file.name}</span>
                          </div>
                          <div classИмя="mt-1 text-[11px] text-muted-foreground">
                            {file.file.type || "application/octet-stream"} • {formatFileSize(file.file)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          classИмя="shrink-0 text-muted-foreground"
                          onClick={() => removeStagedFile(file.id)}
                          disabled={createЗадача.isОжидание}
                          title="Удалить attachment"
                        >
                          <X classИмя="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Property chips bar */}
        <div classИмя="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap shrink-0">
          {/* Статус chip */}
          <Popover open={statusOpen} onOpenChange={setСтатусOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <CircleDot classИмя={cn("h-3 w-3", currentСтатус.color)} />
                {currentСтатус.label}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-56 p-1" align="start">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  classИмя={cn(
                    "flex w-full items-start gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    s.value === status && "bg-accent"
                  )}
                  onClick={() => { setСтатус(s.value); setСтатусOpen(false); }}
                >
                  <CircleDot classИмя={cn("h-3 w-3 mt-0.5 shrink-0", s.color)} />
                  <span classИмя="flex flex-col text-left leading-tight">
                    <span>{s.label}</span>
                    {s.description ? (
                      <span classИмя="text-[10px] text-muted-foreground">{s.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Приоритет chip */}
          <Popover open={priorityOpen} onOpenChange={setПриоритетOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                {currentПриоритет ? (
                  <>
                    <currentПриоритет.icon classИмя={cn("h-3 w-3", currentПриоритет.color)} />
                    {currentПриоритет.label}
                  </>
                ) : (
                  <>
                    <Minus classИмя="h-3 w-3 text-muted-foreground" />
                    Приоритет
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-36 p-1" align="start">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    p.value === priority && "bg-accent"
                  )}
                  onClick={() => { setПриоритет(p.value); setПриоритетOpen(false); }}
                >
                  <p.icon classИмя={cn("h-3 w-3", p.color)} />
                  {p.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Ярлыки chip — disabled, not wired up yet */}
          {/* <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground">
            <Tag classИмя="h-3 w-3" />
            Ярлыки
          </button> */}

          <input
            ref={stageFileInputRef}
            type="file"
            accept={STAGED_FILE_ACCEPT}
            classИмя="hidden"
            onChange={handleStageФайлыPicked}
            multiple
          />
          <button
            classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground"
            onClick={() => stageFileInputRef.current?.click()}
            disabled={createЗадача.isОжидание}
          >
            <Paperclip classИмя="h-3 w-3" />
            Загрузить
          </button>

          {/* Работа mode chip */}
          <Popover open={workModeOpen} onOpenChange={setРаботаModeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-issue-work-mode-chip={workMode}
                classИмя={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  workMode === "planning"
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                <CurrentРаботаModeIcon classИмя="h-3 w-3" />
                {currentРаботаMode.label}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-36 p-1" align="start">
              {ISSUE_WORK_MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    data-issue-work-mode={option.value}
                    classИмя={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                      option.value === workMode && "bg-accent",
                      option.value === "planning" && "text-amber-700 dark:text-amber-300",
                    )}
                    onClick={() => {
                      setРаботаMode(option.value);
                      setРаботаModeOpen(false);
                    }}
                  >
                    <Icon classИмя="h-3 w-3" />
                    {option.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* More (dates) */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center justify-center rounded-md border border-border p-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground">
                <MoreHorizontal classИмя="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-44 p-1" align="start">
              <button classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground">
                <Calendar classИмя="h-3 w-3" />
                Начать date
              </button>
              <button classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground">
                <Calendar classИмя="h-3 w-3" />
                Due date
              </button>
            </PopoverContent>
          </Popover>
        </div>

        {assigneeЗначение && status === "backlog" ? (
          <div
            data-testid="new-issue-assigned-backlog-note"
            classИмя="mx-4 mb-2 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          >
            <Flag classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <span classИмя="leading-snug">
              Assigning implies executable intent — leave status as <span classИмя="font-medium">Назадlog</span> only to deliberately park this. The assignee will not be woken until status moves to <span classИмя="font-medium">Todo</span> or <span classИмя="font-medium">In Progress</span>.
            </span>
          </div>
        ) : null}

        {/* Footer */}
        <div classИмя="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            classИмя="text-muted-foreground"
            onClick={discardЧерновик}
            disabled={createЗадача.isОжидание || !canDiscardЧерновик}
          >
            Discard Черновик
          </Button>
          <div classИмя="flex items-center gap-3">
            <div classИмя="min-h-5 text-right">
              {createЗадача.isОжидание ? (
                <span classИмя="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Loader2 classИмя="h-3 w-3 animate-spin" />
                  Creating issue...
                </span>
              ) : createЗадача.isОшибка ? (
                <span classИмя="text-xs text-destructive">{createЗадачаОшибкаMessage}</span>
              ) : null}
            </div>
            <Button
              size="sm"
              classИмя="min-w-[8.5rem] disabled:opacity-100"
              disabled={!titleHasText || createЗадача.isОжидание}
              onClick={handleОтправить}
              aria-busy={createЗадача.isОжидание}
            >
              <span classИмя="inline-flex items-center justify-center gap-1.5">
                {createЗадача.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{createЗадача.isОжидание ? "Creating..." : isSubЗадачаMode ? "Создать подзадачу" : "Создать задачу"}</span>
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
