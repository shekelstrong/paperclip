import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExecutionРабочая область } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Loader2 } from "lucide-react";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { useToastActions } from "../context/ToastContext";
import { queryКлючs } from "../lib/queryКлючs";
import { formatDateTime, issueUrl } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "./ui/dialog";

type ExecutionРабочая областьЗакрытьDialogProps = {
  workspaceId: string;
  workspaceИмя: string;
  currentСтатус: ExecutionРабочая область["status"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onЗакрытьd?: (workspace: ExecutionРабочая область) => void;
};

function readinessTone(state: "ready" | "ready_with_warnings" | "blocked") {
  if (state === "blocked") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (state === "ready_with_warnings") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export function ExecutionРабочая областьЗакрытьDialog({
  workspaceId,
  workspaceИмя,
  currentСтатус,
  open,
  onOpenChange,
  onЗакрытьd,
}: ExecutionРабочая областьЗакрытьDialogProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const actionLabel = currentСтатус === "cleanup_failed" ? "Повторить close" : "Закрыть workspace";

  const readinessQuery = useQuery({
    queryКлюч: queryКлючs.executionРабочие области.closeReadiness(workspaceId),
    queryFn: () => executionРабочие областиApi.getЗакрытьReadiness(workspaceId),
    enabled: open,
  });

  const closeРабочая область = useMutation({
    mutationFn: () => executionРабочие областиApi.update(workspaceId, { status: "archived" }),
    onУспешно: (workspace) => {
      queryClient.setQueryData(queryКлючs.executionРабочие области.detail(workspace.id), workspace);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.closeReadiness(workspace.id) });
      pushToast({
        title: currentСтатус === "cleanup_failed" ? "Рабочая область close retried" : "Рабочая область closed",
        tone: "success",
      });
      onOpenChange(false);
      onЗакрытьd?.(workspace);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to close workspace",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const readiness = readinessQuery.data ?? null;
  const blockingЗадачи = readiness?.linkedЗадачи.filter((issue) => !issue.isTerminal) ?? [];
  const otherLinkedЗадачи = readiness?.linkedЗадачи.filter((issue) => issue.isTerminal) ?? [];
  const confirmОтключитьd =
    currentСтатус === "archived" ||
    closeРабочая область.isОжидание ||
    readinessQuery.isЗагрузка ||
    readiness == null ||
    readiness.state === "blocked";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!closeРабочая область.isОжидание) onOpenChange(nextOpen);
    }}>
      <DialogContent classИмя="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogНазвание>{actionLabel}</DialogНазвание>
          <DialogОписание classИмя="break-words">
            Архивировать <span classИмя="font-medium text-foreground">{workspaceИмя}</span> and clean up any owned workspace
            artifacts. Paperclip keeps the workspace record and issue history, but removes it from active workspace views.
          </DialogОписание>
        </DialogHeader>

        {readinessQuery.isЗагрузка ? (
          <div classИмя="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <Loader2 classИмя="h-4 w-4 animate-spin" />
            Checking whether this workspace is safe to close...
          </div>
        ) : readinessQuery.error ? (
          <div classИмя="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {readinessQuery.error instanceof Ошибка ? readinessQuery.error.message : "Ошибка to inspect workspace close readiness."}
          </div>
        ) : readiness ? (
          <div classИмя="space-y-4">
            <div classИмя={`rounded-xl border px-4 py-3 text-sm ${readinessTone(readiness.state)}`}>
              <div classИмя="font-medium">
                {readiness.state === "blocked"
                  ? "Закрыть is blocked"
                  : readiness.state === "ready_with_warnings"
                    ? "Закрыть is allowed with warnings"
                    : "Закрыть is ready"}
              </div>
              <div classИмя="mt-1 text-xs opacity-80">
                {readiness.isSharedРабочая область
                  ? "This is a shared workspace session. Archiving it removes this session record but keeps the underlying project workspace."
                  : readiness.git?.workspaceПуть && readiness.git.repoRoot && readiness.git.workspaceПуть !== readiness.git.repoRoot
                    ? "This execution workspace has its own checkout path and can be archived independently."
                    : readiness.isProjectPrimaryРабочая область
                      ? "This execution workspace currently points at the project's primary workspace path."
                      : "This workspace is disposable and can be archived."}
              </div>
            </div>

            {blockingЗадачи.length > 0 ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Blocking issues</h3>
                <div classИмя="space-y-2">
                  {blockingЗадачи.map((issue) => (
                    <div key={issue.id} classИмя="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
                      <div classИмя="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <Link to={issueUrl(issue)} classИмя="min-w-0 break-words font-medium hover:underline">
                          {issue.identifier ?? issue.id} · {issue.title}
                        </Link>
                        <span classИмя="text-xs text-muted-foreground">{issue.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {readiness.blockingReasons.length > 0 ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Blocking reasons</h3>
                <ul classИмя="space-y-2 text-sm text-muted-foreground">
                  {readiness.blockingReasons.map((reason) => (
                    <li key={reason} classИмя="break-words rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive">
                      {reason}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {readiness.warnings.length > 0 ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Предупреждениеs</h3>
                <ul classИмя="space-y-2 text-sm text-muted-foreground">
                  {readiness.warnings.map((warning) => (
                    <li key={warning} classИмя="break-words rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      {warning}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {readiness.git ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Git status</h3>
                <div classИмя="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                  <div classИмя="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ветка</div>
                      <div classИмя="font-mono text-xs">{readiness.git.branchИмя ?? "Неизвестно"}</div>
                    </div>
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Base ref</div>
                      <div classИмя="font-mono text-xs">{readiness.git.baseRef ?? "Не задано"}</div>
                    </div>
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Merged into base</div>
                      <div>{readiness.git.isMergedIntoBase == null ? "Неизвестно" : readiness.git.isMergedIntoBase ? "Да" : "Нет"}</div>
                    </div>
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ahead / behind</div>
                      <div>
                        {(readiness.git.aheadCount ?? 0).toString()} / {(readiness.git.behindCount ?? 0).toString()}
                      </div>
                    </div>
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dirty tracked files</div>
                      <div>{readiness.git.dirtyEntryCount}</div>
                    </div>
                    <div>
                      <div classИмя="text-xs uppercase tracking-[0.16em] text-muted-foreground">Untracked files</div>
                      <div>{readiness.git.untrackedEntryCount}</div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {otherLinkedЗадачи.length > 0 ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Other linked issues</h3>
                <div classИмя="space-y-2">
                  {otherLinkedЗадачи.map((issue) => (
                    <div key={issue.id} classИмя="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                      <div classИмя="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <Link to={issueUrl(issue)} classИмя="min-w-0 break-words font-medium hover:underline">
                          {issue.identifier ?? issue.id} · {issue.title}
                        </Link>
                        <span classИмя="text-xs text-muted-foreground">{issue.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {readiness.runtimeServices.length > 0 ? (
              <section classИмя="space-y-2">
                <h3 classИмя="text-sm font-medium">Attached runtime services</h3>
                <div classИмя="space-y-2">
                  {readiness.runtimeServices.map((service) => (
                    <div key={service.id} classИмя="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                      <div classИмя="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span classИмя="font-medium">{service.serviceИмя}</span>
                        <span classИмя="text-xs text-muted-foreground">{service.status} · {service.lifecycle}</span>
                      </div>
                      <div classИмя="mt-1 break-words text-xs text-muted-foreground">
                        {service.url ?? service.command ?? service.cwd ?? "Нет additional details"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section classИмя="space-y-2">
              <h3 classИмя="text-sm font-medium">Cleanup actions</h3>
              <div classИмя="space-y-2">
                {readiness.plannedActions.map((action, index) => (
                  <div key={`${action.kind}-${index}`} classИмя="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                    <div classИмя="font-medium">{action.label}</div>
                    <div classИмя="mt-1 break-words text-muted-foreground">{action.description}</div>
                    {action.command ? (
                      <pre classИмя="mt-2 whitespace-pre-wrap break-all rounded-lg bg-background px-3 py-2 font-mono text-xs text-foreground">
                        {action.command}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {currentСтатус === "cleanup_failed" ? (
              <div classИмя="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                Cleanup previously failed on this workspace. Повторитьing close will rerun the cleanup flow and update the
                workspace status if it succeeds.
              </div>
            ) : null}

            {currentСтатус === "archived" ? (
              <div classИмя="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                This workspace is already archived.
              </div>
            ) : null}

            {readiness.git?.repoRoot ? (
              <div classИмя="break-words text-xs text-muted-foreground">
                Репозиторий root: <span classИмя="font-mono break-all">{readiness.git.repoRoot}</span>
                {readiness.git.workspaceПуть ? (
                  <>
                    {" · "}Рабочая область path: <span classИмя="font-mono break-all">{readiness.git.workspaceПуть}</span>
                  </>
                ) : null}
              </div>
            ) : null}

            <div classИмя="text-xs text-muted-foreground">
              Last checked {formatDateTime(new Date())}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={closeРабочая область.isОжидание}
          >
            Отмена
          </Button>
          <Button
            variant={currentСтатус === "cleanup_failed" ? "default" : "destructive"}
            onClick={() => closeРабочая область.mutate()}
            disabled={confirmОтключитьd}
          >
            {closeРабочая область.isОжидание ? <Loader2 classИмя="mr-2 h-4 w-4 animate-spin" /> : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
