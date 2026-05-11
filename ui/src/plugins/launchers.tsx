import {
  Component,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ОшибкаInfo,
  type КлючboardEvent as ReactКлючboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactНетde,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { PLUGIN_LAUNCHER_BOUNDS } from "@paperclipai/shared";
import type {
  PluginLauncherBounds,
  PluginLauncherDeclaration,
  PluginLauncherPlacementZone,
  PluginUiSlotEntityТип,
} from "@paperclipai/shared";
import { pluginsApi, type PluginUiContribution } from "@/api/plugins";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "@/lib/router";
import { queryКлючs } from "@/lib/queryКлючs";
import { cn } from "@/lib/utils";
import {
  PluginBridgeContext,
  type PluginХостContext,
  type PluginModalBoundsRequest,
  type PluginRenderЗакрытьEvent,
  type PluginRenderЗакрытьHandler,
  type PluginRenderОкружениеContext,
} from "./bridge";
import {
  ensurePluginContributionLoaded,
  resolveRegisteredPluginComponent,
  type RegisteredPluginComponent,
} from "./slots";

export type PluginLauncherContext = {
  companyId?: string | null;
  companyPrefix?: string | null;
  projectId?: string | null;
  projectRef?: string | null;
  entityId?: string | null;
  entityТип?: PluginUiSlotEntityТип | null;
};

export type ResolvedPluginLauncher = PluginLauncherDeclaration & {
  pluginId: string;
  pluginКлюч: string;
  pluginDisplayИмя: string;
  pluginВерсия: string;
  uiEntryFile: string;
};

type UsePluginLaunchersФильтрs = {
  placementZones: PluginLauncherPlacementZone[];
  entityТип?: PluginUiSlotEntityТип | null;
  companyId?: string | null;
  enabled?: boolean;
};

type UsePluginLaunchersResult = {
  launchers: ResolvedPluginLauncher[];
  contributionsByPluginId: Map<string, PluginUiContribution>;
  isЗагрузка: boolean;
  errorMessage: string | null;
};

type PluginLauncherЗапуститьtimeContextЗначение = {
  /**
   * Open a launcher using already-discovered contribution metadata.
   *
   * The runtime accepts the normalized `PluginUiContribution` so callers can
   * reuse the `/api/plugins/ui-contributions` payload they already fetched
   * instead of issuing another request for each launcher activation.
   */
  activateLauncher(
    launcher: ResolvedPluginLauncher,
    hostContext: PluginLauncherContext,
    contribution: PluginUiContribution,
    sourceEl?: HTMLElement | null,
  ): Promise<void>;
};

type LauncherInstance = {
  key: string;
  launcher: ResolvedPluginLauncher;
  hostContext: PluginLauncherContext;
  contribution: PluginUiContribution;
  component: RegisteredPluginComponent | null;
  sourceElement: HTMLElement | null;
  sourceRect: DOMRect | null;
  bounds: PluginLauncherBounds | null;
  beforeЗакрытьHandlers: Set<PluginRenderЗакрытьHandler>;
  closeHandlers: Set<PluginRenderЗакрытьHandler>;
};

const entityОбластьdZones = new Set<PluginLauncherPlacementZone>([
  "detailTab",
  "taskDetailView",
  "contextMenuItem",
  "commentAnnotation",
  "commentContextMenuItem",
  "projectSidebarItem",
  "toolbarButton",
]);
const focusableElementSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const launcherOverlayBaseZIndex = 1000;
const supportedLauncherBounds = new Set<PluginLauncherBounds>(
  PLUGIN_LAUNCHER_BOUNDS,
);

const PluginLauncherЗапуститьtimeContext = createContext<PluginLauncherЗапуститьtimeContextЗначение | null>(null);

function getОшибкаMessage(error: unknown): string {
  if (error instanceof Ошибка && error.message) return error.message;
  return "Неизвестно error";
}

function buildLauncherХостContext(
  context: PluginLauncherContext,
  renderОкружение: PluginRenderОкружениеContext | null,
  userId: string | null,
): PluginХостContext {
  return {
    companyId: context.companyId ?? null,
    companyPrefix: context.companyPrefix ?? null,
    projectId: context.projectId ?? (context.entityТип === "project" ? context.entityId ?? null : null),
    entityId: context.entityId ?? null,
    entityТип: context.entityТип ?? null,
    userId,
    renderОкружение,
  };
}

function focusFirstElement(container: HTMLElement | null): void {
  if (!container) return;
  const firstFocusable = container.querySelector<HTMLElement>(focusableElementSelector);
  if (firstFocusable) {
    firstFocusable.focus();
    return;
  }
  container.focus();
}

function trapFocus(container: HTMLElement, event: КлючboardEvent): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    container.querySelectorВсе<HTMLElement>(focusableElementSelector),
  ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

  if (focusable.length === 0) {
    event.preventПо умолчанию();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftКлюч && active === first) {
    event.preventПо умолчанию();
    last.focus();
    return;
  }

  if (!event.shiftКлюч && active === last) {
    event.preventПо умолчанию();
    first.focus();
  }
}

