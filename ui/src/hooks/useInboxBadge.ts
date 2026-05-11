import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi } from "../api/access";
import { ApiОшибка } from "../api/client";
import { inboxЗакрытьalsApi } from "../api/inboxЗакрытьals";
import { approvalsApi } from "../api/approvals";
import { authApi } from "../api/auth";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { queryКлючs } from "../lib/queryКлючs";
import {
  buildВходящиеЗакрытьedAtByКлюч,
  computeВходящиеBadgeData,
  getRecentTouchedЗадачи,
  loadЗакрытьedВходящиеAlerts,
  saveЗакрытьedВходящиеAlerts,
  loadReadВходящиеItems,
  saveReadВходящиеItems,
  READ_ITEMS_KEY,
} from "../lib/inbox";

const INBOX_ISSUE_STATUSES = "backlog,todo,in_progress,in_review,blocked,done";
const INBOX_BADGE_ISSUE_LIMIT = 500;
const INBOX_BADGE_HEARTBEAT_RUN_LIMIT = 200;

export function useЗакрытьedВходящиеAlerts() {
  const [dismissed, setЗакрытьed] = useState<Set<string>>(loadЗакрытьedВходящиеAlerts);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "paperclip:inbox:dismissed") return;
      setЗакрытьed(loadЗакрытьedВходящиеAlerts());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const dismiss = (id: string) => {
    setЗакрытьed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveЗакрытьedВходящиеAlerts(next);
      return next;
    });
  };

  return { dismissed, dismiss };
}

export function useВходящиеЗакрытьals(companyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryКлюч = companyId
    ? queryКлючs.inboxЗакрытьals(companyId)
    : ["inbox-dismissals", "__disabled__"] as const;

  const { data: dismissals = [] } = useQuery({
    queryКлюч,
    queryFn: () => inboxЗакрытьalsApi.list(companyId!),
    enabled: !!companyId,
  });

  const dismissMutation = useMutation({
    mutationFn: ({ itemКлюч }: { itemКлюч: string }) => inboxЗакрытьalsApi.dismiss(companyId!, itemКлюч),
    onMutate: async ({ itemКлюч }) => {
      if (!companyId) return { previous: [] as typeof dismissals };
      await queryClient.cancelQueries({ queryКлюч });
      const previous = queryClient.getQueryData<typeof dismissals>(queryКлюч) ?? [];
      const now = new Date();
      queryClient.setQueryData(queryКлюч, [
        {
          id: `optimistic:${itemКлюч}`,
          companyId,
          userId: "me",
          itemКлюч,
          dismissedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        ...previous.filter((dismissal) => dismissal.itemКлюч !== itemКлюч),
      ]);
      return { previous };
    },
    onОшибка: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(queryКлюч, context.previous);
    },
    onSettled: () => {
      if (!companyId) return;
      queryClient.invalidateQueries({ queryКлюч });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(companyId) });
    },
  });

  const dismissedAtByКлюч = useMemo(
    () => buildВходящиеЗакрытьedAtByКлюч(dismissals),
    [dismissals],
  );

  return {
    dismissals,
    dismissedAtByКлюч,
    dismiss: (itemКлюч: string) => dismissMutation.mutate({ itemКлюч }),
    isОжидание: dismissMutation.isОжидание,
  };
}

export function useReadВходящиеItems() {
  const [readItems, setReadItems] = useState<Set<string>>(loadReadВходящиеItems);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== READ_ITEMS_KEY) return;
      setReadItems(loadReadВходящиеItems());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const markRead = (id: string) => {
    setReadItems((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadВходящиеItems(next);
      return next;
    });
  };

  const markUnread = (id: string) => {
    setReadItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveReadВходящиеItems(next);
      return next;
    });
  };

  return { readItems, markRead, markUnread };
}

export function useВходящиеBadge(companyId: string | null | undefined) {
  const { dismissed: dismissedAlerts } = useЗакрытьedВходящиеAlerts();
  const { dismissedAtByКлюч } = useВходящиеЗакрытьals(companyId);
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: approvals = [] } = useQuery({
    queryКлюч: queryКлючs.approvals.list(companyId!),
    queryFn: () => approvalsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: joinRequests = [] } = useQuery({
    queryКлюч: queryКлючs.access.joinRequests(companyId!),
    queryFn: async () => {
      try {
        return await accessApi.listJoinRequests(companyId!, "pending_approval");
      } catch (err) {
        if (err instanceof ApiОшибка && (err.status === 401 || err.status === 403)) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!companyId,
    retry: false,
  });

  const { data: dashboard } = useQuery({
    queryКлюч: queryКлючs.dashboard(companyId!),
    queryFn: () => dashboardApi.summary(companyId!),
    enabled: !!companyId,
  });

  const { data: mineЗадачиRaw = [] } = useQuery({
    queryКлюч: queryКлючs.issues.listMineByMe(companyId!),
    queryFn: () =>
      issuesApi.list(companyId!, {
        touchedByUserId: "me",
        inboxАрхивированByUserId: "me",
        status: INBOX_ISSUE_STATUSES,
        limit: INBOX_BADGE_ISSUE_LIMIT,
      }),
    enabled: !!companyId,
  });

  const mineЗадачи = useMemo(() => getRecentTouchedЗадачи(mineЗадачиRaw), [mineЗадачиRaw]);
  const currentUserId = session?.user.id ?? session?.session.userId ?? null;

  const { data: heartbeatЗапуститьs = [] } = useQuery({
    queryКлюч: [...queryКлючs.heartbeats(companyId!), "limit", INBOX_BADGE_HEARTBEAT_RUN_LIMIT],
    queryFn: () => heartbeatsApi.list(companyId!, undefined, INBOX_BADGE_HEARTBEAT_RUN_LIMIT),
    enabled: !!companyId,
  });

  return useMemo(
    () =>
      computeВходящиеBadgeData({
        approvals,
        joinRequests,
        dashboard,
        heartbeatЗапуститьs,
        mineЗадачи,
        dismissedAlerts,
        dismissedAtByКлюч,
        currentUserId,
      }),
    [approvals, joinRequests, dashboard, heartbeatЗапуститьs, mineЗадачи, dismissedAlerts, dismissedAtByКлюч, currentUserId],
  );
}
