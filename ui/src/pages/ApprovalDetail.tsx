import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useПоискParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусBadge } from "../components/СтатусBadge";
import { Identity } from "../components/Identity";
import { approvalLabel, typeIcon, defaultТипIcon, СогласованиеPayloadRenderer } from "../components/СогласованиеPayload";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import type { СогласованиеComment } from "@paperclipai/shared";
import { MarkdownBody } from "../components/MarkdownBody";

export function СогласованиеDetail() {
  const { approvalId } = useParams<{ approvalId: string }>();
  const { selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [searchParams] = useПоискParams();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [error, setОшибка] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);

  const { data: approval, isЗагрузка } = useQuery({
    queryКлюч: queryКлючs.approvals.detail(approvalId!),
    queryFn: () => approvalsApi.get(approvalId!),
    enabled: !!approvalId,
  });
  const resolvedКомпанияId = approval?.companyId ?? selectedКомпанияId;

  const { data: comments } = useQuery({
    queryКлюч: queryКлючs.approvals.comments(approvalId!),
    queryFn: () => approvalsApi.listКомментарии(approvalId!),
    enabled: !!approvalId,
  });

  const { data: linkedЗадачи } = useQuery({
    queryКлюч: queryКлючs.approvals.issues(approvalId!),
    queryFn: () => approvalsApi.listЗадачи(approvalId!),
    enabled: !!approvalId,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(resolvedКомпанияId ?? ""),
    queryFn: () => agentsApi.list(resolvedКомпанияId ?? ""),
    enabled: !!resolvedКомпанияId,
  });

  useEffect(() => {
    if (!approval?.companyId || approval.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(approval.companyId, { source: "route_sync" });
  }, [approval?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  const agentИмяById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Согласования", href: "/approvals" },
      { label: approval?.id?.slice(0, 8) ?? approvalId ?? "Согласование" },
    ]);
  }, [setBreadcrumbs, approval, approvalId]);

  const refresh = () => {
    if (!approvalId) return;
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.detail(approvalId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.comments(approvalId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.issues(approvalId) });
    if (approval?.companyId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(approval.companyId) });
      queryClient.invalidateQueries({
        queryКлюч: queryКлючs.approvals.list(approval.companyId, "pending"),
      });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(approval.companyId) });
    }
  };

  const approveMutation = useMutation({
    mutationFn: () => approvalsApi.approve(approvalId!),
    onУспешно: () => {
      setОшибка(null);
      refresh();
      navigate(`/approvals/${approvalId}?resolved=approved`, { replace: true });
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Одобрить failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => approvalsApi.reject(approvalId!),
    onУспешно: () => {
      setОшибка(null);
      refresh();
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Отклонить failed"),
  });

  const revisionMutation = useMutation({
    mutationFn: () => approvalsApi.requestRevision(approvalId!),
    onУспешно: () => {
      setОшибка(null);
      refresh();
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Revision request failed"),
  });

  const resubmitMutation = useMutation({
    mutationFn: () => approvalsApi.resubmit(approvalId!),
    onУспешно: () => {
      setОшибка(null);
      refresh();
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Resubmit failed"),
  });

  const addCommentMutation = useMutation({
    mutationFn: () => approvalsApi.addComment(approvalId!, commentBody.trim()),
    onУспешно: () => {
      setCommentBody("");
      setОшибка(null);
      refresh();
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Comment failed"),
  });

  const deleteАгентMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.remove(agentId),
    onУспешно: () => {
      setОшибка(null);
      refresh();
      navigate("/approvals");
    },
    onОшибка: (err) => setОшибка(err instanceof Ошибка ? err.message : "Ошибка удаления"),
  });

  if (isЗагрузка) return <PageSkeleton variant="detail" />;
  if (!approval) return <p classИмя="text-sm text-muted-foreground">Согласование not found.</p>;

  const payload = approval.payload as Record<string, unknown>;
  const linkedАгентId = typeof payload.agentId === "string" ? payload.agentId : null;
  const isActionable = approval.status === "pending" || approval.status === "revision_requested";
  const isБюджетСогласование = approval.type === "budget_override_required";
  const ТипIcon = typeIcon[approval.type] ?? defaultТипIcon;
  const showОдобритьdBanner = searchParams.get("resolved") === "approved" && approval.status === "approved";
  const primaryLinkedЗадача = linkedЗадачи?.[0] ?? null;
  const resolvedCta =
    primaryLinkedЗадача
      ? {
          label:
            (linkedЗадачи?.length ?? 0) > 1
              ? "Review linked issues"
              : "Review linked issue",
          to: `/issues/${primaryLinkedЗадача.identifier ?? primaryLinkedЗадача.id}`,
        }
      : linkedАгентId
        ? {
            label: "Open hired agent",
            to: `/agents/${linkedАгентId}`,
          }
        : {
            label: "Назад к согласованиям",
            to: "/approvals",
          };

  return (
    <div classИмя="space-y-6 max-w-3xl">
      {showОдобритьdBanner && (
        <div classИмя="border border-green-300 dark:border-green-700/40 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3 animate-in fade-in zoom-in-95 duration-300">
          <div classИмя="flex items-start justify-between gap-3">
            <div classИмя="flex items-start gap-2">
              <div classИмя="relative mt-0.5">
                <CheckCircle2 classИмя="h-4 w-4 text-green-600 dark:text-green-300" />
                <Sparkles classИмя="h-3 w-3 text-green-500 dark:text-green-200 absolute -right-2 -top-1 animate-pulse" />
              </div>
              <div>
                <p classИмя="text-sm text-green-800 dark:text-green-100 font-medium">Согласование confirmed</p>
                <p classИмя="text-xs text-green-700 dark:text-green-200/90">
                  Requesting agent was notified to review this approval and linked issues.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              classИмя="border-green-400 dark:border-green-600/50 text-green-800 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900/30"
              onClick={() => navigate(resolvedCta.to)}
            >
              {resolvedCta.label}
            </Button>
          </div>
        </div>
      )}
      <div classИмя="border border-border rounded-lg p-4 space-y-3">
        <div classИмя="flex items-center justify-between">
          <div classИмя="flex items-center gap-2">
            <ТипIcon classИмя="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <h2 classИмя="text-lg font-semibold">{approvalLabel(approval.type, approval.payload as Record<string, unknown> | null)}</h2>
              <p classИмя="text-xs text-muted-foreground font-mono">{approval.id}</p>
            </div>
          </div>
          <СтатусBadge status={approval.status} />
        </div>
        <div classИмя="text-sm space-y-1">
          {approval.requestedByАгентId && (
            <div classИмя="flex items-center gap-2">
              <span classИмя="text-muted-foreground text-xs">Requested by</span>
              <Identity
                name={agentИмяById.get(approval.requestedByАгентId) ?? approval.requestedByАгентId.slice(0, 8)}
                size="sm"
              />
            </div>
          )}
          <СогласованиеPayloadRenderer type={approval.type} payload={payload} />
          <button
            type="button"
            classИмя="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
            onClick={() => setShowRawPayload((v) => !v)}
          >
            <ChevronRight classИмя={`h-3 w-3 transition-transform ${showRawPayload ? "rotate-90" : ""}`} />
            See full request
          </button>
          {showRawPayload && (
            <pre classИмя="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
          {approval.decisionНетte && (
            <p classИмя="text-xs text-muted-foreground">Decision note: {approval.decisionНетte}</p>
          )}
        </div>
        {error && <p classИмя="text-sm text-destructive">{error}</p>}
        {linkedЗадачи && linkedЗадачи.length > 0 && (
          <div classИмя="pt-2 border-t border-border/60">
            <p classИмя="text-xs text-muted-foreground mb-1.5">Linked Задачи</p>
            <div classИмя="space-y-1.5">
              {linkedЗадачи.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.identifier ?? issue.id}`}
                  classИмя="block text-xs rounded border border-border/70 px-2 py-1.5 hover:bg-accent/20"
                >
                  <span classИмя="font-mono text-muted-foreground mr-2">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  <span>{issue.title}</span>
                </Link>
              ))}
            </div>
            <p classИмя="text-[11px] text-muted-foreground mt-2">
              Linked issues remain open until the requesting agent follows up and closes them.
            </p>
          </div>
        )}
        <div classИмя="flex flex-wrap items-center gap-2">
          {isActionable && !isБюджетСогласование && (
            <>
              <Button
                size="sm"
                classИмя="bg-green-700 hover:bg-green-600 text-white"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isОжидание}
              >
                Одобрить
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isОжидание}
              >
                Отклонить
              </Button>
            </>
          )}
          {isБюджетСогласование && approval.status === "pending" && (
            <p classИмя="text-sm text-muted-foreground">
              Resolve this budget stop from the budget controls on <Link to="/costs" classИмя="underline underline-offset-2">/costs</Link>.
            </p>
          )}
          {approval.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => revisionMutation.mutate()}
              disabled={revisionMutation.isОжидание}
            >
              Request revision
            </Button>
          )}
          {approval.status === "revision_requested" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resubmitMutation.mutate()}
              disabled={resubmitMutation.isОжидание}
            >
              Mark resubmitted
            </Button>
          )}
          {approval.status === "rejected" && approval.type === "hire_agent" && linkedАгентId && (
            <Button
              size="sm"
              variant="outline"
              classИмя="text-destructive border-destructive/40"
              onClick={() => {
                if (!window.confirm("Удалить this disapproved agent? This cannot be undone.")) return;
                deleteАгентMutation.mutate(linkedАгентId);
              }}
              disabled={deleteАгентMutation.isОжидание}
            >
              Удалить disapproved agent
            </Button>
          )}
        </div>
      </div>

      <div classИмя="border border-border rounded-lg p-4 space-y-3">
        <h3 classИмя="text-sm font-medium">Комментарии ({comments?.length ?? 0})</h3>
        <div classИмя="space-y-2">
          {(comments ?? []).map((comment: СогласованиеComment) => (
            <div key={comment.id} classИмя="border border-border/60 rounded-md p-3">
              <div classИмя="flex items-center justify-between mb-1">
                {comment.authorАгентId ? (
                  <Link to={`/agents/${comment.authorАгентId}`} classИмя="hover:underline">
                    <Identity
                      name={agentИмяById.get(comment.authorАгентId) ?? comment.authorАгентId.slice(0, 8)}
                      size="sm"
                    />
                  </Link>
                ) : (
                  <Identity name="Совет" size="sm" />
                )}
                <span classИмя="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <MarkdownBody classИмя="text-sm">{comment.body}</MarkdownBody>
            </div>
          ))}
        </div>
        <Textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Добавить a comment..."
          rows={3}
        />
        <div classИмя="flex justify-end">
          <Button
            size="sm"
            onClick={() => addCommentMutation.mutate()}
            disabled={!commentBody.trim() || addCommentMutation.isОжидание}
          >
            {addCommentMutation.isОжидание ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
