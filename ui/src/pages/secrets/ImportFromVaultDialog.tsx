import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  ОбновитьCw,
  Поиск,
  X,
  XCircle,
} from "lucide-react";
import type {
  КомпанияСекрет,
  КомпанияСекретПровайдерConfig,
  RemoteСекретИмпортCandidate,
  RemoteСекретИмпортПредпросмотрResult,
  RemoteСекретИмпортResult,
  RemoteСекретИмпортRowResult,
} from "@paperclipai/shared";
import { ApiОшибка } from "../../api/client";
import {
  secretsApi,
  type RemoteИмпортInput,
  type RemoteИмпортSelectionInput,
} from "../../api/secrets";
import { useToastActions } from "../../context/ToastContext";
import { queryКлючs } from "../../lib/queryКлючs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { EmptyState } from "../../components/EmptyState";
import { cn } from "../../lib/utils";

type Step = "select" | "review" | "result";

interface ИмпортFromVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  providerConfigs: КомпанияСекретПровайдерConfig[];
  existingСекреты: КомпанияСекрет[];
  onИмпортComplete?: (result: RemoteСекретИмпортResult) => void;
  onManageVaults?: () => void;
}

interface ЧерновикSelection {
  candidate: RemoteСекретИмпортCandidate;
  name: string;
  key: string;
  description: string;
}

const KEY_PATTERN = /^[a-z0-9_.-]+$/;
const PAGE_SIZE = 50;

function isAwsSelectable(config: КомпанияСекретПровайдерConfig) {
  if (config.provider !== "aws_secrets_manager") return false;
  return config.status === "ready" || config.status === "warning";
}

function eligibleVaults(configs: КомпанияСекретПровайдерConfig[]): КомпанияСекретПровайдерConfig[] {
  return configs.filter(isAwsSelectable);
}

function pickПо умолчаниюVault(configs: КомпанияСекретПровайдерConfig[]): string | null {
  const eligible = eligibleVaults(configs);
  if (eligible.length === 0) return null;
  return (eligible.find((vault) => vault.isПо умолчанию) ?? eligible[0]).id;
}

function awsVaultOptions(configs: КомпанияСекретПровайдерConfig[]): КомпанияСекретПровайдерConfig[] {
  return configs.filter((vault) => vault.provider === "aws_secrets_manager");
}

function statusToneClasses(status: RemoteСекретИмпортCandidate["status"]) {
  switch (status) {
    case "duplicate":
      return "text-muted-foreground border-border/60";
    case "conflict":
      return "text-amber-600 border-amber-500/40 dark:text-amber-400";
    case "ready":
    default:
      return "text-emerald-600 border-emerald-500/40 dark:text-emerald-400";
  }
}

function statusBadgeLabel(status: RemoteСекретИмпортCandidate["status"]) {
  switch (status) {
    case "duplicate":
      return "Импортed";
    case "conflict":
      return "Conflict";
    case "ready":
    default:
      return "Готово";
  }
}

function СтатусBadge({
  status,
}: {
  status: RemoteСекретИмпортCandidate["status"];
}) {
  const Icon =
    status === "conflict"
      ? AlertTriangle
      : status === "duplicate"
        ? Link2
        : CheckCircle2;
  return (
    <Badge variant="outline" classИмя={cn("gap-1 px-1.5 py-0 font-normal", statusToneClasses(status))}>
      <Icon classИмя="h-3 w-3" />
      {statusBadgeLabel(status)}
    </Badge>
  );
}

function RowResultBadge({ status }: { status: RemoteСекретИмпортRowResult["status"] }) {
  switch (status) {
    case "imported":
      return (
        <Badge
          variant="outline"
          classИмя="gap-1 px-1.5 py-0 font-normal text-emerald-600 border-emerald-500/40 dark:text-emerald-400"
        >
          <CheckCircle2 classИмя="h-3 w-3" /> Создано
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          classИмя="gap-1 px-1.5 py-0 font-normal text-muted-foreground border-border/60"
        >
          <Link2 classИмя="h-3 w-3" /> Skipped
        </Badge>
      );
    case "error":
    default:
      return (
        <Badge
          variant="outline"
          classИмя="gap-1 px-1.5 py-0 font-normal text-destructive border-destructive/40"
        >
          <XCircle classИмя="h-3 w-3" /> Ошибка
        </Badge>
      );
  }
}

