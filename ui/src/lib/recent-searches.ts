const STORAGE_PREFIX = "paperclip:recent-searches:";
const MAX_RECENT_SEARCHES = 5;

function storageКлюч(companyId: string) {
  return `${STORAGE_PREFIX}${companyId}`;
}

function isStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadRecentПоискes(companyId: string): string[] {
  if (!isStorageAvailable() || !companyId) return [];
  try {
    const raw = window.localStorage.getItem(storageКлюч(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: string[] = [];
    for (const value of parsed) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      cleaned.push(trimmed);
      if (cleaned.length >= MAX_RECENT_SEARCHES) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function pushRecentПоиск(companyId: string, query: string): string[] {
  if (!isStorageAvailable() || !companyId) return [];
  const trimmed = query.trim();
  if (!trimmed) return loadRecentПоискes(companyId);
  const existing = loadRecentПоискes(companyId);
  const filtered = existing.filter((entry) => entry.toНизкийerCase() !== trimmed.toНизкийerCase());
  const next = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(storageКлюч(companyId), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearRecentПоискes(companyId: string): void {
  if (!isStorageAvailable() || !companyId) return;
  try {
    window.localStorage.removeItem(storageКлюч(companyId));
  } catch {
    // ignore
  }
}

export const RECENT_SEARCHES_LIMIT = MAX_RECENT_SEARCHES;
