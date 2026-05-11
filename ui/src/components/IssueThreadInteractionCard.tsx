import { useEffect, useMemo, useState } from "react";
import type { Агент } from "@paperclipai/shared";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, GitВетка, ListChecks, Loader2, MessageSquareQuote, XCircle } from "lucide-react";
import { Link } from "@/lib/router";
import { formatИсполнительUserLabel } from "../lib/assignees";
import {
  buildSuggestedЗадачаTree,
  collectSuggestedЗадачаClientКлючs,
  countSuggestedЗадачаНетdes,
  getQuestionAnswerЯрлыки,
  type AskUserQuestionsAnswer,
  type AskUserQuestionsInteraction,
  type ЗадачаThreadInteraction,
  type RequestПодтвердитьationInteraction,
  type RequestПодтвердитьationЦель,
  type SuggestЗадачиInteraction,
  type SuggestЗадачиResultСозданоЗадача,
  type SuggestedЗадачаЧерновик,
  type SuggestedЗадачаTreeНетde,
} from "../lib/issue-thread-interactions";
import { cn, formatDateTime, formatShortDate } from "../lib/utils";
import { MarkdownBody } from "./MarkdownBody";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ПриоритетIcon } from "./ПриоритетIcon";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ЗадачаThreadInteractionCardProps {
  interaction: ЗадачаThreadInteraction;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  onПринятьInteraction?: (
    interaction: SuggestЗадачиInteraction | RequestПодтвердитьationInteraction,
    selectedClientКлючs?: string[],
  ) => Promise<void> | void;
  onОтклонитьInteraction?: (
    interaction: SuggestЗадачиInteraction | RequestПодтвердитьationInteraction,
    reason?: string,
  ) => Promise<void> | void;
  onОтправитьInteractionAnswers?: (
    interaction: AskUserQuestionsInteraction,
    answers: AskUserQuestionsAnswer[],
  ) => Promise<void> | void;
  onОтменаInteraction?: (
    interaction: AskUserQuestionsInteraction,
  ) => Promise<void> | void;
}

function resolveActorLabel(args: {
  agentId?: string | null;
  userId?: string | null;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
}) {
  const { agentId, userId, agentMap, currentUserId, userLabelMap } = args;
  if (agentId) {
    return agentMap?.get(agentId)?.name ?? agentId.slice(0, 8);
  }
  if (userId) {
    return formatИсполнительUserLabel(userId, currentUserId, userLabelMap) ?? "Совет";
  }
  return "Неизвестно";
}

function statusLabel(status: ЗадачаThreadInteraction["status"]) {
  switch (status) {
    case "pending":
      return "Ожидание";
    case "accepted":
      return "Принятьed";
    case "rejected":
      return "Отклонитьed";
    case "answered":
      return "Answered";
    case "cancelled":
      return "Отменён";
    case "expired":
      return "Expired";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

function interactionKindLabel(kind: ЗадачаThreadInteraction["kind"]) {
  switch (kind) {
    case "suggest_tasks":
      return "Suggested tasks";
    case "ask_user_questions":
      return "Ask user questions";
    case "request_confirmation":
      return "Подтвердитьation";
    default:
      return kind;
  }
}

function statusIcon(status: ЗадачаThreadInteraction["status"]) {
  switch (status) {
    case "accepted":
    case "answered":
      return CheckCircle2;
    case "rejected":
    case "cancelled":
    case "failed":
      return XCircle;
    case "expired":
      return AlertTriangle;
    default:
      return CircleDashed;
  }
}

function statusClasses(status: ЗадачаThreadInteraction["status"]) {
  switch (status) {
    case "accepted":
    case "answered":
      return {
        shell: "border-emerald-400/70 bg-transparent",
        badge: "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100",
      };
    case "rejected":
    case "cancelled":
      return {
        shell: "border-rose-400/70 bg-transparent",
        badge: "border-rose-500/60 bg-rose-500/10 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100",
      };
    case "failed":
    case "expired":
      return {
        shell: "border-amber-400/70 bg-transparent",
        badge: "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100",
      };
    default:
      return {
        shell: "border-sky-500/70 bg-transparent",
        badge: "border-sky-500/70 bg-sky-500/10 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100",
      };
  }
}

function ЗадачаField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "subtle";
}) {
  return (
    <span
      classИмя={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
        tone === "default"
          ? "border-border/70 bg-transparent text-foreground"
          : "border-border/60 bg-transparent text-muted-foreground",
      )}
    >
      {label}: {value}
    </span>
  );
}

function createdЗадачаMap(
  createdЗадачи: readonly SuggestЗадачиResultСозданоЗадача[] | undefined,
) {
  return new Map(
    (createdЗадачи ?? []).map((entry) => [entry.clientКлюч, entry] as const),
  );
}

