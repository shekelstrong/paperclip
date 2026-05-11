/**
 * @fileoverview Frontend API client for external adapter management.
 */

import { api } from "./client";

export interface АдаптерCapabilities {
  supportsInstructionsBundle: boolean;
  supportsНавыки: boolean;
  supportsLocalАгентJwt: boolean;
  requiresMaterializedЗапуститьtimeНавыки: boolean;
  supportsМодельПрофильs: boolean;
}

export interface АдаптерInfo {
  type: string;
  label: string;
  source: "builtin" | "external";
  modelsCount: number;
  loaded: boolean;
  disabled: boolean;
  capabilities: АдаптерCapabilities;
  /** Installed version (for external npm adapters) */
  version?: string;
  /** Package name (for external adapters) */
  packageИмя?: string;
  /** Whether the adapter was installed from a local path (vs npm). */
  isLocalПуть?: boolean;
  /** True when an external plugin has replaced a built-in adapter of the same type. */
  overriddenBuiltin?: boolean;
  /** True when the external override for a builtin type is currently paused. */
  overrideПриостановлен?: boolean;
}

export interface АдаптерInstallResult {
  type: string;
  packageИмя: string;
  version?: string;
  installedAt: string;
}

export const adaptersApi = {
  /** List all registered adapters (built-in + external). */
  list: () => api.get<АдаптерInfo[]>("/adapters"),

  /** Install an external adapter from npm or a local path. */
  install: (params: { packageИмя: string; version?: string; isLocalПуть?: boolean }) =>
    api.post<АдаптерInstallResult>("/adapters/install", params),

  /** Удалить an external adapter by type. */
  remove: (type: string) => api.delete<{ type: string; removed: boolean }>(`/adapters/${type}`),

  /** Включить or disable an adapter (disabled adapters hidden from agent menus). */
  setОтключитьd: (type: string, disabled: boolean) =>
    api.patch<{ type: string; disabled: boolean; changed: boolean }>(`/adapters/${type}`, { disabled }),

  /** Пауза or resume an external override of a builtin type. */
  setOverrideПриостановлен: (type: string, paused: boolean) =>
    api.patch<{ type: string; paused: boolean; changed: boolean }>(`/adapters/${type}/override`, { paused }),

  /** Reload an external adapter (bust server + client caches). */
  reload: (type: string) =>
    api.post<{ type: string; version?: string; reloaded: boolean }>(`/adapters/${type}/reload`, {}),

  /** Reinstall an npm-sourced adapter (pulls latest from registry, then reloads). */
  reinstall: (type: string) =>
    api.post<{ type: string; version?: string; reinstalled: boolean }>(`/adapters/${type}/reinstall`, {}),
};
