import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useПоискParams } from "@/lib/router";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { companyНавыкиApi } from "../api/companyНавыки";
import { queryКлючs } from "../lib/queryКлючs";
import { AGENT_ROLES, type АдаптерОкружениеПроверитьResult } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Shield } from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { roleЯрлыки } from "../components/agent-config-primitives";
import {
  АгентConfigForm,
  АдаптерОкружениеResult,
  type СоздатьConfigЗначениеs,
} from "../components/АгентConfigForm";
import { defaultСоздатьЗначениеs } from "../components/agent-config-defaults";
import { getUIАдаптер, listUIАдаптеры } from "../adapters";
import { useОтключитьdАдаптерыSync } from "../adapters/use-disabled-adapters";
import { isValidАдаптерТип } from "../adapters/metadata";
import { РепозиторийrtsToPicker } from "../components/РепозиторийrtsToPicker";
import { buildNewАгентHirePayload } from "../lib/new-agent-hire-payload";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { DEFAULT_OPENCODE_LOCAL_MODEL, isValidOpenCodeМодельId } from "@paperclipai/adapter-opencode-local";

function createЗначениеsForАдаптерТип(
  adapterТип: СоздатьConfigЗначениеs["adapterТип"],
): СоздатьConfigЗначениеs {
  const { adapterТип: _discard, ...defaults } = defaultСоздатьЗначениеs;
  const nextЗначениеs: СоздатьConfigЗначениеs = { ...defaults, adapterТип };
  if (adapterТип === "codex_local") {
    nextЗначениеs.model = DEFAULT_CODEX_LOCAL_MODEL;
    nextЗначениеs.dangerouslyBypassSandbox =
      DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
  } else if (adapterТип === "gemini_local") {
    nextЗначениеs.model = DEFAULT_GEMINI_LOCAL_MODEL;
  } else if (adapterТип === "cursor") {
    nextЗначениеs.model = DEFAULT_CURSOR_LOCAL_MODEL;
  } else if (adapterТип === "opencode_local") {
    nextЗначениеs.model = DEFAULT_OPENCODE_LOCAL_MODEL;
  }
  return nextЗначениеs;
}

