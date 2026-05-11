export const RECENT_SELECTION_DISPLAY_LIMIT = 3;
const MAX_STORED_RECENT_SELECTIONS = 10;

export function readRecentSelectionIds(storageКлюч: string): string[] {
  try {
    const raw = localStorage.getItem(storageКлюч);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function trackRecentSelectionId(storageКлюч: string, id: string): void {
  if (!id) return;
  const recent = readRecentSelectionIds(storageКлюч).filter((candidate) => candidate !== id);
  recent.unshift(id);
  if (recent.length > MAX_STORED_RECENT_SELECTIONS) recent.length = MAX_STORED_RECENT_SELECTIONS;
  localStorage.setItem(storageКлюч, JSON.stringify(recent));
}

export function orderItemsBySelectedAndRecent<T extends { id: string }>(
  items: T[],
  selectedId: string | null | undefined,
  recentIds: string[],
  recentLimit = RECENT_SELECTION_DISPLAY_LIMIT,
): T[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();

  const push = (id: string | null | undefined) => {
    if (id === null || id === undefined || seen.has(id)) return;
    const item = itemById.get(id);
    if (!item) return;
    ordered.push(item);
    seen.add(id);
  };

  push(selectedId);
  for (const recentId of recentIds.slice(0, recentLimit)) {
    push(recentId);
  }
  for (const item of items) {
    push(item.id);
  }

  return ordered;
}
