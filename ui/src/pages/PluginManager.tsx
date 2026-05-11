/**
 * @fileoverview Plugin Manager page — admin UI for discovering,
 * installing, enabling/disabling, and uninstalling plugins.
 *
 * @see PLUGIN_SPEC.md §9 — Plugin Marketplace / Manager
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PluginRecord } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { AlertTriangle, FlaskConical, Plus, Power, Puzzle, Настройки, Trash } from "lucide-react";
import { useКомпания } from "@/context/КомпанияContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { pluginsApi } from "@/api/plugins";
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

function firstНетnEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);
  return line ?? null;
}

function getPluginОшибкаSummary(plugin: PluginRecord): string {
  return firstНетnEmptyLine(plugin.lastОшибка) ?? "Plugin entered an error state without a stored error message.";
}

/**
 * PluginManager page component.
 *
 * Provides a management UI for the Paperclip plugin system:
 * - Lists all installed plugins with their status, version, and category badges.
 * - Всеows installing new plugins by npm package name.
 * - Provides per-plugin actions: enable, disable, navigate to settings.
 * - Uninstall with a two-step confirmation dialog to prevent accidental removal.
 *
 * Data flow:
 * - Reads from `GET /api/plugins` via `pluginsApi.list()`.
 * - Mutations (install / uninstall / enable / disable) invalidate
 *   `queryКлючs.plugins.all` so the list refreshes automatically.
 *
 * @see PluginНастройки — linked from the Настройки icon on each plugin row.
 * @see doc/plugins/PLUGIN_SPEC.md §3 — Plugin Lifecycle for status semantics.
 */
