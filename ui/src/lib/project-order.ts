import type { Project } from "@paperclipai/shared";

export const PROJECT_ORDER_UPDATED_EVENT = "paperclip:project-order-updated";
export const PROJECT_SORT_MODE_UPDATED_EVENT = "paperclip:project-sort-mode-updated";
const PROJECT_ORDER_STORAGE_PREFIX = "paperclip.projectOrder";
const PROJECT_SORT_MODE_STORAGE_PREFIX = "paperclip.projectСортировкаMode";
const ANONYMOUS_USER_ID = "anonymous";

export type ProjectSidebarСортировкаMode = "top" | "alphabetical" | "recent";

type ProjectOrderОбновитьdDetail = {
  storageКлюч: string;
  orderedIds: string[];
};

export type ProjectСортировкаModeОбновитьdDetail = {
  storageКлюч: string;
  sortMode: ProjectSidebarСортировкаMode;
};

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeСортировкаMode(value: unknown): ProjectSidebarСортировкаMode {
  return value === "alphabetical" || value === "recent" || value === "top" ? value : "top";
}

function resolveUserId(userId: string | null | undefined): string {
  if (!userId) return ANONYMOUS_USER_ID;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : ANONYMOUS_USER_ID;
}

export function getProjectOrderStorageКлюч(companyId: string, userId: string | null | undefined): string {
  return `${PROJECT_ORDER_STORAGE_PREFIX}:${companyId}:${resolveUserId(userId)}`;
}

export function getProjectСортировкаModeStorageКлюч(companyId: string, userId: string | null | undefined): string {
  return `${PROJECT_SORT_MODE_STORAGE_PREFIX}:${companyId}:${resolveUserId(userId)}`;
}

export function readProjectOrder(storageКлюч: string): string[] {
  try {
    const raw = localStorage.getItem(storageКлюч);
    if (!raw) return [];
    return normalizeIdList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readProjectСортировкаMode(storageКлюч: string): ProjectSidebarСортировкаMode {
  try {
    return normalizeСортировкаMode(localStorage.getItem(storageКлюч));
  } catch {
    return "top";
  }
}

export function writeProjectOrder(storageКлюч: string, orderedIds: string[]) {
  const normalized = normalizeIdList(orderedIds);
  try {
    localStorage.setItem(storageКлюч, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new СвойEvent<ProjectOrderОбновитьdDetail>(PROJECT_ORDER_UPDATED_EVENT, {
        detail: { storageКлюч, orderedIds: normalized },
      }),
    );
  }
}

export function writeProjectСортировкаMode(storageКлюч: string, sortMode: ProjectSidebarСортировкаMode) {
  const normalized = normalizeСортировкаMode(sortMode);
  try {
    localStorage.setItem(storageКлюч, normalized);
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new СвойEvent<ProjectСортировкаModeОбновитьdDetail>(PROJECT_SORT_MODE_UPDATED_EVENT, {
        detail: { storageКлюч, sortMode: normalized },
      }),
    );
  }
}

export function sortПроектыByStoredOrder(projects: Project[], orderedIds: string[]): Project[] {
  if (projects.length === 0) return [];
  if (orderedIds.length === 0) return projects;

  const byId = new Map(projects.map((project) => [project.id, project]));
  const sorted: Project[] = [];

  for (const id of orderedIds) {
    const project = byId.get(id);
    if (!project) continue;
    sorted.push(project);
    byId.delete(id);
  }
  for (const project of byId.values()) {
    sorted.push(project);
  }
  return sorted;
}
