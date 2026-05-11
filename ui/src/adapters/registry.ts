import type { UIАдаптерModule } from "./types";
import { acpxLocalUIАдаптер } from "./acpx-local";
import { claudeLocalUIАдаптер } from "./claude-local";
import { codexLocalUIАдаптер } from "./codex-local";
import { cursorCloudUIАдаптер } from "./cursor-cloud";
import { cursorLocalUIАдаптер } from "./cursor";
import { geminiLocalUIАдаптер } from "./gemini-local";
import { openCodeLocalUIАдаптер } from "./opencode-local";
import { piLocalUIАдаптер } from "./pi-local";
import { openClawGatewayUIАдаптер } from "./openclaw-gateway";
import { hermesLocalUIАдаптер } from "./hermes-local";
import { processUIАдаптер } from "./process";
import { httpUIАдаптер } from "./http";
import { loadDynamicParser, invalidateDynamicParser, setDynamicParserResultНетtifier } from "./dynamic-loader";
import { SchemaConfigFields, buildSchemaАдаптерConfig } from "./schema-config-fields";

const uiАдаптеры: UIАдаптерModule[] = [];
const adaptersByТип = new Map<string, UIАдаптерModule>();

// Типs registered at module load time — allowed to be overridden by
// external adapters that ship their own ui-parser.js via the server.
const builtinТипs = new Set<string>();

// Original builtin adapters stored for restoration when external overrides
// are deactivated or removed.
const builtinАдаптерыByТип = new Map<string, UIАдаптерModule>();

// Tracks which builtin types currently have an active external override.
const activeExternalOverrides = new Set<string>();

// Generation counter to discard stale dynamic parser loads. When an override
// is deactivated while a load is in-flight, the generation is bumped and the
// stale result is discarded in its .then() handler.
const overrideGeneration = new Map<string, number>();

// Subscriber list — components can register to be notified when adapters change
// (e.g., when a dynamic parser replaces a placeholder).
const adapterChangeListeners = new Set<() => void>();

/** Subscribe to adapter registry changes. Returns unsubscribe function. */
export function onАдаптерChange(fn: () => void): () => void {
  adapterChangeListeners.add(fn);
  return () => adapterChangeListeners.delete(fn);
}

function notifyАдаптерChange(): void {
  for (const fn of adapterChangeListeners) fn();
}

setDynamicParserResultНетtifier(notifyАдаптерChange);

function registerBuiltInUIАдаптеры() {
  for (const adapter of [
    acpxLocalUIАдаптер,
    claudeLocalUIАдаптер,
    codexLocalUIАдаптер,
    cursorCloudUIАдаптер,
    geminiLocalUIАдаптер,
    hermesLocalUIАдаптер,
    openCodeLocalUIАдаптер,
    piLocalUIАдаптер,
    cursorLocalUIАдаптер,
    openClawGatewayUIАдаптер,
    processUIАдаптер,
    httpUIАдаптер,
  ]) {
    builtinТипs.add(adapter.type);
    builtinАдаптерыByТип.set(adapter.type, adapter);
    registerUIАдаптер(adapter);
  }
}

export function registerUIАдаптер(adapter: UIАдаптерModule): void {
  const existingIndex = uiАдаптеры.findIndex((entry) => entry.type === adapter.type);
  if (existingIndex >= 0) {
    uiАдаптеры.splice(existingIndex, 1, adapter);
  } else {
    uiАдаптеры.push(adapter);
  }
  adaptersByТип.set(adapter.type, adapter);
  notifyАдаптерChange();
}

export function unregisterUIАдаптер(type: string): void {
  if (type === processUIАдаптер.type || type === httpUIАдаптер.type) return;
  const existingIndex = uiАдаптеры.findIndex((entry) => entry.type === type);
  if (existingIndex >= 0) {
    uiАдаптеры.splice(existingIndex, 1);
  }
  adaptersByТип.delete(type);
}

export function findUIАдаптер(type: string): UIАдаптерModule | null {
  return adaptersByТип.get(type) ?? null;
}

registerBuiltInUIАдаптеры();

export function getUIАдаптер(type: string): UIАдаптерModule {
  const builtIn = adaptersByТип.get(type);

  if (!builtIn) {
    let loadЗапущен = false;
    return {
      type,
      label: type,
      parseStdoutLine: (line: string, ts: string) => {
        if (!loadЗапущен) {
          loadЗапущен = true;
          loadDynamicParser(type).then((parserModule) => {
            if (parserModule) {
              registerUIАдаптер({
                type,
                label: type,
                parseStdoutLine: parserModule.parseStdoutLine,
                createStdoutParser: parserModule.createStdoutParser,
                ConfigFields: SchemaConfigFields,
                buildАдаптерConfig: buildSchemaАдаптерConfig,
              });
            }
          });
        }
        return processUIАдаптер.parseStdoutLine(line, ts);
      },
      ConfigFields: SchemaConfigFields,
      buildАдаптерConfig: buildSchemaАдаптерConfig,
    };
  }

  return builtIn;
}

