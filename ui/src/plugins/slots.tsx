/**
 * @fileoverview Plugin UI slot system — dynamic loading, error isolation,
 * and rendering of plugin-contributed UI extensions.
 *
 * Provides:
 * - `usePluginSlots(type, context?)` — React hook that discovers and
 *   filters plugin UI contributions for a given slot type.
 * - `PluginSlotOutlet` — renders all matching slots inline with error
 *   boundary isolation per plugin.
 * - `PluginBridgeОбласть` — wraps each plugin's component tree to inject
 *   the bridge context (`pluginId`, host context) needed by bridge hooks.
 *
 * Plugin UI modules are loaded via dynamic ESM `import()` from the host's
 * static file server (`/_plugins/:pluginId/ui/:entryFile`). Each module
 * exports named React components that correspond to `ui.slots[].exportИмя`
 * in the manifest.
 *
 * @see PLUGIN_SPEC.md §19 — UI Extension Модель
 * @see PLUGIN_SPEC.md §19.0.3 — Bundle Serving
 */
import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ОшибкаInfo,
  type ReactНетde,
  type ComponentТип,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PluginLauncherDeclaration,
  PluginUiSlotDeclaration,
  PluginUiSlotEntityТип,
  PluginUiSlotТип,
} from "@paperclipai/shared";
import { pluginsApi, type PluginUiContribution } from "@/api/plugins";
import { authApi } from "@/api/auth";
import { queryКлючs } from "@/lib/queryКлючs";
import { cn } from "@/lib/utils";
import {
  PluginBridgeContext,
  type PluginХостContext,
} from "./bridge";

export type PluginSlotContext = {
  companyId?: string | null;
  companyPrefix?: string | null;
  projectId?: string | null;
  entityId?: string | null;
  entityТип?: PluginUiSlotEntityТип | null;
  /** Родитель entity ID for nested slots (e.g. comment annotations within an issue). */
  parentEntityId?: string | null;
  projectRef?: string | null;
};

export type ResolvedPluginSlot = PluginUiSlotDeclaration & {
  pluginId: string;
  pluginКлюч: string;
  pluginDisplayИмя: string;
  pluginВерсия: string;
};

/**
 * Returns the unique `routeSidebar` slot that pairs with a single `page` slot
 * for the given route, or `null` if no unambiguous pairing exists.
 *
 * Used to detect when a route is taken over by a plugin's full-page sidebar so
 * host chrome (breadcrumb, in-page Назад) can be suppressed.
 */
export function resolveRouteSidebarSlot(
  slots: ResolvedPluginSlot[],
  routeПуть: string | null,
): ResolvedPluginSlot | null {
  if (!routeПуть) return null;

  const pageMatches = slots.filter((slot) => slot.type === "page" && slot.routeПуть === routeПуть);
  if (pageMatches.length !== 1) return null;

  const [pageSlot] = pageMatches;
  const sidebarMatches = slots.filter((slot) =>
    slot.type === "routeSidebar"
    && slot.routeПуть === routeПуть
    && slot.pluginId === pageSlot.pluginId,
  );

  if (sidebarMatches.length !== 1) return null;
  return sidebarMatches[0] ?? null;
}

type PluginSlotComponentProps = {
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
};

export type RegisteredPluginComponent =
  | {
    kind: "react";
    component: ComponentТип<PluginSlotComponentProps>;
  }
  | {
    kind: "web-component";
    tagИмя: string;
  };

type SlotФильтрs = {
  slotТипs: PluginUiSlotТип[];
  entityТип?: PluginUiSlotEntityТип | null;
  companyId?: string | null;
  enabled?: boolean;
};

type UsePluginSlotsResult = {
  slots: ResolvedPluginSlot[];
  isЗагрузка: boolean;
  errorMessage: string | null;
};

