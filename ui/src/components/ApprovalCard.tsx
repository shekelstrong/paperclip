import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Identity } from "./Identity";
import {
  approvalSubject,
  typeIcon,
  defaultТипIcon,
  СогласованиеPayloadRenderer,
  typeLabel,
} from "./СогласованиеPayload";
import { timeAgo } from "../lib/timeAgo";
import type { Согласование, Агент } from "@paperclipai/shared";
import { cn } from "@/lib/utils";

function statusIcon(status: string) {
  if (status === "approved") return <CheckCircle2 classИмя="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
  if (status === "rejected") return <XCircle classИмя="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (status === "revision_requested") return <Clock classИмя="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
  if (status === "pending") return <Clock classИмя="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
  return null;
}

export function СогласованиеCard({
  approval,
  requesterАгент,
  onОдобрить,
  onОтклонить,
  onOpen,
  detailLink,
  isОжидание = false,
  pendingAction = null,
}: {
  approval: Согласование;
  requesterАгент: Агент | null;
  onОдобрить?: () => void;
  onОтклонить?: () => void;
  onOpen?: () => void;
  detailLink?: string;
  isОжидание?: boolean;
  pendingAction?: "approve" | "reject" | null;
}) {
  const payload = approval.payload as Record<string, unknown> | null;
  const Icon = typeIcon[approval.type] ?? defaultТипIcon;
  const kindLabel = typeLabel[approval.type] ?? approval.type;
  const subject = approvalSubject(payload);
  const showResolutionButtons =
    Boolean(onОдобрить && onОтклонить) &&
    approval.type !== "budget_override_required" &&
    (approval.status === "pending" || approval.status === "revision_requested");
  const hasFooter = showResolutionButtons || Boolean(detailLink || onOpen);

  return (
    <div classИмя="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div classИмя="flex items-start justify-between gap-4">
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex items-start gap-3">
            <div classИмя="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80">
              <Icon classИмя="h-4 w-4 text-muted-foreground" />
            </div>
            <div classИмя="min-w-0 flex-1 space-y-2">
              <div classИмя="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  classИмя="border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {kindLabel}
                </Badge>
                {requesterАгент && (
                  <div classИмя="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Requested by</span>
                    <Identity name={requesterАгент.name} size="sm" classИмя="inline-flex" />
                  </div>
                )}
              </div>
              <div classИмя="space-y-1">
                <h3 classИмя="text-base font-semibold leading-6 text-foreground">
                  {subject ?? kindLabel}
                </h3>
                <p classИмя="text-xs leading-5 text-muted-foreground">
                  Согласование request created {timeAgo(approval.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div classИмя="shrink-0">
          <div classИмя="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
            {statusIcon(approval.status)}
            <span classИмя="capitalize">{approval.status.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>

      <div classИмя="mt-4 border-t border-border/60 pt-4">
        <СогласованиеPayloadRenderer
          type={approval.type}
          payload={approval.payload}
          hidePrimaryНазвание={Boolean(subject)}
        />
      </div>

      {approval.decisionНетte && (
        <div classИмя="mt-4 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
          <span classИмя="font-medium text-foreground">Decision note.</span> {approval.decisionНетte}
        </div>
      )}

      {hasFooter ? (
        <div classИмя="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div classИмя="flex flex-wrap items-center gap-2">
            {showResolutionButtons && (
              <>
                <Button
                  size="sm"
                  classИмя="bg-green-700 hover:bg-green-600 text-white"
                  onClick={onОдобрить}
                  disabled={isОжидание}
                >
                  {pendingAction === "approve" ? "Approving..." : "Одобрить"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onОтклонить}
                  disabled={isОжидание}
                >
                  {pendingAction === "reject" ? "Отклонитьing..." : "Отклонить"}
                </Button>
              </>
            )}
          </div>
          {(detailLink || onOpen) ? (
            detailLink ? (
              <Link
                to={detailLink}
                classИмя={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-auto px-2 text-xs text-muted-foreground")}
              >
                View details
              </Link>
            ) : (
              <Button variant="ghost" size="sm" classИмя="h-auto px-2 text-xs text-muted-foreground" onClick={onOpen}>
                View details
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
