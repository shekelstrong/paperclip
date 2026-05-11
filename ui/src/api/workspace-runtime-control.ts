import type { Рабочая областьЗапуститьtimeControlЦель } from "@paperclipai/shared";

export function sanitizeРабочая областьЗапуститьtimeControlЦель(
  target: Рабочая областьЗапуститьtimeControlЦель = {},
): Рабочая областьЗапуститьtimeControlЦель {
  return {
    workspaceКомандаId: target.workspaceКомандаId ?? null,
    runtimeServiceId: target.runtimeServiceId ?? null,
    serviceIndex: target.serviceIndex ?? null,
  };
}