export function PluginManager() {
  const { selectedКомпания } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();

  const [installPackage, setInstallPackage] = useState("");
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [uninstallPluginId, setUninstallPluginId] = useState<string | null>(null);
  const [uninstallPluginИмя, setUninstallPluginИмя] = useState<string>("");
  const [errorДеталиPlugin, setОшибкаДеталиPlugin] = useState<PluginRecord | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/instance/settings/heartbeats" },
      { label: "Plugins" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const { data: plugins, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  const examplesQuery = useQuery({
    queryКлюч: queryКлючs.plugins.examples,
    queryFn: () => pluginsApi.listExamples(),
  });

  const invalidatePluginQueries = () => {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.plugins.all });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.plugins.examples });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.plugins.uiContributions });
  };

  const installMutation = useMutation({
    mutationFn: (params: { packageИмя: string; version?: string; isLocalПуть?: boolean }) =>
      pluginsApi.install(params),
    onУспешно: () => {
      invalidatePluginQueries();
      setInstallDialogOpen(false);
      setInstallPackage("");
      pushToast({ title: "Plugin installed successfully", tone: "success" });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Ошибка to install plugin", body: err.message, tone: "error" });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.uninstall(pluginId),
    onУспешно: () => {
      invalidatePluginQueries();
      pushToast({ title: "Plugin uninstalled successfully", tone: "success" });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Ошибка to uninstall plugin", body: err.message, tone: "error" });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.enable(pluginId),
    onУспешно: () => {
      invalidatePluginQueries();
      pushToast({ title: "Plugin enabled", tone: "success" });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Ошибка to enable plugin", body: err.message, tone: "error" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.disable(pluginId),
    onУспешно: () => {
      invalidatePluginQueries();
      pushToast({ title: "Plugin disabled", tone: "info" });
    },
    onОшибка: (err: Ошибка) => {
      pushToast({ title: "Ошибка to disable plugin", body: err.message, tone: "error" });
    },
  });

  const installedPlugins = plugins ?? [];
  const examples = examplesQuery.data ?? [];
  const installedByPackageИмя = new Map(installedPlugins.map((plugin) => [plugin.packageИмя, plugin]));
  const examplePackageИмяs = new Set(examples.map((example) => example.packageИмя));
  const errorSummaryByPluginId = useMemo(
    () =>
      new Map(
        installedPlugins.map((plugin) => [plugin.id, getPluginОшибкаSummary(plugin)])
      ),
    [installedPlugins]
  );

  if (isЗагрузка) return <div classИмя="p-4 text-sm text-muted-foreground">Загрузка plugins...</div>;
  if (error) return <div classИмя="p-4 text-sm text-destructive">Ошибка to load plugins.</div>;

  return (
    <div classИмя="space-y-6 max-w-5xl">
      <div classИмя="flex items-center justify-between">
        <div classИмя="flex items-center gap-2">
          <Puzzle classИмя="h-6 w-6 text-muted-foreground" />
          <h1 classИмя="text-xl font-semibold">Plugin Manager</h1>
        </div>
        
        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" classИмя="gap-2">
              <Plus classИмя="h-4 w-4" />
              Install Plugin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogНазвание>Install Plugin</DialogНазвание>
              <DialogОписание>
                Enter the npm package name of the plugin you wish to install.
              </DialogОписание>
            </DialogHeader>
            <div classИмя="grid gap-4 py-4">
              <div classИмя="grid gap-2">
                <Label htmlFor="packageИмя">npm Package Имя</Label>
                <Input
                  id="packageИмя"
                  placeholder="@paperclipai/plugin-example"
                  value={installPackage}
                  onChange={(e) => setInstallPackage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>Отмена</Button>
              <Button
                onClick={() => installMutation.mutate({ packageИмя: installPackage })}
                disabled={!installPackage || installMutation.isОжидание}
              >
                {installMutation.isОжидание ? "Installing..." : "Install"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div classИмя="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div classИмя="flex items-start gap-3">
          <AlertTriangle classИмя="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div classИмя="space-y-1 text-sm">
            <p classИмя="font-medium text-foreground">Plugins are alpha.</p>
            <p classИмя="text-muted-foreground">
              The plugin runtime and API surface are still changing. Expect breaking changes while this feature settles.
            </p>
          </div>
        </div>
      </div>

      <section classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <FlaskConical classИмя="h-5 w-5 text-muted-foreground" />
          <h2 classИмя="text-base font-semibold">Available Plugins</h2>
          <Badge variant="outline">Examples</Badge>
        </div>

        {examplesQuery.isЗагрузка ? (
          <div classИмя="text-sm text-muted-foreground">Загрузка bundled examples...</div>
        ) : examplesQuery.error ? (
          <div classИмя="text-sm text-destructive">Ошибка to load bundled examples.</div>
        ) : examples.length === 0 ? (
          <div classИмя="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Нет bundled example plugins were found in this checkout.
          </div>
        ) : (
          <ul classИмя="divide-y rounded-md border bg-card">
            {examples.map((example) => {
              const installedPlugin = installedByPackageИмя.get(example.packageИмя);
              const installОжидание =
                installMutation.isОжидание &&
                installMutation.variables?.isLocalПуть &&
                installMutation.variables.packageИмя === example.localПуть;

              return (
                <li key={example.packageИмя}>
                  <div classИмя="flex items-center gap-4 px-4 py-3">
                    <div classИмя="min-w-0 flex-1">
                      <div classИмя="flex flex-wrap items-center gap-2">
                        <span classИмя="font-medium">{example.displayИмя}</span>
                        <Badge variant="outline">Example</Badge>
                        {installedPlugin ? (
                          <Badge
                            variant={installedPlugin.status === "ready" ? "default" : "secondary"}
                            classИмя={installedPlugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {installedPlugin.status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Нетt installed</Badge>
                        )}
                      </div>
                      <p classИмя="mt-1 text-sm text-muted-foreground">{example.description}</p>
                      <p classИмя="mt-1 text-xs text-muted-foreground">{example.packageИмя}</p>
                    </div>
                    <div classИмя="flex items-center gap-2 shrink-0">
                      {installedPlugin ? (
                        <>
                          {installedPlugin.status !== "ready" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={enableMutation.isОжидание}
                              onClick={() => enableMutation.mutate(installedPlugin.id)}
                            >
                              Включить
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/instance/settings/plugins/${installedPlugin.id}`}>
                              {installedPlugin.status === "ready" ? "Open Настройки" : "Review"}
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={installОжидание || installMutation.isОжидание}
                          onClick={() =>
                            installMutation.mutate({
                              packageИмя: example.localПуть,
                              isLocalПуть: true,
                            })
                          }
                        >
                          {installОжидание ? "Installing..." : "Install Example"}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <Puzzle classИмя="h-5 w-5 text-muted-foreground" />
          <h2 classИмя="text-base font-semibold">Installed Plugins</h2>
        </div>

        {!installedPlugins.length ? (
          <Card classИмя="bg-muted/30">
            <CardContent classИмя="flex flex-col items-center justify-center py-10">
              <Puzzle classИмя="h-10 w-10 text-muted-foreground mb-4" />
              <p classИмя="text-sm font-medium">Нет plugins installed</p>
              <p classИмя="text-xs text-muted-foreground mt-1">
                Install a plugin to extend functionality.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul classИмя="divide-y rounded-md border bg-card">
            {installedPlugins.map((plugin) => (
              <li key={plugin.id}>
                <div classИмя="flex items-start gap-4 px-4 py-3">
                  <div classИмя="min-w-0 flex-1">
                    <div classИмя="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/instance/settings/plugins/${plugin.id}`}
                        classИмя="font-medium hover:underline truncate block"
                        title={plugin.manifestJson.displayИмя ?? plugin.packageИмя}
                      >
                        {plugin.manifestJson.displayИмя ?? plugin.packageИмя}
                      </Link>
                      {examplePackageИмяs.has(plugin.packageИмя) && (
                        <Badge variant="outline">Example</Badge>
                      )}
                    </div>
                    <div>
                      <p classИмя="text-xs text-muted-foreground mt-0.5 truncate" title={plugin.packageИмя}>
                        {plugin.packageИмя} · v{plugin.manifestJson.version ?? plugin.version}
                      </p>
                    </div>
                    <p classИмя="text-sm text-muted-foreground truncate mt-0.5" title={plugin.manifestJson.description}>
                      {plugin.manifestJson.description || "Нет описания provided."}
                    </p>
                    {plugin.status === "error" && (
                      <div classИмя="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                        <div classИмя="flex flex-wrap items-start gap-3">
                          <div classИмя="min-w-0 flex-1">
                            <div classИмя="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                              <AlertTriangle classИмя="h-4 w-4 shrink-0" />
                              <span>Plugin error</span>
                            </div>
                            <p
                              classИмя="mt-1 text-sm text-red-700/90 dark:text-red-200/90 break-words"
                              title={plugin.lastОшибка ?? undefined}
                            >
                              {errorSummaryByPluginId.get(plugin.id)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            classИмя="border-red-500/30 bg-background/60 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-200 dark:hover:text-red-100"
                            onClick={() => setОшибкаДеталиPlugin(plugin)}
                          >
                            View full error
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div classИмя="flex shrink-0 self-center">
                    <div classИмя="flex flex-col items-end gap-2">
                      <div classИмя="flex items-center gap-2">
                        <Badge
                          variant={
                            plugin.status === "ready"
                              ? "default"
                              : plugin.status === "error"
                                ? "destructive"
                              : "secondary"
                          }
                          classИмя={cn(
                            "shrink-0",
                            plugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""
                          )}
                        >
                          {plugin.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          classИмя="h-8 w-8"
                          title={plugin.status === "ready" ? "Отключить" : "Включить"}
                          onClick={() => {
                            if (plugin.status === "ready") {
                              disableMutation.mutate(plugin.id);
                            } else {
                              enableMutation.mutate(plugin.id);
                            }
                          }}
                          disabled={enableMutation.isОжидание || disableMutation.isОжидание}
                        >
                          <Power classИмя={cn("h-4 w-4", plugin.status === "ready" ? "text-green-600" : "")} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          classИмя="h-8 w-8 text-destructive hover:text-destructive"
                          title="Uninstall"
                          onClick={() => {
                            setUninstallPluginId(plugin.id);
                            setUninstallPluginИмя(plugin.manifestJson.displayИмя ?? plugin.packageИмя);
                          }}
                          disabled={uninstallMutation.isОжидание}
                        >
                          <Trash classИмя="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" classИмя="mt-2 h-8" asChild>
                        <Link to={`/instance/settings/plugins/${plugin.id}`}>
                          <Настройки classИмя="h-4 w-4" />
                          Configure
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={uninstallPluginId !== null}
        onOpenChange={(open) => { if (!open) setUninstallPluginId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogНазвание>Uninstall Plugin</DialogНазвание>
            <DialogОписание>
              Are you sure you want to uninstall <strong>{uninstallPluginИмя}</strong>? This action cannot be undone.
            </DialogОписание>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallPluginId(null)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={uninstallMutation.isОжидание}
              onClick={() => {
                if (uninstallPluginId) {
                  uninstallMutation.mutate(uninstallPluginId, {
                    onSettled: () => setUninstallPluginId(null),
                  });
                }
              }}
            >
              {uninstallMutation.isОжидание ? "Uninstalling..." : "Uninstall"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={errorДеталиPlugin !== null}
        onOpenChange={(open) => { if (!open) setОшибкаДеталиPlugin(null); }}
      >
        <DialogContent classИмя="sm:max-w-2xl">
          <DialogHeader>
            <DialogНазвание>Ошибка Детали</DialogНазвание>
            <DialogОписание>
              {errorДеталиPlugin?.manifestJson.displayИмя ?? errorДеталиPlugin?.packageИмя ?? "Plugin"} hit an error state.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-4">
            <div classИмя="rounded-md border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
              <div classИмя="flex items-start gap-3">
                <AlertTriangle classИмя="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
                <div classИмя="space-y-1 text-sm">
                  <p classИмя="font-medium text-red-700 dark:text-red-300">
                    What errored
                  </p>
                  <p classИмя="text-red-700/90 dark:text-red-200/90 break-words">
                    {errorДеталиPlugin ? getPluginОшибкаSummary(errorДеталиPlugin) : "Нет error summary available."}
                  </p>
                </div>
              </div>
            </div>
            <div classИмя="space-y-2">
              <p classИмя="text-sm font-medium">Full error output</p>
              <pre classИмя="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-words">
                {errorДеталиPlugin?.lastОшибка ?? "Нет stored error message."}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setОшибкаДеталиPlugin(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
