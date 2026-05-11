import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus2 } from "lucide-react";
import { accessApi } from "@/api/access";
import { ApiОшибка } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useКомпания } from "@/context/КомпанияContext";
import { useToast } from "@/context/ToastContext";
import { queryКлючs } from "@/lib/queryКлючs";

export function JoinRequestQueue() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [status, setСтатус] = useState<"pending_approval" | "approved" | "rejected">("pending_approval");
  const [requestТип, setRequestТип] = useState<"all" | "human" | "agent">("all");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Входящие", href: "/inbox" },
      { label: "Join Requests" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const requestsQuery = useQuery({
    queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId ?? "", `${status}:${requestТип}`),
    queryFn: () =>
      accessApi.listJoinRequests(
        selectedКомпанияId!,
        status,
        requestТип === "all" ? undefined : requestТип,
      ),
    enabled: !!selectedКомпанияId,
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.approveJoinRequest(selectedКомпанияId!, requestId),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId!, `${status}:${requestТип}`) });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.companyMembers(selectedКомпанияId!) });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!) });
      pushToast({ title: "Join request approved", tone: "success" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.rejectJoinRequest(selectedКомпанияId!, requestId),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId!, `${status}:${requestТип}`) });
      pushToast({ title: "Join request rejected", tone: "success" });
    },
  });

  if (!selectedКомпанияId) {
    return <div classИмя="text-sm text-muted-foreground">Select a company to review join requests.</div>;
  }

  if (requestsQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка join requests…</div>;
  }

  if (requestsQuery.error) {
    const message =
      requestsQuery.error instanceof ApiОшибка && requestsQuery.error.status === 403
        ? "You do not have permission to review join requests for this company."
        : requestsQuery.error instanceof Ошибка
          ? requestsQuery.error.message
          : "Ошибка to load join requests.";
    return <div classИмя="text-sm text-destructive">{message}</div>;
  }

  return (
    <div classИмя="max-w-6xl space-y-6">
      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <UserPlus2 classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Join Request Queue</h1>
        </div>
        <p classИмя="max-w-3xl text-sm text-muted-foreground">
          Review human and agent join requests outside the mixed inbox feed. This queue uses the same approval mutations as the inline inbox cards.
        </p>
      </div>

      <div classИмя="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
        <label classИмя="space-y-2 text-sm">
          <span classИмя="font-medium">Статус</span>
          <select
            classИмя="rounded-md border border-border bg-background px-3 py-2"
            value={status}
            onChange={(event) =>
              setСтатус(event.target.value as "pending_approval" | "approved" | "rejected")
            }
          >
            <option value="pending_approval">Ожидание approval</option>
            <option value="approved">Одобритьd</option>
            <option value="rejected">Отклонитьed</option>
          </select>
        </label>
        <label classИмя="space-y-2 text-sm">
          <span classИмя="font-medium">Request type</span>
          <select
            classИмя="rounded-md border border-border bg-background px-3 py-2"
            value={requestТип}
            onChange={(event) =>
              setRequestТип(event.target.value as "all" | "human" | "agent")
            }
          >
            <option value="all">Все</option>
            <option value="human">Человек</option>
            <option value="agent">Агент</option>
          </select>
        </label>
      </div>

      <div classИмя="space-y-4">
        {(requestsQuery.data ?? []).length === 0 ? (
          <div classИмя="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            Нет join requests match the current filters.
          </div>
        ) : (
          requestsQuery.data!.map((request) => (
            <div key={request.id} classИмя="rounded-xl border border-border bg-card p-4">
              <div classИмя="flex flex-wrap items-start justify-between gap-4">
                <div classИмя="space-y-2">
                  <div classИмя="flex flex-wrap items-center gap-2">
                    <Badge variant={request.status === "pending_approval" ? "secondary" : request.status === "approved" ? "outline" : "destructive"}>
                      {request.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{request.requestТип}</Badge>
                    {request.adapterТип ? <Badge variant="outline">{request.adapterТип}</Badge> : null}
                  </div>
                  <div>
                    <div classИмя="text-base font-medium">
                      {request.requestТип === "human"
                        ? request.requesterUser?.name || request.requestПочтаSnapshot || request.requestingUserId || "Неизвестно human requester"
                        : request.agentИмя || "Неизвестно agent requester"}
                    </div>
                    <div classИмя="text-sm text-muted-foreground">
                      {request.requestТип === "human"
                        ? request.requesterUser?.email || request.requestПочтаSnapshot || request.requestingUserId
                        : request.capabilities || request.requestIp}
                    </div>
                  </div>
                </div>

                {request.status === "pending_approval" ? (
                  <div classИмя="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={rejectMutation.isОжидание}
                    >
                      Отклонить
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isОжидание}
                    >
                      Одобрить
                    </Button>
                  </div>
                ) : null}
              </div>

              <div classИмя="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <div classИмя="rounded-lg border border-border bg-background px-3 py-2">
                  <div classИмя="text-xs font-medium uppercase tracking-wide">Invite context</div>
                  <div classИмя="mt-2">
                    {request.invite
                      ? `${request.invite.allowedJoinТипs} join invite${request.invite.humanRole ? ` • default role ${request.invite.humanRole}` : ""}`
                      : "Invite metadata unavailable"}
                  </div>
                  {request.invite?.inviteMessage ? (
                    <div classИмя="mt-2 text-foreground">{request.invite.inviteMessage}</div>
                  ) : null}
                </div>
                <div classИмя="rounded-lg border border-border bg-background px-3 py-2">
                  <div classИмя="text-xs font-medium uppercase tracking-wide">Request details</div>
                  <div classИмя="mt-2">Отправитьted {new Date(request.createdAt).toLocaleString()}</div>
                  <div>Source IP {request.requestIp}</div>
                  {request.requestТип === "agent" && request.capabilities ? <div>{request.capabilities}</div> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
