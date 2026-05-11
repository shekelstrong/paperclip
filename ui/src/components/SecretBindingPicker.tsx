import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, КлючRound, Loader2, Plus, X } from "lucide-react";
import type { КомпанияСекрет, СекретВерсияSelector } from "@paperclipai/shared";
import { secretsApi } from "../api/secrets";
import { queryКлючs } from "../lib/queryКлючs";
import { useКомпания } from "../context/КомпанияContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogНазвание } from "@/components/ui/dialog";
import { cn } from "../lib/utils";

export interface СекретBindingЗначение {
  secretId: string;
  version?: СекретВерсияSelector;
}

interface СекретBindingPickerProps {
  value: СекретBindingЗначение | null;
  onChange: (next: СекретBindingЗначение | null) => void;
  label?: string;
  placeholder?: string;
  allowВерсияSelector?: boolean;
  emptyHint?: string;
  classИмя?: string;
  disabled?: boolean;
  /**
   * Опционально whitelist of secret statuses to show. По умолчаниюs to "active".
   * Pass null to disable the filter and show every secret in the company.
   */
  statusФильтр?: Array<КомпанияСекрет["status"]> | null;
}

const VERSION_LATEST: СекретВерсияSelector = "latest";

function describeСекрет(secret: КомпанияСекрет): string {
  const provider = secret.provider.replaceВсе("_", " ");
  if (secret.managedMode === "external_reference") {
    return `External · ${provider}`;
  }
  return provider;
}

