import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { АдаптерОкружениеПроверитьResult } from "@paperclipai/shared";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { companiesApi } from "../api/companies";
import { goalsApi } from "../api/goals";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { queryКлючs } from "../lib/queryКлючs";
import { Dialog, DialogПортal } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import {
  extractМодельИмя,
  extractПровайдерIdWithFallback
} from "../lib/model-utils";
import { getUIАдаптер } from "../adapters";
import { listUIАдаптеры } from "../adapters";
import { isVisualАдаптерChoice } from "../adapters/metadata";
import { useОтключитьdАдаптерыSync } from "../adapters/use-disabled-adapters";
import { useАдаптерCapabilities } from "../adapters/use-adapter-capabilities";
import { getАдаптерDisplay } from "../adapters/adapter-display-registry";
import { defaultСоздатьЗначениеs } from "./agent-config-defaults";
import { parseOnboardingЦельInput } from "../lib/onboarding-goal";
import {
  buildOnboardingЗадачаPayload,
  buildOnboardingProjectPayload,
  selectПо умолчаниюКомпанияЦельId
} from "../lib/onboarding-launch";
import { buildNewАгентЗапуститьtimeConfig } from "../lib/new-agent-runtime-config";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { DEFAULT_OPENCODE_LOCAL_MODEL, isValidOpenCodeМодельId } from "@paperclipai/adapter-opencode-local";
import { resolveRouteOnboardingOptions } from "../lib/onboarding-route";
import { AsciiArtAnimation } from "./AsciiArtAnimation";
import {
  Building2,
  Бот,
  ListTodo,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ChevronDown,
  X
} from "lucide-react";


type Step = 1 | 2 | 3 | 4;
type АдаптерТип = string;

const DEFAULT_TASK_DESCRIPTION = `You are the CEO. You set the direction for the company.

- hire a founding engineer
- write a hiring plan
- break the roadmap into concrete tasks and start delegating work`;

