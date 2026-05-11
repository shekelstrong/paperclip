import type {
  Рабочая областьКомандаDefinition,
  Рабочая областьЗапуститьtimeControlЦель,
  Рабочая областьЗапуститьtimeService,
} from "@paperclipai/shared";
import {
  listРабочая областьКомандаDefinitions,
  matchРабочая областьЗапуститьtimeServiceToКоманда,
} from "@paperclipai/shared";
import { Активность, ExternalLink, Loader2, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Рабочая областьЗапуститьtimeAction = "start" | "stop" | "restart" | "run";

export type Рабочая областьЗапуститьtimeControlRequest = Рабочая областьЗапуститьtimeControlЦель & {
  action: Рабочая областьЗапуститьtimeAction;
};

export type Рабочая областьЗапуститьtimeControlItem = {
  key: string;
  title: string;
  kind: "service" | "job";
  statusLabel: string;
  lifecycle: "shared" | "ephemeral" | null;
  healthСтатус: "unknown" | "healthy" | "unhealthy" | null;
  command: string | null;
  cwd: string | null;
  port: number | null;
  url: string | null;
  canНачать: boolean;
  canЗапустить: boolean;
  workspaceКомандаId?: string | null;
  runtimeServiceId?: string | null;
  serviceIndex?: number | null;
  disabledReason?: string | null;
};

export type Рабочая областьЗапуститьtimeControlSections = {
  services: Рабочая областьЗапуститьtimeControlItem[];
  jobs: Рабочая областьЗапуститьtimeControlItem[];
  otherServices: Рабочая областьЗапуститьtimeControlItem[];
};

type LegacyРабочая областьЗапуститьtimeControlItem = Рабочая областьЗапуститьtimeControlItem & {
  status?: string | null;
};

type Рабочая областьЗапуститьtimeControlsProps = {
  sections: Рабочая областьЗапуститьtimeControlSections;
  items?: never;
  isОжидание?: boolean;
  pendingRequest?: Рабочая областьЗапуститьtimeControlRequest | null;
  serviceEmptyMessage?: string;
  jobEmptyMessage?: string;
  emptyMessage?: never;
  disabledHint?: string | null;
  onAction: (request: Рабочая областьЗапуститьtimeControlRequest) => void;
  classИмя?: string;
  square?: boolean;
} | {
  sections?: never;
  items: LegacyРабочая областьЗапуститьtimeControlItem[];
  isОжидание?: boolean;
  pendingRequest?: Рабочая областьЗапуститьtimeControlRequest | null;
  serviceEmptyMessage?: never;
  jobEmptyMessage?: never;
  emptyMessage?: string;
  disabledHint?: string | null;
  onAction: (request: Рабочая областьЗапуститьtimeControlRequest) => void;
  classИмя?: string;
  square?: boolean;
};

export function hasВыполняетсяЗапуститьtimeServices(
  runtimeServices: Array<{ status: string }> | null | undefined,
) {
  return (runtimeServices ?? []).some((service) => service.status === "starting" || service.status === "running");
}

function buildServiceItem(
  command: Рабочая областьКомандаDefinition,
  runtimeService: Рабочая областьЗапуститьtimeService | null,
  canНачатьServices: boolean,
): Рабочая областьЗапуститьtimeControlItem {
  return {
    key: `command:${command.id}:${runtimeService?.id ?? "idle"}`,
    title: command.name,
    kind: "service",
    statusLabel: runtimeService?.status ?? "stopped",
    lifecycle: runtimeService?.lifecycle ?? command.lifecycle,
    healthСтатус: runtimeService?.healthСтатус ?? "unknown",
    command: runtimeService?.command ?? command.command,
    cwd: runtimeService?.cwd ?? command.cwd,
    port: runtimeService?.port ?? null,
    url: runtimeService?.url ?? null,
    canНачать: canНачатьServices && !command.disabledReason,
    canЗапустить: false,
    workspaceКомандаId: command.id,
    runtimeServiceId: runtimeService?.id ?? null,
    serviceIndex: command.serviceIndex,
    disabledReason: command.disabledReason,
  };
}

function buildJobItem(
  command: Рабочая областьКомандаDefinition,
  canЗапуститьJobs: boolean,
): Рабочая областьЗапуститьtimeControlItem {
  return {
    key: `command:${command.id}`,
    title: command.name,
    kind: "job",
    statusLabel: "run once",
    lifecycle: null,
    healthСтатус: null,
    command: command.command,
    cwd: command.cwd,
    port: null,
    url: null,
    canНачать: false,
    canЗапустить: canЗапуститьJobs && !command.disabledReason && Boolean(command.command),
    workspaceКомандаId: command.id,
    runtimeServiceId: null,
    serviceIndex: null,
    disabledReason: command.disabledReason ?? (!command.command ? "This job is missing a command." : null),
  };
}

export function buildРабочая областьЗапуститьtimeControlSections(input: {
  runtimeConfig: Record<string, unknown> | null | undefined;
  runtimeServices: Рабочая областьЗапуститьtimeService[] | null | undefined;
  canНачатьServices: boolean;
  canЗапуститьJobs?: boolean;
}): Рабочая областьЗапуститьtimeControlSections {
  const commands = listРабочая областьКомандаDefinitions(input.runtimeConfig);
  const runtimeServices = [...(input.runtimeServices ?? [])];
  const matchedЗапуститьtimeServiceIds = new Set<string>();
  const services: Рабочая областьЗапуститьtimeControlItem[] = [];
  const jobs: Рабочая областьЗапуститьtimeControlItem[] = [];

  for (const command of commands) {
    if (command.kind === "job") {
      jobs.push(buildJobItem(command, input.canЗапуститьJobs ?? input.canНачатьServices));
      continue;
    }

    const runtimeService = matchРабочая областьЗапуститьtimeServiceToКоманда(command, runtimeServices);
    if (runtimeService) matchedЗапуститьtimeServiceIds.add(runtimeService.id);
    services.push(buildServiceItem(command, runtimeService, input.canНачатьServices));
  }

  const otherServices = runtimeServices
    .filter((runtimeService) =>
      !matchedЗапуститьtimeServiceIds.has(runtimeService.id)
      && (runtimeService.status === "starting" || runtimeService.status === "running"))
    .map((runtimeService) => ({
      key: `runtime:${runtimeService.id}`,
      title: runtimeService.serviceИмя,
      kind: "service" as const,
      statusLabel: runtimeService.status,
      lifecycle: runtimeService.lifecycle,
      healthСтатус: runtimeService.healthСтатус,
      command: runtimeService.command ?? null,
      cwd: runtimeService.cwd ?? null,
      port: runtimeService.port ?? null,
      url: runtimeService.url ?? null,
      canНачать: false,
      canЗапустить: false,
      workspaceКомандаId: null,
      runtimeServiceId: runtimeService.id,
      serviceIndex: runtimeService.configIndex ?? null,
      disabledReason: "This runtime service no longer matches a configured workspace command.",
    }));

  return {
    services,
    jobs,
    otherServices,
  };
}

export function buildРабочая областьЗапуститьtimeControlItems(input: {
  runtimeConfig: Record<string, unknown> | null | undefined;
  runtimeServices: Рабочая областьЗапуститьtimeService[] | null | undefined;
  canНачатьServices: boolean;
  canЗапуститьJobs?: boolean;
}): LegacyРабочая областьЗапуститьtimeControlItem[] {
  return buildРабочая областьЗапуститьtimeControlSections(input).services.map((item) => ({
    ...item,
    status: item.statusLabel,
  }));
}

export function getВыполняетсяЗапуститьtimeServiceUrl(
  sections: Рабочая областьЗапуститьtimeControlSections,
) {
  const runningService = [...sections.services, ...sections.otherServices].find(
    (item) => (item.statusLabel === "running" || item.statusLabel === "starting") && item.url,
  );
  return runningService?.url ?? null;
}

function requestMatchesОжидание(
  pendingRequest: Рабочая областьЗапуститьtimeControlRequest | null | undefined,
  nextRequest: Рабочая областьЗапуститьtimeControlRequest,
) {
  return pendingRequest?.action === nextRequest.action
    && (pendingRequest?.workspaceКомандаId ?? null) === (nextRequest.workspaceКомандаId ?? null)
    && (pendingRequest?.runtimeServiceId ?? null) === (nextRequest.runtimeServiceId ?? null)
    && (pendingRequest?.serviceIndex ?? null) === (nextRequest.serviceIndex ?? null);
}

function buildRequest(item: Рабочая областьЗапуститьtimeControlItem, action: Рабочая областьЗапуститьtimeAction): Рабочая областьЗапуститьtimeControlRequest {
  return {
    action,
    workspaceКомандаId: item.workspaceКомандаId ?? null,
    runtimeServiceId: item.runtimeServiceId ?? null,
    serviceIndex: item.serviceIndex ?? null,
  };
}

function КомандаActionButtons({
  item,
  isОжидание,
  pendingRequest,
  onAction,
  square,
}: {
  item: Рабочая областьЗапуститьtimeControlItem;
  isОжидание: boolean;
  pendingRequest: Рабочая областьЗапуститьtimeControlRequest | null | undefined;
  onAction: (request: Рабочая областьЗапуститьtimeControlRequest) => void;
  square?: boolean;
}) {
  const actions: Рабочая областьЗапуститьtimeAction[] =
    item.kind === "job"
      ? ["run"]
      : item.statusLabel === "running" || item.statusLabel === "starting"
        ? ["stop", ...(item.canНачать ? ["restart" as const] : [])]
        : ["start"];

  return (
    <div classИмя="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
      {actions.map((action) => {
        const request = buildRequest(item, action);
        const Icon = action === "stop" ? Square : action === "restart" ? RotateCcw : Play;
        const label = action === "run"
          ? "Запустить"
          : action === "start"
            ? "Начать"
            : action === "stop"
              ? "Остановить"
              : "Перезапустить";
        const showSpinner = isОжидание && requestMatchesОжидание(pendingRequest, request);
        const disabled =
          isОжидание
          || (action === "run" && !item.canЗапустить)
          || ((action === "start" || action === "restart") && !item.canНачать);

        return (
          <Button
            key={`${item.key}:${action}`}
            variant={action === "stop" ? "destructive" : action === "restart" ? "outline" : "default"}
            size="sm"
            classИмя={cn(
              "w-full justify-start sm:w-auto",
              square ? "rounded-none" : null,
            )}
            disabled={disabled}
            onClick={() => onAction(request)}
          >
            {showSpinner ? <Loader2 classИмя="h-4 w-4 animate-spin" /> : <Icon classИмя="h-4 w-4" />}
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function КомандаSection({
  title,
  description,
  items,
  emptyMessage,
  disabledHint,
  isОжидание,
  pendingRequest,
  onAction,
  square,
}: {
  title: string;
  description: string;
  items: Рабочая областьЗапуститьtimeControlItem[];
  emptyMessage: string;
  disabledHint?: string | null;
  isОжидание: boolean;
  pendingRequest: Рабочая областьЗапуститьtimeControlRequest | null | undefined;
  onAction: (request: Рабочая областьЗапуститьtimeControlRequest) => void;
  square?: boolean;
}) {
  return (
    <div classИмя="space-y-3">
      <div classИмя="space-y-1">
        <div classИмя="text-sm font-medium">{title}</div>
        <p classИмя="text-xs text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <div classИмя={cn("border border-dashed border-border/80 bg-background px-3 py-4 text-sm text-muted-foreground", square ? "rounded-none" : "rounded-xl")}>
          {emptyMessage}
          {disabledHint ? <p classИмя="mt-2 text-xs">{disabledHint}</p> : null}
        </div>
      ) : (
        <div classИмя="space-y-3">
          {items.map((item) => (
            <div key={item.key} classИмя={cn("border border-border/80 bg-background px-3 py-3", square ? "rounded-none" : "rounded-xl")}>
              <div classИмя="flex flex-col gap-3">
                <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div classИмя="space-y-1">
                    <div classИмя="text-sm font-medium">{item.title}</div>
                    <div classИмя="text-xs text-muted-foreground">
                      {item.kind} · {item.statusLabel}
                      {item.lifecycle ? ` · ${item.lifecycle}` : ""}
                    </div>
                  </div>
                  <КомандаActionButtons
                    item={item}
                    isОжидание={isОжидание}
                    pendingRequest={pendingRequest}
                    onAction={onAction}
                    square={square}
                  />
                </div>
                <div classИмя="space-y-1 text-xs text-muted-foreground">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" classИмя="inline-flex items-center gap-1 hover:underline">
                      {item.url}
                      <ExternalLink classИмя="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {item.port ? <div>Порт {item.port}</div> : null}
                  {item.command ? <div classИмя="break-all font-mono">{item.command}</div> : null}
                  {item.cwd ? <div classИмя="break-all font-mono">{item.cwd}</div> : null}
                  {item.disabledReason ? <div>{item.disabledReason}</div> : null}
                </div>
                {item.healthСтатус && item.statusLabel !== "stopped" ? (
                  <div classИмя="flex items-center gap-2">
                    <span classИмя={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
                      item.healthСтатус === "healthy"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : item.healthСтатус === "unhealthy"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-border text-muted-foreground",
                    )}>
                      {item.healthСтатус}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Рабочая областьЗапуститьtimeControls({
  sections,
  items,
  isОжидание = false,
  pendingRequest = null,
  serviceEmptyMessage = "Нет services are configured for this workspace.",
  jobEmptyMessage = "Нет one-shot jobs are configured for this workspace.",
  emptyMessage,
  disabledHint = null,
  onAction,
  classИмя,
  square,
}: Рабочая областьЗапуститьtimeControlsProps) {
  const resolvedSections = sections ?? {
    services: (items ?? []).map((item) => ({
      ...item,
      statusLabel: item.statusLabel ?? item.status ?? "stopped",
    })),
    jobs: [],
    otherServices: [],
  };
  const resolvedServiceEmptyMessage = emptyMessage ?? serviceEmptyMessage;
  const runningCount = [...resolvedSections.services, ...resolvedSections.otherServices].filter(
    (item) => item.statusLabel === "running" || item.statusLabel === "starting",
  ).length;
  const visibleОтключитьdHint = runningCount > 0 || disabledHint === null ? null : disabledHint;

  return (
    <div classИмя={cn("space-y-4", classИмя)}>
      <div classИмя={cn("border border-border/70 bg-background p-3", square ? "rounded-none" : "rounded-xl")}>
        <div classИмя="space-y-1">
          <div classИмя="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Рабочая область commands</div>
          <div classИмя="flex flex-wrap items-center gap-2">
            <span
              classИмя={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                runningCount > 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              <Активность classИмя="h-3.5 w-3.5" />
              {runningCount > 0 ? `${runningCount} services running` : "Нет services running"}
            </span>
            <span classИмя="text-xs text-muted-foreground">
              {resolvedSections.jobs.length > 0
                ? `${resolvedSections.jobs.length} job${resolvedSections.jobs.length === 1 ? "" : "s"} available to run on demand.`
                : "Each command can be controlled independently."}
            </span>
          </div>
          {visibleОтключитьdHint ? <p classИмя="text-xs text-muted-foreground">{visibleОтключитьdHint}</p> : null}
        </div>
      </div>

      <КомандаSection
        title="Services"
        description="Long-running commands that Paperclip can supervise for this workspace."
        items={resolvedSections.services}
        emptyMessage={resolvedServiceEmptyMessage}
        disabledHint={visibleОтключитьdHint}
        isОжидание={isОжидание}
        pendingRequest={pendingRequest}
        onAction={onAction}
        square={square}
      />

      <КомандаSection
        title="Jobs"
        description="One-shot commands that run now and exit when they finish."
        items={resolvedSections.jobs}
        emptyMessage={jobEmptyMessage}
        isОжидание={isОжидание}
        pendingRequest={pendingRequest}
        onAction={onAction}
        square={square}
      />

      {resolvedSections.otherServices.length > 0 ? (
        <КомандаSection
          title="Untracked services"
          description="Выполняется services that no longer match the current workspace command config."
          items={resolvedSections.otherServices}
          emptyMessage=""
          isОжидание={isОжидание}
          pendingRequest={pendingRequest}
          onAction={onAction}
          square={square}
        />
      ) : null}
    </div>
  );
}

export function Рабочая областьЗапуститьtimeQuickControls({
  sections,
  isОжидание = false,
  pendingRequest = null,
  onAction,
  square,
}: {
  sections: Рабочая областьЗапуститьtimeControlSections;
  isОжидание?: boolean;
  pendingRequest?: Рабочая областьЗапуститьtimeControlRequest | null;
  onAction: (request: Рабочая областьЗапуститьtimeControlRequest) => void;
  square?: boolean;
}) {
  const controlItems = sections.services.length > 0 ? sections.services : sections.otherServices;
  const serviceUrl = getВыполняетсяЗапуститьtimeServiceUrl(sections);

  if (controlItems.length === 0 && !serviceUrl) return null;

  return (
    <div classИмя="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      {controlItems.length > 0 ? (
        <div classИмя="flex max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {controlItems.map((item) => (
            <div key={item.key} classИмя="flex min-w-0 flex-col gap-1 sm:items-end">
              {controlItems.length > 1 ? (
                <span classИмя="truncate text-xs text-muted-foreground">{item.title}</span>
              ) : null}
              <КомандаActionButtons
                item={item}
                isОжидание={isОжидание}
                pendingRequest={pendingRequest}
                onAction={onAction}
                square={square}
              />
            </div>
          ))}
        </div>
      ) : null}
      {serviceUrl ? (
        <a
          href={serviceUrl}
          target="_blank"
          rel="noreferrer"
          classИмя="inline-flex min-w-0 items-center gap-1 self-start break-all text-xs text-muted-foreground hover:text-foreground hover:underline sm:self-end"
        >
          {serviceUrl}
          <ExternalLink classИмя="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : null}
    </div>
  );
}
