/**
 * Plugin bridge initialization.
 *
 * Registers the host's React instances and bridge hook implementations
 * on a global object so that the plugin module loader can inject them
 * into plugin UI bundles at load time.
 *
 * Call `initPluginBridge()` once during app startup (in `main.tsx`), before
 * any plugin UI modules are loaded.
 *
 * @see PLUGIN_SPEC.md §19.0.1 — Plugin UI SDK
 * @see PLUGIN_SPEC.md §19.0.2 — Bundle Isolation
 */

import {
  usePluginData,
  usePluginAction,
  useХостContext,
  useХостLocation,
  useХостNavigation,
  usePluginStream,
  usePluginToast,
} from "./bridge.js";
import { createElement, useEffect, useMemo, useState, type ComponentТип, type ReactНетde } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import {
  FileTree,
  type FileTreeProps as ХостFileTreeProps,
} from "@/components/FileTree";
import { АгентIcon } from "@/components/АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "@/components/InlineEntitySelector";
import { ЗадачиList as ХостЗадачиList } from "@/components/ЗадачиList";
import { ManagedПроцедурыList as ХостManagedПроцедурыList } from "@/components/ManagedПроцедурыList";
import { MarkdownBody } from "@/components/MarkdownBody";
import { accessApi } from "@/api/access";
import { agentsApi } from "@/api/agents";
import { authApi } from "@/api/auth";
import { heartbeatsApi } from "@/api/heartbeats";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import {
  buildКомпанияUserInlineOptions,
} from "@/lib/company-members";
import { collectLiveЗадачаIds } from "@/lib/liveЗадачаIds";
import { useProjectOrder } from "@/hooks/useProjectOrder";
import {
  assigneeЗначениеFromSelection,
  currentUserИсполнительOption,
  parseИсполнительЗначение,
} from "@/lib/assignees";
import { queryКлючs } from "@/lib/queryКлючs";
import {
  getRecentИсполнительSelectionIds,
  sortАгентыByRecency,
  trackRecentИсполнитель,
  trackRecentИсполнительUser,
} from "@/lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "@/lib/recent-projects";

// ---------------------------------------------------------------------------
// Global bridge registry
// ---------------------------------------------------------------------------

/**
 * The global bridge registry shape.
 *
 * This is placed on `globalThis.__paperclipPluginBridge__` and consumed by
 * the plugin module loader to provide implementations for external imports.
 */
export interface PluginBridgeRegistry {
  react: unknown;
  reactDom: unknown;
  sdkUi: Record<string, unknown>;
}

declare global {
  // eslint-disable-next-line no-var
  var __paperclipPluginBridge__: PluginBridgeRegistry | undefined;
}

type PluginFileTreeПутьCollection = ReadonlySet<string> | readonly string[];

type PluginFileTreeProps = Omit<
  ХостFileTreeProps,
  | "expandedDirs"
  | "checkedФайлы"
  | "renderFileExtra"
  | "fileRowClassИмя"
  | "selectedFile"
  | "showCheckboxes"
  | "onToggleDir"
  | "onSelectFile"
> & {
  selectedFile?: string | null;
  expandedПутьs?: PluginFileTreeПутьCollection;
  checkedПутьs?: PluginFileTreeПутьCollection;
  showCheckboxes?: boolean;
  onToggleDir?: (path: string) => void;
  onSelectFile?: (path: string) => void;
};

function toПутьSet(paths?: PluginFileTreeПутьCollection | null): Set<string> {
  return new Set(paths ?? []);
}

function PluginSdkFileTree({
  expandedПутьs,
  checkedПутьs,
  selectedFile = null,
  showCheckboxes = false,
  onToggleDir,
  onSelectFile,
  ...props
}: PluginFileTreeProps) {
  return createElement(FileTree, {
    ...props,
    selectedFile,
    expandedDirs: toПутьSet(expandedПутьs),
    checkedФайлы: checkedПутьs ? toПутьSet(checkedПутьs) : undefined,
    showCheckboxes,
    onToggleDir: onToggleDir ?? (() => undefined),
    onSelectFile: onSelectFile ?? (() => undefined),
  });
}

type PluginMarkdownBlockProps = {
  content: string;
  classИмя?: string;
  enableWikiLinks?: boolean;
  wikiLinkRoot?: string;
  resolveWikiLinkHref?: (target: string, label: string) => string | null | undefined;
};

type PluginMarkdownИзменитьorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  classИмя?: string;
  contentClassИмя?: string;
  onBlur?: () => void;
  bordered?: boolean;
  readOnly?: boolean;
  onОтправить?: () => void;
};

