import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Активность as АктивностьIcon,
  ChevronDown,
  ChevronRight,
  Clock3,
  Копировать,
  История as ИсторияIcon,
  Play,
  Plus,
  Repeat,
  Сохранить,
  SlidersHorizontal,
} from "lucide-react";
import { ApiОшибка } from "../api/client";
import { routinesApi, type ПроцедураTriggerResponse, type RotateПроцедураTriggerResponse, type RestoreПроцедураRevisionResponse } from "../api/routines";
import { TriggerListCard } from "../components/TriggerListCard";
import { TriggerDialog } from "../components/TriggerDialog";
import { ПодтвердитьDialog } from "../components/ПодтвердитьDialog";
import {
  ПроцедураИсторияTab,
  type ПроцедураИсторияDirtyFieldDescriptor,
} from "../components/ПроцедураИсторияTab";
import { heartbeatsApi } from "../api/heartbeats";
import { LiveЗапуститьWidget } from "../components/LiveЗапуститьWidget";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { accessApi } from "../api/access";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { usePanel } from "../context/PanelContext";
import { useToastActions } from "../context/ToastContext";
import { cn } from "../lib/utils";
import { queryКлючs } from "../lib/queryКлючs";
import { buildMarkdownMentionOptions } from "../lib/company-members";
import { timeAgo } from "../lib/timeAgo";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { АгентIcon } from "../components/АгентIconPicker";
import { InlineEntitySelector, type InlineEntityOption } from "../components/InlineEntitySelector";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "../components/MarkdownИзменитьor";
import {
  ПроцедураЗапуститьVariablesDialog,
  type ПроцедураЗапуститьDialogОтправитьData,
} from "../components/ПроцедураЗапуститьVariablesDialog";
import { ПроцедураVariablesИзменитьor, ПроцедураVariablesHint } from "../components/ПроцедураVariablesИзменитьor";
import { ЗапуститьButton } from "../components/АгентActionButtons";
import { getRecentИсполнительIds, sortАгентыByRecency, trackRecentИсполнитель } from "../lib/recent-assignees";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { ПроцедураDetail as ПроцедураDetailТип, ПроцедураTrigger, ПроцедураVariable } from "@paperclipai/shared";

const concurrencyPolicies = ["coalesce_if_active", "always_enqueue", "skip_if_active"];
const catchUpPolicies = ["skip_missed", "enqueue_missed_with_cap"];
const routineTabs = ["triggers", "runs", "activity", "history"] as const;
const concurrencyPolicyОписаниеs: Record<string, string> = {
  coalesce_if_active: "Keep one follow-up run queued while an active run is still working.",
  always_enqueue: "Queue every trigger occurrence, even if several runs stack up.",
  skip_if_active: "Drop overlapping trigger occurrences while the routine is already active.",
};
const catchUpPolicyОписаниеs: Record<string, string> = {
  skip_missed: "Ignore schedule windows that were missed while the routine or scheduler was paused.",
  enqueue_missed_with_cap: "Catch up missed schedule windows in capped batches after recovery.",
};

type ПроцедураTab = (typeof routineTabs)[number];

type СекретMessage = {
  title: string;
  entries: Array<{
    webhookUrl: string;
    webhookСекрет: string;
  }>;
};

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function isПроцедураTab(value: string | null): value is ПроцедураTab {
  return value !== null && routineTabs.includes(value as ПроцедураTab);
}

function getПроцедураTabFromПоиск(search: string): ПроцедураTab {
  const tab = new URLПоискParams(search).get("tab");
  return isПроцедураTab(tab) ? tab : "triggers";
}

