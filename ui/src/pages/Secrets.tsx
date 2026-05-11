import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  АрхивироватьRestore,
  Архивировать,
  Ban,
  CheckCircle2,
  Cloud,
  Database,
  Изменить3,
  ExternalLink,
  КлючRound,
  Link2,
  Loader2,
  Plus,
  ОбновитьCw,
  Поиск,
  ShieldCheck,
  Star,
  Trash2,
  X,
  Фильтр,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  КомпанияСекрет,
  КомпанияСекретИспользованиеBinding,
  КомпанияСекретПровайдерConfig,
  СекретДоступEvent,
  СекретManagedMode,
  СекретПровайдер,
  СекретПровайдерConfigСтатус,
  СекретПровайдерDescriptor,
  СекретСтатус,
} from "@paperclipai/shared";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import {
  secretsApi,
  type СоздатьСекретInput,
  type СоздатьСекретПровайдерConfigInput,
  type СекретПровайдерHealthResponse,
  type ОбновитьСекретПровайдерConfigInput,
} from "../api/secrets";
import { ApiОшибка } from "../api/client";
import { queryКлючs } from "../lib/queryКлючs";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetНазвание,
  SheetОписание,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { ИмпортFromVaultDialog } from "./secrets/ИмпортFromVaultDialog";

type СоздатьMode = "managed" | "external";
type СекретыTab = "secrets" | "vaults";

type ПровайдерVaultForm = {
  provider: СекретПровайдер;
  displayИмя: string;
  status: СекретПровайдерConfigСтатус;
  isПо умолчанию: boolean;
  backupReminderAcknowledged: boolean;
  region: string;
  namespace: string;
  secretИмяPrefix: string;
  kmsКлючId: string;
  ownerTag: string;
  environmentTag: string;
  projectId: string;
  location: string;
  address: string;
  mountПуть: string;
  secretПутьPrefix: string;
};

const PROVIDER_ORDER: СекретПровайдер[] = [
  "local_encrypted",
  "aws_secrets_manager",
  "gcp_secret_manager",
  "vault",
];

function defaultПровайдерVaultСтатус(provider: СекретПровайдер): СекретПровайдерConfigСтатус {
  return provider === "gcp_secret_manager" || provider === "vault" ? "coming_soon" : "ready";
}

function emptyПровайдерVaultForm(provider: СекретПровайдер = "local_encrypted"): ПровайдерVaultForm {
  return {
    provider,
    displayИмя: "",
    status: defaultПровайдерVaultСтатус(provider),
    isПо умолчанию: false,
    backupReminderAcknowledged: false,
    region: "",
    namespace: "",
    secretИмяPrefix: "",
    kmsКлючId: "",
    ownerTag: "",
    environmentTag: "",
    projectId: "",
    location: "",
    address: "",
    mountПуть: "",
    secretПутьPrefix: "",
  };
}

function providerConfigЗначение(config: КомпанияСекретПровайдерConfig["config"], key: string) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function providerVaultFormFromConfig(config: КомпанияСекретПровайдерConfig): ПровайдерVaultForm {
  return {
    ...emptyПровайдерVaultForm(config.provider),
    displayИмя: config.displayИмя,
    status: config.status,
    isПо умолчанию: config.isПо умолчанию,
    backupReminderAcknowledged:
      Boolean((config.config as Record<string, unknown> | undefined)?.backupReminderAcknowledged),
    region: providerConfigЗначение(config.config, "region"),
    namespace: providerConfigЗначение(config.config, "namespace"),
    secretИмяPrefix: providerConfigЗначение(config.config, "secretИмяPrefix"),
    kmsКлючId: providerConfigЗначение(config.config, "kmsКлючId"),
    ownerTag: providerConfigЗначение(config.config, "ownerTag"),
    environmentTag: providerConfigЗначение(config.config, "environmentTag"),
    projectId: providerConfigЗначение(config.config, "projectId"),
    location: providerConfigЗначение(config.config, "location"),
    address: providerConfigЗначение(config.config, "address"),
    mountПуть: providerConfigЗначение(config.config, "mountПуть"),
    secretПутьPrefix: providerConfigЗначение(config.config, "secretПутьPrefix"),
  };
}

