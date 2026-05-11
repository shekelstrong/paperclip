/**
 * Client-side store for disabled adapter types.
 *
 * Hydrated from the server's GET /api/adapters response.
 * Provides synchronous reads so module-level constants can filter against it.
 * Falls back to "nothing disabled" before the first hydration.
 *
 * Использование in components:
 *   useQuery + adaptersApi.list() populates the store automatically.
 *
 * Использование in non-React code:
 *   import { isАдаптерТипHidden } from "@/adapters/disabled-store";
 */

let disabledТипs = new Set<string>();

/** Check if an adapter type is hidden from menus (sync read). */
export function isАдаптерТипHidden(type: string): boolean {
  return disabledТипs.has(type);
}

/** Get all hidden adapter types (sync read). */
export function getHiddenАдаптерТипs(): Set<string> {
  return disabledТипs;
}

/**
 * Hydrate the store from a server response.
 * Called by components that fetch the adapters list.
 */
export function setОтключитьdАдаптерТипs(types: string[]): void {
  disabledТипs = new Set(types);
}
