import type { ПроцедураTrigger } from "@paperclipai/shared";

export type ПроцедураTriggerИзменитьorЧерновик = {
  label: string;
  cronExpression: string;
  signingMode: string;
  replayWindowSec: string;
};

export function buildПроцедураTriggerPatch(
  trigger: ПроцедураTrigger,
  draft: ПроцедураTriggerИзменитьorЧерновик,
  fallbackTimezone: string,
) {
  const patch: Record<string, unknown> = {
    label: draft.label.trim() || null,
  };

  if (trigger.kind === "schedule") {
    patch.cronExpression = draft.cronExpression.trim();
    patch.timezone = trigger.timezone ?? fallbackTimezone;
  }

  if (trigger.kind === "webhook") {
    patch.signingMode = draft.signingMode;
    patch.replayWindowSec = Number(draft.replayWindowSec || "300");
  }

  return patch;
}
