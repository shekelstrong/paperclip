import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Бот, Фильтр, HardDrive, Поиск, User, X } from "lucide-react";
import { ПриоритетIcon } from "./ПриоритетIcon";
import { СтатусIcon } from "./СтатусIcon";
import {
  defaultЗадачаФильтрState,
  issueФильтрArraysEqual,
  issueФильтрLabel,
  issueПриоритетOrder,
  issueQuickФильтрPresets,
  issueСтатусOrder,
  toggleЗадачаФильтрЗначение,
  type ЗадачаФильтрState,
} from "../lib/issue-filters";
import { formatИсполнительUserLabel } from "../lib/assignees";

type АгентOption = {
  id: string;
  name: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

type LabelOption = {
  id: string;
  name: string;
  color: string;
};

type Рабочая областьOption = {
  id: string;
  name: string;
};

type CreatorOption = {
  id: string;
  label: string;
  kind: "agent" | "user";
  searchText?: string;
};

export function ЗадачаФильтрsPopover({
  state,
  onChange,
  activeФильтрCount,
  agents,
  projects,
  labels,
  currentUserId,
  enableПроцедураVisibilityФильтр = false,
  buttonVariant = "ghost",
  iconOnly = false,
  workspaces,
  creators,
}: {
  state: ЗадачаФильтрState;
  onChange: (patch: Partial<ЗадачаФильтрState>) => void;
  activeФильтрCount: number;
  agents?: АгентOption[];
  projects?: ProjectOption[];
  labels?: LabelOption[];
  currentUserId?: string | null;
  enableПроцедураVisibilityФильтр?: boolean;
  buttonVariant?: "ghost" | "outline";
  iconOnly?: boolean;
  workspaces?: Рабочая областьOption[];
  creators?: CreatorOption[];
}) {
  const [creatorПоиск, setCreatorПоиск] = useState("");
  const creatorOptions = creators ?? [];
  const creatorOptionById = useMemo(
    () => new Map(creatorOptions.map((option) => [option.id, option])),
    [creatorOptions],
  );
  const normalizedCreatorПоиск = creatorПоиск.trim().toНизкийerCase();
  const visibleCreatorOptions = useMemo(() => {
    if (!normalizedCreatorПоиск) return creatorOptions;
    return creatorOptions.filter((option) =>
      `${option.label} ${option.searchText ?? ""}`.toНизкийerCase().includes(normalizedCreatorПоиск),
    );
  }, [creatorOptions, normalizedCreatorПоиск]);
  const selectedCreatorOptions = useMemo(
    () => state.creators.map((creatorId) => {
      const knownOption = creatorOptionById.get(creatorId);
      if (knownOption) return knownOption;
      if (creatorId.startsWith("agent:")) {
        const agentId = creatorId.slice("agent:".length);
        return { id: creatorId, label: agentId.slice(0, 8), kind: "agent" as const };
      }
      const userId = creatorId.startsWith("user:") ? creatorId.slice("user:".length) : creatorId;
      return {
        id: creatorId,
        label: formatИсполнительUserLabel(userId, currentUserId) ?? userId.slice(0, 5),
        kind: "user" as const,
      };
    }),
    [creatorOptionById, currentUserId, state.creators],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={buttonVariant} size={iconOnly ? "icon" : "sm"} classИмя={`text-xs ${iconOnly ? "relative h-8 w-8 shrink-0" : ""} ${activeФильтрCount > 0 ? "text-blue-600 dark:text-blue-400" : ""}`} title={iconOnly ? (activeФильтрCount > 0 ? `Фильтрs: ${activeФильтрCount}` : "Фильтр") : undefined}>
          <Фильтр classИмя={iconOnly ? "h-3.5 w-3.5" : "h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1"} />
          {!iconOnly && <span classИмя="hidden sm:inline">{activeФильтрCount > 0 ? `Фильтрs: ${activeФильтрCount}` : "Фильтр"}</span>}
          {!iconOnly && activeФильтрCount > 0 ? <span classИмя="ml-0.5 text-[10px] font-medium sm:hidden">{activeФильтрCount}</span> : null}
          {iconOnly && activeФильтрCount > 0 ? <span classИмя="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{activeФильтрCount}</span> : null}
          {!iconOnly && activeФильтрCount > 0 ? (
            <X
              classИмя="ml-1 hidden h-3 w-3 sm:block"
              onClick={(event) => {
                event.stopPropagation();
                onChange(defaultЗадачаФильтрState);
              }}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        classИмя="w-[min(780px,calc(100vw-2rem))] max-h-[min(80vh,42rem)] overflow-y-auto overscroll-contain p-0"
      >
        <div classИмя="space-y-3 p-3">
          <div classИмя="flex items-center justify-between">
            <span classИмя="text-sm font-medium">Фильтрs</span>
            {activeФильтрCount > 0 ? (
              <button
                type="button"
                classИмя="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onChange(defaultЗадачаФильтрState)}
              >
                Очистить
              </button>
            ) : null}
          </div>

          <div classИмя="space-y-1.5">
            <span classИмя="text-xs text-muted-foreground">Quick filters</span>
            <div classИмя="flex flex-wrap gap-1.5">
              {issueQuickФильтрPresets.map((preset) => {
                const isАктивен = issueФильтрArraysEqual(state.statuses, preset.statuses);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    classИмя={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      isАктивен
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                    onClick={() => onChange({ statuses: isАктивен ? [] : [...preset.statuses] })}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div classИмя="border-t border-border" />

          <div classИмя="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div classИмя="min-w-0 space-y-3">
              <div classИмя="space-y-1">
                <span classИмя="text-xs text-muted-foreground">Статус</span>
                <div classИмя="space-y-0.5">
                  {issueСтатусOrder.map((status) => (
                    <label key={status} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                      <Checkbox
                        checked={state.statuses.includes(status)}
                        onCheckedChange={() => onChange({ statuses: toggleЗадачаФильтрЗначение(state.statuses, status) })}
                      />
                      <СтатусIcon status={status} />
                      <span classИмя="text-sm">{issueФильтрLabel(status)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div classИмя="space-y-1">
                <span classИмя="text-xs text-muted-foreground">Приоритет</span>
                <div classИмя="space-y-0.5">
                  {issueПриоритетOrder.map((priority) => (
                    <label key={priority} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                      <Checkbox
                        checked={state.priorities.includes(priority)}
                        onCheckedChange={() => onChange({ priorities: toggleЗадачаФильтрЗначение(state.priorities, priority) })}
                      />
                      <ПриоритетIcon priority={priority} />
                      <span classИмя="text-sm">{issueФильтрLabel(priority)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div classИмя="min-w-0 space-y-3">
              <div classИмя="space-y-1">
                <span classИмя="text-xs text-muted-foreground">Исполнитель</span>
                <div classИмя="max-h-32 space-y-0.5 overflow-y-auto">
                  <label classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                    <Checkbox
                      checked={state.assignees.includes("__unassigned")}
                      onCheckedChange={() => onChange({ assignees: toggleЗадачаФильтрЗначение(state.assignees, "__unassigned") })}
                    />
                    <span classИмя="text-sm">Нет assignee</span>
                  </label>
                  {currentUserId ? (
                    <label classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                      <Checkbox
                        checked={state.assignees.includes("__me")}
                        onCheckedChange={() => onChange({ assignees: toggleЗадачаФильтрЗначение(state.assignees, "__me") })}
                      />
                      <User classИмя="h-3.5 w-3.5 text-muted-foreground" />
                      <span classИмя="text-sm">Me</span>
                    </label>
                  ) : null}
                  {(agents ?? []).map((agent) => (
                    <label key={agent.id} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                      <Checkbox
                        checked={state.assignees.includes(agent.id)}
                        onCheckedChange={() => onChange({ assignees: toggleЗадачаФильтрЗначение(state.assignees, agent.id) })}
                      />
                      <span classИмя="text-sm">{agent.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {creatorOptions.length > 0 ? (
                <div classИмя="space-y-1">
                  <span classИмя="text-xs text-muted-foreground">Creator</span>
                  {selectedCreatorOptions.length > 0 ? (
                    <div classИмя="flex flex-wrap gap-1">
                      {selectedCreatorOptions.map((creator) => (
                        <Badge key={creator.id} variant="secondary" classИмя="gap-1 pr-1">
                          {creator.kind === "agent" ? <Бот classИмя="h-3 w-3" /> : <User classИмя="h-3 w-3" />}
                          <span>{creator.label}</span>
                          <button
                            type="button"
                            classИмя="rounded-full p-0.5 hover:bg-accent"
                            onClick={() => onChange({ creators: state.creators.filter((value) => value !== creator.id) })}
                            aria-label={`Удалить creator ${creator.label}`}
                          >
                            <X classИмя="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div classИмя="relative">
                    <Поиск classИмя="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={creatorПоиск}
                      onChange={(event) => setCreatorПоиск(event.target.value)}
                      placeholder="Поиск creators..."
                      classИмя="h-8 pl-7 text-xs"
                    />
                  </div>
                  <div classИмя="max-h-32 space-y-0.5 overflow-y-auto">
                    {visibleCreatorOptions.length > 0 ? visibleCreatorOptions.map((creator) => {
                      const selected = state.creators.includes(creator.id);
                      return (
                        <button
                          key={creator.id}
                          type="button"
                          classИмя={`flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm ${
                            selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          }`}
                          onClick={() => onChange({ creators: toggleЗадачаФильтрЗначение(state.creators, creator.id) })}
                        >
                          {creator.kind === "agent" ? <Бот classИмя="h-3.5 w-3.5" /> : <User classИмя="h-3.5 w-3.5" />}
                          <span classИмя="min-w-0 flex-1 truncate">{creator.label}</span>
                          {selected ? <X classИмя="h-3 w-3" /> : null}
                        </button>
                      );
                    }) : (
                      <div classИмя="px-2 py-1 text-xs text-muted-foreground">Нет creators match.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {projects && projects.length > 0 ? (
                <div classИмя="space-y-1">
                  <span classИмя="text-xs text-muted-foreground">Project</span>
                  <div classИмя="max-h-32 space-y-0.5 overflow-y-auto">
                    {projects.map((project) => (
                      <label key={project.id} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                        <Checkbox
                          checked={state.projects.includes(project.id)}
                          onCheckedChange={() => onChange({ projects: toggleЗадачаФильтрЗначение(state.projects, project.id) })}
                        />
                        <span classИмя="text-sm">{project.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div classИмя="min-w-0 space-y-3">
              {labels && labels.length > 0 ? (
                <div classИмя="space-y-1">
                  <span classИмя="text-xs text-muted-foreground">Ярлыки</span>
                  <div classИмя="max-h-32 space-y-0.5 overflow-y-auto">
                    {labels.map((label) => (
                      <label key={label.id} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                        <Checkbox
                          checked={state.labels.includes(label.id)}
                          onCheckedChange={() => onChange({ labels: toggleЗадачаФильтрЗначение(state.labels, label.id) })}
                        />
                        <span classИмя="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                        <span classИмя="text-sm">{label.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {workspaces && workspaces.length > 0 ? (
                <div classИмя="space-y-1">
                  <span classИмя="text-xs text-muted-foreground">Рабочая область</span>
                  <div classИмя="max-h-32 space-y-0.5 overflow-y-auto">
                    {workspaces.map((workspace) => (
                      <label key={workspace.id} classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                        <Checkbox
                          checked={state.workspaces.includes(workspace.id)}
                          onCheckedChange={() => onChange({ workspaces: toggleЗадачаФильтрЗначение(state.workspaces, workspace.id) })}
                        />
                        <HardDrive classИмя="h-3.5 w-3.5 text-muted-foreground" />
                        <span classИмя="text-sm">{workspace.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div classИмя="space-y-1">
                <span classИмя="text-xs text-muted-foreground">Visibility</span>
                <label classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                  <Checkbox
                    checked={state.liveOnly}
                    onCheckedChange={(checked) => onChange({ liveOnly: checked === true })}
                  />
                  <span classИмя="text-sm">Live runs only</span>
                </label>
                {enableПроцедураVisibilityФильтр ? (
                  <label classИмя="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                    <Checkbox
                      checked={state.hideПроцедураExecutions}
                      onCheckedChange={(checked) => onChange({ hideПроцедураExecutions: checked === true })}
                    />
                    <span classИмя="text-sm">Hide routine runs</span>
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
