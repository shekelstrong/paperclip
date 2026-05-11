import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExecutionРабочая область } from "@paperclipai/shared";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { projectsApi } from "../api/projects";
import { queryКлючs } from "../lib/queryКлючs";
import type { ProjectРабочая областьSummary } from "../lib/project-workspaces-tab";
import { ExecutionРабочая областьЗакрытьDialog } from "./ExecutionРабочая областьЗакрытьDialog";
import { ProjectРабочая областьSummaryCard } from "./ProjectРабочая областьSummaryCard";

export function ProjectРабочие областиContent({
  companyId,
  projectId,
  projectRef,
  summaries,
}: {
  companyId: string;
  projectId: string;
  projectRef: string;
  summaries: ProjectРабочая областьSummary[];
}) {
  const queryClient = useQueryClient();
  const [runtimeActionКлюч, setЗапуститьtimeActionКлюч] = useState<string | null>(null);
  const [closingРабочая область, setClosingРабочая область] = useState<{
    id: string;
    name: string;
    status: ExecutionРабочая область["status"];
  } | null>(null);
  const controlРабочая областьЗапуститьtime = useMutation({
    mutationFn: async (input: {
      key: string;
      kind: "project_workspace" | "execution_workspace";
      workspaceId: string;
      action: "start" | "stop" | "restart";
    }) => {
      setЗапуститьtimeActionКлюч(`${input.key}:${input.action}`);
      if (input.kind === "project_workspace") {
        return await projectsApi.controlРабочая областьЗапуститьtimeServices(projectId, input.workspaceId, input.action, companyId);
      }
      return await executionРабочие областиApi.controlЗапуститьtimeServices(input.workspaceId, input.action);
    },
    onSettled: () => {
      setЗапуститьtimeActionКлюч(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.list(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.list(companyId, { projectId }) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, projectId) });
    },
  });

  if (summaries.length === 0) {
    return <p classИмя="text-sm text-muted-foreground">Нет non-default workspace activity yet.</p>;
  }

  const activeSummaries = summaries.filter((summary) => summary.executionРабочая областьСтатус !== "cleanup_failed");
  const cleanupОшибкаSummaries = summaries.filter((summary) => summary.executionРабочая областьСтатус === "cleanup_failed");

  return (
    <>
      <div classИмя="space-y-4">
        <div classИмя="space-y-3">
          {activeSummaries.map((summary) => (
            <ProjectРабочая областьSummaryCard
              key={summary.key}
              projectRef={projectRef}
              summary={summary}
              runtimeActionКлюч={runtimeActionКлюч}
              runtimeActionОжидание={controlРабочая областьЗапуститьtime.isОжидание}
              onЗапуститьtimeAction={(input) => controlРабочая областьЗапуститьtime.mutate(input)}
              onЗакрытьРабочая область={(input) => setClosingРабочая область(input)}
            />
          ))}
        </div>
        {cleanupОшибкаSummaries.length > 0 ? (
          <div classИмя="space-y-2">
            <div classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Cleanup attention needed
            </div>
            <div classИмя="space-y-3">
              {cleanupОшибкаSummaries.map((summary) => (
                <ProjectРабочая областьSummaryCard
                  key={summary.key}
                  projectRef={projectRef}
                  summary={summary}
                  runtimeActionКлюч={runtimeActionКлюч}
                  runtimeActionОжидание={controlРабочая областьЗапуститьtime.isОжидание}
                  onЗапуститьtimeAction={(input) => controlРабочая областьЗапуститьtime.mutate(input)}
                  onЗакрытьРабочая область={(input) => setClosingРабочая область(input)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {closingРабочая область ? (
        <ExecutionРабочая областьЗакрытьDialog
          workspaceId={closingРабочая область.id}
          workspaceИмя={closingРабочая область.name}
          currentСтатус={closingРабочая область.status}
          open
          onOpenChange={(open) => {
            if (!open) setClosingРабочая область(null);
          }}
          onЗакрытьd={() => {
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.list(companyId) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.executionРабочие области.list(companyId, { projectId }) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(projectId) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(companyId) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
            queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByProject(companyId, projectId) });
            setClosingРабочая область(null);
          }}
        />
      ) : null}
    </>
  );
}