function launcherTriggerClassИмя(placementZone: PluginLauncherPlacementZone): string {
  switch (placementZone) {
    case "projectSidebarItem":
      return "justify-start h-auto px-3 py-1 text-[12px] font-normal text-muted-foreground hover:text-foreground";
    case "contextMenuItem":
    case "commentContextMenuItem":
      return "justify-start h-7 w-full px-2 text-xs font-normal";
    case "sidebar":
    case "sidebarPanel":
      return "justify-start h-8 w-full";
    case "toolbarButton":
    case "globalToolbarButton":
      return "h-8";
    default:
      return "h-8";
  }
}

function launcherShellBoundsStyle(bounds: PluginLauncherBounds | null): CSSProperties {
  switch (bounds) {
    case "compact":
      return { width: "min(28rem, calc(100vw - 2rem))" };
    case "wide":
      return { width: "min(64rem, calc(100vw - 2rem))" };
    case "full":
      return { width: "calc(100vw - 2rem)", height: "calc(100vh - 2rem)" };
    case "inline":
      return { width: "min(24rem, calc(100vw - 2rem))" };
    case "default":
    default:
      return { width: "min(40rem, calc(100vw - 2rem))" };
  }
}

function launcherPopoverStyle(instance: LauncherInstance): CSSProperties {
  const rect = instance.sourceRect;
  const baseWidth = launcherShellBoundsStyle(instance.bounds).width ?? "min(24rem, calc(100vw - 2rem))";
  if (!rect) {
    return {
      width: baseWidth,
      maxHeight: "min(70vh, 36rem)",
      top: "4rem",
      left: "50%",
      transform: "translateX(-50%)",
    };
  }

  const top = Math.min(rect.bottom + 8, window.innerHeight - 32);
  const left = Math.min(
    Math.max(rect.left, 16),
    Math.max(16, window.innerWidth - 360),
  );

  return {
    width: baseWidth,
    maxHeight: "min(70vh, 36rem)",
    top,
    left,
  };
}

function isPluginLauncherBounds(value: unknown): value is PluginLauncherBounds {
  return typeof value === "string" && supportedLauncherBounds.has(value as PluginLauncherBounds);
}

/**
 * Discover launchers for the requested host placement zones from the normalized
 * `/api/plugins/ui-contributions` response.
 *
 * This is the shared discovery path for toolbar, sidebar, detail-view, and
 * context-menu launchers. The hook applies host-side entity filtering and
 * returns both the sorted launcher list and a contribution map so activation
 * can stay on cached metadata.
 */