export function NewАгент() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useПоискParams();
  const presetАдаптерТип = searchParams.get("adapterТип");

  const [name, setИмя] = useState("");
  const [title, setНазвание] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setРепозиторийrtsTo] = useState<string | null>(null);
  const [configЗначениеs, setConfigЗначениеs] = useState<СоздатьConfigЗначениеs>(defaultСоздатьЗначениеs);
  const [selectedНавыкКлючs, setSelectedНавыкКлючs] = useState<string[]>([]);
  const [roleOpen, setRoleOpen] = useState(false);
  const [formОшибка, setFormОшибка] = useState<string | null>(null);
  const [testАгентAction, setПроверитьАгентAction] = useState<(() => void) | null>(null);
  const [testАгентState, setПроверитьАгентState] = useState({ disabled: true, pending: false });
  const [testАгентFeedback, setПроверитьАгентFeedback] = useState<{
    errorMessage: string | null;
    result: АдаптерОкружениеПроверитьResult | null;
  }>({
    errorMessage: null,
    result: null,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: companyНавыки } = useQuery({
    queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId ?? ""),
    queryFn: () => companyНавыкиApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const isFirstАгент = !agents || agents.length === 0;
  const effectiveRole = isFirstАгент ? "ceo" : role;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Агенты", href: "/agents" },
      { label: "Новый агент" },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (isFirstАгент) {
      if (!name) setИмя("CEO");
      if (!title) setНазвание("CEO");
    }
  }, [isFirstАгент]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requested = presetАдаптерТип;
    if (!requested) return;
    if (!isValidАдаптерТип(requested)) return;
    setConfigЗначениеs((prev) => {
      if (prev.adapterТип === requested) return prev;
      return createЗначениеsForАдаптерТип(requested as СоздатьConfigЗначениеs["adapterТип"]);
    });
  }, [presetАдаптерТип]);

  const createАгент = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedКомпанияId!, data),
    onУспешно: (result) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(selectedКомпанияId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!) });
      navigate(agentUrl(result.agent));
    },
    onОшибка: (error) => {
      setFormОшибка(error instanceof Ошибка ? error.message : "Ошибка to create agent");
    },
  });

  function buildАдаптерConfig() {
    const adapter = getUIАдаптер(configЗначениеs.adapterТип);
    return adapter.buildАдаптерConfig(configЗначениеs);
  }

  function handleОтправить() {
    if (!selectedКомпанияId || !name.trim()) return;
    setFormОшибка(null);
    if (configЗначениеs.adapterТип === "opencode_local") {
      if (!isValidOpenCodeМодельId(configЗначениеs.model)) {
        setFormОшибка("OpenCode requires an explicit model in provider/model format.");
        return;
      }
    }
    createАгент.mutate(
      buildNewАгентHirePayload({
        name,
        effectiveRole,
        title,
        reportsTo,
        selectedНавыкКлючs,
        configЗначениеs,
        adapterConfig: buildАдаптерConfig(),
      }),
    );
  }

  const availableНавыки = (companyНавыки ?? []).filter((skill) => !skill.key.startsWith("paperclipai/paperclip/"));

  function toggleНавык(key: string, checked: boolean) {
    setSelectedНавыкКлючs((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((value) => value !== key);
    });
  }

  const handleПроверитьАгентActionChange = useCallback((fn: (() => void) | null) => {
    setПроверитьАгентAction(() => fn);
  }, []);

  const handleПроверитьАгентStateChange = useCallback((state: { disabled: boolean; pending: boolean }) => {
    setПроверитьАгентState(state);
  }, []);

  const handleПроверитьАгентFeedbackChange = useCallback((feedback: {
    errorMessage: string | null;
    result: АдаптерОкружениеПроверитьResult | null;
  }) => {
    setПроверитьАгентFeedback(feedback);
  }, []);

  return (
    <div classИмя="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 classИмя="text-lg font-semibold">Новый агент</h1>
        <p classИмя="text-sm text-muted-foreground mt-1">
          Дополнительно agent configuration
        </p>
      </div>

      <div classИмя="border border-border">
        {/* Имя */}
        <div classИмя="px-4 pt-4 pb-2">
          <input
            classИмя="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Агент name"
            value={name}
            onChange={(e) => setИмя(e.target.value)}
            autoFocus
          />
        </div>

        {/* Название */}
        <div classИмя="px-4 pb-2">
          <input
            classИмя="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
            placeholder="Название (e.g. VP of Инженерing)"
            value={title}
            onChange={(e) => setНазвание(e.target.value)}
          />
        </div>

        {/* Property chips: Role + Репозиторийrts To */}
        <div classИмя="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
          <Popover open={roleOpen} onOpenChange={setRoleOpen}>
            <PopoverTrigger asChild>
              <button
                classИмя={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                  isFirstАгент && "opacity-60 cursor-not-allowed"
                )}
                disabled={isFirstАгент}
              >
                <Shield classИмя="h-3 w-3 text-muted-foreground" />
                {roleЯрлыки[effectiveRole] ?? effectiveRole}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-36 p-1" align="start">
              {AGENT_ROLES.map((r) => (
                <button
                  key={r}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    r === role && "bg-accent"
                  )}
                  onClick={() => { setRole(r); setRoleOpen(false); }}
                >
                  {roleЯрлыки[r] ?? r}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <РепозиторийrtsToPicker
            agents={agents ?? []}
            value={reportsTo}
            onChange={setРепозиторийrtsTo}
            disabled={isFirstАгент}
          />
        </div>

        {/* Shared config form */}
        <АгентConfigForm
          mode="create"
          values={configЗначениеs}
          onChange={(patch) => setConfigЗначениеs((prev) => ({ ...prev, ...patch }))}
          onПроверитьActionChange={handleПроверитьАгентActionChange}
          onПроверитьActionStateChange={handleПроверитьАгентStateChange}
          onПроверитьFeedbackChange={handleПроверитьАгентFeedbackChange}
        />

        <div classИмя="border-t border-border px-4 py-4">
          <div classИмя="space-y-3">
            <div>
              <h2 classИмя="text-sm font-medium">Компания skills</h2>
              <p classИмя="mt-1 text-xs text-muted-foreground">
                Опционально skills from the company library. Built-in Paperclip runtime skills are added automatically.
              </p>
            </div>
            {availableНавыки.length === 0 ? (
              <p classИмя="text-xs text-muted-foreground">
                Нет optional company skills installed yet.
              </p>
            ) : (
              <div classИмя="space-y-3">
                {availableНавыки.map((skill) => {
                  const inputId = `skill-${skill.id}`;
                  const checked = selectedНавыкКлючs.includes(skill.key);
                  return (
                    <div key={skill.id} classИмя="flex items-start gap-3">
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={(next) => toggleНавык(skill.key, next === true)}
                      />
                      <label htmlFor={inputId} classИмя="grid gap-1 leading-none">
                        <span classИмя="text-sm font-medium">{skill.name}</span>
                        <span classИмя="text-xs text-muted-foreground">
                          {skill.description ?? skill.key}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div classИмя="border-t border-border px-4 py-3">
          {isFirstАгент && (
            <p classИмя="text-xs text-muted-foreground mb-2">This will be the CEO</p>
          )}
          {formОшибка && (
            <p classИмя="text-xs text-destructive mb-2">{formОшибка}</p>
          )}
          <div classИмя="space-y-3">
            {testАгентFeedback.errorMessage && (
              <div classИмя="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {testАгентFeedback.errorMessage}
              </div>
            )}
            {testАгентFeedback.result && (
              <АдаптерОкружениеResult result={testАгентFeedback.result} />
            )}
            <div classИмя="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/agents")}>
                Отмена
              </Button>
              <div classИмя="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testАгентState.disabled}
                  onClick={() => testАгентAction?.()}
                >
                  {testАгентState.pending ? "Проверитьing..." : "Проверить Агент"}
                </Button>
                <Button
                  size="sm"
                  disabled={!name.trim() || createАгент.isОжидание}
                  onClick={handleОтправить}
                >
                  {createАгент.isОжидание ? "Creating…" : "Создать agent"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
