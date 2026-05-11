/**
 * @fileoverview Адаптер Manager page — install, view, and manage external adapters.
 *
 * Адаптеры are simpler than plugins: no workers, no events, no manifests.
 * They just register a ServerАдаптерModule that provides model discovery and execution.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Cpu, Plus, Power, Trash2, ПапкаOpen, Package, ОбновитьCw, Скачать } from "lucide-react";
import { useКомпания } from "@/context/КомпанияContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { adaptersApi } from "@/api/adapters";
import type { АдаптерInfo } from "@/api/adapters";
import { getАдаптерLabel } from "@/adapters/adapter-display-registry";
import { queryКлючs } from "@/lib/queryКлючs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToastActions } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { ChooseПутьButton } from "@/components/ПутьInstructionsModal";
import { invalidateDynamicParser } from "@/adapters/dynamic-loader";
import { invalidateConfigSchemaCache } from "@/adapters/schema-config-fields";

function АдаптерRow({
  adapter,
  canУдалить,
  onToggle,
  onУдалить,
  onReload,
  onReinstall,
  isToggling,
  isReloading,
  isReinstalling,
  overriddenBy,
  /** Свой tooltip for the power button when adapter is enabled. */
  toggleНазваниеВключитьd,
  /** Свой tooltip for the power button when adapter is disabled. */
  toggleНазваниеОтключитьd,
  /** Свой label for the disabled badge (defaults to "Hidden from menus"). */
  disabledBadgeLabel,
}: {
  adapter: АдаптерInfo;
  canУдалить: boolean;
  onToggle: (type: string, disabled: boolean) => void;
  onУдалить: (type: string) => void;
  onReload?: (type: string) => void;
  onReinstall?: (type: string) => void;
  isToggling: boolean;
  isReloading?: boolean;
  isReinstalling?: boolean;
  /** When set, shows an "Overridden by …" badge (used for builtin entries). */
  overriddenBy?: string;
  toggleНазваниеВключитьd?: string;
  toggleНазваниеОтключитьd?: string;
  disabledBadgeLabel?: string;
}) {
  return (
    <li>
      <div classИмя="flex items-center gap-4 px-4 py-3">
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex flex-wrap items-center gap-2">
            <span classИмя={cn("font-medium", adapter.disabled && "text-muted-foreground line-through")}>
              {adapter.label || getАдаптерLabel(adapter.type)}
            </span>
            <Badge variant="outline">{adapter.source === "external" ? "External" : "Built-in"}</Badge>
            {adapter.source === "external" && (
              adapter.isLocalПуть
                ? <span title="Installed from local path"><ПапкаOpen classИмя="h-4 w-4 text-amber-500" /></span>
                : <span title="Installed from npm"><Package classИмя="h-4 w-4 text-red-500" /></span>
            )}
            {adapter.version && (
              <Badge variant="secondary" classИмя="font-mono text-[10px]">
                v{adapter.version}
              </Badge>
            )}
            {adapter.overriddenBuiltin && (
              <Badge variant="secondary" classИмя="text-blue-600 border-blue-400">
                Overrides built-in
              </Badge>
            )}
            {overriddenBy && (
              <Badge variant="secondary" classИмя="text-blue-600 border-blue-400">
                Overridden by {overriddenBy}
              </Badge>
            )}
            {adapter.disabled && (
              <Badge variant="secondary" classИмя="text-amber-600 border-amber-400">
                {disabledBadgeLabel ?? "Hidden from menus"}
              </Badge>
            )}
          </div>
          <p classИмя="text-xs text-muted-foreground mt-0.5">
            {adapter.type}
            {adapter.packageИмя && adapter.packageИмя !== adapter.type && (
              <> · {adapter.packageИмя}</>
            )}
            {" · "}{adapter.modelsCount} models
          </p>
        </div>
        <div classИмя="flex items-center gap-2 shrink-0">
          {onReinstall && (
            <Button
              variant="outline"
              size="icon-sm"
              classИмя="h-8 w-8"
              title="Reinstall adapter (pull latest from npm)"
              disabled={isReinstalling}
              onClick={() => onReinstall(adapter.type)}
            >
              <Скачать classИмя={cn("h-4 w-4", isReinstalling && "animate-bounce")} />
            </Button>
          )}
          {onReload && (
            <Button
              variant="outline"
              size="icon-sm"
              classИмя="h-8 w-8"
              title="Reload adapter (hot-swap)"
              disabled={isReloading}
              onClick={() => onReload(adapter.type)}
            >
              <ОбновитьCw classИмя={cn("h-4 w-4", isReloading && "animate-spin")} />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            classИмя="h-8 w-8"
            title={adapter.disabled
              ? (toggleНазваниеВключитьd ?? "Show in agent menus")
              : (toggleНазваниеОтключитьd ?? "Hide from agent menus")}
            disabled={isToggling}
            onClick={() => onToggle(adapter.type, !adapter.disabled)}
          >
            <Power classИмя={cn("h-4 w-4", !adapter.disabled ? "text-green-600" : "text-muted-foreground")} />
          </Button>
          {canУдалить && (
            <Button
              variant="outline"
              size="icon-sm"
              classИмя="h-8 w-8 text-destructive hover:text-destructive"
              title="Удалить adapter"
              onClick={() => onУдалить(adapter.type)}
            >
              <Trash2 classИмя="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function fetchNpmLatestВерсия(packageИмя: string): Promise<string | null> {
  return fetch(`https://registry.npmjs.org/${encodeURIComponent(packageИмя)}/latest`, {
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => res.json())
    .then((data) => (typeof data?.version === "string" ? (data.version as string) : null))
    .catch(() => null);
}

function ReinstallDialog({
  adapter,
  open,
  isReinstalling,
  onПодтвердить,
  onОтмена,
}: {
  adapter: АдаптерInfo | null;
  open: boolean;
  isReinstalling: boolean;
  onПодтвердить: () => void;
  onОтмена: () => void;
}) {
  const { data: latestВерсия, isЗагрузка: isFetchingВерсия } = useQuery({
    queryКлюч: ["npm-latest-version", adapter?.packageИмя],
    queryFn: () => {
      if (!adapter?.packageИмя) return null;
      return fetchNpmLatestВерсия(adapter.packageИмя);
    },
    enabled: open && !!adapter?.packageИмя,
    staleTime: 60_000,
  });

  const isUpToDate = adapter?.version && latestВерсия && adapter.version === latestВерсия;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onОтмена(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogНазвание>Reinstall Адаптер</DialogНазвание>
          <DialogОписание>
            This will pull the latest version of{" "}
            <strong>{adapter?.packageИмя}</strong> from npm and hot-swap
            the running adapter module. Existing agents will use the new
            version on their next run.
          </DialogОписание>
        </DialogHeader>

        <div classИмя="rounded-md border bg-muted/50 px-4 py-3 text-sm space-y-1">
          <div classИмя="flex items-center justify-between">
            <span classИмя="text-muted-foreground">Package</span>
            <span classИмя="font-mono">{adapter?.packageИмя}</span>
          </div>
          <div classИмя="flex items-center justify-between">
            <span classИмя="text-muted-foreground">Current</span>
            <span classИмя="font-mono">
              {adapter?.version ? `v${adapter.version}` : "unknown"}
            </span>
          </div>
          <div classИмя="flex items-center justify-between">
            <span classИмя="text-muted-foreground">Latest on npm</span>
            <span classИмя="font-mono">
              {isFetchingВерсия
                ? "checking..."
                : latestВерсия
                  ? `v${latestВерсия}`
                  : "unavailable"}
            </span>
          </div>
          {isUpToDate && (
            <p classИмя="text-xs text-muted-foreground pt-1">
              Already on the latest version.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onОтмена} disabled={isReinstalling}>
            Отмена
          </Button>
          <Button disabled={isReinstalling} onClick={onПодтвердить}>
            {isReinstalling ? "Reinstalling..." : "Reinstall"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function АдаптерManager() {
  const { selectedКомпания } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();

  const [installPackage, setInstallPackage] = useState("");
  const [installВерсия, setInstallВерсия] = useState("");
  const [isLocalПуть, setIsLocalПуть] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [removeТип, setУдалитьТип] = useState<string | null>(null);
  const [reinstallЦель, setReinstallЦель] = useState<АдаптерInfo | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/instance/settings/general" },
      { label: "Адаптеры" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const { data: adapters, isЗагрузка } = useQuery({
    queryКлюч: queryКлючs.adapters.all,
    queryFn: () => adaptersApi.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.adapters.all });
  };

  const installMutation = useMutation({
    mutationFn: (params: { packageИмя: string; version?: string; isLocalПуть?: boolean }) =>
      adaptersApi.install(params),
    onУспешно: (result) => {
      invalidate();
      setInstallDialogOpen(false);
      setInstallPackage("");
      setInstallВерсия("");
      setIsLocalПуть(false);
      pushToast({
        title: "Адаптер installed",
        body: `Тип "${result.type}" registered successfully.${result.version ? ` (v${result.version})` : ""}`,
        tone: "success",
      });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Install failed", body: err.message, tone: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.remove(type),
    onУспешно: () => {
      invalidate();
      pushToast({ title: "Адаптер removed", tone: "success" });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Removal failed", body: err.message, tone: "error" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ type, disabled }: { type: string; disabled: boolean }) =>
      adaptersApi.setОтключитьd(type, disabled),
    onУспешно: () => {
      invalidate();
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Toggle failed", body: err.message, tone: "error" });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ type, paused }: { type: string; paused: boolean }) =>
      adaptersApi.setOverrideПриостановлен(type, paused),
    onУспешно: () => {
      invalidate();
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Override toggle failed", body: err.message, tone: "error" });
    },
  });

  const reloadMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.reload(type),
    onУспешно: (result) => {
      invalidate();
      invalidateDynamicParser(result.type);
      invalidateConfigSchemaCache(result.type);
      pushToast({
        title: "Адаптер reloaded",
        body: `Тип "${result.type}" reloaded.${result.version ? ` (v${result.version})` : ""}`,
        tone: "success",
      });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Reload failed", body: err.message, tone: "error" });
    },
  });

  const reinstallMutation = useMutation({
    mutationFn: (type: string) => adaptersApi.reinstall(type),
    onУспешно: (result) => {
      invalidate();
      invalidateDynamicParser(result.type);
      invalidateConfigSchemaCache(result.type);
      pushToast({
        title: "Адаптер reinstalled",
        body: `Тип "${result.type}" updated from npm.${result.version ? ` (v${result.version})` : ""}`,
        tone: "success",
      });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Reinstall failed", body: err.message, tone: "error" });
    },
  });

  const builtinАдаптеры = (adapters ?? []).filter((a) => a.source === "builtin");
  const externalАдаптеры = (adapters ?? []).filter((a) => a.source === "external");

  // External adapters that override a builtin type.  The server only returns
  // one entry per type (the external), so we synthesize a builtin row for
  // the builtins section so users can see which builtins are affected.
  const overriddenBuiltins = (adapters ?? [])
    .filter((a) => a.source === "external" && a.overriddenBuiltin)
    .filter((a) => !builtinАдаптеры.some((b) => b.type === a.type))
    .map((a) => ({
      type: a.type,
      label: getАдаптерLabel(a.type),
      overriddenBy: [
        a.packageИмя,
        a.version ? `v${a.version}` : undefined,
      ].filter(Boolean).join(" "),
      overrideПриостановлен: !!a.overrideПриостановлен,
      menuОтключитьd: !!a.disabled,
    }));

  if (isЗагрузка) return <div classИмя="p-4 text-sm text-muted-foreground">Загрузка adapters...</div>;

  const isMutating = installMutation.isОжидание || removeMutation.isОжидание || toggleMutation.isОжидание || overrideMutation.isОжидание || reloadMutation.isОжидание || reinstallMutation.isОжидание;

  return (
    <div classИмя="space-y-6 max-w-5xl">
      {/* Header */}
      <div classИмя="flex items-center justify-between">
        <div classИмя="flex items-center gap-2">
          <Cpu classИмя="h-6 w-6 text-muted-foreground" />
          <h1 classИмя="text-xl font-semibold">Адаптеры</h1>
          <Badge variant="outline" classИмя="text-amber-600 border-amber-400">
            Alpha
          </Badge>
        </div>

        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" classИмя="gap-2">
              <Plus classИмя="h-4 w-4" />
              Install Адаптер
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogНазвание>Install External Адаптер</DialogНазвание>
              <DialogОписание>
                Добавить an adapter from npm or a local path. The adapter package must export <code classИмя="text-xs bg-muted px-1 py-0.5 rounded">createServerАдаптер()</code>.
              </DialogОписание>
            </DialogHeader>
            <div classИмя="grid gap-4 py-4">
              {/* Source toggle */}
              <div classИмя="flex items-center gap-2">
                <button
                  type="button"
                  classИмя={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    !isLocalПуть
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setIsLocalПуть(false)}
                >
                  <Package classИмя="h-3.5 w-3.5" />
                  npm package
                </button>
                <button
                  type="button"
                  classИмя={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    isLocalПуть
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setIsLocalПуть(true)}
                >
                  <ПапкаOpen classИмя="h-3.5 w-3.5" />
                  Local path
                </button>
              </div>

              {isLocalПуть ? (
                /* Local path input */
                <div classИмя="grid gap-2">
                  <Label htmlFor="adapterLocalПуть">Путь to adapter package</Label>
                  <div classИмя="flex gap-2">
                    <Input
                      id="adapterLocalПуть"
                      classИмя="flex-1 font-mono text-xs"
                      placeholder="/mnt/e/Проекты/my-adapter  or  E:\Проекты\my-adapter"
                      value={installPackage}
                      onChange={(e) => setInstallPackage(e.target.value)}
                    />
                    <ChooseПутьButton />
                  </div>
                  <p classИмя="text-xs text-muted-foreground">
                    Принятьs Linux, WSL, and Windows paths. Windows paths are auto-converted.
                  </p>
                </div>
              ) : (
                /* npm package input */
                <>
                  <div classИмя="grid gap-2">
                    <Label htmlFor="adapterPackageИмя">Package Имя</Label>
                    <Input
                      id="adapterPackageИмя"
                      placeholder="my-paperclip-adapter"
                      value={installPackage}
                      onChange={(e) => setInstallPackage(e.target.value)}
                    />
                  </div>
                  <div classИмя="grid gap-2">
                    <Label htmlFor="adapterВерсия">Версия (optional)</Label>
                    <Input
                      id="adapterВерсия"
                      placeholder="latest"
                      value={installВерсия}
                      onChange={(e) => setInstallВерсия(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>Отмена</Button>
              <Button
                onClick={() =>
                  installMutation.mutate({
                    packageИмя: installPackage,
                    version: installВерсия || undefined,
                    isLocalПуть,
                  })
                }
                disabled={!installPackage || installMutation.isОжидание}
              >
                {installMutation.isОжидание ? "Installing..." : "Install"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alpha notice */}
      <div classИмя="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div classИмя="flex items-start gap-3">
          <AlertTriangle classИмя="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div classИмя="space-y-1 text-sm">
            <p classИмя="font-medium text-foreground">External adapters are alpha.</p>
            <p classИмя="text-muted-foreground">
              The adapter plugin system is under active development. APIs and storage format may change.
              Use the power icon to hide adapters from agent menus without removing them.
            </p>
          </div>
        </div>
      </div>

      {/* External adapters */}
      <section classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <Cpu classИмя="h-5 w-5 text-muted-foreground" />
          <h2 classИмя="text-base font-semibold">External Адаптеры</h2>
        </div>

        {externalАдаптеры.length === 0 ? (
          <Card classИмя="bg-muted/30">
            <CardContent classИмя="flex flex-col items-center justify-center py-10">
              <Cpu classИмя="h-10 w-10 text-muted-foreground mb-4" />
              <p classИмя="text-sm font-medium">Нет external adapters installed</p>
              <p classИмя="text-xs text-muted-foreground mt-1">
                Install an adapter package to extend model support.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul classИмя="divide-y rounded-md border bg-card">
            {externalАдаптеры.map((adapter) => {
              const isBuiltinOverride = adapter.overriddenBuiltin;
              const overrideПриостановлен = isBuiltinOverride && !!adapter.overrideПриостановлен;

              // For overridden builtins, the power button controls the
              // override pause state (not server menu visibility).
              const effectiveАдаптер: АдаптерInfo = isBuiltinOverride
                ? { ...adapter, disabled: overrideПриостановлен ?? false }
                : adapter;

              return (
                <АдаптерRow
                  key={adapter.type}
                  adapter={effectiveАдаптер}
                  canУдалить={true}
                  onToggle={
                    isBuiltinOverride
                      ? (type, disabled) => overrideMutation.mutate({ type, paused: disabled })
                      : (type, disabled) => toggleMutation.mutate({ type, disabled })
                  }
                  onУдалить={(type) => setУдалитьТип(type)}
                  onReload={(type) => reloadMutation.mutate(type)}
                  onReinstall={!adapter.isLocalПуть ? (type) => setReinstallЦель(adapter) : undefined}
                  isToggling={isBuiltinOverride ? overrideMutation.isОжидание : toggleMutation.isОжидание}
                  isReloading={reloadMutation.isОжидание}
                  isReinstalling={reinstallMutation.isОжидание}
                  toggleНазваниеОтключитьd={isBuiltinOverride ? "Пауза external override" : undefined}
                  toggleНазваниеВключитьd={isBuiltinOverride ? "Продолжить external override" : undefined}
                  disabledBadgeLabel={isBuiltinOverride ? "Override paused" : undefined}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Built-in adapters */}
      <section classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <Cpu classИмя="h-5 w-5 text-muted-foreground" />
          <h2 classИмя="text-base font-semibold">Built-in Адаптеры</h2>
        </div>

        {builtinАдаптеры.length === 0 && overriddenBuiltins.length === 0 ? (
          <div classИмя="text-sm text-muted-foreground">Нет built-in adapters found.</div>
        ) : (
          <ul classИмя="divide-y rounded-md border bg-card">
            {builtinАдаптеры.map((adapter) => (
              <АдаптерRow
                key={adapter.type}
                adapter={adapter}
                canУдалить={false}
                onToggle={(type, disabled) => toggleMutation.mutate({ type, disabled })}
                onУдалить={() => {}}
                isToggling={isMutating}
              />
            ))}
            {overriddenBuiltins.map((virtual) => (
              <АдаптерRow
                key={virtual.type}
                adapter={{
                  type: virtual.type,
                  label: virtual.label,
                  source: "builtin",
                  modelsCount: 0,
                  loaded: true,
                  disabled: virtual.menuОтключитьd,
                  capabilities: {
                    supportsInstructionsBundle: false,
                    supportsНавыки: false,
                    supportsLocalАгентJwt: false,
                    requiresMaterializedЗапуститьtimeНавыки: false,
                    supportsМодельПрофильs: false,
                  },
                }}
                canУдалить={false}
                onToggle={(type, disabled) => toggleMutation.mutate({ type, disabled })}
                onУдалить={() => {}}
                isToggling={isMutating}
                overriddenBy={virtual.overrideПриостановлен ? undefined : virtual.overriddenBy}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Удалить confirmation */}
      <Dialog
        open={removeТип !== null}
        onOpenChange={(open) => { if (!open) setУдалитьТип(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogНазвание>Удалить Адаптер</DialogНазвание>
            <DialogОписание>
              Are you sure you want to remove the <strong>{removeТип}</strong> adapter?
              It will be unregistered and removed from the adapter store.
              {removeТип && adapters?.find((a) => a.type === removeТип)?.packageИмя && (
                <> npm packages will be cleaned up from disk.</>
              )}
              {" "}This action cannot be undone.
            </DialogОписание>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setУдалитьТип(null)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isОжидание}
              onClick={() => {
                if (removeТип) {
                  removeMutation.mutate(removeТип, {
                    onSettled: () => setУдалитьТип(null),
                  });
                }
              }}
            >
              {removeMutation.isОжидание ? "Removing..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reinstall confirmation */}
      <ReinstallDialog
        adapter={reinstallЦель}
        open={reinstallЦель !== null}
        isReinstalling={reinstallMutation.isОжидание}
        onПодтвердить={() => {
          if (reinstallЦель) {
            reinstallMutation.mutate(reinstallЦель.type, {
              onSettled: () => setReinstallЦель(null),
            });
          }
        }}
        onОтмена={() => setReinstallЦель(null)}
      />
    </div>
  );
}
