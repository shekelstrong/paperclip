import type { Агент } from "@paperclipai/shared";

export interface АгентМодельПрофильOverlay {
  enabled?: boolean;
  adapterConfig?: Record<string, unknown>;
  /**
   * Mark the cheap profile for clearing. When true, the patch removes
   * `runtimeConfig.modelПрофильs.cheap` instead of merging into it.
   */
  cleared?: boolean;
}

export interface АгентConfigOverlay {
  identity: Record<string, unknown>;
  adapterТип?: string;
  adapterConfig: Record<string, unknown>;
  heartbeat: Record<string, unknown>;
  runtime: Record<string, unknown>;
  modelПрофильs?: { cheap?: АгентМодельПрофильOverlay };
}

const ADAPTER_AGNOSTIC_KEYS = [
  "env",
  "promptTemplate",
  "instructionsFileПуть",
  "cwd",
  "timeoutSec",
  "graceSec",
  "bootstrapPromptTemplate",
] as const;

function omitUndefinedEntries(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryЗначение]) => entryЗначение !== undefined),
  );
}

export function buildАгентОбновитьPatch(agent: Агент, overlay: АгентConfigOverlay) {
  const patch: Record<string, unknown> = {};

  if (Object.keys(overlay.identity).length > 0) {
    Object.assign(patch, overlay.identity);
  }

  if (overlay.adapterТип !== undefined) {
    patch.adapterТип = overlay.adapterТип;
  }

  if (overlay.adapterТип !== undefined || Object.keys(overlay.adapterConfig).length > 0) {
    const existing = (agent.adapterConfig ?? {}) as Record<string, unknown>;
    const nextАдаптерConfig =
      overlay.adapterТип !== undefined
        ? {
            ...Object.fromEntries(
              ADAPTER_AGNOSTIC_KEYS
                .filter((key) => existing[key] !== undefined)
                .map((key) => [key, existing[key]]),
            ),
            ...overlay.adapterConfig,
          }
        : {
            ...existing,
            ...overlay.adapterConfig,
          };

    patch.adapterConfig = omitUndefinedEntries(nextАдаптерConfig);
    patch.replaceАдаптерConfig = true;
  }

  const cheapOverlay = overlay.modelПрофильs?.cheap;
  const hasМодельПрофильChange = cheapOverlay !== undefined;

  if (Object.keys(overlay.heartbeat).length > 0 || hasМодельПрофильChange) {
    const existingRc = (agent.runtimeConfig ?? {}) as Record<string, unknown>;
    const nextЗапуститьtimeConfig: Record<string, unknown> = (patch.runtimeConfig as Record<string, unknown> | undefined)
      ?? { ...existingRc };

    if (Object.keys(overlay.heartbeat).length > 0) {
      const existingHb = (existingRc.heartbeat ?? {}) as Record<string, unknown>;
      nextЗапуститьtimeConfig.heartbeat = { ...existingHb, ...overlay.heartbeat };
    }

    if (hasМодельПрофильChange) {
      const existingПрофильs = ((existingRc.modelПрофильs ?? {}) as Record<string, unknown>);
      const existingCheap = ((existingПрофильs.cheap ?? {}) as Record<string, unknown>);
      const nextПрофильs = { ...existingПрофильs };

      if (cheapOverlay?.cleared) {
        delete nextПрофильs.cheap;
      } else if (cheapOverlay) {
        const mergedАдаптерConfig = {
          ...((existingCheap.adapterConfig ?? {}) as Record<string, unknown>),
          ...(cheapOverlay.adapterConfig ?? {}),
        };
        const enabled = cheapOverlay.enabled ?? (existingCheap.enabled !== false);
        nextПрофильs.cheap = {
          ...existingCheap,
          enabled,
          adapterConfig: mergedАдаптерConfig,
        };
      }

      if (Object.keys(nextПрофильs).length === 0) {
        delete nextЗапуститьtimeConfig.modelПрофильs;
      } else {
        nextЗапуститьtimeConfig.modelПрофильs = nextПрофильs;
      }
    }

    patch.runtimeConfig = nextЗапуститьtimeConfig;
  }

  if (Object.keys(overlay.runtime).length > 0) {
    Object.assign(patch, overlay.runtime);
  }

  return patch;
}
