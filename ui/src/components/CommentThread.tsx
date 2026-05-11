import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type {
  Агент,
  Согласование,
  FeedbackDataSharingPreference,
  FeedbackVote,
  FeedbackVoteЗначение,
  ЗадачаComment,
} from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Копировать, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Identity } from "./Identity";
import { InlineEntitySelector, type InlineEntityOption } from "./InlineEntitySelector";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "./MarkdownИзменитьor";
import { OutputFeedbackButtons } from "./OutputFeedbackButtons";
import { СогласованиеCard } from "./СогласованиеCard";
import { АгентIcon } from "./АгентIconPicker";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { formatTimelineРабочая областьLabel, type ЗадачаTimelineИсполнитель, type ЗадачаTimelineEvent } from "../lib/issue-timeline-events";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatDateTime } from "../lib/utils";
import { restoreОтправитьtedCommentЧерновик } from "../lib/comment-submit-draft";
import { PluginSlotOutlet } from "@/plugins/slots";

interface CommentWithЗапуститьMeta extends ЗадачаComment {
  runId?: string | null;
  runАгентId?: string | null;
  clientId?: string;
  clientСтатус?: "pending" | "queued";
  queueState?: "queued";
  queueЦельЗапуститьId?: string | null;
  followUpRequested?: boolean;
}

interface LinkedЗапуститьItem {
  runId: string;
  status: string;
  agentId: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  environment?: {
    id: string;
    name: string;
    driver: string;
  } | null;
  environmentLease?: {
    id: string;
    status: string;
    leasePolicy: string;
    provider: string | null;
    providerLeaseId: string | null;
    executionРабочая областьId: string | null;
    workspaceПуть: string | null;
    failureReason: string | null;
    cleanupСтатус: string | null;
  } | null;
  finishedAt?: Date | string | null;
}

interface CommentReassignment {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
}