export function OnboardingWizard() {
  const { onboardingOpen, onboardingOptions, closeOnboarding } = useDialog();
  const { companies, setSelectedКомпанияId, loading: companiesЗагрузка } = useКомпания();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const [routeЗакрытьed, setRouteЗакрытьed] = useState(false);

  // Sync disabled adapter types from server so adapter grid filters them out
  const disabledТипs = useОтключитьdАдаптерыSync();

  const routeOnboardingOptions =
    companyPrefix && companiesЗагрузка
      ? null
      : resolveRouteOnboardingOptions({
          pathname: location.pathname,
          companyPrefix,
          companies,
        });
  const effectiveOnboardingOpen =
    onboardingOpen || (routeOnboardingOptions !== null && !routeЗакрытьed);
  const effectiveOnboardingOptions = onboardingOpen
    ? onboardingOptions
    : routeOnboardingOptions ?? {};

  const initialStep = effectiveOnboardingOptions.initialStep ?? 1;
  const existingКомпанияId = effectiveOnboardingOptions.companyId;

  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setЗагрузка] = useState(false);
  const [error, setОшибка] = useState<string | null>(null);
  const [modelOpen, setМодельOpen] = useState(false);
  const [modelПоиск, setМодельПоиск] = useState("");

  // Step 1
  const [companyИмя, setКомпанияИмя] = useState("");
  const [companyЦель, setКомпанияЦель] = useState("");

  // Step 2
  const [agentИмя, setАгентИмя] = useState("CEO");
  const [adapterТип, setАдаптерТип] = useState<АдаптерТип>("claude_local");
  const [model, setМодель] = useState("");
  const [command, setКоманда] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [adapterEnvResult, setАдаптерEnvResult] =
    useState<АдаптерОкружениеПроверитьResult | null>(null);
  const [adapterEnvОшибка, setАдаптерEnvОшибка] = useState<string | null>(null);
  const [adapterEnvЗагрузка, setАдаптерEnvЗагрузка] = useState(false);
  const [forceНе заданAnthropicApiКлюч, setForceНе заданAnthropicApiКлюч] =
    useState(false);
  const [unsetAnthropicЗагрузка, setНе заданAnthropicЗагрузка] = useState(false);
  const [showMoreАдаптеры, setShowMoreАдаптеры] = useState(false);

  // Step 3
  const [taskНазвание, setЗадачаНазвание] = useState(
    "Hire your first engineer and create a hiring plan"
  );
  const [taskОписание, setЗадачаОписание] = useState(
    DEFAULT_TASK_DESCRIPTION
  );

  // Авто-grow textarea for task description
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // Создано entity IDs — pre-populate from existing company when skipping step 1
  const [createdКомпанияId, setСозданоКомпанияId] = useState<string | null>(
    existingКомпанияId ?? null
  );
  const [createdКомпанияPrefix, setСозданоКомпанияPrefix] = useState<
    string | null
  >(null);
  const [createdКомпанияЦельId, setСозданоКомпанияЦельId] = useState<string | null>(
    null
  );
  const [createdАгентId, setСозданоАгентId] = useState<string | null>(null);
  const [createdProjectId, setСозданоProjectId] = useState<string | null>(null);
  const [createdЗадачаRef, setСозданоЗадачаRef] = useState<string | null>(null);

  useEffect(() => {
    setRouteЗакрытьed(false);
  }, [location.pathname]);

  // Sync step and company when onboarding opens with options.
  // Keep this independent from company-list refreshes so Step 1 completion
  // doesn't get reset after creating a company.
  useEffect(() => {
    if (!effectiveOnboardingOpen) return;
    const cId = effectiveOnboardingOptions.companyId ?? null;
    setStep(effectiveOnboardingOptions.initialStep ?? 1);
    setСозданоКомпанияId(cId);
    setСозданоКомпанияPrefix(null);
    setСозданоКомпанияЦельId(null);
    setСозданоProjectId(null);
    setСозданоАгентId(null);
    setСозданоЗадачаRef(null);
  }, [
    effectiveOnboardingOpen,
    effectiveOnboardingOptions.companyId,
    effectiveOnboardingOptions.initialStep
  ]);

  // Назадfill issue prefix for an existing company once companies are loaded.
  useEffect(() => {
    if (!effectiveOnboardingOpen || !createdКомпанияId || createdКомпанияPrefix) return;
    const company = companies.find((c) => c.id === createdКомпанияId);
    if (company) setСозданоКомпанияPrefix(company.issuePrefix);
  }, [effectiveOnboardingOpen, createdКомпанияId, createdКомпанияPrefix, companies]);

  // Resize textarea when step 3 is shown or description changes
  useEffect(() => {
    if (step === 3) autoResizeTextarea();
  }, [step, taskОписание, autoResizeTextarea]);

  const { data: adapterМодельs } = useQuery({
    // The wizard doesn't expose an environment selector, so models always
    // resolve against the local Paperclip host (environmentId = null).
    queryКлюч: createdКомпанияId
      ? queryКлючs.agents.adapterМодельs(createdКомпанияId, adapterТип, null)
      : ["agents", "none", "adapter-models", adapterТип, null],
    queryFn: () => agentsApi.adapterМодельs(createdКомпанияId!, adapterТип, { environmentId: null }),
    enabled: Boolean(createdКомпанияId) && effectiveOnboardingOpen && step === 2
  });
  const getCapabilities = useАдаптерCapabilities();
  const adapterCaps = getCapabilities(adapterТип);
  const isLocalАдаптер = adapterCaps.supportsInstructionsBundle || adapterCaps.supportsНавыки || adapterCaps.supportsLocalАгентJwt;

  // Build adapter grids dynamically from the UI registry + display metadata.
  // External/plugin adapters automatically appear with generic defaults.
  const { recommendedАдаптеры, moreАдаптеры } = useMemo(() => {
    const SYSTEM_ADAPTER_TYPES = new Set(["process", "http"]);
    const all = listUIАдаптеры()
      .filter((a) =>
        !SYSTEM_ADAPTER_TYPES.has(a.type) &&
        !disabledТипs.has(a.type) &&
        isVisualАдаптерChoice(a.type)
      )
      .map((a) => ({ ...getАдаптерDisplay(a.type), type: a.type }));

    return {
      recommendedАдаптеры: all.filter((a) => a.recommended),
      moreАдаптеры: all.filter((a) => !a.recommended),
    };
  }, [disabledТипs]);
  const COMMAND_PLACEHOLDERS: Record<string, string> = {
    claude_local: "claude",
    codex_local: "codex",
    gemini_local: "gemini",
    pi_local: "pi",
    cursor: "agent",
    opencode_local: "opencode",
  };
  const effectiveАдаптерКоманда =
    command.trim() ||
    (COMMAND_PLACEHOLDERS[adapterТип] ?? adapterТип.replace(/_local$/, ""));

  useEffect(() => {
    if (step !== 2) return;
    setАдаптерEnvResult(null);
    setАдаптерEnvОшибка(null);
  }, [step, adapterТип, model, command, args, url]);

  const selectedМодель = (adapterМодельs ?? []).find((m) => m.id === model);
  const hasAnthropicApiКлючOverrideCheck =
    adapterEnvResult?.checks.some(
      (check) =>
        check.code === "claude_anthropic_api_key_overrides_subscription"
    ) ?? false;
  const shouldSuggestНе заданAnthropicApiКлюч =
    adapterТип === "claude_local" &&
    adapterEnvResult?.status === "fail" &&
    hasAnthropicApiКлючOverrideCheck;
  const filteredМодельs = useMemo(() => {
    const query = modelПоиск.trim().toНизкийerCase();
    return (adapterМодельs ?? []).filter((entry) => {
      if (!query) return true;
      const provider = extractПровайдерIdWithFallback(entry.id, "");
      return (
        entry.id.toНизкийerCase().includes(query) ||
        entry.label.toНизкийerCase().includes(query) ||
        provider.toНизкийerCase().includes(query)
      );
    });
  }, [adapterМодельs, modelПоиск]);
  const groupedМодельs = useMemo(() => {
    if (adapterТип !== "opencode_local") {
      return [
        {
          provider: "models",
          entries: [...filteredМодельs].sort((a, b) => a.id.localeCompare(b.id))
        }
      ];
    }
    const groups = new Map<string, Array<{ id: string; label: string }>>();
    for (const entry of filteredМодельs) {
      const provider = extractПровайдерIdWithFallback(entry.id);
      const bucket = groups.get(provider) ?? [];
      bucket.push(entry);
      groups.set(provider, bucket);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, entries]) => ({
        provider,
        entries: [...entries].sort((a, b) => a.id.localeCompare(b.id))
      }));
  }, [filteredМодельs, adapterТип]);

  function reset() {
    setStep(1);
    setЗагрузка(false);
    setОшибка(null);
    setКомпанияИмя("");
    setКомпанияЦель("");
    setАгентИмя("CEO");
    setАдаптерТип("claude_local");
    setМодель("");
    setКоманда("");
    setArgs("");
    setUrl("");
    setАдаптерEnvResult(null);
    setАдаптерEnvОшибка(null);
    setАдаптерEnvЗагрузка(false);
    setForceНе заданAnthropicApiКлюч(false);
    setНе заданAnthropicЗагрузка(false);
    setЗадачаНазвание("Hire your first engineer and create a hiring plan");
    setЗадачаОписание(DEFAULT_TASK_DESCRIPTION);
    setСозданоКомпанияId(null);
    setСозданоКомпанияPrefix(null);
    setСозданоКомпанияЦельId(null);
    setСозданоАгентId(null);
    setСозданоProjectId(null);
    setСозданоЗадачаRef(null);
  }

  function handleЗакрыть() {
    reset();
    closeOnboarding();
  }

  function buildАдаптерConfig(): Record<string, unknown> {
    const adapter = getUIАдаптер(adapterТип);
    const config = adapter.buildАдаптерConfig({
      ...defaultСоздатьЗначениеs,
      adapterТип,
      model:
        adapterТип === "codex_local"
          ? model || DEFAULT_CODEX_LOCAL_MODEL
          : adapterТип === "gemini_local"
            ? model || DEFAULT_GEMINI_LOCAL_MODEL
          : adapterТип === "cursor"
            ? model || DEFAULT_CURSOR_LOCAL_MODEL
            : adapterТип === "opencode_local"
              ? model || DEFAULT_OPENCODE_LOCAL_MODEL
              : model,
      command,
      args,
      url,
      dangerouslySkipPermissions:
        adapterТип === "claude_local" || adapterТип === "opencode_local",
      dangerouslyBypassSandbox:
        adapterТип === "codex_local"
          ? DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX
          : defaultСоздатьЗначениеs.dangerouslyBypassSandbox
    });
    if (adapterТип === "claude_local" && forceНе заданAnthropicApiКлюч) {
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
    }
    return config;
  }

  async function runАдаптерОкружениеПроверить(
    adapterConfigOverride?: Record<string, unknown>
  ): Promise<АдаптерОкружениеПроверитьResult | null> {
    if (!createdКомпанияId) {
      setАдаптерEnvОшибка(
        "Создать or select a company before testing adapter environment."
      );
      return null;
    }
    setАдаптерEnvЗагрузка(true);
    setАдаптерEnvОшибка(null);
    try {
      const result = await agentsApi.testОкружение(
        createdКомпанияId,
        adapterТип,
        {
          adapterConfig: adapterConfigOverride ?? buildАдаптерConfig()
        }
      );
      setАдаптерEnvResult(result);
      return result;
    } catch (err) {
      setАдаптерEnvОшибка(
        err instanceof Ошибка ? err.message : "Адаптер environment test failed"
      );
      return null;
    } finally {
      setАдаптерEnvЗагрузка(false);
    }
  }

  async function handleStep1Далее() {
    setЗагрузка(true);
    setОшибка(null);
    try {
      const company = await companiesApi.create({ name: companyИмя.trim() });
      setСозданоКомпанияId(company.id);
      setСозданоКомпанияPrefix(company.issuePrefix);
      setSelectedКомпанияId(company.id);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });

      if (companyЦель.trim()) {
        const parsedЦель = parseOnboardingЦельInput(companyЦель);
        const goal = await goalsApi.create(company.id, {
          title: parsedЦель.title,
          ...(parsedЦель.description
            ? { description: parsedЦель.description }
            : {}),
          level: "company",
          status: "active"
        });
        setСозданоКомпанияЦельId(goal.id);
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.goals.list(company.id)
        });
      } else {
        setСозданоКомпанияЦельId(null);
      }

      setStep(2);
    } catch (err) {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to create company");
    } finally {
      setЗагрузка(false);
    }
  }

  async function handleStep2Далее() {
    if (!createdКомпанияId) return;
    setЗагрузка(true);
    setОшибка(null);
    try {
      if (adapterТип === "opencode_local") {
        if (!isValidOpenCodeМодельId(model)) {
          setОшибка(
            "OpenCode requires an explicit model in provider/model format."
          );
          return;
        }
      }

      if (isLocalАдаптер) {
        const result = adapterEnvResult ?? (await runАдаптерОкружениеПроверить());
        if (!result) return;
      }

      const hire = await agentsApi.hire(createdКомпанияId, {
        name: agentИмя.trim(),
        role: "ceo",
        adapterТип,
        adapterConfig: buildАдаптерConfig(),
        runtimeConfig: buildNewАгентЗапуститьtimeConfig()
      });
      if (hire.approval) {
        await approvalsApi.approve(
          hire.approval.id,
          "Одобритьd during onboarding first-agent setup."
        );
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.approvals.list(createdКомпанияId)
        });
      }
      const agent = hire.agent;
      setСозданоАгентId(agent.id);
      queryClient.invalidateQueries({
        queryКлюч: queryКлючs.agents.list(createdКомпанияId)
      });
      setStep(3);
    } catch (err) {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to create agent");
    } finally {
      setЗагрузка(false);
    }
  }

  async function handleНе заданAnthropicApiКлюч() {
    if (!createdКомпанияId || unsetAnthropicЗагрузка) return;
    setНе заданAnthropicЗагрузка(true);
    setОшибка(null);
    setАдаптерEnvОшибка(null);
    setForceНе заданAnthropicApiКлюч(true);

    const configWithНе задан = (() => {
      const config = buildАдаптерConfig();
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
      return config;
    })();

    try {
      if (createdАгентId) {
        await agentsApi.update(
          createdАгентId,
          { adapterConfig: configWithНе задан },
          createdКомпанияId
        );
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.agents.list(createdКомпанияId)
        });
      }

      const result = await runАдаптерОкружениеПроверить(configWithНе задан);
      if (result?.status === "fail") {
        setОшибка(
          "Retried with ANTHROPIC_API_KEY unset in adapter config, but the environment test is still failing."
        );
      }
    } catch (err) {
      setОшибка(
        err instanceof Ошибка
          ? err.message
          : "Ошибка to unset ANTHROPIC_API_KEY and retry."
      );
    } finally {
      setНе заданAnthropicЗагрузка(false);
    }
  }

  async function handleStep3Далее() {
    if (!createdКомпанияId || !createdАгентId) return;
    setОшибка(null);
    setStep(4);
  }

  async function handleLaunch() {
    if (!createdКомпанияId || !createdАгентId) return;
    setЗагрузка(true);
    setОшибка(null);
    try {
      let goalId = createdКомпанияЦельId;
      if (!goalId) {
        const goals = await goalsApi.list(createdКомпанияId);
        goalId = selectПо умолчаниюКомпанияЦельId(goals);
        setСозданоКомпанияЦельId(goalId);
      }

      let projectId = createdProjectId;
      if (!projectId) {
        const project = await projectsApi.create(
          createdКомпанияId,
          buildOnboardingProjectPayload(goalId)
        );
        projectId = project.id;
        setСозданоProjectId(projectId);
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.projects.list(createdКомпанияId)
        });
      }

      let issueRef = createdЗадачаRef;
      if (!issueRef) {
        const issue = await issuesApi.create(
          createdКомпанияId,
          buildOnboardingЗадачаPayload({
            title: taskНазвание,
            description: taskОписание,
            assigneeАгентId: createdАгентId,
            projectId,
            goalId
          })
        );
        issueRef = issue.identifier ?? issue.id;
        setСозданоЗадачаRef(issueRef);
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.issues.list(createdКомпанияId)
        });
      }

      setSelectedКомпанияId(createdКомпанияId);
      reset();
      closeOnboarding();
      navigate(
        createdКомпанияPrefix
          ? `/${createdКомпанияPrefix}/issues/${issueRef}`
          : `/issues/${issueRef}`
      );
    } catch (err) {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to create task");
    } finally {
      setЗагрузка(false);
    }
  }

  function handleКлючDown(e: React.КлючboardEvent) {
    if (e.key === "Enter" && (e.metaКлюч || e.ctrlКлюч)) {
      e.preventПо умолчанию();
      if (step === 1 && companyИмя.trim()) handleStep1Далее();
      else if (step === 2 && agentИмя.trim()) handleStep2Далее();
      else if (step === 3 && taskНазвание.trim()) handleStep3Далее();
      else if (step === 4) handleLaunch();
    }
  }

  if (!effectiveOnboardingOpen) return null;

  return (
    <Dialog
      open={effectiveOnboardingOpen}
      onOpenChange={(open) => {
        if (!open) {
          setRouteЗакрытьed(true);
          handleЗакрыть();
        }
      }}
    >
      <DialogПортal>
        {/* Plain div instead of DialogOverlay — Radix's overlay wraps in
            УдалитьScroll which blocks wheel events on our custom (non-DialogContent)
            scroll container. A plain div preserves the background without scroll-locking. */}
        <div classИмя="fixed inset-0 z-50 bg-background" />
        <div classИмя="fixed inset-0 z-50 flex" onКлючDown={handleКлючDown}>
          {/* Закрыть button */}
          <button
            onClick={handleЗакрыть}
            classИмя="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X classИмя="h-5 w-5" />
            <span classИмя="sr-only">Закрыть</span>
          </button>

          {/* Left half — form */}
          <div
            classИмя={cn(
              "w-full flex flex-col overflow-y-auto transition-[width] duration-500 ease-in-out",
              step === 1 ? "md:w-1/2" : "md:w-full"
            )}
          >
            <div classИмя="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
              {/* Progress tabs */}
              <div classИмя="flex items-center gap-0 mb-8 border-b border-border">
                {(
                  [
                    { step: 1 as Step, label: "Компания", icon: Building2 },
                    { step: 2 as Step, label: "Агент", icon: Бот },
                    { step: 3 as Step, label: "Задача", icon: ListTodo },
                    { step: 4 as Step, label: "Launch", icon: Rocket }
                  ] as const
                ).map(({ step: s, label, icon: Icon }) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(s)}
                    classИмя={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer",
                      s === step
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground/70 hover:border-border"
                    )}
                  >
                    <Icon classИмя="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Step content */}
              {step === 1 && (
                <div classИмя="space-y-5">
                  <div classИмя="flex items-center gap-3 mb-1">
                    <div classИмя="bg-muted/50 p-2">
                      <Building2 classИмя="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 classИмя="font-medium">Имя your company</h3>
                      <p classИмя="text-xs text-muted-foreground">
                        This is the organization your agents will work for.
                      </p>
                    </div>
                  </div>
                  <div classИмя="mt-3 group">
                    <label
                      classИмя={cn(
                        "text-xs mb-1 block transition-colors",
                        companyИмя.trim()
                          ? "text-foreground"
                          : "text-muted-foreground group-focus-within:text-foreground"
                      )}
                    >
                      Компания name
                    </label>
                    <input
                      classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="Acme Corp"
                      value={companyИмя}
                      onChange={(e) => setКомпанияИмя(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div classИмя="group">
                    <label
                      classИмя={cn(
                        "text-xs mb-1 block transition-colors",
                        companyЦель.trim()
                          ? "text-foreground"
                          : "text-muted-foreground group-focus-within:text-foreground"
                      )}
                    >
                      Mission / goal (optional)
                    </label>
                    <textarea
                      classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[60px]"
                      placeholder="What is this company trying to achieve?"
                      value={companyЦель}
                      onChange={(e) => setКомпанияЦель(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div classИмя="space-y-5">
                  <div classИмя="flex items-center gap-3 mb-1">
                    <div classИмя="bg-muted/50 p-2">
                      <Бот classИмя="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 classИмя="font-medium">Создать your first agent</h3>
                      <p classИмя="text-xs text-muted-foreground">
                        Choose how this agent will run tasks.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label classИмя="text-xs text-muted-foreground mb-1 block">
                      Агент name
                    </label>
                    <input
                      classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="CEO"
                      value={agentИмя}
                      onChange={(e) => setАгентИмя(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Адаптер type radio cards */}
                  <div>
                    <label classИмя="text-xs text-muted-foreground mb-2 block">
                      Адаптер type
                    </label>
                    <div classИмя="grid grid-cols-2 gap-2">
                      {recommendedАдаптеры.map((opt) => (
                        <button
                          key={opt.type}
                          classИмя={cn(
                            "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors relative",
                            adapterТип === opt.type
                              ? "border-foreground bg-accent"
                              : "border-border hover:bg-accent/50"
                          )}
                          onClick={() => {
                            const nextТип = opt.type;
                            setАдаптерТип(nextТип);
                            if (nextТип === "codex_local") {
                              if (!model) {
                                setМодель(DEFAULT_CODEX_LOCAL_MODEL);
                              }
                              return;
                            }
                            if (nextТип === "opencode_local") {
                              setМодель(DEFAULT_OPENCODE_LOCAL_MODEL);
                              return;
                            }
                            setМодель("");
                          }}
                        >
                          {opt.recommended && (
                            <span classИмя="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                              Recommended
                            </span>
                          )}
                          <opt.icon classИмя="h-4 w-4" />
                          <span classИмя="font-medium">{opt.label}</span>
                          <span classИмя="text-muted-foreground text-[10px]">
                            {opt.description}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      classИмя="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowMoreАдаптеры((v) => !v)}
                    >
                      <ChevronDown
                        classИмя={cn(
                          "h-3 w-3 transition-transform",
                          showMoreАдаптеры ? "rotate-0" : "-rotate-90"
                        )}
                      />
                      More Агент Адаптер Типs
                    </button>

                    {showMoreАдаптеры && (
                      <div classИмя="grid grid-cols-2 gap-2 mt-2">
                        {moreАдаптеры.map((opt) => (
                           <button
                             key={opt.type}
                             disabled={!!opt.comingSoon}
                             classИмя={cn(
                               "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors relative",
                               opt.comingSoon
                                 ? "border-border opacity-40 cursor-not-allowed"
                                 : adapterТип === opt.type
                                 ? "border-foreground bg-accent"
                                 : "border-border hover:bg-accent/50"
                             )}
                             onClick={() => {
                               if (opt.comingSoon) return;
                               const nextТип = opt.type;
                              setАдаптерТип(nextТип);
                              if (nextТип === "gemini_local" && !model) {
                                setМодель(DEFAULT_GEMINI_LOCAL_MODEL);
                                return;
                              }
                              if (nextТип === "cursor" && !model) {
                                setМодель(DEFAULT_CURSOR_LOCAL_MODEL);
                                return;
                              }
                              if (nextТип === "opencode_local") {
                                setМодель(DEFAULT_OPENCODE_LOCAL_MODEL);
                                return;
                              }
                              setМодель("");
                            }}
                          >
                            <opt.icon classИмя="h-4 w-4" />
                            <span classИмя="font-medium">{opt.label}</span>
                            <span classИмя="text-muted-foreground text-[10px]">
                              {opt.comingSoon
                                ? opt.disabledLabel ?? "Скоро"
                                : opt.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Conditional adapter fields */}
                  {isLocalАдаптер && (
                    <div classИмя="space-y-3">
                      <div>
                        <label classИмя="text-xs text-muted-foreground mb-1 block">
                          Модель
                        </label>
                        <Popover
                          open={modelOpen}
                          onOpenChange={(next) => {
                            setМодельOpen(next);
                            if (!next) setМодельПоиск("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
                              <span
                                classИмя={cn(
                                  !model && "text-muted-foreground"
                                )}
                              >
                                {selectedМодель
                                  ? selectedМодель.label
                                  : model ||
                                    (adapterТип === "opencode_local"
                                      ? "Select model (required)"
                                      : "По умолчанию")}
                              </span>
                              <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            classИмя="w-[var(--radix-popover-trigger-width)] p-1"
                            align="start"
                          >
                            <input
                              classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                              placeholder="Поиск models..."
                              value={modelПоиск}
                              onChange={(e) => setМодельПоиск(e.target.value)}
                              autoFocus
                            />
                            {adapterТип !== "opencode_local" && (
                              <button
                                classИмя={cn(
                                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                                  !model && "bg-accent"
                                )}
                                onClick={() => {
                                  setМодель("");
                                  setМодельOpen(false);
                                }}
                              >
                                По умолчанию
                              </button>
                            )}
                            <div classИмя="max-h-[240px] overflow-y-auto">
                              {groupedМодельs.map((group) => (
                                <div
                                  key={group.provider}
                                  classИмя="mb-1 last:mb-0"
                                >
                                  {adapterТип === "opencode_local" && (
                                    <div classИмя="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {group.provider} ({group.entries.length})
                                    </div>
                                  )}
                                  {group.entries.map((m) => (
                                    <button
                                      key={m.id}
                                      classИмя={cn(
                                        "flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                                        m.id === model && "bg-accent"
                                      )}
                                      onClick={() => {
                                        setМодель(m.id);
                                        setМодельOpen(false);
                                      }}
                                    >
                                      <span
                                        classИмя="block w-full text-left truncate"
                                        title={m.id}
                                      >
                                        {adapterТип === "opencode_local"
                                          ? extractМодельИмя(m.id)
                                          : m.label}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                            {filteredМодельs.length === 0 && (
                              <p classИмя="px-2 py-1.5 text-xs text-muted-foreground">
                                Нет models discovered.
                              </p>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {isLocalАдаптер && (
                    <div classИмя="space-y-2 rounded-md border border-border p-3">
                      <div classИмя="flex items-center justify-between gap-2">
                        <div>
                          <p classИмя="text-xs font-medium">
                            Адаптер environment check
                          </p>
                          <p classИмя="text-[11px] text-muted-foreground">
                            Запуститьs a live probe that asks the adapter CLI to
                            respond with hello.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          classИмя="h-7 px-2.5 text-xs"
                          disabled={adapterEnvЗагрузка}
                          onClick={() => void runАдаптерОкружениеПроверить()}
                        >
                          {adapterEnvЗагрузка ? "Проверитьing..." : "Проверить now"}
                        </Button>
                      </div>

                      {adapterEnvОшибка && (
                        <div classИмя="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                          {adapterEnvОшибка}
                        </div>
                      )}

                      {adapterEnvResult &&
                      adapterEnvResult.status === "pass" ? (
                        <div classИмя="flex items-center gap-2 rounded-md border border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-300 animate-in fade-in slide-in-from-bottom-1 duration-300">
                          <Check classИмя="h-3.5 w-3.5 shrink-0" />
                          <span classИмя="font-medium">Passed</span>
                        </div>
                      ) : adapterEnvResult ? (
                        <АдаптерОкружениеResult result={adapterEnvResult} />
                      ) : null}

                      {shouldSuggestНе заданAnthropicApiКлюч && (
                        <div classИмя="rounded-md border border-amber-300/60 bg-amber-50/40 px-2.5 py-2 space-y-2">
                          <p classИмя="text-[11px] text-amber-900/90 leading-relaxed">
                            Claude failed while{" "}
                            <span classИмя="font-mono">ANTHROPIC_API_KEY</span>{" "}
                            is set. You can clear it in this CEO adapter config
                            and retry the probe.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            classИмя="h-7 px-2.5 text-xs"
                            disabled={
                              adapterEnvЗагрузка || unsetAnthropicЗагрузка
                            }
                            onClick={() => void handleНе заданAnthropicApiКлюч()}
                          >
                            {unsetAnthropicЗагрузка
                              ? "Повторитьing..."
                              : "Не задан ANTHROPIC_API_KEY"}
                          </Button>
                        </div>
                      )}

                      {adapterEnvResult && adapterEnvResult.status === "fail" && (
                        <div classИмя="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] space-y-1.5">
                          <p classИмя="font-medium">Manual debug</p>
                          <p classИмя="text-muted-foreground font-mono break-all">
                            {adapterТип === "cursor"
                              ? `${effectiveАдаптерКоманда} -p --mode ask --output-format json \"Respond with hello.\"`
                              : adapterТип === "codex_local"
                              ? `${effectiveАдаптерКоманда} exec --json -`
                              : adapterТип === "gemini_local"
                                ? `${effectiveАдаптерКоманда} --output-format json "Respond with hello."`
                              : adapterТип === "opencode_local"
                                ? `${effectiveАдаптерКоманда} run --format json "Respond with hello."`
                              : `${effectiveАдаптерКоманда} --print - --output-format stream-json --verbose`}
                          </p>
                          <p classИмя="text-muted-foreground">
                            Prompt:{" "}
                            <span classИмя="font-mono">Respond with hello.</span>
                          </p>
                          {adapterТип === "cursor" ||
                          adapterТип === "codex_local" ||
                          adapterТип === "gemini_local" ||
                          adapterТип === "opencode_local" ? (
                            <p classИмя="text-muted-foreground">
                              If auth fails, set{" "}
                              <span classИмя="font-mono">
                                {adapterТип === "cursor"
                                  ? "CURSOR_API_KEY"
                                  : adapterТип === "gemini_local"
                                    ? "GEMINI_API_KEY"
                                    : "OPENAI_API_KEY"}
                              </span>{" "}
                              in env or run{" "}
                              <span classИмя="font-mono">
                                {adapterТип === "cursor"
                                  ? "agent login"
                                  : adapterТип === "codex_local"
                                    ? "codex login"
                                    : adapterТип === "gemini_local"
                                      ? "gemini auth"
                                      : "opencode auth login"}
                              </span>
                              .
                            </p>
                          ) : (
                            <p classИмя="text-muted-foreground">
                              If login is required, run{" "}
                              <span classИмя="font-mono">claude login</span>{" "}
                              and retry.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(adapterТип === "http" ||
                    adapterТип === "openclaw_gateway") && (
                    <div>
                      <label classИмя="text-xs text-muted-foreground mb-1 block">
                        {adapterТип === "openclaw_gateway"
                          ? "Gateway URL"
                          : "Webhook URL"}
                      </label>
                      <input
                        classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        placeholder={
                          adapterТип === "openclaw_gateway"
                            ? "ws://127.0.0.1:18789"
                            : "https://..."
                        }
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div classИмя="space-y-5">
                  <div classИмя="flex items-center gap-3 mb-1">
                    <div classИмя="bg-muted/50 p-2">
                      <ListTodo classИмя="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 classИмя="font-medium">Give it something to do</h3>
                      <p classИмя="text-xs text-muted-foreground">
                        Give your agent a small task to start with — a bug fix,
                        a research question, writing a script.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label classИмя="text-xs text-muted-foreground mb-1 block">
                      Задача title
                    </label>
                    <input
                      classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="e.g. Research competitor pricing"
                      value={taskНазвание}
                      onChange={(e) => setЗадачаНазвание(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label classИмя="text-xs text-muted-foreground mb-1 block">
                      Описание (optional)
                    </label>
                    <textarea
                      ref={textareaRef}
                      classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[120px] max-h-[300px] overflow-y-auto"
                      placeholder="Добавить more detail about what the agent should do..."
                      value={taskОписание}
                      onChange={(e) => setЗадачаОписание(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div classИмя="space-y-5">
                  <div classИмя="flex items-center gap-3 mb-1">
                    <div classИмя="bg-muted/50 p-2">
                      <Rocket classИмя="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 classИмя="font-medium">Готово to launch</h3>
                      <p classИмя="text-xs text-muted-foreground">
                        Everything is set up. Launching now will create the
                        starter task, wake the agent, and open the issue.
                      </p>
                    </div>
                  </div>
                  <div classИмя="border border-border divide-y divide-border">
                    <div classИмя="flex items-center gap-3 px-3 py-2.5">
                      <Building2 classИмя="h-4 w-4 text-muted-foreground shrink-0" />
                      <div classИмя="flex-1 min-w-0">
                        <p classИмя="text-sm font-medium truncate">
                          {companyИмя}
                        </p>
                        <p classИмя="text-xs text-muted-foreground">Компания</p>
                      </div>
                      <Check classИмя="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                    <div classИмя="flex items-center gap-3 px-3 py-2.5">
                      <Бот classИмя="h-4 w-4 text-muted-foreground shrink-0" />
                      <div classИмя="flex-1 min-w-0">
                        <p classИмя="text-sm font-medium truncate">
                          {agentИмя}
                        </p>
                        <p classИмя="text-xs text-muted-foreground">
                          {getUIАдаптер(adapterТип).label}
                        </p>
                      </div>
                      <Check classИмя="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                    <div classИмя="flex items-center gap-3 px-3 py-2.5">
                      <ListTodo classИмя="h-4 w-4 text-muted-foreground shrink-0" />
                      <div classИмя="flex-1 min-w-0">
                        <p classИмя="text-sm font-medium truncate">
                          {taskНазвание}
                        </p>
                        <p classИмя="text-xs text-muted-foreground">Задача</p>
                      </div>
                      <Check classИмя="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Ошибка */}
              {error && (
                <div classИмя="mt-3">
                  <p classИмя="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* Footer navigation */}
              <div classИмя="flex items-center justify-between mt-8">
                <div>
                  {step > 1 && step > (onboardingOptions.initialStep ?? 1) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep((step - 1) as Step)}
                      disabled={loading}
                    >
                      <ArrowLeft classИмя="h-3.5 w-3.5 mr-1" />
                      Назад
                    </Button>
                  )}
                </div>
                <div classИмя="flex items-center gap-2">
                  {step === 1 && (
                    <Button
                      size="sm"
                      disabled={!companyИмя.trim() || loading}
                      onClick={handleStep1Далее}
                    >
                      {loading ? (
                        <Loader2 classИмя="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight classИмя="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Далее"}
                    </Button>
                  )}
                  {step === 2 && (
                    <Button
                      size="sm"
                      disabled={
                        !agentИмя.trim() || loading || adapterEnvЗагрузка
                      }
                      onClick={handleStep2Далее}
                    >
                      {loading ? (
                        <Loader2 classИмя="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight classИмя="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Далее"}
                    </Button>
                  )}
                  {step === 3 && (
                    <Button
                      size="sm"
                      disabled={!taskНазвание.trim() || loading}
                      onClick={handleStep3Далее}
                    >
                      {loading ? (
                        <Loader2 classИмя="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight classИмя="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Далее"}
                    </Button>
                  )}
                  {step === 4 && (
                    <Button size="sm" disabled={loading} onClick={handleLaunch}>
                      {loading ? (
                        <Loader2 classИмя="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight classИмя="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Создать & Open Задача"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right half — ASCII art (hidden on mobile) */}
          <div
            classИмя={cn(
              "hidden md:block overflow-hidden bg-[#1d1d1d] transition-[width,opacity] duration-500 ease-in-out",
              step === 1 ? "w-1/2 opacity-100" : "w-0 opacity-0"
            )}
          >
            <AsciiArtAnimation />
          </div>
        </div>
      </DialogПортal>
    </Dialog>
  );
}

function АдаптерОкружениеResult({
  result
}: {
  result: АдаптерОкружениеПроверитьResult;
}) {
  const statusLabel =
    result.status === "pass"
      ? "Passed"
      : result.status === "warn"
      ? "Предупреждениеs"
      : "Ошибка";
  const statusClass =
    result.status === "pass"
      ? "text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10"
      : result.status === "warn"
      ? "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10"
      : "text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10";

  return (
    <div classИмя={`rounded-md border px-2.5 py-2 text-[11px] ${statusClass}`}>
      <div classИмя="flex items-center justify-between gap-2">
        <span classИмя="font-medium">{statusLabel}</span>
        <span classИмя="opacity-80">
          {new Date(result.testedAt).toLocaleTimeString()}
        </span>
      </div>
      <div classИмя="mt-1.5 space-y-1">
        {result.checks.map((check, idx) => (
          <div
            key={`${check.code}-${idx}`}
            classИмя="leading-relaxed break-words"
          >
            <span classИмя="font-medium uppercase tracking-wide opacity-80">
              {check.level}
            </span>
            <span classИмя="mx-1 opacity-60">·</span>
            <span>{check.message}</span>
            {check.detail && (
              <span classИмя="block opacity-75 break-all">
                ({check.detail})
              </span>
            )}
            {check.hint && (
              <span classИмя="block opacity-90 break-words">
                Hint: {check.hint}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
