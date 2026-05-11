import { Link } from "@/lib/router";
import type { ExecutionРабочая область, Задача } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { КопироватьText } from "./КопироватьText";
import { ЗадачиQuicklook } from "./ЗадачиQuicklook";
import type { ProjectРабочая областьSummary } from "../lib/project-workspaces-tab";
import { cn, projectРабочая областьUrl } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Копировать, ExternalLink, ПапкаOpen, GitВетка, Loader2, Play, Square } from "lucide-react";

function workspaceKindLabel(kind: ProjectРабочая областьSummary["kind"]) {
  return kind === "execution_workspace" ? "Execution workspace" : "Project workspace";
}

function truncateПуть(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return `…/${parts.slice(-3).join("/")}`;
}

interface ProjectРабочая областьSummaryCardProps {
  projectRef: string;
  summary: ProjectРабочая областьSummary;
  runtimeActionКлюч: string | null;
  runtimeActionОжидание: boolean;
  onЗапуститьtimeAction: (input: {
    key: string;
    kind: "project_workspace" | "execution_workspace";
    workspaceId: string;
    action: "start" | "stop" | "restart";
  }) => void;
  onЗакрытьРабочая область: (input: {
    id: string;
    name: string;
    status: ExecutionРабочая область["status"];
  }) => void;
}

