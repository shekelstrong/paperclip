import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragНачатьEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  СортировкаableContext,
  useСортировкаable,
  verticalListСортировкаingStrategy,
} from "@dnd-kit/sortable";
import { СтатусIcon } from "./СтатусIcon";
import { ПриоритетIcon } from "./ПриоритетIcon";
import { Identity } from "./Identity";
import type { Задача } from "@paperclipai/shared";
import { AlertTriangle } from "lucide-react";
import { isУспешноfulЗапуститьHandoffОбязательно } from "../lib/successful-run-handoff";

const boardСтатусes = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Агент {
  id: string;
  name: string;
}

interface KanbanСоветProps {
  issues: Задача[];
  agents?: Агент[];
  liveЗадачаIds?: Set<string>;
  onОбновитьЗадача: (id: string, data: Record<string, unknown>) => void;
}

/* ── Droppable Column ── */

function KanbanColumn({
  status,
  issues,
  agents,
  liveЗадачаIds,
}: {
  status: string;
  issues: Задача[];
  agents?: Агент[];
  liveЗадачаIds?: Set<string>;
}) {
  const { setНетdeRef, isOver } = useDroppable({ id: status });

  const isEmpty = issues.length === 0;

  return (
    <div classИмя={`flex flex-col shrink-0 transition-[width,min-width] ${isEmpty && !isOver ? "min-w-[48px] w-[48px]" : "min-w-[260px] w-[260px]"}`}>
      <div classИмя={`flex items-center gap-2 px-2 py-2 mb-1 ${isEmpty && !isOver ? "justify-center" : ""}`}>
        <СтатусIcon status={status} />
        {(!isEmpty || isOver) && (
          <>
            <span classИмя="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {statusLabel(status)}
            </span>
            <span classИмя="text-xs text-muted-foreground/60 ml-auto tabular-nums">
              {issues.length}
            </span>
          </>
        )}
      </div>
      <div
        ref={setНетdeRef}
        classИмя={`flex-1 min-h-[120px] rounded-md p-1 space-y-1 transition-colors ${
          isOver ? "bg-accent/40" : "bg-muted/20"
        }`}
      >
        <СортировкаableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListСортировкаingStrategy}
        >
          {issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              agents={agents}
              isLive={liveЗадачаIds?.has(issue.id)}
            />
          ))}
        </СортировкаableContext>
      </div>
    </div>
  );
}

/* ── Draggable Card ── */

function KanbanCard({
  issue,
  agents,
  isLive,
  isOverlay,
}: {
  issue: Задача;
  agents?: Агент[];
  isLive?: boolean;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setНетdeRef,
    transform,
    transition,
    isDragging,
  } = useСортировкаable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agentИмя = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  return (
    <div
      ref={setНетdeRef}
      style={style}
      {...attributes}
      {...listeners}
      classИмя={`rounded-md border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging && !isOverlay ? "opacity-30" : ""
      } ${isOverlay ? "shadow-lg ring-1 ring-primary/20" : "hover:shadow-sm"}`}
    >
      <Link
        to={`/issues/${issue.identifier ?? issue.id}`}
        disableЗадачаQuicklook
        classИмя="block no-underline text-inherit"
        onClick={(e) => {
          // Prevent navigation during drag
          if (isDragging) e.preventПо умолчанию();
        }}
      >
        <div classИмя="flex items-start gap-1.5 mb-1.5">
          <span classИмя="text-xs text-muted-foreground font-mono shrink-0">
            {issue.identifier ?? issue.id.slice(0, 8)}
          </span>
          {isУспешноfulЗапуститьHandoffОбязательно(issue) ? (
            <span
              classИмя="inline-flex items-center gap-1 rounded-full border border-amber-400/45 bg-amber-50/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-300/35 dark:bg-amber-400/10 dark:text-amber-300"
              title="This issue needs a next step"
              aria-label="Needs next step"
            >
              <AlertTriangle classИмя="h-3 w-3" />
              Далее step
            </span>
          ) : null}
          {isLive && (
            <span classИмя="relative flex h-2 w-2 shrink-0 mt-0.5">
              <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span classИмя="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
        </div>
        <p classИмя="text-sm leading-snug line-clamp-2 mb-2">{issue.title}</p>
        <div classИмя="flex items-center gap-2">
          <ПриоритетIcon priority={issue.priority} />
          {issue.assigneeАгентId && (() => {
            const name = agentИмя(issue.assigneeАгентId);
            return name ? (
              <Identity name={name} size="xs" />
            ) : (
              <span classИмя="text-xs text-muted-foreground font-mono">
                {issue.assigneeАгентId.slice(0, 8)}
              </span>
            );
          })()}
        </div>
      </Link>
    </div>
  );
}

/* ── Main Совет ── */

export function KanbanСовет({
  issues,
  agents,
  liveЗадачаIds,
  onОбновитьЗадача,
}: KanbanСоветProps) {
  const [activeId, setАктивенId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnЗадачи = useMemo(() => {
    const grouped: Record<string, Задача[]> = {};
    for (const status of boardСтатусes) {
      grouped[status] = [];
    }
    for (const issue of issues) {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    }
    return grouped;
  }, [issues]);

  const activeЗадача = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) : null),
    [activeId, issues]
  );

  function handleDragНачать(event: DragНачатьEvent) {
    setАктивенId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setАктивенId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    // Determine target status: the "over" could be a column id (status string)
    // or another card's id. Find which column the "over" belongs to.
    let targetСтатус: string | null = null;

    if (boardСтатусes.includes(over.id as string)) {
      targetСтатус = over.id as string;
    } else {
      // It's a card - find which column it's in
      const targetЗадача = issues.find((i) => i.id === over.id);
      if (targetЗадача) {
        targetСтатус = targetЗадача.status;
      }
    }

    if (targetСтатус && targetСтатус !== issue.status) {
      onОбновитьЗадача(issueId, { status: targetСтатус });
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    // Could be used for visual feedback; keeping simple for now
  }

  return (
    <DndContext
      sensors={sensors}
      onDragНачать={handleDragНачать}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div classИмя="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {boardСтатусes.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnЗадачи[status] ?? []}
            agents={agents}
            liveЗадачаIds={liveЗадачаIds}
          />
        ))}
      </div>
      <DragOverlay>
        {activeЗадача ? (
          <KanbanCard issue={activeЗадача} agents={agents} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
