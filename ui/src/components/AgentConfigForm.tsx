import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Агент,
  АдаптерОкружениеПроверитьResult,
  КомпанияСекрет,
  EnvBinding,
  Окружение,
} from "@paperclipai/shared";
import { AGENT_DEFAULT_MAX_CONCURRENT_RUNS, supportedОкружениеDriversForАдаптер } from "@paperclipai/shared";
import type { АдаптерМодель } from "../api/agents";
import { agentsApi } from "../api/agents";
import { environmentsApi } from "../api/environments";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { secretsApi } from "../api/secrets";
import { assetsApi } from "../api/assets";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { DEFAULT_OPENCODE_LOCAL_MODEL } from "@paperclipai/adapter-opencode-local";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ПапкаOpen, Heart, ChevronDown, X } from "lucide-react";
import { asBoolean, asFiniteNumber, asObject, cn } from "../lib/utils";
import { extractМодельИмя, extractПровайдерId } from "../lib/model-utils";
import { queryКлючs } from "../lib/queryКлючs";
import { useКомпания } from "../context/КомпанияContext";
import {
  Field,
  ToggleField,
  ToggleWithNumber,
  CollapsibleSection,
  ЧерновикInput,
  ЧерновикNumberInput,
  help,
  adapterЯрлыки,
} from "./agent-config-primitives";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { defaultСоздатьЗначениеs } from "./agent-config-defaults";
import { getUIАдаптер } from "../adapters";
import { ClaudeLocalДополнительноFields } from "../adapters/claude-local/config-fields";
import { MarkdownИзменитьor } from "./MarkdownИзменитьor";
import { ChooseПутьButton } from "./ПутьInstructionsModal";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import { РепозиторийrtsToPicker } from "./РепозиторийrtsToPicker";
import { EnvVarИзменитьor } from "./EnvVarИзменитьor";
import { shouldShowLegacyРаботаingDirectoryField } from "../lib/legacy-agent-config";
import { listАдаптерOptions, listVisibleАдаптерТипs } from "../adapters/metadata";
import { getАдаптерDisplay, getАдаптерLabel } from "../adapters/adapter-display-registry";
import { useОтключитьdАдаптерыSync } from "../adapters/use-disabled-adapters";
import { buildАгентОбновитьPatch, type АгентConfigOverlay } from "../lib/agent-config-patch";
import { useАдаптерCapabilities } from "../adapters/use-adapter-capabilities";
import { filterAcpxМодельsByАгент } from "../lib/acpx-model-filter";

/* ---- Создать mode values ---- */

// Canonical type lives in @paperclipai/adapter-utils; re-exported here
// so existing imports from this file keep working.
export type { СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";
import type { СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";

/* ---- Props ---- */

type АгентConfigFormProps = {
  adapterМодельs?: АдаптерМодель[];
  onDirtyChange?: (dirty: boolean) => void;
  onСохранитьActionChange?: (save: (() => void) | null) => void;
  onОтменаActionChange?: (cancel: (() => void) | null) => void;
  onПроверитьActionChange?: (test: (() => void) | null) => void;
  onПроверитьActionStateChange?: (state: { disabled: boolean; pending: boolean }) => void;
  onПроверитьFeedbackChange?: (feedback: {
    errorMessage: string | null;
    result: АдаптерОкружениеПроверитьResult | null;
  }) => void;
  hideInlineСохранить?: boolean;
  showАдаптерТипField?: boolean;
  showАдаптерПроверитьОкружениеButton?: boolean;
  showСоздатьЗапуститьPolicySection?: boolean;
  hideInstructionsFile?: boolean;
  /** Hide the prompt template field from the Identity section (used when it's shown in a separate Prompts tab). */
  hidePromptTemplate?: boolean;
  /** "cards" renders each section as heading + bordered card (for settings pages). По умолчанию: "inline" (border-b dividers). */
  sectionLayout?: "inline" | "cards";
} & (
  | {
      mode: "create";
      values: СоздатьConfigЗначениеs;
      onChange: (patch: Partial<СоздатьConfigЗначениеs>) => void;
    }
  | {
      mode: "edit";
      agent: Агент;
      onСохранить: (patch: Record<string, unknown>) => void;
      isSaving?: boolean;
    }
);

/* ---- Изменить mode overlay (dirty tracking) ---- */

const emptyOverlay: АгентConfigOverlay = {
  identity: {},
  adapterConfig: {},
  heartbeat: {},
  runtime: {},
};

/** Stable empty object used as fallback for missing env config to avoid new-object-per-render. */
const EMPTY_ENV: Record<string, EnvBinding> = {};

function isOverlayDirty(o: АгентConfigOverlay): boolean {
  return (
    Object.keys(o.identity).length > 0 ||
    o.adapterТип !== undefined ||
    Object.keys(o.adapterConfig).length > 0 ||
    Object.keys(o.heartbeat).length > 0 ||
    Object.keys(o.runtime).length > 0 ||
    o.modelПрофильs?.cheap !== undefined
  );
}

/* ---- Shared input class ---- */
const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatArgList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }
  return typeof value === "string" ? value : "";
}

const codexThinkingEffortOptions = [
  { id: "", label: "Авто" },
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "xhigh", label: "X-Высокий" },
] as const;

const openCodeThinkingEffortOptions = [
  { id: "", label: "Авто" },
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "xhigh", label: "X-Высокий" },
  { id: "max", label: "Max" },
] as const;

const cursorModeOptions = [
  { id: "", label: "Авто" },
  { id: "plan", label: "Plan" },
  { id: "ask", label: "Ask" },
] as const;

const claudeThinkingEffortOptions = [
  { id: "", label: "Авто" },
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
] as const;

const MAX_TURN_CONTINUATION_DEFAULT_MAX_ATTEMPTS = 2;
const MAX_TURN_CONTINUATION_MAX_ATTEMPTS_CAP = 10;
const MAX_TURN_CONTINUATION_DEFAULT_DELAY_SEC = 1;
const MAX_TURN_CONTINUATION_MAX_DELAY_SEC = 300;

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampDelayMsFromSeconds(value: number) {
  return clampInteger(value, 0, MAX_TURN_CONTINUATION_MAX_DELAY_SEC) * 1000;
}


/* ---- Form ---- */