type PluginЗадачиListФильтрs = {
  status?: string;
  projectId?: string;
  parentId?: string;
  assigneeАгентId?: string;
  participantАгентId?: string;
  assigneeUserId?: string;
  labelId?: string;
  workspaceId?: string;
  executionРабочая областьId?: string;
  originKind?: string;
  originKindPrefix?: string;
  originId?: string;
  descendantOf?: string;
  includeПроцедураExecutions?: boolean;
};

type PluginЗадачиListProps = {
  companyId: string | null;
  projectId?: string | null;
  filters?: PluginЗадачиListФильтрs;
  viewStateКлюч?: string;
  initialПоиск?: string;
  createЗадачаLabel?: string;
  searchWithinLoadedЗадачи?: boolean;
};

type PluginИсполнительPickerSelection = {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
};

type PluginИсполнительPickerProps = {
  companyId?: string | null;
  value: string;
  onChange: (value: string, selection: PluginИсполнительPickerSelection) => void;
  placeholder?: string;
  noneLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  includeUsers?: boolean;
  includeTerminatedАгенты?: boolean;
  classИмя?: string;
  onПодтвердить?: () => void;
};

type PluginProjectPickerProps = {
  companyId?: string | null;
  value: string;
  onChange: (projectId: string) => void;
  placeholder?: string;
  noneLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  includeАрхивирован?: boolean;
  classИмя?: string;
  onПодтвердить?: () => void;
};

function PluginSdkMarkdownИзменитьor(props: PluginMarkdownИзменитьorProps) {
  const [Изменитьor, setИзменитьor] = useState<ComponentТип<PluginMarkdownИзменитьorProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/MarkdownИзменитьor").then((module) => {
      if (!cancelled) setИзменитьor(() => module.MarkdownИзменитьor as ComponentТип<PluginMarkdownИзменитьorProps>);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (Изменитьor) return createElement(Изменитьor, props);

  return createElement("textarea", {
    classИмя: props.classИмя,
    value: props.value,
    placeholder: props.placeholder,
    readOnly: props.readOnly,
    onBlur: props.onBlur,
    onChange: (event) => props.onChange((event.currentЦель as HTMLTextAreaElement).value),
  });
}

function compactЗадачаФильтрs(filters: PluginЗадачиListФильтрs): PluginЗадачиListФильтрs {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) =>
      value !== undefined && value !== null && value !== "" && value !== false,
    ),
  ) as PluginЗадачиListФильтрs;
}

function PluginSdkЗадачиList({
  companyId,
  projectId = null,
  filters,
  viewStateКлюч = "paperclip:plugin-issues-view",
  initialПоиск,
  createЗадачаLabel,
  searchWithinLoadedЗадачи = true,
}: PluginЗадачиListProps) {
  const queryClient = useQueryClient();
  const issueФильтрs = useMemo(
    () => compactЗадачаФильтрs({
      ...(filters ?? {}),
      projectId: filters?.projectId ?? projectId ?? undefined,
    }),
    [filters, projectId],
  );
  const originKindPrefix = issueФильтрs.originKindPrefix ?? null;
  const resolvedProjectId = issueФильтрs.projectId ?? projectId ?? null;
  const issuesQueryКлюч = useMemo(
    () => ["plugins", "sdk-ui", "issues-list", companyId ?? "__no-company__", issueФильтрs] as const,
    [companyId, issueФильтрs],
  );

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(companyId ?? "__no-company__"),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });
  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(companyId ?? "__no-company__"),
    queryFn: () => projectsApi.list(companyId!),
    enabled: !!companyId,
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(companyId ?? "__no-company__"),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(companyId!),
    enabled: !!companyId,
    refetchInterval: 5000,
  });
  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);

  const { data: issues, isЗагрузка, error } = useQuery({
    queryКлюч: issuesQueryКлюч,
    queryFn: () => issuesApi.list(companyId!, issueФильтрs),
    enabled: !!companyId,
  });

  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onУспешно: () => {
      if (!companyId) return;
      queryClient.invalidateQueries({ queryКлюч: ["plugins", "sdk-ui", "issues-list", companyId] });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
      if (resolvedProjectId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, resolvedProjectId) });
        if (originKindPrefix) {
          queryClient.invalidateQueries({
            queryКлюч: queryКлючs.issues.listPluginOperationsByProject(companyId, resolvedProjectId, originKindPrefix),
          });
        }
      }
    },
  });

  if (!companyId) {
    return createElement("div", { classИмя: "text-sm text-muted-foreground" }, "Select a company to view issues.");
  }

  return createElement(ХостЗадачиList, {
    issues: issues ?? [],
    isЗагрузка,
    error: error as Ошибка | null,
    agents,
    projects,
    liveЗадачаIds,
    projectId: resolvedProjectId ?? undefined,
    viewStateКлюч,
    initialПоиск,
    createЗадачаLabel,
    searchWithinLoadedЗадачи,
    onОбновитьЗадача: (id: string, data: Record<string, unknown>) => updateЗадача.mutate({ id, data }),
  });
}

