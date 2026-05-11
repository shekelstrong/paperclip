import { useMemo, useState } from "react";
import type { Агент, Задача } from "@paperclipai/shared";
import { useQuery } from "@tanstack/react-query";
import { accessApi } from "../api/access";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { buildКомпанияUserInlineOptions, buildКомпанияUserLabelMap } from "../lib/company-members";
import { queryКлючs } from "../lib/queryКлючs";
import { sortАгентыByRecency, getRecentИсполнительIds } from "../lib/recent-assignees";
import {
  buildExecutionPolicy,
  stageParticipantЗначениеs,
} from "../lib/issue-execution-policy";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, Eye, ShieldCheck } from "lucide-react";
import { АгентIcon } from "./АгентIconPicker";

type StageТип = "review" | "approval";

interface ExecutionParticipantPickerProps {
  issue: Задача;
  stageТип: StageТип;
  agents: Агент[];
  currentUserId: string | null;
  onОбновить: (data: Record<string, unknown>) => void;
}

export function ExecutionParticipantPicker({
  issue,
  stageТип,
  agents,
  currentUserId,
  onОбновить,
}: ExecutionParticipantPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setПоиск] = useState("");

  const reviewerЗначениеs = stageParticipantЗначениеs(issue.executionPolicy, "review");
  const approverЗначениеs = stageParticipantЗначениеs(issue.executionPolicy, "approval");
  const values = stageТип === "review" ? reviewerЗначениеs : approverЗначениеs;
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(issue.companyId),
    queryFn: () => accessApi.listUserDirectory(issue.companyId),
    enabled: !!issue.companyId,
  });

  const sortedАгенты = sortАгентыByRecency(
    agents.filter((a) => a.status !== "terminated"),
    getRecentИсполнительIds(),
  );
  const userLabelMap = useMemo(
    () => buildКомпанияUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const otherUserOptions = useMemo(
    () => buildКомпанияUserInlineOptions(companyMembers?.users, { excludeUserIds: [currentUserId, issue.createdByUserId] }),
    [companyMembers?.users, currentUserId, issue.createdByUserId],
  );

  const userLabel = (userId: string | null | undefined) =>
    formatИсполнительUserLabel(userId, currentUserId, userLabelMap);
  const creatorUserLabel = userLabel(issue.createdByUserId);

  const agentИмя = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    return agent?.name ?? id.slice(0, 8);
  };

  const participantLabel = (value: string) => {
    if (value.startsWith("agent:")) return agentИмя(value.slice("agent:".length));
    if (value.startsWith("user:")) return userLabel(value.slice("user:".length)) ?? "User";
    return value;
  };

  const updatePolicy = (nextЗначениеs: string[]) => {
    onОбновить({
      executionPolicy: buildExecutionPolicy({
        existingPolicy: issue.executionPolicy ?? null,
        reviewerЗначениеs: stageТип === "review" ? nextЗначениеs : reviewerЗначениеs,
        approverЗначениеs: stageТип === "approval" ? nextЗначениеs : approverЗначениеs,
      }),
    });
  };

  const toggle = (value: string) => {
    const next = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
    updatePolicy(next);
  };

  const label = stageТип === "review" ? "Рецензенты" : "Утверждающие";
  const Icon = stageТип === "review" ? Eye : ShieldCheck;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setПоиск(""); }}>
      <PopoverTrigger asChild>
        <button
          classИмя={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
            values.length > 0
              ? "border-border text-foreground hover:bg-accent/50"
              : "border-dashed border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <Icon classИмя="h-3 w-3" />
          {values.length > 0 ? (
            <span classИмя="truncate max-w-[100px]">
              {values.map(participantLabel).join(", ")}
            </span>
          ) : (
            <span>{label}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="p-1 w-56" align="start" collisionPadding={16}>
        <input
          classИмя="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
          placeholder={`Поиск ${label.toНизкийerCase()}...`}
          value={search}
          onChange={(e) => setПоиск(e.target.value)}
          autoFocus
        />
        <div classИмя="max-h-48 overflow-y-auto overscroll-contain">
          <button
            classИмя={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
              values.length === 0 && "bg-accent",
            )}
            onClick={() => updatePolicy([])}
          >
            Нет {label.toНизкийerCase()}
          </button>
          {currentUserId && (
            <button
              classИмя={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                values.includes(`user:${currentUserId}`) && "bg-accent",
              )}
              onClick={() => toggle(`user:${currentUserId}`)}
            >
              <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              Назначить мне
            </button>
          )}
          {issue.createdByUserId && issue.createdByUserId !== currentUserId && (
            <button
              classИмя={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                values.includes(`user:${issue.createdByUserId}`) && "bg-accent",
              )}
              onClick={() => toggle(`user:${issue.createdByUserId}`)}
            >
              <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
              {creatorUserLabel ?? "Заявитель"}
            </button>
          )}
          {otherUserOptions
            .filter((option) => {
              if (!search.trim()) return true;
              return `${option.label} ${option.searchText ?? ""}`.toНизкийerCase().includes(search.toНизкийerCase());
            })
            .map((option) => (
              <button
                key={option.id}
                classИмя={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  values.includes(option.id) && "bg-accent",
                )}
                onClick={() => toggle(option.id)}
              >
                <User classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
                {option.label}
              </button>
            ))}
          {sortedАгенты
            .filter((agent) => {
              if (!search.trim()) return true;
              return agent.name.toНизкийerCase().includes(search.toНизкийerCase());
            })
            .map((agent) => {
              const encoded = `agent:${agent.id}`;
              return (
                <button
                  key={agent.id}
                  classИмя={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    values.includes(encoded) && "bg-accent",
                  )}
                  onClick={() => toggle(encoded)}
                >
                  <АгентIcon icon={agent.icon} classИмя="shrink-0 h-3 w-3 text-muted-foreground" />
                  {agent.name}
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
