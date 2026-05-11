import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GOAL_STATUSES, GOAL_LEVELS } from "@paperclipai/shared";
import { useDialog } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { goalsApi } from "../api/goals";
import { assetsApi } from "../api/assets";
import { queryКлючs } from "../lib/queryКлючs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Maximize2,
  Minimize2,
  Цель,
  Layers,
} from "lucide-react";
import { cn } from "../lib/utils";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef } from "./MarkdownИзменитьor";
import { СтатусBadge } from "./СтатусBadge";

const levelЯрлыки: Record<string, string> = {
  company: "Компания",
  team: "Team",
  agent: "Агент",
  task: "Задача",
};

export function NewЦельDialog() {
  const { newЦельOpen, newЦельПо умолчаниюs, closeNewЦель } = useDialog();
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const queryClient = useQueryClient();
  const [title, setНазвание] = useState("");
  const [description, setОписание] = useState("");
  const [status, setСтатус] = useState("planned");
  const [level, setLevel] = useState("task");
  const [parentId, setРодительId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [statusOpen, setСтатусOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [parentOpen, setРодительOpen] = useState(false);
  const descriptionИзменитьorRef = useRef<MarkdownИзменитьorRef>(null);

  // Apply defaults when dialog opens
  const appliedРодительId = parentId || newЦельПо умолчаниюs.parentId || "";

  const { data: goals } = useQuery({
    queryКлюч: queryКлючs.goals.list(selectedКомпанияId!),
    queryFn: () => goalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && newЦельOpen,
  });

  const createЦель = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      goalsApi.create(selectedКомпанияId!, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.goals.list(selectedКомпанияId!) });
      reset();
      closeNewЦель();
    },
  });

  const uploadОписаниеImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedКомпанияId) throw new Ошибка("Нет company selected");
      return assetsApi.uploadImage(selectedКомпанияId, file, "goals/drafts");
    },
  });

  function reset() {
    setНазвание("");
    setОписание("");
    setСтатус("planned");
    setLevel("task");
    setРодительId("");
    setExpanded(false);
  }

  function handleОтправить() {
    if (!selectedКомпанияId || !title.trim()) return;
    createЦель.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      level,
      ...(appliedРодительId ? { parentId: appliedРодительId } : {}),
    });
  }

  function handleКлючDown(e: React.КлючboardEvent) {
    if (e.key === "Enter" && (e.metaКлюч || e.ctrlКлюч)) {
      e.preventПо умолчанию();
      handleОтправить();
    }
  }

  const currentРодитель = (goals ?? []).find((g) => g.id === appliedРодительId);

  return (
    <Dialog
      open={newЦельOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          closeNewЦель();
        }
      }}
    >
      <DialogContent
        showЗакрытьButton={false}
        classИмя={cn("p-0 gap-0", expanded ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onКлючDown={handleКлючDown}
      >
        {/* Header */}
        <div classИмя="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div classИмя="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedКомпания && (
              <span classИмя="bg-muted px-1.5 py-0.5 rounded text-xs font-medium">
                {selectedКомпания.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span classИмя="text-muted-foreground/60">&rsaquo;</span>
            <span>{newЦельПо умолчаниюs.parentId ? "New sub-goal" : "Новая цель"}</span>
          </div>
          <div classИмя="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              classИмя="text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <Minimize2 classИмя="h-3.5 w-3.5" /> : <Maximize2 classИмя="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              classИмя="text-muted-foreground"
              onClick={() => { reset(); closeNewЦель(); }}
            >
              <span classИмя="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        {/* Название */}
        <div classИмя="px-4 pt-4 pb-2 shrink-0">
          <input
            classИмя="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Цель title"
            value={title}
            onChange={(e) => setНазвание(e.target.value)}
            onКлючDown={(e) => {
              if (e.key === "Tab" && !e.shiftКлюч) {
                e.preventПо умолчанию();
                descriptionИзменитьorRef.current?.focus();
              }
            }}
            autoFocus
          />
        </div>

        {/* Описание */}
        <div classИмя="px-4 pb-2 overflow-y-auto max-h-[50vh]">
          <MarkdownИзменитьor
            ref={descriptionИзменитьorRef}
            value={description}
            onChange={setОписание}
            placeholder="Добавить description..."
            bordered={false}
            contentClassИмя={cn("text-sm text-muted-foreground", expanded ? "min-h-[220px]" : "min-h-[120px]")}
            imageЗагрузитьHandler={async (file) => {
              const asset = await uploadОписаниеImage.mutateAsync(file);
              return asset.contentПуть;
            }}
          />
        </div>

        {/* Property chips */}
        <div classИмя="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
          {/* Статус */}
          <Popover open={statusOpen} onOpenChange={setСтатусOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <СтатусBadge status={status} />
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-40 p-1" align="start">
              {GOAL_STATUSES.map((s) => (
                <button
                  key={s}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 capitalize",
                    s === status && "bg-accent"
                  )}
                  onClick={() => { setСтатус(s); setСтатусOpen(false); }}
                >
                  {s}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Level */}
          <Popover open={levelOpen} onOpenChange={setLevelOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <Layers classИмя="h-3 w-3 text-muted-foreground" />
                {levelЯрлыки[level] ?? level}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-40 p-1" align="start">
              {GOAL_LEVELS.map((l) => (
                <button
                  key={l}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    l === level && "bg-accent"
                  )}
                  onClick={() => { setLevel(l); setLevelOpen(false); }}
                >
                  {levelЯрлыки[l] ?? l}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Родитель goal */}
          <Popover open={parentOpen} onOpenChange={setРодительOpen}>
            <PopoverTrigger asChild>
              <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <Цель classИмя="h-3 w-3 text-muted-foreground" />
                {currentРодитель ? currentРодитель.title : "Родитель goal"}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-48 p-1" align="start">
              <button
                classИмя={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  !appliedРодительId && "bg-accent"
                )}
                onClick={() => { setРодительId(""); setРодительOpen(false); }}
              >
                Нет parent
              </button>
              {(goals ?? []).map((g) => (
                <button
                  key={g.id}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
                    g.id === appliedРодительId && "bg-accent"
                  )}
                  onClick={() => { setРодительId(g.id); setРодительOpen(false); }}
                >
                  {g.title}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* Footer */}
        <div classИмя="flex items-center justify-end px-4 py-2.5 border-t border-border">
          <Button
            size="sm"
            disabled={!title.trim() || createЦель.isОжидание}
            onClick={handleОтправить}
          >
            {createЦель.isОжидание ? "Creating…" : newЦельПо умолчаниюs.parentId ? "Создать sub-goal" : "Создать цель"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