function middleTruncate(value: string, max = 60) {
  if (value.length <= max) return value;
  const head = Math.floor((max - 1) / 2);
  const tail = max - 1 - head;
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

function formatRelativeShort(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return date.toLocaleDateString();
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

function readableОшибкаMessage(error: unknown): string {
  if (error instanceof ApiОшибка) {
    return error.message || `Запрос не удался: ${error.status}`;
  }
  if (error instanceof Ошибка) return error.message;
  return "Неожиданная ошибка";
}

function apiОшибкаCode(error: ApiОшибка): string | null {
  const body = error.body;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  const details = record.details;
  if (details && typeof details === "object") {
    const code = (details as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return null;
}

function isPermissionОшибка(error: unknown): boolean {
  if (!(error instanceof ApiОшибка)) return false;
  if (apiОшибкаCode(error) === "access_denied") return true;
  if (error.status === 401 || error.status === 403) return true;
  const message = error.message.toНизкийerCase();
  return (
    message.includes("accessdenied") ||
    message.includes("access denied") ||
    message.includes("not authorized")
  );
}

function isThrottlingОшибка(error: unknown): boolean {
  if (!(error instanceof ApiОшибка)) return false;
  if (apiОшибкаCode(error) === "throttled") return true;
  const message = error.message.toНизкийerCase();
  return message.includes("throttl") || message.includes("toomanyrequests");
}

function buildЧерновик(candidate: RemoteСекретИмпортCandidate): ЧерновикSelection {
  return {
    candidate,
    name: candidate.name,
    key: candidate.key,
    description: "",
  };
}

function safeИмпортПровайдерMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const safe: Record<string, unknown> = {};
  for (const key of ["createdDate", "lastДоступedDate", "lastChangedDate", "deletedDate"]) {
    const value = metadata[key];
    if (typeof value === "string" || value === null) safe[key] = value;
  }
  for (const key of ["hasОписание", "hasKmsКлюч", "tagCount"]) {
    const value = metadata[key];
    if (typeof value === "boolean" || typeof value === "number") safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

function validateЧерновикRow(
  draft: ЧерновикSelection,
  existing: КомпанияСекрет[],
  otherЧерновикs: ЧерновикSelection[],
): string | null {
  if (!draft.name.trim()) return "Имя is required.";
  if (draft.name.length > 160) return "Имя must be 160 characters or fewer.";
  if (!draft.key.trim()) return "Ключ is required.";
  if (!KEY_PATTERN.test(draft.key)) {
    return "Ключ may only contain lowercase letters, numbers, dot, underscore, or hyphen.";
  }
  if (draft.key.length > 120) return "Ключ must be 120 characters or fewer.";
  if (draft.description.length > 500) return "Описание must be 500 characters or fewer.";

  const lowerИмя = draft.name.trim().toНизкийerCase();
  const lowerКлюч = draft.key.trim().toНизкийerCase();

  for (const existingСекрет of existing) {
    if (existingСекрет.name.trim().toНизкийerCase() === lowerИмя) {
      return "A Paperclip secret already uses this name.";
    }
    if (existingСекрет.key.trim().toНизкийerCase() === lowerКлюч) {
      return "A Paperclip secret already uses this key.";
    }
  }

  for (const other of otherЧерновикs) {
    if (other === draft) continue;
    if (other.name.trim().toНизкийerCase() === lowerИмя) {
      return "Another row in this batch already uses this name.";
    }
    if (other.key.trim().toНизкийerCase() === lowerКлюч) {
      return "Another row in this batch already uses this key.";
    }
  }

  return null;
}

function normalizeЧерновикКлюч(input: string): string {
  return input
    .trim()
    .toНизкийerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

interface ПредпросмотрState {
  candidates: RemoteСекретИмпортCandidate[];
  nextТокен: string | null;
}

const EMPTY_PREVIEW: ПредпросмотрState = { candidates: [], nextТокен: null };

export function ИмпортFromVaultDialog({
  open,
  onOpenChange,
  companyId,
  providerConfigs,
  existingСекреты,
  onИмпортComplete,
  onManageVaults,
}: ИмпортFromVaultDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToastActions();
  const awsVaults = useMemo(() => awsVaultOptions(providerConfigs), [providerConfigs]);
  const eligible = useMemo(() => eligibleVaults(providerConfigs), [providerConfigs]);
  const noEligibleVaults = eligible.length === 0;

  const [step, setStep] = useState<Step>("select");
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [searchInput, setПоискInput] = useState("");
  const debouncedQuery = useDebounced(searchInput.trim(), 250);

  const [preview, setПредпросмотр] = useState<ПредпросмотрState>(EMPTY_PREVIEW);
  const [previewЗагрузка, setПредпросмотрЗагрузка] = useState(false);
  const [pageЗагрузка, setPageЗагрузка] = useState(false);
  const [previewОшибка, setПредпросмотрОшибка] = useState<unknown>(null);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const [selection, setSelection] = useState<Map<string, ЧерновикSelection>>(new Map());
  const [importResult, setИмпортResult] = useState<RemoteСекретИмпортResult | null>(null);

  // Сбросить state on open transition.
  useEffect(() => {
    if (!open) return;
    setStep("select");
    setПоискInput("");
    setПредпросмотр(EMPTY_PREVIEW);
    setПредпросмотрОшибка(null);
    setSelection(new Map());
    setИмпортResult(null);
    setShowOnlySelected(false);
    const next = pickПо умолчаниюVault(providerConfigs);
    setVaultId(next);
    // We deliberately depend only on open so that re-opens reset the dialog;
    // providerConfigs changes during a session are handled by next preview fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const requestIdRef = useRef(0);

  // Запустить preview when vault or query changes (only on step "select").
  useEffect(() => {
    if (!open || step !== "select" || !vaultId) return;
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    setПредпросмотрЗагрузка(true);
    setПредпросмотрОшибка(null);
    setПредпросмотр(EMPTY_PREVIEW);
    secretsApi
      .remoteИмпортПредпросмотр(companyId, {
        providerConfigId: vaultId,
        query: debouncedQuery || null,
        nextТокен: null,
        pageSize: PAGE_SIZE,
      })
      .then((result: RemoteСекретИмпортПредпросмотрResult) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотр({
          candidates: result.candidates,
          nextТокен: result.nextТокен,
        });
      })
      .catch((error) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотрОшибка(error);
      })
      .finally(() => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотрЗагрузка(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, vaultId, debouncedQuery, companyId]);

  // When the vault changes, drop any selection (they're scoped to a vault).
  useEffect(() => {
    setSelection(new Map());
    setShowOnlySelected(false);
  }, [vaultId]);

  const visibleCandidates = useMemo<RemoteСекретИмпортCandidate[]>(() => {
    if (!showOnlySelected) return preview.candidates;
    return preview.candidates.filter((candidate) => selection.has(candidate.externalRef));
  }, [preview.candidates, selection, showOnlySelected]);

  const selectableInLoaded = useMemo(
    () => preview.candidates.filter((c) => c.importable),
    [preview.candidates],
  );

  const selectableLoadedCount = selectableInLoaded.length;
  const selectedLoadedCount = selectableInLoaded.filter((c) =>
    selection.has(c.externalRef),
  ).length;

  const headerCheckboxState: boolean | "indeterminate" =
    selectableLoadedCount === 0
      ? false
      : selectedLoadedCount === 0
        ? false
        : selectedLoadedCount === selectableLoadedCount
          ? true
          : "indeterminate";

  const totalSelected = selection.size;
  const selectedНетtVisible = useMemo(() => {
    if (!debouncedQuery) return 0;
    let count = 0;
    for (const ref of selection.keys()) {
      if (!preview.candidates.some((c) => c.externalRef === ref)) count += 1;
    }
    return count;
  }, [selection, preview.candidates, debouncedQuery]);

  const draftList = useMemo(() => Array.from(selection.values()), [selection]);

  const reviewОшибкаs = useMemo<Map<string, string>>(() => {
    const errors = new Map<string, string>();
    for (const draft of draftList) {
      const error = validateЧерновикRow(draft, existingСекреты, draftList);
      if (error) errors.set(draft.candidate.externalRef, error);
    }
    return errors;
  }, [draftList, existingСекреты]);

  const blockedReviewCount = reviewОшибкаs.size;
  const readyReviewCount = draftList.length - blockedReviewCount;

  const importMutation = useMutation({
    mutationFn: (input: RemoteИмпортInput) => secretsApi.remoteИмпорт(companyId, input),
    onУспешно: (result) => {
      setИмпортResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.list(companyId) });
      onИмпортComplete?.(result);
      const vaultИмя =
        awsVaults.find((vault) => vault.id === vaultId)?.displayИмя ?? "AWS";
      if (result.errorCount === draftList.length && result.errorCount > 0) {
        toast.pushToast({
          title: "Импорт failed",
          body: `Нет secrets were imported from ${vaultИмя}.`,
          tone: "error",
        });
      } else {
        toast.pushToast({
          title: result.errorCount > 0 ? "Импорт completed with errors" : "Импорт complete",
          body: `${result.importedCount} created · ${result.skippedCount} skipped · ${result.errorCount} failed`,
          tone: result.errorCount > 0 ? "warn" : "success",
        });
      }
    },
    onОшибка: (error) => {
      toast.pushToast({
        title: "Импорт failed",
        body: readableОшибкаMessage(error),
        tone: "error",
      });
    },
  });

  function handleVaultChange(nextId: string) {
    setVaultId(nextId);
    setПоискInput("");
  }

  function handleОбновить() {
    if (!vaultId || step !== "select") return;
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    setПредпросмотрЗагрузка(true);
    setПредпросмотрОшибка(null);
    secretsApi
      .remoteИмпортПредпросмотр(companyId, {
        providerConfigId: vaultId,
        query: debouncedQuery || null,
        nextТокен: null,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотр({ candidates: result.candidates, nextТокен: result.nextТокен });
      })
      .catch((error) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотрОшибка(error);
      })
      .finally(() => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setПредпросмотрЗагрузка(false);
      });
  }

  function handleLoadMore() {
    if (!vaultId || !preview.nextТокен || pageЗагрузка) return;
    setPageЗагрузка(true);
    secretsApi
      .remoteИмпортПредпросмотр(companyId, {
        providerConfigId: vaultId,
        query: debouncedQuery || null,
        nextТокен: preview.nextТокен,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        setПредпросмотр((prev) => {
          const seen = new Set(prev.candidates.map((c) => c.externalRef));
          const merged = [...prev.candidates];
          for (const candidate of result.candidates) {
            if (!seen.has(candidate.externalRef)) merged.push(candidate);
          }
          return { candidates: merged, nextТокен: result.nextТокен };
        });
      })
      .catch((error) => {
        toast.pushToast({
          title: "Could not load more results",
          body: readableОшибкаMessage(error),
          tone: "error",
        });
      })
      .finally(() => setPageЗагрузка(false));
  }

  function toggleRow(candidate: RemoteСекретИмпортCandidate) {
    if (!candidate.importable) return;
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(candidate.externalRef)) {
        next.delete(candidate.externalRef);
      } else {
        next.set(candidate.externalRef, buildЧерновик(candidate));
      }
      return next;
    });
  }

  function toggleВсеLoaded() {
    setSelection((prev) => {
      const next = new Map(prev);
      const allSelected = selectableInLoaded.every((c) => next.has(c.externalRef));
      if (allSelected) {
        for (const candidate of selectableInLoaded) {
          next.delete(candidate.externalRef);
        }
      } else {
        for (const candidate of selectableInLoaded) {
          if (!next.has(candidate.externalRef)) {
            next.set(candidate.externalRef, buildЧерновик(candidate));
          }
        }
      }
      return next;
    });
  }

  function updateЧерновик(externalRef: string, patch: Partial<ЧерновикSelection>) {
    setSelection((prev) => {
      const next = new Map(prev);
      const existing = next.get(externalRef);
      if (!existing) return prev;
      next.set(externalRef, { ...existing, ...patch });
      return next;
    });
  }

  function removeЧерновик(externalRef: string) {
    setSelection((prev) => {
      const next = new Map(prev);
      next.delete(externalRef);
      return next;
    });
  }

  function handleЗакрыть(force = false) {
    if (importMutation.isОжидание) return;
    if (!force && step !== "result" && selection.size > 0 && !importResult) {
      const ok = window.confirm(
        `Discard ${selection.size} pending import${selection.size === 1 ? "" : "s"}?`,
      );
      if (!ok) return;
    }
    onOpenChange(false);
  }

  function handleОтправитьИмпорт() {
    if (!vaultId || importMutation.isОжидание) return;
    if (blockedReviewCount > 0) return;
    if (draftList.length === 0) return;
    const items: RemoteИмпортSelectionInput[] = draftList.map((draft) => ({
      externalRef: draft.candidate.externalRef,
      name: draft.name.trim(),
      key: draft.key.trim(),
      description: draft.description.trim() || null,
      providerВерсияRef: draft.candidate.providerВерсияRef,
      providerMetadata: safeИмпортПровайдерMetadata(draft.candidate.providerMetadata),
    }));
    importMutation.mutate({ providerConfigId: vaultId, secrets: items });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
        } else {
          handleЗакрыть();
        }
      }}
    >
      <DialogContent
        showЗакрытьButton={false}
        classИмя="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        data-testid="import-from-vault-dialog"
      >
        <header classИмя="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div classИмя="flex flex-col gap-1">
            <DialogНазвание classИмя="text-base font-semibold">
              Импорт from AWS Секреты Manager
            </DialogНазвание>
            <DialogОписание classИмя="text-xs text-muted-foreground">
              Bring AWS-managed secrets into Paperclip as external references.
            </DialogОписание>
            <Stepper step={step} />
          </div>
          <button
            type="button"
            classИмя="rounded-sm text-muted-foreground transition-opacity hover:opacity-100 opacity-70"
            onClick={() => handleЗакрыть()}
            aria-label="Закрыть import dialog"
          >
            <X classИмя="h-4 w-4" />
          </button>
        </header>

        <div
          classИмя="flex min-h-0 flex-1 flex-col overflow-hidden"
          aria-live="polite"
        >
          {step === "select" && (
            <SelectStep
              awsVaults={awsVaults}
              eligible={eligible}
              vaultId={vaultId}
              onVaultChange={handleVaultChange}
              searchInput={searchInput}
              onПоискInput={setПоискInput}
              debouncedQuery={debouncedQuery}
              onОбновить={handleОбновить}
              previewЗагрузка={previewЗагрузка}
              pageЗагрузка={pageЗагрузка}
              previewОшибка={previewОшибка}
              candidates={preview.candidates}
              visibleCandidates={visibleCandidates}
              selectableInLoaded={selectableInLoaded}
              selection={selection}
              toggleRow={toggleRow}
              toggleВсеLoaded={toggleВсеLoaded}
              headerCheckboxState={headerCheckboxState}
              hasДалееPage={Boolean(preview.nextТокен)}
              onLoadMore={handleLoadMore}
              showOnlySelected={showOnlySelected}
              onShowOnlySelectedChange={setShowOnlySelected}
              selectedНетtVisible={selectedНетtVisible}
              noEligibleVaults={noEligibleVaults}
              onManageVaults={onManageVaults}
            />
          )}
          {step === "review" && (
            <ReviewStep
              drafts={draftList}
              reviewОшибкаs={reviewОшибкаs}
              updateЧерновик={updateЧерновик}
              removeЧерновик={removeЧерновик}
              importing={importMutation.isОжидание}
            />
          )}
          {step === "result" && importResult && (
            <ResultStep result={importResult} draftList={draftList} />
          )}
        </div>

        <footer classИмя="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-3">
          <FooterСтатус
            step={step}
            totalSelected={totalSelected}
            readyReviewCount={readyReviewCount}
            blockedReviewCount={blockedReviewCount}
            result={importResult}
          />
          <div classИмя="flex items-center gap-2">
            {step !== "result" && (
              <Button variant="ghost" size="sm" onClick={() => handleЗакрыть()}>
                Отмена
              </Button>
            )}
            {step === "review" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("select")}
                disabled={importMutation.isОжидание}
              >
                Назад
              </Button>
            )}
            {step === "select" && (
              <Button
                size="sm"
                onClick={() => setStep("review")}
                disabled={totalSelected === 0}
              >
                Продолжить → Review
              </Button>
            )}
            {step === "review" && (
              <Button
                size="sm"
                onClick={handleОтправитьИмпорт}
                disabled={
                  draftList.length === 0 ||
                  blockedReviewCount > 0 ||
                  importMutation.isОжидание
                }
              >
                {importMutation.isОжидание ? (
                  <>
                    <Loader2 classИмя="mr-1.5 h-3.5 w-3.5 animate-spin" /> Импортing…
                  </>
                ) : (
                  `Импорт ${draftList.length}`
                )}
              </Button>
            )}
            {step === "result" && (
              <Button size="sm" onClick={() => handleЗакрыть(true)}>
                Готово
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "select", label: "Select" },
    { id: "review", label: "Review" },
    { id: "result", label: "Result" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <div classИмя="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      {steps.map((s, index) => (
        <span key={s.id} classИмя="flex items-center gap-2">
          <span
            classИмя={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
              index === activeIndex
                ? "border-primary bg-primary text-primary-foreground"
                : index < activeIndex
                  ? "border-primary text-primary"
                  : "border-border/60",
            )}
          >
            {index + 1}
          </span>
          <span
            classИмя={cn(
              index === activeIndex ? "text-foreground font-medium" : undefined,
            )}
          >
            {s.label}
          </span>
          {index < steps.length - 1 && (
            <span classИмя="text-muted-foreground/60">›</span>
          )}
        </span>
      ))}
    </div>
  );
}

