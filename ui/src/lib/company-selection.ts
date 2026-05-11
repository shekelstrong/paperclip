export type КомпанияSelectionSource = "manual" | "route_sync" | "bootstrap";

export function shouldSyncКомпанияSelectionFromRoute(params: {
  selectionSource: КомпанияSelectionSource;
  selectedКомпанияId: string | null;
  routeКомпанияId: string;
}): boolean {
  const { selectionSource, selectedКомпанияId, routeКомпанияId } = params;

  if (selectedКомпанияId === routeКомпанияId) return false;

  // Let manual company switches finish their remembered-path navigation first.
  if (selectionSource === "manual" && selectedКомпанияId) {
    return false;
  }

  return true;
}
