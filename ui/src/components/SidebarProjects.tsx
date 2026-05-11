import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ПапкаOpen, Plus } from "lucide-react";
import {
  DndContext,
  MouseSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { СортировкаableContext, arrayMove, useСортировкаable, verticalListСортировкаingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { authApi } from "../api/auth";
import { projectsApi } from "../api/projects";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { queryКлючs } from "../lib/queryКлючs";
import { cn, projectRouteRef } from "../lib/utils";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { БюджетSidebarMarker } from "./БюджетSidebarMarker";
import { SidebarSection, type SidebarSectionRadioChoice } from "./SidebarSection";
import { PluginSlotMount, usePluginSlots } from "@/plugins/slots";
import {
  getProjectСортировкаModeStorageКлюч,
  PROJECT_SORT_MODE_UPDATED_EVENT,
  readProjectСортировкаMode,
  type ProjectСортировкаModeОбновленоDetail,
  type ProjectSidebarСортировкаMode,
  writeProjectСортировкаMode,
} from "../lib/project-order";
import type { Project } from "@paperclipai/shared";

type ProjectSidebarSlot = ReturnТип<typeof usePluginSlots>["slots"][number];

const PROJECT_SORT_CHOICES: SidebarSectionRadioChoice[] = [
  { value: "top", label: "Top" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "recent", label: "Recent" },
];

type ProjectItemProps = {
  activeProjectRef: string | null;
  companyId: string | null;
  companyPrefix: string | null;
  isMobile: boolean;
  project: Project;
  projectSidebarSlots: ProjectSidebarSlot[];
  setSidebarOpen: (open: boolean) => void;
  isDragging?: boolean;
};

function projectTimestamp(project: Project): number {
  const updated = new Date(project.updatedAt).getTime();
  if (Number.isFinite(updated)) return updated;
  const created = new Date(project.createdAt).getTime();
  return Number.isFinite(created) ? created : 0;
}

function sortПроекты(projects: Project[], sortMode: ProjectSidebarСортировкаMode): Project[] {
  if (sortMode === "top") return projects;
  const sorted = [...projects];
  if (sortMode === "alphabetical") {
    sorted.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    return sorted;
  }
  sorted.sort((left, right) => {
    const timeDiff = projectTimestamp(right) - projectTimestamp(left);
    return timeDiff !== 0 ? timeDiff : left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
  return sorted;
}

function ProjectItem({
  activeProjectRef,
  companyId,
  companyPrefix,
  isMobile,
  project,
  projectSidebarSlots,
  setSidebarOpen,
  isDragging = false,
}: ProjectItemProps) {
  const routeRef = projectRouteRef(project);

  return (
    <div classИмя="flex flex-col gap-0.5">
      <NavLink
        to={`/projects/${routeRef}/issues`}
        state={SIDEBAR_SCROLL_RESET_STATE}
        onClick={(e) => {
          if (isDragging) {
            e.preventПо умолчанию();
            return;
          }
          if (isMobile) setSidebarOpen(false);
        }}
        classИмя={cn(
          "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
          activeProjectRef === routeRef || activeProjectRef === project.id
            ? "bg-accent text-foreground"
            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <span
          classИмя="shrink-0 h-3.5 w-3.5 rounded-sm"
          style={{ backgroundColor: project.color ?? "#6366f1" }}
        />
        <span classИмя="flex-1 truncate">{project.name}</span>
        {project.pauseReason === "budget" ? <БюджетSidebarMarker title="Project paused by budget" /> : null}
      </NavLink>
      {projectSidebarSlots.length > 0 && (
        <div classИмя="ml-5 flex flex-col gap-0.5">
          {projectSidebarSlots.map((slot) => (
            <PluginSlotMount
              key={`${project.id}:${slot.pluginКлюч}:${slot.id}`}
              slot={slot}
              context={{
                companyId,
                companyPrefix,
                projectId: project.id,
                projectRef: routeRef,
                entityId: project.id,
                entityТип: "project",
              }}
              missingBehavior="placeholder"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function СортировкаableProjectItem(props: ProjectItemProps) {
  const {
    attributes,
    listeners,
    setНетdeRef,
    transform,
    transition,
    isDragging,
  } = useСортировкаable({ id: props.project.id });

  return (
    <div
      ref={setНетdeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      classИмя={cn(isDragging && "opacity-80")}
      {...attributes}
      {...listeners}
    >
      <ProjectItem {...props} isDragging={isDragging} />
    </div>
  );
}

export function SidebarПроекты() {
  const [open, setOpen] = useState(true);
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { openNewProject } = useDialogActions();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const { slots: projectSidebarSlots } = usePluginSlots({
    slotТипs: ["projectSidebarItem"],
    entityТип: "project",
    companyId: selectedКомпанияId,
    enabled: !!selectedКомпанияId,
  });

  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const sortModeStorageКлюч = useMemo(() => {
    if (!selectedКомпанияId) return null;
    return getProjectСортировкаModeStorageКлюч(selectedКомпанияId, currentUserId);
  }, [currentUserId, selectedКомпанияId]);
  const [sortMode, setСортировкаMode] = useState<ProjectSidebarСортировкаMode>(() => {
    if (!sortModeStorageКлюч) return "top";
    return readProjectСортировкаMode(sortModeStorageКлюч);
  });

  const visibleПроекты = useMemo(
    () => (projects ?? []).filter((project: Project) => !project.archivedAt),
    [projects],
  );
  const { orderedПроекты, persistOrder } = useProjectOrder({
    projects: visibleПроекты,
    companyId: selectedКомпанияId,
    userId: currentUserId,
  });
  const sortedПроекты = useMemo(
    () => sortПроекты(orderedПроекты, sortMode),
    [orderedПроекты, sortMode],
  );
  const isTopMode = sortMode === "top";

  const projectMatch = location.pathname.match(/^\/(?:[^/]+\/)?projects\/([^/]+)/);
  const activeProjectRef = projectMatch?.[1] ?? null;
  const sensors = useSensors(
    // Project reordering is intentionally desktop-only; touch should remain tap/scroll behavior.
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    if (!sortModeStorageКлюч) {
      setСортировкаMode("top");
      return;
    }
    setСортировкаMode(readProjectСортировкаMode(sortModeStorageКлюч));
  }, [sortModeStorageКлюч]);

  useEffect(() => {
    if (!sortModeStorageКлюч) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sortModeStorageКлюч) return;
      setСортировкаMode(readProjectСортировкаMode(sortModeStorageКлюч));
    };
    const onСвойEvent = (event: Event) => {
      const detail = (event as СвойEvent<ProjectСортировкаModeОбновленоDetail>).detail;
      if (!detail || detail.storageКлюч !== sortModeStorageКлюч) return;
      setСортировкаMode(detail.sortMode);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(PROJECT_SORT_MODE_UPDATED_EVENT, onСвойEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROJECT_SORT_MODE_UPDATED_EVENT, onСвойEvent);
    };
  }, [sortModeStorageКлюч]);

  const persistСортировкаMode = useCallback(
    (value: string) => {
      const nextСортировкаMode: ProjectSidebarСортировкаMode =
        value === "alphabetical" || value === "recent" ? value : "top";
      setСортировкаMode(nextСортировкаMode);
      if (sortModeStorageКлюч) {
        writeProjectСортировкаMode(sortModeStorageКлюч, nextСортировкаMode);
      }
    },
    [sortModeStorageКлюч],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isTopMode) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = orderedПроекты.map((project) => project.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      persistOrder(arrayMove(ids, oldIndex, newIndex));
    },
    [isTopMode, orderedПроекты, persistOrder],
  );

  const renderProject = (project: Project) => (
    <ProjectItem
      key={project.id}
      activeProjectRef={activeProjectRef}
      companyId={selectedКомпанияId}
      companyPrefix={selectedКомпания?.issuePrefix ?? null}
      isMobile={isMobile}
      project={project}
      projectSidebarSlots={projectSidebarSlots}
      setSidebarOpen={setSidebarOpen}
    />
  );

  return (
    <SidebarSection
      label="Проекты"
      collapsible={{ open, onOpenChange: setOpen }}
      headerAction={{
        ariaLabel: "Новый проект",
        icon: Plus,
        onClick: openNewProject,
      }}
      menu={{
        ariaLabel: "Проекты section actions",
        actions: [
          { type: "item", label: "Browse projects", icon: ПапкаOpen, href: "/projects" },
          { type: "separator" },
        ],
        radioLabel: "Project sort",
        radioChoices: PROJECT_SORT_CHOICES,
        radioЗначение: sortMode,
        onRadioЗначениеChange: persistСортировкаMode,
      }}
    >
      {isTopMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <СортировкаableContext
            items={orderedПроекты.map((project) => project.id)}
            strategy={verticalListСортировкаingStrategy}
          >
            <div classИмя="flex flex-col gap-0.5">
              {orderedПроекты.map((project: Project) => (
                <СортировкаableProjectItem
                  key={project.id}
                  activeProjectRef={activeProjectRef}
                  companyId={selectedКомпанияId}
                  companyPrefix={selectedКомпания?.issuePrefix ?? null}
                  isMobile={isMobile}
                  project={project}
                  projectSidebarSlots={projectSidebarSlots}
                  setSidebarOpen={setSidebarOpen}
                />
              ))}
            </div>
          </СортировкаableContext>
        </DndContext>
      ) : (
        <div classИмя="flex flex-col gap-0.5">
          {sortedПроекты.map((project: Project) => renderProject(project))}
        </div>
      )}
    </SidebarSection>
  );
}