/**
 * In-memory registry for plugin UI exports loaded by the host page.
 * Ключs are `${pluginКлюч}:${exportИмя}` to match manifest slot declarations.
 */
const registry = new Map<string, RegisteredPluginComponent>();

function buildRegistryКлюч(pluginКлюч: string, exportИмя: string): string {
  return `${pluginКлюч}:${exportИмя}`;
}

function requiresEntityТип(slotТип: PluginUiSlotТип): boolean {
  return slotТип === "detailTab" || slotТип === "taskDetailView" || slotТип === "contextMenuItem" || slotТип === "commentAnnotation" || slotТип === "commentContextMenuItem" || slotТип === "projectSidebarItem" || slotТип === "toolbarButton";
}

function getОшибкаMessage(error: unknown): string {
  if (error instanceof Ошибка && error.message) return error.message;
  return "Неизвестно error";
}

/**
 * Registers a React component export for a plugin UI slot.
 */
export function registerPluginReactComponent(
  pluginКлюч: string,
  exportИмя: string,
  component: ComponentТип<PluginSlotComponentProps>,
): void {
  registry.set(buildRegistryКлюч(pluginКлюч, exportИмя), {
    kind: "react",
    component,
  });
}

/**
 * Registers a custom element tag for a plugin UI slot.
 */
export function registerPluginWebComponent(
  pluginКлюч: string,
  exportИмя: string,
  tagИмя: string,
): void {
  registry.set(buildRegistryКлюч(pluginКлюч, exportИмя), {
    kind: "web-component",
    tagИмя,
  });
}

function resolveRegisteredComponent(slot: ResolvedPluginSlot): RegisteredPluginComponent | null {
  return registry.get(buildRegistryКлюч(slot.pluginКлюч, slot.exportИмя)) ?? null;
}

export function resolveRegisteredPluginComponent(
  pluginКлюч: string,
  exportИмя: string,
): RegisteredPluginComponent | null {
  return registry.get(buildRegistryКлюч(pluginКлюч, exportИмя)) ?? null;
}

// ---------------------------------------------------------------------------
// Plugin module dynamic import loader
// ---------------------------------------------------------------------------

type PluginLoadState = "idle" | "loading" | "loaded" | "error";

/**
 * Tracks the load state for each plugin's UI module by contribution cache key.
 *
 * Once a plugin module is loaded, all its named exports are inspected and
 * registered into the component `registry` so that `resolveRegisteredComponent`
 * can find them when slots render.
 */
const pluginLoadStates = new Map<string, PluginLoadState>();

/**
 * Promise cache to prevent concurrent duplicate imports for the same plugin.
 */
const inflightИмпортs = new Map<string, Promise<void>>();

/**
 * Build the full URL for a plugin's UI entry module.
 *
 * The server serves plugin UI bundles at `/_plugins/:pluginId/ui/*`.
 * The `uiEntryFile` from the contribution (typically `"index.js"`) is
 * appended to form the complete import path.
 */
function buildPluginModuleКлюч(contribution: PluginUiContribution): string {
  const cacheHint = contribution.updatedAt ?? contribution.version ?? "0";
  return `${contribution.pluginId}:${cacheHint}`;
}

function buildPluginUiUrl(contribution: PluginUiContribution): string {
  const cacheHint = encodeURIComponent(contribution.updatedAt ?? contribution.version ?? "0");
  return `/_plugins/${encodeURIComponent(contribution.pluginId)}/ui/${contribution.uiEntryFile}?v=${cacheHint}`;
}

/**
 * Импорт a plugin's UI entry module with bare-specifier rewriting.
 *
 * Plugin bundles are built with `external: ["@paperclipai/plugin-sdk/ui", "react", "react-dom"]`,
 * so their ESM output contains bare specifier imports like:
 *
 * ```js
 * import { usePluginData } from "@paperclipai/plugin-sdk/ui";
 * import React from "react";
 * ```
 *
 * Browsers cannot resolve bare specifiers without an import map. Rather than
 * fighting import map timing constraints, we:
 * 1. Fetch the module source text
 * 2. Rewrite bare specifier imports to use blob URLs that re-export from the
 *    host's global bridge registry (`globalThis.__paperclipPluginBridge__`)
 * 3. Импорт the rewritten module via a blob URL
 *
 * This approach is compatible with all modern browsers and avoids import map
 * ordering issues.
 */