export function АгентConfigForm(props: АгентConfigFormProps) {
  const { mode, adapterМодельs: externalМодельs } = props;
  const isСоздать = mode === "create";
  const cards = props.sectionLayout === "cards";
  const showАдаптерТипField = props.showАдаптерТипField ?? true;
  const showАдаптерПроверитьОкружениеButton = props.showАдаптерПроверитьОкружениеButton ?? true;
  const showInlineАдаптерПроверитьОкружениеButton =
    showАдаптерПроверитьОкружениеButton && !props.onПроверитьActionChange;
  const showInlineАдаптерПроверитьОкружениеFeedback = !props.onПроверитьFeedbackChange;
  const showСоздатьЗапуститьPolicySection = props.showСоздатьЗапуститьPolicySection ?? true;
  const hideInstructionsFile = props.hideInstructionsFile ?? false;
  const { selectedКомпанияId } = useКомпания();
  const queryClient = useQueryClient();

  // Sync disabled adapter types from server so dropdown filters them out
  const disabledТипs = useОтключитьdАдаптерыSync();

  const { data: availableСекреты = [] } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.secrets.list(selectedКомпанияId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });
  const environmentsВключитьd = experimentalНастройки?.enableОкружения === true;

  const { data: environments = [] } = useQuery<Окружение[]>({
    queryКлюч: selectedКомпанияId ? queryКлючs.environments.list(selectedКомпанияId) : ["environments", "none"],
    queryFn: () => environmentsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId) && environmentsВключитьd,
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

  const uploadMarkdownImage = useMutation({
    mutationFn: async ({ file, namespace }: { file: File; namespace: string }) => {
      if (!selectedКомпанияId) throw new Ошибка("Select a company to upload images");
      return assetsApi.uploadImage(selectedКомпанияId, file, namespace);
    },
  });

  // ---- Изменить mode: overlay for dirty tracking ----
  const [overlay, setOverlay] = useState<АгентConfigOverlay>(emptyOverlay);
  const agentRef = useRef<Агент | null>(null);

  // Очистить overlay when agent data refreshes (after save)
  useEffect(() => {
    if (!isСоздать) {
      if (agentRef.current !== null && props.agent !== agentRef.current) {
        setOverlay({ ...emptyOverlay });
      }
      agentRef.current = props.agent;
    }
  }, [isСоздать, !isСоздать ? props.agent : undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !isСоздать && isOverlayDirty(overlay);

  type RecordOverlayGroup = "identity" | "adapterConfig" | "heartbeat" | "runtime";

  /** Read effective value: overlay if dirty, else original */
  function eff<T>(group: RecordOverlayGroup, field: string, original: T): T {
    const o = overlay[group];
    if (field in o) return o[field] as T;
    return original;
  }

  /** Mark field dirty in overlay */
  function mark(group: RecordOverlayGroup, field: string, value: unknown) {
    setOverlay((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
  }

  /** Build accumulated patch and send to parent */
  const handleОтмена = useCallback(() => {
    setOverlay({ ...emptyOverlay });
  }, []);

  const handleСохранить = useCallback(() => {
    if (isСоздать || !isDirty) return;
    props.onСохранить(buildАгентОбновитьPatch(props.agent, overlay));
  }, [isСоздать, isDirty, overlay, props]);

  useEffect(() => {
    if (!isСоздать) {
      props.onDirtyChange?.(isDirty);
      props.onСохранитьActionChange?.(handleСохранить);
      props.onОтменаActionChange?.(handleОтмена);
    }
  }, [isСоздать, isDirty, props.onDirtyChange, props.onСохранитьActionChange, props.onОтменаActionChange, handleСохранить, handleОтмена]);

  useEffect(() => {
    if (isСоздать) return;
    return () => {
      props.onСохранитьActionChange?.(null);
      props.onОтменаActionChange?.(null);
      props.onDirtyChange?.(false);
    };
  }, [isСоздать, props.onDirtyChange, props.onСохранитьActionChange, props.onОтменаActionChange]);

  // ---- Resolve values ----
  const config = !isСоздать ? ((props.agent.adapterConfig ?? {}) as Record<string, unknown>) : {};
  const runtimeConfig = !isСоздать ? ((props.agent.runtimeConfig ?? {}) as Record<string, unknown>) : {};
  const heartbeat = !isСоздать ? ((runtimeConfig.heartbeat ?? {}) as Record<string, unknown>) : {};

  const adapterТип = isСоздать
    ? props.values.adapterТип
    : overlay.adapterТип ?? props.agent.adapterТип;
  const getCapabilities = useАдаптерCapabilities();
  const adapterCaps = getCapabilities(adapterТип);
  const isLocal = adapterCaps.supportsInstructionsBundle || adapterCaps.supportsНавыки || adapterCaps.supportsLocalАгентJwt;
  
  const showLegacyРаботаingDirectoryField =
    isLocal && shouldShowLegacyРаботаingDirectoryField({ isСоздать, adapterConfig: config });
  const uiАдаптер = useMemo(() => getUIАдаптер(adapterТип), [adapterТип]);
  const supportedОкружениеDrivers = useMemo(
    () => new Set(supportedОкружениеDriversForАдаптер(adapterТип)),
    [adapterТип],
  );
  const val = isСоздать ? props.values : null;
  const set = isСоздать
    ? (patch: Partial<СоздатьConfigЗначениеs>) => props.onChange(patch)
    : null;
  const currentПо умолчаниюОкружениеId = isСоздать
    ? val!.defaultОкружениеId ?? ""
    : eff("identity", "defaultОкружениеId", props.agent.defaultОкружениеId ?? "");
  const currentПо умолчаниюОкружение = useMemo(
    () => environments.find((environment) => environment.id === currentПо умолчаниюОкружениеId) ?? null,
    [currentПо умолчаниюОкружениеId, environments],
  );
  const runnableОкружения = useMemo(
    () => environments.filter((environment) => {
      if (!supportedОкружениеDrivers.has(environment.driver)) return false;
      if (environment.driver !== "sandbox") return true;
      const provider = typeof environment.config?.provider === "string" ? environment.config.provider : null;
      return provider !== null && provider !== "fake";
    }),
    [environments, supportedОкружениеDrivers],
  );

  // Fetch adapter models for the effective adapter type
  const modelQueryКлюч = selectedКомпанияId
    ? queryКлючs.agents.adapterМодельs(selectedКомпанияId, adapterТип, currentПо умолчаниюОкружениеId || null)
    : ["agents", "none", "adapter-models", adapterТип];
  const {
    data: fetchedМодельs,
    error: fetchedМодельsОшибка,
  } = useQuery({
    queryКлюч: modelQueryКлюч,
    queryFn: () => agentsApi.adapterМодельs(selectedКомпанияId!, adapterТип, {
      environmentId: currentПо умолчаниюОкружениеId || null,
    }),
    enabled: Boolean(selectedКомпанияId),
  });
  const [refreshМодельsОшибка, setОбновитьМодельsОшибка] = useState<string | null>(null);
  const [refreshingМодельs, setОбновитьingМодельs] = useState(false);
  const rawМодельs = fetchedМодельs ?? externalМодельs ?? [];
  const adapterКомандаField =
    adapterТип === "hermes_local" ? "hermesКоманда" : "command";
  const acpxАгент =
    adapterТип === "acpx_local"
      ? isСоздать
        ? String(val!.adapterSchemaЗначениеs?.agent ?? "claude")
        : eff("adapterConfig", "agent", String(config.agent ?? "claude"))
      : "";
  const models = useMemo(
    () => adapterТип === "acpx_local"
      ? filterAcpxМодельsByАгент(rawМодельs, acpxАгент)
      : rawМодельs,
    [adapterТип, rawМодельs, acpxАгент],
  );
  const {
    data: detectedМодельData,
    refetch: refetchDetectedМодель,
  } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.agents.detectМодель(selectedКомпанияId, adapterТип)
      : ["agents", "none", "detect-model", adapterТип],
    queryFn: () => {
      if (!selectedКомпанияId) {
        throw new Ошибка("Select a company to detect the model");
      }
      return agentsApi.detectМодель(selectedКомпанияId, adapterТип);
    },
    enabled: Boolean(selectedКомпанияId && isLocal && adapterТип !== "opencode_local"),
  });
  const detectedМодель = detectedМодельData?.model ?? null;
  const detectedМодельCandidates = detectedМодельData?.candidates ?? [];

  const { data: companyАгенты = [] } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.agents.list(selectedКомпанияId) : ["agents", "none", "list"],
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: Boolean(!isСоздать && selectedКомпанияId),
  });

  /** Props passed to adapter-specific config field components */
  const adapterFieldProps = {
    mode,
    isСоздать,
    adapterТип,
    values: isСоздать ? props.values : null,
    set: isСоздать ? (patch: Partial<СоздатьConfigЗначениеs>) => props.onChange(patch) : null,
    config,
    eff: eff as <T>(group: "adapterConfig", field: string, original: T) => T,
    mark: mark as (group: "adapterConfig", field: string, value: unknown) => void,
    models,
    hideInstructionsFile,
  };

  // Section toggle state — advanced always starts collapsed
  const [runPolicyДополнительноOpen, setЗапуститьPolicyДополнительноOpen] = useState(false);
  // Popover states
  const [modelOpen, setМодельOpen] = useState(false);
  const [cheapМодельOpen, setCheapМодельOpen] = useState(false);
  const [thinkingEffortOpen, setThinkingEffortOpen] = useState(false);

  // Cheap model profile state — only relevant when the adapter advertises
  // `supportsМодельПрофильs`. По умолчаниюs are sourced from the adapter's
  // /model-profiles endpoint so the UI does not encode adapter-specific
  // cheap defaults.
  const supportsМодельПрофильs = adapterCaps.supportsМодельПрофильs;
  const { data: adapterCheapПрофильDefinitions } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.agents.adapterМодельПрофильs(selectedКомпанияId, adapterТип)
      : ["agents", "none", "adapter-model-profiles", adapterТип],
    queryFn: () => agentsApi.adapterМодельПрофильs(selectedКомпанияId!, adapterТип),
    enabled: Boolean(selectedКомпанияId) && supportsМодельПрофильs,
  });
  const adapterCheapПо умолчанию = useMemo(() => {
    return (adapterCheapПрофильDefinitions ?? []).find((profile) => profile.key === "cheap") ?? null;
  }, [adapterCheapПрофильDefinitions]);
  const adapterCheapПо умолчаниюМодель = useMemo(() => {
    const adapterConfig = adapterCheapПо умолчанию?.adapterConfig ?? {};
    const value = (adapterConfig as Record<string, unknown>).model;
    return typeof value === "string" ? value : "";
  }, [adapterCheapПо умолчанию]);

  function buildАдаптерConfigForПроверить(): Record<string, unknown> {
    if (isСоздать) {
      return uiАдаптер.buildАдаптерConfig(val!);
    }
    const base = config as Record<string, unknown>;
    const next = { ...base, ...overlay.adapterConfig };
    if (adapterТип === "hermes_local") {
      const hermesКоманда =
        typeof next.hermesКоманда === "string" && next.hermesКоманда.length > 0
          ? next.hermesКоманда
          : typeof next.command === "string" && next.command.length > 0
            ? next.command
            : undefined;
      if (hermesКоманда) {
        next.hermesКоманда = hermesКоманда;
      }
    }
    return next;
  }

  const testОкружение = useMutation({
    mutationFn: async () => {
      if (!selectedКомпанияId) {
        throw new Ошибка("Select a company to test adapter environment");
      }
      return agentsApi.testОкружение(selectedКомпанияId, adapterТип, {
        adapterConfig: buildАдаптерConfigForПроверить(),
        environmentId: currentПо умолчаниюОкружениеId || null,
      });
    },
  });
  const testОкружениеОтключитьd = testОкружение.isОжидание || !selectedКомпанияId;
  const triggerПроверитьОкружение = useCallback(() => {
    if (testОкружениеОтключитьd) return;
    testОкружение.mutate();
  }, [testОкружение.mutate, testОкружениеОтключитьd]);

  useEffect(() => {
    if (!showАдаптерПроверитьОкружениеButton || !props.onПроверитьActionChange) return;
    props.onПроверитьActionChange(triggerПроверитьОкружение);
    return () => {
      props.onПроверитьActionChange?.(null);
    };
  }, [showАдаптерПроверитьОкружениеButton, props.onПроверитьActionChange, triggerПроверитьОкружение]);

  useEffect(() => {
    if (!showАдаптерПроверитьОкружениеButton || !props.onПроверитьActionStateChange) return;
    props.onПроверитьActionStateChange({
      disabled: testОкружениеОтключитьd,
      pending: testОкружение.isОжидание,
    });
    return () => {
      props.onПроверитьActionStateChange?.({ disabled: true, pending: false });
    };
  }, [
    showАдаптерПроверитьОкружениеButton,
    props.onПроверитьActionStateChange,
    testОкружениеОтключитьd,
    testОкружение.isОжидание,
  ]);

  useEffect(() => {
    if (!props.onПроверитьFeedbackChange) return;
    props.onПроверитьFeedbackChange({
      errorMessage: testОкружение.error instanceof Ошибка
        ? testОкружение.error.message
        : testОкружение.error
          ? "Окружение test failed"
          : null,
      result: testОкружение.data ?? null,
    });
    return () => {
      props.onПроверитьFeedbackChange?.({ errorMessage: null, result: null });
    };
  }, [props.onПроверитьFeedbackChange, testОкружение.data, testОкружение.error]);

  // Current model for display
  const currentМодельId = isСоздать
    ? val!.model
    : eff("adapterConfig", "model", String(config.model ?? ""));

  async function handleОбновитьМодельs() {
    if (!selectedКомпанияId) return;
    setОбновитьingМодельs(true);
    setОбновитьМодельsОшибка(null);
    try {
      const refreshed = await agentsApi.adapterМодельs(selectedКомпанияId, adapterТип, { refresh: true });
      queryClient.setQueryData(modelQueryКлюч, refreshed);
    } catch (error) {
      setОбновитьМодельsОшибка(error instanceof Ошибка ? error.message : "Ошибка to refresh adapter models.");
    } finally {
      setОбновитьingМодельs(false);
    }
  }

  const thinkingEffortКлюч =
    adapterТип === "codex_local"
      ? "modelReasoningEffort"
      : adapterТип === "acpx_local" && acpxАгент === "codex"
        ? "modelReasoningEffort"
        : adapterТип === "cursor"
          ? "mode"
          : adapterТип === "opencode_local"
            ? "variant"
            : "effort";
  const thinkingEffortOptions =
    adapterТип === "codex_local"
      ? codexThinkingEffortOptions
      : adapterТип === "acpx_local" && acpxАгент === "codex"
        ? codexThinkingEffortOptions
        : adapterТип === "cursor"
          ? cursorModeOptions
          : adapterТип === "opencode_local"
            ? openCodeThinkingEffortOptions
            : claudeThinkingEffortOptions;
  const currentThinkingEffort = isСоздать
    ? val!.thinkingEffort
    : adapterТип === "codex_local"
      ? eff(
          "adapterConfig",
          "modelReasoningEffort",
          String(config.modelReasoningEffort ?? config.reasoningEffort ?? ""),
        )
      : adapterТип === "acpx_local" && acpxАгент === "codex"
        ? eff(
            "adapterConfig",
            "modelReasoningEffort",
            String(config.modelReasoningEffort ?? config.reasoningEffort ?? config.effort ?? ""),
          )
        : adapterТип === "cursor"
          ? eff("adapterConfig", "mode", String(config.mode ?? ""))
          : adapterТип === "opencode_local"
            ? eff("adapterConfig", "variant", String(config.variant ?? ""))
            : eff("adapterConfig", "effort", String(config.effort ?? ""));
  const showThinkingEffort = adapterТип !== "gemini_local" && adapterТип !== "cursor_cloud";
  const codexПоискВключитьd = adapterТип === "codex_local"
    ? (isСоздать ? Boolean(val!.search) : eff("adapterConfig", "search", Boolean(config.search)))
    : false;
  // Cheap profile read/write helpers. Изменить-mode values come from
  // runtimeConfig.modelПрофильs.cheap with overlay overrides on top; create-mode
  // values come straight from СоздатьConfigЗначениеs (cheapМодель + cheapМодельВключитьd).
  const cheapПрофильFromАгент = useMemo(() => {
    const profiles = (runtimeConfig.modelПрофильs ?? {}) as Record<string, unknown>;
    const cheap = (profiles.cheap ?? {}) as Record<string, unknown>;
    const cheapАдаптерConfig = (cheap.adapterConfig ?? {}) as Record<string, unknown>;
    return {
      enabled: cheap.enabled !== false,
      model: typeof cheapАдаптерConfig.model === "string" ? cheapАдаптерConfig.model : "",
    };
  }, [runtimeConfig]);
  const cheapOverlay = !isСоздать ? overlay.modelПрофильs?.cheap : undefined;
  const currentCheapВключитьd = isСоздать
    ? val!.cheapМодельВключитьd ?? false
    : cheapOverlay?.enabled ?? cheapПрофильFromАгент.enabled;
  const currentCheapМодель = isСоздать
    ? val!.cheapМодель ?? ""
    : (() => {
        const overlayМодель = (cheapOverlay?.adapterConfig as Record<string, unknown> | undefined)?.model;
        if (typeof overlayМодель === "string") return overlayМодель;
        return cheapПрофильFromАгент.model;
      })();

  function setCheapВключитьd(next: boolean) {
    if (isСоздать) {
      set!({ cheapМодельВключитьd: next });
      return;
    }
    setOverlay((prev) => ({
      ...prev,
      modelПрофильs: {
        cheap: {
          ...(prev.modelПрофильs?.cheap ?? {}),
          enabled: next,
        },
      },
    }));
  }

  function setCheapМодель(next: string) {
    if (isСоздать) {
      set!({ cheapМодель: next });
      return;
    }
    setOverlay((prev) => {
      const existing = prev.modelПрофильs?.cheap ?? {};
      const nextАдаптерConfig = {
        ...((existing.adapterConfig ?? {}) as Record<string, unknown>),
        model: next || undefined,
      };
      return {
        ...prev,
        modelПрофильs: {
          cheap: {
            ...existing,
            adapterConfig: nextАдаптерConfig,
          },
        },
      };
    });
  }

  const effectiveЗапуститьtimeConfig = useMemo(() => {
    if (isСоздать) {
      return {
        heartbeat: {
          enabled: val!.heartbeatВключитьd,
          intervalSec: val!.intervalSec,
        },
      };
    }
    const mergedHeartbeat = {
      ...(runtimeConfig.heartbeat && typeof runtimeConfig.heartbeat === "object"
        ? runtimeConfig.heartbeat as Record<string, unknown>
        : {}),
      ...overlay.heartbeat,
    };
    return {
      ...runtimeConfig,
      heartbeat: mergedHeartbeat,
    };
  }, [isСоздать, overlay.heartbeat, runtimeConfig, val]);
  const effectiveHeartbeat = asObject(effectiveЗапуститьtimeConfig.heartbeat);
  const maxTurnContinuation = asObject(effectiveHeartbeat.maxTurnContinuation);
  const maxTurnContinuationВключитьd = asBoolean(maxTurnContinuation.enabled, true);
  const maxTurnContinuationMaxAttempts = clampInteger(
    asFiniteNumber(maxTurnContinuation.maxAttempts, MAX_TURN_CONTINUATION_DEFAULT_MAX_ATTEMPTS),
    0,
    MAX_TURN_CONTINUATION_MAX_ATTEMPTS_CAP,
  );
  const maxTurnContinuationDelaySec = clampInteger(
    asFiniteNumber(maxTurnContinuation.delayMs, MAX_TURN_CONTINUATION_DEFAULT_DELAY_SEC * 1000) / 1000,
    0,
    MAX_TURN_CONTINUATION_MAX_DELAY_SEC,
  );

  function updateMaxTurnContinuation(patch: Record<string, unknown>) {
    mark("heartbeat", "maxTurnContinuation", {
      ...maxTurnContinuation,
      ...patch,
    });
  }

  return (
    <div classИмя={cn("relative", cards && "space-y-6")}>
      {/* ---- Floating Сохранить button (edit mode, when dirty) ---- */}
      {isDirty && !props.hideInlineСохранить && (
        <div classИмя="sticky top-0 z-10 flex items-center justify-end px-4 py-2 bg-background/90 backdrop-blur-sm border-b border-primary/20">
          <div classИмя="flex items-center gap-3">
            <span classИмя="text-xs text-muted-foreground">Unsaved changes</span>
            <Button
              size="sm"
              onClick={handleСохранить}
              disabled={!isСоздать && props.isSaving}
            >
              {!isСоздать && props.isSaving ? "Saving..." : "Сохранить"}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Identity (edit only) ---- */}
      {!isСоздать && (
        <div classИмя={cn(!cards && "border-b border-border")}>
          {cards
            ? <h3 classИмя="text-sm font-medium mb-3">Identity</h3>
            : <div classИмя="px-4 py-2 text-xs font-medium text-muted-foreground">Identity</div>
          }
          <div classИмя={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
            <Field label="Имя" hint={help.name}>
              <ЧерновикInput
                value={eff("identity", "name", props.agent.name)}
                onCommit={(v) => mark("identity", "name", v)}
                immediate
                classИмя={inputClass}
                placeholder="Агент name"
              />
            </Field>
            <Field label="Название" hint={help.title}>
              <ЧерновикInput
                value={eff("identity", "title", props.agent.title ?? "")}
                onCommit={(v) => mark("identity", "title", v || null)}
                immediate
                classИмя={inputClass}
                placeholder="e.g. VP of Инженерing"
              />
            </Field>
            <Field label="Репозиторийrts to" hint={help.reportsTo}>
              <РепозиторийrtsToPicker
                agents={companyАгенты}
                value={eff("identity", "reportsTo", props.agent.reportsTo ?? null)}
                onChange={(id) => mark("identity", "reportsTo", id)}
                excludeАгентIds={[props.agent.id]}
                chooseLabel="Choose manager…"
              />
            </Field>
            <Field label="Capabilities" hint={help.capabilities}>
              <MarkdownИзменитьor
                value={eff("identity", "capabilities", props.agent.capabilities ?? "") ?? ""}
                onChange={(v) => mark("identity", "capabilities", v || null)}
                placeholder="Describe what this agent can do..."
                contentClassИмя="min-h-[44px] text-sm font-mono"
                imageЗагрузитьHandler={async (file) => {
                  const asset = await uploadMarkdownImage.mutateAsync({
                    file,
                    namespace: `agents/${props.agent.id}/capabilities`,
                  });
                  return asset.contentПуть;
                }}
              />
            </Field>
            {isLocal && !props.hidePromptTemplate && (
              <>
                <Field label="Prompt Template" hint={help.promptTemplate}>
                  <MarkdownИзменитьor
                    value={eff(
                      "adapterConfig",
                      "promptTemplate",
                      String(config.promptTemplate ?? ""),
                    )}
                    onChange={(v) => mark("adapterConfig", "promptTemplate", v ?? "")}
                    placeholder="You are agent {{ agent.name }}. Your role is {{ agent.role }}..."
                    contentClassИмя="min-h-[88px] text-sm font-mono"
                    imageЗагрузитьHandler={async (file) => {
                      const namespace = `agents/${props.agent.id}/prompt-template`;
                      const asset = await uploadMarkdownImage.mutateAsync({ file, namespace });
                      return asset.contentПуть;
                    }}
                  />
                </Field>
                <div classИмя="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Prompt template is replayed on every heartbeat. Keep it compact and dynamic to avoid recurring token cost and cache churn.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Execution ---- */}
      {environmentsВключитьd ? (
        <div classИмя={cn(!cards && (isСоздать ? "border-t border-border" : "border-b border-border"))}>
          {cards
            ? <h3 classИмя="text-sm font-medium mb-3">Execution</h3>
            : <div classИмя="px-4 py-2 text-xs font-medium text-muted-foreground">Execution</div>
          }
          <div classИмя={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
            <Field
              label="По умолчанию environment"
              hint="Агент-level default execution target. Project and issue settings can still override this."
            >
              <select
                classИмя={inputClass}
                value={currentПо умолчаниюОкружениеId}
                onChange={(event) => {
                  const nextЗначение = event.target.value;
                  if (isСоздать) {
                    set!({ defaultОкружениеId: nextЗначение });
                    return;
                  }
                  mark("identity", "defaultОкружениеId", nextЗначение || null);
                }}
              >
                <option value="">Компания default (Local)</option>
                {runnableОкружения.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name} · {environment.driver}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      ) : null}

      {/* ---- Адаптер ---- */}
      <div classИмя={cn(!cards && (isСоздать ? "border-t border-border" : "border-b border-border"))}>
        <div classИмя={cn(cards ? "flex items-center justify-between mb-3" : "px-4 py-2 flex items-center justify-between gap-2")}>
          {cards
            ? <h3 classИмя="text-sm font-medium">Адаптер</h3>
            : <span classИмя="text-xs font-medium text-muted-foreground">Адаптер</span>
          }
          {showInlineАдаптерПроверитьОкружениеButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              classИмя="h-7 px-2.5 text-xs"
              onClick={triggerПроверитьОкружение}
              disabled={testОкружениеОтключитьd}
            >
              {testОкружение.isОжидание ? "Проверитьing..." : "Проверить"}
            </Button>
          )}
        </div>
        <div classИмя={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
          {showАдаптерТипField && (
            <Field label="Адаптер type" hint={help.adapterТип}>
              <АдаптерТипDropdown
                value={adapterТип}
                disabledТипs={disabledТипs}
                onChange={(t) => {
                  if (isСоздать) {
                    // Сбросить all adapter-specific fields to defaults when switching adapter type
                    const { adapterТип: _at, ...defaults } = defaultСоздатьЗначениеs;
                    const nextЗначениеs: СоздатьConfigЗначениеs = { ...defaults, adapterТип: t };
                    if (t === "codex_local") {
                      nextЗначениеs.model = DEFAULT_CODEX_LOCAL_MODEL;
                      nextЗначениеs.dangerouslyBypassSandbox =
                        DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
                    } else if (t === "gemini_local") {
                      nextЗначениеs.model = DEFAULT_GEMINI_LOCAL_MODEL;
                    } else if (t === "cursor") {
                      nextЗначениеs.model = DEFAULT_CURSOR_LOCAL_MODEL;
                    } else if (t === "opencode_local") {
                      nextЗначениеs.model = DEFAULT_OPENCODE_LOCAL_MODEL;
                    }
                    set!(nextЗначениеs);
                  } else {
                    // Очистить all adapter config and explicitly blank out model + effort/mode keys
                    // so the old adapter's values don't bleed through via eff()
                    setOverlay((prev) => ({
                      ...prev,
                      adapterТип: t,
                      modelПрофильs: { cheap: { cleared: true } },
                      adapterConfig: {
                        model:
                          t === "codex_local"
                            ? DEFAULT_CODEX_LOCAL_MODEL
                            : t === "gemini_local"
                              ? DEFAULT_GEMINI_LOCAL_MODEL
                            : t === "opencode_local"
                              ? DEFAULT_OPENCODE_LOCAL_MODEL
                            : t === "cursor"
                              ? DEFAULT_CURSOR_LOCAL_MODEL
                              : "",
                        effort: "",
                        modelReasoningEffort: "",
                        variant: "",
                        mode: "",
                        ...(t === "codex_local"
                          ? {
                              dangerouslyBypassСогласованияAndSandbox:
                                DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
                            }
                          : {}),
                      },
                    }));
                  }
                }}
              />
            </Field>
          )}

          {showInlineАдаптерПроверитьОкружениеFeedback && testОкружение.error && (
            <div classИмя="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {testОкружение.error instanceof Ошибка
                ? testОкружение.error.message
                : "Окружение test failed"}
            </div>
          )}

          {showInlineАдаптерПроверитьОкружениеFeedback && testОкружение.data && (
            <АдаптерОкружениеResult result={testОкружение.data} />
          )}

          {/* Рабочая директория */}
          {showLegacyРаботаingDirectoryField && (
            <Field label="Рабочая директория (deprecated)" hint={help.cwd}>
              <div classИмя="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                <ПапкаOpen classИмя="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <ЧерновикInput
                  value={
                    isСоздать
                      ? val!.cwd
                      : eff("adapterConfig", "cwd", String(config.cwd ?? ""))
                  }
                  onCommit={(v) =>
                    isСоздать
                      ? set!({ cwd: v })
                      : mark("adapterConfig", "cwd", v || undefined)
                  }
                  immediate
                  classИмя="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                  placeholder="/path/to/project"
                />
                <ChooseПутьButton />
              </div>
            </Field>
          )}

          {/* Адаптер-specific fields are rendered inside Permissions & Конфигурация */}
        </div>

      </div>

      {/* ---- Permissions & Конфигурация ---- */}
      {isLocal && (
        <div classИмя={cn(!cards && "border-b border-border")}>
          {cards
            ? <h3 classИмя="text-sm font-medium mb-3">Permissions &amp; Конфигурация</h3>
            : <div classИмя="px-4 py-2 text-xs font-medium text-muted-foreground">Permissions &amp; Конфигурация</div>
          }
          <div classИмя={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
              <Field label="Команда" hint={help.localКоманда}>
                <ЧерновикInput
                  value={
                    isСоздать
                      ? val!.command
                      : eff(
                          "adapterConfig",
                          adapterКомандаField,
                          String(
                            (adapterТип === "hermes_local"
                              ? config.hermesКоманда ?? config.command
                              : config.command) ?? "",
                          ),
                        )
                  }
                  onCommit={(v) =>
                    isСоздать
                      ? set!({ command: v })
                      : mark("adapterConfig", adapterКомандаField, v || null)
                  }
                  immediate
                  classИмя={inputClass}
                  placeholder={
                    ({
                      claude_local: "claude",
                      codex_local: "codex",
                      gemini_local: "gemini",
                      pi_local: "pi",
                      cursor: "agent",
                      opencode_local: "opencode",
                    } as Record<string, string>)[adapterТип] ?? adapterТип.replace(/_local$/, "")
                  }
                />
              </Field>

              {supportsМодельПрофильs && (
                <div classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">Primary model</div>
              )}
              <МодельDropdown
                models={models}
                value={currentМодельId}
                onChange={(v) =>
                  isСоздать
                    ? set!({ model: v })
                    : mark("adapterConfig", "model", v || undefined)
                }
                open={modelOpen}
                onOpenChange={setМодельOpen}
                allowПо умолчанию={adapterТип !== "opencode_local"}
                required={adapterТип === "opencode_local"}
                groupByПровайдер={adapterТип === "opencode_local"}
                creatable
                detectedМодель={detectedМодель}
                detectedМодельCandidates={[]}
                onDetectМодель={adapterТип === "opencode_local"
                  ? undefined
                  : async () => {
                      const result = await refetchDetectedМодель();
                      return result.data?.model ?? null;
                    }}
                onОбновитьМодельs={
                  adapterТип === "codex_local" || adapterТип === "acpx_local"
                    ? handleОбновитьМодельs
                    : undefined
                }
                refreshingМодельs={refreshingМодельs}
                detectМодельLabel="Detect model"
                emptyDetectHint="Нет model detected. Select or enter one manually."
              />
              {(refreshМодельsОшибка || fetchedМодельsОшибка) && (
                <p classИмя="text-xs text-destructive">
                  {refreshМодельsОшибка
                    ?? (fetchedМодельsОшибка instanceof Ошибка
                      ? fetchedМодельsОшибка.message
                      : "Ошибка to load adapter models.")}
                </p>
              )}
              {adapterТип === "opencode_local"
                && currentПо умолчаниюОкружение
                && currentПо умолчаниюОкружение.driver !== "local" && (
                <p classИмя="text-xs text-muted-foreground">
                  Live OpenCode model discovery only runs for Local environments. Using the curated list and manual entry for {currentПо умолчаниюОкружение.name}.
                </p>
              )}

              {supportsМодельПрофильs && (
                <CheapМодельSection
                  enabled={currentCheapВключитьd}
                  model={currentCheapМодель}
                  models={models}
                  adapterТип={adapterТип}
                  adapterПо умолчаниюМодель={adapterCheapПо умолчаниюМодель}
                  onВключитьdChange={setCheapВключитьd}
                  onМодельChange={setCheapМодель}
                  open={cheapМодельOpen}
                  onOpenChange={setCheapМодельOpen}
                />
              )}

              {showThinkingEffort && (
                <>
                  <ThinkingEffortDropdown
                    value={currentThinkingEffort}
                    options={thinkingEffortOptions}
                    onChange={(v) =>
                      isСоздать
                        ? set!({ thinkingEffort: v })
                        : mark("adapterConfig", thinkingEffortКлюч, v || undefined)
                    }
                    open={thinkingEffortOpen}
                    onOpenChange={setThinkingEffortOpen}
                  />
                  {adapterТип === "codex_local" &&
                    codexПоискВключитьd &&
                    currentThinkingEffort === "minimal" && (
                      <p classИмя="text-xs text-amber-400">
                        Codex may reject `minimal` thinking when search is enabled.
                      </p>
                    )}
                </>
              )}
              {!isСоздать && typeof config.bootstrapPromptTemplate === "string" && config.bootstrapPromptTemplate && (
                <>
                  <Field label="Bootstrap prompt (legacy)" hint={help.bootstrapPrompt}>
                    <MarkdownИзменитьor
                      value={eff(
                        "adapterConfig",
                        "bootstrapPromptTemplate",
                        String(config.bootstrapPromptTemplate ?? ""),
                      )}
                      onChange={(v) =>
                        mark("adapterConfig", "bootstrapPromptTemplate", v || undefined)
                      }
                      placeholder="Опционально initial setup prompt for the first run"
                      contentClassИмя="min-h-[44px] text-sm font-mono"
                      imageЗагрузитьHandler={async (file) => {
                        const namespace = `agents/${props.agent.id}/bootstrap-prompt`;
                        const asset = await uploadMarkdownImage.mutateAsync({ file, namespace });
                        return asset.contentПуть;
                      }}
                    />
                  </Field>
                  <div classИмя="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Bootstrap prompt is legacy and will be removed in a future release. Consider moving this content into the agent&apos;s prompt template or instructions file instead.
                  </div>
                </>
              )}
              {adapterТип === "claude_local" && (
                <ClaudeLocalДополнительноFields {...adapterFieldProps} />
              )}
              <uiАдаптер.ConfigFields {...adapterFieldProps} />

              <Field label="Extra args (comma-separated)" hint={help.extraArgs}>
                <ЧерновикInput
                  value={
                    isСоздать
                      ? val!.extraArgs
                      : eff("adapterConfig", "extraArgs", formatArgList(config.extraArgs))
                  }
                  onCommit={(v) =>
                    isСоздать
                      ? set!({ extraArgs: v })
                      : mark("adapterConfig", "extraArgs", v?.trim() ? parseCommaArgs(v) : null)
                  }
                  immediate
                  classИмя={inputClass}
                  placeholder="e.g. --verbose, --foo=bar"
                />
              </Field>

              <Field label="Окружение variables" hint={help.envVars}>
                <EnvVarИзменитьor
                  value={
                    isСоздать
                      ? ((val!.envBindings ?? EMPTY_ENV) as Record<string, EnvBinding>)
                      : ((eff("adapterConfig", "env", (config.env ?? EMPTY_ENV) as Record<string, EnvBinding>))
                      )
                  }
                  secrets={availableСекреты}
                  onСоздатьСекрет={async (name, value) => {
                    const created = await createСекрет.mutateAsync({ name, value });
                    return created;
                  }}
                  onChange={(env) =>
                    isСоздать
                      ? set!({ envBindings: env ?? {}, envVars: "" })
                      : mark("adapterConfig", "env", env)
                  }
                />
              </Field>

              {/* Изменить-only: timeout + grace period */}
              {!isСоздать && (
                <>
                  <Field label="Timeout (sec)" hint={help.timeoutSec}>
                    <ЧерновикNumberInput
                      value={eff(
                        "adapterConfig",
                        "timeoutSec",
                        Number(config.timeoutSec ?? 0),
                      )}
                      onCommit={(v) => mark("adapterConfig", "timeoutSec", v)}
                      immediate
                      classИмя={inputClass}
                    />
                  </Field>
                  <Field label="Interrupt grace period (sec)" hint={help.graceSec}>
                    <ЧерновикNumberInput
                      value={eff(
                        "adapterConfig",
                        "graceSec",
                        Number(config.graceSec ?? 15),
                      )}
                      onCommit={(v) => mark("adapterConfig", "graceSec", v)}
                      immediate
                      classИмя={inputClass}
                    />
                  </Field>
                </>
              )}
          </div>
        </div>
      )}

      {/* ---- Запустить Policy ---- */}
      {isСоздать && showСоздатьЗапуститьPolicySection ? (
        <div classИмя={cn(!cards && "border-b border-border")}>
          {cards
            ? <h3 classИмя="text-sm font-medium flex items-center gap-2 mb-3"><Heart classИмя="h-3 w-3" /> Запустить Policy</h3>
            : <div classИмя="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2"><Heart classИмя="h-3 w-3" /> Запустить Policy</div>
          }
          <div classИмя={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
            <ToggleWithNumber
              label="Heartbeat on interval"
              hint={help.heartbeatInterval}
              checked={val!.heartbeatВключитьd}
              onCheckedChange={(v) => set!({ heartbeatВключитьd: v })}
              number={val!.intervalSec}
              onNumberChange={(v) => set!({ intervalSec: v })}
              numberLabel="sec"
              numberPrefix="Запустить heartbeat every"
              numberHint={help.intervalSec}
              showNumber={val!.heartbeatВключитьd}
            />
          </div>
        </div>
      ) : !isСоздать ? (
        <div classИмя={cn(!cards && "border-b border-border")}>
          {cards
            ? <h3 classИмя="text-sm font-medium flex items-center gap-2 mb-3"><Heart classИмя="h-3 w-3" /> Запустить Policy</h3>
            : <div classИмя="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2"><Heart classИмя="h-3 w-3" /> Запустить Policy</div>
          }
          <div classИмя={cn(cards ? "border border-border rounded-lg overflow-hidden" : "")}>
            <div classИмя={cn(cards ? "p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
              <ToggleWithNumber
                label="Heartbeat on interval"
                hint={help.heartbeatInterval}
                checked={eff("heartbeat", "enabled", heartbeat.enabled === true)}
                onCheckedChange={(v) => mark("heartbeat", "enabled", v)}
                number={eff("heartbeat", "intervalSec", Number(heartbeat.intervalSec ?? 300))}
                onNumberChange={(v) => mark("heartbeat", "intervalSec", v)}
                numberLabel="sec"
                numberPrefix="Запустить heartbeat every"
                numberHint={help.intervalSec}
                showNumber={eff("heartbeat", "enabled", heartbeat.enabled === true)}
              />
            </div>
            <CollapsibleSection
              title="Дополнительно Запустить Policy"
              bordered={cards}
              open={runPolicyДополнительноOpen}
              onToggle={() => setЗапуститьPolicyДополнительноOpen(!runPolicyДополнительноOpen)}
            >
            <div classИмя="space-y-3">
              <ToggleField
                label="Wake on demand"
                hint={help.wakeOnDemand}
                checked={eff(
                  "heartbeat",
                  "wakeOnDemand",
                  heartbeat.wakeOnDemand !== false,
                )}
                onChange={(v) => mark("heartbeat", "wakeOnDemand", v)}
              />
              <Field label="Cooldown (sec)" hint={help.cooldownSec}>
                <ЧерновикNumberInput
                  value={eff(
                    "heartbeat",
                    "cooldownSec",
                    Number(heartbeat.cooldownSec ?? 10),
                  )}
                  onCommit={(v) => mark("heartbeat", "cooldownSec", v)}
                  immediate
                  classИмя={inputClass}
                />
              </Field>
              <Field label="Max concurrent runs" hint={help.maxConcurrentЗапуститьs}>
                <ЧерновикNumberInput
                  value={eff(
                    "heartbeat",
                    "maxConcurrentЗапуститьs",
                    Number(heartbeat.maxConcurrentЗапуститьs ?? AGENT_DEFAULT_MAX_CONCURRENT_RUNS),
                  )}
                  onCommit={(v) => mark("heartbeat", "maxConcurrentЗапуститьs", v)}
                  immediate
                  classИмя={inputClass}
                />
              </Field>
              <div classИмя="rounded-md border border-border/70 px-3 py-2">
                <ToggleField
                  label="Продолжить after max-turn stop"
                  hint={help.maxTurnContinuationВключитьd}
                  checked={maxTurnContinuationВключитьd}
                  onChange={(v) => updateMaxTurnContinuation({ enabled: v })}
                />
                {maxTurnContinuationВключитьd ? (
                  <div classИмя="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Continuation attempts" hint={help.maxTurnContinuationMaxAttempts}>
                      <ЧерновикNumberInput
                        value={maxTurnContinuationMaxAttempts}
                        onCommit={(v) =>
                          updateMaxTurnContinuation({
                            maxAttempts: clampInteger(v, 0, MAX_TURN_CONTINUATION_MAX_ATTEMPTS_CAP),
                          })}
                        immediate
                        classИмя={inputClass}
                      />
                    </Field>
                    <Field label="Continuation delay (sec)" hint={help.maxTurnContinuationDelaySec}>
                      <ЧерновикNumberInput
                        value={maxTurnContinuationDelaySec}
                        onCommit={(v) =>
                          updateMaxTurnContinuation({
                            delayMs: clampDelayMsFromSeconds(v),
                          })}
                        immediate
                        classИмя={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </div>
          </CollapsibleSection>
          </div>
        </div>
      ) : null}

    </div>
  );
}

export function АдаптерОкружениеResult({ result }: { result: АдаптерОкружениеПроверитьResult }) {
  const statusLabel =
    result.status === "pass" ? "Passed" : result.status === "warn" ? "Предупреждениеs" : "Ошибка";
  const statusClass =
    result.status === "pass"
      ? "text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10"
      : result.status === "warn"
        ? "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10"
        : "text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10";

  return (
    <div classИмя={`rounded-md border px-3 py-2 text-xs ${statusClass}`}>
      <div classИмя="flex items-center justify-between gap-2">
        <span classИмя="font-medium">{statusLabel}</span>
        <span classИмя="text-[11px] opacity-80">
          {new Date(result.testedAt).toLocaleTimeString()}
        </span>
      </div>
      <div classИмя="mt-2 space-y-1.5">
        {result.checks.map((check, idx) => (
          <div key={`${check.code}-${idx}`} classИмя="text-[11px] leading-relaxed break-words">
            <span classИмя="font-medium uppercase tracking-wide opacity-80">
              {check.level}
            </span>
            <span classИмя="mx-1 opacity-60">·</span>
            <span>{check.message}</span>
            {check.detail && <span classИмя="block opacity-75 break-all">({check.detail})</span>}
            {check.hint && <span classИмя="block opacity-90 break-words">Hint: {check.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Internal sub-components ---- */

function АдаптерТипDropdown({
  value,
  onChange,
  disabledТипs,
}: {
  value: string;
  onChange: (type: string) => void;
  disabledТипs: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const selectedDisplay = getАдаптерDisplay(value);
  const adapterList = useMemo(
    () =>
      listАдаптерOptions((type) => adapterЯрлыки[type] ?? getАдаптерLabel(type)).filter(
        (item) => !disabledТипs.has(item.value),
      ),
    [disabledТипs],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
          <span classИмя="inline-flex min-w-0 items-center gap-1.5">
            {value === "opencode_local" ? <OpenCodeLogoIcon classИмя="h-3.5 w-3.5" /> : null}
            <span classИмя="truncate">{adapterЯрлыки[value] ?? getАдаптерLabel(value)}</span>
            {selectedDisplay.experimental && <ExperimentalBadge />}
          </span>
          <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {adapterList.map((item) => (
          <button
            key={item.value}
            disabled={item.comingSoon}
            classИмя={cn(
              "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded",
              item.comingSoon
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-accent/50",
              item.value === value && !item.comingSoon && "bg-accent",
            )}
            onClick={() => {
              if (!item.comingSoon) {
                onChange(item.value);
                setOpen(false);
              }
            }}
          >
            <span classИмя="inline-flex items-center gap-1.5">
              {item.value === "opencode_local" ? <OpenCodeLogoIcon classИмя="h-3.5 w-3.5" /> : null}
              <span>{item.label}</span>
              {item.experimental && <ExperimentalBadge />}
            </span>
            {item.comingSoon && (
              <span classИмя="text-[10px] text-muted-foreground">Скоро</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ExperimentalBadge() {
  return (
    <span classИмя="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-700 dark:text-amber-200">
      Experimental
    </span>
  );
}

function МодельDropdown({
  models,
  value,
  onChange,
  open,
  onOpenChange,
  allowПо умолчанию,
  required,
  groupByПровайдер,
  creatable,
  detectedМодель,
  detectedМодельCandidates,
  onDetectМодель,
  onОбновитьМодельs,
  refreshingМодельs,
  detectМодельLabel,
  emptyDetectHint,
  defaultLabel,
}: {
  models: АдаптерМодель[];
  value: string;
  onChange: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowПо умолчанию: boolean;
  required: boolean;
  groupByПровайдер: boolean;
  creatable?: boolean;
  detectedМодель?: string | null;
  detectedМодельCandidates?: string[];
  onDetectМодель?: () => Promise<string | null>;
  onОбновитьМодельs?: () => Promise<void>;
  refreshingМодельs?: boolean;
  detectМодельLabel?: string;
  emptyDetectHint?: string;
  defaultLabel?: string;
}) {
  const [modelПоиск, setМодельПоиск] = useState("");
  const [detectingМодель, setDetectingМодель] = useState(false);
  const selected = models.find((m) => m.id === value);
  const manualМодель = modelПоиск.trim();
  const canСоздатьManualМодель = Boolean(
    creatable &&
      manualМодель &&
      !models.some((m) => m.id.toНизкийerCase() === manualМодель.toНизкийerCase()),
  );
  // Модель IDs already shown as detected/candidate badges — exclude from regular list
  const promotedМодельIds = useMemo(() => {
    const set = new Set<string>();
    if (detectedМодель) set.add(detectedМодель);
    for (const c of detectedМодельCandidates ?? []) {
      if (c) set.add(c);
    }
    return set;
  }, [detectedМодель, detectedМодельCandidates]);

  const filteredМодельs = useMemo(() => {
    return models.filter((m) => {
      if (promotedМодельIds.has(m.id)) return false;
      if (!modelПоиск.trim()) return true;
      const q = modelПоиск.toНизкийerCase();
      const provider = extractПровайдерId(m.id) ?? "";
      return (
        m.id.toНизкийerCase().includes(q) ||
        m.label.toНизкийerCase().includes(q) ||
        provider.toНизкийerCase().includes(q)
      );
    });
  }, [models, modelПоиск, promotedМодельIds]);
  const groupedМодельs = useMemo(() => {
    if (!groupByПровайдер) {
      return [
        {
          provider: "models",
          entries: [...filteredМодельs].sort((a, b) => a.id.localeCompare(b.id)),
        },
      ];
    }
    const map = new Map<string, АдаптерМодель[]>();
    for (const model of filteredМодельs) {
      const provider = extractПровайдерId(model.id) ?? "other";
      const group = map.get(provider) ?? [];
      group.push(model);
      map.set(provider, group);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, entries]) => ({
        provider,
        entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
      }));
  }, [filteredМодельs, groupByПровайдер]);

  async function handleDetectМодель() {
    if (!onDetectМодель) return;
    setDetectingМодель(true);
    try {
      const nextМодель = await onDetectМодель();
      if (nextМодель) {
        onChange(nextМодель);
        onOpenChange(false);
        setМодельПоиск("");
      }
    } finally {
      setDetectingМодель(false);
    }
  }

  return (
    <Field label="Модель" hint={help.model}>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) setМодельПоиск("");
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
            <span classИмя={cn(!value && "text-muted-foreground")}>
              {selected
                ? selected.label
                : value
                  || (allowПо умолчанию ? (defaultLabel ?? "По умолчанию") : required ? "Select model (required)" : "Select model")}
            </span>
            <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent classИмя="w-[var(--radix-popover-trigger-width)] p-1" align="start">
          <div classИмя="relative mb-1">
            <input
              classИмя="w-full px-2 py-1.5 pr-6 text-xs bg-transparent outline-none border-b border-border placeholder:text-muted-foreground/50"
              placeholder={creatable ? "Поиск models... (type to create)" : "Поиск models..."}
              value={modelПоиск}
              onChange={(e) => setМодельПоиск(e.target.value)}
              autoFocus
            />
            {modelПоиск && (
              <button
                type="button"
                classИмя="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setМодельПоиск("")}
              >
                <svg aria-hidden="true" focusable="false" classИмя="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {onDetectМодель && !modelПоиск.trim() && (
            <button
              type="button"
              classИмя="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground"
              onClick={() => {
                void handleDetectМодель();
              }}
              disabled={detectingМодель}
            >
              <svg aria-hidden="true" focusable="false" classИмя="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {detectingМодель ? "Detecting..." : detectedМодель ? (detectМодельLabel?.replace(/^Detect\b/, "Re-detect") ?? "Re-detect from config") : (detectМодельLabel ?? "Detect from config")}
            </button>
          )}
          {onОбновитьМодельs && !modelПоиск.trim() && (
            <button
              type="button"
              classИмя="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground"
              onClick={() => {
                void onОбновитьМодельs();
              }}
              disabled={refreshingМодельs}
            >
              <svg aria-hidden="true" focusable="false" classИмя="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15.28-6.36L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15.28 6.36L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              {refreshingМодельs ? "Обновитьing..." : "Обновить models"}
            </button>
          )}
          {value && (!models.some((m) => m.id === value) || promotedМодельIds.has(value)) && (
            <button
              type="button"
              classИмя={cn(
                "flex items-center w-full px-2 py-1.5 text-sm rounded bg-accent/50",
              )}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              <span classИмя="block w-full text-left truncate font-mono text-xs" title={value}>
                {models.find((m) => m.id === value)?.label ?? value}
              </span>
              <span classИмя="shrink-0 ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                current
              </span>
            </button>
          )}
          {detectedМодель && detectedМодель !== value && (
            <button
              type="button"
              classИмя={cn(
                "flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
              )}
              onClick={() => {
                onChange(detectedМодель);
                onOpenChange(false);
              }}
            >
              <span classИмя="block w-full text-left truncate font-mono text-xs" title={detectedМодель}>
                {models.find((m) => m.id === detectedМодель)?.label ?? detectedМодель}
              </span>
              <span classИмя="shrink-0 ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                detected
              </span>
            </button>
          )}
          {detectedМодельCandidates
            ?.filter((candidate) => candidate && candidate !== detectedМодель && candidate !== value)
            .map((candidate) => {
              const entry = models.find((m) => m.id === candidate);
              return (
                <button
                  key={`detected-${candidate}`}
                  type="button"
                  classИмя={cn(
                    "flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                  )}
                  onClick={() => {
                    onChange(candidate);
                    onOpenChange(false);
                  }}
                >
                  <span classИмя="block w-full text-left truncate font-mono text-xs" title={candidate}>
                    {entry?.label ?? candidate}
                  </span>
                  <span classИмя="shrink-0 ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">
                    config
                  </span>
                </button>
              );
            })}
          <div classИмя="max-h-[240px] overflow-y-auto">
            {allowПо умолчанию && (
              <button
                type="button"
                classИмя={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                  !value && "bg-accent",
                )}
                onClick={() => {
                  onChange("");
                  onOpenChange(false);
                }}
              >
                По умолчанию
              </button>
            )}
            {canСоздатьManualМодель && (
              <button
                type="button"
                classИмя="flex items-center justify-between gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50"
                onClick={() => {
                  onChange(manualМодель);
                  onOpenChange(false);
                  setМодельПоиск("");
                }}
              >
                <span>Use manual model</span>
                <span classИмя="text-xs font-mono text-muted-foreground">{manualМодель}</span>
              </button>
            )}
            {groupedМодельs.map((group) => (
              <div key={group.provider} classИмя="mb-1 last:mb-0">
                {groupByПровайдер && (
                  <div classИмя="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {group.provider} ({group.entries.length})
                  </div>
                )}
                {group.entries.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    classИмя={cn(
                      "flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                      m.id === value && "bg-accent",
                    )}
                    onClick={() => {
                      onChange(m.id);
                      onOpenChange(false);
                    }}
                  >
                    <span classИмя="block w-full text-left truncate" title={m.id}>
                      {groupByПровайдер ? extractМодельИмя(m.id) : m.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {filteredМодельs.length === 0 && !canСоздатьManualМодель && promotedМодельIds.size === 0 && (
              <div classИмя="px-2 py-2 space-y-2">
                <p classИмя="text-xs text-muted-foreground">
                  {onDetectМодель
                    ? (emptyDetectHint ?? "Нет model detected yet. Enter a provider/model manually.")
                    : "Нет models found."}
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function CheapМодельSection({
  enabled,
  model,
  models,
  adapterТип,
  adapterПо умолчаниюМодель,
  onВключитьdChange,
  onМодельChange,
  open,
  onOpenChange,
}: {
  enabled: boolean;
  model: string;
  models: АдаптерМодель[];
  adapterТип: string;
  adapterПо умолчаниюМодель: string;
  onВключитьdChange: (next: boolean) => void;
  onМодельChange: (next: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const placeholderHint = adapterПо умолчаниюМодель
    ? `Адаптер default · ${adapterПо умолчаниюМодель}`
    : "Нет adapter default — choose a cheaper model";
  return (
    <div classИмя="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
      <div classИмя="flex items-center justify-between gap-3">
        <div classИмя="min-w-0">
          <div classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">Cheap model</div>
          <p classИмя="text-xs text-muted-foreground">
            Used when a run requests the cheap profile (e.g. routine summaries). The primary model stays unchanged.
          </p>
        </div>
        <ToggleSwitch checked={enabled} onCheckedChange={onВключитьdChange} />
      </div>
      {enabled ? (
        <МодельDropdown
          models={models}
          value={model}
          onChange={onМодельChange}
          open={open}
          onOpenChange={onOpenChange}
          allowПо умолчанию
          required={false}
          groupByПровайдер={adapterТип === "opencode_local"}
          creatable
          detectedМодель={null}
          detectedМодельCandidates={[]}
          emptyDetectHint={placeholderHint}
          defaultLabel={placeholderHint}
        />
      ) : null}
      {enabled && !model && adapterПо умолчаниюМодель ? (
        <p classИмя="text-[11px] text-muted-foreground">
          Нет explicit cheap model selected — runtime falls back to <code>{adapterПо умолчаниюМодель}</code>.
        </p>
      ) : null}
      {enabled && !model && !adapterПо умолчаниюМодель ? (
        <p classИмя="text-[11px] text-amber-500">
          Нет cheap model selected and the adapter has no default. Cheap-lane runs will continue on the primary model with a fallback note.
        </p>
      ) : null}
    </div>
  );
}

function ThinkingEffortDropdown({
  value,
  options,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  onChange: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <Field label="Thinking effort" hint={help.thinkingEffort}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
            <span classИмя={cn(!value && "text-muted-foreground")}>{selected?.label ?? "Авто"}</span>
            <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent classИмя="w-[var(--radix-popover-trigger-width)] p-1" align="start">
          {options.map((option) => (
            <button
              key={option.id || "auto"}
              classИмя={cn(
                "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                option.id === value && "bg-accent",
              )}
              onClick={() => {
                onChange(option.id);
                onOpenChange(false);
              }}
            >
              <span>{option.label}</span>
              {option.id ? <span classИмя="text-xs text-muted-foreground font-mono">{option.id}</span> : null}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </Field>
  );
}