export function ProjectРабочая областьSummaryCard({
  projectRef,
  summary,
  runtimeActionКлюч,
  runtimeActionОжидание,
  onЗапуститьtimeAction,
  onЗакрытьРабочая область,
}: ProjectРабочая областьSummaryCardProps) {
  const visibleЗадачи = summary.issues.slice(0, 4);
  const hiddenЗадачаCount = Math.max(summary.issues.length - visibleЗадачи.length, 0);
  const workspaceHref =
    summary.kind === "project_workspace"
      ? projectРабочая областьUrl({ id: projectRef, urlКлюч: projectRef }, summary.workspaceId)
      : `/execution-workspaces/${summary.workspaceId}`;
  const hasВыполняетсяServices = summary.runningServiceCount > 0;
  const actionКлюч = `${summary.key}:${hasВыполняетсяServices ? "stop" : "start"}`;

  return (
    <div classИмя="rounded-lg border border-border bg-background p-4 shadow-sm sm:p-5">
      <div classИмя="flex flex-col gap-4">
        <div classИмя="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div classИмя="min-w-0 space-y-2">
            <div classИмя="flex flex-wrap items-center gap-2">
              <span classИмя="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {workspaceKindLabel(summary.kind)}
              </span>
              <span classИмя="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                Обновлено {timeAgo(summary.lastОбновленоAt)}
              </span>
              {summary.serviceCount > 0 ? (
                <span
                  classИмя={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    hasВыполняетсяServices
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border/70 bg-background text-muted-foreground",
                  )}
                >
                  <span
                    classИмя={cn(
                      "h-1.5 w-1.5 rounded-full",
                      hasВыполняетсяServices ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  {summary.runningServiceCount}/{summary.serviceCount} services
                </span>
              ) : null}
              {summary.executionРабочая областьСтатус ? (
                <span classИмя="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  {summary.executionРабочая областьСтатус.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
            <Link
              to={workspaceHref}
              classИмя="block break-words text-base font-semibold leading-6 text-foreground hover:underline"
            >
              {summary.workspaceИмя}
            </Link>
          </div>

          <div
            classИмя="flex flex-col gap-2 min-[420px]:flex-row lg:w-auto lg:justify-end"
            data-testid="workspace-summary-actions"
          >
            {summary.hasЗапуститьtimeConfig ? (
              <Button
                variant="outline"
                size="sm"
                classИмя="h-9 justify-center px-3 text-xs"
                disabled={runtimeActionОжидание}
                onClick={() =>
                  onЗапуститьtimeAction({
                    key: summary.key,
                    kind: summary.kind,
                    workspaceId: summary.workspaceId,
                    action: hasВыполняетсяServices ? "stop" : "start",
                  })
                }
              >
                {runtimeActionКлюч === actionКлюч ? (
                  <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : hasВыполняетсяServices ? (
                  <Square classИмя="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Play classИмя="mr-2 h-3.5 w-3.5" />
                )}
                {hasВыполняетсяServices ? "Остановить службы" : "Запустить службы"}
              </Button>
            ) : null}
            {summary.kind === "execution_workspace" && summary.executionРабочая областьId && summary.executionРабочая областьСтатус ? (
              <Button
                variant="ghost"
                size="sm"
                classИмя="h-9 px-3 text-xs text-muted-foreground"
                onClick={() => onЗакрытьРабочая область({
                  id: summary.executionРабочая областьId!,
                  name: summary.workspaceИмя,
                  status: summary.executionРабочая областьСтатус!,
                })}
              >
                {summary.executionРабочая областьСтатус === "cleanup_failed" ? "Повторить close" : "Закрыть workspace"}
              </Button>
            ) : null}
          </div>
        </div>

        <div classИмя="rounded-lg border border-border/70 bg-background px-3 py-3">
          <div classИмя="space-y-2 text-sm">
            {summary.branchИмя ? (
              <div classИмя="flex items-start gap-2">
                <GitВетка classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div classИмя="min-w-0 flex-1">
                  <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ветка</div>
                  <div classИмя="flex items-start gap-2">
                    <КопироватьText
                      text={summary.branchИмя}
                      containerClassИмя="min-w-0"
                      classИмя="min-w-0 break-all text-left font-mono text-xs text-foreground"
                      copiedLabel="Ветка copied"
                    >
                      {summary.branchИмя}
                    </КопироватьText>
                    <КопироватьText
                      text={summary.branchИмя}
                      ariaLabel="Копировать branch"
                      classИмя="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      copiedLabel="Ветка copied"
                    >
                      <Копировать classИмя="h-3.5 w-3.5" />
                    </КопироватьText>
                  </div>
                </div>
              </div>
            ) : null}

            {summary.cwd ? (
              <div classИмя="flex items-start gap-2">
                <ПапкаOpen classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div classИмя="min-w-0 flex-1">
                  <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Путь</div>
                  <div classИмя="flex items-start gap-2">
                    <КопироватьText
                      text={summary.cwd}
                      title={summary.cwd}
                      containerClassИмя="min-w-0"
                      classИмя="min-w-0 break-all text-left font-mono text-xs text-foreground"
                      copiedLabel="Путь copied"
                    >
                      {truncateПуть(summary.cwd)}
                    </КопироватьText>
                    <КопироватьText
                      text={summary.cwd}
                      ariaLabel="Копировать path"
                      classИмя="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      copiedLabel="Путь copied"
                    >
                      <Копировать classИмя="h-3.5 w-3.5" />
                    </КопироватьText>
                  </div>
                </div>
              </div>
            ) : null}

            {summary.primaryServiceUrl ? (
              <div classИмя="flex items-start gap-2">
                <ExternalLink classИмя="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div classИмя="min-w-0">
                  <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Service</div>
                  <a
                    href={summary.primaryServiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    classИмя={cn(
                      "break-all font-mono text-xs hover:underline",
                      summary.primaryServiceUrlВыполняется
                        ? "text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        : "text-foreground",
                    )}
                  >
                    {summary.primaryServiceUrl}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {summary.issues.length > 0 ? (
          <div classИмя="space-y-2">
            <div classИмя="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Linked issues
            </div>
            <div classИмя="flex flex-wrap gap-2">
              {visibleЗадачи.map((issue) => (
                <ЗадачаPill key={issue.id} issue={issue} />
              ))}
              {hiddenЗадачаCount > 0 ? (
                <Link
                  to={workspaceHref}
                  classИмя="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  +{hiddenЗадачаCount} more
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ЗадачаPill({ issue }: { issue: Задача }) {
  return (
    <ЗадачиQuicklook issue={issue}>
      <Link
        to={`/issues/${issue.identifier ?? issue.id}`}
        classИмя="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:border-foreground/30 hover:text-foreground hover:underline"
      >
        {issue.identifier ?? issue.id.slice(0, 8)}
      </Link>
    </ЗадачиQuicklook>
  );
}