export function usePluginLaunchers(
  filters: UsePluginLaunchersФильтрs,
): UsePluginLaunchersResult {
  const queryВключитьd = filters.enabled ?? true;
  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.plugins.uiContributions,
    queryFn: () => pluginsApi.listUiContributions(),
    enabled: queryВключитьd,
  });

  const placementZonesКлюч = useMemo(
    () => [...filters.placementZones].sort().join("|"),
    [filters.placementZones],
  );

  const contributionsByPluginId = useMemo(() => {
    const byPluginId = new Map<string, PluginUiContribution>();
    for (const contribution of data ?? []) {
      byPluginId.set(contribution.pluginId, contribution);
    }
    return byPluginId;
  }, [data]);

  const launchers = useMemo(() => {
    const placementZones = new Set(
      placementZonesКлюч.split("|").filter(Boolean) as PluginLauncherPlacementZone[],
    );
    const rows: ResolvedPluginLauncher[] = [];
    for (const contribution of data ?? []) {
      for (const launcher of contribution.launchers) {
        if (!placementZones.has(launcher.placementZone)) continue;
        if (entityОбластьdZones.has(launcher.placementZone)) {
          if (!filters.entityТип) continue;
          if (!launcher.entityТипs?.includes(filters.entityТип)) continue;
        }
        rows.push({
          ...launcher,
          pluginId: contribution.pluginId,
          pluginКлюч: contribution.pluginКлюч,
          pluginDisplayИмя: contribution.displayИмя,
          pluginВерсия: contribution.version,
          uiEntryFile: contribution.uiEntryFile,
        });
      }
    }

    rows.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      const pluginCmp = a.pluginDisplayИмя.localeCompare(b.pluginDisplayИмя);
      if (pluginCmp !== 0) return pluginCmp;
      return a.displayИмя.localeCompare(b.displayИмя);
    });

    return rows;
  }, [data, filters.entityТип, placementZonesКлюч]);

  return {
    launchers,
    contributionsByPluginId,
    isЗагрузка: queryВключитьd && isЗагрузка,
    errorMessage: error ? getОшибкаMessage(error) : null,
  };
}

async function resolveLauncherComponent(
  contribution: PluginUiContribution,
  launcher: ResolvedPluginLauncher,
): Promise<RegisteredPluginComponent | null> {
  const exportИмя = launcher.action.target;
  const existing = resolveRegisteredPluginComponent(launcher.pluginКлюч, exportИмя);
  if (existing) return existing;
  await ensurePluginContributionLoaded(contribution);
  return resolveRegisteredPluginComponent(launcher.pluginКлюч, exportИмя);
}

/**
 * Область bridge calls to the currently rendered launcher host context.
 *
 * Hooks such as `useХостContext()`, `usePluginData()`, and `usePluginAction()`
 * consume this ambient context so the bridge can forward company/entity scope
 * and render-environment metadata to the plugin worker.
 */
function PluginLauncherBridgeОбласть({
  pluginId,
  hostContext,
  children,
}: {
  pluginId: string;
  hostContext: PluginХостContext;
  children: ReactНетde;
}) {
  const value = useMemo(() => ({ pluginId, hostContext }), [pluginId, hostContext]);

  return (
    <PluginBridgeContext.Провайдер value={value}>
      {children}
    </PluginBridgeContext.Провайдер>
  );
}

type LauncherОшибкаBoundaryProps = {
  launcher: ResolvedPluginLauncher;
  children: ReactНетde;
};

type LauncherОшибкаBoundaryState = {
  hasОшибка: boolean;
};

class LauncherОшибкаBoundary extends Component<LauncherОшибкаBoundaryProps, LauncherОшибкаBoundaryState> {
  override state: LauncherОшибкаBoundaryState = { hasОшибка: false };

  static getDerivedStateFromОшибка(): LauncherОшибкаBoundaryState {
    return { hasОшибка: true };
  }

  override componentDidCatch(error: unknown, info: ОшибкаInfo): void {
    console.error("Plugin launcher render failed", {
      pluginКлюч: this.props.launcher.pluginКлюч,
      launcherId: this.props.launcher.id,
      error,
      info: info.componentStack,
    });
  }

  override render() {
    if (this.state.hasОшибка) {
      return (
        <div classИмя="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {this.props.launcher.pluginDisplayИмя}: failed to render
        </div>
      );
    }
    return this.props.children;
  }
}

