import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AGENT_ADAPTER_TYPES,
  getАдаптерОкружениеSupport,
  type Окружение,
  type ОкружениеProbeResult,
  type JsonSchema,
} from "@paperclipai/shared";
import { Check, Настройки } from "lucide-react";
import { environmentsApi } from "@/api/environments";
import { instanceНастройкиApi } from "@/api/instanceНастройки";
import { secretsApi } from "@/api/secrets";
import { Button } from "@/components/ui/button";
import { JsonSchemaForm, getПо умолчаниюЗначениеs, validateJsonSchemaForm } from "@/components/JsonSchemaForm";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useКомпания } from "@/context/КомпанияContext";
import { useToast } from "@/context/ToastContext";
import { queryКлючs } from "@/lib/queryКлючs";
import {
  Field,
  ToggleField,
  adapterЯрлыки,
} from "../components/agent-config-primitives";

type ОкружениеFormState = {
  name: string;
  description: string;
  driver: "local" | "ssh" | "sandbox";
  sshХост: string;
  sshПорт: string;
  sshUsername: string;
  sshRemoteРабочая областьПуть: string;
  sshPrivateКлюч: string;
  sshPrivateКлючСекретId: string;
  sshKnownХостs: string;
  sshStrictХостКлючChecking: boolean;
  sandboxПровайдер: string;
  sandboxConfig: Record<string, unknown>;
};

const ENVIRONMENT_SUPPORT_ROWS = AGENT_ADAPTER_TYPES.map((adapterТип) => ({
  adapterТип,
  support: getАдаптерОкружениеSupport(adapterТип),
}));

function buildОкружениеPayload(form: ОкружениеFormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    driver: form.driver,
    config:
      form.driver === "ssh"
        ? {
            host: form.sshХост.trim(),
            port: Number.parseInt(form.sshПорт || "22", 10) || 22,
            username: form.sshUsername.trim(),
            remoteРабочая областьПуть: form.sshRemoteРабочая областьПуть.trim(),
            privateКлюч: form.sshPrivateКлюч.trim() || null,
            privateКлючСекретRef:
              form.sshPrivateКлюч.trim().length > 0 || !form.sshPrivateКлючСекретId
                ? null
                : { type: "secret_ref" as const, secretId: form.sshPrivateКлючСекретId, version: "latest" as const },
            knownХостs: form.sshKnownХостs.trim() || null,
            strictХостКлючChecking: form.sshStrictХостКлючChecking,
          }
        : form.driver === "sandbox"
          ? {
              provider: form.sandboxПровайдер.trim(),
              ...form.sandboxConfig,
            }
          : {},
  } as const;
}

function createEmptyОкружениеForm(): ОкружениеFormState {
  return {
    name: "",
    description: "",
    driver: "ssh",
    sshХост: "",
    sshПорт: "22",
    sshUsername: "",
    sshRemoteРабочая областьПуть: "",
    sshPrivateКлюч: "",
    sshPrivateКлючСекретId: "",
    sshKnownХостs: "",
    sshStrictХостКлючChecking: true,
    sandboxПровайдер: "",
    sandboxConfig: {},
  };
}

function readSshConfig(environment: Окружение) {
  const config = environment.config ?? {};
  return {
    host: typeof config.host === "string" ? config.host : "",
    port:
      typeof config.port === "number"
        ? String(config.port)
        : typeof config.port === "string"
          ? config.port
          : "22",
    username: typeof config.username === "string" ? config.username : "",
    remoteРабочая областьПуть:
      typeof config.remoteРабочая областьПуть === "string" ? config.remoteРабочая областьПуть : "",
    privateКлюч: "",
    privateКлючСекретId:
      config.privateКлючСекретRef &&
      typeof config.privateКлючСекретRef === "object" &&
      !Array.isArray(config.privateКлючСекретRef) &&
      typeof (config.privateКлючСекретRef as { secretId?: unknown }).secretId === "string"
        ? String((config.privateКлючСекретRef as { secretId: string }).secretId)
        : "",
    knownХостs: typeof config.knownХостs === "string" ? config.knownХостs : "",
    strictХостКлючChecking:
      typeof config.strictХостКлючChecking === "boolean"
        ? config.strictХостКлючChecking
        : true,
  };
}

