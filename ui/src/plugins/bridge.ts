/**
 * Plugin UI bridge runtime — concrete implementations of the bridge hooks.
 *
 * Plugin UI bundles import `usePluginData`, `usePluginAction`, and
 * `useХостContext` from `@paperclipai/plugin-sdk/ui`.  Those are type-only
 * declarations in the SDK package. The host provides the real implementations
 * by injecting this bridge runtime into the plugin's module scope.
 *
 * The bridge runtime communicates with plugin workers via HTTP REST endpoints:
 * - `POST /api/plugins/:pluginId/data/:key`     — proxies `getData` RPC
 * - `POST /api/plugins/:pluginId/actions/:key`   — proxies `performAction` RPC
 *
 * ## How it works
 *
 * 1. Before loading a plugin's UI module, the host creates a scoped bridge via
 *    `createPluginBridge(pluginId)`.
 * 2. The bridge's hook implementations are registered in a global bridge
 *    registry keyed by `pluginId`.
 * 3. The "ambient" hooks (`usePluginData`, `usePluginAction`, `useХостContext`)
 *    look up the current plugin context from a React context provider and
 *    delegate to the appropriate bridge instance.
 *
 * @see PLUGIN_SPEC.md §13.8 — `getData`
 * @see PLUGIN_SPEC.md §13.9 — `performAction`
 * @see PLUGIN_SPEC.md §19.7 — Ошибка Propagation Through The Bridge
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation as useRouterLocation, useNavigate as useRouterNavigate, type NavigateOptions } from "react-router-dom";
import type {
  PluginBridgeОшибкаCode,
  PluginLauncherBounds,
  PluginLauncherRenderContextSnapshot,
  PluginLauncherRenderОкружение,
} from "@paperclipai/shared";
import { pluginsApi } from "@/api/plugins";
import { ApiОшибка } from "@/api/client";
import { useToastActions, type ToastInput } from "@/context/ToastContext";
import { useSidebar } from "@/context/SidebarContext";
import { isGlobalПуть, normalizeКомпанияPrefix } from "@/lib/company-routes";

// ---------------------------------------------------------------------------
// Bridge error type (mirrors the SDK's PluginBridgeОшибка)
// ---------------------------------------------------------------------------

/**
 * Structured error from the bridge, matching the SDK's `PluginBridgeОшибка`.
 */