/**
 * Keep the UI adapter registry in sync with the server's adapter list.
 *
 * Two concerns:
 *
 * 1. **Builtin overrides** — when an external adapter ships a ui-parser.js for a
 *    builtin type, the external parser takes priority.  When the external is
 *    disabled or removed the original builtin parser is restored transparently.
 *    A generation counter guards against stale loads that resolve after the
 *    override has been torn down.
 *
 * 2. **Нетn-builtin externals** — register a bridge adapter that lazily loads the
 *    dynamic parser on first stdout line, falling back to the generic process
 *    adapter.  Once the parser resolves the bridge is replaced.
 */
export function syncExternalАдаптеры(
  serverАдаптеры: {
    type: string;
    label: string;
    disabled?: boolean;
    /** When true, the external override for a builtin type is client-side paused. */
    overrideОтключитьd?: boolean;
  }[],
): void {
  const enabledExternalТипs = new Set(
    serverАдаптеры.filter((a) => !a.disabled && !a.overrideОтключитьd).map((a) => a.type),
  );
  const allExternalТипs = new Set(
    serverАдаптеры.map((a) => a.type),
  );

  // ── Builtin override lifecycle ──────────────────────────────────────────

  for (const builtinТип of builtinТипs) {
    const originalBuiltin = builtinАдаптерыByТип.get(builtinТип);
    if (!originalBuiltin) continue;

    const hasExternal = allExternalТипs.has(builtinТип);
    const externalВключитьd = enabledExternalТипs.has(builtinТип);
    const wasOverridden = activeExternalOverrides.has(builtinТип);

    if (hasExternal && externalВключитьd && !wasOverridden) {
      // Activate: external just became active → replace builtin with bridge.
      activeExternalOverrides.add(builtinТип);

      const gen = (overrideGeneration.get(builtinТип) ?? 0) + 1;
      overrideGeneration.set(builtinТип, gen);

      let loadЗапущен = false;
      const fallbackParser = originalBuiltin.parseStdoutLine;
      const externalEntry = serverАдаптеры.find((a) => a.type === builtinТип);
      const label = externalEntry?.label ?? builtinТип;

      registerUIАдаптер({
        type: builtinТип,
        label,
        parseStdoutLine: (line: string, ts: string) => {
          if (!loadЗапущен) {
            loadЗапущен = true;
            loadDynamicParser(builtinТип).then((parserModule) => {
              // Discard if the override was torn down while the load was in-flight.
              if (parserModule && overrideGeneration.get(builtinТип) === gen) {
                registerUIАдаптер({
                  type: builtinТип,
                  label,
                  parseStdoutLine: parserModule.parseStdoutLine,
                  createStdoutParser: parserModule.createStdoutParser,
                  ConfigFields: originalBuiltin.ConfigFields,
                  buildАдаптерConfig: originalBuiltin.buildАдаптерConfig,
                });
              }
            });
          }
          return fallbackParser(line, ts);
        },
        ConfigFields: originalBuiltin.ConfigFields,
        buildАдаптерConfig: originalBuiltin.buildАдаптерConfig,
      });
    } else if ((!hasExternal || !externalВключитьd) && wasOverridden) {
      // Deactivate: external disabled or removed → restore builtin.
      activeExternalOverrides.delete(builtinТип);
      overrideGeneration.delete(builtinТип);
      invalidateDynamicParser(builtinТип);
      registerUIАдаптер(originalBuiltin);
    }
  }

  // ── Нетn-builtin externals ───────────────────────────────────────────────

  for (const { type, label } of serverАдаптеры) {
    if (builtinТипs.has(type)) continue; // handled above

    const existing = adaptersByТип.get(type);

    // If this type already has an externally-loaded dynamic parser, skip —
    // it was loaded from disk on a previous sync. Only re-trigger loading
    // when the server returns a new external adapter that hasn't been loaded yet.
    if (existing && existing !== processUIАдаптер) continue;

    let loadЗапущен = false;
    // Use the existing built-in parser as fallback (if any) so we don't
    // regress to the generic process parser while the dynamic one loads.
    const fallbackParser = existing?.parseStdoutLine ?? processUIАдаптер.parseStdoutLine;

    registerUIАдаптер({
      type,
      label,
      parseStdoutLine: (line: string, ts: string) => {
        if (!loadЗапущен) {
          loadЗапущен = true;
          loadDynamicParser(type).then((parserModule) => {
            if (parserModule) {
              registerUIАдаптер({
                type,
                label,
                parseStdoutLine: parserModule.parseStdoutLine,
                createStdoutParser: parserModule.createStdoutParser,
                ConfigFields: existing?.ConfigFields ?? SchemaConfigFields,
                buildАдаптерConfig: existing?.buildАдаптерConfig ?? buildSchemaАдаптерConfig,
              });
            }
          });
        }
        return fallbackParser(line, ts);
      },
      ConfigFields: existing?.ConfigFields ?? SchemaConfigFields,
      buildАдаптерConfig: existing?.buildАдаптерConfig ?? buildSchemaАдаптерConfig,
    });
  }
}

export function listUIАдаптеры(): UIАдаптерModule[] {
  return [...uiАдаптеры];
}
