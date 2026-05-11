import { useEffect, useMemo } from "react";
import { Link, Navigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { ExecutionРабочая область, Задача, Project } from "@paperclipai/shared";
import { executionРабочие областиApi } from "../api/execution-workspaces";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { ProjectРабочие областиContent } from "../components/ProjectРабочие областиContent";
import { PageSkeleton } from "../components/PageSkeleton";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { buildProjectРабочая областьSummaries, type ProjectРабочая областьSummary } from "../lib/project-workspaces-tab";
import { queryКлючs } from "../lib/queryКлючs";
import { projectRouteRef } from "../lib/utils";

type ProjectРабочая областьGroup = {
  project: Project;
  projectRef: string;
  summaries: ProjectРабочая областьSummary[];
  lastОбновленоAt: Date;
  runningServiceCount: number;
};

function buildProjectРабочая областьGroups(input: {
  projects: Project[];
  issues: Задача[];
  executionРабочие области: ExecutionРабочая область[];
}): ProjectРабочая областьGroup[] {
  const issuesByProjectId = new Map<string, Задача[]>();
  for (const issue of input.issues) {
    if (!issue.projectId) continue;
    const existing = issuesByProjectId.get(issue.projectId) ?? [];
    existing.push(issue);
    issuesByProjectId.set(issue.projectId, existing);
  }

  const executionРабочие областиByProjectId = new Map<string, ExecutionРабочая область[]>();
  for (const workspace of input.executionРабочие области) {
    if (!workspace.projectId) continue;
    const existing = executionРабочие областиByProjectId.get(workspace.projectId) ?? [];
    existing.push(workspace);
    executionРабочие областиByProjectId.set(workspace.projectId, existing);
  }

  return input.projects
    .map((project) => {
      const summaries = buildProjectРабочая областьSummaries({
        project,
        issues: issuesByProjectId.get(project.id) ?? [],
        executionРабочие области: executionРабочие областиByProjectId.get(project.id) ?? [],
      });
      if (summaries.length === 0) return null;
      return {
        project,
        projectRef: projectRouteRef(project),
        summaries,
        lastОбновленоAt: summaries.reduce(
          (latest, summary) => summary.lastОбновленоAt.getTime() > latest.getTime() ? summary.lastОбновленоAt : latest,
          new Date(0),
        ),
        runningServiceCount: summaries.reduce((count, summary) => count + summary.runningServiceCount, 0),
      };
    })
    .filter((group): group is ProjectРабочая областьGroup => group !== null)
    .sort((a, b) => {
      const runningDiff = b.runningServiceCount - a.runningServiceCount;
      if (runningDiff !== 0) return runningDiff;
      const updatedDiff = b.lastОбновленоAt.getTime() - a.lastОбновленоAt.getTime();
      return updatedDiff !== 0 ? updatedDiff : a.project.name.localeCompare(b.project.name);
    });
}

export function Рабочие области() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const experimentalНастройкиQuery = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
  });
  const isolatedРабочие областиВключитьd = experimentalНастройкиQuery.data?.enableIsolatedРабочие области === true;

  const { data: projects = [], isЗагрузка: projectsЗагрузка, error: projectsОшибка } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.projects.list(selectedКомпанияId) : ["projects", "__workspaces__", "disabled"],
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId && isolatedРабочие областиВключитьd),
  });
  const { data: issues = [], isЗагрузка: issuesЗагрузка, error: issuesОшибка } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.issues.list(selectedКомпанияId) : ["issues", "__workspaces__", "disabled"],
    queryFn: () => issuesApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId && isolatedРабочие областиВключитьd),
  });
  const {
    data: executionРабочие области = [],
    isЗагрузка: executionРабочие областиЗагрузка,
    error: executionРабочие областиОшибка,
  } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.executionРабочие области.list(selectedКомпанияId)
      : ["execution-workspaces", "__workspaces__", "disabled"],
    queryFn: () => executionРабочие областиApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId && isolatedРабочие областиВключитьd),
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Рабочие области" }]);
  }, [setBreadcrumbs]);

  const groups = useMemo(
    () => buildProjectРабочая областьGroups({ projects, issues, executionРабочие области }),
    [executionРабочие области, issues, projects],
  );
  const dataЗагрузка = projectsЗагрузка || issuesЗагрузка || executionРабочие областиЗагрузка;
  const error = (projectsОшибка ?? issuesОшибка ?? executionРабочие областиОшибка) as Ошибка | null;

  if (experimentalНастройкиQuery.isЗагрузка) return <PageSkeleton variant="detail" />;
  if (!isolatedРабочие областиВключитьd) return <Navigate to="/issues" replace />;
  if (dataЗагрузка) return <PageSkeleton variant="list" />;
  if (error) return <p classИмя="text-sm text-destructive">{error.message}</p>;

  return (
    <div classИмя="space-y-6">
      <div>
        <h2 classИмя="text-xl font-bold">Рабочие области</h2>
      </div>

      {groups.length === 0 ? (
        <p classИмя="text-sm text-muted-foreground">Нет workspace activity yet.</p>
      ) : (
        <div classИмя="space-y-8">
          {groups.map((group) => (
            <section key={group.project.id} classИмя="space-y-3">
              <div classИмя="flex flex-wrap items-end justify-between gap-2">
                <div classИмя="min-w-0">
                  <Link
                    to={`/projects/${group.projectRef}/workspaces`}
                    classИмя="text-base font-semibold hover:underline"
                  >
                    {group.project.name}
                  </Link>
                  {group.project.description ? (
                    <p classИмя="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {group.project.description}
                    </p>
                  ) : null}
                </div>
                <span classИмя="text-xs text-muted-foreground">
                  {group.summaries.length} workspace{group.summaries.length === 1 ? "" : "s"}
                </span>
              </div>
              <ProjectРабочие областиContent
                companyId={selectedКомпанияId!}
                projectId={group.project.id}
                projectRef={group.projectRef}
                summaries={group.summaries}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