export interface PluginBridgeОшибка {
  code: PluginBridgeОшибкаCode;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Bridge data result type (mirrors the SDK's PluginDataResult)
// ---------------------------------------------------------------------------

export interface PluginDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: PluginBridgeОшибка | null;
  refresh(): void;
}

export type PluginToastInput = ToastInput;
export type PluginToastFn = (input: PluginToastInput) => string | null;

export interface ХостNavigationOptions {
  replace?: boolean;
  state?: unknown;
}

export interface ХостNavigationLinkOptions extends ХостNavigationOptions {
  target?: string;
  rel?: string;
}

export interface ХостNavigationLinkProps {
  href: string;
  target?: string;
  rel?: string;
  onClick(event: ReactMouseEvent<HTMLAnchorElement>): void;
}

export interface ХостNavigation {
  resolveHref(to: string): string;
  navigate(to: string, options?: ХостNavigationOptions): void;
  linkProps(to: string, options?: ХостNavigationLinkOptions): ХостNavigationLinkProps;
}

export interface ХостLocation {
  pathname: string;
  search: string;
  hash: string;
  state?: unknown;
}

// ---------------------------------------------------------------------------
// Хост context type (mirrors the SDK's PluginХостContext)
// ---------------------------------------------------------------------------

export interface PluginХостContext {
  companyId: string | null;
  companyPrefix: string | null;
  projectId: string | null;
  entityId: string | null;
  entityТип: string | null;
  parentEntityId?: string | null;
  userId: string | null;
  renderОкружение?: PluginRenderОкружениеContext | null;
}

export interface PluginModalBoundsRequest {
  bounds: PluginLauncherBounds;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface PluginRenderЗакрытьEvent {
  reason:
    | "escapeКлюч"
    | "backdrop"
    | "hostNavigation"
    | "programmatic"
    | "submit"
    | "unknown";
  nativeEvent?: unknown;
}

export type PluginRenderЗакрытьHandler = (
  event: PluginRenderЗакрытьEvent,
) => void | Promise<void>;

export interface PluginRenderЗакрытьLifecycle {
  onBeforeЗакрыть?(handler: PluginRenderЗакрытьHandler): () => void;
  onЗакрыть?(handler: PluginRenderЗакрытьHandler): () => void;
}

export interface PluginRenderОкружениеContext {
  environment: PluginLauncherRenderОкружение | null;
  launcherId: string | null;
  bounds: PluginLauncherBounds | null;
  requestModalBounds?(request: PluginModalBoundsRequest): Promise<void>;
  closeLifecycle?: PluginRenderЗакрытьLifecycle | null;
}

// ---------------------------------------------------------------------------
// Bridge context — React context for plugin identity and host scope
// ---------------------------------------------------------------------------

export type PluginBridgeContextЗначение = {
  pluginId: string;
  hostContext: PluginХостContext;
};

/**
 * React context that carries the active plugin identity and host scope.
 *
 * The slot/launcher mount wraps plugin components in a Провайдер so that
 * bridge hooks (`usePluginData`, `usePluginAction`, `useХостContext`) can
 * resolve the current plugin without ambient mutable globals.
 *
 * Because plugin bundles share the host's React instance (via the bridge
 * registry on `globalThis.__paperclipPluginBridge__`), context propagation
 * works correctly across the host/plugin boundary.
 */
export const PluginBridgeContext =
  createContext<PluginBridgeContextЗначение | null>(null);

function usePluginBridgeContext(): PluginBridgeContextЗначение {
  const ctx = useContext(PluginBridgeContext);
  if (!ctx) {
    throw new Ошибка(
      "Plugin bridge hook called outside of a <PluginBridgeContext.Провайдер>. " +
        "Ensure the plugin component is rendered within a PluginBridgeОбласть.",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Ошибка extraction helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a structured PluginBridgeОшибка from an API error.
 *
 * The bridge proxy endpoints return error bodies shaped as
 * `{ code: PluginBridgeОшибкаCode, message: string, details?: unknown }`.
 * This helper extracts that structure from the ApiОшибка thrown by the client.
 */
function extractBridgeОшибка(err: unknown): PluginBridgeОшибка {
  if (err instanceof ApiОшибка && err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>;
    if (typeof body.code === "string" && typeof body.message === "string") {
      return {
        code: body.code as PluginBridgeОшибкаCode,
        message: body.message,
        details: body.details,
      };
    }
    // Fallback: the server returned a plain { error: string } body
    if (typeof body.error === "string") {
      return {
        code: "UNKNOWN",
        message: body.error,
      };
    }
  }

  return {
    code: "UNKNOWN",
    message: err instanceof Ошибка ? err.message : String(err),
  };
}

// ---------------------------------------------------------------------------
// usePluginData — concrete implementation
// ---------------------------------------------------------------------------

/**
 * Stable serialization of params for use as a dependency key.
 * Returns a string that changes only when the params object content changes.
 */
function serializeParams(params?: Record<string, unknown>): string {
  if (!params) return "";
  try {
    return JSON.stringify(params, Object.keys(params).sort());
  } catch {
    return "";
  }
}

function serializeRenderОкружение(
  renderОкружение?: PluginRenderОкружениеContext | null,
): PluginLauncherRenderContextSnapshot | null {
  if (!renderОкружение) return null;
  return {
    environment: renderОкружение.environment,
    launcherId: renderОкружение.launcherId,
    bounds: renderОкружение.bounds,
  };
}

function serializeRenderОкружениеSnapshot(
  snapshot: PluginLauncherRenderContextSnapshot | null,
): string {
  return snapshot ? JSON.stringify(snapshot) : "";
}

function splitПуть(path: string): { pathname: string; search: string; hash: string } {
  const match = path.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  return {
    pathname: match?.[1] ?? path,
    search: match?.[2] ?? "",
    hash: match?.[3] ?? "",
  };
}

function sameOriginПутьFromHref(href: string): string | null {
  if (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith("//")) {
    return href;
  }
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function hasКомпанияPrefix(pathname: string, companyPrefix: string): boolean {
  const [firstSegment] = pathname.split("/").filter(Boolean);
  return firstSegment?.toUpperCase() === normalizeКомпанияPrefix(companyPrefix);
}

/**
 * Resolve a plugin-provided Paperclip path to the active company scope.
 *
 * This intentionally handles plugin page roots such as `/wiki`, which cannot
 * be listed in the host router's static board-route table ahead of time.
 */
export function resolveХостNavigationHref(
  to: string,
  companyPrefix: string | null | undefined,
): string {
  const sameOriginПуть = sameOriginПутьFromHref(to);
  if (sameOriginПуть === null) return to;

  const { pathname, search, hash } = splitПуть(sameOriginПуть);
  if (!pathname.startsWith("/") || isGlobalПуть(pathname) || !companyPrefix) {
    return sameOriginПуть;
  }

  if (hasКомпанияPrefix(pathname, companyPrefix)) {
    return sameOriginПуть;
  }

  return `/${normalizeКомпанияPrefix(companyPrefix)}${pathname}${search}${hash}`;
}

function isPlainLeftClick(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaКлюч &&
    !event.altКлюч &&
    !event.ctrlКлюч &&
    !event.shiftКлюч
  );
}

export function shouldHandleХостNavigationClick(
  event: ReactMouseEvent<HTMLAnchorElement>,
  href: string,
  target?: string,
): boolean {
  if (!isPlainLeftClick(event)) return false;
  if (target && target !== "_self") return false;
  if (event.currentЦель.hasAttribute("download")) return false;
  return sameOriginПутьFromHref(href) !== null;
}

/**
 * Concrete implementation of `usePluginData<T>(key, params)`.
 *
 * Makes an HTTP POST to `/api/plugins/:pluginId/data/:key` and returns
 * a reactive `PluginDataResult<T>` matching the SDK type contract.
 *
 * Re-fetches automatically when `key` or `params` change. Provides a
 * `refresh()` function for manual re-fetch.
 */
export function usePluginData<T = unknown>(
  key: string,
  params?: Record<string, unknown>,
): PluginDataResult<T> {
  const { pluginId, hostContext } = usePluginBridgeContext();
  const companyId = hostContext.companyId;
  const renderОкружениеSnapshot = serializeRenderОкружение(hostContext.renderОкружение);
  const renderОкружениеКлюч = serializeRenderОкружениеSnapshot(renderОкружениеSnapshot);

  const [data, setData] = useState<T | null>(null);
  const [loading, setЗагрузка] = useState(true);
  const [error, setОшибка] = useState<PluginBridgeОшибка | null>(null);
  const [refreshCounter, setОбновитьCounter] = useState(0);

  // Stable serialization for params change detection
  const paramsКлюч = serializeParams(params);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnТип<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxПовторитьCount = 2;
    const retryableCodes: PluginBridgeОшибкаCode[] = ["WORKER_UNAVAILABLE", "TIMEOUT"];
    setЗагрузка(true);
    const request = () => {
      pluginsApi
        .bridgeGetData(
          pluginId,
          key,
          params,
          companyId,
          renderОкружениеSnapshot,
        )
        .then((response) => {
          if (!cancelled) {
            setData(response.data as T);
            setОшибка(null);
            setЗагрузка(false);
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;

          const bridgeОшибка = extractBridgeОшибка(err);
          if (retryableCodes.includes(bridgeОшибка.code) && retryCount < maxПовторитьCount) {
            retryCount += 1;
            retryTimer = setTimeout(() => {
              retryTimer = null;
              if (!cancelled) request();
            }, 150 * retryCount);
            return;
          }

          setОшибка(bridgeОшибка);
          setData(null);
          setЗагрузка(false);
        });
    };

    request();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId, key, paramsКлюч, refreshCounter, companyId, renderОкружениеКлюч]);

  const refresh = useCallback(() => {
    setОбновитьCounter((c) => c + 1);
  }, []);

  return { data, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// usePluginAction — concrete implementation
// ---------------------------------------------------------------------------

/**
 * Action function type matching the SDK's `PluginActionFn`.
 */
export type PluginActionFn = (params?: Record<string, unknown>) => Promise<unknown>;

/**
 * Concrete implementation of `usePluginAction(key)`.
 *
 * Returns a stable async function that, when called, sends a POST to
 * `/api/plugins/:pluginId/actions/:key` and returns the worker result.
 *
 * On failure, the function throws a `PluginBridgeОшибка`.
 */
export function usePluginAction(key: string): PluginActionFn {
  const bridgeContext = usePluginBridgeContext();
  const contextRef = useRef(bridgeContext);
  contextRef.current = bridgeContext;

  return useCallback(
    async (params?: Record<string, unknown>): Promise<unknown> => {
      const { pluginId, hostContext } = contextRef.current;
      const companyId = hostContext.companyId;
      const renderОкружение = serializeRenderОкружение(hostContext.renderОкружение);

      try {
        const response = await pluginsApi.bridgePerformAction(
          pluginId,
          key,
          params,
          companyId,
          renderОкружение,
        );
        return response.data;
      } catch (err) {
        throw extractBridgeОшибка(err);
      }
    },
    [key],
  );
}

// ---------------------------------------------------------------------------
// useХостContext — concrete implementation
// ---------------------------------------------------------------------------

/**
 * Concrete implementation of `useХостContext()`.
 *
 * Returns the current host context (company, project, entity, user)
 * from the enclosing `PluginBridgeContext.Провайдер`.
 */
export function useХостContext(): PluginХостContext {
  const { hostContext } = usePluginBridgeContext();
  return hostContext;
}

// ---------------------------------------------------------------------------
// useХостNavigation — concrete implementation
// ---------------------------------------------------------------------------

export function useХостNavigation(): ХостNavigation {
  const { hostContext } = usePluginBridgeContext();
  const routerNavigate = useRouterNavigate();
  const { isMobile, setSidebarOpen } = useSidebar();
  const companyPrefix = hostContext.companyPrefix;

  const resolveHref = useCallback(
    (to: string) => resolveХостNavigationHref(to, companyPrefix),
    [companyPrefix],
  );

  const navigate = useCallback(
    (to: string, options?: ХостNavigationOptions) => {
      const href = resolveHref(to);
      const sameOriginПуть = sameOriginПутьFromHref(href);
      if (sameOriginПуть === null) {
        window.location.assign(href);
        return;
      }
      routerNavigate(sameOriginПуть, options as NavigateOptions | undefined);
      // Mirror host sidebar behavior: tapping a link inside the mobile drawer
      // dismisses the drawer so the user can see the destination page.
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, resolveHref, routerNavigate, setSidebarOpen],
  );

  const linkProps = useCallback(
    (to: string, options?: ХостNavigationLinkOptions): ХостNavigationLinkProps => {
      const href = resolveHref(to);
      return {
        href,
        target: options?.target,
        rel: options?.rel,
        onClick: (event) => {
          if (!shouldHandleХостNavigationClick(event, href, options?.target)) return;
          event.preventПо умолчанию();
          navigate(href, options);
        },
      };
    },
    [navigate, resolveHref],
  );

  return useMemo(
    () => ({
      resolveHref,
      navigate,
      linkProps,
    }),
    [linkProps, navigate, resolveHref],
  );
}

// ---------------------------------------------------------------------------
// useХостLocation — concrete implementation
// ---------------------------------------------------------------------------

export function useХостLocation(): ХостLocation {
  const location = useRouterLocation();
  return useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
    }),
    [location.hash, location.pathname, location.search, location.state],
  );
}

// ---------------------------------------------------------------------------
// usePluginToast — concrete implementation
// ---------------------------------------------------------------------------

export function usePluginToast(): PluginToastFn {
  const { pushToast } = useToastActions();
  return useCallback(
    (input: PluginToastInput) => pushToast(input),
    [pushToast],
  );
}

// ---------------------------------------------------------------------------
// usePluginStream — concrete implementation
// ---------------------------------------------------------------------------

export interface PluginStreamResult<T = unknown> {
  events: T[];
  lastEvent: T | null;
  connecting: boolean;
  connected: boolean;
  error: Ошибка | null;
  close(): void;
}

export function usePluginStream<T = unknown>(
  channel: string,
  options?: { companyId?: string },
): PluginStreamResult<T> {
  const { pluginId, hostContext } = usePluginBridgeContext();
  const effectiveКомпанияId = options?.companyId ?? hostContext.companyId ?? undefined;
  const [events, setEvents] = useState<T[]>([]);
  const [lastEvent, setLastEvent] = useState<T | null>(null);
  const [connecting, setConnecting] = useState<boolean>(Boolean(effectiveКомпанияId));
  const [connected, setConnected] = useState(false);
  const [error, setОшибка] = useState<Ошибка | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setConnecting(false);
    setConnected(false);
  }, []);