function ЗадачаTreeНетde({
  node,
  createdByClientКлюч,
  agentMap,
  currentUserId,
  userLabelMap,
  depth = 0,
  selectedClientКлючs,
  skippedClientКлючs,
  showSelection,
  onToggleSelection,
}: {
  node: SuggestedЗадачаTreeНетde;
  createdByClientКлюч: ReadonlyMap<string, SuggestЗадачиResultСозданоЗадача>;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  depth?: number;
  selectedClientКлючs?: ReadonlySet<string>;
  skippedClientКлючs?: ReadonlySet<string>;
  showSelection?: boolean;
  onToggleSelection?: (node: SuggestedЗадачаTreeНетde, checked: boolean) => void;
}) {
  const visibleChildren = node.children.filter((child) => !child.task.hiddenInПредпросмотр);
  const hiddenChildCount = node.children
    .filter((child) => child.task.hiddenInПредпросмотр)
    .reduce((sum, child) => sum + countSuggestedЗадачаНетdes(child), 0);
  const createdЗадача = createdByClientКлюч.get(node.task.clientКлюч);
  const isSelected = selectedClientКлючs?.has(node.task.clientКлюч) ?? false;
  const isSkipped = skippedClientКлючs?.has(node.task.clientКлюч) ?? false;
  const assigneeLabel = resolveActorLabel({
    agentId: node.task.assigneeАгентId,
    userId: node.task.assigneeUserId,
    agentMap,
    currentUserId,
    userLabelMap,
  });
  const hasExplicitИсполнитель = Boolean(
    node.task.assigneeАгентId || node.task.assigneeUserId,
  );
  const labels = node.task.labels ?? [];
  const hasMetadata = hasExplicitИсполнитель
    || Boolean(node.task.billingCode)
    || Boolean(node.task.projectId)
    || labels.length > 0;

  return (
    <>
      <div
        classИмя={cn(
          "relative border-b border-border/60 px-3 py-2.5 last:border-b-0",
          depth > 0 && "before:absolute before:left-3 before:top-0 before:h-full before:w-px before:bg-border/70",
        )}
        style={depth > 0 ? { paddingLeft: `${depth * 24 + 12}px` } : undefined}
      >
        <div classИмя="flex items-start justify-between gap-2">
          <div classИмя="min-w-0 flex-1">
            <div classИмя="flex items-start gap-2">
              {showSelection ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onToggleSelection?.(node, checked === true)}
                  aria-label={`Include ${node.task.title}`}
                  classИмя="mt-0.5"
                />
              ) : null}
              <div classИмя="min-w-0 flex-1">
                <div classИмя="flex min-w-0 items-center gap-1.5">
                  {node.task.priority ? (
                    <ПриоритетIcon
                      priority={node.task.priority}
                      classИмя="mt-px"
                    />
                  ) : null}
                  <div classИмя="min-w-0 truncate text-sm font-medium text-foreground">
                    {node.task.title}
                  </div>
                </div>
                {depth > 0 ? (
                  <div classИмя="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Child task
                  </div>
                ) : null}
                {node.task.description ? (
                  <p classИмя="mt-0.5 text-sm leading-5 text-muted-foreground">
                    {node.task.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {createdЗадача?.issueId ? (
            <Link
              to={`/issues/${createdЗадача.identifier ?? createdЗадача.issueId}`}
              classИмя="inline-flex shrink-0 items-center gap-1 rounded-sm border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-900 transition-colors hover:bg-emerald-500/15 dark:text-emerald-100"
            >
              {createdЗадача.identifier ?? createdЗадача.issueId.slice(0, 8)}
              <ChevronRight classИмя="h-3 w-3" />
            </Link>
          ) : isSkipped ? (
            <span classИмя="inline-flex shrink-0 items-center rounded-sm border border-amber-500/60 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-100">
              Skipped
            </span>
          ) : null}
        </div>

        {hasMetadata ? (
          <div classИмя="mt-2 flex flex-wrap gap-1.5">
            {hasExplicitИсполнитель ? (
              <ЗадачаField label="Исполнитель" value={assigneeLabel} />
            ) : null}
            {node.task.billingCode ? (
              <ЗадачаField label="Биллинг" value={node.task.billingCode} />
            ) : null}
            {node.task.projectId ? (
              <ЗадачаField label="Project" value={node.task.projectId} tone="subtle" />
            ) : null}
            {labels.map((label) => (
              <ЗадачаField key={label} label="Label" value={label} tone="subtle" />
            ))}
          </div>
        ) : null}

        {hiddenChildCount > 0 ? (
          <div classИмя="mt-2 flex items-center gap-2 rounded-sm border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            <GitВетка classИмя="h-3.5 w-3.5 shrink-0" />
            <span>
              {hiddenChildCount === 1
                ? "1 follow-on task hidden in preview"
                : `${hiddenChildCount} follow-on tasks hidden in preview`}
            </span>
          </div>
        ) : null}
      </div>

      {visibleChildren.length > 0 ? (
        <>
          {visibleChildren.map((child) => (
            <ЗадачаTreeНетde
              key={child.task.clientКлюч}
              node={child}
              createdByClientКлюч={createdByClientКлюч}
              agentMap={agentMap}
              currentUserId={currentUserId}
              userLabelMap={userLabelMap}
              depth={depth + 1}
              selectedClientКлючs={selectedClientКлючs}
              skippedClientКлючs={skippedClientКлючs}
              showSelection={showSelection}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function SuggestЗадачиCard({
  interaction,
  agentMap,
  currentUserId,
  userLabelMap,
  onПринятьInteraction,
  onОтклонитьInteraction,
}: {
  interaction: SuggestЗадачиInteraction;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  onПринятьInteraction?: (
    interaction: SuggestЗадачиInteraction,
    selectedClientКлючs?: string[],
  ) => Promise<void> | void;
  onОтклонитьInteraction?: (
    interaction: SuggestЗадачиInteraction,
    reason?: string,
  ) => Promise<void> | void;
}) {
  const [rejecting, setОтклонитьing] = useState(false);
  const [working, setРаботаing] = useState<"accept" | "reject" | null>(null);
  const [rejectReason, setОтклонитьReason] = useState(
    interaction.result?.rejectionReason ?? "",
  );

  useEffect(() => {
    setОтклонитьReason(interaction.result?.rejectionReason ?? "");
    if (interaction.status !== "pending") {
      setОтклонитьing(false);
      setРаботаing(null);
    }
  }, [interaction.result?.rejectionReason, interaction.status]);

  const roots = useMemo(
    () =>
      buildSuggestedЗадачаTree(interaction.payload.tasks).filter(
        (node) => !node.task.hiddenInПредпросмотр,
      ),
    [interaction.payload.tasks],
  );
  const createdByClientКлюч = useMemo(
    () => createdЗадачаMap(interaction.result?.createdЗадачи),
    [interaction.result?.createdЗадачи],
  );
  const skippedClientКлючs = useMemo(
    () => new Set(interaction.result?.skippedClientКлючs ?? []),
    [interaction.result?.skippedClientКлючs],
  );
  const totalЗадачи = interaction.payload.tasks.length;
  const [selectedClientКлючs, setSelectedClientКлючs] = useState<Set<string>>(
    () => new Set(interaction.payload.tasks.map((task) => task.clientКлюч)),
  );
  const taskSelectionSeed = useMemo(
    () => interaction.payload.tasks.map((task) => task.clientКлюч).join("\n"),
    [interaction.payload.tasks],
  );

  useEffect(() => {
    setSelectedClientКлючs(new Set(interaction.payload.tasks.map((task) => task.clientКлюч)));
  }, [interaction.id, interaction.status, taskSelectionSeed]);

  const taskByClientКлюч = useMemo(
    () => new Map(interaction.payload.tasks.map((task) => [task.clientКлюч, task] as const)),
    [interaction.payload.tasks],
  );
  const selectedCount = selectedClientКлючs.size;
  const createdCount = interaction.result?.createdЗадачи?.length ?? 0;
  const skippedCount = interaction.result?.skippedClientКлючs?.length ?? 0;

  async function handleПринять() {
    if (!onПринятьInteraction) return;
    setРаботаing("accept");
    try {
      await onПринятьInteraction(interaction, [...selectedClientКлючs]);
    } finally {
      setРаботаing(null);
    }
  }

  async function handleОтклонить() {
    if (!onОтклонитьInteraction) return;
    setРаботаing("reject");
    try {
      await onОтклонитьInteraction(interaction, rejectReason.trim() || undefined);
      setОтклонитьing(false);
    } finally {
      setРаботаing(null);
    }
  }

  function handleToggleSelection(node: SuggestedЗадачаTreeНетde, checked: boolean) {
    const subtreeClientКлючs = collectSuggestedЗадачаClientКлючs(node);
    setSelectedClientКлючs((current) => {
      const next = new Set(current);
      if (!checked) {
        for (const clientКлюч of subtreeClientКлючs) {
          next.delete(clientКлюч);
        }
        return next;
      }

      for (const clientКлюч of subtreeClientКлючs) {
        next.add(clientКлюч);
      }

      let parentClientКлюч = taskByClientКлюч.get(node.task.clientКлюч)?.parentClientКлюч ?? null;
      while (parentClientКлюч) {
        next.add(parentClientКлюч);
        parentClientКлюч = taskByClientКлюч.get(parentClientКлюч)?.parentClientКлюч ?? null;
      }
      return next;
    });
  }

  return (
    <div classИмя="space-y-3">
      <div classИмя="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{totalЗадачи === 1 ? "1 draft issue" : `${totalЗадачи} draft issues`}</span>
        {interaction.payload.defaultРодительId ? (
          <ЗадачаField label="По умолчанию parent" value={interaction.payload.defaultРодительId} tone="subtle" />
        ) : null}
      </div>

      <div classИмя="overflow-hidden border border-border/70">
        {roots.map((root) => (
          <ЗадачаTreeНетde
            key={root.task.clientКлюч}
            node={root}
            createdByClientКлюч={createdByClientКлюч}
            agentMap={agentMap}
            currentUserId={currentUserId}
            userLabelMap={userLabelMap}
            selectedClientКлючs={selectedClientКлючs}
            skippedClientКлючs={skippedClientКлючs}
            showSelection={interaction.status === "pending"}
            onToggleSelection={handleToggleSelection}
          />
        ))}
      </div>

      {interaction.status === "accepted" ? (
        <div classИмя="rounded-sm border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
          <div classИмя="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Resolution summary
          </div>
          <p classИмя="mt-1 leading-6">
            {skippedCount > 0
              ? `Создано ${createdCount} draft ${createdCount === 1 ? "issue" : "issues"} and skipped ${skippedCount} during review.`
              : `Создано all ${createdCount} draft ${createdCount === 1 ? "issue" : "issues"}.`}
          </p>
        </div>
      ) : null}

      {interaction.status === "rejected" ? (
        <div classИмя="rounded-sm border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-900 dark:text-rose-100">
          <div classИмя="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">
            Отклонитьion reason
          </div>
          <p classИмя={cn(
            "mt-1 leading-6",
            !interaction.result?.rejectionReason && "text-rose-900/75",
          )}>
            {interaction.result?.rejectionReason || "Нет reason provided."}
          </p>
        </div>
      ) : null}

      {interaction.status === "pending" ? (
        <div classИмя="space-y-3">
          <div classИмя="flex flex-wrap items-center justify-between gap-3">
            <div classИмя="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {selectedCount === totalЗадачи
                  ? `Все ${totalЗадачи} draft ${totalЗадачи === 1 ? "issue" : "issues"} selected`
                  : `${selectedCount} of ${totalЗадачи} draft ${totalЗадачи === 1 ? "issue" : "issues"} selected`}
              </span>
              {selectedCount < totalЗадачи ? (
                <span>
                  {totalЗадачи - selectedCount} will be skipped if you accept this interaction.
                </span>
              ) : null}
            </div>

            <div classИмя="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                disabled={!onПринятьInteraction || working !== null || selectedCount === 0}
                onClick={() => void handleПринять()}
              >
                {working === "accept" ? (
                  <>
                    <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                    Принятьing...
                  </>
                ) : (
                  selectedCount === totalЗадачи ? "Принять drafts" : "Принять selected drafts"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!onОтклонитьInteraction || working !== null}
                onClick={() => setОтклонитьing((current) => !current)}
              >
                Отклонить
              </Button>
              {selectedCount < totalЗадачи ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={working !== null}
                  onClick={() => setSelectedClientКлючs(new Set(interaction.payload.tasks.map((task) => task.clientКлюч)))}
                >
                  Сбросить selection
                </Button>
              ) : null}
            </div>
          </div>

          {rejecting ? (
            <div classИмя="space-y-3">
              <Textarea
                value={rejectReason}
                onChange={(event) => setОтклонитьReason(event.target.value)}
                placeholder="Добавить a short reason for rejecting this suggestion"
                classИмя="min-h-24 bg-background text-sm"
              />
              <div classИмя="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!onОтклонитьInteraction || working !== null}
                  onClick={() => void handleОтклонить()}
                >
                  {working === "reject" ? (
                    <>
                      <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Сохранить rejection"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuestionOptionButton({
  id,
  label,
  description,
  selected,
  selectionMode,
  onClick,
}: {
  id: string;
  label: string;
  description?: string | null;
  selected: boolean;
  selectionMode: "single" | "multi";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={selectionMode === "single" ? "radio" : "checkbox"}
      aria-checked={selected}
      classИмя={cn(
        "w-full rounded-sm border px-4 py-3 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected
          ? "border-sky-500/80 bg-sky-500/10 text-sky-950 dark:border-sky-400/80 dark:bg-sky-400/15 dark:text-sky-50"
          : "border-border/70 bg-transparent text-foreground hover:border-sky-500/70 hover:bg-sky-500/10 dark:hover:border-sky-400/70 dark:hover:bg-sky-400/10",
      )}
      id={id}
      onClick={onClick}
    >
      <div
        classИмя={cn(
          "text-sm font-medium",
          selected ? "text-sky-950 dark:text-sky-50" : "text-foreground",
        )}
      >
        {label}
      </div>
      {description ? (
        <div
          classИмя={cn(
            "mt-1 text-sm leading-6",
            selected
              ? "text-sky-900/80 dark:text-sky-100/80"
              : "text-muted-foreground",
          )}
        >
          {description}
        </div>
      ) : null}
    </button>
  );
}

function AskUserQuestionsCard({
  interaction,
  onОтправитьInteractionAnswers,
  onОтменаInteraction,
}: {
  interaction: AskUserQuestionsInteraction;
  onОтправитьInteractionAnswers?: (
    interaction: AskUserQuestionsInteraction,
    answers: AskUserQuestionsAnswer[],
  ) => Promise<void> | void;
  onОтменаInteraction?: (
    interaction: AskUserQuestionsInteraction,
  ) => Promise<void> | void;
}) {
  const [draftAnswers, setЧерновикAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      (interaction.result?.answers ?? []).map((answer) => [
        answer.questionId,
        [...answer.optionIds],
      ]),
    ),
  );
  const [working, setРаботаing] = useState(false);
  const [cancelling, setОтменаling] = useState(false);

  useEffect(() => {
    setЧерновикAnswers(
      Object.fromEntries(
        (interaction.result?.answers ?? []).map((answer) => [
          answer.questionId,
          [...answer.optionIds],
        ]),
      ),
    );
  }, [interaction.result?.answers]);

  const questions = interaction.payload.questions;
  const requiredQuestions = questions.filter((question) => question.required);
  const canОтправить = requiredQuestions.every(
    (question) => (draftAnswers[question.id] ?? []).length > 0,
  );

  function toggleOption(questionId: string, optionId: string, selectionMode: "single" | "multi") {
    setЧерновикAnswers((current) => {
      const existing = current[questionId] ?? [];
      if (selectionMode === "single") {
        return { ...current, [questionId]: [optionId] };
      }
      const next = existing.includes(optionId)
        ? existing.filter((value) => value !== optionId)
        : [...existing, optionId];
      return { ...current, [questionId]: next };
    });
  }

  async function handleОтправить() {
    if (!onОтправитьInteractionAnswers || !canОтправить) return;
    setРаботаing(true);
    try {
      await onОтправитьInteractionAnswers(
        interaction,
        questions.map((question) => ({
          questionId: question.id,
          optionIds: draftAnswers[question.id] ?? [],
        })),
      );
    } finally {
      setРаботаing(false);
    }
  }

  async function handleОтмена() {
    if (!onОтменаInteraction) return;
    setОтменаling(true);
    try {
      await onОтменаInteraction(interaction);
    } finally {
      setОтменаling(false);
    }
  }

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span classИмя="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 font-medium uppercase tracking-[0.16em] text-foreground/70">
          <MessageSquareQuote classИмя="h-3 w-3" />
          Ask user questions
        </span>
        <span>
          {questions.length === 1
            ? "1 question"
            : `${questions.length} questions`}
        </span>
      </div>

      {interaction.status === "pending" ? (
        <div classИмя="space-y-4">
          {questions.map((question, index) => (
            <div
              key={question.id}
              classИмя="rounded-2xl border border-border/70 bg-background/82 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.06)]"
            >
              <div classИмя="flex items-start justify-between gap-3">
                <div>
                  <div classИмя="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Question {index + 1}
                  </div>
                  <div
                    id={`${interaction.id}-${question.id}-prompt`}
                    classИмя="mt-1 text-sm font-semibold text-foreground"
                  >
                    {question.prompt}
                  </div>
                  {question.helpText ? (
                    <p classИмя="mt-1 text-sm leading-6 text-muted-foreground">
                      {question.helpText}
                    </p>
                  ) : null}
                </div>
                <ЗадачаField
                  label={question.selectionMode === "single" ? "Pick" : "Pick many"}
                  value={question.required ? "Обязательно" : "Опционально"}
                  tone="subtle"
                />
              </div>

              <div
                classИмя="mt-3 grid gap-3"
                role={question.selectionMode === "single" ? "radiogroup" : "group"}
                aria-labelledby={`${interaction.id}-${question.id}-prompt`}
              >
                {question.options.map((option) => (
                  <QuestionOptionButton
                    key={option.id}
                    id={`${interaction.id}-${question.id}-${option.id}`}
                    label={option.label}
                    description={option.description}
                    selected={(draftAnswers[question.id] ?? []).includes(option.id)}
                    selectionMode={question.selectionMode}
                    onClick={() =>
                      toggleOption(question.id, option.id, question.selectionMode)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div classИмя="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/75 p-4">
            <div classИмя="text-sm text-muted-foreground">
              Отправить once after you finish the full form.
            </div>
            <div classИмя="flex flex-wrap items-center gap-2">
              {onОтменаInteraction ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working || cancelling}
                  onClick={() => void handleОтмена()}
                >
                  {cancelling ? (
                    <>
                      <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                      Отменаling...
                    </>
                  ) : (
                    "Отмена question"
                  )}
                  </Button>
                ) : null}
              <Button
                size="sm"
                disabled={!onОтправитьInteractionAnswers || !canОтправить || working || cancelling}
                onClick={() => void handleОтправить()}
              >
                {working ? (
                  <>
                    <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                    Отправитьting...
                  </>
                ) : (
                  interaction.payload.submitLabel ?? "Отправить answers"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : interaction.status === "cancelled" ? (
        <div classИмя="rounded-2xl border border-rose-300/60 bg-rose-50/85 p-4 text-sm leading-6 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
          <div classИмя="font-semibold">Question cancelled</div>
          {interaction.result?.cancellationReason ? (
            <p classИмя="mt-1">{interaction.result.cancellationReason}</p>
          ) : (
            <p classИмя="mt-1">Нет answer was recorded.</p>
          )}
        </div>
      ) : (
        <div classИмя="space-y-3">
          {questions.map((question) => {
            const labels = getQuestionAnswerЯрлыки({
              question,
              answers: interaction.result?.answers ?? [],
            });
            return (
              <div
                key={question.id}
                classИмя="rounded-2xl border border-border/70 bg-background/82 p-4"
              >
                <div classИмя="text-sm font-semibold text-foreground">
                  {question.prompt}
                </div>
                <div classИмя="mt-2 flex flex-wrap gap-2">
                  {labels.length > 0 ? (
                    labels.map((label) => (
                      <ЗадачаField key={label} label="Answer" value={label} />
                    ))
                  ) : (
                    <span classИмя="text-sm text-muted-foreground">Нет answer recorded.</span>
                  )}
                </div>
              </div>
            );
          })}

          {interaction.result?.summaryMarkdown ? (
            <div classИмя="rounded-2xl border border-emerald-300/60 bg-emerald-50/85 p-4">
              <div classИмя="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Отправитьted summary
              </div>
              <MarkdownBody>{interaction.result.summaryMarkdown}</MarkdownBody>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function requestПодтвердитьationЦельLabel(target: RequestПодтвердитьationЦель) {
  if (target.label) return target.label;
  const revision = target.revisionNumber ? ` v${target.revisionNumber}` : "";
  if (target.type === "issue_document" && target.key === "plan") {
    return `Plan${revision}`;
  }
  return `${target.key}${revision}`;
}

function requestПодтвердитьationЦельHref({
  interaction,
  target,
}: {
  interaction: RequestПодтвердитьationInteraction;
  target: RequestПодтвердитьationЦель;
}) {
  if (target.href) return target.href;
  if (target.type === "issue_document") {
    const issueId = target.issueId ?? interaction.issueId;
    return `/issues/${issueId}#document-${encodeURIComponent(target.key)}`;
  }
  return null;
}

function RequestПодтвердитьationЦельChip({
  interaction,
  target,
  tone = "default",
}: {
  interaction: RequestПодтвердитьationInteraction;
  target: RequestПодтвердитьationЦель | null | undefined;
  tone?: "default" | "subtle";
}) {
  if (!target) return null;

  const href = requestПодтвердитьationЦельHref({ interaction, target });
  const classИмя = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
    tone === "default"
      ? "border-border/70 bg-transparent text-foreground"
      : "border-border/60 bg-transparent text-muted-foreground",
    href && "transition-colors hover:border-sky-500/70 hover:bg-sky-500/10",
  );
  const content = (
    <>
      <GitВетка classИмя="h-3 w-3 shrink-0" />
      <span classИмя="min-w-0 truncate">{requestПодтвердитьationЦельLabel(target)}</span>
    </>
  );

  if (!href) return <span classИмя={classИмя}>{content}</span>;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" classИмя={classИмя}>
        {content}
      </a>
    );
  }
  return (
    <Link to={href} classИмя={classИмя}>
      {content}
    </Link>
  );
}

function RequestПодтвердитьationResolution({
  interaction,
}: {
  interaction: RequestПодтвердитьationInteraction;
}) {
  const outcome = interaction.result?.outcome;
  const target = interaction.payload.target ?? null;
  const staleЦель = interaction.result?.staleЦель ?? null;

  if (interaction.status === "accepted") {
    return (
      <div classИмя="flex flex-wrap items-center gap-2 text-sm leading-6 text-foreground">
        <span classИмя="font-medium">Подтвердитьed</span>
        <RequestПодтвердитьationЦельChip interaction={interaction} target={target} />
      </div>
    );
  }

  if (interaction.status === "rejected") {
    return (
      <div classИмя="space-y-2">
        <div classИмя="flex flex-wrap items-center gap-2 text-sm leading-6 text-foreground">
          <span classИмя="font-medium">Отклонитьd</span>
          <RequestПодтвердитьationЦельChip interaction={interaction} target={target} />
        </div>
        {interaction.result?.reason ? (
          <blockquote classИмя="rounded-sm border-l-2 border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm leading-6 text-rose-900 dark:text-rose-100">
            {interaction.result.reason}
          </blockquote>
        ) : null}
      </div>
    );
  }

  if (interaction.status === "expired") {
    const expiredByComment = outcome === "superseded_by_comment";
    const expiredByЦельChange = outcome === "stale_target";
    return (
      <div classИмя="space-y-3 rounded-sm border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        <div classИмя="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
          {expiredByComment ? "Expired by comment" : "Expired by target change"}
        </div>
        <p classИмя="leading-6">
          {expiredByComment
            ? "A board comment superseded this confirmation before it was resolved."
            : "The requested target changed before this confirmation was resolved."}
        </p>
        {expiredByComment && interaction.result?.commentId ? (
          <Button asChild size="sm" variant="ghost" classИмя="h-7 px-2 text-amber-950 hover:bg-amber-500/15 dark:text-amber-50">
            <a href={`#comment-${interaction.result.commentId}`}>Jump to comment</a>
          </Button>
        ) : null}
        {expiredByЦельChange ? (
          <div classИмя="flex flex-wrap items-center gap-2">
            <RequestПодтвердитьationЦельChip
              interaction={interaction}
              target={staleЦель}
              tone="subtle"
            />
            {staleЦель && target ? (
              <ChevronRight classИмя="h-3.5 w-3.5 text-amber-700" />
            ) : null}
            <RequestПодтвердитьationЦельChip interaction={interaction} target={target} />
          </div>
        ) : null}
      </div>
    );
  }

  if (interaction.status === "failed") {
    return (
      <p classИмя="text-sm leading-6 text-muted-foreground">
        This request could not be resolved. Попробовать снова or create a new request.
      </p>
    );
  }

  return null;
}

function RequestПодтвердитьationCard({
  interaction,
  onПринятьInteraction,
  onОтклонитьInteraction,
}: {
  interaction: RequestПодтвердитьationInteraction;
  onПринятьInteraction?: (
    interaction: RequestПодтвердитьationInteraction,
  ) => Promise<void> | void;
  onОтклонитьInteraction?: (
    interaction: RequestПодтвердитьationInteraction,
    reason?: string,
  ) => Promise<void> | void;
}) {
  const [rejecting, setОтклонитьing] = useState(false);
  const [working, setРаботаing] = useState<"accept" | "reject" | null>(null);
  const [rejectReason, setОтклонитьReason] = useState(interaction.result?.reason ?? "");
  const [rejectAttempted, setОтклонитьAttempted] = useState(false);
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);
  const rejectRequiresReason = interaction.payload.rejectRequiresReason === true;
  const allowОтклонитьReason = interaction.payload.allowОтклонитьReason !== false;
  const trimmedОтклонитьReason = rejectReason.trim();
  const canОтклонить = !rejectRequiresReason || trimmedОтклонитьReason.length > 0;
  const declineReasonInvalid = rejectRequiresReason && !canОтклонить;
  const declineReasonPlaceholder =
    interaction.payload.declineReasonPlaceholder
    ?? (interaction.payload.acceptLabel === "Одобрить plan"
      ? "Опционально: what would you like revised?"
      : "Опционально: tell the agent what you'd change.");

  useEffect(() => {
    setОтклонитьReason(interaction.result?.reason ?? "");
    setОтклонитьAttempted(false);
    setActionОшибка(null);
    if (interaction.status !== "pending") {
      setОтклонитьing(false);
      setРаботаing(null);
    }
  }, [interaction.id, interaction.result?.reason, interaction.status]);

  async function handleПринять() {
    if (!onПринятьInteraction) return;
    setРаботаing("accept");
    setActionОшибка(null);
    try {
      await onПринятьInteraction(interaction);
    } catch {
      setActionОшибка("Попробовать снова");
    } finally {
      setРаботаing(null);
    }
  }

  async function handleОтклонить() {
    setОтклонитьAttempted(true);
    if (!onОтклонитьInteraction || !canОтклонить) return;
    setРаботаing("reject");
    setActionОшибка(null);
    try {
      await onОтклонитьInteraction(interaction, trimmedОтклонитьReason || undefined);
      setОтклонитьing(false);
    } catch {
      setActionОшибка("Попробовать снова");
    } finally {
      setРаботаing(null);
    }
  }

  return (
    <div classИмя="space-y-4">
      {interaction.status === "pending" ? (
        <div classИмя="space-y-3 rounded-sm border border-border/70 bg-background/75 p-4">
          <div classИмя="text-sm leading-6 text-foreground">
            {interaction.payload.prompt}
          </div>
          {interaction.payload.detailsMarkdown ? (
            <div classИмя="border-t border-border/60 pt-3 text-sm">
              <MarkdownBody>{interaction.payload.detailsMarkdown}</MarkdownBody>
            </div>
          ) : null}
          <RequestПодтвердитьationЦельChip
            interaction={interaction}
            target={interaction.payload.target}
          />
        </div>
      ) : null}

      {interaction.status === "pending" ? (
        <div classИмя="space-y-3">
          <div classИмя="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant={rejecting ? "outline" : "default"}
              disabled={!onПринятьInteraction || working !== null}
              onClick={() => void handleПринять()}
            >
              {working === "accept" ? (
                <>
                  <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                  Подтвердитьing...
                </>
              ) : (
                interaction.payload.acceptLabel ?? "Подтвердить"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!onОтклонитьInteraction || working !== null}
              onClick={() => {
                if (!allowОтклонитьReason) {
                  void handleОтклонить();
                  return;
                }
                setОтклонитьAttempted(false);
                setОтклонитьing((current) => !current);
              }}
            >
              {interaction.payload.rejectLabel ?? "Отклонить"}
            </Button>
          </div>

          {rejecting ? (
            <div classИмя="space-y-3 rounded-sm border border-border/70 bg-background/75 p-3">
              <Textarea
                value={rejectReason}
                onChange={(event) => setОтклонитьReason(event.target.value)}
                placeholder={declineReasonPlaceholder}
                aria-invalid={rejectAttempted && declineReasonInvalid}
                classИмя={cn(
                  "min-h-24 bg-background text-sm",
                  rejectAttempted && declineReasonInvalid
                    && "border-rose-500 focus-visible:ring-rose-500/25",
                )}
              />
              {rejectAttempted && declineReasonInvalid ? (
                <p classИмя="text-xs text-destructive">A decline reason is required.</p>
              ) : null}
              <div classИмя="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={working !== null}
                  onClick={() => {
                    setОтклонитьing(false);
                    setОтклонитьAttempted(false);
                  }}
                >
                  Отмена decline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!onОтклонитьInteraction || working !== null}
                  onClick={() => void handleОтклонить()}
                >
                  {working === "reject" ? (
                    <>
                      <Loader2 classИмя="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    interaction.payload.rejectLabel ?? "Отклонить"
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {actionОшибка ? (
            <div classИмя="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionОшибка}
            </div>
          ) : null}
        </div>
      ) : (
        <RequestПодтвердитьationResolution interaction={interaction} />
      )}
    </div>
  );
}

export function ЗадачаThreadInteractionCard({
  interaction,
  agentMap,
  currentUserId,
  userLabelMap,
  onПринятьInteraction,
  onОтклонитьInteraction,
  onОтправитьInteractionAnswers,
  onОтменаInteraction,
}: ЗадачаThreadInteractionCardProps) {
  const СтатусIcon = statusIcon(interaction.status);
  const styles = statusClasses(interaction.status);
  const createdByLabel = resolveActorLabel({
    agentId: interaction.createdByАгентId,
    userId: interaction.createdByUserId,
    agentMap,
    currentUserId,
    userLabelMap,
  });
  const resolvedByLabel =
    interaction.resolvedByАгентId || interaction.resolvedByUserId
      ? resolveActorLabel({
          agentId: interaction.resolvedByАгентId,
          userId: interaction.resolvedByUserId,
          agentMap,
          currentUserId,
          userLabelMap,
        })
      : null;

  return (
    <div classИмя={cn("rounded-sm border p-5 shadow-none", styles.shell)}>
      <div classИмя="flex flex-wrap items-start justify-between gap-4">
        <div classИмя="min-w-0 flex-1 basis-64">
          <div classИмя="flex flex-wrap items-center gap-2">
            <span classИмя={cn("inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", styles.badge)}>
              <СтатусIcon classИмя="h-3.5 w-3.5" />
              {interactionKindLabel(interaction.kind)}
              <span classИмя="text-current/60">/</span>
              {statusLabel(interaction.status)}
            </span>
            {interaction.continuationPolicy === "wake_assignee"
              || interaction.continuationPolicy === "wake_assignee_on_accept" ? (
              <span classИмя="inline-flex items-center gap-1 rounded-sm border border-border/70 bg-transparent px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70">
                <ListChecks classИмя="h-3.5 w-3.5" />
                {interaction.continuationPolicy === "wake_assignee_on_accept"
                  ? "Wakes on confirm"
                  : "Wakes assignee"}
              </span>
            ) : null}
          </div>

          <div classИмя="mt-3 text-lg font-bold text-foreground">
            {interaction.title
              ?? (interaction.kind === "suggest_tasks"
                ? "Suggested task tree"
                : interaction.kind === "ask_user_questions"
                  ? interaction.payload.title ?? "Questions for the operator"
                  : "Подтвердитьation requested")}
          </div>
          {interaction.summary ? (
            <p classИмя="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {interaction.summary}
            </p>
          ) : null}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div classИмя="rounded-sm border border-border/70 bg-transparent px-3 py-2 text-right text-xs text-muted-foreground">
              <div classИмя="font-medium text-foreground">{formatShortDate(interaction.createdAt)}</div>
              <div>proposed by {createdByLabel}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" classИмя="text-xs">
            Создано {formatDateTime(interaction.createdAt)}
          </TooltipContent>
        </Tooltip>
      </div>

      <div classИмя="mt-5">
        {interaction.kind === "suggest_tasks" ? (
          <SuggestЗадачиCard
            interaction={interaction}
            agentMap={agentMap}
            currentUserId={currentUserId}
            userLabelMap={userLabelMap}
            onПринятьInteraction={onПринятьInteraction}
            onОтклонитьInteraction={onОтклонитьInteraction}
          />
        ) : interaction.kind === "ask_user_questions" ? (
          <AskUserQuestionsCard
            interaction={interaction}
            onОтправитьInteractionAnswers={onОтправитьInteractionAnswers}
            onОтменаInteraction={onОтменаInteraction}
          />
        ) : (
          <RequestПодтвердитьationCard
            interaction={interaction}
            onПринятьInteraction={onПринятьInteraction}
            onОтклонитьInteraction={onОтклонитьInteraction}
          />
        )}
      </div>

      {resolvedByLabel ? (
        <div classИмя="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Resolved by <span classИмя="font-medium text-foreground">{resolvedByLabel}</span>
          {interaction.resolvedAt ? ` on ${formatShortDate(interaction.resolvedAt)}` : ""}
        </div>
      ) : null}
    </div>
  );
}
