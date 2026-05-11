import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Puzzle, ArrowLeft, ShieldAlert, АктивностьSquare, CheckCircle, XCircle, Loader2, Clock, Cpu, Webhook, CalendarClock, AlertTriangle, ПапкаOpen, Сохранить } from "lucide-react";
import type { PluginLocalПапкаDeclaration } from "@paperclipai/shared";
import { useКомпания } from "@/context/КомпанияContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { Link, Navigate, useParams } from "@/lib/router";
import { PluginSlotMount, usePluginSlots } from "@/plugins/slots";
import { pluginsApi, type PluginLocalПапкаСтатус } from "@/api/plugins";
import { queryКлючs } from "@/lib/queryКлючs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChooseПутьButton } from "@/components/ПутьInstructionsModal";
import {
  Card,
  CardContent,
  CardОписание,
  CardHeader,
  CardНазвание,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabBar } from "@/components/PageTabBar";
import {
  JsonSchemaForm,
  validateJsonSchemaForm,
  getПо умолчаниюЗначениеs,
  type JsonSchemaНетde,
} from "@/components/JsonSchemaForm";

/**
 * PluginНастройки page component.
 *
 * Detailed settings and diagnostics page for a single installed plugin.
 * Navigated to from {@link PluginManager} via the Настройки gear icon.
 *
 * Displays:
 * - Plugin identity: display name, id, version, description, categories.
 * - Manifest-declared capabilities (what data and features the plugin can access).
 * - Health check results (only for `ready` plugins; polled every 30 seconds).
 * - Запуститьtime dashboard: worker status/uptime, recent job runs, webhook deliveries.
 * - Авто-generated config form from `instanceConfigSchema` (when no custom settings page).
 * - Plugin-contributed settings UI via `<PluginSlotOutlet type="settingsPage" />`.
 *
 * Data flow:
 * - `GET /api/plugins/:pluginId` — plugin record (refreshes on mount).
 * - `GET /api/plugins/:pluginId/health` — health diagnostics (polling).
 *   Only fetched when `plugin.status === "ready"`.
 * - `GET /api/plugins/:pluginId/dashboard` — aggregated runtime dashboard data (polling).
 * - `GET /api/plugins/:pluginId/config` — current config values.
 * - `POST /api/plugins/:pluginId/config` — save config values.
 * - `POST /api/plugins/:pluginId/config/test` — test configuration.
 *
 * URL params:
 * - `companyPrefix` — the company slug (for breadcrumb links).
 * - `pluginId` — UUID of the plugin to display.
 *
 * @see PluginManager — parent list page.
 * @see doc/plugins/PLUGIN_SPEC.md §13 — Plugin Health Checks.
 * @see doc/plugins/PLUGIN_SPEC.md §19.8 — Plugin Настройки UI.
 */