interface CommentThreadProps {
  comments: CommentWithЗапуститьMeta[];
  queuedКомментарии?: CommentWithЗапуститьMeta[];
  linkedСогласования?: Согласование[];
  feedbackVotes?: FeedbackVote[];
  feedbackDataSharingPreference?: FeedbackDataSharingPreference;
  feedbackTermsUrl?: string | null;
  linkedЗапуститьs?: LinkedЗапуститьItem[];
  timelineEvents?: ЗадачаTimelineEvent[];
  companyId?: string | null;
  projectId?: string | null;
  onОдобритьСогласование?: (approvalId: string) => Promise<void>;
  onОтклонитьСогласование?: (approvalId: string) => Promise<void>;
  pendingСогласованиеAction?: {
    approvalId: string;
    action: "approve" | "reject";
  } | null;
  onVote?: (
    commentId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  onДобавить: (body: string, reopen?: boolean, reassignment?: CommentReassignment) => Promise<void>;
  issueСтатус?: string;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
  /** Callback to attach an image file to the parent issue (not inline in a comment). */
  onAttachImage?: (file: File) => Promise<void>;
  draftКлюч?: string;
  liveЗапуститьSlot?: React.ReactНетde;
  enableReassign?: boolean;
  reassignOptions?: InlineEntityOption[];
  currentИсполнительЗначение?: string;
  suggestedИсполнительЗначение?: string;
  mentions?: MentionOption[];
  onInterruptQueued?: (runId: string) => Promise<void>;
  interruptingQueuedЗапуститьId?: string | null;
  composerОтключитьdReason?: string | null;
}

const DRAFT_DEBOUNCE_MS = 800;

function loadЧерновик(draftКлюч: string): string {
  try {
    return localStorage.getItem(draftКлюч) ?? "";
  } catch {
    return "";
  }
}

function saveЧерновик(draftКлюч: string, value: string) {
  try {
    if (value.trim()) {
      localStorage.setItem(draftКлюч, value);
    } else {
      localStorage.removeItem(draftКлюч);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

function clearЧерновик(draftКлюч: string) {
  try {
    localStorage.removeItem(draftКлюч);
  } catch {
    // Ignore localStorage failures.
  }
}

function BreakableПуть({ text }: { text: string }) {
  const parts: React.ReactНетde[] = [];
  const segments = text.split(/(?<=[\/-])/);
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) parts.push(<wbr key={i} />);
    parts.push(segments[i]);
  }
  return <>{parts}</>;
}

function parseReassignment(target: string): CommentReassignment | null {
  if (!target || target === "__none__") {
    return { assigneeАгентId: null, assigneeUserId: null };
  }
  if (target.startsWith("agent:")) {
    const assigneeАгентId = target.slice("agent:".length);
    return assigneeАгентId ? { assigneeАгентId, assigneeUserId: null } : null;
  }
  if (target.startsWith("user:")) {
    const assigneeUserId = target.slice("user:".length);
    return assigneeUserId ? { assigneeАгентId: null, assigneeUserId } : null;
  }
  return null;
}

function shouldImplicitlyReopenComment(issueСтатус: string | undefined, assigneeЗначение: string) {
  const resumesToTodo = issueСтатус === "done" || issueСтатус === "cancelled" || issueСтатус === "blocked";
  return resumesToTodo && assigneeЗначение.startsWith("agent:");
}

function humanizeЗначение(value: string | null): string {
  if (!value) return "Нет";
  return value.replace(/_/g, " ");
}

function formatTimelineИсполнительLabel(
  assignee: ЗадачаTimelineИсполнитель,
  agentMap?: Map<string, Агент>,
  currentUserId?: string | null,
) {
  if (assignee.agentId) {
    return agentMap?.get(assignee.agentId)?.name ?? assignee.agentId.slice(0, 8);
  }
  if (assignee.userId) {
    return formatИсполнительUserLabel(assignee.userId, currentUserId) ?? "Совет";
  }
  return "Не назначен";
}

function formatTimelineActorИмя(
  actorТип: ЗадачаTimelineEvent["actorТип"],
  actorId: string,
  agentMap?: Map<string, Агент>,
  currentUserId?: string | null,
) {
  if (actorТип === "agent") {
    return agentMap?.get(actorId)?.name ?? actorId.slice(0, 8);
  }
  if (actorТип === "system") {
    return "System";
  }
  return formatИсполнительUserLabel(actorId, currentUserId) ?? "Совет";
}

function initialsForИмя(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatЗапуститьСтатусLabel(status: string) {
  switch (status) {
    case "timed_out":
      return "timed out";
    default:
      return status.replace(/_/g, " ");
  }
}

function runTimestamp(run: LinkedЗапуститьItem) {
  return run.finishedAt ?? run.startedAt ?? run.createdAt;
}

function runСтатусClass(status: string) {
  switch (status) {
    case "succeeded":
      return "text-green-700 dark:text-green-300";
    case "failed":
    case "error":
      return "text-red-700 dark:text-red-300";
    case "timed_out":
      return "text-orange-700 dark:text-orange-300";
    case "running":
      return "text-cyan-700 dark:text-cyan-300";
    case "queued":
    case "pending":
      return "text-amber-700 dark:text-amber-300";
    case "cancelled":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

async function copyTextWithFallback(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    const success = document.execКоманда("copy");
    if (!success) throw new Ошибка("execКоманда copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

function КопироватьMarkdownButton({ text }: { text: string }) {
  const [status, setСтатус] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<ReturnТип<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const label = status === "copied" ? "Copied" : status === "failed" ? "Копировать failed" : "Копировать";

  return (
    <button
      type="button"
      classИмя={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        status === "copied"
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
          : status === "failed"
            ? "bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
      title={label}
      aria-label="Копировать comment as markdown"
      onClick={() => {
        void copyTextWithFallback(text)
          .then(() => setСтатус("copied"))
          .catch(() => setСтатус("failed"));

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setСтатус("idle");
          timeoutRef.current = null;
        }, 1500);
      }}
    >
      {status === "copied" ? <Check classИмя="h-3.5 w-3.5" /> : <Копировать classИмя="h-3.5 w-3.5" />}
      <span classИмя="sm:hidden">{label}</span>
      <span classИмя="sr-only" aria-live="polite">
        {label}
      </span>
    </button>
  );
}

function CommentCard({
  comment,
  agentMap,
  companyId,
  projectId,
  feedbackVote = null,
  feedbackDataSharingPreference = "prompt",
  feedbackTermsUrl = null,
  onVote,
  voting = false,
  highlightCommentId,
  queued = false,
}: {
  comment: CommentWithЗапуститьMeta;
  agentMap?: Map<string, Агент>;
  companyId?: string | null;
  projectId?: string | null;
  feedbackVote?: FeedbackVoteЗначение | null;
  feedbackDataSharingPreference?: FeedbackDataSharingPreference;
  feedbackTermsUrl?: string | null;
  onVote?: (
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  voting?: boolean;
  highlightCommentId?: string | null;
  queued?: boolean;
}) {
  const isВысокийlighted = highlightCommentId === comment.id;
  const isОжидание = comment.clientСтатус === "pending";
  const isQueued = queued || comment.queueState === "queued" || comment.clientСтатус === "queued";
  const followUpRequested = comment.followUpRequested === true;

  return (
    <div
      key={comment.id}
      id={`comment-${comment.id}`}
      classИмя={`border p-3 overflow-hidden min-w-0 rounded-sm transition-colors duration-1000 ${
        isQueued
          ? "border-amber-300/70 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/10"
          : isВысокийlighted
            ? "border-primary/50 bg-primary/5"
            : "border-border"
      } ${isОжидание ? "opacity-80" : ""}`}
    >
      <div classИмя="flex items-center justify-between mb-1">
        {comment.authorАгентId ? (
          <Link to={`/agents/${comment.authorАгентId}`} classИмя="hover:underline">
            <Identity
              name={agentMap?.get(comment.authorАгентId)?.name ?? comment.authorАгентId.slice(0, 8)}
              size="sm"
            />
          </Link>
        ) : (
          <Identity name="You" size="sm" />
        )}
        <span classИмя="flex items-center gap-1.5">
          {isQueued ? (
            <span classИмя="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-100/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-200">
              Queued
            </span>
          ) : null}
          {followUpRequested ? (
            <Badge variant="outline" classИмя="text-[10px] uppercase tracking-[0.14em]">
              Follow-up
            </Badge>
          ) : null}
          {companyId && !isОжидание ? (
            <PluginSlotOutlet
              slotТипs={["commentContextMenuItem"]}
              entityТип="comment"
              context={{
                companyId,
                projectId: projectId ?? null,
                entityId: comment.id,
                entityТип: "comment",
                parentEntityId: comment.issueId,
              }}
              classИмя="flex flex-wrap items-center gap-1.5"
              itemClassИмя="inline-flex"
              missingBehavior="placeholder"
            />
          ) : null}
          {isОжидание ? (
            <span classИмя="text-xs text-muted-foreground">{isQueued ? "Queueing..." : "Отправитьing..."}</span>
          ) : (
            <a
              href={`#comment-${comment.id}`}
              classИмя="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {formatDateTime(comment.createdAt)}
            </a>
          )}
          <КопироватьMarkdownButton text={comment.body} />
        </span>
      </div>
      <MarkdownBody classИмя="text-sm" softBreaks>{comment.body}</MarkdownBody>
      {companyId && !isОжидание ? (
        <div classИмя="mt-2 space-y-2">
          <PluginSlotOutlet
            slotТипs={["commentAnnotation"]}
            entityТип="comment"
            context={{
              companyId,
              projectId: projectId ?? null,
              entityId: comment.id,
              entityТип: "comment",
              parentEntityId: comment.issueId,
            }}
            classИмя="space-y-2"
            itemClassИмя="rounded-md"
            missingBehavior="placeholder"
          />
        </div>
      ) : null}
      {comment.authorАгентId && onVote && !isQueued && !isОжидание ? (
        <OutputFeedbackButtons
          activeVote={feedbackVote}
          disabled={voting}
          sharingPreference={feedbackDataSharingPreference}
          termsUrl={feedbackTermsUrl}
          onVote={onVote}
          rightSlot={comment.runId && !isОжидание ? (
            comment.runАгентId ? (
              <Link
                to={`/agents/${comment.runАгентId}/runs/${comment.runId}`}
                classИмя="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                run {comment.runId.slice(0, 8)}
              </Link>
            ) : (
              <span classИмя="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                run {comment.runId.slice(0, 8)}
              </span>
            )
          ) : undefined}
        />
      ) : null}
      {comment.runId && !isОжидание && !(comment.authorАгентId && onVote && !isQueued) ? (
        <div classИмя="mt-3 pt-3 border-t border-border/60">
          {comment.runАгентId ? (
            <Link
              to={`/agents/${comment.runАгентId}/runs/${comment.runId}`}
              classИмя="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              run {comment.runId.slice(0, 8)}
            </Link>
          ) : (
            <span classИмя="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground">
              run {comment.runId.slice(0, 8)}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

type TimelineItem =
  | { kind: "comment"; id: string; createdAtMs: number; comment: CommentWithЗапуститьMeta }
  | { kind: "approval"; id: string; createdAtMs: number; approval: Согласование }
  | { kind: "event"; id: string; createdAtMs: number; event: ЗадачаTimelineEvent }
  | { kind: "run"; id: string; createdAtMs: number; run: LinkedЗапуститьItem };

function TimelineEventCard({
  event,
  agentMap,
  currentUserId,
}: {
  event: ЗадачаTimelineEvent;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
}) {
  const actorИмя = formatTimelineActorИмя(event.actorТип, event.actorId, agentMap, currentUserId);
  const actionLabel = event.followUpRequested ? "requested follow-up" : "updated this task";

  return (
    <div id={`activity-${event.id}`} classИмя="flex items-start gap-2.5 py-1.5">
      <Avatar size="sm" classИмя="mt-0.5">
        <AvatarFallback>{initialsForИмя(actorИмя)}</AvatarFallback>
      </Avatar>

      <div classИмя="min-w-0 flex-1 space-y-1.5">
        <div classИмя="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm">
          <span classИмя="font-medium text-foreground">{actorИмя}</span>
          <span classИмя="text-muted-foreground">{actionLabel}</span>
          <a
            href={`#activity-${event.id}`}
            classИмя="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            {timeAgo(event.createdAt)}
          </a>
        </div>

        {event.statusChange ? (
          <div classИмя="flex flex-wrap items-center gap-2 text-sm">
            <span classИмя="w-14 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Статус
            </span>
            <span classИмя="text-muted-foreground">
              {humanizeЗначение(event.statusChange.from)}
            </span>
            <ArrowRight classИмя="h-3.5 w-3.5 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">
              {humanizeЗначение(event.statusChange.to)}
            </span>
          </div>
        ) : null}

        {event.assigneeChange ? (
          <div classИмя="flex flex-wrap items-center gap-2 text-sm">
            <span classИмя="w-14 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Исполнитель
            </span>
            <span classИмя="text-muted-foreground">
              {formatTimelineИсполнительLabel(event.assigneeChange.from, agentMap, currentUserId)}
            </span>
            <ArrowRight classИмя="h-3.5 w-3.5 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">
              {formatTimelineИсполнительLabel(event.assigneeChange.to, agentMap, currentUserId)}
            </span>
          </div>
        ) : null}

        {event.workspaceChange ? (
          <div classИмя="flex flex-wrap items-center gap-2 text-sm">
            <span classИмя="w-14 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Рабочая область
            </span>
            <span classИмя="text-muted-foreground">
              {formatTimelineРабочая областьLabel(event.workspaceChange.from)}
            </span>
            <ArrowRight classИмя="h-3.5 w-3.5 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">
              {formatTimelineРабочая областьLabel(event.workspaceChange.to)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TimelineList = memo(function TimelineList({
  timeline,
  agentMap,
  currentUserId,
  companyId,
  projectId,
  onОдобритьСогласование,
  onОтклонитьСогласование,
  pendingСогласованиеAction,
  feedbackVoteByЦельId,
  feedbackDataSharingPreference = "prompt",
  feedbackTermsUrl = null,
  onVote,
  votingЦельId,
  highlightCommentId,
}: {
  timeline: TimelineItem[];
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  onОдобритьСогласование?: (approvalId: string) => Promise<void>;
  onОтклонитьСогласование?: (approvalId: string) => Promise<void>;
  pendingСогласованиеAction?: {
    approvalId: string;
    action: "approve" | "reject";
  } | null;
  feedbackVoteByЦельId?: Map<string, FeedbackVoteЗначение>;
  feedbackDataSharingPreference?: FeedbackDataSharingPreference;
  feedbackTermsUrl?: string | null;
  onVote?: (
    commentId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  votingЦельId?: string | null;
  highlightCommentId?: string | null;
}) {
  if (timeline.length === 0) {
    return <p classИмя="text-sm text-muted-foreground">Нет timeline entries yet.</p>;
  }

  return (
    <div classИмя="space-y-3">
      {timeline.map((item) => {
        if (item.kind === "event") {
          return (
            <TimelineEventCard
              key={`event:${item.event.id}`}
              event={item.event}
              agentMap={agentMap}
              currentUserId={currentUserId}
            />
          );
        }

        if (item.kind === "approval") {
          const approval = item.approval;
          const isОжидание = pendingСогласованиеAction?.approvalId === approval.id;
          return (
            <div id={`approval-${approval.id}`} key={`approval:${approval.id}`} classИмя="py-1.5">
              <СогласованиеCard
                approval={approval}
                requesterАгент={approval.requestedByАгентId ? agentMap?.get(approval.requestedByАгентId) ?? null : null}
                onОдобрить={onОдобритьСогласование ? () => void onОдобритьСогласование(approval.id) : undefined}
                onОтклонить={onОтклонитьСогласование ? () => void onОтклонитьСогласование(approval.id) : undefined}
                detailLink={`/approvals/${approval.id}`}
                isОжидание={isОжидание}
                pendingAction={isОжидание ? pendingСогласованиеAction?.action ?? null : null}
              />
            </div>
          );
        }

        if (item.kind === "run") {
          const run = item.run;
          const actorИмя = agentMap?.get(run.agentId)?.name ?? run.agentId.slice(0, 8);
          return (
            <div id={`run-${run.runId}`} key={`run:${run.runId}`} classИмя="flex items-center gap-2.5 py-1.5">
              <Avatar size="sm">
                <AvatarFallback>{initialsForИмя(actorИмя)}</AvatarFallback>
              </Avatar>

              <div classИмя="min-w-0 flex-1">
                <div classИмя="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                  <Link to={`/agents/${run.agentId}`} classИмя="font-medium text-foreground transition-colors hover:underline">
                    {actorИмя}
                  </Link>
                  <span classИмя="text-muted-foreground">run</span>
                  <Link
                    to={`/agents/${run.agentId}/runs/${run.runId}`}
                    classИмя="inline-flex items-center rounded-md border border-border bg-accent/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    {run.runId.slice(0, 8)}
                  </Link>
                  <span classИмя={cn("font-medium", runСтатусClass(run.status))}>
                    {formatЗапуститьСтатусLabel(run.status)}
                  </span>
                  <a
                    href={`#run-${run.runId}`}
                    classИмя="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    {timeAgo(runTimestamp(run))}
                  </a>
                </div>
              </div>
              {run.environment || run.environmentLease ? (
                <div classИмя="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {run.environment ? (
                    <span>
                      Окружение <span classИмя="text-foreground">{run.environment.name}</span>
                      <span> · {run.environment.driver}</span>
                    </span>
                  ) : null}
                  {run.environmentLease?.provider ? (
                    <span>
                      Провайдер <span classИмя="text-foreground">{run.environmentLease.provider}</span>
                    </span>
                  ) : null}
                  {run.environmentLease ? (
                    <span>
                      Lease{" "}
                      <span classИмя="font-mono text-foreground">
                        {run.environmentLease.id.slice(0, 8)}
                      </span>
                      <span> · {run.environmentLease.status}</span>
                    </span>
                  ) : null}
                  {run.environmentLease?.workspaceПуть ? (
                    <span classИмя="min-w-0 font-mono" style={{ overflowWrap: "anywhere" }}>
                      <BreakableПуть text={run.environmentLease.workspaceПуть} />
                    </span>
                  ) : null}
                  {run.environmentLease?.failureReason ? (
                    <span classИмя="text-destructive">
                      Failure: {run.environmentLease.failureReason}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        }

        const comment = item.comment;
        return (
          <CommentCard
            key={comment.id}
            comment={comment}
            agentMap={agentMap}
            companyId={companyId}
            projectId={projectId}
            feedbackVote={feedbackVoteByЦельId?.get(comment.id) ?? null}
            feedbackDataSharingPreference={feedbackDataSharingPreference}
            feedbackTermsUrl={feedbackTermsUrl}
            onVote={onVote ? (vote, options) => onVote(comment.id, vote, options) : undefined}
            voting={votingЦельId === comment.id}
            highlightCommentId={highlightCommentId}
          />
        );
      })}
    </div>
  );
});

export function CommentThread({
  comments,
  queuedКомментарии = [],
  linkedСогласования = [],
  feedbackVotes = [],
  feedbackDataSharingPreference = "prompt",
  feedbackTermsUrl = null,
  linkedЗапуститьs = [],
  timelineEvents = [],
  companyId,
  projectId,
  onОдобритьСогласование,
  onОтклонитьСогласование,
  pendingСогласованиеAction = null,
  onVote,
  onДобавить,
  issueСтатус,
  agentMap,
  currentUserId,
  imageЗагрузитьHandler,
  onAttachImage,
  draftКлюч,
  liveЗапуститьSlot,
  enableReassign = false,
  reassignOptions = [],
  currentИсполнительЗначение = "",
  suggestedИсполнительЗначение,
  mentions: providedMentions,
  onInterruptQueued,
  interruptingQueuedЗапуститьId = null,
  composerОтключитьdReason = null,
}: CommentThreadProps) {
  const [body, setBody] = useState("");
  const [submitting, setОтправитьting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const effectiveSuggestedИсполнительЗначение = suggestedИсполнительЗначение ?? currentИсполнительЗначение;
  const [reassignЦель, setReassignЦель] = useState(effectiveSuggestedИсполнительЗначение);
  const [highlightCommentId, setВысокийlightCommentId] = useState<string | null>(null);
  const [votingЦельId, setVotingЦельId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownИзменитьorRef>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const draftTimer = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const location = useLocation();
  const hasScrolledRef = useRef(false);

  const timeline = useMemo<TimelineItem[]>(() => {
    const followUpCommentIds = new Set(
      timelineEvents
        .filter((event) => event.followUpRequested && event.commentId)
        .map((event) => event.commentId as string),
    );
    const commentItems: TimelineItem[] = comments.map((comment) => {
      const followUpRequested = comment.followUpRequested === true || followUpCommentIds.has(comment.id);
      return {
        kind: "comment",
        id: comment.id,
        createdAtMs: new Date(comment.createdAt).getTime(),
        comment: followUpRequested ? { ...comment, followUpRequested } : comment,
      };
    });
    const approvalItems: TimelineItem[] = linkedСогласования.map((approval) => ({
      kind: "approval",
      id: approval.id,
      createdAtMs: new Date(approval.createdAt).getTime(),
      approval,
    }));
    const eventItems: TimelineItem[] = timelineEvents.map((event) => ({
      kind: "event",
      id: event.id,
      createdAtMs: new Date(event.createdAt).getTime(),
      event,
    }));
    const runItems: TimelineItem[] = linkedЗапуститьs.map((run) => ({
      kind: "run",
      id: run.runId,
      createdAtMs: new Date(runTimestamp(run)).getTime(),
      run,
    }));
    return [...commentItems, ...approvalItems, ...eventItems, ...runItems].sort((a, b) => {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      if (a.kind === b.kind) return a.id.localeCompare(b.id);
      const kindOrder = {
        event: 0,
        approval: 1,
        comment: 2,
        run: 3,
      } as const;
      return kindOrder[a.kind] - kindOrder[b.kind];
    });
  }, [comments, linkedСогласования, timelineEvents, linkedЗапуститьs]);

  const feedbackVoteByЦельId = useMemo(() => {
    const map = new Map<string, FeedbackVoteЗначение>();
    for (const feedbackVote of feedbackVotes) {
      if (feedbackVote.targetТип !== "issue_comment") continue;
      map.set(feedbackVote.targetId, feedbackVote.vote);
    }
    return map;
  }, [feedbackVotes]);

  // Build mention options from agent map (exclude terminated agents)
  const mentions = useMemo<MentionOption[]>(() => {
    if (providedMentions) return providedMentions;
    if (!agentMap) return [];
    return Array.from(agentMap.values())
      .filter((a) => a.status !== "terminated")
      .map((a) => ({
        id: `agent:${a.id}`,
        name: a.name,
        kind: "agent",
        agentId: a.id,
        agentIcon: a.icon,
      }));
  }, [agentMap, providedMentions]);

  useEffect(() => {
    if (!draftКлюч) return;
    setBody(loadЧерновик(draftКлюч));
  }, [draftКлюч]);

  useEffect(() => {
    if (!draftКлюч) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveЧерновик(draftКлюч, body);
    }, DRAFT_DEBOUNCE_MS);
  }, [body, draftКлюч]);

  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, []);

  useEffect(() => {
    setReassignЦель(effectiveSuggestedИсполнительЗначение);
  }, [effectiveSuggestedИсполнительЗначение]);

  // Scroll to comment when URL hash matches #comment-{id}
  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith("#comment-") || comments.length + queuedКомментарии.length === 0) return;
    const commentId = hash.slice("#comment-".length);
    // Only scroll once per hash
    if (hasScrolledRef.current) return;
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      hasScrolledRef.current = true;
      setВысокийlightCommentId(commentId);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Очистить highlight after animation
      const timer = setTimeout(() => setВысокийlightCommentId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.hash, comments, queuedКомментарии]);

  async function handleОтправить() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const hasReassignment = enableReassign && reassignЦель !== currentИсполнительЗначение;
    const reassignment = hasReassignment ? parseReassignment(reassignЦель) : null;
    const reopen = shouldImplicitlyReopenComment(
      issueСтатус,
      hasReassignment ? reassignЦель : currentИсполнительЗначение,
    ) ? true : undefined;
    const submittedBody = trimmed;

    setОтправитьting(true);
    setBody("");
    try {
      await onДобавить(submittedBody, reopen, reassignment ?? undefined);
      if (draftКлюч) clearЧерновик(draftКлюч);
      setReassignЦель(effectiveSuggestedИсполнительЗначение);
    } catch {
      setBody((current) =>
        restoreОтправитьtedCommentЧерновик({
          currentBody: current,
          submittedBody,
        }),
      );
      // Родитель mutation handlers surface the failure and the draft is restored for retry.
    } finally {
      setОтправитьting(false);
    }
  }

  async function handleAttachFile(evt: ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0];
    if (!file) return;
    setAttaching(true);
    try {
      if (imageЗагрузитьHandler) {
        const url = await imageЗагрузитьHandler(file);
        const safeИмя = file.name.replace(/[[\]]/g, "\\$&");
        const markdown = `![${safeИмя}](${url})`;
        setBody((prev) => prev ? `${prev}\n\n${markdown}` : markdown);
      } else if (onAttachImage) {
        await onAttachImage(file);
      }
    } finally {
      setAttaching(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  }

  async function handleFeedbackVote(
    commentId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) {
    if (!onVote) return;
    setVotingЦельId(commentId);
    try {
      await onVote(commentId, vote, options);
    } finally {
      setVotingЦельId(null);
    }
  }

  const canОтправить = !submitting && !!body.trim();

  return (
    <div classИмя="space-y-4">
      <h3 classИмя="text-sm font-semibold">Timeline ({timeline.length + queuedКомментарии.length})</h3>

      <TimelineList
        timeline={timeline}
        agentMap={agentMap}
        currentUserId={currentUserId}
        companyId={companyId}
        projectId={projectId}
        onОдобритьСогласование={onОдобритьСогласование}
        onОтклонитьСогласование={onОтклонитьСогласование}
        pendingСогласованиеAction={pendingСогласованиеAction}
        feedbackVoteByЦельId={feedbackVoteByЦельId}
        feedbackDataSharingPreference={feedbackDataSharingPreference}
        onVote={onVote ? handleFeedbackVote : undefined}
        votingЦельId={votingЦельId}
        highlightCommentId={highlightCommentId}
        feedbackTermsUrl={feedbackTermsUrl}
      />

      {liveЗапуститьSlot}

      {queuedКомментарии.length > 0 && (
        <div classИмя="space-y-3">
          <div classИмя="flex items-center justify-between gap-2">
            <h4 classИмя="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              Queued Комментарии ({queuedКомментарии.length})
            </h4>
            {onInterruptQueued && queuedКомментарии[0]?.queueЦельЗапуститьId ? (
              <Button
                size="sm"
                variant="outline"
                classИмя="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                disabled={interruptingQueuedЗапуститьId === queuedКомментарии[0].queueЦельЗапуститьId}
                onClick={() => void onInterruptQueued(queuedКомментарии[0]!.queueЦельЗапуститьId!)}
              >
                {interruptingQueuedЗапуститьId === queuedКомментарии[0].queueЦельЗапуститьId ? "Interrupting..." : "Interrupt"}
              </Button>
            ) : null}
          </div>
          <div classИмя="space-y-3">
            {queuedКомментарии.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                agentMap={agentMap}
                companyId={companyId}
                projectId={projectId}
                highlightCommentId={highlightCommentId}
                queued
              />
            ))}
          </div>
        </div>
      )}

      {composerОтключитьdReason ? (
        <div classИмя="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {composerОтключитьdReason}
        </div>
      ) : (
        <div classИмя="space-y-2">
          <MarkdownИзменитьor
            ref={editorRef}
            value={body}
            onChange={setBody}
            placeholder="Leave a comment..."
            mentions={mentions}
            onОтправить={handleОтправить}
            imageЗагрузитьHandler={imageЗагрузитьHandler}
            contentClassИмя="min-h-[60px] text-sm"
          />
          <div classИмя="flex items-center justify-end gap-3">
            {(imageЗагрузитьHandler || onAttachImage) && (
              <div classИмя="mr-auto flex items-center gap-3">
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  classИмя="hidden"
                  onChange={handleAttachFile}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={attaching}
                  title="Attach image"
                >
                  <Paperclip classИмя="h-4 w-4" />
                </Button>
              </div>
            )}
            {enableReassign && reassignOptions.length > 0 && (
              <InlineEntitySelector
                value={reassignЦель}
                options={reassignOptions}
                placeholder="Исполнитель"
                noneLabel="Нет assignee"
                searchPlaceholder="Поиск assignees..."
                emptyMessage="Нет assignees found."
                onChange={setReassignЦель}
                classИмя="text-xs h-8"
                renderTriggerЗначение={(option) => {
                  if (!option) return <span classИмя="text-muted-foreground">Исполнитель</span>;
                  const agentId = option.id.startsWith("agent:") ? option.id.slice("agent:".length) : null;
                  const agent = agentId ? agentMap?.get(agentId) : null;
                  return (
                    <>
                      {agent ? (
                        <АгентIcon icon={agent.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
                renderOption={(option) => {
                  if (!option.id) return <span classИмя="truncate">{option.label}</span>;
                  const agentId = option.id.startsWith("agent:") ? option.id.slice("agent:".length) : null;
                  const agent = agentId ? agentMap?.get(agentId) : null;
                  return (
                    <>
                      {agent ? (
                        <АгентIcon icon={agent.icon} classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                      <span classИмя="truncate">{option.label}</span>
                    </>
                  );
                }}
              />
            )}
            <Button size="sm" disabled={!canОтправить} onClick={handleОтправить}>
              {submitting ? "Posting..." : "Comment"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