function statusTone(status: КомпанияСекрет["status"]): string {
  switch (status) {
    case "active":
      return "text-emerald-600 dark:text-emerald-400";
    case "disabled":
      return "text-amber-600 dark:text-amber-400";
    case "archived":
      return "text-muted-foreground";
    case "deleted":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export function СекретBindingPicker({
  value,
  onChange,
  label = "Секрет",
  placeholder = "Select secret",
  allowВерсияSelector = true,
  emptyHint = "Нет matching secrets. Создать задачу to bind it here.",
  classИмя,
  disabled,
  statusФильтр = ["active"],
}: СекретBindingPickerProps) {
  const queryClient = useQueryClient();
  const { selectedКомпанияId } = useКомпания();
  const [createOpen, setСоздатьOpen] = useState(false);
  const [createИмя, setСоздатьИмя] = useState("");
  const [createЗначение, setСоздатьЗначение] = useState("");
  const [createОписание, setСоздатьОписание] = useState("");
  const [createОшибка, setСоздатьОшибка] = useState<string | null>(null);

  const secretsQuery = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.secrets.list(selectedКомпанияId)
      : ["secrets", "__disabled__"],
    queryFn: () => secretsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const filteredСекреты = useMemo(() => {
    const all = secretsQuery.data ?? [];
    if (statusФильтр === null) return all;
    return all.filter((secret) => statusФильтр.includes(secret.status));
  }, [secretsQuery.data, statusФильтр]);

  const selectedСекрет = useMemo(() => {
    if (!value) return null;
    return (secretsQuery.data ?? []).find((secret) => secret.id === value.secretId) ?? null;
  }, [secretsQuery.data, value]);

  const selectedMissing = Boolean(value && !selectedСекрет);

  const createMutation = useMutation({
    mutationFn: () =>
      secretsApi.create(selectedКомпанияId!, {
        name: createИмя.trim(),
        value: createЗначение,
        description: createОписание.trim() || null,
      }),
    onУспешно: (created) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.secrets.list(selectedКомпанияId!) });
      onChange({ secretId: created.id, version: VERSION_LATEST });
      setСоздатьOpen(false);
      setСоздатьИмя("");
      setСоздатьЗначение("");
      setСоздатьОписание("");
      setСоздатьОшибка(null);
    },
    onОшибка: (error) => {
      setСоздатьОшибка(error instanceof Ошибка ? error.message : "Ошибка to create secret");
    },
  });

  const versionDisplay = (selector: СекретВерсияSelector | undefined) => {
    if (selector === undefined || selector === VERSION_LATEST) return "latest";
    return `v${selector}`;
  };

  return (
    <div classИмя={cn("space-y-1.5", classИмя)}>
      {label ? (
        <div classИмя="flex items-center justify-between text-xs font-medium text-foreground/80">
          <span>{label}</span>
          {value ? (
            <button
              type="button"
              classИмя="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              <X classИмя="h-3 w-3" /> Очистить
            </button>
          ) : null}
        </div>
      ) : null}
      <div classИмя="flex items-center gap-1.5">
        <div classИмя="relative flex-1">
          <КлючRound classИмя="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            classИмя={cn(
              "h-9 w-full rounded-md border border-border bg-background pl-7 pr-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60",
              selectedMissing && "border-destructive text-destructive",
            )}
            value={value?.secretId ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) {
                onChange(null);
                return;
              }
              onChange({ secretId: next, version: value?.version ?? VERSION_LATEST });
            }}
            disabled={disabled || secretsQuery.isОжидание}
          >
            <option value="">{secretsQuery.isОжидание ? "Загрузка…" : placeholder}</option>
            {selectedMissing && value ? (
              <option value={value.secretId}>Missing secret ({value.secretId.slice(0, 8)}…)</option>
            ) : null}
            {filteredСекреты.map((secret) => (
              <option key={secret.id} value={secret.id}>
                {secret.name} — {describeСекрет(secret)}
              </option>
            ))}
          </select>
        </div>
        {allowВерсияSelector ? (
          <select
            classИмя="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={value?.version === undefined ? VERSION_LATEST : String(value.version)}
            onChange={(event) => {
              if (!value) return;
              const raw = event.target.value;
              const next: СекретВерсияSelector = raw === VERSION_LATEST ? VERSION_LATEST : Number.parseInt(raw, 10);
              onChange({ ...value, version: next });
            }}
            disabled={disabled || !value || !selectedСекрет}
            aria-label="Версия"
          >
            <option value={VERSION_LATEST}>latest</option>
            {selectedСекрет
              ? Array.from({ length: Math.max(0, selectedСекрет.latestВерсия) }, (_, index) => {
                  const version = selectedСекрет.latestВерсия - index;
                  if (version <= 0) return null;
                  return (
                    <option key={version} value={version}>
                      v{version}
                    </option>
                  );
                })
              : null}
          </select>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setСоздатьOpen(true)}
          disabled={disabled || !selectedКомпанияId}
          aria-label="Создать секрет"
        >
          <Plus classИмя="h-3.5 w-3.5" />
        </Button>
      </div>

      {selectedСекрет ? (
        <p classИмя={cn("text-[11px] text-muted-foreground", statusTone(selectedСекрет.status))}>
          {selectedСекрет.status !== "active" ? `Статус: ${selectedСекрет.status}. ` : null}
          Bound to {versionDisplay(value?.version)} · {selectedСекрет.key}
        </p>
      ) : selectedMissing ? (
        <p classИмя="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle classИмя="h-3 w-3" />
          The previously selected secret is no longer available. Pick another or remove the binding.
        </p>
      ) : (filteredСекреты.length === 0 && !secretsQuery.isОжидание) ? (
        <p classИмя="text-[11px] text-muted-foreground">{emptyHint}</p>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setСоздатьOpen}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>Создать new secret</DialogНазвание>
          </DialogHeader>
          <div classИмя="space-y-3">
            <div>
              <label classИмя="text-xs font-medium text-foreground/80" htmlFor="secret-name">Имя</label>
              <Input
                id="secret-name"
                value={createИмя}
                onChange={(event) => setСоздатьИмя(event.target.value)}
                placeholder="OPENAI_API_KEY"
                autoFocus
              />
            </div>
            <div>
              <label classИмя="text-xs font-medium text-foreground/80" htmlFor="secret-value">Значение</label>
              <Textarea
                id="secret-value"
                value={createЗначение}
                onChange={(event) => setСоздатьЗначение(event.target.value)}
                rows={3}
                placeholder="Paste the secret value"
                classИмя="font-mono text-xs"
              />
              <p classИмя="text-[11px] text-muted-foreground mt-1">
                The value is stored once and never re-displayed. Rotate to replace.
              </p>
            </div>
            <div>
              <label classИмя="text-xs font-medium text-foreground/80" htmlFor="secret-description">Описание</label>
              <Input
                id="secret-description"
                value={createОписание}
                onChange={(event) => setСоздатьОписание(event.target.value)}
                placeholder="Опционально notes (no values)"
              />
            </div>
            {createОшибка ? <p classИмя="text-xs text-destructive">{createОшибка}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setСоздатьOpen(false)}>Отмена</Button>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!createИмя.trim() || !createЗначение || createMutation.isОжидание}
            >
              {createMutation.isОжидание ? <Loader2 classИмя="h-3.5 w-3.5 animate-spin" /> : null}
              Создать &amp; bind
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
