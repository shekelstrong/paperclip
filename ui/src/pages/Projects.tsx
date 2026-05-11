import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { EntityRow } from "../components/EntityRow";
import { СтатусBadge } from "../components/СтатусBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Hexagon, Plus } from "lucide-react";

export function Проекты() {
  const { selectedКомпанияId } = useКомпания();
  const { openNewProject } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Проекты" }]);
  }, [setBreadcrumbs]);

  const { data: allПроекты, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const projects = useMemo(
    () => (allПроекты ?? []).filter((p) => !p.archivedAt),
    [allПроекты],
  );

  if (!selectedКомпанияId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus classИмя="h-4 w-4 mr-1" />
          Добавить проект
        </Button>
      </div>

      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {!isЗагрузка && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="Пока нет проектов."
          action="Добавить проект"
          onAction={openNewProject}
        />
      )}

      {projects.length > 0 && (
        <div classИмя="border border-border">
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div classИмя="flex items-center gap-3">
                  {project.targetDate && (
                    <span classИмя="text-xs text-muted-foreground">
                      {formatDate(project.targetDate)}
                    </span>
                  )}
                  <СтатусBadge status={project.status} />
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