function LauncherRenderContent({
  instance,
  renderОкружение,
}: {
  instance: LauncherInstance;
  renderОкружение: PluginRenderОкружениеContext;
}) {
  const component = instance.component;
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId = session?.user?.id ?? session?.session?.userId ?? null;
  const hostContext = useMemo(
    () => buildLauncherХостContext(instance.hostContext, renderОкружение, userId),
    [instance.hostContext, renderОкружение, userId],
  );

  if (!component) {
    if (renderОкружение.environment === "iframe") {
      return (
        <iframe
          src={`/_plugins/${encodeURIComponent(instance.launcher.pluginId)}/ui/${instance.launcher.action.target}`}
          title={`${instance.launcher.pluginDisplayИмя} ${instance.launcher.displayИмя}`}
          classИмя="h-full min-h-[24rem] w-full rounded-md border border-border bg-background"
        />
      );
    }

    return (
      <div classИмя="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {instance.launcher.pluginDisplayИмя}: could not resolve launcher target "{instance.launcher.action.target}".
      </div>
    );
  }

  if (component.kind === "web-component") {
    return createElement(component.tagИмя, {
      classИмя: "block w-full",
      pluginLauncher: instance.launcher,
      pluginContext: hostContext,
    });
  }

  const node = createElement(component.component as never, {
    launcher: instance.launcher,
    context: hostContext,
  } as never);

  return (
    <LauncherОшибкаBoundary launcher={instance.launcher}>
      <PluginLauncherBridgeОбласть pluginId={instance.launcher.pluginId} hostContext={hostContext}>
        {node}
      </PluginLauncherBridgeОбласть>
    </LauncherОшибкаBoundary>
  );
}