function formatАктивностьDetailЗначение(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map((item) => formatАктивностьDetailЗначение(item)).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
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

export function ПроцедураDetail() {
  const { routineId } = useParams<{ routineId: string }>();
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToastActions();
  const { openPanel, closePanel, panelVisible, setPanelVisible } = usePanel();
  const hydratedПроцедураIdRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionИзменитьorRef = useRef<MarkdownИзменитьorRef>(null);
  const assigneeSelectorRef = useRef<HTMLButtonElement | null>(null);
  const projectSelectorRef = useRef<HTMLButtonElement | null>(null);
  const [secretMessage, setСекретMessage] = useState<СекретMessage | null>(null);
  const [advancedOpen, setДополнительноOpen] = useState(false);
  const [saveConflict, setСохранитьConflict] = useState(false);
  const [runVariablesOpen, setЗапуститьVariablesOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [editingTrigger, setИзменитьingTrigger] = useState<ПроцедураTrigger | null>(null);
  const [triggerОжиданиеУдалить, setTriggerОжиданиеУдалить] = useState<ПроцедураTrigger | null>(null);
  const [togglingTriggerId, setTogglingTriggerId] = useState<string | null>(null);
  const [editЧерновик, setИзменитьЧерновик] = useState<{
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
  const activeTab = useMemo(() => getПроцедураTabFromПоиск(location.search), [location.search]);

  const { data: routine, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.routines.detail(routineId!),
    queryFn: () => routinesApi.get(routineId!),
    enabled: !!routineId,
  });
  const activeЗадачаId = routine?.activeЗадача?.id;
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.issues.liveЗапуститьs(activeЗадачаId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForЗадача(activeЗадачаId!),
    enabled: !!activeЗадачаId,
    refetchInterval: 3000,
  });
  const hasLiveЗапустить = (liveЗапуститьs ?? []).length > 0;
  const { data: routineЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.routines.runs(routineId!),
    queryFn: () => routinesApi.listЗапуститьs(routineId!),
    enabled: !!routineId,
    refetchInterval: hasLiveЗапустить ? 3000 : false,
  });
  const relatedАктивностьIds = useMemo(
    () => ({
      triggerIds: routine?.triggers.map((trigger) => trigger.id) ?? [],
      runIds: routineЗапуститьs?.map((run) => run.id) ?? [],
    }),
    [routine?.triggers, routineЗапуститьs],
  );
  const { data: activity } = useQuery({
    queryКлюч: [
      ...queryКлючs.routines.activity(selectedКомпанияId!, routineId!),
      relatedАктивностьIds.triggerIds.join(","),
      relatedАктивностьIds.runIds.join(","),
    ],
    queryFn: () => routinesApi.activity(selectedКомпанияId!, routineId!, relatedАктивностьIds),
    enabled: !!selectedКомпанияId && !!routineId && !!routine,
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

  const routineПо умолчаниюs = useMemo(
    () =>
      routine
        ? {
            title: routine.title,
            description: routine.description ?? "",
            projectId: routine.projectId ?? "",
            assigneeАгентId: routine.assigneeАгентId ?? "",
            priority: routine.priority,
            concurrencyPolicy: routine.concurrencyPolicy,
            catchUpPolicy: routine.catchUpPolicy,
            variables: routine.variables,
          }
        : null,
    [routine],
  );
  const dirtyFields = useMemo<ПроцедураИсторияDirtyFieldDescriptor[]>(() => {
    if (!routineПо умолчаниюs) return [];
    const result: ПроцедураИсторияDirtyFieldDescriptor[] = [];
    if (editЧерновик.title !== routineПо умолчаниюs.title) result.push({ key: "title", label: "the title" });
    if (editЧерновик.description !== routineПо умолчаниюs.description) {
      result.push({ key: "description", label: "the description" });
    }
    if (editЧерновик.projectId !== routineПо умолчаниюs.projectId) {
      result.push({ key: "projectId", label: "the project" });
    }
    if (editЧерновик.assigneeАгентId !== routineПо умолчаниюs.assigneeАгентId) {
      result.push({ key: "assigneeАгентId", label: "the default agent" });
    }
    if (editЧерновик.priority !== routineПо умолчаниюs.priority) {
      result.push({ key: "priority", label: "the priority" });
    }
    if (editЧерновик.concurrencyPolicy !== routineПо умолчаниюs.concurrencyPolicy) {
      result.push({ key: "concurrencyPolicy", label: "the concurrency policy" });
    }
    if (editЧерновик.catchUpPolicy !== routineПо умолчаниюs.catchUpPolicy) {
      result.push({ key: "catchUpPolicy", label: "the catch-up policy" });
    }
    if (JSON.stringify(editЧерновик.variables) !== JSON.stringify(routineПо умолчаниюs.variables)) {
      result.push({ key: "variables", label: "the variables" });
    }
    return result;
  }, [editЧерновик, routineПо умолчаниюs]);
  const isИзменитьDirty = dirtyFields.length > 0;

  useEffect(() => {
    if (!routine) return;
    setBreadcrumbs([{ label: "Процедуры", href: "/routines" }, { label: routine.title }]);
    if (!routineПо умолчаниюs) return;

    const changedПроцедура = hydratedПроцедураIdRef.current !== routine.id;
    if (changedПроцедура || !isИзменитьDirty) {
      setИзменитьЧерновик(routineПо умолчаниюs);
      hydratedПроцедураIdRef.current = routine.id;
    }
  }, [routine, routineПо умолчаниюs, isИзменитьDirty, setBreadcrumbs]);

  useEffect(() => {
    autoResizeTextarea(titleInputRef.current);
  }, [editЧерновик.title, routine?.id]);

  const copyСекретЗначение = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ title: `${label} copied`, tone: "success" });
    } catch (error) {
      pushToast({
        title: `Ошибка to copy ${label.toНизкийerCase()}`,
        body: error instanceof Ошибка ? error.message : "Clipboard access was denied.",
        tone: "error",
      });
    }
  };

  const setАктивенTab = useCallback((value: string) => {
    if (!routineId || !isПроцедураTab(value)) return;
    const params = new URLПоискParams(location.search);
    if (value === "triggers") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, routineId]);

  const saveПроцедура = useMutation({
    mutationFn: () => {
      const payload = buildПроцедураMutationPayload(editЧерновик);
      const baseRevisionId = routine?.latestRevisionId ?? null;
      return routinesApi.update(routineId!, {
        ...payload,
        ...(baseRevisionId ? { baseRevisionId } : {}),
      });
    },
    onУспешно: async () => {
      setСохранитьConflict(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.revisions(routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      if (error instanceof ApiОшибка && error.status === 409) {
        setСохранитьConflict(true);
        pushToast({
          title: "Процедура changed",
          body: "Someone else updated this routine. Reload to see the latest revision.",
          tone: "warn",
        });
        return;
      }
      pushToast({
        title: "Ошибка to save routine",
        body: error instanceof Ошибка ? error.message : "Paperclip could not save the routine.",
        tone: "error",
      });
    },
  });
  const saveПроцедураRef = useRef(saveПроцедура);

  useEffect(() => {
    saveПроцедураRef.current = saveПроцедура;
  }, [saveПроцедура]);

  const runПроцедура = useMutation({
    mutationFn: (data?: ПроцедураЗапуститьDialogОтправитьData) =>
      routinesApi.run(routineId!, {
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
    onУспешно: async () => {
      pushToast({ title: "Запуск процедуры начат", tone: "success" });
      setЗапуститьVariablesOpen(false);
      setАктивенTab("runs");
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.runs(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Запуск процедуры не удался",
        body: error instanceof Ошибка ? error.message : "Paperclip could not start the routine run.",
        tone: "error",
      });
    },
  });

  const updateПроцедураСтатус = useMutation({
    mutationFn: (status: string) => routinesApi.update(routineId!, { status }),
    onУспешно: async (_data, status) => {
      pushToast({
        title: "Процедура сохранена",
        body: status === "paused" ? "Автоmation paused." : "Автоmation enabled.",
        tone: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to update routine",
        body: error instanceof Ошибка ? error.message : "Paperclip could not update the routine.",
        tone: "error",
      });
    },
  });

  const createTrigger = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<ПроцедураTriggerResponse> => {
      // Авто-label when the caller didn't provide one (e.g. dialog left the
      // Label field blank). Keeps the existing "schedule-2"-style numbering
      // behaviour so existing routines keep unique-ish labels.
      const kind = String(body.kind ?? "schedule");
      const trimmedLabel = typeof body.label === "string" ? body.label.trim() : "";
      let finalLabel: string;
      if (trimmedLabel.length > 0 && trimmedLabel !== kind) {
        finalLabel = trimmedLabel;
      } else {
        const existingOfKind = (routine?.triggers ?? []).filter((t) => t.kind === kind).length;
        finalLabel = existingOfKind > 0 ? `${kind}-${existingOfKind + 1}` : kind;
      }
      return routinesApi.createTrigger(routineId!, { ...body, label: finalLabel });
    },
    onУспешно: async (result) => {
      setTriggerDialogOpen(false);
      if (result.secretMaterial) {
        setСекретMessage({
          title: "Webhook trigger created",
          entries: [{
            webhookUrl: result.secretMaterial.webhookUrl,
            webhookСекрет: result.secretMaterial.webhookСекрет,
          }],
        });
      } else {
        pushToast({
          title: "Trigger added",
          body: "The routine schedule was saved.",
          tone: "success",
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to add trigger",
        body: error instanceof Ошибка ? error.message : "Paperclip could not create the trigger.",
        tone: "error",
      });
    },
  });

  const updateTrigger = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => routinesApi.updateTrigger(id, patch),
    onУспешно: async () => {
      pushToast({
        title: "Trigger saved",
        tone: "success",
      });
      setTriggerDialogOpen(false);
      setИзменитьingTrigger(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to update trigger",
        body: error instanceof Ошибка ? error.message : "Paperclip could not update the trigger.",
        tone: "error",
      });
    },
    onSettled: () => {
      setTogglingTriggerId(null);
    },
  });

  const deleteTrigger = useMutation({
    mutationFn: (id: string) => routinesApi.deleteTrigger(id),
    onУспешно: async () => {
      pushToast({
        title: "Trigger deleted",
        tone: "success",
      });
      setTriggerОжиданиеУдалить(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to delete trigger",
        body: error instanceof Ошибка ? error.message : "Paperclip could not delete the trigger.",
        tone: "error",
      });
    },
  });

  const rotateTrigger = useMutation({
    mutationFn: (id: string): Promise<RotateПроцедураTriggerResponse> => routinesApi.rotateTriggerСекрет(id),
    onУспешно: async (result) => {
      setСекретMessage({
        title: "Webhook secret rotated",
        entries: [{
          webhookUrl: result.secretMaterial.webhookUrl,
          webhookСекрет: result.secretMaterial.webhookСекрет,
        }],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.activity(selectedКомпанияId!, routineId!) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to rotate webhook secret",
        body: error instanceof Ошибка ? error.message : "Paperclip could not rotate the webhook secret.",
        tone: "error",
      });
    },
  });

  const agentById = useMemo(
    () => new Map((agents ?? []).map((agent) => [agent.id, agent])),
    [agents],
  );
  const projectById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project])),
    [projects],
  );
  const recentИсполнительIds = useMemo(() => getRecentИсполнительIds(), [routine?.id]);
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [routine?.id]);
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
  const mentionOptions = useMemo<MentionOption[]>(() => {
    return buildMarkdownMentionOptions({
      agents,
      projects,
      members: companyMembers?.users,
    });
  }, [agents, companyMembers?.users, projects]);
  const currentИсполнитель = editЧерновик.assigneeАгентId ? agentById.get(editЧерновик.assigneeАгентId) ?? null : null;
  const currentProject = editЧерновик.projectId ? projectById.get(editЧерновик.projectId) ?? null : null;

  const activityTabsPanel = useMemo(() => {
    if (!routine) return null;
    return (
      <Tabs value={activeTab} onЗначениеChange={setАктивенTab} classИмя="space-y-3 min-w-0">
        <TabsList variant="line" classИмя="w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="triggers" classИмя="gap-1.5 flex-none px-2">
            <Clock3 classИмя="h-3.5 w-3.5" />
            Триггеры
          </TabsTrigger>
          <TabsTrigger value="runs" classИмя="gap-1.5 flex-none px-2">
            <Play classИмя="h-3.5 w-3.5" />
            Запуститьs
            {hasLiveЗапустить && <span classИмя="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="activity" classИмя="gap-1.5 flex-none px-2">
            <АктивностьIcon classИмя="h-3.5 w-3.5" />
            Активность
          </TabsTrigger>
          <TabsTrigger value="history" classИмя="gap-1.5 flex-none px-2">
            <ИсторияIcon classИмя="h-3.5 w-3.5" />
            История
          </TabsTrigger>
        </TabsList>

        <TabsContent value="triggers" classИмя="space-y-4">
          <Button
            size="sm"
            classИмя="w-full"
            onClick={() => {
              setИзменитьingTrigger(null);
              setTriggerDialogOpen(true);
            }}
          >
            <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
            Добавить триггер
          </Button>

          {routine.triggers.length === 0 ? (
            <div classИмя="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <p classИмя="text-sm font-medium">Нет triggers yet</p>
              <p classИмя="text-xs text-muted-foreground mt-1 mb-4">
                Триггеры fire this routine on a schedule or via webhook.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setИзменитьingTrigger(null);
                  setTriggerDialogOpen(true);
                }}
              >
                <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
                Добавить your first trigger
              </Button>
            </div>
          ) : (
            <div classИмя="space-y-3">
              {routine.triggers.map((trigger) => (
                <TriggerListCard
                  key={trigger.id}
                  trigger={trigger}
                  onИзменить={() => {
                    setИзменитьingTrigger(trigger);
                    setTriggerDialogOpen(true);
                  }}
                  onУдалить={() => setTriggerОжиданиеУдалить(trigger)}
                  onToggleВключитьd={(enabled) => {
                    setTogglingTriggerId(trigger.id);
                    updateTrigger.mutate({ id: trigger.id, patch: { enabled } });
                  }}
                  onRotateСекрет={
                    trigger.kind === "webhook"
                      ? () => rotateTrigger.mutate(trigger.id)
                      : undefined
                  }
                  toggleОжидание={togglingTriggerId === trigger.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" classИмя="space-y-4">
          {hasLiveЗапустить && activeЗадачаId && routine && (
            <LiveЗапуститьWidget issueId={activeЗадачаId} companyId={routine.companyId} />
          )}
          {(routineЗапуститьs ?? []).length === 0 ? (
            <p classИмя="text-xs text-muted-foreground">Нет runs yet.</p>
          ) : (
            <div classИмя="border border-border rounded-lg divide-y divide-border">
              {(routineЗапуститьs ?? []).map((run) => (
                <div key={run.id} classИмя="flex flex-col gap-1.5 px-3 py-2 text-sm min-w-0">
                  <div classИмя="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" classИмя="text-[11px]">{run.source}</Badge>
                    <Badge variant={run.status === "failed" ? "destructive" : "secondary"} classИмя="text-[11px]">
                      {run.status.replaceВсе("_", " ")}
                    </Badge>
                  </div>
                  {(run.trigger || run.linkedЗадача) && (
                    <div classИмя="flex items-center gap-1.5 flex-wrap text-xs min-w-0">
                      {run.trigger && (
                        <span classИмя="text-muted-foreground truncate">{run.trigger.label ?? run.trigger.kind}</span>
                      )}
                      {run.linkedЗадача && (
                        <Link to={`/issues/${run.linkedЗадача.identifier ?? run.linkedЗадача.id}`} classИмя="text-muted-foreground hover:underline truncate">
                          {run.linkedЗадача.identifier ?? run.linkedЗадача.id.slice(0, 8)}
                        </Link>
                      )}
                    </div>
                  )}
                  <span classИмя="text-[11px] text-muted-foreground">{timeAgo(run.triggeredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {(activity ?? []).length === 0 ? (
            <p classИмя="text-xs text-muted-foreground">Нет activity yet.</p>
          ) : (
            <div classИмя="border border-border rounded-lg divide-y divide-border">
              {(activity ?? []).map((event) => (
                <div key={event.id} classИмя="flex flex-col gap-1 px-3 py-2 text-xs min-w-0">
                  <span classИмя="font-medium text-foreground/90">{event.action.replaceВсе(".", " ")}</span>
                  {event.details && Object.keys(event.details).length > 0 && (
                    <div classИмя="text-muted-foreground break-words">
                      {Object.entries(event.details).slice(0, 3).map(([key, value], i) => (
                        <span key={key}>
                          {i > 0 && <span classИмя="mx-1 text-border">·</span>}
                          <span classИмя="text-muted-foreground/70">{key.replaceВсе("_", " ")}:</span>{" "}
                          {formatАктивностьDetailЗначение(value)}
                        </span>
                      ))}
                    </div>
                  )}
                  <span classИмя="text-muted-foreground/60">{timeAgo(event.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <ПроцедураИсторияTab
            routine={routine}
            isИзменитьDirty={isИзменитьDirty}
            dirtyFields={dirtyFields}
            onDiscardИзменитьs={() => {
              if (routineПо умолчаниюs) setИзменитьЧерновик(routineПо умолчаниюs);
            }}
            onСохранитьИзменитьs={() => {
              const currentСохранить = saveПроцедураRef.current;
              if (!currentСохранить.isОжидание && editЧерновик.title.trim()) {
                currentСохранить.mutate();
              }
            }}
            agents={agentById}
            projects={projectById}
            onRestoreСекретMaterials={(response: RestoreПроцедураRevisionResponse) => {
              if (response.secretMaterials.length > 0) {
                setСекретMessage({
                  title: response.secretMaterials.length === 1
                    ? "Webhook trigger restored"
                    : `${response.secretMaterials.length} webhook triggers restored`,
                  entries: response.secretMaterials.map((recreated) => ({
                    webhookUrl: recreated.webhookUrl,
                    webhookСекрет: recreated.webhookСекрет,
                  })),
                });
              }
            }}
            onRestored={(response: RestoreПроцедураRevisionResponse) => {
              setСохранитьConflict(false);
              queryClient.setQueryData<ПроцедураDetailТип | undefined>(
                queryКлючs.routines.detail(routineId!),
                (prev) =>
                  prev
                    ? {
                        ...prev,
                        ...response.routine,
                        latestRevisionId: response.revision.id,
                        latestRevisionNumber: response.revision.revisionNumber,
                      }
                    : prev,
              );
              setИзменитьЧерновик({
                title: response.routine.title,
                description: response.routine.description ?? "",
                projectId: response.routine.projectId ?? "",
                assigneeАгентId: response.routine.assigneeАгентId ?? "",
                priority: response.routine.priority,
                concurrencyPolicy: response.routine.concurrencyPolicy,
                catchUpPolicy: response.routine.catchUpPolicy,
                variables: response.routine.variables,
              });
              hydratedПроцедураIdRef.current = response.routine.id;
            }}
          />
        </TabsContent>
      </Tabs>
    );
  }, [
    activeЗадачаId,
    activeTab,
    activity,
    agentById,
    dirtyFields,
    editЧерновик.title,
    hasLiveЗапустить,
    isИзменитьDirty,
    projectById,
    queryClient,
    rotateTrigger.mutate,
    routine,
    routineПо умолчаниюs,
    routineЗапуститьs,
    routineId,
    setАктивенTab,
    togglingTriggerId,
    updateTrigger.mutate,
  ]);

  useEffect(() => {
    if (!activityTabsPanel) {
      closePanel();
      return;
    }
    openPanel(activityTabsPanel, {
      storageКлюч: "paperclip.properties.width.routines",
      defaultWidth: 400,
      minWidth: 320,
      maxWidth: 640,
      compactBelowViewport: 1024,
      compactMaxWidth: 320,
    });
    return () => closePanel();
  }, [activityTabsPanel, closePanel, openPanel]);

  if (!selectedКомпанияId) {
    return <EmptyState icon={Repeat} message="Select a company to view routines." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="issues-list" />;
  }

  if (error || !routine) {
    return (
      <p classИмя="pt-6 text-sm text-destructive">
        {error instanceof Ошибка ? error.message : "Процедура not found"}
      </p>
    );
  }

  const automationВключитьd = routine.status === "active";
  const selectedProject = routine.projectId ? (projects?.find((project) => project.id === routine.projectId) ?? null) : null;
  const automationToggleОтключитьd = updateПроцедураСтатус.isОжидание || routine.status === "archived";
  const automationLabel = routine.status === "archived"
    ? "Архивирован"
    : !routine.assigneeАгентId
      ? "Черновик"
      : automationВключитьd
        ? "Активен"
        : "Приостановлен";
  const automationLabelClassИмя = routine.status === "archived"
    ? "text-muted-foreground"
    : automationВключитьd
      ? "text-emerald-400"
      : "text-muted-foreground";

  return (
    <div classИмя="max-w-2xl space-y-6">
      {/* Header: editable title + actions */}
      <div classИмя="flex flex-col items-stretch gap-3 min-[1120px]:flex-row min-[1120px]:items-start min-[1120px]:gap-4">
        <div classИмя="min-w-0 flex-1 space-y-2">
          <textarea
            ref={titleInputRef}
            classИмя="w-full resize-none overflow-hidden bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50"
            placeholder="Процедура title"
            rows={1}
            value={editЧерновик.title}
            onChange={(event) => {
              setИзменитьЧерновик((current) => ({ ...current, title: event.target.value }));
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
                if (editЧерновик.assigneeАгентId) {
                  if (editЧерновик.projectId) {
                    descriptionИзменитьorRef.current?.focus();
                  } else {
                    projectSelectorRef.current?.focus();
                  }
                } else {
                  assigneeSelectorRef.current?.focus();
                }
              }
            }}
          />
          {routine.managedByPlugin ? (
            <Badge variant="outline" classИмя="gap-1 text-xs text-muted-foreground">
              Managed by {routine.managedByPlugin.pluginDisplayИмя}
              <span classИмя="font-mono text-[10px]">{routine.managedByPlugin.resourceКлюч}</span>
            </Badge>
          ) : null}
        </div>
        <div classИмя="flex w-full shrink-0 flex-wrap items-center gap-3 pt-1 min-[1120px]:w-auto min-[1120px]:flex-nowrap">
          <ЗапуститьButton
            onClick={() => {
              setЗапуститьVariablesOpen(true);
            }}
            disabled={runПроцедура.isОжидание}
          />
          <ToggleSwitch
            size="lg"
            checked={automationВключитьd}
            onCheckedChange={() => {
              if (!automationВключитьd && !routine.assigneeАгентId) {
                pushToast({
                  title: "Требуется агент по умолчанию",
                  body: "Set a default agent before enabling routine automation.",
                  tone: "warn",
                });
                return;
              }
              updateПроцедураСтатус.mutate(automationВключитьd ? "paused" : "active");
            }}
            disabled={automationToggleОтключитьd}
            aria-label={automationВключитьd ? "Пауза automatic triggers" : "Включить automatic triggers"}
          />
          <span classИмя={`min-w-[3.75rem] text-sm font-medium ${automationLabelClassИмя}`}>
            {automationLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            classИмя={cn(
              "hidden md:inline-flex shrink-0 transition-opacity duration-200",
              panelVisible ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100",
            )}
            onClick={() => setPanelVisible(true)}
            aria-label="Show triggers, runs and activity"
            title="Show triggers, runs and activity"
          >
            <SlidersHorizontal classИмя="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Секрет message banner */}
      {secretMessage && (
        <div classИмя="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 text-sm">
          <div>
            <p classИмя="font-medium">{secretMessage.title}</p>
            <p classИмя="text-xs text-muted-foreground">Сохранить this now. Paperclip will not show the secret value again.</p>
          </div>
          <div classИмя="space-y-3">
            {secretMessage.entries.map((entry, index) => (
              <div key={`${entry.webhookUrl}-${index}`} classИмя="space-y-2">
                {secretMessage.entries.length > 1 && (
                  <p classИмя="text-xs font-medium text-muted-foreground">
                    Webhook trigger {index + 1} of {secretMessage.entries.length}
                  </p>
                )}
                <div classИмя="flex items-center gap-2">
                  <Input value={entry.webhookUrl} readOnly classИмя="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => copyСекретЗначение("Webhook URL", entry.webhookUrl)}>
                    <Копировать classИмя="h-3.5 w-3.5 mr-1" />
                    URL
                  </Button>
                </div>
                <div classИмя="flex items-center gap-2">
                  <Input value={entry.webhookСекрет} readOnly classИмя="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => copyСекретЗначение("Webhook secret", entry.webhookСекрет)}>
                    <Копировать classИмя="h-3.5 w-3.5 mr-1" />
                    Секрет
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сохранить conflict banner */}
      {saveConflict && (
        <div classИмя="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <div classИмя="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div classИмя="space-y-1">
              <p classИмя="font-medium text-amber-200">Out of date</p>
              <p classИмя="text-xs text-muted-foreground">
                This routine changed while you were editing. Reload to merge the latest revision before
                saving again.
              </p>
            </div>
            <div classИмя="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setСохранитьConflict(false);
                  if (routineПо умолчаниюs) {
                    setИзменитьЧерновик(routineПо умолчаниюs);
                  }
                  queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routineId!) });
                }}
              >
                Reload latest
              </Button>
            </div>
          </div>
        </div>
      )}

      {!routine.assigneeАгентId ? (
        <div classИмя="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
          Требуется агент по умолчанию. This routine can stay as a draft and still run manually, but automation stays paused until you assign a default agent.
        </div>
      ) : null}

      {/* Assignment row */}
      <div classИмя="overflow-x-auto overscroll-x-contain">
        <div classИмя="inline-flex min-w-full flex-wrap items-center gap-2 text-sm text-muted-foreground sm:min-w-max sm:flex-nowrap">
          <span>For</span>
          <InlineEntitySelector
            ref={assigneeSelectorRef}
            value={editЧерновик.assigneeАгентId}
            options={assigneeOptions}
            recentOptionIds={recentИсполнительIds}
            placeholder="Исполнитель"
            noneLabel="Нет assignee"
            searchPlaceholder="Поиск assignees..."
            emptyMessage="Нет assignees found."
            onChange={(assigneeАгентId) => {
              if (assigneeАгентId) trackRecentИсполнитель(assigneeАгентId);
              setИзменитьЧерновик((current) => ({ ...current, assigneeАгентId }));
            }}
            onПодтвердить={() => {
              if (editЧерновик.projectId) {
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
            value={editЧерновик.projectId}
            options={projectOptions}
            recentOptionIds={recentProjectIds}
            placeholder="Project"
            noneLabel="Нет project"
            searchPlaceholder="Поиск projects..."
            emptyMessage="Проекты не найдены."
            onChange={(projectId) => {
              if (projectId) trackRecentProject(projectId);
              setИзменитьЧерновик((current) => ({ ...current, projectId }));
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

      {/* Instructions */}
      <MarkdownИзменитьor
        ref={descriptionИзменитьorRef}
        value={editЧерновик.description}
        onChange={(description) => setИзменитьЧерновик((current) => ({ ...current, description }))}
        placeholder="Добавить instructions..."
        bordered={false}
        contentClassИмя="min-h-[120px] text-[15px] leading-7"
        mentions={mentionOptions}
        onОтправить={() => {
          if (!saveПроцедура.isОжидание && editЧерновик.title.trim()) {
            saveПроцедура.mutate();
          }
        }}
      />
      <ПроцедураVariablesHint />
      <ПроцедураVariablesИзменитьor
        title={editЧерновик.title}
        description={editЧерновик.description}
        value={editЧерновик.variables}
        onChange={(variables) => setИзменитьЧерновик((current) => ({ ...current, variables }))}
      />

      {/* Дополнительно delivery settings */}
      <Collapsible open={advancedOpen} onOpenChange={setДополнительноOpen}>
        <CollapsibleTrigger classИмя="flex w-full items-center justify-between text-left">
          <span classИмя="text-sm font-medium">Дополнительно delivery settings</span>
          {advancedOpen ? <ChevronDown classИмя="h-4 w-4 text-muted-foreground" /> : <ChevronRight classИмя="h-4 w-4 text-muted-foreground" />}
        </CollapsibleTrigger>
        <CollapsibleContent classИмя="pt-3">
          <div classИмя="grid gap-4 md:grid-cols-2">
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Concurrency</p>
              <Select
                value={editЧерновик.concurrencyPolicy}
                onЗначениеChange={(concurrencyPolicy) => setИзменитьЧерновик((current) => ({ ...current, concurrencyPolicy }))}
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
              <p classИмя="text-xs text-muted-foreground">{concurrencyPolicyОписаниеs[editЧерновик.concurrencyPolicy]}</p>
            </div>
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Catch-up</p>
              <Select
                value={editЧерновик.catchUpPolicy}
                onЗначениеChange={(catchUpPolicy) => setИзменитьЧерновик((current) => ({ ...current, catchUpPolicy }))}
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
              <p classИмя="text-xs text-muted-foreground">{catchUpPolicyОписаниеs[editЧерновик.catchUpPolicy]}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Сохранить bar */}
      <div classИмя="flex items-center justify-between">
        {isИзменитьDirty ? (
          <span classИмя="text-xs text-amber-600">Unsaved changes</span>
        ) : (
          <span />
        )}
        <Button
          onClick={() => saveПроцедура.mutate()}
          disabled={saveПроцедура.isОжидание || !editЧерновик.title.trim()}
        >
          <Сохранить classИмя="mr-2 h-4 w-4" />
          Сохранить routine
        </Button>
      </div>

      <Separator classИмя="md:hidden" />

      {/* Tabs (mobile only — desktop renders in the right properties panel) */}
      <div classИмя="md:hidden">
        {activityTabsPanel}
      </div>

      <ПроцедураЗапуститьVariablesDialog
        open={runVariablesOpen}
        onOpenChange={setЗапуститьVariablesOpen}
        companyId={routine.companyId}
        routineИмя={routine.title}
        agents={agents ?? []}
        projects={projects ?? []}
        defaultProjectId={routine.projectId}
        defaultИсполнительАгентId={routine.assigneeАгентId}
        variables={routine.variables ?? []}
        isОжидание={runПроцедура.isОжидание}
        onОтправить={(data) => runПроцедура.mutate(data)}
      />

      <TriggerDialog
        open={triggerDialogOpen}
        onOpenChange={(next) => {
          setTriggerDialogOpen(next);
          if (!next) setИзменитьingTrigger(null);
        }}
        trigger={editingTrigger}
        fallbackTimezone={getLocalTimezone()}
        submitting={createTrigger.isОжидание || updateTrigger.isОжидание}
        onОтправить={({ id, body }) => {
          if (id) {
            updateTrigger.mutate({ id, patch: body });
          } else {
            createTrigger.mutate(body);
          }
        }}
      />

      <ПодтвердитьDialog
        open={!!triggerОжиданиеУдалить}
        onOpenChange={(next) => {
          if (!next) setTriggerОжиданиеУдалить(null);
        }}
        title="Удалить trigger?"
        description={
          triggerОжиданиеУдалить
            ? `"${triggerОжиданиеУдалить.label ?? triggerОжиданиеУдалить.kind}" will be removed. This can't be undone.`
            : undefined
        }
        confirmLabel="Удалить"
        destructive
        busy={deleteTrigger.isОжидание}
        onПодтвердить={() => {
          if (triggerОжиданиеУдалить) deleteTrigger.mutate(triggerОжиданиеУдалить.id);
        }}
      />
    </div>
  );
}
