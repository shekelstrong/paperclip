import { useCallback, useEffect, useMemo, useState } from "react";
import type { Агент } from "@paperclipai/shared";
import {
  AGENT_ORDER_UPDATED_EVENT,
  getАгентOrderStorageКлюч,
  readАгентOrder,
  sortАгентыByStoredOrder,
  writeАгентOrder,
} from "../lib/agent-order";

type UseАгентOrderParams = {
  agents: Агент[];
  companyId: string | null | undefined;
  userId: string | null | undefined;
};

type АгентOrderОбновленоDetail = {
  storageКлюч: string;
  orderedIds: string[];
};

function areEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildOrderIds(agents: Агент[], orderedIds: string[]) {
  return sortАгентыByStoredOrder(agents, orderedIds).map((agent) => agent.id);
}

export function useАгентOrder({ agents, companyId, userId }: UseАгентOrderParams) {
  const storageКлюч = useMemo(() => {
    if (!companyId) return null;
    return getАгентOrderStorageКлюч(companyId, userId);
  }, [companyId, userId]);

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (!storageКлюч) return agents.map((agent) => agent.id);
    return buildOrderIds(agents, readАгентOrder(storageКлюч));
  });

  useEffect(() => {
    const nextIds = storageКлюч
      ? buildOrderIds(agents, readАгентOrder(storageКлюч))
      : agents.map((agent) => agent.id);
    setOrderedIds((current) => (areEqual(current, nextIds) ? current : nextIds));
  }, [agents, storageКлюч]);

  useEffect(() => {
    if (!storageКлюч) return;

    const syncFromIds = (ids: string[]) => {
      const nextIds = buildOrderIds(agents, ids);
      setOrderedIds((current) => (areEqual(current, nextIds) ? current : nextIds));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageКлюч) return;
      syncFromIds(readАгентOrder(storageКлюч));
    };
    const onСвойEvent = (event: Event) => {
      const detail = (event as СвойEvent<АгентOrderОбновленоDetail>).detail;
      if (!detail || detail.storageКлюч !== storageКлюч) return;
      syncFromIds(detail.orderedIds);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(AGENT_ORDER_UPDATED_EVENT, onСвойEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AGENT_ORDER_UPDATED_EVENT, onСвойEvent);
    };
  }, [agents, storageКлюч]);

  const orderedАгенты = useMemo(
    () => sortАгентыByStoredOrder(agents, orderedIds),
    [agents, orderedIds],
  );

  const persistOrder = useCallback(
    (ids: string[]) => {
      const idSet = new Set(agents.map((agent) => agent.id));
      const filtered = ids.filter((id) => idSet.has(id));
      for (const agent of sortАгентыByStoredOrder(agents, [])) {
        if (!filtered.includes(agent.id)) filtered.push(agent.id);
      }

      setOrderedIds((current) => (areEqual(current, filtered) ? current : filtered));
      if (storageКлюч) {
        writeАгентOrder(storageКлюч, filtered);
      }
    },
    [agents, storageКлюч],
  );

  return {
    orderedАгенты,
    orderedIds,
    persistOrder,
  };
}
