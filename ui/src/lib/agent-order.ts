import type { Агент } from "@paperclipai/shared";

export const AGENT_ORDER_UPDATED_EVENT = "paperclip:agent-order-updated";
export const AGENT_SORT_MODE_UPDATED_EVENT = "paperclip:agent-sort-mode-updated";
const AGENT_ORDER_STORAGE_PREFIX = "paperclip.agentOrder";
const AGENT_SORT_MODE_STORAGE_PREFIX = "paperclip.agentСортировкаMode";
const ANONYMOUS_USER_ID = "anonymous";

export type АгентSidebarСортировкаMode = "top" | "alphabetical" | "recent";

type АгентOrderОбновленоDetail = {
  storageКлюч: string;
  orderedIds: string[];
};

export type АгентСортировкаModeОбновленоDetail = {
  storageКлюч: string;
  sortMode: АгентSidebarСортировкаMode;
};

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeСортировкаMode(value: unknown): АгентSidebarСортировкаMode {
  return value === "alphabetical" || value === "recent" || value === "top" ? value : "top";
}

function resolveUserId(userId: string | null | undefined): string {
  if (!userId) return ANONYMOUS_USER_ID;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : ANONYMOUS_USER_ID;
}

export function getАгентOrderStorageКлюч(companyId: string, userId: string | null | undefined): string {
  return `${AGENT_ORDER_STORAGE_PREFIX}:${companyId}:${resolveUserId(userId)}`;
}

export function getАгентСортировкаModeStorageКлюч(companyId: string, userId: string | null | undefined): string {
  return `${AGENT_SORT_MODE_STORAGE_PREFIX}:${companyId}:${resolveUserId(userId)}`;
}

export function readАгентOrder(storageКлюч: string): string[] {
  try {
    const raw = localStorage.getItem(storageКлюч);
    if (!raw) return [];
    return normalizeIdList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readАгентСортировкаMode(storageКлюч: string): АгентSidebarСортировкаMode {
  try {
    return normalizeСортировкаMode(localStorage.getItem(storageКлюч));
  } catch {
    return "top";
  }
}

export function writeАгентOrder(storageКлюч: string, orderedIds: string[]) {
  const normalized = normalizeIdList(orderedIds);
  try {
    localStorage.setItem(storageКлюч, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new СвойEvent<АгентOrderОбновленоDetail>(AGENT_ORDER_UPDATED_EVENT, {
        detail: { storageКлюч, orderedIds: normalized },
      }),
    );
  }
}

export function writeАгентСортировкаMode(storageКлюч: string, sortMode: АгентSidebarСортировкаMode) {
  const normalized = normalizeСортировкаMode(sortMode);
  try {
    localStorage.setItem(storageКлюч, normalized);
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new СвойEvent<АгентСортировкаModeОбновленоDetail>(AGENT_SORT_MODE_UPDATED_EVENT, {
        detail: { storageКлюч, sortMode: normalized },
      }),
    );
  }
}

export function sortАгентыByПо умолчаниюSidebarOrder(agents: Агент[]): Агент[] {
  if (agents.length === 0) return [];

  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const childrenOf = new Map<string | null, Агент[]>();
  for (const agent of agents) {
    const parentId = agent.reportsTo && byId.has(agent.reportsTo) ? agent.reportsTo : null;
    const siblings = childrenOf.get(parentId) ?? [];
    siblings.push(agent);
    childrenOf.set(parentId, siblings);
  }

  for (const siblings of childrenOf.values()) {
    siblings.sort((left, right) => left.name.localeCompare(right.name));
  }

  const sorted: Агент[] = [];
  const queue = [...(childrenOf.get(null) ?? [])];
  while (queue.length > 0) {
    const agent = queue.shift();
    if (!agent) continue;
    sorted.push(agent);
    const children = childrenOf.get(agent.id);
    if (children) queue.push(...children);
  }

  return sorted;
}

export function sortАгентыByStoredOrder(agents: Агент[], orderedIds: string[]): Агент[] {
  if (agents.length === 0) return [];

  const defaultСортировкаed = sortАгентыByПо умолчаниюSidebarOrder(agents);
  if (orderedIds.length === 0) return defaultСортировкаed;

  const byId = new Map(defaultСортировкаed.map((agent) => [agent.id, agent]));
  const sorted: Агент[] = [];

  for (const id of orderedIds) {
    const agent = byId.get(id);
    if (!agent) continue;
    sorted.push(agent);
    byId.delete(id);
  }

  for (const agent of defaultСортировкаed) {
    if (byId.has(agent.id)) {
      sorted.push(agent);
      byId.delete(agent.id);
    }
  }

  return sorted;
}
