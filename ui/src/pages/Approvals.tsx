import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { cn } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import { СогласованиеCard } from "../components/СогласованиеCard";
import { PageSkeleton } from "../components/PageSkeleton";

type СтатусФильтр = "pending" | "all";

export function Согласования() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegment = location.pathname.split("/").pop() ?? "pending";
  const statusФильтр: СтатусФильтр = pathSegment === "all" ? "all" : "pending";
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Согласования" }]);
  }, [setBreadcrumbs]);

  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!),
    queryFn: () => approvalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onУспешно: (_approval, id) => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onУспешно: () => {
      setActionОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(selectedКомпанияId!) });
    },
    onОшибка: (err) => {
      setActionОшибка(err instanceof Ошибка ? err.message : "Ошибка to reject");
    },
  });

  const filtered = (data ?? [])
    .filter(
      (a) => statusФильтр === "all" || a.status === "pending" || a.status === "revision_requested",
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = (data ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  if (!selectedКомпанияId) {
    return <p classИмя="text-sm text-muted-foreground">Select a company first.</p>;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="approvals" />;
  }

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex items-center justify-between">
        <Tabs value={statusФильтр} onЗначениеChange={(v) => navigate(`/approvals/${v}`)}>
          <PageTabBar items={[
            { value: "pending", label: <>Ожидание{pendingCount > 0 && (
              <span classИмя={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                "bg-yellow-500/20 text-yellow-500"
              )}>
                {pendingCount}
              </span>
            )}</> },
            { value: "all", label: "Все" },
          ]} />
        </Tabs>
      </div>

      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}
      {actionОшибка && <p classИмя="text-sm text-destructive">{actionОшибка}</p>}

      {filtered.length === 0 && (
        <div classИмя="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck classИмя="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p classИмя="text-sm text-muted-foreground">
            {statusФильтр === "pending" ? "Нет pending approvals." : "Нет approvals yet."}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div classИмя="grid gap-3">
          {filtered.map((approval) => (
            <СогласованиеCard
              key={approval.id}
              approval={approval}
              requesterАгент={approval.requestedByАгентId ? (agents ?? []).find((a) => a.id === approval.requestedByАгентId) ?? null : null}
              onОдобрить={() => approveMutation.mutate(approval.id)}
              onОтклонить={() => rejectMutation.mutate(approval.id)}
              detailLink={`/approvals/${approval.id}`}
              isОжидание={approveMutation.isОжидание || rejectMutation.isОжидание}
              pendingAction={
                approveMutation.isОжидание ? "approve" : rejectMutation.isОжидание ? "reject" : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
