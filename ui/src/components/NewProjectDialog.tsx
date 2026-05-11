import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { accessApi } from "../api/access";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { assetsApi } from "../api/assets";
import { buildMarkdownMentionOptions } from "../lib/company-members";
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
  Calendar,
  Plus,
  X,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROJECT_COLORS } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "./MarkdownИзменитьor";
import { СтатусBadge } from "./СтатусBadge";
import { ChooseПутьButton } from "./ПутьInstructionsModal";

const projectСтатусes = [
  { value: "backlog", label: "Назадlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
];

export function NewProjectDialog() {
  const { newProjectOpen, closeNewProject } = useDialog();
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const queryClient = useQueryClient();
  const [name, setИмя] = useState("");
  const [description, setОписание] = useState("");
  const [status, setСтатус] = useState("planned");
  const [goalIds, setЦельIds] = useState<string[]>([]);
  const [targetDate, setЦельDate] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [workspaceLocalПуть, setРабочая областьLocalПуть] = useState("");
  const [workspaceРепозиторийUrl, setРабочая областьРепозиторийUrl] = useState("");
  const [workspaceОшибка, setРабочая областьОшибка] = useState<string | null>(null);

  const [statusOpen, setСтатусOpen] = useState(false);
  const [goalOpen, setЦельOpen] = useState(false);
  const descriptionИзменитьorRef = useRef<MarkdownИзменитьorRef>(null);

  const { data: goals } = useQuery({
    queryКлюч: queryКлючs.goals.list(selectedКомпанияId!),
    queryFn: () => goalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && newProjectOpen,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && newProjectOpen,
  });

  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && newProjectOpen,
  });

  const mentionOptions = useMemo<MentionOption[]>(() => {
    return buildMarkdownMentionOptions({
      agents,
      members: companyMembers?.users,
    });
  }, [agents, companyMembers?.users]);

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      projectsApi.create(selectedКомпанияId!, data),
  });

  const uploadОписаниеImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedКомпанияId) throw new Ошибка("Нет company selected");
      return assetsApi.uploadImage(selectedКомпанияId, file, "projects/drafts");
    },
  });

  function reset() {
    setИмя("");
    setОписание("");
    setСтатус("planned");
    setЦельIds([]);
    setЦельDate("");
    setExpanded(false);
    setРабочая областьLocalПуть("");
    setРабочая областьРепозиторийUrl("");
    setРабочая областьОшибка(null);
  }

  const isAbsoluteПуть = (value: string) => value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);

  const looksLikeРепозиторийUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };

  const deriveРабочая областьИмяFromПуть = (value: string) => {
    const normalized = value.trim().replace(/[\\/]+$/, "");
    const segments = normalized.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? "Локальная папка";
  };

  const deriveРабочая областьИмяFromРепозиторий = (value: string) => {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
      return repo || "Репозиторий GitHub";
    } catch {
      return "Репозиторий GitHub";
    }
  };

  async function handleОтправить() {
    if (!selectedКомпанияId || !name.trim()) return;
    const localПуть = workspaceLocalПуть.trim();
    const repoUrl = workspaceРепозиторийUrl.trim();

    if (localПуть && !isAbsoluteПуть(localПуть)) {
      setРабочая областьОшибка("Локальная папка must be a full absolute path.");
      return;
    }
    if (repoUrl && !looksLikeРепозиторийUrl(repoUrl)) {
      setРабочая областьОшибка("Репозиторий must use a valid GitHub or GitHub Enterprise repo URL.");
      return;
    }

    setРабочая областьОшибка(null);

    try {
      const created = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
        ...(goalIds.length > 0 ? { goalIds } : {}),
        ...(targetDate ? { targetDate } : {}),
      });

      if (localПуть || repoUrl) {
        const workspacePayload: Record<string, unknown> = {
          name: localПуть
            ? deriveРабочая областьИмяFromПуть(localПуть)
            : deriveРабочая областьИмяFromРепозиторий(repoUrl),
          ...(localПуть ? { cwd: localПуть } : {}),
          ...(repoUrl ? { repoUrl } : {}),
        };
        await projectsApi.createРабочая область(created.id, workspacePayload);
      }

      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(selectedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(created.id) });
      reset();
      closeNewProject();
    } catch {
      // surface through createProject.isОшибка
    }
  }

  function handleКлючDown(e: React.КлючboardEvent) {
    if (e.key === "Enter" && (e.metaКлюч || e.ctrlКлюч)) {
      e.preventПо умолчанию();
      handleОтправить();
    }
  }

  const selectedЦели = (goals ?? []).filter((g) => goalIds.includes(g.id));
  const availableЦели = (goals ?? []).filter((g) => !goalIds.includes(g.id));

  return (
    <Dialog
      open={newProjectOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          closeNewProject();
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
            <span>Новый проект</span>
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
              onClick={() => { reset(); closeNewProject(); }}
            >
              <span classИмя="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        {/* Имя */}
        <div classИмя="px-4 pt-4 pb-2 shrink-0">
          <input
            classИмя="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Project name"
            value={name}
            onChange={(e) => setИмя(e.target.value)}
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
        <div classИмя="px-4 pb-2">
          <MarkdownИзменитьor
            ref={descriptionИзменитьorRef}
            value={description}
            onChange={setОписание}
            placeholder="Добавить description..."
            bordered={false}
            mentions={mentionOptions}
            contentClassИмя={cn("text-sm text-muted-foreground", expanded ? "min-h-[220px]" : "min-h-[120px]")}
            imageЗагрузитьHandler={async (file) => {
              const asset = await uploadОписаниеImage.mutateAsync(file);
              return asset.contentПуть;
            }}
          />
        </div>

        <div classИмя="px-4 pt-3 pb-3 space-y-3 border-t border-border">
          <div>
            <div classИмя="mb-1 flex items-center gap-1.5">
              <label classИмя="block text-xs text-muted-foreground">URL репозитория</label>
              <span classИмя="text-xs text-muted-foreground/50">optional</span>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <HelpCircle classИмя="h-3 w-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" classИмя="max-w-[240px] text-xs">
                  Link a Репозиторий GitHubsitory so agents can clone, read, and push code for this project.
                </TooltipContent>
              </Tooltip>
            </div>
            <input
              classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
              value={workspaceРепозиторийUrl}
              onChange={(e) => { setРабочая областьРепозиторийUrl(e.target.value); setРабочая областьОшибка(null); }}
              placeholder="https://github.com/org/repo"
            />
          </div>

          <div>
            <div classИмя="mb-1 flex items-center gap-1.5">
              <label classИмя="block text-xs text-muted-foreground">Локальная папка</label>
              <span classИмя="text-xs text-muted-foreground/50">optional</span>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <HelpCircle classИмя="h-3 w-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" classИмя="max-w-[240px] text-xs">
                  Set an absolute path on this machine where local agents will read and write files for this project.
                </TooltipContent>
              </Tooltip>
            </div>
            <div classИмя="flex items-center gap-2">
              <input
                classИмя="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                value={workspaceLocalПуть}
                onChange={(e) => { setРабочая областьLocalПуть(e.target.value); setРабочая областьОшибка(null); }}
                placeholder="/absolute/path/to/workspace"
              />
              <ChooseПутьButton />
            </div>
          </div>

          {workspaceОшибка && (
            <p classИмя="text-xs text-destructive">{workspaceОшибка}</p>
          )}
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
              {projectСтатусes.map((s) => (
                <button
                  key={s.value}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    s.value === status && "bg-accent"
                  )}
                  onClick={() => { setСтатус(s.value); setСтатусOpen(false); }}
                >
                  {s.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {selectedЦели.map((goal) => (
            <span
              key={goal.id}
              classИмя="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
            >
              <Цель classИмя="h-3 w-3 text-muted-foreground" />
              <span classИмя="max-w-[160px] truncate">{goal.title}</span>
              <button
                classИмя="text-muted-foreground hover:text-foreground"
                onClick={() => setЦельIds((prev) => prev.filter((id) => id !== goal.id))}
                aria-label={`Удалить goal ${goal.title}`}
                type="button"
              >
                <X classИмя="h-3 w-3" />
              </button>
            </span>
          ))}

          <Popover open={goalOpen} onOpenChange={setЦельOpen}>
            <PopoverTrigger asChild>
              <button
                classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors disabled:opacity-60"
                disabled={selectedЦели.length > 0 && availableЦели.length === 0}
              >
                {selectedЦели.length > 0 ? <Plus classИмя="h-3 w-3 text-muted-foreground" /> : <Цель classИмя="h-3 w-3 text-muted-foreground" />}
                {selectedЦели.length > 0 ? "+ Цель" : "Цель"}
              </button>
            </PopoverTrigger>
            <PopoverContent classИмя="w-56 p-1" align="start">
              {selectedЦели.length === 0 && (
                <button
                  classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground"
                  onClick={() => setЦельOpen(false)}
                >
                  Нет goal
                </button>
              )}
              {availableЦели.map((g) => (
                <button
                  key={g.id}
                  classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate"
                  onClick={() => {
                    setЦельIds((prev) => [...prev, g.id]);
                    setЦельOpen(false);
                  }}
                >
                  {g.title}
                </button>
              ))}
              {selectedЦели.length > 0 && availableЦели.length === 0 && (
                <div classИмя="px-2 py-1.5 text-xs text-muted-foreground">
                  Все goals already selected.
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Дата цели */}
          <div classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
            <Calendar classИмя="h-3 w-3 text-muted-foreground" />
            <input
              type="date"
              classИмя="bg-transparent outline-none text-xs w-24"
              value={targetDate}
              onChange={(e) => setЦельDate(e.target.value)}
              placeholder="Дата цели"
            />
          </div>
        </div>

        {/* Footer */}
        <div classИмя="flex items-center justify-between px-4 py-2.5 border-t border-border">
          {createProject.isОшибка ? (
            <p classИмя="text-xs text-destructive">Ошибка to create project.</p>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            disabled={!name.trim() || createProject.isОжидание}
            onClick={handleОтправить}
          >
            {createProject.isОжидание ? "Creating…" : "Создать project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