function readSandboxConfig(environment: Окружение) {
  const config = environment.config ?? {};
  const { provider: rawПровайдер, ...providerConfig } = config;
  return {
    provider: typeof rawПровайдер === "string" && rawПровайдер.trim().length > 0
      ? rawПровайдер
      : "fake",
    config: providerConfig,
  };
}

function normalizeJsonSchema(schema: unknown): JsonSchema | null {
  return schema && typeof schema === "object" && !Array.isArray(schema)
    ? schema as JsonSchema
    : null;
}

function summarizeSandboxConfig(config: Record<string, unknown>): string | null {
  for (const key of ["template", "image", "region", "workspaceПуть"]) {
    const value = config[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function SupportMark({ supported }: { supported: boolean }) {
  return supported ? (
    <span classИмя="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
      <Check classИмя="h-3 w-3" />
      Да
    </span>
  ) : (
    <span classИмя="text-muted-foreground">Нет</span>
  );
}

export function КомпанияОкружения() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editingОкружениеId, setИзменитьingОкружениеId] = useState<string | null>(null);
  const [environmentForm, setОкружениеForm] = useState<ОкружениеFormState>(createEmptyОкружениеForm);
  const [probeResults, setProbeResults] = useState<Record<string, ОкружениеProbeResult | null>>({});

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/company/settings" },
      { label: "Окружения" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
    retry: false,
  });
  const environmentsВключитьd = experimentalНастройки?.enableОкружения === true;

  const { data: environments } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.environments.list(selectedКомпанияId) : ["environments", "none"],
    queryFn: () => environmentsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId) && environmentsВключитьd,
  });
  const { data: environmentCapabilities } = useQuery({
    queryКлюч: selectedКомпанияId ? ["environment-capabilities", selectedКомпанияId] : ["environment-capabilities", "none"],
    queryFn: () => environmentsApi.capabilities(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId) && environmentsВключитьd,
  });

  const { data: secrets } = useQuery({
    queryКлюч: selectedКомпанияId ? ["company-secrets", selectedКомпанияId] : ["company-secrets", "none"],
    queryFn: () => secretsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const environmentMutation = useMutation({
    mutationFn: async (form: ОкружениеFormState) => {
      const body = buildОкружениеPayload(form);

      if (editingОкружениеId) {
        return await environmentsApi.update(editingОкружениеId, body);
      }

      return await environmentsApi.create(selectedКомпанияId!, body);
    },
    onУспешно: async (environment) => {
      await queryClient.invalidateQueries({
        queryКлюч: queryКлючs.environments.list(selectedКомпанияId!),
      });
      setИзменитьingОкружениеId(null);
      setОкружениеForm(createEmptyОкружениеForm());
      pushToast({
        title: editingОкружениеId ? "Окружение updated" : "Окружение created",
        body: `${environment.name} is ready.`,
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to save environment",
        body: error instanceof Ошибка ? error.message : "Окружение save failed.",
        tone: "error",
      });
    },
  });

  const environmentProbeMutation = useMutation({
    mutationFn: async (environmentId: string) => await environmentsApi.probe(environmentId),
    onУспешно: (probe, environmentId) => {
      setProbeResults((current) => ({
        ...current,
        [environmentId]: probe,
      }));
      pushToast({
        title: probe.ok ? "Окружение probe passed" : "Окружение probe failed",
        body: probe.summary,
        tone: probe.ok ? "success" : "error",
      });
    },
    onОшибка: (error, environmentId) => {
      const failedОкружение = (environments ?? []).find((environment) => environment.id === environmentId);
      setProbeResults((current) => ({
        ...current,
        [environmentId]: {
          ok: false,
          driver: failedОкружение?.driver ?? "local",
          summary: error instanceof Ошибка ? error.message : "Окружение probe failed.",
          details: null,
        },
      }));
      pushToast({
        title: "Окружение probe failed",
        body: error instanceof Ошибка ? error.message : "Окружение probe failed.",
        tone: "error",
      });
    },
  });

  const draftОкружениеProbeMutation = useMutation({
    mutationFn: async (form: ОкружениеFormState) => {
      const body = buildОкружениеPayload(form);
      return await environmentsApi.probeConfig(selectedКомпанияId!, body);
    },
    onУспешно: (probe) => {
      pushToast({
        title: probe.ok ? "Черновик probe passed" : "Черновик probe failed",
        body: probe.summary,
        tone: probe.ok ? "success" : "error",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Черновик probe failed",
        body: error instanceof Ошибка ? error.message : "Окружение probe failed.",
        tone: "error",
      });
    },
  });

  useEffect(() => {
    setИзменитьingОкружениеId(null);
    setОкружениеForm(createEmptyОкружениеForm());
    setProbeResults({});
  }, [selectedКомпанияId]);

  function handleИзменитьОкружение(environment: Окружение) {
    setИзменитьingОкружениеId(environment.id);
    if (environment.driver === "ssh") {
      const ssh = readSshConfig(environment);
      setОкружениеForm({
        ...createEmptyОкружениеForm(),
        name: environment.name,
        description: environment.description ?? "",
        driver: "ssh",
        sshХост: ssh.host,
        sshПорт: ssh.port,
        sshUsername: ssh.username,
        sshRemoteРабочая областьПуть: ssh.remoteРабочая областьПуть,
        sshPrivateКлюч: ssh.privateКлюч,
        sshPrivateКлючСекретId: ssh.privateКлючСекретId,
        sshKnownХостs: ssh.knownХостs,
        sshStrictХостКлючChecking: ssh.strictХостКлючChecking,
      });
      return;
    }

    if (environment.driver === "sandbox") {
      const sandbox = readSandboxConfig(environment);
      setОкружениеForm({
        ...createEmptyОкружениеForm(),
        name: environment.name,
        description: environment.description ?? "",
        driver: "sandbox",
        sandboxПровайдер: sandbox.provider,
        sandboxConfig: sandbox.config,
      });
      return;
    }

    setОкружениеForm({
      ...createEmptyОкружениеForm(),
      name: environment.name,
      description: environment.description ?? "",
      driver: "local",
    });
  }

  function handleОтменаОкружениеИзменить() {
    setИзменитьingОкружениеId(null);
    setОкружениеForm(createEmptyОкружениеForm());
  }

  const discoveredPluginSandboxПровайдерs = Object.entries(environmentCapabilities?.sandboxПровайдерs ?? {})
    .filter(([provider, capability]) => provider !== "fake" && capability.supportsЗапуститьExecution)
    .map(([provider, capability]) => ({
      provider,
      displayИмя: capability.displayИмя || provider,
      description: capability.description,
      configSchema: normalizeJsonSchema(capability.configSchema),
    }))
    .sort((left, right) => left.displayИмя.localeCompare(right.displayИмя));
  const sandboxCreationВключитьd = discoveredPluginSandboxПровайдерs.length > 0;
  const sandboxSupportVisible = sandboxCreationВключитьd;
  const pluginSandboxПровайдерs =
    environmentForm.sandboxПровайдер.trim().length > 0 &&
    environmentForm.sandboxПровайдер !== "fake" &&
    !discoveredPluginSandboxПровайдерs.some((provider) => provider.provider === environmentForm.sandboxПровайдер)
      ? [
          ...discoveredPluginSandboxПровайдерs,
          { provider: environmentForm.sandboxПровайдер, displayИмя: environmentForm.sandboxПровайдер, description: undefined, configSchema: null },
        ]
      : discoveredPluginSandboxПровайдерs;

  const selectedSandboxПровайдер = pluginSandboxПровайдерs.find(
    (provider) => provider.provider === environmentForm.sandboxПровайдер,
  ) ?? null;
  const selectedSandboxSchema = selectedSandboxПровайдер?.configSchema ?? null;
  const sandboxConfigОшибкаs =
    environmentForm.driver === "sandbox" && selectedSandboxSchema
      ? validateJsonSchemaForm(selectedSandboxSchema as any, environmentForm.sandboxConfig)
      : {};

  useEffect(() => {
    if (environmentForm.driver !== "sandbox") return;
    if (environmentForm.sandboxПровайдер.trim().length > 0 && environmentForm.sandboxПровайдер !== "fake") return;
    const firstПровайдер = discoveredPluginSandboxПровайдерs[0]?.provider;
    if (!firstПровайдер) return;
    const firstSchema = discoveredPluginSandboxПровайдерs[0]?.configSchema;
    setОкружениеForm((current) => (
      current.driver !== "sandbox" || (current.sandboxПровайдер.trim().length > 0 && current.sandboxПровайдер !== "fake")
        ? current
        : {
            ...current,
            sandboxПровайдер: firstПровайдер,
            sandboxConfig: firstSchema ? getПо умолчаниюЗначениеs(firstSchema as any) : {},
          }
    ));
  }, [discoveredPluginSandboxПровайдерs, environmentForm.driver, environmentForm.sandboxПровайдер]);

  const environmentFormValid =
    environmentForm.name.trim().length > 0 &&
    (environmentForm.driver !== "ssh" ||
      (
        environmentForm.sshХост.trim().length > 0 &&
        environmentForm.sshUsername.trim().length > 0 &&
        environmentForm.sshRemoteРабочая областьПуть.trim().length > 0
      )) &&
    (environmentForm.driver !== "sandbox" ||
      environmentForm.sandboxПровайдер.trim().length > 0 &&
      environmentForm.sandboxПровайдер !== "fake" &&
      Object.keys(sandboxConfigОшибкаs).length === 0);

  if (!selectedКомпанияId) {
    return <div classИмя="text-sm text-muted-foreground">Select a company to manage environments.</div>;
  }

  if (!environmentsВключитьd) {
    return (
      <div classИмя="max-w-3xl space-y-4">
        <div classИмя="flex items-center gap-2">
          <Настройки classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Компания Окружения</h1>
        </div>
        <div classИмя="rounded-md border border-border px-4 py-4 text-sm text-muted-foreground">
          Включить Окружения in instance experimental settings to manage company execution targets.
        </div>
      </div>
    );
  }

  return (
    <div classИмя="max-w-5xl space-y-6" data-testid="company-settings-environments-section">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <Настройки classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Компания Окружения</h1>
        </div>
        <p classИмя="max-w-3xl text-sm text-muted-foreground">
          Define reusable execution targets for projects, issue workspaces, and remote-capable adapters.
        </p>
      </div>

      <div classИмя="space-y-4 rounded-md border border-border px-4 py-4">
        <div classИмя="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Окружение choices use the same adapter support matrix as agent defaults. SSH is always available for
          remote-managed adapters, and sandbox environments appear only when a run-capable sandbox provider plugin is
          installed.
        </div>
        {sandboxCreationВключитьd ? (
          <div classИмя="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Installed sandbox providers:{" "}
            <span classИмя="font-medium text-foreground">
              {discoveredPluginSandboxПровайдерs.map((provider) => provider.displayИмя).join(", ")}
            </span>
            . These are not adapter types. They back the Sandbox driver for adapters that support sandbox execution.
          </div>
        ) : null}

        <div classИмя="overflow-x-auto">
          <table classИмя="w-full min-w-[34rem] text-left text-xs">
            <caption classИмя="sr-only">Окружение support by adapter</caption>
            <thead classИмя="border-b border-border text-muted-foreground">
              <tr>
                <th classИмя="py-2 pr-3 font-medium">Адаптер</th>
                <th classИмя="px-3 py-2 font-medium">Local</th>
                <th classИмя="px-3 py-2 font-medium">SSH</th>
                {sandboxSupportVisible ? (
                  <th classИмя="px-3 py-2 font-medium">Sandbox via plugin</th>
                ) : null}
              </tr>
            </thead>
            <tbody classИмя="divide-y divide-border/60">
              {(environmentCapabilities?.adapters.map((support) => ({
                adapterТип: support.adapterТип,
                support,
              })) ?? ENVIRONMENT_SUPPORT_ROWS).map(({ adapterТип, support }) => (
                <tr key={adapterТип}>
                  <td classИмя="py-2 pr-3 font-medium">
                    {adapterЯрлыки[adapterТип] ?? adapterТип}
                  </td>
                  <td classИмя="px-3 py-2">
                    <SupportMark supported={support.drivers.local === "supported"} />
                  </td>
                  <td classИмя="px-3 py-2">
                    <SupportMark supported={support.drivers.ssh === "supported"} />
                  </td>
                  {sandboxSupportVisible ? (
                    <td classИмя="px-3 py-2">
                      <SupportMark
                        supported={discoveredPluginSandboxПровайдерs.some((provider) =>
                          support.sandboxПровайдерs[provider.provider] === "supported")}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div classИмя="space-y-3">
          {(environments ?? []).length === 0 ? (
            <div classИмя="text-sm text-muted-foreground">Нет environments saved for this company yet.</div>
          ) : (
            (environments ?? []).map((environment) => {
              const probe = probeResults[environment.id] ?? null;
              const isИзменитьing = editingОкружениеId === environment.id;
              return (
                <div
                  key={environment.id}
                  classИмя="rounded-md border border-border/70 px-3 py-3"
                >
                  <div classИмя="flex flex-wrap items-start justify-between gap-3">
                    <div classИмя="space-y-1">
                      <div classИмя="text-sm font-medium">
                        {environment.name} <span classИмя="text-muted-foreground">· {environment.driver}</span>
                      </div>
                      {environment.description ? (
                        <div classИмя="text-xs text-muted-foreground">{environment.description}</div>
                      ) : null}
                      {environment.driver === "ssh" ? (
                        <div classИмя="text-xs text-muted-foreground">
                          {typeof environment.config.host === "string" ? environment.config.host : "SSH host"} ·{" "}
                          {typeof environment.config.username === "string" ? environment.config.username : "user"}
                        </div>
                      ) : environment.driver === "sandbox" ? (
                        <div classИмя="text-xs text-muted-foreground">
                          {(() => {
                            const provider =
                              typeof environment.config.provider === "string" ? environment.config.provider : "sandbox";
                            const displayИмя =
                              environmentCapabilities?.sandboxПровайдерs?.[provider]?.displayИмя ?? provider;
                            const summary = summarizeSandboxConfig(environment.config as Record<string, unknown>);
                            return `${displayИмя} sandbox provider${summary ? ` · ${summary}` : ""}`;
                          })()}
                        </div>
                      ) : (
                        <div classИмя="text-xs text-muted-foreground">Запуститьs on this Paperclip host.</div>
                      )}
                    </div>
                    <div classИмя="flex flex-wrap items-center gap-2">
                      {environment.driver !== "local" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => environmentProbeMutation.mutate(environment.id)}
                          disabled={environmentProbeMutation.isОжидание}
                        >
                          {environmentProbeMutation.isОжидание
                            ? "Проверитьing..."
                            : environment.driver === "ssh"
                              ? "Проверить connection"
                              : "Проверить provider"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleИзменитьОкружение(environment)}
                      >
                        {isИзменитьing ? "Изменитьing" : "Изменить"}
                      </Button>
                    </div>
                  </div>
                  {probe ? (
                    <div
                      classИмя={
                        probe.ok
                          ? "mt-3 rounded border border-green-500/30 bg-green-500/5 px-2.5 py-2 text-xs text-green-700"
                          : "mt-3 rounded border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
                      }
                    >
                      <div classИмя="font-medium">{probe.summary}</div>
                      {probe.details?.error && typeof probe.details.error === "string" ? (
                        <div classИмя="mt-1 font-mono text-[11px]">{probe.details.error}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div classИмя="border-t border-border/60 pt-4">
          <div classИмя="mb-3 text-sm font-medium">
            {editingОкружениеId ? "Изменить environment" : "Добавить окружение"}
          </div>
          <div classИмя="space-y-3">
            <Field label="Имя" hint="Operator-facing name for this execution target.">
              <input
                classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                type="text"
                value={environmentForm.name}
                onChange={(e) => setОкружениеForm((current) => ({ ...current, name: e.target.value }))}
              />
            </Field>
            <Field label="Описание" hint="Опционально note about what this machine is for.">
              <input
                classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                type="text"
                value={environmentForm.description}
                onChange={(e) => setОкружениеForm((current) => ({ ...current, description: e.target.value }))}
              />
            </Field>
            <Field label="Driver" hint="Local runs on this host. SSH stores a remote machine target. Sandbox stores plugin-backed provider config on the shared environment seam.">
              <select
                classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                value={environmentForm.driver}
                onChange={(e) =>
                  setОкружениеForm((current) => ({
                    ...current,
                    sandboxПровайдер:
                      e.target.value === "sandbox"
                        ? current.sandboxПровайдер.trim() || discoveredPluginSandboxПровайдерs[0]?.provider || ""
                        : current.sandboxПровайдер,
                    sandboxConfig:
                      e.target.value === "sandbox"
                        ? (
                            current.sandboxПровайдер.trim().length > 0 && current.driver === "sandbox"
                              ? current.sandboxConfig
                              : discoveredPluginSandboxПровайдерs[0]?.configSchema
                                ? getПо умолчаниюЗначениеs(discoveredPluginSandboxПровайдерs[0].configSchema as any)
                                : {}
                          )
                        : current.sandboxConfig,
                    driver:
                      e.target.value === "local"
                        ? "local"
                        : e.target.value === "sandbox"
                          ? "sandbox"
                          : "ssh",
                  }))}
              >
                <option value="ssh">SSH</option>
                {sandboxCreationВключитьd || environmentForm.driver === "sandbox" ? (
                  <option value="sandbox">Sandbox</option>
                ) : null}
                <option value="local">Local</option>
              </select>
            </Field>

            {environmentForm.driver === "ssh" ? (
              <div classИмя="grid gap-3 md:grid-cols-2">
                <Field label="Хост" hint="DNS name or IP address for the remote machine.">
                  <input
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    type="text"
                    value={environmentForm.sshХост}
                    onChange={(e) => setОкружениеForm((current) => ({ ...current, sshХост: e.target.value }))}
                  />
                </Field>
                <Field label="Порт" hint="По умолчаниюs to 22.">
                  <input
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    type="number"
                    min={1}
                    max={65535}
                    value={environmentForm.sshПорт}
                    onChange={(e) => setОкружениеForm((current) => ({ ...current, sshПорт: e.target.value }))}
                  />
                </Field>
                <Field label="Username" hint="SSH login user.">
                  <input
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    type="text"
                    value={environmentForm.sshUsername}
                    onChange={(e) => setОкружениеForm((current) => ({ ...current, sshUsername: e.target.value }))}
                  />
                </Field>
                <Field label="Remote workspace path" hint="Absolute path that Paperclip will verify during SSH connection tests.">
                  <input
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    type="text"
                    placeholder="/Users/paperclip/workspace"
                    value={environmentForm.sshRemoteРабочая областьПуть}
                    onChange={(e) =>
                      setОкружениеForm((current) => ({ ...current, sshRemoteРабочая областьПуть: e.target.value }))}
                  />
                </Field>
                <Field label="Private key" hint="Опционально PEM private key. Leave blank to rely on the server's SSH agent or default keychain.">
                  <div classИмя="space-y-2">
                    <select
                      classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                      value={environmentForm.sshPrivateКлючСекретId}
                      onChange={(e) =>
                        setОкружениеForm((current) => ({
                          ...current,
                          sshPrivateКлючСекретId: e.target.value,
                          sshPrivateКлюч: e.target.value ? "" : current.sshPrivateКлюч,
                        }))}
                    >
                      <option value="">Нет saved secret</option>
                      {(secrets ?? []).map((secret) => (
                        <option key={secret.id} value={secret.id}>{secret.name}</option>
                      ))}
                    </select>
                    <textarea
                      classИмя="h-32 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-mono outline-none"
                      value={environmentForm.sshPrivateКлюч}
                      disabled={!!environmentForm.sshPrivateКлючСекретId}
                      onChange={(e) => setОкружениеForm((current) => ({ ...current, sshPrivateКлюч: e.target.value }))}
                    />
                  </div>
                </Field>
                <Field label="Known hosts" hint="Опционально known_hosts block used when strict host key checking is enabled.">
                  <textarea
                    classИмя="h-32 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-mono outline-none"
                    value={environmentForm.sshKnownХостs}
                    onChange={(e) => setОкружениеForm((current) => ({ ...current, sshKnownХостs: e.target.value }))}
                  />
                </Field>
                <div classИмя="md:col-span-2">
                  <ToggleField
                    label="Strict host key checking"
                    hint="Keep this on unless you deliberately want probe-time host key acceptance disabled."
                    checked={environmentForm.sshStrictХостКлючChecking}
                    onChange={(checked) =>
                      setОкружениеForm((current) => ({ ...current, sshStrictХостКлючChecking: checked }))}
                  />
                </div>
              </div>
            ) : null}

            {environmentForm.driver === "sandbox" ? (
              <div classИмя="grid gap-3 md:grid-cols-2">
                <Field label="Провайдер" hint="Installed run-capable sandbox provider plugins appear here.">
                  <select
                    classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    value={environmentForm.sandboxПровайдер}
                    onChange={(e) => {
                      const nextПровайдерКлюч = e.target.value;
                      const nextПровайдер = pluginSandboxПровайдерs.find((provider) => provider.provider === nextПровайдерКлюч) ?? null;
                      setОкружениеForm((current) => ({
                        ...current,
                        sandboxПровайдер: nextПровайдерКлюч,
                        sandboxConfig:
                          current.sandboxПровайдер === nextПровайдерКлюч
                            ? current.sandboxConfig
                            : nextПровайдер?.configSchema
                              ? getПо умолчаниюЗначениеs(nextПровайдер.configSchema as any)
                              : {},
                      }));
                    }}
                  >
                    {pluginSandboxПровайдерs.map((provider) => (
                      <option key={provider.provider} value={provider.provider}>
                        {provider.displayИмя}
                      </option>
                    ))}
                  </select>
                </Field>
                <div classИмя="md:col-span-2 space-y-3">
                  {selectedSandboxПровайдер?.description ? (
                    <div classИмя="text-xs text-muted-foreground">
                      {selectedSandboxПровайдер.description}
                    </div>
                  ) : null}
                  {selectedSandboxSchema ? (
                    <JsonSchemaForm
                      schema={selectedSandboxSchema as any}
                      values={environmentForm.sandboxConfig}
                      onChange={(values) =>
                        setОкружениеForm((current) => ({ ...current, sandboxConfig: values }))}
                      errors={sandboxConfigОшибкаs}
                    />
                  ) : (
                    <div classИмя="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      This provider does not declare additional configuration fields.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div classИмя="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => environmentMutation.mutate(environmentForm)}
                disabled={environmentMutation.isОжидание || !environmentFormValid}
              >
                {environmentMutation.isОжидание
                  ? editingОкружениеId
                    ? "Saving..."
                    : "Creating..."
                  : editingОкружениеId
                    ? "Сохранить environment"
                    : "Создать environment"}
              </Button>
              {editingОкружениеId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleОтменаОкружениеИзменить}
                  disabled={environmentMutation.isОжидание}
                >
                  Отмена
                </Button>
              ) : null}
              {environmentForm.driver !== "local" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => draftОкружениеProbeMutation.mutate(environmentForm)}
                  disabled={draftОкружениеProbeMutation.isОжидание || !environmentFormValid}
                >
                  {draftОкружениеProbeMutation.isОжидание ? "Проверитьing..." : "Проверить draft"}
                </Button>
              ) : null}
              {environmentMutation.isОшибка ? (
                <span classИмя="text-xs text-destructive">
                  {environmentMutation.error instanceof Ошибка
                    ? environmentMutation.error.message
                    : "Ошибка to save environment"}
                </span>
              ) : null}
              {draftОкружениеProbeMutation.data ? (
                <span classИмя={draftОкружениеProbeMutation.data.ok ? "text-xs text-green-600" : "text-xs text-destructive"}>
                  {draftОкружениеProbeMutation.data.summary}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
