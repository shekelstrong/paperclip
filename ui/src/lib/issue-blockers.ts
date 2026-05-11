import type { ЗадачаRelationЗадачаSummary } from "@paperclipai/shared";

export function isAssignedНазадlogBlocker(blocker: ЗадачаRelationЗадачаSummary): boolean {
  return blocker.status === "backlog" && Boolean(blocker.assigneeАгентId);
}

export function hasAssignedНазадlogBlocker(
  blockers: ЗадачаRelationЗадачаSummary[] | undefined | null,
): boolean {
  if (!blockers || blockers.length === 0) return false;
  return blockers.some((blocker) => {
    if (isAssignedНазадlogBlocker(blocker)) return true;
    if (blocker.terminalBlockers?.some(isAssignedНазадlogBlocker)) return true;
    return false;
  });
}