const shimBlobUrls: Record<string, string> = {};

function applyJsxЗапуститьtimeКлюч(
  props: Record<string, unknown> | null | undefined,
  key: string | number | undefined,
): Record<string, unknown> {
  if (key === undefined) return props ?? {};
  return { ...(props ?? {}), key };
}

function getShimBlobUrl(specifier: "react" | "react-dom" | "react-dom/client" | "react/jsx-runtime" | "sdk-ui"): string {
  if (shimBlobUrls[specifier]) return shimBlobUrls[specifier];

  let source: string;
  switch (specifier) {
    case "react":
      source = `
        const R = globalThis.__paperclipPluginBridge__?.react;
        export default R;
        const { useState, useEffect, useCallback, useMemo, useRef, useContext,
          createContext, createElement, Fragment, Component, forwardRef,
          memo, lazy, Suspense, StrictMode, cloneElement, Children,
          isValidElement, createRef } = R;
        export { useState, useEffect, useCallback, useMemo, useRef, useContext,
          createContext, createElement, Fragment, Component, forwardRef,
          memo, lazy, Suspense, StrictMode, cloneElement, Children,
          isValidElement, createRef };
      `;
      break;
    case "react/jsx-runtime":
      source = `
        const R = globalThis.__paperclipPluginBridge__?.react;
        const withКлюч = ${applyJsxЗапуститьtimeКлюч.toString()};
        export const jsx = (type, props, key) => R.createElement(type, withКлюч(props, key));
        export const jsxs = (type, props, key) => R.createElement(type, withКлюч(props, key));
        export const Fragment = R.Fragment;
      `;
      break;
    case "react-dom":
    case "react-dom/client":
      source = `
        const RD = globalThis.__paperclipPluginBridge__?.reactDom;
        export default RD;
        const { createRoot, hydrateRoot, createПортal, flushSync } = RD ?? {};
        export { createRoot, hydrateRoot, createПортal, flushSync };
      `;
      break;
    case "sdk-ui":
      source = `
        const SDK = globalThis.__paperclipPluginBridge__?.sdkUi ?? {};
        function missing(name) {
          return function MissingPaperclipSdkUiComponent() {
            throw new Ошибка('Paperclip plugin UI runtime is not initialized for "' + name + '". Ensure the host loaded the plugin bridge before rendering this UI module.');
          };
        }
        const { usePluginData, usePluginAction, useХостContext, useХостLocation, useХостNavigation, usePluginStream, usePluginToast } = SDK;
        const MetricCard = SDK.MetricCard ?? missing("MetricCard");
        const СтатусBadge = SDK.СтатусBadge ?? missing("СтатусBadge");
        const DataTable = SDK.DataTable ?? missing("DataTable");
        const TimeseriesChart = SDK.TimeseriesChart ?? missing("TimeseriesChart");
        const MarkdownBlock = SDK.MarkdownBlock ?? missing("MarkdownBlock");
        const MarkdownИзменитьor = SDK.MarkdownИзменитьor ?? missing("MarkdownИзменитьor");
        const КлючЗначениеList = SDK.КлючЗначениеList ?? missing("КлючЗначениеList");
        const ActionBar = SDK.ActionBar ?? missing("ActionBar");
        const LogView = SDK.LogView ?? missing("LogView");
        const JsonTree = SDK.JsonTree ?? missing("JsonTree");
        const Spinner = SDK.Spinner ?? missing("Spinner");
        const ОшибкаBoundary = SDK.ОшибкаBoundary ?? missing("ОшибкаBoundary");
        const FileTree = SDK.FileTree ?? missing("FileTree");
        const ЗадачиList = SDK.ЗадачиList ?? missing("ЗадачиList");
        const ИсполнительPicker = SDK.ИсполнительPicker ?? missing("ИсполнительPicker");
        const ProjectPicker = SDK.ProjectPicker ?? missing("ProjectPicker");
        const ManagedПроцедурыList = SDK.ManagedПроцедурыList ?? missing("ManagedПроцедурыList");
        export { usePluginData, usePluginAction, useХостContext, useХостLocation, useХостNavigation, usePluginStream, usePluginToast, MetricCard, СтатусBadge, DataTable, TimeseriesChart, MarkdownBlock, MarkdownИзменитьor, КлючЗначениеList, ActionBar, LogView, JsonTree, Spinner, ОшибкаBoundary, FileTree, ЗадачиList, ИсполнительPicker, ProjectPicker, ManagedПроцедурыList };
      `;
      break;
  }

  const blob = new Blob([source], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  shimBlobUrls[specifier] = url;
  return url;
}

/**
 * Rewrite bare specifier imports in an ESM source string to use blob URLs.
 *
 * This handles the standard import patterns emitted by esbuild/rollup:
 * - `import { ... } from "react";`
 * - `import React from "react";`
 * - `import * as React from "react";`
 * - `import { ... } from "@paperclipai/plugin-sdk/ui";`
 *
 * Also handles re-exports:
 * - `export { ... } from "react";`
 */
function rewriteBareSpecifiers(source: string): string {
  // Build a mapping of bare specifiers to blob URLs.
  const rewrites: Record<string, string> = {
    '"@paperclipai/plugin-sdk/ui"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@paperclipai/plugin-sdk/ui'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"@paperclipai/plugin-sdk/ui/hooks"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@paperclipai/plugin-sdk/ui/hooks'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"react/jsx-runtime"': `"${getShimBlobUrl("react/jsx-runtime")}"`,
    "'react/jsx-runtime'": `'${getShimBlobUrl("react/jsx-runtime")}'`,
    '"react-dom/client"': `"${getShimBlobUrl("react-dom/client")}"`,
    "'react-dom/client'": `'${getShimBlobUrl("react-dom/client")}'`,
    '"react-dom"': `"${getShimBlobUrl("react-dom")}"`,
    "'react-dom'": `'${getShimBlobUrl("react-dom")}'`,
    '"react"': `"${getShimBlobUrl("react")}"`,
    "'react'": `'${getShimBlobUrl("react")}'`,
  };

  let result = source;
  for (const [from, to] of Object.entries(rewrites)) {
    // Only rewrite in import/export from contexts, not in arbitrary strings.
    // The regex matches `from "..."` or `from '...'` patterns.
    result = result.replaceВсе(` from ${from}`, ` from ${to}`);
    // Also handle `import "..."` (side-effect imports)
    result = result.replaceВсе(`import ${from}`, `import ${to}`);
  }

  return result;
}

/**
 * Fetch, rewrite, and import a plugin UI module.
 *
 * @param url - The URL to the plugin's UI entry module
 * @returns The module's exports
 */
async function importPluginModule(url: string): Promise<Record<string, unknown>> {
  // Check if the bridge registry is available. If not, fall back to direct
  // import (which will fail on bare specifiers but won't crash the loader).
  if (!globalThis.__paperclipPluginBridge__) {
    console.warn("[plugin-loader] Bridge registry not initialized, falling back to direct import");
    return import(/* @vite-ignore */ url);
  }

  // Fetch the module source text
  const response = await fetch(url);
  if (!response.ok) {
    throw new Ошибка(`Ошибка to fetch plugin module: ${response.status} ${response.statusText}`);
  }

  const source = await response.text();

  // Rewrite bare specifier imports to blob URLs
  const rewritten = rewriteBareSpecifiers(source);

  // Создать a blob URL from the rewritten source and import it
  const blob = new Blob([rewritten], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    return mod;
  } finally {
    // Clean up the blob URL after import (the module is already loaded)
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Dynamically import a plugin's UI entry module and register all named
 * exports that look like React components (functions or classes) into the
 * component registry.
 *
 * This replaces the previous approach where plugin bundles had to
 * self-register via `window.paperclipPlugins.registerReactComponent()`.
 * Сейчас the host is responsible for importing the module and binding
 * exports to the correct `pluginКлюч:exportИмя` registry keys.
 *
 * Plugin modules are loaded with bare-specifier rewriting so that imports
 * of `@paperclipai/plugin-sdk/ui`, `react`, and `react-dom` resolve to the
 * host-provided implementations via the bridge registry.
 *
 * Web-component registrations still work: if the module has a named export
 * that matches an `exportИмя` declared in a slot AND that export is a
 * string (the custom element tag name), it's registered as a web component.
 */
async function loadPluginModule(contribution: PluginUiContribution): Promise<void> {
  const { pluginId, pluginКлюч, slots, launchers } = contribution;
  const moduleКлюч = buildPluginModuleКлюч(contribution);

  // Already loaded or loading — return early.
  const state = pluginLoadStates.get(moduleКлюч);
  if (state === "loaded" || state === "loading") {
    // If currently loading, wait for the inflight promise.
    const inflight = inflightИмпортs.get(pluginId);
    if (inflight) await inflight;
    return;
  }

  // If another import for this plugin ID is currently in progress, wait for it.
  const running = inflightИмпортs.get(pluginId);
  if (running) {
    await running;
    const recheckedState = pluginLoadStates.get(moduleКлюч);
    if (recheckedState === "loaded") {
      return;
    }
  }

  pluginLoadStates.set(moduleКлюч, "loading");

  const url = buildPluginUiUrl(contribution);

  const importPromise = (async () => {
    try {
      // Dynamic ESM import of the plugin's UI entry module with
      // bare-specifier rewriting for host-provided dependencies.
      const mod: Record<string, unknown> = await importPluginModule(url);

      // Collect the set of export names declared across all UI contributions so
      // we only register what the manifest advertises (ignore extra exports).
      const declaredЭкспортs = new Set<string>();
      for (const slot of slots) {
        declaredЭкспортs.add(slot.exportИмя);
      }
      for (const launcher of launchers) {
        if (launcher.exportИмя) {
          declaredЭкспортs.add(launcher.exportИмя);
        }
        if (isLauncherComponentЦель(launcher)) {
          declaredЭкспортs.add(launcher.action.target);
        }
      }

      for (const exportИмя of declaredЭкспортs) {
        const exported = mod[exportИмя];
        if (exported === undefined) {
          console.warn(
            `Plugin "${pluginКлюч}" declares slot export "${exportИмя}" but the module does not export it.`,
          );
          continue;
        }

        if (typeof exported === "function") {
          // React component (function component or class component).
          registerPluginReactComponent(
            pluginКлюч,
            exportИмя,
            exported as ComponentТип<PluginSlotComponentProps>,
          );
        } else if (typeof exported === "string") {
          // Web component tag name.
          registerPluginWebComponent(pluginКлюч, exportИмя, exported);
        } else {
          console.warn(
            `Plugin "${pluginКлюч}" export "${exportИмя}" is neither a function nor a string tag name — skipping.`,
          );
        }
      }

      pluginLoadStates.set(moduleКлюч, "loaded");
    } catch (err) {
      pluginLoadStates.set(moduleКлюч, "error");
      console.error(`Ошибка to load UI module for plugin "${pluginКлюч}"`, err);
    } finally {
      inflightИмпортs.delete(pluginId);
    }
  })();

  inflightИмпортs.set(pluginId, importPromise);
  await importPromise;
}

function isLauncherComponentЦель(launcher: PluginLauncherDeclaration): boolean {
  return launcher.action.type === "openModal"
    || launcher.action.type === "openDrawer"
    || launcher.action.type === "openPopover";
}

/**
 * Load UI modules for a set of plugin contributions.
 *
 * Returns a promise that resolves once all modules have been loaded (or
 * failed). Plugins that are already loaded are skipped.
 */
async function ensurePluginModulesLoaded(contributions: PluginUiContribution[]): Promise<void> {
  await Promise.all(
    contributions.map((c) => loadPluginModule(c)),
  );
}

export async function ensurePluginContributionLoaded(
  contribution: PluginUiContribution,
): Promise<void> {
  await loadPluginModule(contribution);
}

/**
 * Returns the aggregate load state across a set of plugin contributions.
 * - If any plugin is still loading → "loading"
 * - If all are loaded (or no contributions) → "loaded"
 * - If all finished but some errored → "loaded" (errors are logged, not fatal)
 */
function aggregateLoadState(contributions: PluginUiContribution[]): "loading" | "loaded" {
  for (const c of contributions) {
    const state = pluginLoadStates.get(buildPluginModuleКлюч(c));
    if (state === "loading" || state === "idle" || state === undefined) {
      return "loading";
    }
  }
  return "loaded";
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Trigger dynamic loading of plugin UI modules when contributions change.
 *
 * This hook is intentionally decoupled from usePluginSlots so that callers
 * who consume slots via `usePluginSlots()` automatically get module loading
 * without extra wiring.
 */
function usePluginModuleLoader(contributions: PluginUiContribution[] | undefined) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!contributions || contributions.length === 0) return;

    // Фильтр to contributions that haven't been loaded yet.
    const unloaded = contributions.filter((c) => {
      const state = pluginLoadStates.get(buildPluginModuleКлюч(c));
      return state !== "loaded" && state !== "loading";
    });

    if (unloaded.length === 0) return;

    let cancelled = false;
    void ensurePluginModulesLoaded(unloaded).then(() => {
      // Re-render so the slot mount can resolve the newly-registered components.
      if (!cancelled) setTick((t) => t + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [contributions]);
}

/**
 * Resolves and sorts slots across all ready plugin contributions.
 *
 * Фильтрing rules:
 * - `slotТипs` must match one of the caller-requested host slot types.
 * - Entity-scoped slot types (`detailTab`, `taskDetailView`, `contextMenuItem`)
 *   require `entityТип` and must include it in `slot.entityТипs`.
 *
 * Автоmatically triggers dynamic import of plugin UI modules for any
 * newly-discovered contributions. Components render once loading completes.
 */
export function usePluginSlots(filters: SlotФильтрs): UsePluginSlotsResult {
  const queryВключитьd = filters.enabled ?? true;
  const { data, isЗагрузка: isQueryЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.plugins.uiContributions,
    queryFn: () => pluginsApi.listUiContributions(),
    enabled: queryВключитьd,
  });

  // Kick off dynamic imports for any new plugin contributions.
  usePluginModuleLoader(data);

  const slotТипsКлюч = useMemo(() => [...filters.slotТипs].sort().join("|"), [filters.slotТипs]);

  const slots = useMemo(() => {
    const allowedТипs = new Set(slotТипsКлюч.split("|").filter(Boolean) as PluginUiSlotТип[]);
    const rows: ResolvedPluginSlot[] = [];
    for (const contribution of data ?? []) {
      for (const slot of contribution.slots) {
        if (!allowedТипs.has(slot.type)) continue;
        if (requiresEntityТип(slot.type)) {
          if (!filters.entityТип) continue;
          if (!slot.entityТипs?.includes(filters.entityТип)) continue;
        }
        rows.push({
          ...slot,
          pluginId: contribution.pluginId,
          pluginКлюч: contribution.pluginКлюч,
          pluginDisplayИмя: contribution.displayИмя,
          pluginВерсия: contribution.version,
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
  }, [data, filters.entityТип, slotТипsКлюч]);

  // Consider loading until both query and module imports are done.
  const modulesLoaded = data ? aggregateLoadState(data) === "loaded" : true;
  const isЗагрузка = queryВключитьd && (isQueryЗагрузка || !modulesLoaded);

  return {
    slots,
    isЗагрузка,
    errorMessage: error ? getОшибкаMessage(error) : null,
  };
}

type PluginSlotОшибкаBoundaryProps = {
  slot: ResolvedPluginSlot;
  classИмя?: string;
  children: ReactНетde;
};

type PluginSlotОшибкаBoundaryState = {
  hasОшибка: boolean;
};

class PluginSlotОшибкаBoundary extends Component<PluginSlotОшибкаBoundaryProps, PluginSlotОшибкаBoundaryState> {
  override state: PluginSlotОшибкаBoundaryState = { hasОшибка: false };

  static getDerivedStateFromОшибка(): PluginSlotОшибкаBoundaryState {
    return { hasОшибка: true };
  }

  override componentDidCatch(error: unknown, info: ОшибкаInfo): void {
    // Keep plugin failures isolated while preserving actionable diagnostics.
    console.error("Plugin slot render failed", {
      pluginКлюч: this.props.slot.pluginКлюч,
      slotId: this.props.slot.id,
      error,
      info: info.componentStack,
    });
  }

  override render() {
    if (this.state.hasОшибка) {
      return (
        <div classИмя={cn("rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive", this.props.classИмя)}>
          {this.props.slot.pluginDisplayИмя}: failed to render
        </div>
      );
    }
    return this.props.children;
  }
}

function PluginWebComponentMount({
  tagИмя,
  slot,
  context,
  classИмя,
}: {
  tagИмя: string;
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
  classИмя?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Bridge manifest slot/context metadata onto the custom element instance.
    const el = ref.current as HTMLElement & {
      pluginSlot?: ResolvedPluginSlot;
      pluginContext?: PluginSlotContext;
    };
    el.pluginSlot = slot;
    el.pluginContext = context;
  }, [context, slot]);

  return createElement(tagИмя, { ref, classИмя });
}

type PluginSlotMountProps = {
  slot: ResolvedPluginSlot;
  context: PluginSlotContext;
  classИмя?: string;
  missingBehavior?: "hidden" | "placeholder";
};

/**
 * Maps the slot's `PluginSlotContext` to a `PluginХостContext` for the bridge.
 *
 * The bridge hooks need the full host context shape; the slot context carries
 * the subset available from the rendering location.
 */
function slotContextToХостContext(
  pluginSlotContext: PluginSlotContext,
  userId: string | null,
): PluginХостContext {
  return {
    companyId: pluginSlotContext.companyId ?? null,
    companyPrefix: pluginSlotContext.companyPrefix ?? null,
    projectId: pluginSlotContext.projectId ?? (pluginSlotContext.entityТип === "project" ? pluginSlotContext.entityId ?? null : null),
    entityId: pluginSlotContext.entityId ?? null,
    entityТип: pluginSlotContext.entityТип ?? null,
    parentEntityId: pluginSlotContext.parentEntityId ?? null,
    userId,
    renderОкружение: null,
  };
}

/**
 * Wrapper component that sets the active bridge context around plugin renders.
 *
 * This ensures that `usePluginData()`, `usePluginAction()`, and `useХостContext()`
 * have access to the current plugin ID and host context during the render phase.
 */
function PluginBridgeОбласть({
  pluginId,
  context,
  children,
}: {
  pluginId: string;
  context: PluginSlotContext;
  children: ReactНетde;
}) {
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId = session?.user?.id ?? session?.session?.userId ?? null;
  const hostContext = useMemo(() => slotContextToХостContext(context, userId), [context, userId]);
  const value = useMemo(() => ({ pluginId, hostContext }), [pluginId, hostContext]);

  return (
    <PluginBridgeContext.Провайдер value={value}>
      {children}
    </PluginBridgeContext.Провайдер>
  );
}

export function PluginSlotMount({
  slot,
  context,
  classИмя,
  missingBehavior = "hidden",
}: PluginSlotMountProps) {
  const [, forceRerender] = useState(0);
  const component = resolveRegisteredComponent(slot);

  useEffect(() => {
    if (component) return;
    const inflight = inflightИмпортs.get(slot.pluginId);
    if (!inflight) return;

    let cancelled = false;
    void inflight.finally(() => {
      if (!cancelled) {
        forceRerender((tick) => tick + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [component, slot.pluginId]);

  if (!component) {
    if (missingBehavior === "hidden") return null;
    return (
      <div classИмя={cn("rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground", classИмя)}>
        {slot.pluginDisplayИмя}: {slot.displayИмя}
      </div>
    );
  }

  if (component.kind === "react") {
    const node = createElement(component.component, { slot, context });
    return (
      <PluginSlotОшибкаBoundary slot={slot} classИмя={classИмя}>
        <PluginBridgeОбласть pluginId={slot.pluginId} context={context}>
          {classИмя ? <div classИмя={classИмя}>{node}</div> : node}
        </PluginBridgeОбласть>
      </PluginSlotОшибкаBoundary>
    );
  }

  return (
    <PluginSlotОшибкаBoundary slot={slot} classИмя={classИмя}>
      <PluginWebComponentMount
        tagИмя={component.tagИмя}
        slot={slot}
        context={context}
        classИмя={classИмя}
      />
    </PluginSlotОшибкаBoundary>
  );
}

type PluginSlotOutletProps = {
  slotТипs: PluginUiSlotТип[];
  context: PluginSlotContext;
  entityТип?: PluginUiSlotEntityТип | null;
  classИмя?: string;
  itemClassИмя?: string;
  errorClassИмя?: string;
  missingBehavior?: "hidden" | "placeholder";
};

export function PluginSlotOutlet({
  slotТипs,
  context,
  entityТип,
  classИмя,
  itemClassИмя,
  errorClassИмя,
  missingBehavior = "hidden",
}: PluginSlotOutletProps) {
  const { slots, errorMessage } = usePluginSlots({
    slotТипs,
    entityТип,
    companyId: context.companyId,
  });

  if (errorMessage) {
    return (
      <div classИмя={cn("rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive", errorClassИмя)}>
        Plugin extensions unavailable: {errorMessage}
      </div>
    );
  }

  if (slots.length === 0) return null;

  return (
    <div classИмя={classИмя}>
      {slots.map((slot) => (
        <PluginSlotMount
          key={`${slot.pluginКлюч}:${slot.id}`}
          slot={slot}
          context={context}
          classИмя={itemClassИмя}
          missingBehavior={missingBehavior}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Проверить helpers — exported for use in test suites only.
// ---------------------------------------------------------------------------

/**
 * Сбросить the module loader state. Only use in tests.
 * @internal
 */
export function _resetPluginModuleLoader(): void {
  pluginLoadStates.clear();
  inflightИмпортs.clear();
  registry.clear();
  if (typeof URL.revokeObjectURL === "function") {
    for (const url of Object.values(shimBlobUrls)) {
      URL.revokeObjectURL(url);
    }
  }
  for (const key of Object.keys(shimBlobUrls)) {
    delete shimBlobUrls[key];
  }
}

export const _applyJsxЗапуститьtimeКлючForПроверитьs = applyJsxЗапуститьtimeКлюч;
export const _rewriteBareSpecifiersForПроверитьs = rewriteBareSpecifiers;
