import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { assetsApi } from "../api/assets";
import { usePanel } from "../context/PanelContext";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { ЦельProperties } from "../components/ЦельProperties";
import { ЦельTree } from "../components/ЦельTree";
import { СтатусBadge } from "../components/СтатусBadge";
import { InlineИзменитьor } from "../components/InlineИзменитьor";
import { EntityRow } from "../components/EntityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, SlidersHorizontal } from "lucide-react";
import type { Цель, Project } from "@paperclipai/shared";

interface ЦельPropertiesToggleButtonProps {
  panelVisible: boolean;
  onShowProperties: () => void;
}

export function ЦельPropertiesToggleButton({
  panelVisible,
  onShowProperties,
}: ЦельPropertiesToggleButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      classИмя={cn(
        "hidden md:inline-flex shrink-0 transition-opacity duration-200",
        panelVisible ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100",
      )}
      onClick={onShowProperties}
      title="Показать свойства"
    >
      <SlidersHorizontal classИмя="h-4 w-4" />
    </Button>
  );
}

export function ЦельDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const { selectedКомпанияId, setSelectedКомпанияId } = useКомпания();
  const { openNewЦель } = useDialogActions();
  const { openPanel, closePanel, panelVisible, setPanelVisible } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const {
    data: goal,
    isЗагрузка,
    error
  } = useQuery({
    queryКлюч: queryКлючs.goals.detail(goalId!),
    queryFn: () => goalsApi.get(goalId!),
    enabled: !!goalId
  });
  const resolvedКомпанияId = goal?.companyId ?? selectedКомпанияId;

  const { data: allЦели } = useQuery({
    queryКлюч: queryКлючs.goals.list(resolvedКомпанияId!),
    queryFn: () => goalsApi.list(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId
  });

  const { data: allПроекты } = useQuery({
    queryКлюч: queryКлючs.projects.list(resolvedКомпанияId!),
    queryFn: () => projectsApi.list(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId
  });

  useEffect(() => {
    if (!goal?.companyId || goal.companyId === selectedКомпанияId) return;
    setSelectedКомпанияId(goal.companyId, { source: "route_sync" });
  }, [goal?.companyId, selectedКомпанияId, setSelectedКомпанияId]);

  const updateЦель = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      goalsApi.update(goalId!, data),
    onУспешно: () => {
      queryClient.invalidateQueries({
        queryКлюч: queryКлючs.goals.detail(goalId!)
      });
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.goals.list(resolvedКомпанияId)
        });
      }
    }
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedКомпанияId) throw new Ошибка("Нет company selected");
      return assetsApi.uploadImage(
        resolvedКомпанияId,
        file,
        `goals/${goalId ?? "draft"}`
      );
    }
  });

  const childЦели = (allЦели ?? []).filter((g) => g.parentId === goalId);
  const linkedПроекты = (allПроекты ?? []).filter((p) => {
    if (!goalId) return false;
    if (p.goalIds.includes(goalId)) return true;
    if (p.goals.some((goalRef) => goalRef.id === goalId)) return true;
    return p.goalId === goalId;
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Цели", href: "/goals" },
      { label: goal?.title ?? goalId ?? "Цель" }
    ]);
  }, [setBreadcrumbs, goal, goalId]);

  useEffect(() => {
    if (goal) {
      openPanel(
        <ЦельProperties
          goal={goal}
          onОбновить={(data) => updateЦель.mutate(data)}
        />
      );
    }
    return () => closePanel();
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isЗагрузка) return <PageSkeleton variant="detail" />;
  if (error) return <p classИмя="text-sm text-destructive">{error.message}</p>;
  if (!goal) return null;

  return (
    <div classИмя="space-y-6">
      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <span classИмя="text-xs uppercase text-muted-foreground">
            {goal.level}
          </span>
          <СтатусBadge status={goal.status} />
          <div classИмя="ml-auto">
            <ЦельPropertiesToggleButton
              panelVisible={panelVisible}
              onShowProperties={() => setPanelVisible(true)}
            />
          </div>
        </div>

        <InlineИзменитьor
          value={goal.title}
          onСохранить={(title) => updateЦель.mutate({ title })}
          as="h2"
          classИмя="text-xl font-bold"
        />

        <InlineИзменитьor
          value={goal.description ?? ""}
          onСохранить={(description) => updateЦель.mutate({ description })}
          as="p"
          classИмя="text-sm text-muted-foreground"
          placeholder="Добавить a description..."
          multiline
          imageЗагрузитьHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentПуть;
          }}
        />
      </div>

      <Tabs defaultЗначение="children">
        <TabsList>
          <TabsTrigger value="children">
            Sub-Цели ({childЦели.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Проекты ({linkedПроекты.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children" classИмя="mt-4 space-y-3">
          <div classИмя="flex items-center justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openNewЦель({ parentId: goalId })}
            >
              <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
              Sub Цель
            </Button>
          </div>
          {childЦели.length === 0 ? (
            <p classИмя="text-sm text-muted-foreground">Нет sub-goals.</p>
          ) : (
            <ЦельTree goals={childЦели} goalLink={(g) => `/goals/${g.id}`} />
          )}
        </TabsContent>

        <TabsContent value="projects" classИмя="mt-4">
          {linkedПроекты.length === 0 ? (
            <p classИмя="text-sm text-muted-foreground">Нет linked projects.</p>
          ) : (
            <div classИмя="border border-border">
              {linkedПроекты.map((project) => (
                <EntityRow
                  key={project.id}
                  title={project.name}
                  subtitle={project.description ?? undefined}
                  to={projectUrl(project)}
                  trailing={<СтатусBadge status={project.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
