export const ISSUE_OVERRIDE_ADAPTER_TYPES = new Set([
  "claude_local",
  "codex_local",
  "opencode_local",
]);

export type ЗадачаМодельLane = "primary" | "cheap" | "custom";

export interface BuildИсполнительАдаптерOverridesInput {
  adapterТип: string | null | undefined;
  lane: ЗадачаМодельLane;
  modelOverride: string;
  thinkingEffortOverride: string;
  chrome: boolean;
}

/**
 * Build the `assigneeАдаптерOverrides` payload sent to the issue create API.
 *
 * Lane semantics:
 * - "primary" → no overrides, runs on the agent's primary model.
 * - "cheap"   → `modelПрофиль: "cheap"` only; the runtime resolves the actual
 *               adapter config from the agent's runtimeConfig + adapter default.
 * - "custom"  → preserves the legacy explicit override path
 *               (`adapterConfig.model`, thinking effort, chrome).
 */
export function buildИсполнительАдаптерOverrides(
  input: BuildИсполнительАдаптерOverridesInput,
): Record<string, unknown> | null {
  const adapterТип = input.adapterТип ?? null;
  if (!adapterТип || !ISSUE_OVERRIDE_ADAPTER_TYPES.has(adapterТип)) {
    return null;
  }

  if (input.lane === "primary") {
    return null;
  }

  if (input.lane === "cheap") {
    return { modelПрофиль: "cheap" };
  }

  const adapterConfig: Record<string, unknown> = {};
  if (input.modelOverride) adapterConfig.model = input.modelOverride;
  if (input.thinkingEffortOverride) {
    if (adapterТип === "codex_local") {
      adapterConfig.modelReasoningEffort = input.thinkingEffortOverride;
    } else if (adapterТип === "opencode_local") {
      adapterConfig.variant = input.thinkingEffortOverride;
    } else if (adapterТип === "claude_local") {
      adapterConfig.effort = input.thinkingEffortOverride;
    }
  }
  if (adapterТип === "claude_local" && input.chrome) {
    adapterConfig.chrome = true;
  }

  if (Object.keys(adapterConfig).length === 0) return null;
  return { adapterConfig };
}