function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return date.toLocaleString();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function statusTextTone(status: СекретСтатус) {
  switch (status) {
    case "active":
      return "text-emerald-700 dark:text-emerald-300";
    case "disabled":
      return "text-amber-700 dark:text-amber-300";
    case "archived":
      return "text-muted-foreground";
    case "deleted":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function providerLabel(providers: СекретПровайдерDescriptor[] | undefined, id: СекретПровайдер) {
  return providers?.find((p) => p.id === id)?.label ?? id.replaceВсе("_", " ");
}

function normalizeСекретКлючForПредпросмотр(input: string) {
  return input
    .trim()
    .toНизкийerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}


function modeLabel(managedMode: СекретManagedMode) {
  return managedMode === "paperclip_managed" ? "Paperclip-managed" : "Linked external";
}

function modeОписание(managedMode: СекретManagedMode) {
  return managedMode === "paperclip_managed"
    ? "Paperclip owns create and rotation writes for this provider secret."
    : "Paperclip resolves this provider reference but does not rotate the provider value.";
}

function healthEntryForПровайдер(
  health: СекретПровайдерHealthResponse | null,
  providerId: СекретПровайдер,
) {
  return health?.providers.find((entry) => entry.provider === providerId) ?? null;
}

export function getСоздатьПровайдерBlockReason(
  provider: СекретПровайдерDescriptor | null | undefined,
  mode: СоздатьMode,
  health: СекретПровайдерHealthResponse | null,
) {
  if (!provider) return "Select a provider.";
  if (mode === "managed" && provider.supportsManagedЗначениеs === false) {
    return `${provider.label} does not support Paperclip-managed secret values.`;
  }
  if (mode === "external" && provider.supportsExternalСсылки === false) {
    return `${provider.label} does not support linked external references.`;
  }
  if (provider.configured === false) {
    const healthEntry = healthEntryForПровайдер(health, provider.id);
    return healthEntry?.message
      ? `${provider.label} is not configured in this deployment. ${healthEntry.message}`
      : `${provider.label} is not configured in this deployment.`;
  }
  const healthEntry = healthEntryForПровайдер(health, provider.id);
  if (healthEntry?.status === "error") {
    return `${provider.label} health check failed: ${healthEntry.message}`;
  }
  return null;
}

function providerHealthText(
  provider: СекретПровайдерDescriptor | null | undefined,
  health: СекретПровайдерHealthResponse | null,
) {
  if (!provider) return null;
  const entry = healthEntryForПровайдер(health, provider.id);
  if (!entry) return null;
  const warnings = entry.warnings?.join(" ");
  return [entry.message, warnings].filter(Boolean).join(" ");
}

function detailString(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getПровайдерConfigBlockReason(
  config: КомпанияСекретПровайдерConfig | null | undefined,
) {
  if (!config) return null;
  if (config.status === "disabled") return "This provider vault is disabled.";
  if (config.status === "coming_soon") return "This provider vault is saved as draft metadata only.";
  if (config.healthСтатус === "error") {
    return config.healthMessage ?? "This provider vault health check failed.";
  }
  return null;
}

export function getПо умолчаниюПровайдерConfigId(
  configs: КомпанияСекретПровайдерConfig[],
  provider: СекретПровайдер,
) {
  const providerConfigs = configs.filter((config) => config.provider === provider);
  const selectable = providerConfigs.filter((config) => !getПровайдерConfigBlockReason(config));
  return (
    selectable.find((config) => config.isПо умолчанию)?.id ??
    selectable[0]?.id ??
    providerConfigs.find((config) => config.isПо умолчанию)?.id ??
    ""
  );
}

function providerVaultLabel(configs: КомпанияСекретПровайдерConfig[], id: string | null | undefined) {
  if (!id) return "Deployment default";
  return configs.find((config) => config.id === id)?.displayИмя ?? "Неизвестно vault";
}

function buildПровайдерVaultConfig(form: ПровайдерVaultForm): Record<string, unknown> {
  const compact = (value: string) => value.trim() || null;
  switch (form.provider) {
    case "local_encrypted":
      return { backupReminderAcknowledged: form.backupReminderAcknowledged };
    case "aws_secrets_manager":
      return {
        region: form.region.trim(),
        namespace: compact(form.namespace),
        secretИмяPrefix: compact(form.secretИмяPrefix),
        kmsКлючId: compact(form.kmsКлючId),
        ownerTag: compact(form.ownerTag),
        environmentTag: compact(form.environmentTag),
      };
    case "gcp_secret_manager":
      return {
        projectId: compact(form.projectId),
        location: compact(form.location),
        namespace: compact(form.namespace),
        secretИмяPrefix: compact(form.secretИмяPrefix),
      };
    case "vault":
      return {
        address: compact(form.address),
        namespace: compact(form.namespace),
        mountПуть: compact(form.mountПуть),
        secretПутьPrefix: compact(form.secretПутьPrefix),
      };
    default:
      return {};
  }
}

export function getAwsManagedПутьПредпросмотр(input: {
  provider: СекретПровайдерDescriptor | null | undefined;
  health: СекретПровайдерHealthResponse | null;
  companyId: string;
  secretКлючSource: string;
}) {
  if (input.provider?.id !== "aws_secrets_manager") return null;
  const healthEntry = healthEntryForПровайдер(input.health, "aws_secrets_manager");
  const prefix = detailString(healthEntry?.details, "prefix") ?? "paperclip";
  const deploymentId = detailString(healthEntry?.details, "deploymentId") ?? "{deploymentId}";
  const secretКлюч = normalizeСекретКлючForПредпросмотр(input.secretКлючSource) || "{secretКлюч}";
  return `${prefix}/${deploymentId}/${input.companyId}/${secretКлюч}`;
}

export function Секреты() {
  const queryClient = useQueryClient();
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const [activeTab, setАктивенTab] = useState<СекретыTab>("secrets");
  const [secretDetailTab, setСекретDetailTab] = useState("details");
  const [search, setПоиск] = useState("");
  const [statusФильтр, setСтатусФильтр] = useState<СекретСтатус | "all">("active");
  const [providerФильтр, setПровайдерФильтр] = useState<СекретПровайдер | "all">("all");
  const [selectedСекретId, setSelectedСекретId] = useState<string | null>(null);
  const [usageDialogСекретId, setИспользованиеDialogСекретId] = useState<string | null>(null);
  const [createOpen, setСоздатьOpen] = useState(false);
  const [importOpen, setИмпортOpen] = useState(false);
  const [createMode, setСоздатьMode] = useState<СоздатьMode>("managed");
  const [createForm, setСоздатьForm] = useState({
    name: "",
    key: "",
    value: "",
    description: "",
    externalRef: "",
    provider: "local_encrypted" as СекретПровайдер,
    providerConfigId: "",
  });
  const [createОшибка, setСоздатьОшибка] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateЗначение, setRotateЗначение] = useState("");
  const [rotateExternalRef, setRotateExternalRef] = useState("");
  const [rotateПровайдерConfigId, setRotateПровайдерConfigId] = useState("");
  const [rotateОшибка, setRotateОшибка] = useState<string | null>(null);
  const [deleteПодтвердить, setУдалитьПодтвердить] = useState<КомпанияСекрет | null>(null);
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [editingVault, setИзменитьingVault] = useState<КомпанияСекретПровайдерConfig | null>(null);
  const [vaultForm, setVaultForm] = useState<ПровайдерVaultForm>(() => emptyПровайдерVaultForm());
  const [vaultОшибка, setVaultОшибка] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Секреты" }]);
  }, [setBreadcrumbs]);

  const secretsQuery = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.secrets.list(selectedКомпанияId)
      : ["secrets", "__disabled__"],
    queryFn: () => secretsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const providersQuery = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.secrets.providers(selectedКомпанияId)
      : ["secret-providers", "__disabled__"],
    queryFn: () => secretsApi.providers(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
    staleTime: 5 * 60_000,
  });

  const providerHealthQuery = useQuery({
    queryКлюч: selectedКомпанияId
      ? ["secret-provider-health", selectedКомпанияId]
      : ["secret-provider-health", "__disabled__"],
    queryFn: () => secretsApi.providerHealth(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
    refetchInterval: 60_000,
    retry: false,
  });

  const providerConfigsQuery = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.secrets.providerConfigs(selectedКомпанияId)
      : ["secret-provider-configs", "__disabled__"],
    queryFn: () => secretsApi.providerConfigs(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
    retry: false,
  });

  const secrets = secretsQuery.data ?? [];
  const providers = providersQuery.data ?? [];
  const providerConfigs = providerConfigsQuery.data ?? [];
  const selectedСекрет = useMemo(
    () => secrets.find((secret) => secret.id === selectedСекретId) ?? null,
    [secrets, selectedСекретId],
  );
  const usageDialogСекрет = useMemo(
    () => secrets.find((secret) => secret.id === usageDialogСекретId) ?? null,
    [secrets, usageDialogСекретId],
  );
  const selectedСоздатьПровайдер = useMemo(
    () => providers.find((provider) => provider.id === createForm.provider) ?? null,
    [providers, createForm.provider],
  );
  const createПровайдерConfigs = useMemo(
    () => providerConfigs.filter((config) => config.provider === createForm.provider),
    [createForm.provider, providerConfigs],
  );
  const selectedСоздатьПровайдерConfig = useMemo(
    () => providerConfigs.find((config) => config.id === createForm.providerConfigId) ?? null,
    [createForm.providerConfigId, providerConfigs],
  );
  const selectedRotateПровайдерConfigs = useMemo(
    () => providerConfigs.filter((config) => config.provider === selectedСекрет?.provider),
    [providerConfigs, selectedСекрет?.provider],
  );
  const selectedRotateПровайдерConfig = useMemo(
    () => providerConfigs.find((config) => config.id === rotateПровайдерConfigId) ?? null,
    [providerConfigs, rotateПровайдерConfigId],
  );
  const createПровайдерBlockReason = getСоздатьПровайдерBlockReason(
    selectedСоздатьПровайдер,
    createMode,
    providerHealthQuery.data ?? null,
  ) ?? getПровайдерConfigBlockReason(selectedСоздатьПровайдерConfig);
  const rotateПровайдерBlockReason = getПровайдерConfigBlockReason(selectedRotateПровайдерConfig);
  const createПровайдерHealthText = providerHealthText(
    selectedСоздатьПровайдер,
    providerHealthQuery.data ?? null,
  );
  const awsManagedПутьПредпросмотр = getAwsManagedПутьПредпросмотр({
    provider: selectedСоздатьПровайдер,
    health: providerHealthQuery.data ?? null,
    companyId: selectedКомпанияId ?? "{companyId}",
    secretКлючSource: createForm.key.trim() || createForm.name,
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toНизкийerCase();
    return secrets.filter((secret) => {
      if (statusФильтр !== "all" && secret.status !== statusФильтр) return false;
      if (providerФильтр !== "all" && secret.provider !== providerФильтр) return false;
      if (!needle) return true;
      return (
        secret.name.toНизкийerCase().includes(needle) ||
        secret.key.toНизкийerCase().includes(needle) ||
        (secret.description?.toНизкийerCase().includes(needle) ?? false) ||
        (secret.externalRef?.toНизкийerCase().includes(needle) ?? false)
      );
    });
  }, [secrets, search, statusФильтр, providerФильтр]);
  const activeСекретФильтрCount = (statusФильтр === "active" ? 0 : 1) + (providerФильтр === "all" ? 0 : 1);

  const usageQuery = useQuery({
    queryКлюч: selectedСекрет ? queryКлючs.secrets.usage(selectedСекрет.id) : ["secrets", "usage", "__disabled__"],
    queryFn: () => secretsApi.usage(selectedСекрет!.id),
    enabled: Boolean(selectedСекрет),
  });
  const eventsQuery = useQuery({
    queryКлюч: selectedСекрет
      ? queryКлючs.secrets.accessEvents(selectedСекрет.id)
      : ["secrets", "access-events", "__disabled__"],
    queryFn: () => secretsApi.accessEvents(selectedСекрет!.id),
    enabled: Boolean(selectedСекрет),
  });

  const usageDialogQuery = useQuery({
    queryКлюч: usageDialogСекрет
      ? queryКлючs.secrets.usage(usageDialogСекрет.id)
      : ["secrets", "usage-dialog", "__disabled__"],
    queryFn: () => secretsApi.usage(usageDialogСекрет!.id),
    enabled: Boolean(usageDialogСекрет),
  });

  function invalidateВсе(extraIds: string[] = []) {
    if (!selectedКомпанияId) return;
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.list(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.providerConfigs(selectedКомпанияId) });
    for (const id of extraIds) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.usage(id) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.accessEvents(id) });
    }
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const input: СоздатьСекретInput = {
        name: createForm.name.trim(),
        provider: createForm.provider,
        providerConfigId: createForm.providerConfigId || null,
        managedMode: createMode === "external" ? "external_reference" : "paperclip_managed",
        description: createForm.description.trim() || null,
      };
      if (createForm.key.trim()) input.key = createForm.key.trim();
      if (createMode === "managed") {
        input.value = createForm.value;
      } else {
        input.externalRef = createForm.externalRef.trim();
      }
      return secretsApi.create(selectedКомпанияId!, input);
    },
    onУспешно: (created) => {
      pushToast({ title: "Секрет создан", body: created.name, tone: "success" });
      setСоздатьOpen(false);
      setСоздатьForm({
        name: "",
        key: "",
        value: "",
        description: "",
        externalRef: "",
        provider: createForm.provider,
        providerConfigId: getПо умолчаниюПровайдерConfigId(providerConfigs, createForm.provider),
      });
      setСоздатьОшибка(null);
      setSelectedСекретId(created.id);
      invalidateВсе([created.id]);
    },
    onОшибка: (error) => {
      setСоздатьОшибка(error instanceof ApiОшибка ? error.message : (error as Ошибка).message);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => {
      if (!selectedСекрет) throw new Ошибка("Select a secret first");
      if (selectedСекрет.managedMode === "external_reference") {
        return secretsApi.rotate(selectedСекрет.id, {
          externalRef: rotateExternalRef.trim() || selectedСекрет.externalRef || undefined,
          providerConfigId: rotateПровайдерConfigId || null,
        });
      }
      return secretsApi.rotate(selectedСекрет.id, {
        value: rotateЗначение,
        providerConfigId: rotateПровайдерConfigId || null,
      });
    },
    onУспешно: (updated) => {
      pushToast({ title: "Rotated", body: `${updated.name} → v${updated.latestВерсия}`, tone: "success" });
      setRotateOpen(false);
      setRotateЗначение("");
      setRotateExternalRef("");
      setRotateПровайдерConfigId("");
      setRotateОшибка(null);
      invalidateВсе([updated.id]);
    },
    onОшибка: (error) => {
      setRotateОшибка(error instanceof Ошибка ? error.message : "Rotate failed");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: СекретСтатус }) => {
      switch (status) {
        case "active":
          return secretsApi.enable(id);
        case "disabled":
          return secretsApi.disable(id);
        case "archived":
          return secretsApi.archive(id);
        default:
          return secretsApi.update(id, { status });
      }
    },
    onУспешно: (updated) => {
      pushToast({ title: `Секрет ${updated.status}`, body: updated.name, tone: "info" });
      invalidateВсе([updated.id]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Статус update failed",
        body: error instanceof Ошибка ? error.message : "Попробовать снова",
        tone: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => secretsApi.remove(id),
    onУспешно: (_response, id) => {
      pushToast({ title: "Секрет удалён", tone: "info" });
      setУдалитьПодтвердить(null);
      if (selectedСекретId === id) setSelectedСекретId(null);
      invalidateВсе([id]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка удаления",
        body: error instanceof Ошибка ? error.message : "Попробовать снова",
        tone: "error",
      });
    },
  });

  const saveVaultMutation = useMutation({
    mutationFn: () => {
      const data: СоздатьСекретПровайдерConfigInput | ОбновитьСекретПровайдерConfigInput = {
        displayИмя: vaultForm.displayИмя.trim(),
        status: vaultForm.status,
        isПо умолчанию: vaultForm.isПо умолчанию,
        config: buildПровайдерVaultConfig(vaultForm),
      };
      if (editingVault) {
        return secretsApi.updateПровайдерConfig(editingVault.id, data);
      }
      return secretsApi.createПровайдерConfig(selectedКомпанияId!, {
        ...(data as ОбновитьСекретПровайдерConfigInput),
        provider: vaultForm.provider,
      } as СоздатьСекретПровайдерConfigInput);
    },
    onУспешно: (saved) => {
      pushToast({ title: editingVault ? "Провайдер vault updated" : "Провайдер vault created", body: saved.displayИмя, tone: "success" });
      setVaultDialogOpen(false);
      setИзменитьingVault(null);
      setVaultForm(emptyПровайдерVaultForm());
      setVaultОшибка(null);
      invalidateВсе();
    },
    onОшибка: (error) => {
      setVaultОшибка(error instanceof ApiОшибка ? error.message : (error as Ошибка).message);
    },
  });

  const disableVaultMutation = useMutation({
    mutationFn: (id: string) => secretsApi.disableПровайдерConfig(id),
    onУспешно: (updated) => {
      pushToast({ title: "Провайдер vault disabled", body: updated.displayИмя, tone: "info" });
      invalidateВсе();
    },
    onОшибка: (error) => {
      pushToast({
        title: "Отключить failed",
        body: error instanceof Ошибка ? error.message : "Попробовать снова",
        tone: "error",
      });
    },
  });

  const defaultVaultMutation = useMutation({
    mutationFn: (id: string) => secretsApi.setПо умолчаниюПровайдерConfig(id),
    onУспешно: (updated) => {
      pushToast({ title: "По умолчанию vault set", body: updated.displayИмя, tone: "success" });
      invalidateВсе();
    },
    onОшибка: (error) => {
      pushToast({
        title: "По умолчанию update failed",
        body: error instanceof Ошибка ? error.message : "Попробовать снова",
        tone: "error",
      });
    },
  });

  const healthVaultMutation = useMutation({
    mutationFn: (id: string) => secretsApi.checkПровайдерConfigHealth(id),
    onУспешно: (health) => {
      pushToast({ title: "Health checked", body: health.message, tone: health.status === "error" ? "error" : "info" });
      invalidateВсе();
    },
    onОшибка: (error) => {
      pushToast({
        title: "Health check failed",
        body: error instanceof Ошибка ? error.message : "Попробовать снова",
        tone: "error",
      });
    },
  });

  useEffect(() => {
    if (!createOpen || providers.length === 0) return;
    const currentBlockReason = getСоздатьПровайдерBlockReason(
      providers.find((provider) => provider.id === createForm.provider) ?? null,
      createMode,
      providerHealthQuery.data ?? null,
    );
    if (!currentBlockReason) return;
    const replacement = providers.find(
      (provider) =>
        !getСоздатьПровайдерBlockReason(provider, createMode, providerHealthQuery.data ?? null),
    );
    if (replacement && replacement.id !== createForm.provider) {
      setСоздатьForm((current) => ({
        ...current,
        provider: replacement.id,
        providerConfigId: getПо умолчаниюПровайдерConfigId(providerConfigs, replacement.id),
      }));
    }
  }, [createForm.provider, createMode, createOpen, providerConfigs, providerHealthQuery.data, providers]);

  useEffect(() => {
    if (!createOpen) return;
    const current = providerConfigs.find((config) => config.id === createForm.providerConfigId);
    if (current?.provider === createForm.provider) return;
    setСоздатьForm((form) => ({
      ...form,
      providerConfigId: getПо умолчаниюПровайдерConfigId(providerConfigs, form.provider),
    }));
  }, [createForm.provider, createForm.providerConfigId, createOpen, providerConfigs]);

  useEffect(() => {
    if (!rotateOpen || !selectedСекрет) return;
    setRotateПровайдерConfigId(
      selectedСекрет.providerConfigId ?? getПо умолчаниюПровайдерConfigId(providerConfigs, selectedСекрет.provider),
    );
  }, [providerConfigs, rotateOpen, selectedСекрет]);

  function openСоздатьVault(provider: СекретПровайдер = "local_encrypted") {
    setИзменитьingVault(null);
    setVaultForm(emptyПровайдерVaultForm(provider));
    setVaultОшибка(null);
    setVaultDialogOpen(true);
  }

  function openИзменитьVault(config: КомпанияСекретПровайдерConfig) {
    setИзменитьingVault(config);
    setVaultForm(providerVaultFormFromConfig(config));
    setVaultОшибка(null);
    setVaultDialogOpen(true);
  }

  if (!selectedКомпанияId) {
    return (
      <div classИмя="p-6 text-sm text-muted-foreground">Select a company to manage secrets.</div>
    );
  }

  return (
    <div classИмя="flex h-full min-h-0 flex-col gap-4">
      <div classИмя="flex items-center gap-2">
        <КлючRound classИмя="h-5 w-5 text-muted-foreground" />
        <h1 classИмя="text-lg font-semibold">Секреты</h1>
      </div>

      <Tabs
        value={activeTab}
        onЗначениеChange={(value) => setАктивенTab(value as СекретыTab)}
        classИмя="flex min-h-0 flex-1 flex-col gap-4"
      >
        <PageTabBar
          items={[
            { value: "secrets", label: "Секреты" },
            { value: "vaults", label: "Провайдер vaults" },
          ]}
          align="start"
          value={activeTab}
          onЗначениеChange={(value) => setАктивенTab(value as СекретыTab)}
        />

        <TabsContent value="secrets" classИмя="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <СекретыHowToUse />
          <div classИмя="flex flex-wrap items-center gap-2">
            <div classИмя="relative w-48 sm:w-64 md:w-80">
              <Поиск classИмя="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setПоиск(event.target.value)}
                placeholder="Поиск by name, key, ref"
                classИмя="pl-7 text-xs sm:text-sm"
                aria-label="Поиск secrets"
                data-page-search-target="true"
              />
            </div>
            <СекретыФильтрsPopover
              statusФильтр={statusФильтр}
              providerФильтр={providerФильтр}
              providers={providers}
              activeФильтрCount={activeСекретФильтрCount}
              onСтатусChange={setСтатусФильтр}
              onПровайдерChange={setПровайдерФильтр}
            />
            <ИмпортFromVaultButton
              providerConfigs={providerConfigs}
              onClick={() => setИмпортOpen(true)}
              onManageVaults={() => setАктивенTab("vaults")}
              classИмя="ml-auto"
            />
            <Button onClick={() => setСоздатьOpen(true)} size="sm">
              <Plus classИмя="h-3.5 w-3.5 mr-1" /> New secret
            </Button>
          </div>
          <div classИмя="min-h-0 flex-1 overflow-y-auto">
            {secretsQuery.isОшибка ? (
              <div classИмя="text-sm text-destructive flex items-center gap-2 py-4">
                <AlertCircle classИмя="h-4 w-4" /> Ошибка to load secrets:{" "}
                {(secretsQuery.error as Ошибка).message}
                <Button variant="ghost" size="sm" onClick={() => secretsQuery.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : secrets.length === 0 && !secretsQuery.isОжидание ? (
              <EmptyState
                icon={КлючRound}
                message="Пока нет секретов. Создать your first managed secret or link an external reference."
                action="New secret"
                onAction={() => setСоздатьOpen(true)}
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Поиск} message="Нет secrets match your filters." />
            ) : (
              <table classИмя="w-full text-sm">
              <thead classИмя="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th classИмя="px-3 py-2 text-left font-medium">Имя</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Mode</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Провайдер</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Статус</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Версия</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Last rotated</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Last resolved</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Ссылки</th>
                  <th classИмя="px-2 py-2 text-left font-medium">Reference</th>
                  <th classИмя="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((secret) => (
                  <tr
                    key={secret.id}
                    classИмя={cn(
                      "border-b border-border/60 hover:bg-accent/40 cursor-pointer",
                      selectedСекретId === secret.id && "bg-accent/60",
                    )}
                    onClick={() => setSelectedСекретId(secret.id)}
                  >
                    <td classИмя="px-3 py-2.5">
                      <div classИмя="font-medium text-foreground">{secret.name}</div>
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs text-muted-foreground">
                      {modeLabel(secret.managedMode)}
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs">
                      <div>{providerLabel(providers, secret.provider)}</div>
                    </td>
                    <td classИмя="px-2 py-2.5">
                      <span classИмя={cn("text-xs font-medium", statusTextTone(secret.status))}>
                        {secret.status}
                      </span>
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs font-mono">v{secret.latestВерсия}</td>
                    <td classИмя="px-2 py-2.5 text-xs text-muted-foreground">
                      {formatRelative(secret.lastRotatedAt)}
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs text-muted-foreground">
                      {formatRelative(secret.lastResolvedAt)}
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        classИмя="h-7 px-2 text-xs"
                        aria-label={`View references for ${secret.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setИспользованиеDialogСекретId(secret.id);
                        }}
                      >
                        {secret.referenceCount ?? 0}
                      </Button>
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs">
                      {secret.managedMode === "external_reference" ? (
                        <span classИмя="inline-flex items-center gap-1 font-mono text-muted-foreground">
                          <Link2 classИмя="h-3 w-3" />
                          {secret.externalRef ?? "—"}
                        </span>
                      ) : (
                        <span classИмя="text-muted-foreground">Owned</span>
                      )}
                    </td>
                    <td classИмя="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedСекретId(secret.id);
                        }}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="vaults" classИмя="min-h-0 flex-1 overflow-y-auto">
          <ПровайдерVaultsTab
            providers={providers}
            providerConfigs={providerConfigs}
            loading={providerConfigsQuery.isОжидание}
            error={providerConfigsQuery.error}
            onПовторить={() => providerConfigsQuery.refetch()}
            onСоздать={openСоздатьVault}
            onИзменить={openИзменитьVault}
            onОтключить={(config) => disableVaultMutation.mutate(config.id)}
            onSetПо умолчанию={(config) => defaultVaultMutation.mutate(config.id)}
            onHealthCheck={(config) => healthVaultMutation.mutate(config.id)}
            pendingActionId={
              disableVaultMutation.variables ??
              defaultVaultMutation.variables ??
              healthVaultMutation.variables ??
              null
            }
          />
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(selectedСекрет)} onOpenChange={(open) => !open && setSelectedСекретId(null)}>
        <SheetContent classИмя="w-full sm:max-w-xl flex flex-col gap-0">
          {selectedСекрет ? (
            <>
              <SheetHeader>
                <SheetНазвание classИмя="flex items-center gap-2 text-base">
                  <КлючRound classИмя="h-4 w-4" />
                  {selectedСекрет.name}
                  <span classИмя={cn("ml-2 text-sm font-normal", statusTextTone(selectedСекрет.status))}>
                    {selectedСекрет.status}
                  </span>
                </SheetНазвание>
                <SheetОписание>
                  {providerLabel(providers, selectedСекрет.provider)} · v{selectedСекрет.latestВерсия} · {modeLabel(selectedСекрет.managedMode)}
                </SheetОписание>
              </SheetHeader>
              <div classИмя="flex flex-wrap gap-2 px-4 pb-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRotateOpen(true);
                    setRotateЗначение("");
                    setRotateExternalRef("");
                    setRotateПровайдерConfigId(
                      selectedСекрет.providerConfigId ??
                        getПо умолчаниюПровайдерConfigId(providerConfigs, selectedСекрет.provider),
                    );
                    setRotateОшибка(null);
                  }}
                >
                  <ОбновитьCw classИмя="h-3.5 w-3.5 mr-1" />
                  {selectedСекрет.managedMode === "external_reference" ? "Обновить reference" : "Обновить value"}
                </Button>
                {selectedСекрет.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: selectedСекрет.id, status: "disabled" })}
                    disabled={statusMutation.isОжидание}
                  >
                    <Ban classИмя="h-3.5 w-3.5 mr-1" /> Отключить
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: selectedСекрет.id, status: "active" })}
                    disabled={statusMutation.isОжидание}
                  >
                    <CheckCircle2 classИмя="h-3.5 w-3.5 mr-1" /> Activate
                  </Button>
                )}
                {selectedСекрет.status === "archived" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: selectedСекрет.id, status: "active" })}
                    disabled={statusMutation.isОжидание}
                  >
                    <АрхивироватьRestore classИмя="h-3.5 w-3.5 mr-1" /> Разархивировать
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate({ id: selectedСекрет.id, status: "archived" })}
                    disabled={statusMutation.isОжидание}
                  >
                    <Архивировать classИмя="h-3.5 w-3.5 mr-1" /> Архивировать
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  classИмя="text-destructive hover:text-destructive"
                  onClick={() => setУдалитьПодтвердить(selectedСекрет)}
                >
                  <Trash2 classИмя="h-3.5 w-3.5 mr-1" /> Удалить
                </Button>
              </div>
              <Tabs value={secretDetailTab} onЗначениеChange={setСекретDetailTab} classИмя="flex-1 min-h-0 flex flex-col">
                <div classИмя="border-b border-border px-4">
                  <PageTabBar
                    items={[
                      { value: "details", label: "Детали" },
                      { value: "usage", label: usageQuery.data ? `Использование (${usageQuery.data.bindings.length})` : "Использование" },
                      { value: "events", label: "Доступ events" },
                    ]}
                    align="start"
                    value={secretDetailTab}
                    onЗначениеChange={setСекретDetailTab}
                  />
                </div>
                <div classИмя="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                  <TabsContent value="details">
                    <СекретДеталиTab secret={selectedСекрет} providerConfigs={providerConfigs} />
                  </TabsContent>
                  <TabsContent value="usage">
                    <СекретИспользованиеTab loading={usageQuery.isОжидание} bindings={usageQuery.data?.bindings ?? []} />
                  </TabsContent>
                  <TabsContent value="events">
                    <СекретEventsTab loading={eventsQuery.isОжидание} events={eventsQuery.data ?? []} />
                  </TabsContent>
                </div>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(usageDialogСекрет)}
        onOpenChange={(open) => !open && setИспользованиеDialogСекретId(null)}
      >
        <DialogContent classИмя="sm:max-w-lg">
          <DialogHeader>
            <DialogНазвание>Секрет references</DialogНазвание>
            <DialogОписание>
              {usageDialogСекрет
                ? `${usageDialogСекрет.name} is referenced by ${usageDialogСекрет.referenceCount ?? 0} ${
                    (usageDialogСекрет.referenceCount ?? 0) === 1 ? "place" : "places"
                  }.`
                : null}
            </DialogОписание>
          </DialogHeader>
          <СекретИспользованиеTab
            loading={usageDialogQuery.isОжидание}
            bindings={usageDialogQuery.data?.bindings ?? []}
          />
        </DialogContent>
      </Dialog>

      {selectedКомпанияId && (
        <ИмпортFromVaultDialog
          open={importOpen}
          onOpenChange={setИмпортOpen}
          companyId={selectedКомпанияId}
          providerConfigs={providerConfigs}
          existingСекреты={secrets}
          onManageVaults={() => {
            setИмпортOpen(false);
            setАктивенTab("vaults");
          }}
          onИмпортComplete={() => {
            void secretsQuery.refetch();
          }}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setСоздатьOpen}>
        <DialogContent classИмя="sm:max-w-lg">
          <DialogHeader>
            <DialogНазвание>Создать секрет</DialogНазвание>
            <DialogОписание>
              Choose whether Paperclip should own future provider writes, or only resolve an existing
              provider reference at runtime.
            </DialogОписание>
          </DialogHeader>
          <Tabs value={createMode} onЗначениеChange={(value) => setСоздатьMode(value as СоздатьMode)}>
            <TabsList classИмя="w-full grid grid-cols-2">
              <TabsTrigger value="managed">Managed value</TabsTrigger>
              <TabsTrigger value="external">External reference</TabsTrigger>
            </TabsList>
          </Tabs>
          <div classИмя="space-y-3">
            <div classИмя="grid grid-cols-2 gap-3">
              <div>
                <label classИмя="text-xs font-medium" htmlFor="new-secret-name">Имя</label>
                <Input
                  id="new-secret-name"
                  value={createForm.name}
                  onChange={(event) =>
                    setСоздатьForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="OPENAI_API_KEY"
                  autoFocus
                />
              </div>
              <div>
                <label classИмя="text-xs font-medium" htmlFor="new-secret-key">
                  Ключ <span classИмя="text-muted-foreground/70">(optional)</span>
                </label>
                <Input
                  id="new-secret-key"
                  value={createForm.key}
                  onChange={(event) =>
                    setСоздатьForm((current) => ({ ...current, key: event.target.value }))
                  }
                  placeholder="auto from name"
                />
              </div>
            </div>
            <div>
              <label classИмя="text-xs font-medium" htmlFor="new-secret-provider">Провайдер</label>
              <select
                id="new-secret-provider"
                classИмя="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
                value={createForm.provider}
                onChange={(event) =>
                  setСоздатьForm((current) => {
                    const provider = event.target.value as СекретПровайдер;
                    return {
                      ...current,
                      provider,
                      providerConfigId: getПо умолчаниюПровайдерConfigId(providerConfigs, provider),
                    };
                  })
                }
              >
                {providers.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={Boolean(
                      getСоздатьПровайдерBlockReason(provider, createMode, providerHealthQuery.data ?? null),
                    )}
                  >
                    {provider.label}
                    {provider.configured === false
                      ? " (not configured)"
                      : provider.requiresExternalRef
                        ? " (external only)"
                        : ""}
                  </option>
                ))}
              </select>
              {createПровайдерBlockReason ? (
                <p classИмя="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertCircle classИмя="h-3 w-3" />
                  {createПровайдерBlockReason}
                </p>
              ) : createПровайдерHealthText ? (
                <p classИмя="mt-1 text-[11px] text-muted-foreground">{createПровайдерHealthText}</p>
              ) : null}
            </div>
            <div>
              <label classИмя="text-xs font-medium" htmlFor="new-secret-vault">Провайдер vault</label>
              <select
                id="new-secret-vault"
                classИмя="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
                value={createForm.providerConfigId}
                onChange={(event) =>
                  setСоздатьForm((current) => ({ ...current, providerConfigId: event.target.value }))
                }
              >
                <option value="">Deployment default</option>
                {createПровайдерConfigs.map((config) => {
                  const blockReason = getПровайдерConfigBlockReason(config);
                  return (
                    <option key={config.id} value={config.id} disabled={Boolean(blockReason)}>
                      {config.displayИмя}
                      {config.isПо умолчанию ? " (default)" : ""}
                      {blockReason ? ` (${blockReason})` : ""}
                    </option>
                  );
                })}
              </select>
              {selectedСоздатьПровайдерConfig ? (
                <ПровайдерVaultInlineПредупреждение config={selectedСоздатьПровайдерConfig} />
              ) : (
                <p classИмя="mt-1 text-[11px] text-muted-foreground">
                  Existing deployment-level provider settings stay available for backwards compatibility.
                </p>
              )}
            </div>
            {createMode === "managed" ? (
              <>
                <div classИмя="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                  Paperclip-managed secrets are created in the selected provider and future rotations
                  write a new provider version through Paperclip.
                  {awsManagedПутьПредпросмотр ? (
                    <div classИмя="mt-1">
                      AWS managed path:{" "}
                      <code classИмя="break-all rounded bg-background/70 px-1 py-0.5">
                        {awsManagedПутьПредпросмотр}
                      </code>
                    </div>
                  ) : null}
                </div>
                <div>
                  <label classИмя="text-xs font-medium" htmlFor="new-secret-value">Значение</label>
                  <Textarea
                    id="new-secret-value"
                    value={createForm.value}
                    onChange={(event) =>
                      setСоздатьForm((current) => ({ ...current, value: event.target.value }))
                    }
                    rows={3}
                    classИмя="font-mono text-xs"
                    placeholder="Stored once, never re-displayed"
                  />
                </div>
              </>
            ) : (
              <div>
                <label classИмя="text-xs font-medium" htmlFor="new-secret-ref">External reference</label>
                <Input
                  id="new-secret-ref"
                  value={createForm.externalRef}
                  onChange={(event) =>
                    setСоздатьForm((current) => ({ ...current, externalRef: event.target.value }))
                  }
                  placeholder="arn:aws:secretsmanager:..."
                  classИмя="font-mono text-xs"
                />
                <p classИмя="text-[11px] text-muted-foreground mt-1">
                  Existing provider secrets are resolve-only in Paperclip. Rotate the value in the provider,
                  then update this reference only if the path, ARN, or version changes.
                </p>
              </div>
            )}
            <div>
              <label classИмя="text-xs font-medium" htmlFor="new-secret-description">
                Описание <span classИмя="text-muted-foreground/70">(optional)</span>
              </label>
              <Input
                id="new-secret-description"
                value={createForm.description}
                onChange={(event) =>
                  setСоздатьForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="What is this secret used for? (no values)"
              />
            </div>
            {createОшибка ? <p classИмя="text-xs text-destructive">{createОшибка}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setСоздатьOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setСоздатьОшибка(null);
                createMutation.mutate();
              }}
              disabled={
                createMutation.isОжидание ||
                Boolean(createПровайдерBlockReason) ||
                !createForm.name.trim() ||
                (createMode === "managed" ? !createForm.value : !createForm.externalRef.trim())
              }
            >
              {createMutation.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {createMode === "managed" ? "Создать секрет" : "Link reference"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vaultDialogOpen} onOpenChange={setVaultDialogOpen}>
        <DialogContent classИмя="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogНазвание>{editingVault ? "Изменить provider vault" : "Создать provider vault"}</DialogНазвание>
            <DialogОписание>
              Сохранить only non-sensitive routing metadata. Credentials stay in the runtime environment or provider identity.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-4">
            <div classИмя="grid gap-3 sm:grid-cols-2">
              <div>
                <label classИмя="text-xs font-medium" htmlFor="vault-provider">Провайдер</label>
                <select
                  id="vault-provider"
                  classИмя="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none disabled:opacity-60"
                  value={vaultForm.provider}
                  disabled={Boolean(editingVault)}
                  onChange={(event) => {
                    const provider = event.target.value as СекретПровайдер;
                    setVaultForm(emptyПровайдерVaultForm(provider));
                  }}
                >
                  {PROVIDER_ORDER.map((provider) => (
                    <option key={provider} value={provider}>
                      {providerLabel(providers, provider)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label classИмя="text-xs font-medium" htmlFor="vault-name">Display name</label>
                <Input
                  id="vault-name"
                  value={vaultForm.displayИмя}
                  onChange={(event) =>
                    setVaultForm((current) => ({ ...current, displayИмя: event.target.value }))
                  }
                  placeholder="Production local vault"
                />
              </div>
              <div>
                <label classИмя="text-xs font-medium" htmlFor="vault-status">Статус</label>
                <select
                  id="vault-status"
                  classИмя="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
                  value={vaultForm.status}
                  onChange={(event) => {
                    const status = event.target.value as СекретПровайдерConfigСтатус;
                    setVaultForm((current) => ({
                      ...current,
                      status,
                      isПо умолчанию:
                        status === "coming_soon" || status === "disabled" ? false : current.isПо умолчанию,
                    }));
                  }}
                >
                  <option value="ready" disabled={vaultForm.provider === "gcp_secret_manager" || vaultForm.provider === "vault"}>
                    Готово
                  </option>
                  <option value="warning" disabled={vaultForm.provider === "gcp_secret_manager" || vaultForm.provider === "vault"}>
                    Предупреждение
                  </option>
                  <option value="coming_soon">Скоро</option>
                  <option value="disabled">Отключитьd</option>
                </select>
              </div>
              <label classИмя="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  classИмя="h-4 w-4 rounded border-border"
                  checked={vaultForm.isПо умолчанию}
                  disabled={vaultForm.status === "coming_soon" || vaultForm.status === "disabled"}
                  onChange={(event) =>
                    setVaultForm((current) => ({ ...current, isПо умолчанию: event.target.checked }))
                  }
                />
                По умолчанию for {providerLabel(providers, vaultForm.provider)}
              </label>
            </div>

            <ПровайдерVaultFields form={vaultForm} onChange={setVaultForm} />

            {vaultForm.provider === "gcp_secret_manager" || vaultForm.provider === "vault" ? (
              <div classИмя="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-700 dark:text-sky-300">
                This provider can save draft routing metadata, but runtime writes and resolution stay disabled until
                the provider module is implemented and reviewed.
              </div>
            ) : null}
            {vaultОшибка ? <p classИмя="text-xs text-destructive">{vaultОшибка}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVaultDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setVaultОшибка(null);
                saveVaultMutation.mutate();
              }}
              disabled={
                saveVaultMutation.isОжидание ||
                !vaultForm.displayИмя.trim() ||
                (vaultForm.provider === "aws_secrets_manager" && !vaultForm.region.trim())
              }
            >
              {saveVaultMutation.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {editingVault ? "Сохранить vault" : "Создать vault"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>
              {selectedСекрет?.managedMode === "external_reference" ? "Обновить external reference" : "Обновить secret value"}
            </DialogНазвание>
            <DialogОписание>
              {selectedСекрет?.managedMode === "external_reference"
                ? "Создатьs a new Paperclip metadata version that points at an existing provider secret. Paperclip does not write a new provider value."
                : "Создатьs a new provider-backed version. Consumers pinned to latest pick up the new value on the next run."}
            </DialogОписание>
          </DialogHeader>
          <div>
            <label classИмя="text-xs font-medium" htmlFor="rotate-secret-vault">Провайдер vault</label>
            <select
              id="rotate-secret-vault"
              classИмя="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none"
              value={rotateПровайдерConfigId}
              onChange={(event) => setRotateПровайдерConfigId(event.target.value)}
            >
              <option value="">Deployment default</option>
              {selectedRotateПровайдерConfigs.map((config) => {
                const blockReason = getПровайдерConfigBlockReason(config);
                return (
                  <option key={config.id} value={config.id} disabled={Boolean(blockReason)}>
                    {config.displayИмя}
                    {config.isПо умолчанию ? " (default)" : ""}
                    {blockReason ? ` (${blockReason})` : ""}
                  </option>
                );
              })}
            </select>
            {selectedRotateПровайдерConfig ? (
              <ПровайдерVaultInlineПредупреждение config={selectedRotateПровайдерConfig} />
            ) : (
              <p classИмя="mt-1 text-[11px] text-muted-foreground">
                Rotating with the deployment default preserves current fallback behavior.
              </p>
            )}
          </div>
          {selectedСекрет?.managedMode === "external_reference" ? (
            <div>
              <label classИмя="text-xs font-medium" htmlFor="rotate-ref">External reference</label>
              <Input
                id="rotate-ref"
                value={rotateExternalRef}
                onChange={(event) => setRotateExternalRef(event.target.value)}
                placeholder={selectedСекрет.externalRef ?? "Обновлено reference"}
                classИмя="font-mono text-xs"
              />
              <p classИмя="mt-1 text-[11px] text-muted-foreground">
                Rotate the actual value in the provider before changing this Paperclip reference.
              </p>
            </div>
          ) : (
            <div>
              <label classИмя="text-xs font-medium" htmlFor="rotate-value">New value</label>
              <Textarea
                id="rotate-value"
                value={rotateЗначение}
                onChange={(event) => setRotateЗначение(event.target.value)}
                rows={3}
                classИмя="font-mono text-xs"
                placeholder="Paste the new value"
              />
            </div>
          )}
          {rotateОшибка ? <p classИмя="text-xs text-destructive">{rotateОшибка}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setRotateОшибка(null);
                rotateMutation.mutate();
              }}
              disabled={
                rotateMutation.isОжидание ||
                Boolean(rotateПровайдерBlockReason) ||
                (selectedСекрет?.managedMode === "external_reference"
                  ? !rotateExternalRef.trim() && !selectedСекрет?.externalRef
                  : !rotateЗначение)
              }
            >
              {rotateMutation.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {selectedСекрет?.managedMode === "external_reference" ? "Обновить reference" : "Обновить value"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteПодтвердить)} onOpenChange={(open) => !open && setУдалитьПодтвердить(null)}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>Удалить secret</DialogНазвание>
            <DialogОписание>
              Permanently removes <strong>{deleteПодтвердить?.name}</strong>. Активен bindings will fail until you remap them.
            </DialogОписание>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setУдалитьПодтвердить(null)}>Отмена</Button>
            <Button
              variant="destructive"
              onClick={() => deleteПодтвердить && deleteMutation.mutate(deleteПодтвердить.id)}
              disabled={deleteMutation.isОжидание}
            >
              {deleteMutation.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function СекретыHowToUse() {
  return (
    <div classИмя="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <Info classИмя="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div classИмя="space-y-1">
        <p classИмя="font-medium text-foreground">Use secrets by binding them to runtime environment variables.</p>
        <p>
          Создать or link a secret here, then open an agent&apos;s Окружение variables or a project&apos;s Env field.
          Добавить the env key the process expects, for example <code classИмя="font-mono">GH_TOKEN</code>, choose{" "}
          <span classИмя="font-medium text-foreground">Секрет</span>, and select the stored secret version.
        </p>
        <p>
          Paperclip resolves the value server-side when the run starts and injects it as that env var. Project env
          applies to every issue in the project and overrides agent env on matching keys.
        </p>
      </div>
    </div>
  );
}

function СекретыФильтрsPopover({
  statusФильтр,
  providerФильтр,
  providers,
  activeФильтрCount,
  onСтатусChange,
  onПровайдерChange,
}: {
  statusФильтр: СекретСтатус | "all";
  providerФильтр: СекретПровайдер | "all";
  providers: СекретПровайдерDescriptor[];
  activeФильтрCount: number;
  onСтатусChange: (value: СекретСтатус | "all") => void;
  onПровайдерChange: (value: СекретПровайдер | "all") => void;
}) {
  const resetФильтрs = () => {
    onСтатусChange("active");
    onПровайдерChange("all");
  };

  const statusOptions: Array<{ value: СекретСтатус | "all"; label: string }> = [
    { value: "active", label: "Активен" },
    { value: "all", label: "Все statuses" },
    { value: "disabled", label: "Отключитьd" },
    { value: "archived", label: "Архивирован" },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          classИмя={cn("relative h-8 w-8 shrink-0", activeФильтрCount > 0 && "text-blue-600 dark:text-blue-400")}
          title={activeФильтрCount > 0 ? `Фильтрs: ${activeФильтрCount}` : "Фильтр"}
        >
          <Фильтр classИмя="h-3.5 w-3.5" />
          {activeФильтрCount > 0 ? (
            <span classИмя="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
              {activeФильтрCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        classИмя="w-[min(520px,calc(100vw-2rem))] max-h-[min(80vh,34rem)] overflow-y-auto overscroll-contain p-0"
      >
        <div classИмя="space-y-3 p-3">
          <div classИмя="flex items-center justify-between">
            <span classИмя="text-sm font-medium">Фильтрs</span>
            {activeФильтрCount > 0 ? (
              <button
                type="button"
                classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetФильтрs}
              >
                <X classИмя="h-3 w-3" />
                Очистить
              </button>
            ) : null}
          </div>

          <div classИмя="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div classИмя="space-y-1">
              <span classИмя="text-xs text-muted-foreground">Статус</span>
              <div classИмя="space-y-0.5">
                {statusOptions.map((option) => (
                  <label key={option.value} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                    <Checkbox
                      checked={statusФильтр === option.value}
                      onCheckedChange={() => onСтатусChange(option.value)}
                    />
                    <span classИмя="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div classИмя="space-y-1">
              <span classИмя="text-xs text-muted-foreground">Провайдер</span>
              <div classИмя="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                <label classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                  <Checkbox
                    checked={providerФильтр === "all"}
                    onCheckedChange={() => onПровайдерChange("all")}
                  />
                  <span classИмя="text-sm">Все providers</span>
                </label>
                {providers.map((provider) => (
                  <label key={provider.id} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                    <Checkbox
                      checked={providerФильтр === provider.id}
                      onCheckedChange={() => onПровайдерChange(provider.id)}
                    />
                    <span classИмя="text-sm">{provider.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function providerConfigСтатусTone(status: СекретПровайдерConfigСтатус) {
  switch (status) {
    case "ready":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "coming_soon":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "disabled":
      return "border-muted bg-muted text-muted-foreground";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function providerFamilyIcon(provider: СекретПровайдер) {
  switch (provider) {
    case "local_encrypted":
      return Database;
    case "aws_secrets_manager":
      return Cloud;
    case "gcp_secret_manager":
      return ShieldCheck;
    case "vault":
      return КлючRound;
    default:
      return КлючRound;
  }
}

function ПровайдерVaultInlineПредупреждение({ config }: { config: КомпанияСекретПровайдерConfig }) {
  const blockReason = getПровайдерConfigBlockReason(config);
  const message = blockReason ?? config.healthMessage;
  if (!message) {
    return (
      <p classИмя="mt-1 text-[11px] text-muted-foreground">
        {config.isПо умолчанию ? "По умолчанию vault" : "Vault"} · {config.status.replace("_", " ")}
      </p>
    );
  }
  const warning = config.status === "warning" || config.healthСтатус === "warning";
  return (
    <p classИмя={cn("mt-1 flex items-center gap-1 text-[11px]", warning ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
      {warning ? <AlertTriangle classИмя="h-3 w-3" /> : <AlertCircle classИмя="h-3 w-3" />}
      {message}
    </p>
  );
}

interface ИмпортFromVaultButtonProps {
  providerConfigs: КомпанияСекретПровайдерConfig[];
  onClick: () => void;
  onManageVaults: () => void;
  classИмя?: string;
}

function ИмпортFromVaultButton({
  providerConfigs,
  onClick,
  onManageVaults,
  classИмя,
}: ИмпортFromVaultButtonProps) {
  const awsConfigs = providerConfigs.filter(
    (config) => config.provider === "aws_secrets_manager",
  );
  const eligible = awsConfigs.filter(
    (config) => config.status === "ready" || config.status === "warning",
  );

  if (awsConfigs.length === 0) return null;

  if (eligible.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onManageVaults}
        classИмя={cn("text-xs text-muted-foreground", classИмя)}
        title="Configure an AWS provider vault to enable remote import"
      >
        <Cloud classИмя="h-3.5 w-3.5 mr-1" /> AWS vault disabled — manage
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      classИмя={classИмя}
      data-testid="import-from-vault-button"
    >
      <Cloud classИмя="h-3.5 w-3.5 mr-1" /> Импорт from vault
    </Button>
  );
}

export function ПровайдерVaultsTab({
  providers,
  providerConfigs,
  loading,
  error,
  onПовторить,
  onСоздать,
  onИзменить,
  onОтключить,
  onSetПо умолчанию,
  onHealthCheck,
  pendingActionId,
}: {
  providers: СекретПровайдерDescriptor[];
  providerConfigs: КомпанияСекретПровайдерConfig[];
  loading: boolean;
  error: unknown;
  onПовторить: () => void;
  onСоздать: (provider: СекретПровайдер) => void;
  onИзменить: (config: КомпанияСекретПровайдерConfig) => void;
  onОтключить: (config: КомпанияСекретПровайдерConfig) => void;
  onSetПо умолчанию: (config: КомпанияСекретПровайдерConfig) => void;
  onHealthCheck: (config: КомпанияСекретПровайдерConfig) => void;
  pendingActionId: string | null;
}) {
  if (loading) {
    return (
      <div classИмя="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 classИмя="h-4 w-4 animate-spin" />
        Загрузка provider vaults
      </div>
    );
  }

  if (error) {
    return (
      <div classИмя="py-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle classИмя="h-4 w-4" /> Ошибка to load provider vaults: {(error as Ошибка).message}
        <Button variant="ghost" size="sm" onClick={onПовторить}>
          Повторить
        </Button>
      </div>
    );
  }

  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const providerRows = PROVIDER_ORDER.map((providerId) => ({
    id: providerId,
    provider: providerMap.get(providerId),
    Icon: providerFamilyIcon(providerId),
    isComingSoonFamily: providerId === "gcp_secret_manager" || providerId === "vault",
    configs: providerConfigs.filter((config) => config.provider === providerId),
  }));

  return (
    <div classИмя="flex min-h-full gap-6">
      <aside classИмя="hidden w-56 shrink-0 md:block">
        <nav classИмя="sticky top-0 space-y-1">
          {providerRows.map(({ id, provider, Icon }) => (
            <a
              key={id}
              href={`#provider-vaults-${id}`}
              classИмя="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            >
              <Icon classИмя="h-4 w-4" />
              <span classИмя="truncate">{provider?.label ?? id.replaceВсе("_", " ")}</span>
            </a>
          ))}
        </nav>
      </aside>

      <div classИмя="min-w-0 flex-1 space-y-6">
        {providerRows.map(({ id, provider, Icon, isComingSoonFamily, configs }) => (
          <section key={id} id={`provider-vaults-${id}`} classИмя={cn("scroll-mt-6 space-y-2", isComingSoonFamily && "opacity-50")}>
            <div classИмя="flex flex-wrap items-center gap-2">
              <Icon classИмя="h-4 w-4 text-muted-foreground" />
              <h2 classИмя="text-sm font-semibold">{provider?.label ?? id.replaceВсе("_", " ")}</h2>
              {isComingSoonFamily ? (
                <span classИмя="ml-auto text-xs text-muted-foreground">Скоро</span>
              ) : (
                <Button variant="outline" size="sm" classИмя="ml-auto" onClick={() => onСоздать(id)}>
                  <Plus classИмя="h-3.5 w-3.5 mr-1" />
                  Добавить vault
                </Button>
              )}
            </div>
            {configs.length === 0 ? (
              <div classИмя="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                {isComingSoonFamily
                  ? "Нетt yet supported."
                  : "Нет company-specific vaults yet. Секреты can still use the deployment default provider settings."}
              </div>
            ) : (
              <div classИмя="space-y-3">
                {configs.map((config) => (
                  <ПровайдерVaultCard
                    key={config.id}
                    config={config}
                    pending={pendingActionId === config.id}
                    onИзменить={() => onИзменить(config)}
                    onОтключить={() => onОтключить(config)}
                    onSetПо умолчанию={() => onSetПо умолчанию(config)}
                    onHealthCheck={() => onHealthCheck(config)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ПровайдерVaultCard({
  config,
  pending,
  onИзменить,
  onОтключить,
  onSetПо умолчанию,
  onHealthCheck,
}: {
  config: КомпанияСекретПровайдерConfig;
  pending: boolean;
  onИзменить: () => void;
  onОтключить: () => void;
  onSetПо умолчанию: () => void;
  onHealthCheck: () => void;
}) {
  const blockReason = getПровайдерConfigBlockReason(config);
  const details = config.healthДетали;
  return (
    <div classИмя="rounded-md border border-border bg-background p-4">
      <div classИмя="flex items-start gap-3">
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex flex-wrap items-center gap-2">
            <h3 classИмя="text-sm font-medium leading-snug">{config.displayИмя}</h3>
            {config.isПо умолчанию ? (
              <span classИмя="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Star classИмя="h-3 w-3 fill-current" />
                По умолчанию
              </span>
            ) : null}
          </div>
          <div classИмя="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" classИмя={cn("font-medium", providerConfigСтатусTone(config.status))}>
              {config.status.replace("_", " ")}
            </Badge>
            {config.healthСтатус ? (
              <span classИмя="text-xs text-muted-foreground">
                Health {config.healthСтатус.replace("_", " ")} · {formatRelative(config.healthCheckedAt)}
              </span>
            ) : (
              <span classИмя="text-xs text-muted-foreground">Health not checked</span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onИзменить}>
          <Изменить3 classИмя="h-3.5 w-3.5" />
        </Button>
      </div>
      {config.healthMessage || blockReason ? (
        <div classИмя={cn("mt-3 rounded-md p-2 text-xs", blockReason ? "bg-destructive/5 text-destructive" : "bg-muted/40 text-muted-foreground")}>
          {blockReason ?? config.healthMessage}
          {details?.guidance?.length ? (
            <ul classИмя="mt-1 list-disc space-y-0.5 pl-4">
              {details.guidance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div classИмя="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onHealthCheck} disabled={pending}>
          {pending ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin mr-1" /> : <ОбновитьCw classИмя="h-3.5 w-3.5 mr-1" />}
          Check health
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSetПо умолчанию}
          disabled={pending || Boolean(blockReason) || config.isПо умолчанию}
        >
          <Star classИмя="h-3.5 w-3.5 mr-1" />
          Make default
        </Button>
        <Button
          variant="outline"
          size="sm"
          classИмя="text-destructive hover:text-destructive"
          onClick={onОтключить}
          disabled={pending || config.status === "disabled"}
        >
          <Ban classИмя="h-3.5 w-3.5 mr-1" />
          Отключить
        </Button>
      </div>
    </div>
  );
}

function ПровайдерVaultFields({
  form,
  onChange,
}: {
  form: ПровайдерVaultForm;
  onChange: React.Dispatch<React.SetStateAction<ПровайдерVaultForm>>;
}) {
  const setField = (key: keyof ПровайдерVaultForm, value: string | boolean) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  if (form.provider === "local_encrypted") {
    return (
      <label classИмя="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm">
        <input
          type="checkbox"
          classИмя="mt-0.5 h-4 w-4 rounded border-border"
          checked={form.backupReminderAcknowledged}
          onChange={(event) => setField("backupReminderAcknowledged", event.target.checked)}
        />
        <span>
          I understand backup and restore require both the database metadata and the local encrypted master key file.
        </span>
      </label>
    );
  }

  if (form.provider === "aws_secrets_manager") {
    return (
      <div classИмя="grid gap-3 sm:grid-cols-2">
        <TextField label="AWS region" value={form.region} onChange={(value) => setField("region", value)} placeholder="us-east-1" required />
        <TextField label="Имяspace" value={form.namespace} onChange={(value) => setField("namespace", value)} placeholder="production" />
        <TextField label="Название секрета prefix" value={form.secretИмяPrefix} onChange={(value) => setField("secretИмяPrefix", value)} placeholder="paperclip" />
        <TextField label="KMS key id" value={form.kmsКлючId} onChange={(value) => setField("kmsКлючId", value)} placeholder="alias/paperclip-secrets" />
        <TextField label="Владелец tag" value={form.ownerTag} onChange={(value) => setField("ownerTag", value)} placeholder="platform" />
        <TextField label="Окружение tag" value={form.environmentTag} onChange={(value) => setField("environmentTag", value)} placeholder="prod" />
      </div>
    );
  }

  if (form.provider === "gcp_secret_manager") {
    return (
      <div classИмя="grid gap-3 sm:grid-cols-2">
        <TextField label="Project id" value={form.projectId} onChange={(value) => setField("projectId", value)} placeholder="paperclip-prod" />
        <TextField label="Location" value={form.location} onChange={(value) => setField("location", value)} placeholder="global" />
        <TextField label="Имяspace" value={form.namespace} onChange={(value) => setField("namespace", value)} placeholder="production" />
        <TextField label="Название секрета prefix" value={form.secretИмяPrefix} onChange={(value) => setField("secretИмяPrefix", value)} placeholder="paperclip" />
      </div>
    );
  }

  return (
    <div classИмя="grid gap-3 sm:grid-cols-2">
      <TextField label="Добавитьress" value={form.address} onChange={(value) => setField("address", value)} placeholder="https://vault.example.com" />
      <TextField label="Имяspace" value={form.namespace} onChange={(value) => setField("namespace", value)} placeholder="admin" />
      <TextField label="Mount path" value={form.mountПуть} onChange={(value) => setField("mountПуть", value)} placeholder="secret" />
      <TextField label="Секрет path prefix" value={form.secretПутьPrefix} onChange={(value) => setField("secretПутьPrefix", value)} placeholder="paperclip/prod" />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = `provider-vault-${label.toНизкийerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label classИмя="text-xs font-medium" htmlFor={id}>
        {label}
        {required ? null : <span classИмя="text-muted-foreground/70"> (optional)</span>}
      </label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function СекретДеталиTab({
  secret,
  providerConfigs,
}: {
  secret: КомпанияСекрет;
  providerConfigs: КомпанияСекретПровайдерConfig[];
}) {
  return (
    <dl classИмя="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
      <DetailRow label="Описание">
        <span>{secret.description ?? <span classИмя="text-muted-foreground">—</span>}</span>
      </DetailRow>
      <DetailRow label="Custody">{modeLabel(secret.managedMode)}</DetailRow>
      <DetailRow label="Провайдер">{secret.provider.replaceВсе("_", " ")}</DetailRow>
      <DetailRow label="Провайдер vault">{providerVaultLabel(providerConfigs, secret.providerConfigId)}</DetailRow>
      <DetailRow label="Latest version">v{secret.latestВерсия}</DetailRow>
      <DetailRow label="Создано">{formatRelative(secret.createdAt)}</DetailRow>
      <DetailRow label="Обновлено">{formatRelative(secret.updatedAt)}</DetailRow>
      <DetailRow label="Last rotated">{formatRelative(secret.lastRotatedAt)}</DetailRow>
      <DetailRow label="Last resolved">{formatRelative(secret.lastResolvedAt)}</DetailRow>
      {secret.externalRef ? (
        <div classИмя="col-span-2">
          <dt classИмя="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            {secret.managedMode === "external_reference" ? "Linked provider reference" : "Провайдер-managed path"}
          </dt>
          <dd classИмя="font-mono text-xs break-all flex items-center gap-1">
            <ExternalLink classИмя="h-3 w-3" /> {secret.externalRef}
          </dd>
        </div>
      ) : null}
      <div classИмя="col-span-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
        {modeОписание(secret.managedMode)} Paperclip never re-displays stored values.
      </div>
    </dl>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div>
      <dt classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd classИмя="text-foreground">{children}</dd>
    </div>
  );
}

function СекретИспользованиеTab({ loading, bindings }: { loading: boolean; bindings: КомпанияСекретИспользованиеBinding[] }) {
  if (loading) {
    return <div classИмя="py-6 text-center text-xs text-muted-foreground">Загрузка…</div>;
  }
  if (bindings.length === 0) {
    return (
      <div classИмя="py-6 text-center text-xs text-muted-foreground">
        Нет active bindings. Добавить this secret in agent, project, environment, or plugin config to start using it.
      </div>
    );
  }
  return (
    <div classИмя="space-y-2">
      {bindings.map((binding) => (
        <div
          key={binding.id}
          classИмя="rounded-md border border-border bg-muted/30 p-2 text-xs"
        >
          <div classИмя="flex items-center justify-between gap-2">
            <span classИмя="font-medium capitalize">{binding.target.type}</span>
            <span classИмя="font-mono text-muted-foreground">v{binding.versionSelector}</span>
          </div>
          <div classИмя="mt-0.5 flex min-w-0 items-center gap-2">
            {binding.target.href ? (
              <Link to={binding.target.href} classИмя="truncate font-medium text-primary hover:underline">
                {binding.target.label}
              </Link>
            ) : (
              <span classИмя="truncate font-medium">{binding.target.label}</span>
            )}
            {binding.target.status ? (
              <Badge variant="outline" classИмя="h-5 px-1.5 text-[10px] font-normal">
                {binding.target.status.replaceВсе("_", " ")}
              </Badge>
            ) : null}
          </div>
          <div classИмя="font-mono text-[11px] text-muted-foreground break-all">
            {binding.targetId}
          </div>
          <div classИмя="text-[11px] text-muted-foreground">
            {binding.configПуть} {binding.required ? "· required" : "· optional"}
          </div>
        </div>
      ))}
    </div>
  );
}

function СекретEventsTab({ loading, events }: { loading: boolean; events: СекретДоступEvent[] }) {
  if (loading) {
    return <div classИмя="py-6 text-center text-xs text-muted-foreground">Загрузка…</div>;
  }
  if (events.length === 0) {
    return (
      <div classИмя="py-6 text-center text-xs text-muted-foreground">
        Нет access events recorded yet. Each runtime resolution writes a redacted entry here.
      </div>
    );
  }
  return (
    <div classИмя="space-y-1.5">
      {events.map((event) => (
        <div key={event.id} classИмя="rounded border border-border px-2 py-1.5 text-xs">
          <div classИмя="flex items-center justify-between">
            <span classИмя="capitalize">
              {event.consumerТип} · {event.outcome}
            </span>
            <span classИмя="text-[11px] text-muted-foreground">{formatRelative(event.createdAt)}</span>
          </div>
          <div classИмя="font-mono text-[11px] text-muted-foreground break-all">
            {event.consumerId}
          </div>
          {event.errorCode ? (
            <div classИмя="text-[11px] text-destructive">{event.errorCode}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