function LauncherModalShell({
  instance,
  stackIndex,
  isTopmost,
  requestBounds,
  closeLauncher,
}: {
  instance: LauncherInstance;
  stackIndex: number;
  isTopmost: boolean;
  requestBounds: (key: string, request: PluginModalBoundsRequest) => Promise<void>;
  closeLauncher: (key: string, event: PluginRenderЗакрытьEvent) => Promise<void>;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isTopmost) return;
    const frame = requestAnimationFrame(() => {
      focusFirstElement(contentRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [isTopmost]);

  useEffect(() => {
    if (!isTopmost) return;
    const handleКлючDown = (event: КлючboardEvent) => {
      if (!contentRef.current) return;
      if (event.key === "Escape") {
        event.preventПо умолчанию();
        void closeLauncher(instance.key, { reason: "escapeКлюч", nativeEvent: event });
        return;
      }
      trapFocus(contentRef.current, event);
    };
    document.addEventListener("keydown", handleКлючDown);
    return () => document.removeEventListener("keydown", handleКлючDown);
  }, [closeLauncher, instance.key, isTopmost]);

  const renderОкружение = useMemo<PluginRenderОкружениеContext>(() => ({
    environment: instance.launcher.render?.environment ?? "hostOverlay",
    launcherId: instance.launcher.id,
    bounds: instance.bounds,
    requestModalBounds: (request) => requestBounds(instance.key, request),
    closeLifecycle: {
      onBeforeЗакрыть: (handler) => {
        instance.beforeЗакрытьHandlers.add(handler);
        return () => instance.beforeЗакрытьHandlers.delete(handler);
      },
      onЗакрыть: (handler) => {
        instance.closeHandlers.add(handler);
        return () => instance.closeHandlers.delete(handler);
      },
    },
  }), [instance, requestBounds]);

  const baseZ = launcherOverlayBaseZIndex + stackIndex * 20;
  // Keep each launcher in a deterministic z-index band so every stacked modal,
  // drawer, or popover retains its own backdrop/panel pairing.
  const shellТип = instance.launcher.action.type;
  const containerStyle = shellТип === "openPopover"
    ? launcherPopoverStyle(instance)
    : launcherShellBoundsStyle(instance.bounds);

  const panelClassИмя = shellТип === "openDrawer"
    ? "fixed right-0 top-0 h-full max-w-[min(44rem,100vw)] overflow-hidden border-l border-border bg-background shadow-2xl"
    : shellТип === "openPopover"
      ? "fixed overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      : "fixed left-1/2 top-1/2 max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl";

  return (
    <>
      <div
        classИмя="fixed inset-0 bg-black/45"
        style={{ zIndex: baseZ }}
        aria-hidden="true"
        onMouseDown={(event) => {
          if (!isTopmost) return;
          if (event.target !== event.currentЦель) return;
          void closeLauncher(instance.key, { reason: "backdrop", nativeEvent: event });
        }}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        classИмя={panelClassИмя}
        style={{
          zIndex: baseZ + 1,
          ...(shellТип === "openDrawer"
            ? { width: containerStyle.width ?? "min(44rem, 100vw)" }
            : containerStyle),
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div classИмя="flex items-center gap-3 border-b border-border px-4 py-3">
          <div classИмя="min-w-0">
            <h2 id={titleId} classИмя="truncate text-sm font-semibold">
              {instance.launcher.displayИмя}
            </h2>
            <p classИмя="truncate text-xs text-muted-foreground">
              {instance.launcher.pluginDisplayИмя}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            classИмя="ml-auto"
            onClick={() => void closeLauncher(instance.key, { reason: "programmatic" })}
          >
            Закрыть
          </Button>
        </div>
        <div
          classИмя={cn(
            "overflow-auto p-4",
            shellТип === "openDrawer" ? "h-[calc(100%-3.5rem)]" : "max-h-[calc(100vh-7rem)]",
          )}
        >
          <LauncherRenderContent instance={instance} renderОкружение={renderОкружение} />
        </div>
      </div>
    </>
  );
}

export function PluginLauncherПровайдер({ children }: { children: ReactНетde }) {
  const [stack, setStack] = useState<LauncherInstance[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const location = useLocation();
  const navigate = useNavigate();

  const closeLauncher = useCallback(
    async (key: string, event: PluginRenderЗакрытьEvent) => {
      const instance = stackRef.current.find((entry) => entry.key === key);
      if (!instance) return;

      for (const handler of [...instance.beforeЗакрытьHandlers]) {
        await handler(event);
      }

      setStack((current) => current.filter((entry) => entry.key !== key));

      queueMicrotask(() => {
        for (const handler of [...instance.closeHandlers]) {
          void handler(event);
        }
        if (instance.sourceElement && document.contains(instance.sourceElement)) {
          instance.sourceElement.focus();
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (stack.length === 0) return;
    void Promise.all(
      stack.map((entry) => closeLauncher(entry.key, { reason: "hostNavigation" })),
    );
    // Only react to navigation changes, not stack churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const requestBounds = useCallback(
    async (key: string, request: PluginModalBoundsRequest) => {
      // Bounds changes are host-validated. Unsupported presets are ignored so
      // plugin UI cannot push the shell into an undefined layout state.
      if (!isPluginLauncherBounds(request.bounds)) {
        return;
      }
      setStack((current) =>
        current.map((entry) =>
          entry.key === key
            ? { ...entry, bounds: request.bounds }
            : entry,
        ),
      );
    },
    [],
  );

  const activateLauncher = useCallback(
    async (
      launcher: ResolvedPluginLauncher,
      hostContext: PluginLauncherContext,
      contribution: PluginUiContribution,
      sourceEl?: HTMLElement | null,
    ) => {
      switch (launcher.action.type) {
        case "navigate":
          navigate(launcher.action.target);
          return;
        case "deepLink":
          if (/^https?:\/\//.test(launcher.action.target)) {
            window.open(launcher.action.target, "_blank", "noopener,noreferrer");
          } else {
            navigate(launcher.action.target);
          }
          return;
        case "performAction":
          await pluginsApi.bridgePerformAction(
            launcher.pluginId,
            launcher.action.target,
            launcher.action.params,
            hostContext.companyId ?? null,
          );
          return;
        case "openModal":
        case "openDrawer":
        case "openPopover": {
          const component = await resolveLauncherComponent(contribution, launcher);
          const sourceRect = sourceEl?.getBoundingClientRect() ?? null;
          const nextEntry: LauncherInstance = {
            key: `${launcher.pluginId}:${launcher.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            launcher,
            hostContext,
            contribution,
            component,
            sourceElement: sourceEl ?? null,
            sourceRect,
            bounds: launcher.render?.bounds ?? "default",
            beforeЗакрытьHandlers: new Set(),
            closeHandlers: new Set(),
          };
          setStack((current) => [...current, nextEntry]);
          return;
        }
      }
    },
    [navigate],
  );

  const value = useMemo<PluginLauncherЗапуститьtimeContextЗначение>(
    () => ({ activateLauncher }),
    [activateLauncher],
  );

  return (
    <PluginLauncherЗапуститьtimeContext.Провайдер value={value}>
      {children}
      {stack.map((instance, index) => (
        <LauncherModalShell
          key={instance.key}
          instance={instance}
          stackIndex={index}
          isTopmost={index === stack.length - 1}
          requestBounds={requestBounds}
          closeLauncher={closeLauncher}
        />
      ))}
    </PluginLauncherЗапуститьtimeContext.Провайдер>
  );
}

export function usePluginLauncherЗапуститьtime(): PluginLauncherЗапуститьtimeContextЗначение {
  const value = useContext(PluginLauncherЗапуститьtimeContext);
  if (!value) {
    throw new Ошибка("usePluginLauncherЗапуститьtime must be used within PluginLauncherПровайдер");
  }
  return value;
}

function По умолчаниюLauncherTrigger({
  launcher,
  placementZone,
  onClick,
}: {
  launcher: ResolvedPluginLauncher;
  placementZone: PluginLauncherPlacementZone;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Button
      type="button"
      variant={placementZone === "toolbarButton" || placementZone === "globalToolbarButton" ? "outline" : "ghost"}
      size="sm"
      classИмя={launcherTriggerClassИмя(placementZone)}
      onClick={onClick}
    >
      {launcher.displayИмя}
    </Button>
  );
}

type PluginLauncherOutletProps = {
  placementZones: PluginLauncherPlacementZone[];
  context: PluginLauncherContext;
  entityТип?: PluginUiSlotEntityТип | null;
  classИмя?: string;
  itemClassИмя?: string;
  errorClassИмя?: string;
};

export function PluginLauncherOutlet({
  placementZones,
  context,
  entityТип,
  classИмя,
  itemClassИмя,
  errorClassИмя,
}: PluginLauncherOutletProps) {
  const { activateLauncher } = usePluginLauncherЗапуститьtime();
  const { launchers, contributionsByPluginId, errorMessage } = usePluginLaunchers({
    placementZones,
    entityТип,
    companyId: context.companyId,
    enabled: !!context.companyId,
  });

  if (errorMessage) {
    return (
      <div classИмя={cn("rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive", errorClassИмя)}>
        Plugin launchers unavailable: {errorMessage}
      </div>
    );
  }

  if (launchers.length === 0) return null;

  return (
    <div classИмя={classИмя}>
      {launchers.map((launcher) => (
        <div key={`${launcher.pluginКлюч}:${launcher.id}`} classИмя={itemClassИмя}>
          <По умолчаниюLauncherTrigger
            launcher={launcher}
            placementZone={launcher.placementZone}
            onClick={(event) => {
              const contribution = contributionsByPluginId.get(launcher.pluginId);
              if (!contribution) return;
              void activateLauncher(launcher, context, contribution, event.currentЦель);
            }}
          />
        </div>
      ))}
    </div>
  );
}

type PluginLauncherButtonProps = {
  launcher: ResolvedPluginLauncher;
  context: PluginLauncherContext;
  contribution: PluginUiContribution;
  classИмя?: string;
  onActivated?: () => void;
};

export function PluginLauncherButton({
  launcher,
  context,
  contribution,
  classИмя,
  onActivated,
}: PluginLauncherButtonProps) {
  const { activateLauncher } = usePluginLauncherЗапуститьtime();

  return (
    <div classИмя={classИмя}>
      <По умолчаниюLauncherTrigger
        launcher={launcher}
        placementZone={launcher.placementZone}
        onClick={(event) => {
          event.preventПо умолчанию();
          onActivated?.();
          void activateLauncher(launcher, context, contribution, event.currentЦель);
        }}
      />
    </div>
  );
}
