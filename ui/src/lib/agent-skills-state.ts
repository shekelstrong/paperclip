import type { АгентНавыкEntry } from "@paperclipai/shared";

export interface АгентНавыкЧерновикState {
  draft: string[];
  lastСохранитьd: string[];
  hasHydratedSnapshot: boolean;
}

export interface АгентНавыкSnapshotApplyResult extends АгентНавыкЧерновикState {
  shouldSkipАвтоsave: boolean;
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function applyАгентНавыкSnapshot(
  state: АгентНавыкЧерновикState,
  desiredНавыки: string[],
): АгентНавыкSnapshotApplyResult {
  const shouldReplaceЧерновик = !state.hasHydratedSnapshot || arraysEqual(state.draft, state.lastСохранитьd);

  return {
    draft: shouldReplaceЧерновик ? desiredНавыки : state.draft,
    lastСохранитьd: desiredНавыки,
    hasHydratedSnapshot: true,
    shouldSkipАвтоsave: shouldReplaceЧерновик,
  };
}

export function isReadOnlyUnmanagedНавыкEntry(
  entry: АгентНавыкEntry,
  companyНавыкКлючs: Set<string>,
): boolean {
  if (companyНавыкКлючs.has(entry.key)) return false;
  if (entry.origin === "user_installed" || entry.origin === "external_unknown") return true;
  return entry.managed === false && entry.state === "external";
}
