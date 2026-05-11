import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { sidebarPreferencesApi } from "../api/sidebarPreferences";
import { sortПроектыByStoredOrder } from "../lib/project-order";
import { queryКлючs } from "../lib/queryКлючs";

type UseProjectOrderParams = {
  projects: Project[];
  companyId: string | null | undefined;
  userId: string | null | undefined;
};

function areEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function buildOrderIds(projects: Project[], orderedIds: string[]) {
  return sortПроектыByStoredOrder(projects, orderedIds).map((project) => project.id);
}

export function useProjectOrder({ projects, companyId, userId }: UseProjectOrderParams) {
  const queryClient = useQueryClient();
  const queryКлюч = useMemo(
    () => queryКлючs.sidebarPreferences.projectOrder(companyId ?? "__none__", userId ?? "__anon__"),
    [companyId, userId],
  );

  const { data } = useQuery({
    queryКлюч,
    queryFn: () => sidebarPreferencesApi.getProjectOrder(companyId!),
    enabled: Boolean(companyId && userId),
  });

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    return buildOrderIds(projects, []);
  });

  useEffect(() => {
    const nextIds = buildOrderIds(projects, data?.orderedIds ?? []);
    setOrderedIds((current) => (areEqual(current, nextIds) ? current : nextIds));
  }, [data?.orderedIds, projects]);

  const mutation = useMutation({
    mutationFn: (nextIds: string[]) => sidebarPreferencesApi.updateProjectOrder(companyId!, { orderedIds: nextIds }),
    onУспешно: (preference) => {
      queryClient.setQueryData(queryКлюч, preference);
    },
  });

  const orderedПроекты = useMemo(
    () => sortПроектыByStoredOrder(projects, orderedIds),
    [projects, orderedIds],
  );

  const persistOrder = useCallback(
    (ids: string[]) => {
      const idSet = new Set(projects.map((project) => project.id));
      const filtered = ids.filter((id) => idSet.has(id));
      for (const project of projects) {
        if (!filtered.includes(project.id)) filtered.push(project.id);
      }

      setOrderedIds((current) => (areEqual(current, filtered) ? current : filtered));
      if (!companyId || !userId) return;

      queryClient.setQueryData(queryКлюч, (current: { orderedIds?: string[]; updatedAt?: Date | null } | undefined) => ({
        orderedIds: filtered,
        updatedAt: current?.updatedAt ?? null,
      }));
      mutation.mutate(filtered);
    },
    [companyId, mutation, projects, queryClient, queryКлюч, userId],
  );

  return {
    orderedПроекты,
    orderedIds,
    persistOrder,
  };
}
