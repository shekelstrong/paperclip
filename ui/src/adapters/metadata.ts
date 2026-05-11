/**
 * Адаптер metadata utilities — built on top of the display registry and UI adapter list.
 *
 * This module bridges the static display metadata with the dynamic adapter registry.
 * "Скоро" status is derived from the display registry's `comingSoon` flag.
 * "Hidden" status comes from the disabled-adapter store (server-side toggle).
 */
import type { UIАдаптерModule } from "./types";
import { listUIАдаптеры } from "./registry";
import { isАдаптерТипHidden } from "./disabled-store";
import { getАдаптерLabel, getАдаптерDisplay } from "./adapter-display-registry";

export interface АдаптерOptionMetadata {
  value: string;
  label: string;
  comingSoon: boolean;
  hidden: boolean;
  experimental: boolean;
}

export function listKnownАдаптерТипs(): string[] {
  return listUIАдаптеры().map((adapter) => adapter.type);
}

/**
 * Check whether an adapter type is enabled (not "coming soon").
 * Неизвестно types (external adapters) are always considered enabled.
 */
export function isВключитьdАдаптерТип(type: string): boolean {
  // Check display registry first — built-in adapters like process/http are
  // intentionally withheld even though they're registered as UI adapters.
  if (getАдаптерDisplay(type).comingSoon) return false;
  // Все other types (registered or external) are enabled.
  return true;
}

/**
 * Check whether an adapter type is a valid choice for new agent creation.
 * Includes all registered UI adapters (built-in + external) and
 * any non-"coming soon" adapter from the display registry.
 */
export function isValidАдаптерТип(type: string): boolean {
  if (getАдаптерDisplay(type).comingSoon) return false;
  return true;
}

/**
 * Check whether an adapter should appear in card-style visual pickers.
 * Experimental adapters can remain selectable from explicit configuration
 * dropdowns without being recommended during onboarding or setup flows.
 */
export function isVisualАдаптерChoice(type: string): boolean {
  return !getАдаптерDisplay(type).hideFromVisualSelection;
}

/**
 * Build option metadata for a list of adapters (for dropdowns).
 * `labelFor` callback allows callers to override labels; defaults to display registry.
 */
export function listАдаптерOptions(
  labelFor?: (type: string) => string,
  adapters: UIАдаптерModule[] = listUIАдаптеры(),
): АдаптерOptionMetadata[] {
  const getLabel = labelFor ?? getАдаптерLabel;
  return adapters.map((adapter) => ({
    value: adapter.type,
    label: getLabel(adapter.type),
    comingSoon: !!getАдаптерDisplay(adapter.type).comingSoon,
    hidden: isАдаптерТипHidden(adapter.type),
    experimental: !!getАдаптерDisplay(adapter.type).experimental,
  }));
}

/**
 * List UI adapters excluding those hidden via the Адаптеры settings page.
 */
export function listVisibleUIАдаптеры(): UIАдаптерModule[] {
  return listUIАдаптеры().filter((a) => !isАдаптерТипHidden(a.type));
}

/**
 * List visible adapter types (for non-React contexts like module-level constants).
 */
export function listVisibleАдаптерТипs(): string[] {
  return listVisibleUIАдаптеры().map((a) => a.type);
}