export function PluginНастройки() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companyPrefix, pluginId } = useParams<{ companyPrefix?: string; pluginId: string }>();
  const [activeTab, setАктивенTab] = useState<"configuration" | "status">("configuration");

  const { data: plugin, isЗагрузка: pluginЗагрузка } = useQuery({
    queryКлюч: queryКлючs.plugins.detail(pluginId!),
    queryFn: () => pluginsApi.get(pluginId!),
    enabled: !!pluginId,
  });

  const { data: healthData, isЗагрузка: healthЗагрузка } = useQuery({
    queryКлюч: queryКлючs.plugins.health(pluginId!),
    queryFn: () => pluginsApi.health(pluginId!),
    enabled: !!pluginId && plugin?.status === "ready",
    refetchInterval: 30000,
  });

  const { data: dashboardData } = useQuery({
    queryКлюч: queryКлючs.plugins.dashboard(pluginId!),
    queryFn: () => pluginsApi.dashboard(pluginId!),
    enabled: !!pluginId,
    refetchInterval: 30000,
  });

  const { data: recentLogs } = useQuery({
    queryКлюч: queryКлючs.plugins.logs(pluginId!),
    queryFn: () => pluginsApi.logs(pluginId!, { limit: 50 }),
    enabled: !!pluginId && plugin?.status === "ready",
    refetchInterval: 30000,
  });

  // Fetch existing config for the plugin
  const configSchema = plugin?.manifestJson?.instanceConfigSchema as JsonSchemaНетde | undefined;
  const hasConfigSchema = configSchema && configSchema.properties && Object.keys(configSchema.properties).length > 0;

  const { data: configData, isЗагрузка: configЗагрузка } = useQuery({
    queryКлюч: queryКлючs.plugins.config(pluginId!),
    queryFn: () => pluginsApi.getConfig(pluginId!),
    enabled: !!pluginId && !!hasConfigSchema,
  });

  const { slots } = usePluginSlots({
    slotТипs: ["settingsPage"],
    companyId: selectedКомпанияId,
    enabled: !!selectedКомпанияId,
  });

  // Фильтр slots to only show settings pages for this specific plugin
  const pluginSlots = slots.filter((slot) => slot.pluginId === pluginId);

  // If the plugin has a custom settingsPage slot, prefer that over auto-generated form
  const hasСвойНастройкиPage = pluginSlots.length > 0;

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/instance/settings/heartbeats" },
      { label: "Plugins", href: "/instance/settings/plugins" },
      { label: plugin?.manifestJson?.displayИмя ?? plugin?.packageИмя ?? "Plugin Детали" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs, companyPrefix, plugin]);

  useEffect(() => {
    setАктивенTab("configuration");
  }, [pluginId]);

  if (pluginЗагрузка) {
    return <div classИмя="p-4 text-sm text-muted-foreground">Загрузка plugin details...</div>;
  }

  if (!plugin) {
    return <Navigate to="/instance/settings/plugins" replace />;
  }

  const displayСтатус = plugin.status;
  const statusVariant =
    plugin.status === "ready"
      ? "default"
      : plugin.status === "error"
        ? "destructive"
        : "secondary";
  const pluginОписание = plugin.manifestJson.description || "Нет описания provided.";
  const pluginCapabilities = plugin.manifestJson.capabilities ?? [];
  const environmentDrivers = plugin.manifestJson.environmentDrivers ?? [];
  const localПапкаDeclarations = plugin.manifestJson.localПапкаs ?? [];
  const hasLocalПапкаs = localПапкаDeclarations.length > 0;
  const environmentDriverИмяs = environmentDrivers
    .map((driver) => driver.displayИмя?.trim() || driver.driverКлюч)
    .filter((name, index, values) => values.indexOf(name) === index);
  const driverLabel = environmentDriverИмяs.join(", ");

  return (
    <div classИмя="space-y-6 max-w-5xl">
      <div classИмя="flex items-center gap-4">
        <Link to="/instance/settings/plugins">
          <Button variant="outline" size="icon" classИмя="h-8 w-8">
            <ArrowLeft classИмя="h-4 w-4" />
          </Button>
        </Link>
        <div classИмя="flex items-center gap-2">
          <Puzzle classИмя="h-6 w-6 text-muted-foreground" />
          <h1 classИмя="text-xl font-semibold">{plugin.manifestJson.displayИмя ?? plugin.packageИмя}</h1>
          <Badge variant={statusVariant} classИмя="ml-2">
            {displayСтатус}
          </Badge>
          <Badge variant="outline" classИмя="ml-1">
            v{plugin.manifestJson.version ?? plugin.version}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onЗначениеChange={(value) => setАктивенTab(value as "configuration" | "status")} classИмя="space-y-6">
        <PageTabBar
          align="start"
          items={[
            { value: "configuration", label: "Конфигурация" },
            { value: "status", label: "Статус" },
          ]}
          value={activeTab}
          onЗначениеChange={(value) => setАктивенTab(value as "configuration" | "status")}
        />

        <TabsContent value="configuration" classИмя="space-y-6">
          <div classИмя="space-y-8">
            <section classИмя="space-y-5">
              <h2 classИмя="text-base font-semibold">About</h2>
              <div classИмя="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)]">
                <div classИмя="space-y-2">
                  <h3 classИмя="text-sm font-medium text-muted-foreground">Описание</h3>
                  <p classИмя="text-sm leading-6 text-foreground/90">{pluginОписание}</p>
                </div>
                <div classИмя="space-y-4 text-sm">
                  <div classИмя="space-y-1.5">
                    <h3 classИмя="font-medium text-muted-foreground">Author</h3>
                    <p classИмя="text-foreground">{plugin.manifestJson.author}</p>
                  </div>
                  <div classИмя="space-y-2">
                    <h3 classИмя="font-medium text-muted-foreground">Categories</h3>
                    <div classИмя="flex flex-wrap gap-2">
                      {plugin.categories.length > 0 ? (
                        plugin.categories.map((category) => (
                          <Badge key={category} variant="outline" classИмя="capitalize">
                            {category}
                          </Badge>
                        ))
                      ) : (
                        <span classИмя="text-foreground">Нет</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            <section classИмя="space-y-4">
              <div classИмя="space-y-1">
                <h2 classИмя="text-base font-semibold">Настройки</h2>
              </div>
              {hasLocalПапкаs ? (
                <PluginLocalПапкаsНастройки
                  pluginId={pluginId!}
                  companyId={selectedКомпанияId}
                  declarations={localПапкаDeclarations}
                />
              ) : null}
              {hasСвойНастройкиPage ? (
                <div classИмя="space-y-3">
                  {pluginSlots.map((slot) => (
                    <PluginSlotMount
                      key={`${slot.pluginКлюч}:${slot.id}`}
                      slot={slot}
                      context={{
                        companyId: selectedКомпанияId,
                        companyPrefix: companyPrefix ?? null,
                      }}
                      missingBehavior="placeholder"
                    />
                  ))}
                </div>
              ) : hasConfigSchema ? (
                <PluginConfigForm
                  pluginId={pluginId!}
                  schema={configSchema!}
                  initialЗначениеs={configData?.configJson}
                  isЗагрузка={configЗагрузка}
                  pluginСтатус={plugin.status}
                  supportsConfigПроверить={(plugin as unknown as { supportsConfigПроверить?: boolean }).supportsConfigПроверить === true}
                />
              ) : environmentDrivers.length > 0 ? (
                <div classИмя="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm">
                  <p classИмя="font-medium text-foreground">Configure this plugin from Компания Окружения.</p>
                  <p classИмя="mt-1 text-muted-foreground">
                    {driverLabel || "This plugin"} registers environment runtime settings there so credentials stay
                    company-scoped instead of instance-global.
                  </p>
                  <div classИмя="mt-3">
                    <Link to="/company/settings/environments">
                      <Button variant="outline" size="sm">Open Компания Окружения</Button>
                    </Link>
                  </div>
                </div>
              ) : !hasLocalПапкаs ? (
                <p classИмя="text-sm text-muted-foreground">
                  This plugin does not require any settings.
                </p>
              ) : null}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="status" classИмя="space-y-6">
          <div classИмя="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
            <div classИмя="space-y-6">
              <Card>
                <CardHeader>
                  <CardНазвание classИмя="text-base flex items-center gap-1.5">
                    <Cpu classИмя="h-4 w-4" />
                    Запуститьtime Панель управления
                  </CardНазвание>
                  <CardОписание>
                    Работаer process, scheduled jobs, and webhook deliveries
                  </CardОписание>
                </CardHeader>
                <CardContent classИмя="space-y-6">
                  {dashboardData ? (
                    <>
                      <div>
                        <h3 classИмя="text-sm font-medium mb-3 flex items-center gap-1.5">
                          <Cpu classИмя="h-3.5 w-3.5 text-muted-foreground" />
                          Работаer Process
                        </h3>
                        {dashboardData.worker ? (
                          <div classИмя="grid grid-cols-2 gap-3 text-sm">
                            <div classИмя="flex justify-between">
                              <span classИмя="text-muted-foreground">Статус</span>
                              <Badge variant={dashboardData.worker.status === "running" ? "default" : "secondary"}>
                                {dashboardData.worker.status}
                              </Badge>
                            </div>
                            <div classИмя="flex justify-between">
                              <span classИмя="text-muted-foreground">PID</span>
                              <span classИмя="font-mono text-xs">{dashboardData.worker.pid ?? "—"}</span>
                            </div>
                            <div classИмя="flex justify-between">
                              <span classИмя="text-muted-foreground">Uptime</span>
                              <span classИмя="text-xs">{formatUptime(dashboardData.worker.uptime)}</span>
                            </div>
                            <div classИмя="flex justify-between">
                              <span classИмя="text-muted-foreground">Ожидание RPCs</span>
                              <span classИмя="text-xs">{dashboardData.worker.pendingRequests}</span>
                            </div>
                            {dashboardData.worker.totalCrashes > 0 && (
                              <>
                                <div classИмя="flex justify-between col-span-2">
                                  <span classИмя="text-muted-foreground flex items-center gap-1">
                                    <AlertTriangle classИмя="h-3 w-3 text-amber-500" />
                                    Crashes
                                  </span>
                                  <span classИмя="text-xs">
                                    {dashboardData.worker.consecutiveCrashes} consecutive / {dashboardData.worker.totalCrashes} total
                                  </span>
                                </div>
                                {dashboardData.worker.lastCrashAt && (
                                  <div classИмя="flex justify-between col-span-2">
                                    <span classИмя="text-muted-foreground">Last Crash</span>
                                    <span classИмя="text-xs">{formatTimestamp(dashboardData.worker.lastCrashAt)}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <p classИмя="text-sm text-muted-foreground italic">Нет worker process registered.</p>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <h3 classИмя="text-sm font-medium mb-3 flex items-center gap-1.5">
                          <CalendarClock classИмя="h-3.5 w-3.5 text-muted-foreground" />
                          Recent Job Запуститьs
                        </h3>
                        {dashboardData.recentJobЗапуститьs.length > 0 ? (
                          <div classИмя="space-y-2">
                            {dashboardData.recentJobЗапуститьs.map((run) => (
                              <div
                                key={run.id}
                                classИмя="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                              >
                                <div classИмя="flex min-w-0 items-center gap-2">
                                  <JobСтатусDot status={run.status} />
                                  <span classИмя="truncate font-mono text-xs" title={run.jobКлюч ?? run.jobId}>
                                    {run.jobКлюч ?? run.jobId.slice(0, 8)}
                                  </span>
                                  <Badge variant="outline" classИмя="px-1 py-0 text-[10px]">
                                    {run.trigger}
                                  </Badge>
                                </div>
                                <div classИмя="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                  {run.durationMs != null ? <span>{formatDuration(run.durationMs)}</span> : null}
                                  <span title={run.createdAt}>{formatRelativeTime(run.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p classИмя="text-sm text-muted-foreground italic">Нет job runs recorded yet.</p>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <h3 classИмя="text-sm font-medium mb-3 flex items-center gap-1.5">
                          <Webhook classИмя="h-3.5 w-3.5 text-muted-foreground" />
                          Recent Webhook Deliveries
                        </h3>
                        {dashboardData.recentWebhookDeliveries.length > 0 ? (
                          <div classИмя="space-y-2">
                            {dashboardData.recentWebhookDeliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                classИмя="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                              >
                                <div classИмя="flex min-w-0 items-center gap-2">
                                  <DeliveryСтатусDot status={delivery.status} />
                                  <span classИмя="truncate font-mono text-xs" title={delivery.webhookКлюч}>
                                    {delivery.webhookКлюч}
                                  </span>
                                </div>
                                <div classИмя="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                  {delivery.durationMs != null ? <span>{formatDuration(delivery.durationMs)}</span> : null}
                                  <span title={delivery.createdAt}>{formatRelativeTime(delivery.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p classИмя="text-sm text-muted-foreground italic">Нет webhook deliveries recorded yet.</p>
                        )}
                      </div>

                      <div classИмя="flex items-center gap-1.5 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                        <Clock classИмя="h-3 w-3" />
                        Last checked: {new Date(dashboardData.checkedAt).toLocaleTimeString()}
                      </div>
                    </>
                  ) : (
                    <p classИмя="text-sm text-muted-foreground">
                      Запуститьtime diagnostics are unavailable right now.
                    </p>
                  )}
                </CardContent>
              </Card>

              {recentLogs && recentLogs.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardНазвание classИмя="text-base flex items-center gap-1.5">
                      <АктивностьSquare classИмя="h-4 w-4" />
                      Recent Logs
                    </CardНазвание>
                    <CardОписание>Last {recentLogs.length} log entries</CardОписание>
                  </CardHeader>
                  <CardContent>
                    <div classИмя="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                      {recentLogs.map((entry) => (
                        <div
                          key={entry.id}
                          classИмя={`flex gap-2 py-0.5 ${
                            entry.level === "error"
                              ? "text-destructive"
                              : entry.level === "warn"
                                ? "text-yellow-600 dark:text-yellow-400"
                                : entry.level === "debug"
                                  ? "text-muted-foreground/60"
                                  : "text-muted-foreground"
                          }`}
                        >
                          <span classИмя="shrink-0 text-muted-foreground/50">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                          <Badge variant="outline" classИмя="h-4 shrink-0 px-1 text-[10px]">{entry.level}</Badge>
                          <span classИмя="truncate" title={entry.message}>{entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div classИмя="space-y-6">
              <Card>
                <CardHeader>
                  <CardНазвание classИмя="text-base flex items-center gap-1.5">
                    <АктивностьSquare classИмя="h-4 w-4" />
                    Health Статус
                  </CardНазвание>
                </CardHeader>
                <CardContent>
                  {healthЗагрузка ? (
                    <p classИмя="text-sm text-muted-foreground">Checking health...</p>
                  ) : healthData ? (
                    <div classИмя="space-y-4 text-sm">
                      <div classИмя="flex items-center justify-between">
                        <span classИмя="text-muted-foreground">Overall</span>
                        <Badge variant={healthData.healthy ? "default" : "destructive"}>
                          {healthData.status}
                        </Badge>
                      </div>

                      {healthData.checks.length > 0 ? (
                        <div classИмя="space-y-2 border-t border-border/50 pt-2">
                          {healthData.checks.map((check, i) => (
                            <div key={i} classИмя="flex items-start justify-between gap-2">
                              <span classИмя="truncate text-muted-foreground" title={check.name}>
                                {check.name}
                              </span>
                              {check.passed ? (
                                <CheckCircle classИмя="h-4 w-4 shrink-0 text-green-500" />
                              ) : (
                                <XCircle classИмя="h-4 w-4 shrink-0 text-destructive" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {healthData.lastОшибка ? (
                        <div classИмя="break-words rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                          {healthData.lastОшибка}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div classИмя="space-y-3 text-sm text-muted-foreground">
                      <div classИмя="flex items-center justify-between">
                        <span>Lifecycle</span>
                        <Badge variant={statusVariant}>{displayСтатус}</Badge>
                      </div>
                      <p>Health checks run once the plugin is ready.</p>
                      {plugin.lastОшибка ? (
                        <div classИмя="break-words rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                          {plugin.lastОшибка}
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardНазвание classИмя="text-base">Детали</CardНазвание>
                </CardHeader>
                <CardContent classИмя="space-y-3 text-sm text-muted-foreground">
                  <div classИмя="flex justify-between gap-3">
                    <span>Plugin ID</span>
                    <span classИмя="font-mono text-xs text-right">{plugin.id}</span>
                  </div>
                  <div classИмя="flex justify-between gap-3">
                    <span>Plugin Ключ</span>
                    <span classИмя="font-mono text-xs text-right">{plugin.pluginКлюч}</span>
                  </div>
                  <div classИмя="flex justify-between gap-3">
                    <span>NPM Package</span>
                    <span classИмя="max-w-[170px] truncate text-right text-xs" title={plugin.packageИмя}>
                      {plugin.packageИмя}
                    </span>
                  </div>
                  <div classИмя="flex justify-between gap-3">
                    <span>Версия</span>
                    <span classИмя="text-right text-foreground">v{plugin.manifestJson.version ?? plugin.version}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardНазвание classИмя="text-base flex items-center gap-1.5">
                    <ShieldAlert classИмя="h-4 w-4" />
                    Permissions
                  </CardНазвание>
                </CardHeader>
                <CardContent>
                  {pluginCapabilities.length > 0 ? (
                    <ul classИмя="space-y-2 text-sm text-muted-foreground">
                      {pluginCapabilities.map((cap) => (
                        <li key={cap} classИмя="rounded-md bg-muted/40 px-2.5 py-2 font-mono text-xs text-foreground/85">
                          {cap}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p classИмя="text-sm text-muted-foreground italic">Нет special permissions requested.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PluginLocalПапкаsНастройки — host-managed company-scoped folders
// ---------------------------------------------------------------------------

interface PluginLocalПапкаsНастройкиProps {
  pluginId: string;
  companyId: string | null;
  declarations: PluginLocalПапкаDeclaration[];
}

function PluginLocalПапкаsНастройки({ pluginId, companyId, declarations }: PluginLocalПапкаsНастройкиProps) {
  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: companyId
      ? queryКлючs.plugins.localПапкаs(pluginId, companyId)
      : ["plugins", pluginId, "companies", "none", "local-folders"],
    queryFn: () => pluginsApi.listLocalПапкаs(pluginId, companyId!),
    enabled: !!companyId,
  });

  const statusByКлюч = new Map((data?.folders ?? []).map((folder) => [folder.folderКлюч, folder]));

  if (!companyId) {
    return (
      <div classИмя="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Select a company to configure this plugin's local folders.
      </div>
    );
  }

  return (
    <div classИмя="space-y-3">
      <div classИмя="flex items-center gap-2">
        <ПапкаOpen classИмя="h-4 w-4 text-muted-foreground" />
        <h3 classИмя="text-sm font-medium">Локальная папкаs</h3>
      </div>
      {error ? (
        <div classИмя="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Ошибка).message || "Ошибка to load local folder settings."}
        </div>
      ) : null}
      {isЗагрузка ? (
        <div classИмя="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 classИмя="h-4 w-4 animate-spin" />
          Загрузка local folders...
        </div>
      ) : (
        <div classИмя="space-y-3">
          {declarations.map((declaration) => (
            <PluginLocalПапкаRow
              key={declaration.folderКлюч}
              pluginId={pluginId}
              companyId={companyId}
              declaration={declaration}
              status={statusByКлюч.get(declaration.folderКлюч)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PluginLocalПапкаRowProps {
  pluginId: string;
  companyId: string;
  declaration: PluginLocalПапкаDeclaration;
  status?: PluginLocalПапкаСтатус;
}

function PluginLocalПапкаRow({ pluginId, companyId, declaration, status }: PluginLocalПапкаRowProps) {
  const queryClient = useQueryClient();
  const serverПуть = status?.path ?? "";
  const [pathЗначение, setПутьЗначение] = useState(serverПуть);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setПутьЗначение(serverПуть);
    setMessage(null);
  }, [serverПуть, declaration.folderКлюч]);

  const saveMutation = useMutation({
    mutationFn: (path: string) =>
      pluginsApi.configureLocalПапка(pluginId, companyId, declaration.folderКлюч, {
        path,
        access: declaration.access,
        requiredDirectories: declaration.requiredDirectories,
        requiredФайлы: declaration.requiredФайлы,
      }),
    onУспешно: (nextСтатус) => {
      setMessage({
        type: nextСтатус.healthy ? "success" : "error",
        text: nextСтатус.healthy
          ? "Локальная папка saved."
          : "Локальная папка saved, but validation still needs attention.",
      });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.plugins.localПапкаs(pluginId, companyId) });
    },
    onОшибка: (err: Ошибка) => {
      setMessage({ type: "error", text: err.message || "Ошибка to save local folder." });
    },
  });

  const trimmedПуть = pathЗначение.trim();
  const isDirty = trimmedПуть !== serverПуть;
  const access = status?.access ?? declaration.access ?? "readWrite";

  const handleСохранить = useCallback(() => {
    if (!trimmedПуть) {
      setMessage({ type: "error", text: "Локальная папка path is required." });
      return;
    }
    if (!isLikelyAbsoluteПуть(trimmedПуть)) {
      setMessage({ type: "error", text: "Локальная папка must be a full absolute path." });
      return;
    }
    setMessage(null);
    saveMutation.mutate(trimmedПуть);
  }, [saveMutation, trimmedПуть]);

  return (
    <div classИмя="space-y-4 rounded-md border border-border/70 bg-background px-4 py-4">
      <div classИмя="flex flex-wrap items-start justify-between gap-3">
        <div classИмя="min-w-0 space-y-1">
          <div classИмя="flex flex-wrap items-center gap-2">
            <h4 classИмя="text-sm font-medium">{declaration.displayИмя}</h4>
            <Badge variant="outline" classИмя="font-mono text-[10px]">
              {declaration.folderКлюч}
            </Badge>
            <Badge variant={status?.healthy ? "default" : "secondary"}>
              {status?.healthy ? "Работает" : "Needs attention"}
            </Badge>
          </div>
          {declaration.description ? (
            <p classИмя="max-w-3xl text-sm leading-5 text-muted-foreground">
              {declaration.description}
            </p>
          ) : null}
        </div>
        <Badge variant={access === "readWrite" ? "default" : "outline"}>
          {access === "readWrite" ? "Read/write" : "Read only"}
        </Badge>
      </div>

      <div classИмя="grid gap-3 text-sm sm:grid-cols-3">
        <ПапкаСтатусMetric label="Configured" value={status?.configured ? "Да" : "Нет"} ok={!!status?.configured} />
        <ПапкаСтатусMetric label="Readable" value={status?.readable ? "Да" : "Нет"} ok={!!status?.readable} />
        <ПапкаСтатусMetric
          label="Writable"
          value={access === "read" ? "Нетt requested" : status?.writable ? "Да" : "Нет"}
          ok={access === "read" || !!status?.writable}
        />
      </div>

      {status?.path ? (
        <div classИмя="space-y-1 text-sm">
          <div classИмя="text-xs font-medium text-muted-foreground">Configured path</div>
          <div classИмя="break-all rounded-md bg-muted/60 px-2 py-1.5 font-mono text-xs text-foreground">
            {status.path}
          </div>
        </div>
      ) : null}

      <div classИмя="space-y-1.5">
        <label classИмя="text-xs font-medium text-muted-foreground" htmlFor={`local-folder-${declaration.folderКлюч}`}>
          Локальная папка path
        </label>
        <div classИмя="flex items-center gap-2">
          <input
            id={`local-folder-${declaration.folderКлюч}`}
            classИмя="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
            value={pathЗначение}
            onChange={(event) => {
              setПутьЗначение(event.target.value);
              setMessage(null);
            }}
            placeholder="/absolute/path/to/folder"
          />
          <ChooseПутьButton classИмя="h-8" />
          <Button
            size="sm"
            onClick={handleСохранить}
            disabled={saveMutation.isОжидание || !isDirty}
          >
            {saveMutation.isОжидание ? (
              <Loader2 classИмя="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Сохранить classИмя="h-3.5 w-3.5" />
            )}
            Сохранить
          </Button>
        </div>
      </div>

      <ПапкаRequirements status={status} declaration={declaration} />

      {status?.problems?.length ? (
        <div classИмя="space-y-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div classИмя="font-medium">Validation problems</div>
          <ul classИмя="space-y-1">
            {status.problems.map((problem, index) => (
              <li key={`${problem.code}:${problem.path ?? ""}:${index}`}>
                {problem.message}
                {problem.path ? <span classИмя="font-mono"> {problem.path}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div
          classИмя={`rounded-md border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

function ПапкаСтатусMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div classИмя="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-2">
      <span classИмя="text-muted-foreground">{label}</span>
      <Badge variant={ok ? "default" : "secondary"}>{value}</Badge>
    </div>
  );
}

function ПапкаRequirements({
  status,
  declaration,
}: {
  status?: PluginLocalПапкаСтатус;
  declaration: PluginLocalПапкаDeclaration;
}) {
  const requiredDirectories = status?.requiredDirectories ?? declaration.requiredDirectories ?? [];
  const requiredФайлы = status?.requiredФайлы ?? declaration.requiredФайлы ?? [];
  const missingDirectories = status?.missingDirectories ?? requiredDirectories;
  const missingФайлы = status?.missingФайлы ?? requiredФайлы;
  const rootНетtInspected = isRootНетtInspected(status);

  if (requiredDirectories.length === 0 && requiredФайлы.length === 0) return null;

  return (
    <div classИмя="grid gap-3 text-sm md:grid-cols-2">
      <RequirementList
        title="Обязательно directories"
        items={requiredDirectories}
        missingItems={missingDirectories}
        missingLabel="Missing directories"
        inspectionUnavailable={rootНетtInspected}
      />
      <RequirementList
        title="Обязательно files"
        items={requiredФайлы}
        missingItems={missingФайлы}
        missingLabel="Missing files"
        inspectionUnavailable={rootНетtInspected}
      />
    </div>
  );
}

function isRootНетtInspected(status?: PluginLocalПапкаСтатус) {
  if (!status?.configured || status.readable) return false;
  return status.problems.some((problem) =>
    problem.code === "missing" || problem.code === "not_readable" || problem.code === "not_directory"
  );
}

function RequirementList({
  title,
  items,
  missingItems,
  missingLabel,
  inspectionUnavailable,
}: {
  title: string;
  items: string[];
  missingItems: string[];
  missingLabel: string;
  inspectionUnavailable?: boolean;
}) {
  return (
    <div classИмя="space-y-2 rounded-md border border-border/60 px-3 py-2">
      <div classИмя="flex items-center justify-between gap-2">
        <span classИмя="text-xs font-medium text-muted-foreground">{title}</span>
        {inspectionUnavailable ? (
          <Badge variant="secondary" classИмя="text-[10px]">
            Нетt inspected
          </Badge>
        ) : missingItems.length > 0 ? (
          <Badge variant="destructive" classИмя="text-[10px]">
            {missingItems.length} missing
          </Badge>
        ) : (
          <Badge variant="outline" classИмя="text-[10px]">Present</Badge>
        )}
      </div>
      {items.length > 0 ? (
        <div classИмя="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const missing = missingItems.includes(item);
            return (
              <span
                key={item}
                classИмя={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                  inspectionUnavailable
                    ? "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300"
                    : missing
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/50 text-foreground/80"
                }`}
              >
                {item}
              </span>
            );
          })}
        </div>
      ) : (
        <p classИмя="text-xs text-muted-foreground">Нет declared.</p>
      )}
      {inspectionUnavailable ? (
        <p classИмя="text-xs text-amber-700 dark:text-amber-300">Configured root was not inspected.</p>
      ) : missingItems.length > 0 ? (
        <p classИмя="text-xs text-destructive">{missingLabel}: {missingItems.join(", ")}</p>
      ) : null}
    </div>
  );
}

function isLikelyAbsoluteПуть(pathЗначение: string) {
  return (
    pathЗначение.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(pathЗначение) ||
    pathЗначение.startsWith("\\\\")
  );
}

// ---------------------------------------------------------------------------
// PluginConfigForm — auto-generated form for instanceConfigSchema
// ---------------------------------------------------------------------------

interface PluginConfigFormProps {
  pluginId: string;
  schema: JsonSchemaНетde;
  initialЗначениеs?: Record<string, unknown>;
  isЗагрузка?: boolean;
  /** Current plugin lifecycle status — "Проверить Конфигурация" only available when `ready`. */
  pluginСтатус?: string;
  /** Whether the plugin worker implements `validateConfig`. */
  supportsConfigПроверить?: boolean;
}

/**
 * Inner component that manages form state, validation, save, and "Проверить Конфигурация"
 * for the auto-generated plugin config form.
 *
 * Separated from PluginНастройки to isolate re-render scope — only the form
 * re-renders on field changes, not the entire page.
 */
function PluginConfigForm({ pluginId, schema, initialЗначениеs, isЗагрузка, pluginСтатус, supportsConfigПроверить }: PluginConfigFormProps) {
  const queryClient = useQueryClient();

  // Form values: start with saved values, fall back to schema defaults
  const [values, setЗначениеs] = useState<Record<string, unknown>>(() => ({
    ...getПо умолчаниюЗначениеs(schema),
    ...(initialЗначениеs ?? {}),
  }));

  // Sync when saved config loads asynchronously — only on first load so we
  // don't overwrite in-progress user edits if the query refetches (e.g. on
  // window focus).
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (initialЗначениеs && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      setЗначениеs({
        ...getПо умолчаниюЗначениеs(schema),
        ...initialЗначениеs,
      });
    }
  }, [initialЗначениеs, schema]);

  const [errors, setОшибкаs] = useState<Record<string, string>>({});
  const [saveMessage, setСохранитьMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setПроверитьResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dirty tracking: compare against initial values
  const isDirty = JSON.stringify(values) !== JSON.stringify({
    ...getПо умолчаниюЗначениеs(schema),
    ...(initialЗначениеs ?? {}),
  });

  // Сохранить mutation
  const saveMutation = useMutation({
    mutationFn: (configJson: Record<string, unknown>) =>
      pluginsApi.saveConfig(pluginId, configJson),
    onУспешно: () => {
      setСохранитьMessage({ type: "success", text: "Конфигурация saved." });
      setПроверитьResult(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.plugins.config(pluginId) });
      // Очистить success message after 3s
      setTimeout(() => setСохранитьMessage(null), 3000);
    },
    onОшибка: (err: Ошибка) => {
      setСохранитьMessage({ type: "error", text: err.message || "Ошибка to save configuration." });
    },
  });

  // Проверить configuration mutation
  const testMutation = useMutation({
    mutationFn: (configJson: Record<string, unknown>) =>
      pluginsApi.testConfig(pluginId, configJson),
    onУспешно: (result) => {
      if (result.valid) {
        setПроверитьResult({ type: "success", text: "Конфигурация test passed." });
      } else {
        setПроверитьResult({ type: "error", text: result.message || "Конфигурация test failed." });
      }
    },
    onОшибка: (err: Ошибка) => {
      setПроверитьResult({ type: "error", text: err.message || "Конфигурация test failed." });
    },
  });

  const handleChange = useCallback((newЗначениеs: Record<string, unknown>) => {
    setЗначениеs(newЗначениеs);
    // Очистить field-level errors as the user types
    setОшибкаs({});
    setСохранитьMessage(null);
  }, []);

  const handleСохранить = useCallback(() => {
    // Validate before saving
    const validationОшибкаs = validateJsonSchemaForm(schema, values);
    if (Object.keys(validationОшибкаs).length > 0) {
      setОшибкаs(validationОшибкаs);
      return;
    }
    setОшибкаs({});
    saveMutation.mutate(values);
  }, [schema, values, saveMutation]);

  const handleПроверитьConnection = useCallback(() => {
    // Validate before testing
    const validationОшибкаs = validateJsonSchemaForm(schema, values);
    if (Object.keys(validationОшибкаs).length > 0) {
      setОшибкаs(validationОшибкаs);
      return;
    }
    setОшибкаs({});
    setПроверитьResult(null);
    testMutation.mutate(values);
  }, [schema, values, testMutation]);

  if (isЗагрузка) {
    return (
      <div classИмя="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 classИмя="h-4 w-4 animate-spin" />
        Загрузка configuration...
      </div>
    );
  }

  return (
    <div classИмя="space-y-4">
      <JsonSchemaForm
        schema={schema}
        values={values}
        onChange={handleChange}
        errors={errors}
        disabled={saveMutation.isОжидание}
      />

      {/* Статус messages */}
      {saveMessage && (
        <div
          classИмя={`text-sm p-2 rounded border ${
            saveMessage.type === "success"
              ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900"
              : "text-destructive bg-destructive/10 border-destructive/20"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {testResult && (
        <div
          classИмя={`text-sm p-2 rounded border ${
            testResult.type === "success"
              ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900"
              : "text-destructive bg-destructive/10 border-destructive/20"
          }`}
        >
          {testResult.text}
        </div>
      )}

      {/* Action buttons */}
      <div classИмя="flex items-center gap-2 pt-2">
        <Button
          onClick={handleСохранить}
          disabled={saveMutation.isОжидание || !isDirty}
          size="sm"
        >
          {saveMutation.isОжидание ? (
            <>
              <Loader2 classИмя="h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            "Сохранить Конфигурация"
          )}
        </Button>
        {pluginСтатус === "ready" && supportsConfigПроверить && (
          <Button
            variant="outline"
            onClick={handleПроверитьConnection}
            disabled={testMutation.isОжидание}
            size="sm"
          >
            {testMutation.isОжидание ? (
              <>
                <Loader2 classИмя="h-3.5 w-3.5 animate-spin" />
                Проверитьing...
              </>
            ) : (
              "Проверить Конфигурация"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Панель управления helper components and formatting utilities
// ---------------------------------------------------------------------------

/**
 * Format an uptime value (in milliseconds) to a human-readable string.
 */
function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs == null) return "—";
  const totalSeconds = Math.floor(uptimeMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Format a duration in milliseconds to a compact display string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format an ISO timestamp to a relative time string (e.g., "2m ago").
 */
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a unix timestamp (ms since epoch) to a locale string.
 */
function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}

/**
 * Статус indicator dot for job run statuses.
 */
function JobСтатусDot({ status }: { status: string }) {
  const colorClass =
    status === "success" || status === "succeeded"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "running"
          ? "bg-blue-500 animate-pulse"
          : status === "cancelled"
            ? "bg-gray-400"
            : "bg-amber-500"; // queued, pending
  return (
    <span
      classИмя={`inline-block h-2 w-2 rounded-full shrink-0 ${colorClass}`}
      title={status}
    />
  );
}

/**
 * Статус indicator dot for webhook delivery statuses.
 */
function DeliveryСтатусDot({ status }: { status: string }) {
  const colorClass =
    status === "processed" || status === "success"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "received"
          ? "bg-blue-500"
          : "bg-amber-500"; // pending
  return (
    <span
      classИмя={`inline-block h-2 w-2 rounded-full shrink-0 ${colorClass}`}
      title={status}
    />
  );
}
