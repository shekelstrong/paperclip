import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, FlaskConical, Play, Поиск } from "lucide-react";
import type {
  ЗадачаGraphLivenessАвтоRecoveryПредпросмотр,
  PatchInstanceExperimentalНастройки,
} from "@paperclipai/shared";
import { instanceНастройкиApi } from "@/api/instanceНастройки";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";

function issueHref(identifier: string | null, issueId: string) {
  if (!identifier) return `/issues/${issueId}`;
  const prefix = identifier.split("-")[0] || "PAP";
  return `/${prefix}/issues/${identifier}`;
}

function formatRecoveryState(state: string) {
  return state.replace(/_/g, " ");
}

function RecoveryПредпросмотрDialog({
  preview,
  open,
  onOpenChange,
  onВключитьOnly,
  onВключитьAndЗапустить,
  isОжидание,
}: {
  preview: ЗадачаGraphLivenessАвтоRecoveryПредпросмотр | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onВключитьOnly: () => void;
  onВключитьAndЗапустить: () => void;
  isОжидание: boolean;
}) {
  const count = preview?.recoverableFindings ?? 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="sm:max-w-3xl">
        <DialogHeader>
          <DialogНазвание>Подтвердить auto-recovery</DialogНазвание>
          <DialogОписание>
            {preview
              ? `${count} recovery ${count === 1 ? "task" : "tasks"} match the last ${preview.lookbackHours} hours.`
              : "Checking recovery candidates before enabling."}
          </DialogОписание>
        </DialogHeader>

        <div classИмя="max-h-[min(28rem,65vh)] space-y-3 overflow-y-auto pr-1">
          {preview && preview.items.length === 0 ? (
            <div classИмя="rounded-md border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              Нет recovery tasks would be created right now. Авто-recovery can still run for future liveness incidents in
              this window.
            </div>
          ) : null}

          {preview?.items.map((item) => (
            <div key={item.incidentКлюч} classИмя="rounded-md border border-border bg-card px-3 py-3">
              <div classИмя="flex flex-wrap items-center gap-2">
                <a
                  href={issueHref(item.identifier, item.issueId)}
                  classИмя="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {item.identifier ?? item.issueId}
                </a>
                <span classИмя="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {formatRecoveryState(item.state)}
                </span>
              </div>
              <p classИмя="mt-1 text-sm text-foreground">{item.title}</p>
              <p classИмя="mt-1 text-xs text-muted-foreground">{item.reason}</p>
              <div classИмя="mt-2 text-xs text-muted-foreground">
                Recovery target:{" "}
                <a
                  href={issueHref(item.recoveryIdentifier, item.recoveryЗадачаId)}
                  classИмя="text-primary underline-offset-2 hover:underline"
                >
                  {item.recoveryIdentifier ?? item.recoveryЗадачаId}
                </a>
              </div>
            </div>
          ))}
        </div>

        {preview && preview.skippedOutsideLookback > 0 ? (
          <p classИмя="text-xs text-muted-foreground">
            {preview.skippedOutsideLookback} current{" "}
            {preview.skippedOutsideLookback === 1 ? "finding is" : "findings are"} outside the configured lookback and
            will not be touched.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isОжидание}>
            Отмена
          </Button>
          <Button variant="outline" onClick={onВключитьOnly} disabled={isОжидание || !preview}>
            Включить only
          </Button>
          <Button onClick={onВключитьAndЗапустить} disabled={isОжидание || !preview}>
            {count > 0 ? `Включить and create ${count}` : "Включить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InstanceExperimentalНастройки() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);
  const [lookbackHoursЧерновик, setLookbackHoursЧерновик] = useState("24");
  const [previewDialogOpen, setПредпросмотрDialogOpen] = useState(false);
  const [pendingПредпросмотр, setОжиданиеПредпросмотр] = useState<ЗадачаGraphLivenessАвтоRecoveryПредпросмотр | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Настройки" },
      { label: "Experimental" },
    ]);
  }, [setBreadcrumbs]);

  const experimentalQuery = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (patch: PatchInstanceExperimentalНастройки) =>
      instanceНастройкиApi.updateExperimental(patch),
    onУспешно: async () => {
      setActionОшибка(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.experimentalНастройки }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.health }),
      ]);
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to update experimental settings.");
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (lookbackHours: number) =>
      instanceНастройкиApi.previewЗадачаGraphLivenessАвтоRecovery({ lookbackHours }),
    onУспешно: (preview) => {
      setActionОшибка(null);
      setОжиданиеПредпросмотр(preview);
      setПредпросмотрDialogOpen(true);
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to preview recovery tasks.");
    },
  });

  const runRecoveryMutation = useMutation({
    mutationFn: async (lookbackHours: number) =>
      instanceНастройкиApi.runЗадачаGraphLivenessАвтоRecovery({ lookbackHours }),
    onУспешно: async () => {
      setActionОшибка(null);
      setПредпросмотрDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.experimentalНастройки }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.health }),
      ]);
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to create recovery tasks.");
    },
  });

  useEffect(() => {
    const next = experimentalQuery.data?.issueGraphLivenessАвтоRecoveryLookbackHours;
    if (typeof next === "number") {
      setLookbackHoursЧерновик(String(next));
    }
  }, [experimentalQuery.data?.issueGraphLivenessАвтоRecoveryLookbackHours]);

  if (experimentalQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка experimental settings...</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div classИмя="text-sm text-destructive">
        {experimentalQuery.error instanceof Ошибка
          ? experimentalQuery.error.message
          : "Ошибка to load experimental settings."}
      </div>
    );
  }

  const enableОкружения = experimentalQuery.data?.enableОкружения === true;
  const enableIsolatedРабочие области = experimentalQuery.data?.enableIsolatedРабочие области === true;
  const autoПерезапуститьDevServerWhenIdle = experimentalQuery.data?.autoПерезапуститьDevServerWhenIdle === true;
  const enableЗадачаGraphLivenessАвтоRecovery =
    experimentalQuery.data?.enableЗадачаGraphLivenessАвтоRecovery === true;
  const lookbackHours =
    experimentalQuery.data?.issueGraphLivenessАвтоRecoveryLookbackHours ?? 24;
  const parsedLookbackHours = Number.parseInt(lookbackHoursЧерновик, 10);
  const lookbackHoursIsValid =
    Number.isInteger(parsedLookbackHours) && parsedLookbackHours >= 1 && parsedLookbackHours <= 720;
  const recoveryActionОжидание =
    toggleMutation.isОжидание || previewMutation.isОжидание || runRecoveryMutation.isОжидание;

  function previewForВключить() {
    if (!lookbackHoursIsValid) {
      setActionОшибка("Lookback hours must be a whole number from 1 to 720.");
      return;
    }
    previewMutation.mutate(parsedLookbackHours);
  }

  function enableOnly() {
    if (!lookbackHoursIsValid) return;
    toggleMutation.mutate({
      enableЗадачаGraphLivenessАвтоRecovery: true,
      issueGraphLivenessАвтоRecoveryLookbackHours: parsedLookbackHours,
    }, {
      onУспешно: () => setПредпросмотрDialogOpen(false),
    });
  }

  function enableAndЗапустить() {
    if (!lookbackHoursIsValid) return;
    toggleMutation.mutate({
      enableЗадачаGraphLivenessАвтоRecovery: true,
      issueGraphLivenessАвтоRecoveryLookbackHours: parsedLookbackHours,
    }, {
      onУспешно: () => runRecoveryMutation.mutate(parsedLookbackHours),
    });
  }

  return (
    <div classИмя="max-w-4xl space-y-6">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <FlaskConical classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Experimental</h1>
        </div>
        <p classИмя="text-sm text-muted-foreground">
          Opt into features that are still being evaluated before they become default behavior.
        </p>
      </div>

      {actionОшибка && (
        <div classИмя="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionОшибка}
        </div>
      )}

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Включить Окружения</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Show environment management in company settings and allow project and agent environment assignment
              controls.
            </p>
          </div>
          <ToggleSwitch
            checked={enableОкружения}
            onCheckedChange={() => toggleMutation.mutate({ enableОкружения: !enableОкружения })}
            disabled={toggleMutation.isОжидание}
            aria-label="Toggle environments experimental setting"
          />
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Включить Isolated Рабочие области</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              Show execution workspace controls in project configuration and allow isolated workspace behavior for new
              and existing issue runs.
            </p>
          </div>
          <ToggleSwitch
            checked={enableIsolatedРабочие области}
            onCheckedChange={() => toggleMutation.mutate({ enableIsolatedРабочие области: !enableIsolatedРабочие области })}
            disabled={toggleMutation.isОжидание}
            aria-label="Toggle isolated workspaces experimental setting"
          />
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex items-start justify-between gap-4">
          <div classИмя="space-y-1.5">
            <h2 classИмя="text-sm font-semibold">Авто-Перезапустить Dev Server When Idle</h2>
            <p classИмя="max-w-2xl text-sm text-muted-foreground">
              In `pnpm dev:once`, wait for all queued and running local agent runs to finish, then restart the server
              automatically when backend changes or migrations make the current boot stale.
            </p>
          </div>
          <ToggleSwitch
            checked={autoПерезапуститьDevServerWhenIdle}
            onCheckedChange={() => toggleMutation.mutate({ autoПерезапуститьDevServerWhenIdle: !autoПерезапуститьDevServerWhenIdle })}
            disabled={toggleMutation.isОжидание}
            aria-label="Toggle guarded dev-server auto-restart"
          />
        </div>
      </section>

      <section classИмя="rounded-xl border border-border bg-card p-5">
        <div classИмя="flex flex-col gap-5">
          <div classИмя="flex items-start justify-between gap-4">
            <div classИмя="space-y-1.5">
              <h2 classИмя="text-sm font-semibold">Авто-Создать задачу Recovery Задачи</h2>
              <p classИмя="max-w-2xl text-sm text-muted-foreground">
                Let the heartbeat scheduler create recovery issues for issue dependency chains found inside the
                configured lookback window.
              </p>
            </div>
            <ToggleSwitch
              checked={enableЗадачаGraphLivenessАвтоRecovery}
              onCheckedChange={() => {
                if (enableЗадачаGraphLivenessАвтоRecovery) {
                  toggleMutation.mutate({ enableЗадачаGraphLivenessАвтоRecovery: false });
                  return;
                }
                previewForВключить();
              }}
              disabled={recoveryActionОжидание}
              aria-label="Toggle issue graph liveness auto-recovery"
            />
          </div>

          <div classИмя="grid gap-3 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:items-end">
            <label classИмя="space-y-1.5">
              <span classИмя="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock classИмя="h-3.5 w-3.5" />
                Lookback hours
              </span>
              <Input
                type="number"
                min={1}
                max={720}
                step={1}
                value={lookbackHoursЧерновик}
                onChange={(event) => setLookbackHoursЧерновик(event.target.value)}
                aria-invalid={!lookbackHoursIsValid}
              />
            </label>
            <div classИмя="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!lookbackHoursIsValid) {
                    setActionОшибка("Lookback hours must be a whole number from 1 to 720.");
                    return;
                  }
                  toggleMutation.mutate({
                    issueGraphLivenessАвтоRecoveryLookbackHours: parsedLookbackHours,
                  });
                }}
                disabled={recoveryActionОжидание || parsedLookbackHours === lookbackHours}
              >
                Сохранить hours
              </Button>
              <Button
                variant="outline"
                onClick={previewForВключить}
                disabled={recoveryActionОжидание}
              >
                <Поиск classИмя="h-4 w-4" />
                Предпросмотр
              </Button>
              <Button
                onClick={() => {
                  if (!lookbackHoursIsValid) {
                    setActionОшибка("Lookback hours must be a whole number from 1 to 720.");
                    return;
                  }
                  runRecoveryMutation.mutate(parsedLookbackHours);
                }}
                disabled={recoveryActionОжидание || !enableЗадачаGraphLivenessАвтоRecovery}
              >
                <Play classИмя="h-4 w-4" />
                Запустить сейчас
              </Button>
            </div>
          </div>

          <p classИмя="text-xs text-muted-foreground">
            Current window: last {lookbackHours} {lookbackHours === 1 ? "hour" : "hours"}.
          </p>
        </div>
      </section>

      <RecoveryПредпросмотрDialog
        open={previewDialogOpen}
        onOpenChange={setПредпросмотрDialogOpen}
        preview={pendingПредпросмотр}
        onВключитьOnly={enableOnly}
        onВключитьAndЗапустить={enableAndЗапустить}
        isОжидание={recoveryActionОжидание}
      />
    </div>
  );
}