interface SelectStepProps {
  awsVaults: КомпанияСекретПровайдерConfig[];
  eligible: КомпанияСекретПровайдерConfig[];
  vaultId: string | null;
  onVaultChange: (id: string) => void;
  searchInput: string;
  onПоискInput: (value: string) => void;
  debouncedQuery: string;
  onОбновить: () => void;
  previewЗагрузка: boolean;
  pageЗагрузка: boolean;
  previewОшибка: unknown;
  candidates: RemoteСекретИмпортCandidate[];
  visibleCandidates: RemoteСекретИмпортCandidate[];
  selectableInLoaded: RemoteСекретИмпортCandidate[];
  selection: Map<string, ЧерновикSelection>;
  toggleRow: (candidate: RemoteСекретИмпортCandidate) => void;
  toggleВсеLoaded: () => void;
  headerCheckboxState: boolean | "indeterminate";
  hasДалееPage: boolean;
  onLoadMore: () => void;
  showOnlySelected: boolean;
  onShowOnlySelectedChange: (value: boolean) => void;
  selectedНетtVisible: number;
  noEligibleVaults: boolean;
  onManageVaults?: () => void;
}

function SelectStep(props: SelectStepProps) {
  const {
    awsVaults,
    eligible,
    vaultId,
    onVaultChange,
    searchInput,
    onПоискInput,
    debouncedQuery,
    onОбновить,
    previewЗагрузка,
    pageЗагрузка,
    previewОшибка,
    candidates,
    visibleCandidates,
    selectableInLoaded,
    selection,
    toggleRow,
    toggleВсеLoaded,
    headerCheckboxState,
    hasДалееPage,
    onLoadMore,
    showOnlySelected,
    onShowOnlySelectedChange,
    selectedНетtVisible,
    noEligibleVaults,
    onManageVaults,
  } = props;

  if (noEligibleVaults) {
    return (
      <div classИмя="flex min-h-0 flex-1 items-center justify-center p-6" data-testid="select-empty-vaults">
        <EmptyState
          icon={Cloud}
          message="Нет AWS provider vault configured. Добавить one to import secrets."
          action={onManageVaults ? "Manage vaults" : undefined}
          onAction={onManageVaults}
        />
      </div>
    );
  }

  const showПоискSpinner = previewЗагрузка && Boolean(debouncedQuery);

  return (
    <div classИмя="flex min-h-0 flex-1 flex-col">
      <div classИмя="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
        <label classИмя="text-xs uppercase tracking-wide text-muted-foreground">Vault</label>
        {awsVaults.length === 1 && eligible.length === 1 ? (
          <span classИмя="text-xs font-medium" data-testid="vault-static-label">
            {eligible[0].displayИмя}
          </span>
        ) : (
          <Select
            value={vaultId ?? undefined}
            onЗначениеChange={onVaultChange}
          >
            <SelectTrigger size="sm" classИмя="text-xs" aria-label="Select AWS vault">
              <SelectЗначение placeholder="Select an AWS vault" />
            </SelectTrigger>
            <SelectContent>
              {awsVaults.map((vault) => {
                const blocked = !isAwsSelectable(vault);
                return (
                  <SelectItem
                    key={vault.id}
                    value={vault.id}
                    disabled={blocked}
                    aria-disabled={blocked}
                  >
                    <span classИмя="flex items-center gap-2">
                      <span>{vault.displayИмя}</span>
                      {vault.isПо умолчанию && (
                        <Badge variant="outline" classИмя="px-1 py-0 text-[10px]">default</Badge>
                      )}
                      {vault.status === "warning" && (
                        <Badge variant="outline" classИмя="px-1 py-0 text-[10px] text-amber-500 border-amber-500/40">warning</Badge>
                      )}
                      {blocked && (
                        <Badge variant="outline" classИмя="px-1 py-0 text-[10px] text-muted-foreground">
                          {vault.status === "coming_soon" ? "coming soon" : vault.status}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        <div classИмя="relative ml-auto w-64">
          <Поиск classИмя="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => onПоискInput(event.target.value)}
            placeholder="Поиск by name, ARN, tag"
            classИмя="pl-7 pr-7 text-xs"
            aria-label="Поиск remote secrets"
            data-testid="vault-search"
          />
          {showПоискSpinner && (
            <Loader2 classИмя="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onОбновить}
          disabled={previewЗагрузка || !vaultId}
          aria-label="Обновить remote secrets"
        >
          <ОбновитьCw classИмя={cn("h-3.5 w-3.5", previewЗагрузка && "animate-spin")} />
        </Button>
      </div>

      {selectedНетtVisible > 0 && (
        <div classИмя="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-1.5 text-xs text-muted-foreground">
          <span>
            {selection.size} selected · {selectedНетtVisible} not visible with current search
          </span>
          <Button
            variant="ghost"
            size="sm"
            classИмя="h-6 px-2 text-xs"
            onClick={() => onShowOnlySelectedChange(!showOnlySelected)}
          >
            {showOnlySelected ? "Показать все" : "Show selected"}
          </Button>
        </div>
      )}

      <div classИмя="min-h-0 flex-1 overflow-y-auto" data-testid="vault-table-scroll">
        {previewОшибка ? (
          <ПредпросмотрОшибкаBanner error={previewОшибка} onПовторить={onОбновить} />
        ) : previewЗагрузка && candidates.length === 0 ? (
          <SkeletonRows rows={8} />
        ) : candidates.length === 0 ? (
          <EmptyCandidates query={debouncedQuery} />
        ) : (
          <table classИмя="w-full text-sm">
            <thead classИмя="sticky top-0 z-10 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th classИмя="px-3 py-2 text-left">
                  <Checkbox
                    checked={headerCheckboxState}
                    onCheckedChange={() => toggleВсеLoaded()}
                    aria-label={`Select all loaded (${selectableInLoaded.length})`}
                    disabled={selectableInLoaded.length === 0}
                  />
                </th>
                <th classИмя="px-2 py-2 text-left font-medium">Remote name</th>
                <th classИмя="px-2 py-2 text-left font-medium">Reference</th>
                <th classИмя="px-2 py-2 text-left font-medium">Last changed</th>
                <th classИмя="px-2 py-2 text-left font-medium">Suggested name</th>
                <th classИмя="px-2 py-2 text-left font-medium">State</th>
              </tr>
            </thead>
            <tbody data-testid="vault-table-body">
              {visibleCandidates.map((candidate) => {
                const isSelected = selection.has(candidate.externalRef);
                const meta = (candidate.providerMetadata ?? {}) as Record<string, unknown>;
                const lastChanged =
                  typeof meta.lastChangedAt === "string"
                    ? meta.lastChangedAt
                    : typeof meta.lastChangedDate === "string"
                      ? meta.lastChangedDate
                      : null;
                return (
                  <tr
                    key={candidate.externalRef}
                    classИмя={cn(
                      "border-b border-border/60 transition-colors",
                      candidate.importable
                        ? "cursor-pointer hover:bg-accent/40"
                        : "cursor-not-allowed text-muted-foreground",
                      isSelected && "bg-accent/60",
                    )}
                    onClick={() => toggleRow(candidate)}
                    data-testid={`vault-row-${candidate.externalRef}`}
                    data-row-state={candidate.status}
                  >
                    <td classИмя="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(candidate)}
                        disabled={!candidate.importable}
                        aria-label={`Select ${candidate.remoteИмя}`}
                      />
                    </td>
                    <td classИмя="px-2 py-2.5">
                      <div classИмя="text-sm font-medium leading-tight">{candidate.remoteИмя}</div>
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs">
                      <span
                        classИмя="font-mono text-muted-foreground"
                        title={candidate.externalRef}
                      >
                        {middleTruncate(candidate.externalRef, 50)}
                      </span>
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs text-muted-foreground">
                      {formatRelativeShort(lastChanged)}
                    </td>
                    <td classИмя="px-2 py-2.5 text-xs font-mono">{candidate.key}</td>
                    <td classИмя="px-2 py-2.5 text-xs">
                      <div classИмя="flex items-center gap-1.5">
                        <СтатусBadge status={candidate.status} />
                        {candidate.status === "duplicate" &&
                          candidate.conflicts.find((c) => c.type === "exact_reference")?.existingСекретId && (
                            <span classИмя="text-[11px] text-muted-foreground">
                              Already imported
                            </span>
                          )}
                      </div>
                      {candidate.status === "conflict" && candidate.conflicts.length > 0 && (
                        <div classИмя="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          {candidate.conflicts[0].message}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pageЗагрузка && (
                <tr>
                  <td colSpan={6} classИмя="p-0">
                    <SkeletonRows rows={4} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {hasДалееPage && !previewОшибка && (
          <div classИмя="flex items-center justify-between border-t border-border/60 px-5 py-2 text-xs text-muted-foreground">
            <span>
              {candidates.length} loaded
              {selectableInLoaded.length > 0 && (
                <span> · {selectableInLoaded.length} selectable</span>
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={pageЗагрузка}
              data-testid="vault-load-more"
            >
              {pageЗагрузка ? (
                <>
                  <Loader2 classИмя="mr-1.5 h-3.5 w-3.5 animate-spin" /> Загрузка…
                </>
              ) : (
                `Load ${PAGE_SIZE} more`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ПредпросмотрОшибкаBanner({ error, onПовторить }: { error: unknown; onПовторить: () => void }) {
  const isPermission = isPermissionОшибка(error);
  const isThrottling = isThrottlingОшибка(error);
  const message = readableОшибкаMessage(error);
  return (
    <div
      classИмя="m-5 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
      data-testid="preview-error-banner"
    >
      <AlertCircle classИмя="mt-0.5 h-4 w-4 shrink-0" />
      <div classИмя="flex-1">
        <div classИмя="font-medium">
          {isPermission
            ? "AWS denied list access"
            : isThrottling
              ? "AWS throttled the listing request"
              : "Could not load remote secrets"}
        </div>
        <div classИмя="mt-1 text-xs leading-relaxed text-destructive/80">
          {isPermission
            ? "The AWS principal behind this vault is missing secretsmanager:ListСекреты. Обновить IAM and try again."
            : message}
        </div>
        <div classИмя="mt-2 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onПовторить}>
            <ОбновитьCw classИмя="mr-1.5 h-3.5 w-3.5" /> Повторить
          </Button>
          {isPermission && (
            <a
              href="https://docs.aws.amazon.com/service-authorization/latest/reference/list_awssecretsmanager.html"
              target="_blank"
              rel="noreferrer"
              classИмя="inline-flex items-center gap-1 text-xs font-medium underline"
            >
              IAM reference <ExternalLink classИмя="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div classИмя="flex flex-col gap-1.5 p-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} classИмя="h-8 w-full" />
      ))}
    </div>
  );
}

function EmptyCandidates({ query }: { query: string }) {
  if (query) {
    return (
      <EmptyState
        icon={Поиск}
        message={`Нет remote secrets match "${query}".`}
      />
    );
  }
  return (
    <EmptyState
      icon={Database}
      message="Нет secrets visible to this vault."
    />
  );
}

interface ReviewStepProps {
  drafts: ЧерновикSelection[];
  reviewОшибкаs: Map<string, string>;
  updateЧерновик: (externalRef: string, patch: Partial<ЧерновикSelection>) => void;
  removeЧерновик: (externalRef: string) => void;
  importing: boolean;
}

function ReviewStep({ drafts, reviewОшибкаs, updateЧерновик, removeЧерновик, importing }: ReviewStepProps) {
  if (drafts.length === 0) {
    return (
      <div classИмя="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          icon={Info}
          message="Нет secrets selected. Go back to pick remote secrets to import."
        />
      </div>
    );
  }

  const blocked = reviewОшибкаs.size;
  const ready = drafts.length - blocked;

  return (
    <div classИмя="flex min-h-0 flex-1 flex-col">
      <div classИмя="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/20 px-5 py-3 text-xs">
        <span classИмя="font-medium">{ready} secrets ready to import</span>
        {blocked > 0 && (
          <span classИмя="text-amber-600 dark:text-amber-400">
            {blocked} need attention before import
          </span>
        )}
      </div>
      <div classИмя="min-h-0 flex-1 overflow-y-auto" data-testid="review-list">
        {drafts.map((draft) => {
          const error = reviewОшибкаs.get(draft.candidate.externalRef);
          return (
            <div
              key={draft.candidate.externalRef}
              classИмя={cn(
                "border-b border-border/60 p-4",
                error && "border-l-2 border-l-amber-500/60 bg-amber-500/5",
              )}
              data-testid={`review-row-${draft.candidate.externalRef}`}
            >
              <div classИмя="flex items-start justify-between gap-4">
                <div classИмя="min-w-0 flex-1 space-y-2">
                  <div classИмя="flex flex-col gap-0.5">
                    <span classИмя="text-sm font-medium">{draft.candidate.remoteИмя}</span>
                    <span
                      classИмя="font-mono text-xs text-muted-foreground"
                      title={draft.candidate.externalRef}
                    >
                      {middleTruncate(draft.candidate.externalRef, 60)}
                    </span>
                  </div>
                  <div classИмя="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label classИмя="flex flex-col gap-1 text-xs">
                      <span classИмя="text-muted-foreground">Paperclip name</span>
                      <Input
                        value={draft.name}
                        onChange={(e) =>
                          updateЧерновик(draft.candidate.externalRef, { name: e.target.value })
                        }
                        classИмя="text-xs"
                        aria-invalid={Boolean(error)}
                        disabled={importing}
                        data-testid={`review-name-${draft.candidate.externalRef}`}
                      />
                    </label>
                    <label classИмя="flex flex-col gap-1 text-xs">
                      <span classИмя="text-muted-foreground">Ключ</span>
                      <Input
                        value={draft.key}
                        onChange={(e) =>
                          updateЧерновик(draft.candidate.externalRef, { key: e.target.value })
                        }
                        onBlur={(e) =>
                          updateЧерновик(draft.candidate.externalRef, {
                            key: normalizeЧерновикКлюч(e.target.value),
                          })
                        }
                        classИмя="font-mono text-xs"
                        aria-invalid={Boolean(error)}
                        disabled={importing}
                        data-testid={`review-key-${draft.candidate.externalRef}`}
                      />
                    </label>
                    <label classИмя="flex flex-col gap-1 text-xs">
                      <span classИмя="text-muted-foreground">Описание (optional)</span>
                      <Input
                        value={draft.description}
                        onChange={(e) =>
                          updateЧерновик(draft.candidate.externalRef, {
                            description: e.target.value,
                          })
                        }
                        classИмя="text-xs"
                        disabled={importing}
                        data-testid={`review-description-${draft.candidate.externalRef}`}
                      />
                    </label>
                  </div>
                  {error && (
                    <div
                      classИмя="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                      role="alert"
                      data-testid={`review-error-${draft.candidate.externalRef}`}
                    >
                      <AlertTriangle classИмя="h-3.5 w-3.5" />
                      {error}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeЧерновик(draft.candidate.externalRef)}
                  aria-label={`Удалить ${draft.candidate.remoteИмя}`}
                  classИмя="h-7 w-7"
                  disabled={importing}
                >
                  <X classИмя="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ResultStepProps {
  result: RemoteСекретИмпортResult;
  draftList: ЧерновикSelection[];
}

function ResultStep({ result, draftList }: ResultStepProps) {
  const grouped = useMemo(() => {
    const created: RemoteСекретИмпортRowResult[] = [];
    const skipped: RemoteСекретИмпортRowResult[] = [];
    const failed: RemoteСекретИмпортRowResult[] = [];
    for (const row of result.results) {
      if (row.status === "imported") created.push(row);
      else if (row.status === "skipped") skipped.push(row);
      else failed.push(row);
    }
    return { created, skipped, failed };
  }, [result]);

  const draftLookup = useMemo(() => {
    const map = new Map<string, ЧерновикSelection>();
    for (const draft of draftList) map.set(draft.candidate.externalRef, draft);
    return map;
  }, [draftList]);

  const heading =
    result.errorCount === result.results.length && result.errorCount > 0
      ? "Импорт failed"
      : result.errorCount === 0 && result.skippedCount === 0
        ? `Все ${result.importedCount} secrets imported`
        : "Импорт complete";

  return (
    <div classИмя="flex min-h-0 flex-1 flex-col">
      <div classИмя="border-b border-border/60 px-5 py-3" data-testid="result-summary">
        <h3 classИмя="text-sm font-semibold">{heading}</h3>
        <div classИмя="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span classИмя="text-emerald-600 dark:text-emerald-400">✓ {result.importedCount} created</span>
          <span>⊘ {result.skippedCount} skipped</span>
          <span classИмя="text-destructive">⨯ {result.errorCount} failed</span>
        </div>
      </div>
      <div classИмя="min-h-0 flex-1 overflow-y-auto">
        {grouped.created.length > 0 && (
          <ResultGroup label="Создано" rows={grouped.created} draftLookup={draftLookup} />
        )}
        {grouped.skipped.length > 0 && (
          <ResultGroup label="Skipped" rows={grouped.skipped} draftLookup={draftLookup} />
        )}
        {grouped.failed.length > 0 && (
          <ResultGroup label="Ошибка" rows={grouped.failed} draftLookup={draftLookup} />
        )}
      </div>
    </div>
  );
}

function ResultGroup({
  label,
  rows,
  draftLookup,
}: {
  label: string;
  rows: RemoteСекретИмпортRowResult[];
  draftLookup: Map<string, ЧерновикSelection>;
}) {
  return (
    <section>
      <header classИмя="bg-muted/30 px-5 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {label} · {rows.length}
      </header>
      <ul classИмя="divide-y divide-border/60">
        {rows.map((row) => {
          const draft = draftLookup.get(row.externalRef);
          const remoteИмя = draft?.candidate.remoteИмя ?? row.name;
          return (
            <li
              key={row.externalRef}
              classИмя="flex flex-wrap items-start gap-2 px-5 py-2.5 text-xs"
              data-testid={`result-row-${row.externalRef}`}
              data-row-status={row.status}
            >
              <RowResultBadge status={row.status} />
              <span classИмя="font-medium">{row.name}</span>
              <span classИмя="font-mono text-muted-foreground">{row.key}</span>
              <span
                classИмя="font-mono text-muted-foreground"
                title={row.externalRef}
              >
                {middleTruncate(row.externalRef, 40)}
              </span>
              <span classИмя="ml-auto flex items-center gap-2">
                {row.status === "imported" && row.secretId && (
                  <span classИмя="text-muted-foreground">{remoteИмя}</span>
                )}
                {row.reason && (
                  <span
                    classИмя={cn(
                      "max-w-[24rem] truncate",
                      row.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                    title={row.reason}
                  >
                    {row.reason}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface FooterСтатусProps {
  step: Step;
  totalSelected: number;
  readyReviewCount: number;
  blockedReviewCount: number;
  result: RemoteСекретИмпортResult | null;
}

function FooterСтатус({
  step,
  totalSelected,
  readyReviewCount,
  blockedReviewCount,
  result,
}: FooterСтатусProps) {
  if (step === "select") {
    return (
      <div classИмя="text-xs text-muted-foreground">
        {totalSelected === 0
          ? "Select remote secrets to import"
          : `${totalSelected} selected`}
      </div>
    );
  }
  if (step === "review") {
    return (
      <div classИмя="text-xs text-muted-foreground">
        {readyReviewCount} ready
        {blockedReviewCount > 0 && (
          <span classИмя="ml-2 text-amber-600 dark:text-amber-400">
            · {blockedReviewCount} blocked
          </span>
        )}
      </div>
    );
  }
  if (result) {
    return (
      <div classИмя="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{result.importedCount} created</span>
        <span>{result.skippedCount} skipped</span>
        <span>{result.errorCount} failed</span>
      </div>
    );
  }
  return null;
}