function PluginSdkИсполнительPicker({
  companyId,
  value,
  onChange,
  placeholder = "Исполнитель",
  noneLabel = "Нет assignee",
  searchPlaceholder = "Поиск assignees...",
  emptyMessage = "Нет assignees found.",
  includeUsers = true,
  includeTerminatedАгенты = false,
  classИмя,
  onПодтвердить,
}: PluginИсполнительPickerProps) {
  const hostContext = useХостContext();
  const resolvedКомпанияId = companyId ?? hostContext.companyId ?? null;
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: includeUsers,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(resolvedКомпанияId ?? "__no-company__"),
    queryFn: () => agentsApi.list(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId,
  });
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(resolvedКомпанияId ?? "__no-company__"),
    queryFn: () => accessApi.listUserDirectory(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId && includeUsers,
  });
  const recentИсполнительSelectionIds = useMemo(() => getRecentИсполнительSelectionIds(), []);
  const recentИсполнительIds = useMemo(
    () => recentИсполнительSelectionIds
      .map((id) => id.startsWith("agent:") ? id.slice("agent:".length) : null)
      .filter((id): id is string => Boolean(id)),
    [recentИсполнительSelectionIds],
  );
  const sortedАгенты = useMemo(
    () => sortАгентыByRecency(
      (agents ?? []).filter((agent) => includeTerminatedАгенты || agent.status !== "terminated"),
      recentИсполнительIds,
    ),
    [agents, includeTerminatedАгенты, recentИсполнительIds],
  );
  const options = useMemo<InlineEntityOption[]>(
    () => [
      ...(includeUsers ? currentUserИсполнительOption(currentUserId) : []),
      ...(includeUsers
        ? buildКомпанияUserInlineOptions(companyMembers?.users, { excludeUserIds: [currentUserId] })
        : []),
      ...sortedАгенты.map((agent) => ({
        id: assigneeЗначениеFromSelection({ assigneeАгентId: agent.id }),
        label: agent.name,
        searchText: `${agent.name} ${agent.role} ${agent.title ?? ""}`,
      })),
    ],
    [companyMembers?.users, currentUserId, includeUsers, sortedАгенты],
  );
  const selectedИсполнитель = parseИсполнительЗначение(value);
  const selectedАгент = selectedИсполнитель.assigneeАгентId
    ? sortedАгенты.find((agent) => agent.id === selectedИсполнитель.assigneeАгентId)
    : null;

  return createElement(InlineEntitySelector, {
    value,
    options,
    recentOptionIds: recentИсполнительSelectionIds,
    placeholder,
    noneLabel,
    searchPlaceholder,
    emptyMessage,
    classИмя,
    onПодтвердить,
    onChange: (nextЗначение: string) => {
      const selection = parseИсполнительЗначение(nextЗначение);
      if (selection.assigneeАгентId) trackRecentИсполнитель(selection.assigneeАгентId);
      if (selection.assigneeUserId) trackRecentИсполнительUser(selection.assigneeUserId);
      onChange(nextЗначение, selection);
    },
    renderTriggerЗначение: (option: InlineEntityOption | null) => {
      if (!option) return createElement("span", { classИмя: "text-muted-foreground" }, placeholder);
      if (selectedАгент) {
        return createElement(
          FragmentSafe,
          null,
          createElement(АгентIcon, { icon: selectedАгент.icon, classИмя: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
          createElement("span", { classИмя: "truncate" }, option.label),
        );
      }
      return createElement("span", { classИмя: "truncate" }, option.label);
    },
    renderOption: (option: InlineEntityOption) => {
      if (!option.id) return createElement("span", { classИмя: "truncate" }, option.label);
      const selection = parseИсполнительЗначение(option.id);
      const agent = selection.assigneeАгентId
        ? sortedАгенты.find((entry) => entry.id === selection.assigneeАгентId)
        : null;
      return createElement(
        FragmentSafe,
        null,
        agent
          ? createElement(АгентIcon, { icon: agent.icon, classИмя: "h-3.5 w-3.5 shrink-0 text-muted-foreground" })
          : createElement(User, { classИмя: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }),
        createElement("span", { classИмя: "truncate" }, option.label),
      );
    },
  });
}

function PluginSdkProjectPicker({
  companyId,
  value,
  onChange,
  placeholder = "Project",
  noneLabel = "Нет project",
  searchPlaceholder = "Поиск projects...",
  emptyMessage = "Проекты не найдены.",
  includeАрхивирован = false,
  classИмя,
  onПодтвердить,
}: PluginProjectPickerProps) {
  const hostContext = useХостContext();
  const resolvedКомпанияId = companyId ?? hostContext.companyId ?? null;
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(resolvedКомпанияId ?? "__no-company__"),
    queryFn: () => projectsApi.list(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId,
  });
  const visibleПроекты = useMemo(
    () => (projects ?? []).filter((project) => includeАрхивирован || !project.archivedAt),
    [includeАрхивирован, projects],
  );
  const { orderedПроекты } = useProjectOrder({
    projects: visibleПроекты,
    companyId: resolvedКомпанияId,
    userId: currentUserId,
  });
  const recentProjectIds = useMemo(() => getRecentProjectIds(), []);
  const options = useMemo<InlineEntityOption[]>(
    () => orderedПроекты.map((project) => ({
      id: project.id,
      label: project.name,
      searchText: project.description ?? "",
    })),
    [orderedПроекты],
  );
  const selectedProject = orderedПроекты.find((project) => project.id === value) ?? null;

  return createElement(InlineEntitySelector, {
    value,
    options,
    recentOptionIds: recentProjectIds,
    placeholder,
    noneLabel,
    searchPlaceholder,
    emptyMessage,
    classИмя,
    onПодтвердить,
    onChange: (nextProjectId: string) => {
      if (nextProjectId) trackRecentProject(nextProjectId);
      onChange(nextProjectId);
    },
    renderTriggerЗначение: (option: InlineEntityOption | null) => {
      if (!option || !selectedProject) {
        return createElement("span", { classИмя: "text-muted-foreground" }, placeholder);
      }
      return createElement(
        FragmentSafe,
        null,
        createElement("span", {
          classИмя: "h-3.5 w-3.5 shrink-0 rounded-sm",
          style: { backgroundColor: selectedProject.color ?? "#6366f1" },
        }),
        createElement("span", { classИмя: "truncate" }, option.label),
      );
    },
    renderOption: (option: InlineEntityOption) => {
      if (!option.id) return createElement("span", { classИмя: "truncate" }, option.label);
      const project = orderedПроекты.find((entry) => entry.id === option.id);
      return createElement(
        FragmentSafe,
        null,
        createElement("span", {
          classИмя: "h-3.5 w-3.5 shrink-0 rounded-sm",
          style: { backgroundColor: project?.color ?? "#6366f1" },
        }),
        createElement("span", { classИмя: "truncate" }, option.label),
      );
    },
  });
}