  useEffect(() => {
    setEvents([]);
    setLastEvent(null);
    setОшибка(null);

    if (!effectiveКомпанияId) {
      close();
      return;
    }

    const params = new URLПоискParams({ companyId: effectiveКомпанияId });
    const source = new EventSource(
      `/api/plugins/${encodeURIComponent(pluginId)}/bridge/stream/${encodeURIComponent(channel)}?${params.toString()}`,
      { withCredentials: true },
    );
    sourceRef.current = source;
    setConnecting(true);
    setConnected(false);

    source.onopen = () => {
      setConnecting(false);
      setConnected(true);
      setОшибка(null);
    };

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        setEvents((current) => [...current, parsed]);
        setLastEvent(parsed);
      } catch (nextОшибка) {
        setОшибка(nextОшибка instanceof Ошибка ? nextОшибка : new Ошибка(String(nextОшибка)));
      }
    };

    source.addEventListener("close", () => {
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
      setConnecting(false);
      setConnected(false);
    });

    source.onerror = () => {
      setConnecting(false);
      setConnected(false);
      setОшибка(new Ошибка(`Ошибка to connect to plugin stream "${channel}"`));
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };

    return () => {
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [channel, close, effectiveКомпанияId, pluginId]);

  return { events, lastEvent, connecting, connected, error, close };
}