function FragmentSafe({ children }: { children?: ReactНетde }) {
  return createElement("span", { classИмя: "contents" }, children);
}

/**
 * Initialize the plugin bridge global registry.
 *
 * Registers the host's React, ReactDOM, and SDK UI bridge implementations
 * on `globalThis.__paperclipPluginBridge__` so the plugin module loader
 * can provide them to plugin bundles.
 *
 * @param react - The host's React module
 * @param reactDom - The host's ReactDOM module
 */
export function initPluginBridge(
  react: typeof import("react"),
  reactDom: typeof import("react-dom"),
): void {
  globalThis.__paperclipPluginBridge__ = {
    react,
    reactDom,
    sdkUi: {
      usePluginData,
      usePluginAction,
      useХостContext,
      useХостLocation,
      useХостNavigation,
      usePluginStream,
      usePluginToast,
      MarkdownBlock: ({
        content,
        classИмя,
        enableWikiLinks,
        wikiLinkRoot,
        resolveWikiLinkHref,
      }: PluginMarkdownBlockProps) =>
        createElement(MarkdownBody, {
          classИмя,
          softBreaks: false,
          enableWikiLinks,
          wikiLinkRoot,
          resolveWikiLinkHref,
          children: content,
        }),
      MarkdownИзменитьor: PluginSdkMarkdownИзменитьor,
      FileTree: PluginSdkFileTree,
      ЗадачиList: PluginSdkЗадачиList,
      ИсполнительPicker: PluginSdkИсполнительPicker,
      ProjectPicker: PluginSdkProjectPicker,
      ManagedПроцедурыList: ХостManagedПроцедурыList,
    },
  };
}
