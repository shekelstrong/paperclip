import {
  AssistantЗапуститьtimeПровайдер,
  useAui,
} from "@assistant-ui/react";
import type {
  ReasoningMessagePart,
  TextMessagePart,
  ThreadMessage,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import {
  createContext,
  Component,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type ОшибкаInfo,
  type Ref,
  type ReactНетde,
} from "react";
import { Link, useLocation } from "@/lib/router";
import type {
  Агент,
  FeedbackDataSharingPreference,
  FeedbackVote,
  FeedbackVoteЗначение,
  ЗадачаAttachment,
  ЗадачаBlockerAttention,
  ЗадачаRelationЗадачаSummary,
  УспешноfulЗапуститьHandoffState,
  ЗадачаРаботаMode,
} from "@paperclipai/shared";
import type { АктивенЗапуститьForЗадача, LiveЗапуститьForЗадача } from "../api/heartbeats";
import { useLiveЗапуститьTranscripts } from "./transcript/useLiveЗапуститьTranscripts";
import { usePaperclipЗадачаЗапуститьtime, type PaperclipЗадачаЗапуститьtimeReassignment } from "../hooks/usePaperclipЗадачаЗапуститьtime";
import {
  buildЗадачаChatMessages,
  formatDurationWords,
  stabilizeThreadMessages,
  type ЗадачаChatComment,
  type ЗадачаChatLinkedЗапустить,
  type StableThreadMessageCacheEntry,
  type ЗадачаChatTranscriptEntry,
  type SegmentTiming,
} from "../lib/issue-chat-messages";
import type {
  AskUserQuestionsAnswer,
  AskUserQuestionsInteraction,
  ЗадачаThreadInteraction,
  RequestПодтвердитьationInteraction,
  SuggestЗадачиInteraction,
} from "../lib/issue-thread-interactions";
import { buildЗадачаThreadInteractionSummary, isЗадачаThreadInteraction } from "../lib/issue-thread-interactions";
import { resolveЗадачаChatTranscriptЗапуститьs } from "../lib/issueChatTranscriptЗапуститьs";
import {
  formatTimelineРабочая областьLabel,
  type ЗадачаTimelineИсполнитель,
  type ЗадачаTimelineEvent,
  type ЗадачаTimelineРабочая область,
} from "../lib/issue-timeline-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownИзменитьor, type MentionOption, type MarkdownИзменитьorRef } from "./MarkdownИзменитьor";
import { Identity } from "./Identity";
import { InlineEntitySelector, type InlineEntityOption } from "./InlineEntitySelector";
import { ЗадачаThreadInteractionCard } from "./ЗадачаThreadInteractionCard";
import { АгентIcon } from "./АгентIconPicker";
import { restoreОтправитьtedCommentЧерновик } from "../lib/comment-submit-draft";
import {
  captureComposerViewportSnapshot,
  restoreComposerViewportSnapshot,
  shouldPreserveComposerViewport,
} from "../lib/issue-chat-scroll";
import { formatИсполнительUserLabel } from "../lib/assignees";
import { useОпциональноToastActions } from "../context/ToastContext";
import type { КомпанияUserПрофиль } from "../lib/company-members";
import { timeAgo } from "../lib/timeAgo";
import {
  isУспешноfulЗапуститьHandoffComment,
  isУспешноfulЗапуститьHandoffEscalationComment,
} from "../lib/successful-run-handoff";
import {
  SystemНетtice,
  type SystemНетticeMetadataRow,
  type SystemНетticeMetadataSection,
} from "./SystemНетtice";
import {
  buildSystemНетticeProps,
  mapCommentMetadataToSystemНетticeSections,
} from "../lib/system-notice-comment";
import type {
  ЗадачаCommentMetadata,
  ЗадачаCommentPresentation,
} from "@paperclipai/shared";
import {
  describeToolInput,
  displayToolИмя,
  formatToolPayload,
  isКомандаTool,
  parseToolPayload,
  summarizeToolInput,
  summarizeToolResult,
} from "../lib/transcriptPresentation";
import { cn, formatDateTime, formatShortDate } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowRight, Brain, Check, ChevronDown, ClipboardList, Копировать, Hammer, Loader2, MoreHorizontal, Paperclip, ПаузаCircle, Поиск, Square, ThumbsDown, ThumbsUp } from "lucide-react";
import { ЗадачаЗаблокированНетtice } from "./ЗадачаЗаблокированНетtice";
import { ЗадачаAssignedНазадlogНетtice } from "./ЗадачаAssignedНазадlogНетtice";

interface ЗадачаChatMessageContext {
  feedbackDataSharingPreference: FeedbackDataSharingPreference;
  feedbackTermsUrl: string | null;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  userПрофильMap?: ReadonlyMap<string, КомпанияUserПрофиль> | null;
  onVote?: (
    commentId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  onОстановитьЗапустить?: (runId: string) => Promise<void>;
  stopЗапуститьLabel?: string;
  stoppingЗапуститьLabel?: string;
  stopЗапуститьVariant?: "stop" | "pause";
  onInterruptQueued?: (runId: string) => Promise<void>;
  onОтменаQueued?: (commentId: string) => void;
  onImageClick?: (src: string) => void;
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
  issueСтатус?: string;
  successfulЗапуститьHandoff?: УспешноfulЗапуститьHandoffState | null;
}

const ЗадачаChatCtx = createContext<ЗадачаChatMessageContext>({
  feedbackDataSharingPreference: "prompt",
  feedbackTermsUrl: null,
  issueСтатус: undefined,
  successfulЗапуститьHandoff: null,
});

export function resolveAssistantMessageFoldedState(args: {
  messageId: string;
  currentFolded: boolean;
  isFoldable: boolean;
  previousMessageId: string | null;
  previousIsFoldable: boolean;
}) {
  const {
    messageId,
    currentFolded,
    isFoldable,
    previousMessageId,
    previousIsFoldable,
  } = args;

  if (messageId !== previousMessageId) return isFoldable;
  if (!isFoldable) return false;
  if (!previousIsFoldable) return true;
  return currentFolded;
}

export function canОстановитьЗадачаChatЗапустить(args: {
  runId: string | null;
  runСтатус: string | null;
  activeЗапуститьIds: ReadonlySet<string>;
}) {
  const { runId, runСтатус, activeЗапуститьIds } = args;
  if (!runId) return false;
  if (activeЗапуститьIds.has(runId)) return true;
  return runСтатус === "queued" || runСтатус === "running";
}

function findCoTSegmentIndex(
  messageParts: ReadonlyArray<{ type: string }>,
  cotParts: ReadonlyArray<{ type: string }>,
): number {
  if (cotParts.length === 0) return -1;
  const firstPart = cotParts[0];
  let segIdx = -1;
  let inCoT = false;
  for (const part of messageParts) {
    if (part.type === "reasoning" || part.type === "tool-call") {
      if (!inCoT) { segIdx++; inCoT = true; }
      if (part === firstPart) return segIdx;
    } else {
      inCoT = false;
    }
  }
  return -1;
}

function useLiveElapsed(startMs: number | null | undefined, active: boolean): string | null {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!active || !startMs) return;
    const interval = setInterval(() => rerender((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [active, startMs]);
  if (!active || !startMs) return null;
  return formatDurationWords(Date.now() - startMs);
}

function useStableEvent<T extends (...args: never[]) => unknown>(callback: T | undefined): T | undefined {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(() => {
    if (!callback) return undefined;
    return ((...args: Parameters<T>) => callbackRef.current?.(...args)) as T;
    // Keep the wrapper stable while the callback identity changes; the ref above
    // carries the current callback implementation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(callback)]);
}

interface CommentReassignment {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
}

export interface ЗадачаChatComposerHandle {
  focus: () => void;
  restoreЧерновик: (submittedBody: string) => void;
}

interface ЗадачаChatComposerProps {
  onImageЗагрузить?: (file: File) => Promise<string>;
  onAttachImage?: (file: File) => Promise<ЗадачаAttachment | void>;
  draftКлюч?: string;
  enableReassign?: boolean;
  reassignOptions?: InlineEntityOption[];
  currentИсполнительЗначение?: string;
  suggestedИсполнительЗначение?: string;
  mentions?: MentionOption[];
  agentMap?: Map<string, Агент>;
  composerОтключитьdReason?: string | null;
  composerHint?: string | null;
  issueСтатус?: string;
  issueРаботаMode?: ЗадачаРаботаMode;
  onРаботаModeChange?: (workMode: ЗадачаРаботаMode) => Promise<void> | void;
}

interface ЗадачаChatThreadProps {
  comments: ЗадачаChatComment[];
  interactions?: ЗадачаThreadInteraction[];
  feedbackVotes?: FeedbackVote[];
  feedbackDataSharingPreference?: FeedbackDataSharingPreference;
  feedbackTermsUrl?: string | null;
  linkedЗапуститьs?: ЗадачаChatLinkedЗапустить[];
  timelineEvents?: ЗадачаTimelineEvent[];
  liveЗапуститьs?: LiveЗапуститьForЗадача[];
  activeЗапустить?: АктивенЗапуститьForЗадача | null;
  blockedBy?: ЗадачаRelationЗадачаSummary[];
  blockerAttention?: ЗадачаBlockerAttention | null;
  successfulЗапуститьHandoff?: УспешноfulЗапуститьHandoffState | null;
  assigneeUserId?: string | null;
  onПродолжитьFromНазадlog?: () => Promise<void> | void;
  resumeFromНазадlogОжидание?: boolean;
  companyId?: string | null;
  projectId?: string | null;
  issueСтатус?: string;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
  userПрофильMap?: ReadonlyMap<string, КомпанияUserПрофиль> | null;
  onVote?: (
    commentId: string,
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  onДобавить: (body: string, reopen?: boolean, reassignment?: CommentReassignment) => Promise<void>;
  onОтменаЗапустить?: () => Promise<void>;
  onОстановитьЗапустить?: (runId: string) => Promise<void>;
  stopЗапуститьLabel?: string;
  stoppingЗапуститьLabel?: string;
  stopЗапуститьVariant?: "stop" | "pause";
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
  onAttachImage?: (file: File) => Promise<ЗадачаAttachment | void>;
  draftКлюч?: string;
  enableReassign?: boolean;
  reassignOptions?: InlineEntityOption[];
  currentИсполнительЗначение?: string;
  suggestedИсполнительЗначение?: string;
  mentions?: MentionOption[];
  composerОтключитьdReason?: string | null;
  composerHint?: string | null;
  onРаботаModeChange?: (workMode: ЗадачаРаботаMode) => Promise<void> | void;
  showComposer?: boolean;
  showJumpToLatest?: boolean;
  emptyMessage?: string;
  variant?: "full" | "embedded";
  enableLiveTranscriptPolling?: boolean;
  transcriptsByЗапуститьId?: ReadonlyMap<string, readonly ЗадачаChatTranscriptEntry[]>;
  hasOutputForЗапустить?: (runId: string) => boolean;
  includeSucceededЗапуститьsWithoutOutput?: boolean;
  onInterruptQueued?: (runId: string) => Promise<void>;
  onОтменаQueued?: (commentId: string) => void;
  interruptingQueuedЗапуститьId?: string | null;
  stoppingЗапуститьId?: string | null;
  onImageClick?: (src: string) => void;
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
  composerRef?: Ref<ЗадачаChatComposerHandle>;
  issueРаботаMode?: ЗадачаРаботаMode;
  /**
   * Hook for the parent to refetch comments when the user explicitly asks
   * to jump to the latest comment. Used to make sure the absolute newest
   * comment is in the loaded set before we scroll to it.
   */
  onОбновитьLatestКомментарии?: () => Promise<unknown> | void;
}

type ЗадачаChatОшибкаBoundaryProps = {
  resetКлюч: string;
  messages: readonly ThreadMessage[];
  emptyMessage: string;
  variant: "full" | "embedded";
  children: ReactНетde;
};

type ЗадачаChatОшибкаBoundaryState = {
  hasОшибка: boolean;
};

class ЗадачаChatОшибкаBoundary extends Component<ЗадачаChatОшибкаBoundaryProps, ЗадачаChatОшибкаBoundaryState> {
  override state: ЗадачаChatОшибкаBoundaryState = { hasОшибка: false };

  static getDerivedStateFromОшибка(): ЗадачаChatОшибкаBoundaryState {
    return { hasОшибка: true };
  }

  override componentDidCatch(error: unknown, info: ОшибкаInfo): void {
    console.error("Задача chat renderer failed; falling back to safe transcript view", {
      error,
      info: info.componentStack,
    });
  }

  override componentDidОбновить(prevProps: ЗадачаChatОшибкаBoundaryProps): void {
    if (this.state.hasОшибка && prevProps.resetКлюч !== this.props.resetКлюч) {
      this.setState({ hasОшибка: false });
    }
  }

  override render() {
    if (this.state.hasОшибка) {
      return (
        <ЗадачаChatFallbackThread
          messages={this.props.messages}
          emptyMessage={this.props.emptyMessage}
          variant={this.props.variant}
        />
      );
    }
    return this.props.children;
  }
}

function ЗадачаИсполнительПриостановленНетtice({ agent }: { agent: Агент | null }) {
  if (!agent || agent.status !== "paused") return null;

  const pauseDetail =
    agent.pauseReason === "budget"
      ? "It was paused by a budget hard stop."
      : agent.pauseReason === "system"
        ? "It was paused by the system."
        : "It was paused manually.";

  return (
    <div classИмя="mb-3 rounded-md border border-orange-300/70 bg-orange-50/90 px-3 py-2.5 text-sm text-orange-950 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-100">
      <div classИмя="flex items-start gap-2">
        <ПаузаCircle classИмя="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-300" />
        <p classИмя="min-w-0 leading-5">
          <span classИмя="font-medium">{agent.name}</span> is paused. New runs will not start until the agent is resumed. {pauseDetail}
        </p>
      </div>
    </div>
  );
}

function fallbackAuthorLabel(message: ThreadMessage) {
  const custom = message.metadata?.custom as Record<string, unknown> | undefined;
  if (typeof custom?.["authorИмя"] === "string") return custom["authorИмя"];
  if (typeof custom?.["runАгентИмя"] === "string") return custom["runАгентИмя"];
  if (message.role === "assistant") return "Агент";
  if (message.role === "user") return "You";
  return "System";
}

function fallbackTextParts(message: ThreadMessage) {
  const contentLines: string[] = [];
  for (const part of message.content) {
    if (part.type === "text" || part.type === "reasoning") {
      if (part.text.trim().length > 0) contentLines.push(part.text);
      continue;
    }
    if (part.type === "tool-call") {
      const lines = [`Tool: ${part.toolИмя}`];
      if (part.argsText?.trim()) lines.push(`Args:\n${part.argsText}`);
      if (typeof part.result === "string" && part.result.trim()) lines.push(`Result:\n${part.result}`);
      contentLines.push(lines.join("\n\n"));
    }
  }

  const custom = message.metadata?.custom as Record<string, unknown> | undefined;
  if (contentLines.length === 0 && typeof custom?.["waitingText"] === "string" && custom["waitingText"].trim()) {
    contentLines.push(custom["waitingText"]);
  }
  return contentLines;
}

function ЗадачаChatFallbackThread({
  messages,
  emptyMessage,
  variant,
}: {
  messages: readonly ThreadMessage[];
  emptyMessage: string;
  variant: "full" | "embedded";
}) {
  return (
    <div classИмя={cn(variant === "embedded" ? "space-y-3" : "space-y-4")}>
      <div classИмя="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
        <div classИмя="flex items-start gap-2">
          <AlertTriangle classИмя="mt-0.5 h-4 w-4 shrink-0" />
          <div classИмя="space-y-1">
            <p classИмя="font-medium">Chat renderer hit an internal state error.</p>
            <p classИмя="text-xs opacity-80">
              Showing a safe fallback transcript instead of crashing the issues page.
            </p>
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <div classИмя={cn(
          "text-center text-sm text-muted-foreground",
          variant === "embedded"
            ? "rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6"
            : "rounded-2xl border border-dashed border-border bg-card px-6 py-10",
        )}>
          {emptyMessage}
        </div>
      ) : (
        <div classИмя={cn(variant === "embedded" ? "space-y-3" : "space-y-4")}>
          {messages.map((message) => {
            const lines = fallbackTextParts(message);
            return (
              <div key={message.id} classИмя="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
                <div classИмя="mb-2 flex items-center gap-2 text-sm">
                  <span classИмя="font-medium text-foreground">{fallbackAuthorLabel(message)}</span>
                  {message.createdAt ? (
                    <span classИмя="text-[11px] text-muted-foreground">
                      {commentDateLabel(message.createdAt)}
                    </span>
                  ) : null}
                </div>
                <div classИмя="space-y-2">
                  {lines.length > 0 ? lines.map((line, index) => (
                    <MarkdownBody key={`${message.id}:fallback:${index}`}>{line}</MarkdownBody>
                  )) : (
                    <p classИмя="text-sm text-muted-foreground">Нет message content.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DRAFT_DEBOUNCE_MS = 800;
const COMPOSER_FOCUS_SCROLL_PADDING_PX = 96;
const SUBMIT_SCROLL_RESERVE_VH = 0.4;

type ComposerAttachmentItem = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "attached" | "error";
  inline: boolean;
  contentПуть?: string;
  error?: string;
};

function hasFilePayload(evt: ReactDragEvent<HTMLDivElement>) {
  return Array.from(evt.dataTransfer?.types ?? []).includes("Файлы");
}

function formatAttachmentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

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

function parseReassignment(target: string): PaperclipЗадачаЗапуститьtimeReassignment | null {
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

function isНе назначенReassignЗначение(value: string): boolean {
  return !value || value === "__none__";
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function commentDateLabel(date: Date | string | undefined): string {
  if (!date) return "";
  const then = new Date(date).getTime();
  if (Date.now() - then < WEEK_MS) return timeAgo(date);
  return formatShortDate(date);
}

const ЗадачаChatTextPart = memo(function ЗадачаChatTextPart({ text, recessed }: { text: string; recessed?: boolean }) {
  const { onImageClick } = useContext(ЗадачаChatCtx);
  if (isУспешноfulЗапуститьHandoffComment(text)) {
    return <УспешноfulЗапуститьHandoffCommentCallout text={text} recessed={recessed} onImageClick={onImageClick} />;
  }
  return (
    <MarkdownBody
      classИмя="text-sm leading-6"
      style={recessed ? { opacity: 0.55 } : undefined}
      softBreaks
      onImageClick={onImageClick}
    >
      {text}
    </MarkdownBody>
  );
});

export function УспешноfulЗапуститьHandoffCommentCallout({
  text,
  recessed,
  onImageClick,
}: {
  text: string;
  recessed?: boolean;
  onImageClick?: (src: string) => void;
}) {
  const escalated = isУспешноfulЗапуститьHandoffEscalationComment(text);
  return (
    <div
      classИмя={cn(
        "rounded-md border px-3 py-2.5 text-sm shadow-sm",
        escalated
          ? "border-red-500/35 bg-red-500/10 text-red-950 dark:text-red-100"
          : "border-amber-300/70 bg-amber-50/90 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
      )}
      style={recessed ? { opacity: 0.55 } : undefined}
    >
      <div classИмя="flex items-start gap-2">
        <AlertTriangle
          classИмя={cn(
            "mt-1 h-4 w-4 shrink-0",
            escalated ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300",
          )}
        />
        <MarkdownBody classИмя="min-w-0 text-sm leading-6" softBreaks onImageClick={onImageClick}>
          {text}
        </MarkdownBody>
      </div>
    </div>
  );
}

function humanizeЗначение(value: string | null) {
  if (!value) return "Нет";
  return value.replace(/_/g, " ");
}

function formatTimelineИсполнительLabel(
  assignee: ЗадачаTimelineИсполнитель,
  agentMap?: Map<string, Агент>,
  currentUserId?: string | null,
  userLabelMap?: ReadonlyMap<string, string> | null,
) {
  if (assignee.agentId) {
    return agentMap?.get(assignee.agentId)?.name ?? assignee.agentId.slice(0, 8);
  }
  if (assignee.userId) {
    return formatИсполнительUserLabel(assignee.userId, currentUserId, userLabelMap) ?? "Совет";
  }
  return "Не назначен";
}

function initialsForИмя(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatInteractionActorLabel(args: {
  agentId?: string | null;
  userId?: string | null;
  agentMap?: Map<string, Агент>;
  currentUserId?: string | null;
  userLabelMap?: ReadonlyMap<string, string> | null;
}) {
  const { agentId, userId, agentMap, currentUserId, userLabelMap } = args;
  if (agentId) return agentMap?.get(agentId)?.name ?? agentId.slice(0, 8);
  if (userId) {
    return userLabelMap?.get(userId)
      ?? formatИсполнительUserLabel(userId, currentUserId, userLabelMap)
      ?? "Совет";
  }
  return "System";
}

export function resolveЗадачаChatЧеловекAuthor(args: {
  authorИмя?: string | null;
  authorUserId?: string | null;
  currentUserId?: string | null;
  userПрофильMap?: ReadonlyMap<string, КомпанияUserПрофиль> | null;
}) {
  const { authorИмя, authorUserId, currentUserId, userПрофильMap } = args;
  const profile = authorUserId ? userПрофильMap?.get(authorUserId) ?? null : null;
  const isCurrentUser = Boolean(authorUserId && currentUserId && authorUserId === currentUserId);
  const resolvedAuthorИмя = profile?.label?.trim()
    || authorИмя?.trim()
    || (authorUserId === "local-board" ? "Совет" : (isCurrentUser ? "You" : "User"));

  return {
    isCurrentUser,
    authorИмя: resolvedAuthorИмя,
    avatarUrl: profile?.image ?? null,
  };
}

function formatЗапуститьСтатусLabel(status: string) {
  switch (status) {
    case "timed_out":
      return "timed out";
    default:
      return status.replace(/_/g, " ");
  }
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

function toolCountSummary(toolParts: ToolCallMessagePart[]): string | null {
  if (toolParts.length === 0) return null;
  let commands = 0;
  let other = 0;
  for (const tool of toolParts) {
    if (isКомандаTool(tool.toolИмя, tool.args)) commands++;
    else other++;
  }
  const parts: string[] = [];
  if (commands > 0) parts.push(`ran ${commands} command${commands === 1 ? "" : "s"}`);
  if (other > 0) parts.push(`called ${other} tool${other === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function cleanToolDisplayText(tool: ToolCallMessagePart): string {
  const name = displayToolИмя(tool.toolИмя, tool.args);
  if (isКомандаTool(tool.toolИмя, tool.args)) return name;
  const summary = tool.result === undefined
    ? summarizeToolInput(tool.toolИмя, tool.args)
    : null;
  return summary ? `${name} ${summary}` : name;
}

type ЗадачаChatCoTPart = ReasoningMessagePart | ToolCallMessagePart;

function ЗадачаChatChainOfThought({
  message,
  cotParts,
}: {
  message: ThreadMessage;
  cotParts: readonly ЗадачаChatCoTPart[];
}) {
  const { agentMap } = useContext(ЗадачаChatCtx);
  const custom = message.metadata.custom as Record<string, unknown>;
  const runАгентId = typeof custom.runАгентId === "string" ? custom.runАгентId : null;
  const authorАгентId = typeof custom.authorАгентId === "string" ? custom.authorАгентId : null;
  const agentId = authorАгентId ?? runАгентId;
  const agentIcon = agentId ? agentMap?.get(agentId)?.icon : undefined;
  const isMessageВыполняется = message.role === "assistant" && message.status?.type === "running";

  const myIndex = useMemo(
    () => findCoTSegmentIndex(message.content, cotParts),
    [message.content, cotParts],
  );

  const allReasoningText = cotParts
    .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning" && !!p.text)
    .map((p) => p.text)
    .join("\n");
  const toolParts = cotParts.filter(
    (p): p is ToolCallMessagePart => p.type === "tool-call",
  );

  const isАктивен = isMessageВыполняется;
  const [expanded, setExpanded] = useState(isАктивен);

  const rawSegments = Array.isArray(custom.chainOfThoughtSegments)
    ? (custom.chainOfThoughtSegments as SegmentTiming[])
    : [];
  const segmentTiming = myIndex >= 0 ? rawSegments[myIndex] ?? null : null;
  const liveElapsed = useLiveElapsed(segmentTiming?.startMs, isАктивен);

  useEffect(() => {
    if (isАктивен) setExpanded(true);
  }, [isАктивен]);

  let headerVerb: string;
  let headerSuffix: string | null = null;
  if (isАктивен) {
    headerVerb = "Работаing";
    if (liveElapsed) headerSuffix = `for ${liveElapsed}`;
  } else if (segmentTiming) {
    const durationMs = segmentTiming.endMs - segmentTiming.startMs;
    const durationText = formatDurationWords(durationMs);
    headerVerb = "Работаed";
    if (durationText) headerSuffix = `for ${durationText}`;
  } else {
    headerVerb = "Работаed";
  }

  const toolSummary = toolCountSummary(toolParts);
  const hasContent = allReasoningText.trim().length > 0 || toolParts.length > 0;

  return (
    <div>
      <button
        type="button"
        classИмя="group flex w-full items-center gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-accent/5"
        onClick={() => hasContent && setExpanded((v) => !v)}
      >
        <span classИмя="inline-flex items-center gap-2 text-sm font-medium text-foreground/80">
          {agentIcon ? (
            <АгентIcon icon={agentIcon} classИмя="h-4 w-4 shrink-0" />
          ) : isАктивен ? (
            <Loader2 classИмя="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center">
              <span classИмя="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
            </span>
          )}
          {isАктивен ? (
            <span classИмя="shimmer-text">{headerVerb}</span>
          ) : (
            headerVerb
          )}
        </span>
        {headerSuffix ? (
          <span classИмя="text-xs text-muted-foreground/60">{headerSuffix}</span>
        ) : null}
        {toolSummary ? (
          <span classИмя="text-xs text-muted-foreground/40">· {toolSummary}</span>
        ) : null}
        {hasContent ? (
          <ChevronDown classИмя={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform", expanded && "rotate-180")} />
        ) : null}
      </button>
      {expanded && hasContent ? (
        <div classИмя="space-y-1 py-1">
          {isАктивен ? (
            <>
              {allReasoningText ? <ЗадачаChatReasoningPart text={allReasoningText} /> : null}
              {toolParts.length > 0 ? <ЗадачаChatRollingToolPart toolParts={toolParts} /> : null}
            </>
          ) : (
            <>
              {allReasoningText ? <ЗадачаChatReasoningPart text={allReasoningText} /> : null}
              {toolParts.map((tool) => (
                <ЗадачаChatToolPart
                  key={tool.toolCallId}
                  toolИмя={tool.toolИмя}
                  args={tool.args}
                  argsText={tool.argsText}
                  result={tool.result}
                  isОшибка={false}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ЗадачаChatReasoningPart({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const lastLine = lines[lines.length - 1] ?? text.slice(-200);
  const prevRef = useRef(lastLine);
  const [ticker, setTicker] = useState<{
    key: number;
    current: string;
    exiting: string | null;
  }>({ key: 0, current: lastLine, exiting: null });

  useEffect(() => {
    if (lastLine !== prevRef.current) {
      const prev = prevRef.current;
      prevRef.current = lastLine;
      setTicker((t) => ({ key: t.key + 1, current: lastLine, exiting: prev }));
    }
  }, [lastLine]);

  return (
    <div classИмя="flex gap-2 px-1">
      <div classИмя="flex flex-col items-center pt-0.5">
        <Brain classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </div>
      <div classИмя="relative h-5 min-w-0 flex-1 overflow-hidden">
        {ticker.exiting !== null && (
          <span
            key={`out-${ticker.key}`}
            classИмя="cot-line-exit absolute inset-x-0 truncate text-[13px] italic leading-5 text-muted-foreground/70"
            onAnimationEnd={() => setTicker((t) => ({ ...t, exiting: null }))}
          >
            {ticker.exiting}
          </span>
        )}
        <span
          key={`in-${ticker.key}`}
          classИмя={cn(
            "absolute inset-x-0 truncate text-[13px] italic leading-5 text-muted-foreground/70",
            ticker.key > 0 && "cot-line-enter",
          )}
        >
          {ticker.current}
        </span>
      </div>
    </div>
  );
}

function ЗадачаChatRollingToolPart({ toolParts }: { toolParts: ToolCallMessagePart[] }) {
  const latest = toolParts[toolParts.length - 1];
  if (!latest) return null;

  const fullText = cleanToolDisplayText(latest);

  const prevRef = useRef(fullText);
  const [ticker, setTicker] = useState<{
    key: number;
    current: string;
    exiting: string | null;
  }>({ key: 0, current: fullText, exiting: null });

  useEffect(() => {
    if (fullText !== prevRef.current) {
      const prev = prevRef.current;
      prevRef.current = fullText;
      setTicker((t) => ({ key: t.key + 1, current: fullText, exiting: prev }));
    }
  }, [fullText]);

  const ToolIcon = getToolIcon(latest.toolИмя);
  const isВыполняется = latest.result === undefined;

  return (
    <div classИмя="flex gap-2 px-1">
      <div classИмя="flex flex-col items-center pt-0.5">
        {isВыполняется ? (
          <Loader2 classИмя="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/50" />
        ) : (
          <ToolIcon classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        )}
      </div>
      <div classИмя="relative h-5 min-w-0 flex-1 overflow-hidden">
        {ticker.exiting !== null && (
          <span
            key={`out-${ticker.key}`}
            classИмя="cot-line-exit absolute inset-x-0 truncate text-[13px] leading-5 text-muted-foreground/70"
            onAnimationEnd={() => setTicker((t) => ({ ...t, exiting: null }))}
          >
            {ticker.exiting}
          </span>
        )}
        <span
          key={`in-${ticker.key}`}
          classИмя={cn(
            "absolute inset-x-0 truncate text-[13px] leading-5 text-muted-foreground/70",
            ticker.key > 0 && "cot-line-enter",
          )}
        >
          {ticker.current}
        </span>
      </div>
    </div>
  );
}

function КопироватьablePreBlock({ children, classИмя }: { children: string; classИмя?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div classИмя="group/pre relative">
      <pre classИмя={classИмя}>{children}</pre>
      <button
        type="button"
        classИмя={cn(
          "absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground group-hover/pre:opacity-100",
          copied && "opacity-100",
        )}
        title="Копировать"
        aria-label="Копировать"
        onClick={() => {
          void navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? <Check classИмя="h-3 w-3" /> : <Копировать classИмя="h-3 w-3" />}
      </button>
    </div>
  );
}

const TOOL_ICON_MAP: Record<string, React.ComponentТип<{ classИмя?: string }>> = {
  // Extend with specific tool icons as they become known
};

function getToolIcon(toolИмя: string): React.ComponentТип<{ classИмя?: string }> {
  return TOOL_ICON_MAP[toolИмя] ?? Hammer;
}

function ЗадачаChatToolPart({
  toolИмя,
  args,
  argsText,
  result,
  isОшибка,
}: {
  toolИмя: string;
  args?: unknown;
  argsText?: string;
  result?: unknown;
  isОшибка?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rawArgsText = argsText ?? "";
  const parsedArgs = args ?? parseToolPayload(rawArgsText);
  const resultText =
    typeof result === "string"
      ? result
      : result === undefined
        ? ""
        : formatToolPayload(result);
  const inputДетали = describeToolInput(toolИмя, parsedArgs);
  const displayИмя = displayToolИмя(toolИмя, parsedArgs);
  const isКоманда = isКомандаTool(toolИмя, parsedArgs);
  const summary = isКоманда
    ? null
    : result === undefined
      ? summarizeToolInput(toolИмя, parsedArgs)
      : summarizeToolResult(resultText, false);
  const ToolIcon = getToolIcon(toolИмя);

  const intentDetail = inputДетали.find((d) => d.label === "Intent");
  const title = intentDetail?.value ?? displayИмя;
  const nonIntentДетали = inputДетали.filter((d) => d.label !== "Intent");

  return (
    <div classИмя="flex gap-2 px-1">
      <div classИмя="flex flex-col items-center pt-1">
        <ToolIcon classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        {open ? <div classИмя="mt-1 w-px flex-1 bg-border/40" /> : null}
      </div>

      <div classИмя="min-w-0 flex-1">
        <button
          type="button"
          classИмя="flex w-full items-center gap-2 rounded-md py-0.5 text-left transition-colors hover:bg-accent/5"
          onClick={() => setOpen((current) => !current)}
        >
          <span classИмя="min-w-0 flex-1 truncate text-[13px] text-muted-foreground/80">
            {title}
            {!intentDetail && summary ? <span classИмя="ml-1.5 text-muted-foreground/50">{summary}</span> : null}
          </span>
          {result === undefined ? (
            <Loader2 classИмя="h-3 w-3 shrink-0 animate-spin text-muted-foreground/50" />
          ) : null}
          <ChevronDown classИмя={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
        </button>

        {open ? (
          <div classИмя="mt-1 space-y-2 pb-1">
            {nonIntentДетали.length > 0 ? (
              <div>
                <div classИмя="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                  Input
                </div>
                <dl classИмя="space-y-1.5">
                  {nonIntentДетали.map((detail) => (
                    <div key={`${detail.label}:${detail.value}`}>
                      <dt classИмя="text-[10px] font-medium text-muted-foreground/60">
                        {detail.label}
                      </dt>
                      <dd classИмя={cn("text-xs leading-5 text-foreground/70", detail.tone === "code" && "font-mono text-[11px]")}>
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : rawArgsText ? (
              <div>
                <div classИмя="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                  Input
                </div>
                <КопироватьablePreBlock classИмя="overflow-x-auto rounded-md bg-accent/30 p-2 text-[11px] leading-4 text-foreground/70">{rawArgsText}</КопироватьablePreBlock>
              </div>
            ) : null}
            {result !== undefined ? (
              <div>
                <div classИмя="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                  Result
                </div>
                <КопироватьablePreBlock classИмя="overflow-x-auto rounded-md bg-accent/30 p-2 text-[11px] leading-4 text-foreground/70">{resultText}</КопироватьablePreBlock>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getThreadMessageКопироватьText(message: ThreadMessage) {
  return message.content
    .filter((part): part is TextMessagePart => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

const ЗадачаChatTextParts = memo(function ЗадачаChatTextParts({
  message,
  recessed = false,
}: {
  message: ThreadMessage;
  recessed?: boolean;
}) {
  return (
    <>
      {message.content
        .filter((part): part is TextMessagePart => part.type === "text")
        .map((part, index) => (
          <ЗадачаChatTextPart
            key={`${message.id}:text:${index}`}
            text={part.text}
            recessed={recessed}
          />
        ))}
    </>
  );
});

function groupAssistantParts(
  content: readonly ThreadMessage["content"][number][],
): Array<
  | { type: "text"; part: TextMessagePart; index: number }
  | { type: "cot"; parts: ЗадачаChatCoTPart[]; startIndex: number }
> {
  const groups: Array<
    | { type: "text"; part: TextMessagePart; index: number }
    | { type: "cot"; parts: ЗадачаChatCoTPart[]; startIndex: number }
  > = [];
  let pendingCoT: ЗадачаChatCoTPart[] = [];
  let pendingНачатьIndex = -1;

  const flushCoT = () => {
    if (pendingCoT.length === 0) return;
    groups.push({ type: "cot", parts: pendingCoT, startIndex: pendingНачатьIndex });
    pendingCoT = [];
    pendingНачатьIndex = -1;
  };

  content.forEach((part, index) => {
    if (part.type === "reasoning" || part.type === "tool-call") {
      if (pendingCoT.length === 0) pendingНачатьIndex = index;
      pendingCoT.push(part);
      return;
    }
    flushCoT();
    if (part.type === "text") {
      groups.push({ type: "text", part, index });
    }
  });
  flushCoT();

  return groups;
}

const ЗадачаChatAssistantParts = memo(function ЗадачаChatAssistantParts({
  message,
  hasCoT,
}: {
  message: ThreadMessage;
  hasCoT: boolean;
}) {
  const groupedParts = useMemo(() => groupAssistantParts(message.content), [message.content]);
  return (
    <>
      {groupedParts.map((group) => {
        if (group.type === "text") {
          return (
            <ЗадачаChatTextPart
              key={`${message.id}:text:${group.index}`}
              text={group.part.text}
              recessed={hasCoT}
            />
          );
        }
        return (
          <ЗадачаChatChainOfThought
            key={`${message.id}:cot:${group.startIndex}`}
            message={message}
            cotParts={group.parts}
          />
        );
      })}
    </>
  );
});

function ЗадачаChatUserMessage({
  message,
  isInterruptingQueuedЗапустить,
}: {
  message: ThreadMessage;
  isInterruptingQueuedЗапустить: boolean;
}) {
  const {
    onInterruptQueued,
    onОтменаQueued,
    currentUserId,
    userПрофильMap,
  } = useContext(ЗадачаChatCtx);
  const custom = message.metadata.custom as Record<string, unknown>;
  const anchorId = typeof custom.anchorId === "string" ? custom.anchorId : undefined;
  const commentId = typeof custom.commentId === "string" ? custom.commentId : message.id;
  const authorИмя = typeof custom.authorИмя === "string" ? custom.authorИмя : null;
  const authorUserId = typeof custom.authorUserId === "string" ? custom.authorUserId : null;
  const queued = custom.queueState === "queued" || custom.clientСтатус === "queued";
  const followUpRequested = custom.followUpRequested === true;
  const queueReason = typeof custom.queueReason === "string" ? custom.queueReason : null;
  const queueBadgeLabel = queueReason === "hold" ? "\u23f8 Deferred wake" : "Queued";
  const pending = custom.clientСтатус === "pending";
  const queueЦельЗапуститьId = typeof custom.queueЦельЗапуститьId === "string" ? custom.queueЦельЗапуститьId : null;
  const [copied, setCopied] = useState(false);
  const {
    isCurrentUser,
    authorИмя: resolvedAuthorИмя,
    avatarUrl,
  } = resolveЗадачаChatЧеловекAuthor({
    authorИмя,
    authorUserId,
    currentUserId,
    userПрофильMap,
  });
  const authorAvatar = (
    <Avatar size="sm" classИмя="shrink-0">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={resolvedAuthorИмя} /> : null}
      <AvatarFallback>{initialsForИмя(resolvedAuthorИмя)}</AvatarFallback>
    </Avatar>
  );
  const messageBody = (
    <div classИмя={cn("flex min-w-0 max-w-[85%] flex-col", isCurrentUser && "items-end")}>
      <div classИмя={cn("mb-1 flex items-center gap-2 px-1", isCurrentUser ? "justify-end" : "justify-start")}>
        <span classИмя="text-sm font-medium text-foreground">{resolvedAuthorИмя}</span>
        {followUpRequested ? (
          <Badge variant="outline" classИмя="text-[10px] uppercase tracking-[0.14em]">
            Follow-up
          </Badge>
        ) : null}
      </div>
      <div
        classИмя={cn(
          "min-w-0 max-w-full overflow-hidden break-all rounded-2xl px-4 py-2.5",
          queued
            ? "bg-amber-50/80 dark:bg-amber-500/10"
            : "bg-muted",
          pending && "opacity-80",
        )}
      >
        {queued ? (
          <div classИмя="mb-1.5 flex items-center gap-2">
            <span classИмя="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-100/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-200">
              {queueBadgeLabel}
            </span>
            {queueЦельЗапуститьId && onInterruptQueued ? (
              <Button
                size="sm"
                variant="outline"
                classИмя="h-6 border-red-300 px-2 text-[11px] text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                disabled={isInterruptingQueuedЗапустить}
                onClick={() => void onInterruptQueued(queueЦельЗапуститьId)}
              >
                {isInterruptingQueuedЗапустить ? "Interrupting..." : "Interrupt"}
              </Button>
            ) : null}
            {onОтменаQueued ? (
              <Button
                size="sm"
                variant="outline"
                classИмя="h-6 border-amber-300 px-2 text-[11px] text-amber-900 hover:bg-amber-100/80 hover:text-amber-950 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/10"
                onClick={() => onОтменаQueued(commentId)}
              >
                Отмена
              </Button>
            ) : null}
          </div>
        ) : null}
        <div classИмя="min-w-0 max-w-full space-y-3">
          <ЗадачаChatTextParts message={message} />
        </div>
      </div>

      {pending ? (
        <div classИмя={cn("mt-1 flex px-1 text-[11px] text-muted-foreground", isCurrentUser ? "justify-end" : "justify-start")}>
          Отправитьing...
        </div>
      ) : (
        <div
          classИмя={cn(
            "mt-1 flex items-center gap-1.5 px-1 opacity-0 transition-opacity group-hover:opacity-100",
            isCurrentUser ? "justify-end" : "justify-start",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={anchorId ? `#${anchorId}` : undefined}
                classИмя="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {message.createdAt ? commentDateLabel(message.createdAt) : ""}
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" classИмя="text-xs">
              {message.createdAt ? formatDateTime(message.createdAt) : ""}
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            classИмя="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            title="Копировать message"
            aria-label="Копировать message"
            onClick={() => {
              const text = message.content
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("\n\n");
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check classИмя="h-3.5 w-3.5" /> : <Копировать classИмя="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div id={anchorId}>
      <div classИмя={cn("group flex items-start gap-2.5", isCurrentUser && "justify-end")}>
        {isCurrentUser ? (
          <>
            {messageBody}
            {authorAvatar}
          </>
        ) : (
          <>
            {authorAvatar}
            {messageBody}
          </>
        )}
      </div>
    </div>
  );
}

function ЗадачаChatAssistantMessage({
  message,
  activeVote,
  isЗапуститьАктивен,
  isОстановитьpingЗапустить,
}: {
  message: ThreadMessage;
  activeVote: FeedbackVoteЗначение | null;
  isЗапуститьАктивен: boolean;
  isОстановитьpingЗапустить: boolean;
}) {
  const {
    feedbackDataSharingPreference,
    feedbackTermsUrl,
    onVote,
    agentMap,
    onОстановитьЗапустить,
    stopЗапуститьLabel = "Остановить run",
    stoppingЗапуститьLabel = "Остановитьping...",
    stopЗапуститьVariant = "stop",
  } = useContext(ЗадачаChatCtx);
  const custom = message.metadata.custom as Record<string, unknown>;
  const anchorId = typeof custom.anchorId === "string" ? custom.anchorId : undefined;
  const authorИмя = typeof custom.authorИмя === "string"
    ? custom.authorИмя
    : typeof custom.runАгентИмя === "string"
      ? custom.runАгентИмя
      : "Агент";
  const authorАгентId = typeof custom.authorАгентId === "string" ? custom.authorАгентId : null;
  const runId = typeof custom.runId === "string" ? custom.runId : null;
  const runАгентId = typeof custom.runАгентId === "string" ? custom.runАгентId : null;
  const runСтатус = typeof custom.runСтатус === "string" ? custom.runСтатус : null;
  const agentId = authorАгентId ?? runАгентId;
  const agentIcon = agentId ? agentMap?.get(agentId)?.icon : undefined;
  const commentId = typeof custom.commentId === "string" ? custom.commentId : null;
  const notices = Array.isArray(custom.notices)
    ? custom.notices.filter((notice): notice is string => typeof notice === "string" && notice.length > 0)
    : [];
  const waitingText = typeof custom.waitingText === "string" ? custom.waitingText : "";
  const isВыполняется = message.role === "assistant" && message.status?.type === "running";
  const runHref = runId && runАгентId ? `/agents/${runАгентId}/runs/${runId}` : null;
  const canОстановитьЗапустить = Boolean(runId) && (isЗапуститьАктивен || runСтатус === "queued" || runСтатус === "running");
  const chainOfThoughtLabel = typeof custom.chainOfThoughtLabel === "string" ? custom.chainOfThoughtLabel : null;
  const hasCoT = message.content.some((p) => p.type === "reasoning" || p.type === "tool-call");
  const isFoldable = !isВыполняется && !!chainOfThoughtLabel;
  const [folded, setFolded] = useState(isFoldable);
  const [prevFoldКлюч, setPrevFoldКлюч] = useState({ messageId: message.id, isFoldable });
  const [copied, setCopied] = useState(false);
  const copyText = getThreadMessageКопироватьText(message);

  // Derive fold state synchronously during render (not in useEffect) so the
  // browser never paints the un-folded intermediate state — prevents the
  // visible "jump" when loading a page with already-folded work sections.
  if (message.id !== prevFoldКлюч.messageId || isFoldable !== prevFoldКлюч.isFoldable) {
    const nextFolded = resolveAssistantMessageFoldedState({
      messageId: message.id,
      currentFolded: folded,
      isFoldable,
      previousMessageId: prevFoldКлюч.messageId,
      previousIsFoldable: prevFoldКлюч.isFoldable,
    });
    setPrevFoldКлюч({ messageId: message.id, isFoldable });
    if (nextFolded !== folded) {
      setFolded(nextFolded);
    }
  }

  const handleVote = async (
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) => {
    if (!commentId || !onVote) return;
    await onVote(commentId, vote, options);
  };

  const followUpRequested = custom.followUpRequested === true;

  return (
    <div id={anchorId}>
      <div classИмя="flex items-start gap-2.5 py-1.5">
        <Avatar size="sm" classИмя="shrink-0">
          {agentIcon ? (
            <AvatarFallback><АгентIcon icon={agentIcon} classИмя="h-3.5 w-3.5" /></AvatarFallback>
          ) : (
            <AvatarFallback>{initialsForИмя(authorИмя)}</AvatarFallback>
          )}
        </Avatar>

        <div classИмя="min-w-0 flex-1">
          {isFoldable ? (
            <button
              type="button"
              classИмя="group flex w-full items-center gap-2 py-0.5 text-left"
              onClick={() => setFolded((v) => !v)}
            >
              <span classИмя="text-sm font-medium text-foreground">{authorИмя}</span>
              <span classИмя="text-xs text-muted-foreground/60">{chainOfThoughtLabel?.toНизкийerCase()}</span>
              <span classИмя="ml-auto flex items-center gap-1.5">
                {message.createdAt ? (
                  <span classИмя="text-[11px] text-muted-foreground/50">
                    {commentDateLabel(message.createdAt)}
                  </span>
                ) : null}
                <ChevronDown classИмя={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform", !folded && "rotate-180")} />
              </span>
            </button>
          ) : (
            <div classИмя="mb-1.5 flex items-center gap-2">
              <span classИмя="text-sm font-medium text-foreground">{authorИмя}</span>
              {followUpRequested ? (
                <Badge variant="outline" classИмя="text-[10px] uppercase tracking-[0.14em]">
                  Follow-up
                </Badge>
              ) : null}
              {isВыполняется ? (
                <span classИмя="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
                  <Loader2 classИмя="h-3 w-3 animate-spin" />
                  Выполняется
                </span>
              ) : null}
            </div>
          )}

          {!folded ? (
            <>
              <div classИмя="space-y-3">
                <ЗадачаChatAssistantParts message={message} hasCoT={hasCoT} />
                {message.content.length === 0 && waitingText ? (
                  <div classИмя="flex items-center gap-2.5 rounded-lg px-1 py-2">
                    <span classИмя="inline-flex items-center gap-2 text-sm font-medium text-foreground/80">
                      {agentIcon ? (
                        <АгентIcon icon={agentIcon} classИмя="h-4 w-4 shrink-0" />
                      ) : (
                        <Loader2 classИмя="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      <span classИмя="shimmer-text">{waitingText}</span>
                    </span>
                  </div>
                ) : null}
                {notices.length > 0 ? (
                  <div classИмя="space-y-2">
                    {notices.map((notice, index) => (
                      <div
                        key={`${message.id}:notice:${index}`}
                        classИмя="rounded-sm border border-border/60 bg-accent/20 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {notice}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div classИмя="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  classИмя="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Копировать message"
                  aria-label="Копировать message"
                  onClick={() => {
                    void navigator.clipboard.writeText(copyText).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  {copied ? <Check classИмя="h-3.5 w-3.5" /> : <Копировать classИмя="h-3.5 w-3.5" />}
                </button>
                {commentId && onVote ? (
                  <ЗадачаChatFeedbackButtons
                    activeVote={activeVote}
                    sharingPreference={feedbackDataSharingPreference}
                    termsUrl={feedbackTermsUrl ?? null}
                    onVote={handleVote}
                  />
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={anchorId ? `#${anchorId}` : undefined}
                      classИмя="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {message.createdAt ? commentDateLabel(message.createdAt) : ""}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" classИмя="text-xs">
                    {message.createdAt ? formatDateTime(message.createdAt) : ""}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      classИмя="text-muted-foreground hover:text-foreground"
                      title="More actions"
                      aria-label="More actions"
                    >
                      <MoreHorizontal classИмя="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        void navigator.clipboard.writeText(copyText);
                      }}
                    >
                      <Копировать classИмя="mr-2 h-3.5 w-3.5" />
                      Копировать message
                    </DropdownMenuItem>
                    {canОстановитьЗапустить && onОстановитьЗапустить && runId ? (
                      <DropdownMenuItem
                        disabled={isОстановитьpingЗапустить}
                        classИмя={cn(
                          stopЗапуститьVariant === "pause"
                            ? "text-amber-700 focus:text-amber-800 dark:text-amber-300 dark:focus:text-amber-200"
                            : "text-red-700 focus:text-red-800 dark:text-red-300 dark:focus:text-red-200",
                        )}
                        onSelect={() => {
                          void onОстановитьЗапустить(runId);
                        }}
                      >
                        {stopЗапуститьVariant === "pause" ? (
                          <ПаузаCircle classИмя="mr-2 h-3.5 w-3.5" />
                        ) : (
                          <Square classИмя="mr-2 h-3.5 w-3.5 fill-current" />
                        )}
                        {isОстановитьpingЗапустить ? stoppingЗапуститьLabel : stopЗапуститьLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {runHref ? (
                      <DropdownMenuItem asChild>
                        <Link to={runHref} target="_blank" rel="noreferrer noopener">
                          <Поиск classИмя="mr-2 h-3.5 w-3.5" />
                          Просмотр запуска
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ЗадачаChatFeedbackButtons({
  activeVote,
  sharingPreference = "prompt",
  termsUrl,
  onVote,
}: {
  activeVote: FeedbackVoteЗначение | null;
  sharingPreference: FeedbackDataSharingPreference;
  termsUrl: string | null;
  onVote: (vote: FeedbackVoteЗначение, options?: { allowSharing?: boolean; reason?: string }) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticVote, setOptimisticVote] = useState<FeedbackVoteЗначение | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [downvoteReason, setDownvoteReason] = useState("");
  const [pendingSharingDialog, setОжиданиеSharingDialog] = useState<{
    vote: FeedbackVoteЗначение;
    reason?: string;
  } | null>(null);
  const visibleVote = optimisticVote ?? activeVote ?? null;

  useEffect(() => {
    if (optimisticVote && activeVote === optimisticVote) setOptimisticVote(null);
  }, [activeVote, optimisticVote]);

  async function doVote(
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
  ) {
    setIsSaving(true);
    try {
      await onVote(vote, options);
    } catch {
      setOptimisticVote(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleVote(vote: FeedbackVoteЗначение, reason?: string) {
    setOptimisticVote(vote);
    if (sharingPreference === "prompt") {
      setОжиданиеSharingDialog({ vote, ...(reason ? { reason } : {}) });
      return;
    }
    const allowSharing = sharingPreference === "allowed";
    void doVote(vote, {
      ...(allowSharing ? { allowSharing: true } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  function handleThumbsUp() {
    handleVote("up");
  }

  function handleThumbsDown() {
    setOptimisticVote("down");
    setReasonOpen(true);
    // Отправить the initial down vote right away
    handleVote("down");
  }

  function handleОтправитьReason() {
    if (!downvoteReason.trim()) return;
    // Re-submit with reason attached
    if (sharingPreference === "prompt") {
      setОжиданиеSharingDialog({ vote: "down", reason: downvoteReason });
    } else {
      const allowSharing = sharingPreference === "allowed";
      void doVote("down", {
        ...(allowSharing ? { allowSharing: true } : {}),
        reason: downvoteReason,
      });
    }
    setReasonOpen(false);
    setDownvoteReason("");
  }

  return (
    <>
      <button
        type="button"
        disabled={isSaving}
        classИмя={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          visibleVote === "up"
            ? "text-green-600 dark:text-green-400"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        title="Helpful"
        aria-label="Helpful"
        onClick={handleThumbsUp}
      >
        <ThumbsUp classИмя="h-3.5 w-3.5" />
      </button>
      <Popover open={reasonOpen} onOpenChange={setReasonOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isSaving}
            classИмя={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              visibleVote === "down"
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title="Needs work"
            aria-label="Needs work"
            onClick={handleThumbsDown}
          >
            <ThumbsDown classИмя="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" classИмя="w-80 p-3">
          <div classИмя="mb-2 text-sm font-medium">What could have been better?</div>
          <Textarea
            value={downvoteReason}
            onChange={(event) => setDownvoteReason(event.target.value)}
            placeholder="Добавить a short note"
            classИмя="min-h-20 resize-y bg-background text-sm"
            disabled={isSaving}
          />
          <div classИмя="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setReasonOpen(false);
                setDownvoteReason("");
              }}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || !downvoteReason.trim()}
              onClick={handleОтправитьReason}
            >
              {isSaving ? "Saving..." : "Сохранить note"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={Boolean(pendingSharingDialog)}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setОжиданиеSharingDialog(null);
            setOptimisticVote(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogНазвание>Сохранить your feedback sharing preference</DialogНазвание>
            <DialogОписание>
              Choose whether voted AI outputs can be shared with Paperclip Labs. This
              answer becomes the default for future thumbs up and thumbs down votes.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-3 text-sm text-muted-foreground">
            <p>This vote is always saved locally.</p>
            <p>
              Choose <span classИмя="font-medium text-foreground">Always allow</span> to share
              this vote and future voted AI outputs. Choose{" "}
              <span classИмя="font-medium text-foreground">Don't allow</span> to keep this vote
              and future votes local.
            </p>
            <p>You can change this later in Instance Настройки &gt; Общие.</p>
            {termsUrl ? (
              <a
                href={termsUrl}
                target="_blank"
                rel="noreferrer"
                classИмя="inline-flex text-sm text-foreground underline underline-offset-4"
              >
                Read our terms of service
              </a>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!pendingSharingDialog || isSaving}
              onClick={() => {
                if (!pendingSharingDialog) return;
                void doVote(
                  pendingSharingDialog.vote,
                  pendingSharingDialog.reason ? { reason: pendingSharingDialog.reason } : undefined,
                ).then(() => setОжиданиеSharingDialog(null));
              }}
            >
              {isSaving ? "Saving..." : "Don't allow"}
            </Button>
            <Button
              type="button"
              disabled={!pendingSharingDialog || isSaving}
              onClick={() => {
                if (!pendingSharingDialog) return;
                void doVote(pendingSharingDialog.vote, {
                  allowSharing: true,
                  ...(pendingSharingDialog.reason ? { reason: pendingSharingDialog.reason } : {}),
                }).then(() => setОжиданиеSharingDialog(null));
              }}
            >
              {isSaving ? "Saving..." : "Always allow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExpiredRequestПодтвердитьationАктивность({
  message,
  anchorId,
  interaction,
}: {
  message: ThreadMessage;
  anchorId?: string;
  interaction: RequestПодтвердитьationInteraction;
}) {
  const {
    agentMap,
    currentUserId,
    userLabelMap,
    onПринятьInteraction,
    onОтклонитьInteraction,
    onОтменаInteraction,
  } = useContext(ЗадачаChatCtx);
  const [expanded, setExpanded] = useState(false);
  const hasResolvedActor = Boolean(interaction.resolvedByАгентId || interaction.resolvedByUserId);
  const actorАгентId = hasResolvedActor
    ? interaction.resolvedByАгентId ?? null
    : interaction.createdByАгентId ?? null;
  const actorUserId = hasResolvedActor
    ? interaction.resolvedByUserId ?? null
    : interaction.createdByUserId ?? null;
  const actorИмя = formatInteractionActorLabel({
    agentId: actorАгентId,
    userId: actorUserId,
    agentMap,
    currentUserId,
    userLabelMap,
  });
  const actorIcon = actorАгентId ? agentMap?.get(actorАгентId)?.icon : undefined;
  const isCurrentUser = Boolean(actorUserId && currentUserId && actorUserId === currentUserId);
  const detailsId = anchorId ? `${anchorId}-details` : `${interaction.id}-details`;
  const summary = buildЗадачаThreadInteractionSummary(interaction);

  const rowContent = (
    <div classИмя="min-w-0 flex-1">
      <div classИмя={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs", isCurrentUser && "justify-end")}>
        <span classИмя="font-medium text-foreground">{actorИмя}</span>
        <span classИмя="text-muted-foreground">updated this task</span>
        <a
          href={anchorId ? `#${anchorId}` : undefined}
          classИмя="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          {timeAgo(message.createdAt)}
        </a>
        <button
          type="button"
          classИмя="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown classИмя={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Hide confirmation" : "Expired confirmation"}
        </button>
      </div>
      {expanded ? (
        <p classИмя={cn("mt-1 text-xs text-muted-foreground", isCurrentUser && "text-right")}>
          {summary}
        </p>
      ) : null}
    </div>
  );

  return (
    <div id={anchorId}>
      {isCurrentUser ? (
        <div classИмя="flex items-start justify-end gap-2 py-1">
          {rowContent}
        </div>
      ) : (
        <div classИмя="flex items-start gap-2.5 py-1">
          <Avatar size="sm" classИмя="mt-0.5">
            {actorIcon ? (
              <AvatarFallback><АгентIcon icon={actorIcon} classИмя="h-3.5 w-3.5" /></AvatarFallback>
            ) : (
              <AvatarFallback>{initialsForИмя(actorИмя)}</AvatarFallback>
            )}
          </Avatar>
          {rowContent}
        </div>
      )}
      {expanded ? (
        <div id={detailsId} classИмя="mt-2">
          <ЗадачаThreadInteractionCard
            interaction={interaction}
            agentMap={agentMap}
            currentUserId={currentUserId}
            userLabelMap={userLabelMap}
            onПринятьInteraction={onПринятьInteraction}
            onОтклонитьInteraction={onОтклонитьInteraction}
            onОтменаInteraction={onОтменаInteraction}
          />
        </div>
      ) : null}
    </div>
  );
}

function isЗадачаCommentPresentation(value: unknown): value is ЗадачаCommentPresentation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "system_notice" || v.kind === "message";
}

function isЗадачаCommentMetadata(value: unknown): value is ЗадачаCommentMetadata {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && Array.isArray(v.sections);
}

function issueСтатусIsTerminalDisposition(issueСтатус: string | undefined) {
  return issueСтатус === "done" || issueСтатус === "cancelled";
}

function sourceЗапуститьIdFromУспешноfulЗапуститьHandoffMetadata(metadata: ЗадачаCommentMetadata | null) {
  if (metadata?.sourceЗапуститьId) return metadata.sourceЗапуститьId;
  const runLinks = [];
  for (const section of metadata?.sections ?? []) {
    for (const row of section.rows) {
      if (row.type === "run_link") runLinks.push(row.runId);
    }
  }
  return runLinks.length === 1 ? runLinks[0] : null;
}

function isStaleУспешноfulЗапуститьHandoffНетtice(input: {
  bodyText: string;
  issueСтатус?: string;
  successfulЗапуститьHandoff?: УспешноfulЗапуститьHandoffState | null;
  runId?: string | null;
  metadata: ЗадачаCommentMetadata | null;
}) {
  if (!isУспешноfulЗапуститьHandoffComment(input.bodyText)) return false;

  const currentHandoff = input.successfulЗапуститьHandoff ?? null;
  if (currentHandoff?.state === "resolved") return true;
  if (issueСтатусIsTerminalDisposition(input.issueСтатус)) return true;

  const noticeSourceЗапуститьId = sourceЗапуститьIdFromУспешноfulЗапуститьHandoffMetadata(input.metadata) ?? input.runId ?? null;
  if (
    noticeSourceЗапуститьId
    && currentHandoff?.sourceЗапуститьId
    && noticeSourceЗапуститьId !== currentHandoff.sourceЗапуститьId
  ) {
    return true;
  }

  return false;
}

function StaleDispositionПредупреждениеMetadataRow({ row }: { row: SystemНетticeMetadataRow }) {
  const label = (
    <span classИмя="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {row.label}
    </span>
  );
  const value = (() => {
    switch (row.kind) {
      case "text":
        return <span>{row.value}</span>;
      case "code":
        return (
          <code classИмя="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
            {row.value}
          </code>
        );
      case "issue": {
        const content = (
          <>
            <span>{row.identifier}</span>
            {row.title ? <span classИмя="text-muted-foreground"> - {row.title}</span> : null}
          </>
        );
        return row.href ? (
          <a href={row.href} classИмя="font-medium text-foreground underline-offset-2 hover:underline">
            {content}
          </a>
        ) : (
          <span classИмя="font-medium text-foreground">{content}</span>
        );
      }
      case "agent":
        return row.href ? (
          <a href={row.href} classИмя="font-medium text-foreground underline-offset-2 hover:underline">
            {row.name}
          </a>
        ) : (
          <span classИмя="font-medium text-foreground">{row.name}</span>
        );
      case "run": {
        const runShort = row.runId.length > 12 ? `${row.runId.slice(0, 8)}...` : row.runId;
        const content = (
          <>
            <code classИмя="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
              {runShort}
            </code>
            {row.status ? <span>{row.status}</span> : null}
          </>
        );
        return row.href ? (
          <a href={row.href} classИмя="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
            {content}
          </a>
        ) : (
          <span classИмя="inline-flex items-center gap-1.5">{content}</span>
        );
      }
    }
  })();

  return (
    <div classИмя="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      {label}
      <div classИмя="min-w-0 break-words text-foreground/80">{value}</div>
    </div>
  );
}

function metadataRowКлюч(row: SystemНетticeMetadataRow) {
  switch (row.kind) {
    case "issue":
      return `issue:${row.label}:${row.identifier}:${row.href ?? ""}:${row.title ?? ""}`;
    case "agent":
      return `agent:${row.label}:${row.name}:${row.href ?? ""}`;
    case "run":
      return `run:${row.label}:${row.runId}:${row.href ?? ""}:${row.status ?? ""}`;
    default:
      return `${row.kind}:${row.label}:${row.value}`;
  }
}

function metadataSectionКлюч(section: SystemНетticeMetadataSection) {
  return `${section.title ?? "details"}:${section.rows.map(metadataRowКлюч).join("|")}`;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTimelineРабочая область(value: unknown): value is ЗадачаTimelineРабочая область {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const workspace = value as Record<string, unknown>;
  return isNullableString(workspace.label)
    && isNullableString(workspace.projectРабочая областьId)
    && isNullableString(workspace.executionРабочая областьId)
    && isNullableString(workspace.mode);
}

function isTimelineРабочая областьChange(value: unknown): value is НетnNullable<ЗадачаTimelineEvent["workspaceChange"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const change = value as Record<string, unknown>;
  return isTimelineРабочая область(change.from) && isTimelineРабочая область(change.to);
}

function StaleDispositionПредупреждениеДетали({
  sections,
}: {
  sections: SystemНетticeMetadataSection[];
}) {
  if (sections.length === 0) {
    return <div classИмя="text-xs leading-5 text-muted-foreground">Нет additional details.</div>;
  }

  return (
    <div classИмя="space-y-3 text-left">
      {sections.map((section) => (
        <div key={metadataSectionКлюч(section)} classИмя="space-y-1.5">
          {section.title ? (
            <div classИмя="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {section.title}
            </div>
          ) : null}
          <div classИмя="space-y-1">
            {section.rows.map((row) => (
              <StaleDispositionПредупреждениеMetadataRow key={metadataRowКлюч(row)} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StaleDispositionПредупреждениеRow({
  anchorId,
  message,
  metadata,
  runАгентId,
}: {
  anchorId?: string;
  message: ThreadMessage;
  metadata: ЗадачаCommentMetadata | null;
  runАгентId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const sections = mapCommentMetadataToSystemНетticeSections(metadata, { runАгентId });

  return (
    <div id={anchorId} data-testid="stale-disposition-warning">
      <div classИмя="flex items-start gap-2.5 py-1.5">
        <span classИмя="size-6 shrink-0" aria-hidden />
        <div classИмя="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            classИмя="group flex w-full items-center gap-2 py-0.5 text-left"
            onClick={() => setOpen((value) => !value)}
          >
            <span classИмя="text-sm font-medium text-foreground/80">
              Stale disposition warning
            </span>
            <span classИмя="ml-auto flex items-center gap-1.5">
              {message.createdAt ? (
                <span data-testid="stale-disposition-warning-time" classИмя="text-[11px] text-muted-foreground/50">
                  {commentDateLabel(message.createdAt)}
                </span>
              ) : null}
              <ChevronDown classИмя={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
            </span>
          </button>
          <div id={detailsId} hidden={!open} classИмя="space-y-1 py-1">
            <StaleDispositionПредупреждениеДетали sections={sections} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemНетticeCommentRow({
  message,
  anchorId,
}: {
  message: ThreadMessage;
  anchorId?: string;
}) {
  const { onImageClick, agentMap, issueСтатус, successfulЗапуститьHandoff } = useContext(ЗадачаChatCtx);
  const custom = message.metadata.custom as Record<string, unknown>;
  const presentation = isЗадачаCommentPresentation(custom.presentation) ? custom.presentation : null;
  const commentMetadata = isЗадачаCommentMetadata(custom.commentMetadata) ? custom.commentMetadata : null;
  const runАгентId = typeof custom.runАгентId === "string" ? custom.runАгентId : null;
  const runId = typeof custom.runId === "string" ? custom.runId : null;
  const authorТип = typeof custom.authorТип === "string" ? custom.authorТип : null;
  const authorИмя = typeof custom.authorИмя === "string" ? custom.authorИмя : null;
  const bodyText = message.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
  const staleУспешноfulЗапуститьHandoffНетtice = isStaleУспешноfulЗапуститьHandoffНетtice({
    bodyText,
    issueСтатус,
    successfulЗапуститьHandoff,
    runId,
    metadata: commentMetadata,
  });
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const source = (() => {
    const runАгентИмя = runАгентId ? agentMap?.get(runАгентId)?.name ?? null : null;
    if (authorТип === "system") {
      const label = runАгентИмя ?? "Paperclip";
      if (runАгентId && runId) return { label, href: `/agents/${runАгентId}/runs/${runId}` };
      return { label };
    }
    if (runАгентId && runId) {
      return { label: authorИмя ?? runАгентИмя ?? "Paperclip", href: `/agents/${runАгентId}/runs/${runId}` };
    }
    if (authorИмя) return { label: authorИмя };
    return undefined;
  })();

  const props = buildSystemНетticeProps({
    presentation,
    metadata: commentMetadata,
    body: (
      <MarkdownBody classИмя="text-sm leading-6" softBreaks onImageClick={onImageClick}>
        {bodyText}
      </MarkdownBody>
    ),
    timestamp: message.createdAt ? new Date(message.createdAt).toISOString() : undefined,
    source,
    runАгентId,
  });

  const handleКопировать = () => {
    void navigator.clipboard.writeText(bodyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleКопироватьLink = () => {
    if (!anchorId || typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}#${anchorId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  if (staleУспешноfulЗапуститьHandoffНетtice) {
    return (
      <StaleDispositionПредупреждениеRow
        anchorId={anchorId}
        message={message}
        metadata={commentMetadata}
        runАгентId={runАгентId}
      />
    );
  }

  return (
    <div id={anchorId} classИмя="group">
      <div classИмя="py-1">
        <SystemНетtice {...props} />
        <div classИмя="mt-1 flex items-center justify-end gap-1.5 px-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={anchorId ? `#${anchorId}` : undefined}
                classИмя="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {message.createdAt ? commentDateLabel(message.createdAt) : ""}
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" classИмя="text-xs">
              {message.createdAt ? formatDateTime(message.createdAt) : ""}
            </TooltipContent>
          </Tooltip>
          {anchorId ? (
            <button
              type="button"
              classИмя="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              title="Копировать link"
              aria-label="Копировать link to system notice"
              onClick={handleКопироватьLink}
            >
              {copiedLink ? <Check classИмя="h-3.5 w-3.5" /> : <Paperclip classИмя="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <button
            type="button"
            classИмя="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            title="Копировать notice text"
            aria-label="Копировать system notice"
            onClick={handleКопировать}
          >
            {copied ? <Check classИмя="h-3.5 w-3.5" /> : <Копировать classИмя="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ЗадачаChatSystemMessage({ message }: { message: ThreadMessage }) {
  const {
    agentMap,
    currentUserId,
    userLabelMap,
    onПринятьInteraction,
    onОтклонитьInteraction,
    onОтправитьInteractionAnswers,
    onОтменаInteraction,
  } = useContext(ЗадачаChatCtx);
  const custom = message.metadata.custom as Record<string, unknown>;
  const anchorId = typeof custom.anchorId === "string" ? custom.anchorId : undefined;
  const runId = typeof custom.runId === "string" ? custom.runId : null;
  const runАгентId = typeof custom.runАгентId === "string" ? custom.runАгентId : null;
  const runАгентИмя = typeof custom.runАгентИмя === "string" ? custom.runАгентИмя : null;
  const runСтатус = typeof custom.runСтатус === "string" ? custom.runСтатус : null;
  const actorИмя = typeof custom.actorИмя === "string" ? custom.actorИмя : null;
  const actorТип = typeof custom.actorТип === "string" ? custom.actorТип : null;
  const actorId = typeof custom.actorId === "string" ? custom.actorId : null;
  const statusChange = typeof custom.statusChange === "object" && custom.statusChange
    ? custom.statusChange as { from: string | null; to: string | null }
    : null;
  const assigneeChange = typeof custom.assigneeChange === "object" && custom.assigneeChange
    ? custom.assigneeChange as {
        from: ЗадачаTimelineИсполнитель;
        to: ЗадачаTimelineИсполнитель;
      }
    : null;
  const workspaceChange = isTimelineРабочая областьChange(custom.workspaceChange) ? custom.workspaceChange : null;
  const interaction = isЗадачаThreadInteraction(custom.interaction)
    ? custom.interaction
    : null;

  if (custom.kind === "system_notice") {
    return (
      <SystemНетticeCommentRow
        message={message}
        anchorId={anchorId}
      />
    );
  }

  if (custom.kind === "interaction" && interaction) {
    if (interaction.kind === "request_confirmation" && interaction.status === "expired") {
      return (
        <ExpiredRequestПодтвердитьationАктивность
          message={message}
          anchorId={anchorId}
          interaction={interaction}
        />
      );
    }

    return (
      <div id={anchorId}>
        <div classИмя="py-1.5">
          <ЗадачаThreadInteractionCard
            interaction={interaction}
            agentMap={agentMap}
            currentUserId={currentUserId}
            userLabelMap={userLabelMap}
            onПринятьInteraction={onПринятьInteraction}
            onОтклонитьInteraction={onОтклонитьInteraction}
            onОтправитьInteractionAnswers={onОтправитьInteractionAnswers}
            onОтменаInteraction={onОтменаInteraction}
          />
        </div>
      </div>
    );
  }

  if (custom.kind === "event" && actorИмя) {
    const isCurrentUser = actorТип === "user" && !!currentUserId && actorId === currentUserId;
    const isАгент = actorТип === "agent";
    const agentIcon = isАгент && actorId ? agentMap?.get(actorId)?.icon : undefined;

    const eventContent = (
      <div classИмя="min-w-0 space-y-1">
        <div classИмя={cn("flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs", isCurrentUser && "justify-end")}>
          <span classИмя="font-medium text-foreground">{actorИмя}</span>
          <span classИмя="text-muted-foreground">
            {custom.followUpRequested === true ? "requested follow-up" : "updated this task"}
          </span>
          <a
            href={anchorId ? `#${anchorId}` : undefined}
            classИмя="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            {timeAgo(message.createdAt)}
          </a>
        </div>

        {statusChange ? (
          <div classИмя={cn("flex flex-wrap items-center gap-1.5 text-xs", isCurrentUser && "justify-end")}>
            <span classИмя="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Статус
            </span>
            <span classИмя="text-muted-foreground">{humanizeЗначение(statusChange.from)}</span>
            <ArrowRight classИмя="h-3 w-3 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">{humanizeЗначение(statusChange.to)}</span>
          </div>
        ) : null}

        {assigneeChange ? (
          <div classИмя={cn("flex flex-wrap items-center gap-1.5 text-xs", isCurrentUser && "justify-end")}>
            <span classИмя="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Исполнитель
            </span>
            <span classИмя="text-muted-foreground">
              {formatTimelineИсполнительLabel(assigneeChange.from, agentMap, currentUserId, userLabelMap)}
            </span>
            <ArrowRight classИмя="h-3 w-3 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">
              {formatTimelineИсполнительLabel(assigneeChange.to, agentMap, currentUserId, userLabelMap)}
            </span>
          </div>
        ) : null}

        {workspaceChange ? (
          <div classИмя={cn("flex flex-wrap items-center gap-1.5 text-xs", isCurrentUser && "justify-end")}>
            <span classИмя="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Рабочая область
            </span>
            <span classИмя="text-muted-foreground">
              {formatTimelineРабочая областьLabel(workspaceChange.from)}
            </span>
            <ArrowRight classИмя="h-3 w-3 text-muted-foreground" />
            <span classИмя="font-medium text-foreground">
              {formatTimelineРабочая областьLabel(workspaceChange.to)}
            </span>
          </div>
        ) : null}
      </div>
    );

    if (isCurrentUser) {
      return (
        <div id={anchorId}>
          <div classИмя="flex items-start justify-end gap-2 py-1">
            {eventContent}
          </div>
        </div>
      );
    }

    return (
      <div id={anchorId}>
        <div classИмя="flex items-start gap-2.5 py-1">
          <Avatar size="sm" classИмя="mt-0.5">
            {agentIcon ? (
              <AvatarFallback><АгентIcon icon={agentIcon} classИмя="h-3.5 w-3.5" /></AvatarFallback>
            ) : (
              <AvatarFallback>{initialsForИмя(actorИмя)}</AvatarFallback>
            )}
          </Avatar>
          <div classИмя="flex-1">
            {eventContent}
          </div>
        </div>
      </div>
    );
  }

  const displayedЗапуститьАгентИмя = runАгентИмя ?? (runАгентId ? agentMap?.get(runАгентId)?.name ?? runАгентId.slice(0, 8) : null);
  const runАгентIcon = runАгентId ? agentMap?.get(runАгентId)?.icon : undefined;
  if (custom.kind === "run" && runId && runАгентId && displayedЗапуститьАгентИмя && runСтатус) {
    return (
      <div id={anchorId}>
        <div classИмя="flex items-center gap-2.5 py-1">
          <Avatar size="sm">
            {runАгентIcon ? (
              <AvatarFallback><АгентIcon icon={runАгентIcon} classИмя="h-3.5 w-3.5" /></AvatarFallback>
            ) : (
              <AvatarFallback>{initialsForИмя(displayedЗапуститьАгентИмя)}</AvatarFallback>
            )}
          </Avatar>

          <div classИмя="min-w-0 flex-1">
            <div classИмя="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
              <Link to={`/agents/${runАгентId}`} classИмя="font-medium text-foreground transition-colors hover:underline">
                {displayedЗапуститьАгентИмя}
              </Link>
              <span classИмя="text-muted-foreground">run</span>
              <Link
                to={`/agents/${runАгентId}/runs/${runId}`}
                classИмя="inline-flex items-center rounded-md border border-border bg-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {runId.slice(0, 8)}
              </Link>
              <span classИмя={cn("font-medium", runСтатусClass(runСтатус))}>
                {formatЗапуститьСтатусLabel(runСтатус)}
              </span>
              <a
                href={anchorId ? `#${anchorId}` : undefined}
                classИмя="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {timeAgo(message.createdAt)}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function issueChatMessageСвой(message: ThreadMessage): Record<string, unknown> {
  return (message.metadata?.custom ?? {}) as Record<string, unknown>;
}

function issueChatMessageKind(message: ThreadMessage): string {
  const custom = issueChatMessageСвой(message);
  return typeof custom.kind === "string" ? custom.kind : message.role;
}

function issueChatMessageCommentId(message: ThreadMessage): string | null {
  const custom = issueChatMessageСвой(message);
  return typeof custom.commentId === "string" ? custom.commentId : null;
}

function issueChatMessageЗапуститьId(message: ThreadMessage): string | null {
  const custom = issueChatMessageСвой(message);
  return typeof custom.runId === "string" ? custom.runId : null;
}

function issueChatMessageQueueЦельЗапуститьId(message: ThreadMessage): string | null {
  const custom = issueChatMessageСвой(message);
  return typeof custom.queueЦельЗапуститьId === "string" ? custom.queueЦельЗапуститьId : null;
}

function issueChatMessageАктивенVote(
  message: ThreadMessage,
  feedbackVoteByЦельId: ReadonlyMap<string, FeedbackVoteЗначение>,
): FeedbackVoteЗначение | null {
  const commentId = issueChatMessageCommentId(message);
  return commentId ? feedbackVoteByЦельId.get(commentId) ?? null : null;
}

function issueChatMessageЗапуститьIsАктивен(
  message: ThreadMessage,
  activeЗапуститьIds: ReadonlySet<string>,
): boolean {
  const runId = issueChatMessageЗапуститьId(message);
  return Boolean(runId && activeЗапуститьIds.has(runId));
}

function issueChatMessageЗапуститьIsОстановитьping(
  message: ThreadMessage,
  stoppingЗапуститьId: string | null | undefined,
): boolean {
  const runId = issueChatMessageЗапуститьId(message);
  return Boolean(runId && stoppingЗапуститьId === runId);
}

function issueChatMessageQueuedЗапуститьIsInterrupting(
  message: ThreadMessage,
  interruptingQueuedЗапуститьId: string | null | undefined,
): boolean {
  const queueЦельЗапуститьId = issueChatMessageQueueЦельЗапуститьId(message);
  return Boolean(queueЦельЗапуститьId && interruptingQueuedЗапуститьId === queueЦельЗапуститьId);
}

// Above ~150 merged rows the direct render path forces React to mount and
// re-render hundreds of Markdown bodies, feedback controls, and avatars on
// unrelated parent updates. Above this threshold we switch to a windowed
// render path so only visible rows plus overscan stay mounted.
export const VIRTUALIZED_THREAD_ROW_THRESHOLD = 150;
const VIRTUALIZED_THREAD_OVERSCAN = 6;
// Rough "average row" estimate. The virtualizer measures real heights as
// rows mount, so this only affects offscreen rows it has not seen yet.
const VIRTUALIZED_THREAD_ROW_ESTIMATE_PX = 220;
const VIRTUALIZED_THREAD_GAP_FULL_PX = 16;
const VIRTUALIZED_THREAD_GAP_EMBEDDED_PX = 12;

interface VirtualizedЗадачаChatThreadListProps {
  messages: readonly ThreadMessage[];
  feedbackVoteByЦельId: ReadonlyMap<string, FeedbackVoteЗначение>;
  activeЗапуститьIds: ReadonlySet<string>;
  stoppingЗапуститьId?: string | null;
  interruptingQueuedЗапуститьId?: string | null;
  variant: "full" | "embedded";
}

interface VirtualizedЗадачаChatThreadListHandle {
  scrollToIndex: (
    index: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
  ) => void;
  scrollToLatest: (options?: { behavior?: ScrollBehavior }) => void;
  measure: () => void;
}

function issueChatMessageAnchorId(message: ThreadMessage): string | null {
  const custom = message.metadata.custom as { anchorId?: unknown } | undefined;
  return typeof custom?.anchorId === "string" ? custom.anchorId : null;
}

function findMessageAnchorIndex(messages: readonly ThreadMessage[], anchorId: string): number {
  return messages.findIndex((message) => issueChatMessageAnchorId(message) === anchorId);
}

export function findLatestCommentMessageIndex(messages: readonly ThreadMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const anchorId = issueChatMessageAnchorId(messages[index]);
    if (anchorId && anchorId.startsWith("comment-")) return index;
  }
  return -1;
}

type VirtualizedVisibleAnchorSnapshot = {
  anchorId: string;
  index: number;
  viewportTop: number;
};

type VirtualizedScrollMode =
  | { kind: "window" }
  | { kind: "element"; element: HTMLElement };

type SimpleVirtualItem = {
  index: number;
  key: React.Ключ;
  start: number;
  size: number;
};

function useЗадачаThreadVirtualizer({
  count,
  estimateSize,
  overscan,
  scrollMargin,
  gap,
  getItemКлюч,
  mode,
}: {
  count: number;
  estimateSize: () => number;
  overscan: number;
  scrollMargin: number;
  gap: number;
  getItemКлюч: (index: number) => React.Ключ;
  mode: VirtualizedScrollMode;
}) {
  const measuredSizeByКлючRef = useRef(new Map<React.Ключ, number>());
  const [, rerender] = useState(0);
  const estimatedSize = estimateSize();

  const itemНачатьs: number[] = [];
  const itemSizes: number[] = [];
  let nextНачать = scrollMargin;
  for (let index = 0; index < count; index += 1) {
    const key = getItemКлюч(index);
    const size = measuredSizeByКлючRef.current.get(key) ?? estimatedSize;
    itemНачатьs.push(nextНачать);
    itemSizes.push(size);
    nextНачать += size + gap;
  }
  const totalSize = Math.max(0, nextНачать - scrollMargin - gap);

  const viewportHeight = () => (mode.kind === "window" ? window.innerHeight : mode.element.clientHeight);
  const scrollOffset = () => (mode.kind === "window" ? window.scrollY : mode.element.scrollTop);
  const maxScrollOffset = () => {
    const targetScrollHeight = mode.kind === "window"
      ? document.documentElement.scrollHeight
      : mode.element.scrollHeight;
    return Math.max(0, Math.max(targetScrollHeight, totalSize) - viewportHeight());
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target: Window | HTMLElement = mode.kind === "window" ? window : mode.element;
    const update = () => rerender((value) => value + 1);
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mode]);

  const rawНачать = Math.max(scrollMargin, scrollOffset());
  const rawEnd = rawНачать + viewportHeight();
  let visibleНачатьIndex = 0;
  while (
    visibleНачатьIndex < count - 1
    && itemНачатьs[visibleНачатьIndex] + itemSizes[visibleНачатьIndex] < rawНачать
  ) {
    visibleНачатьIndex += 1;
  }
  let visibleEndIndex = visibleНачатьIndex;
  while (visibleEndIndex < count - 1 && itemНачатьs[visibleEndIndex] <= rawEnd) {
    visibleEndIndex += 1;
  }
  const startIndex = Math.max(0, visibleНачатьIndex - overscan);
  const endIndex = Math.min(count - 1, visibleEndIndex + overscan);
  const virtualItems: SimpleVirtualItem[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    virtualItems.push({
      index,
      key: getItemКлюч(index),
      start: itemНачатьs[index] ?? scrollMargin,
      size: itemSizes[index] ?? estimatedSize,
    });
  }

  const scrollToIndex = (
    index: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
  ) => {
    const clampedIndex = Math.max(0, Math.min(index, count - 1));
    const targetMax = maxScrollOffset();
    let top = itemНачатьs[clampedIndex] ?? scrollMargin;
    if (options?.align === "center") {
      top = top - viewportHeight() / 2 + (itemSizes[clampedIndex] ?? estimatedSize) / 2;
    } else if (options?.align === "end") {
      top = top + (itemSizes[clampedIndex] ?? estimatedSize) - viewportHeight();
    }
    top = Math.max(0, Math.min(top, targetMax));
    if (mode.kind === "window") {
      window.scrollTo({ top, behavior: options?.behavior });
    } else {
      mode.element.scrollTo({ top, behavior: options?.behavior });
    }
    rerender((value) => value + 1);
  };

  return {
    getVirtualItems: () => virtualItems,
    getTotalSize: () => totalSize,
    scrollToIndex,
    measure: () => undefined,
    measureElement: (element?: HTMLElement | null) => {
      if (!element) return;
      const index = Number(element.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= count) return;
      const measuredSize = element.getBoundingClientRect().height || element.offsetHeight;
      if (!Number.isFinite(measuredSize) || measuredSize <= 0) return;
      const key = getItemКлюч(index);
      const previousSize = measuredSizeByКлючRef.current.get(key) ?? estimatedSize;
      if (Math.abs(previousSize - measuredSize) < 1) return;
      measuredSizeByКлючRef.current.set(key, measuredSize);
      rerender((value) => value + 1);
    },
  };
}

// The chat thread renders inside `<main id="main-content">` on the real issue
// page (overflow-auto on desktop), but lives at document scope on mobile (main
// is overflow-visible) and in the auth-free perf fixture. Walk the DOM to find
// the actual scroll container so the virtualizer binds to the right offset
// source — otherwise it stays anchored at offset 0 forever and the visible
// chat area renders blank past the first viewport (PAP-2660).
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  if (!el || typeof window === "undefined") return null;
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

const VirtualizedЗадачаChatThreadList = forwardRef<VirtualizedЗадачаChatThreadListHandle, VirtualizedЗадачаChatThreadListProps>(function VirtualizedЗадачаChatThreadList(props, ref) {
  const probeRef = useRef<HTMLDivElement | null>(null);
  // По умолчанию to window scroll on first render so the imperative handle is
  // available immediately for hash-target / submit-scroll effects. After mount
  // we probe the DOM and remount via key={modeКлюч} if the actual scroll
  // container is an element ancestor (e.g. desktop <main id="main-content">).
  const [mode, setMode] = useState<VirtualizedScrollMode>({ kind: "window" });

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const detect = () => {
      const probe = probeRef.current;
      if (!probe) return;
      const container = findScrollContainer(probe);
      setMode((prev) => {
        if (container === null) {
          return prev.kind === "window" ? prev : { kind: "window" };
        }
        if (prev.kind === "element" && prev.element === container) return prev;
        return { kind: "element", element: container };
      });
    };
    detect();
    window.addEventListener("resize", detect);
    return () => {
      window.removeEventListener("resize", detect);
    };
  }, []);

  return (
    <VirtualizedЗадачаChatThreadListInner
      key={mode.kind === "window" ? "window" : "element"}
      ref={ref}
      probeRef={probeRef}
      mode={mode}
      {...props}
    />
  );
});

interface VirtualizedЗадачаChatThreadListInnerProps extends VirtualizedЗадачаChatThreadListProps {
  mode: VirtualizedScrollMode;
  probeRef: React.MutableRefObject<HTMLDivElement | null>;
}

const VirtualizedЗадачаChatThreadListInner = forwardRef<
  VirtualizedЗадачаChatThreadListHandle,
  VirtualizedЗадачаChatThreadListInnerProps
>(function VirtualizedЗадачаChatThreadListInner({
  messages,
  feedbackVoteByЦельId,
  activeЗапуститьIds,
  stoppingЗапуститьId,
  interruptingQueuedЗапуститьId,
  variant,
  mode,
  probeRef,
}, ref) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const pendingPrependAnchorRef = useRef<VirtualizedVisibleAnchorSnapshot | null>(null);

  const setRefs = useCallback((element: HTMLDivElement | null) => {
    parentRef.current = element;
    probeRef.current = element;
  }, [probeRef]);

  useLayoutEffect(() => {
    const element = parentRef.current;
    if (!element || typeof window === "undefined") return;
    const update = () => {
      if (!parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();
      const offset = mode.kind === "window"
        ? rect.top + window.scrollY
        : rect.top - mode.element.getBoundingClientRect().top + mode.element.scrollTop;
      setScrollMargin((previous) => (Math.abs(previous - offset) < 0.5 ? previous : offset));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [mode]);

  const gap = variant === "embedded"
    ? VIRTUALIZED_THREAD_GAP_EMBEDDED_PX
    : VIRTUALIZED_THREAD_GAP_FULL_PX;

  const virtualizer = useЗадачаThreadVirtualizer({
    count: messages.length,
    estimateSize: () => VIRTUALIZED_THREAD_ROW_ESTIMATE_PX,
    overscan: VIRTUALIZED_THREAD_OVERSCAN,
    scrollMargin,
    gap,
    getItemКлюч: (index) => messages[index]?.id ?? index,
    mode,
  });

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => {
      if (index < 0 || index >= messages.length) return;
      virtualizer.scrollToIndex(index, {
        align: options?.align ?? "center",
        behavior: options?.behavior ?? "smooth",
      });
    },
    scrollToLatest: (options) => {
      if (messages.length === 0) return;
      virtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: options?.behavior ?? "smooth",
      });
    },
    measure: () => {
      virtualizer.measure();
    },
  }), [messages.length, virtualizer]);

  useLayoutEffect(() => {
    return () => {
      const element = parentRef.current;
      if (!element || typeof window === "undefined") return;
      const rows = Array.from(
        element.querySelectorВсе<HTMLElement>("[data-anchor-id][data-index]"),
      );
      const visibleRow = rows.find((row) => row.getBoundingClientRect().bottom >= 0);
      if (!visibleRow) return;
      const anchorId = visibleRow.dataset.anchorId;
      const index = Number(visibleRow.dataset.index);
      if (!anchorId || !Number.isFinite(index)) return;
      pendingPrependAnchorRef.current = {
        anchorId,
        index,
        viewportTop: visibleRow.getBoundingClientRect().top,
      };
    };
  }, [messages]);

  useLayoutEffect(() => {
    const pendingAnchor = pendingPrependAnchorRef.current;
    pendingPrependAnchorRef.current = null;
    virtualizer.measure();
    if (!pendingAnchor || typeof window === "undefined") return;
    const nextIndex = findMessageAnchorIndex(messages, pendingAnchor.anchorId);
    if (nextIndex <= pendingAnchor.index) return;

    virtualizer.scrollToIndex(nextIndex, { align: "start", behavior: "auto" });
    requestAnimationFrame(() => {
      const element = document.getElementById(pendingAnchor.anchorId);
      if (!element) return;
      const delta = element.getBoundingClientRect().top - pendingAnchor.viewportTop;
      if (Math.abs(delta) > 1) {
        if (mode.kind === "window") {
          window.scrollBy({ top: delta, behavior: "auto" });
        } else {
          mode.element.scrollBy({ top: delta, behavior: "auto" });
        }
      }
      virtualizer.measure();
    });
  }, [messages, virtualizer, mode]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={setRefs}
      data-testid="issue-chat-thread-virtualizer"
      data-virtual-count={messages.length}
      style={{ position: "relative", width: "100%", height: totalSize }}
    >
      {virtualItems.map((virtualItem) => {
        const message = messages[virtualItem.index];
        if (!message) return null;
        const anchorId = issueChatMessageAnchorId(message);
        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            data-anchor-id={anchorId ?? undefined}
            data-testid="issue-chat-thread-virtual-row"
            ref={(element) => {
              if (element) virtualizer.measureElement(element);
            }}
            onLoadCapture={(event) => {
              virtualizer.measureElement(event.currentЦель);
            }}
            onClickCapture={(event) => {
              const row = event.currentЦель;
              requestAnimationFrame(() => {
                virtualizer.measureElement(row);
              });
            }}
            onTransitionEndCapture={(event) => {
              virtualizer.measureElement(event.currentЦель);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
            }}
          >
            <ЗадачаChatMessageRow
              message={message}
              feedbackVoteByЦельId={feedbackVoteByЦельId}
              activeЗапуститьIds={activeЗапуститьIds}
              stoppingЗапуститьId={stoppingЗапуститьId}
              interruptingQueuedЗапуститьId={interruptingQueuedЗапуститьId}
            />
          </div>
        );
      })}
    </div>
  );
});

interface ЗадачаChatMessageRowProps {
  message: ThreadMessage;
  feedbackVoteByЦельId: ReadonlyMap<string, FeedbackVoteЗначение>;
  activeЗапуститьIds: ReadonlySet<string>;
  stoppingЗапуститьId?: string | null;
  interruptingQueuedЗапуститьId?: string | null;
}

const ЗадачаChatMessageRow = memo(function ЗадачаChatMessageRow({
  message,
  feedbackVoteByЦельId,
  activeЗапуститьIds,
  stoppingЗапуститьId,
  interruptingQueuedЗапуститьId,
}: ЗадачаChatMessageRowProps) {
  const kind = issueChatMessageKind(message);
  const activeVote = issueChatMessageАктивенVote(message, feedbackVoteByЦельId);
  const isЗапуститьАктивен = issueChatMessageЗапуститьIsАктивен(message, activeЗапуститьIds);
  const isОстановитьpingЗапустить = issueChatMessageЗапуститьIsОстановитьping(message, stoppingЗапуститьId);
  const isInterruptingQueuedЗапустить = issueChatMessageQueuedЗапуститьIsInterrupting(message, interruptingQueuedЗапуститьId);
  const renderedMessage = message.role === "user"
    ? (
      <ЗадачаChatUserMessage
        message={message}
        isInterruptingQueuedЗапустить={isInterruptingQueuedЗапустить}
      />
    )
    : message.role === "assistant"
      ? (
        <ЗадачаChatAssistantMessage
          message={message}
          activeVote={activeVote}
          isЗапуститьАктивен={isЗапуститьАктивен}
          isОстановитьpingЗапустить={isОстановитьpingЗапустить}
        />
      )
      : <ЗадачаChatSystemMessage message={message} />;

  return (
    <div
      data-testid="issue-chat-message-row"
      data-message-role={message.role}
      data-message-kind={kind}
    >
      {renderedMessage}
    </div>
  );
}, areЗадачаChatMessageRowPropsEqual);

function areЗадачаChatMessageRowPropsEqual(
  prev: ЗадачаChatMessageRowProps,
  next: ЗадачаChatMessageRowProps,
) {
  if (prev.message !== next.message) return false;
  if (issueChatMessageАктивенVote(prev.message, prev.feedbackVoteByЦельId) !== issueChatMessageАктивенVote(next.message, next.feedbackVoteByЦельId)) return false;
  if (issueChatMessageЗапуститьIsАктивен(prev.message, prev.activeЗапуститьIds) !== issueChatMessageЗапуститьIsАктивен(next.message, next.activeЗапуститьIds)) return false;
  if (issueChatMessageЗапуститьIsОстановитьping(prev.message, prev.stoppingЗапуститьId) !== issueChatMessageЗапуститьIsОстановитьping(next.message, next.stoppingЗапуститьId)) return false;
  if (issueChatMessageQueuedЗапуститьIsInterrupting(prev.message, prev.interruptingQueuedЗапуститьId) !== issueChatMessageQueuedЗапуститьIsInterrupting(next.message, next.interruptingQueuedЗапуститьId)) return false;
  return true;
}

const ЗадачаChatComposer = forwardRef<ЗадачаChatComposerHandle, ЗадачаChatComposerProps>(function ЗадачаChatComposer({
  onImageЗагрузить,
  onAttachImage,
  draftКлюч,
  enableReassign = false,
  reassignOptions = [],
  currentИсполнительЗначение = "",
  suggestedИсполнительЗначение,
  mentions = [],
  agentMap,
  composerОтключитьdReason = null,
  composerHint = null,
  issueСтатус,
  issueРаботаMode,
  onРаботаModeChange,
}, forwardedRef) {
  const api = useAui();
  const toastActions = useОпциональноToastActions();
  const [body, setBody] = useState("");
  const [submitting, setОтправитьting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachmentItem[]>([]);
  const dragDepthRef = useRef(0);
  const effectiveSuggestedИсполнительЗначение = suggestedИсполнительЗначение ?? currentИсполнительЗначение;
  const [reassignЦель, setReassignЦель] = useState(effectiveSuggestedИсполнительЗначение);
  const [unassignedПодтвердитьed, setНе назначенПодтвердитьed] = useState(false);
  const resolvedЗадачаРаботаMode: ЗадачаРаботаMode = issueРаботаMode ?? "standard";
  const [pendingРаботаMode, setОжиданиеРаботаMode] = useState<ЗадачаРаботаMode>(resolvedЗадачаРаботаMode);
  const [workModeMenuOpen, setРаботаModeMenuOpen] = useState(false);
  const canToggleРаботаMode = typeof onРаботаModeChange === "function";
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<MarkdownИзменитьorRef>(null);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);
  const draftTimer = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const canПринятьФайлы = Boolean(onImageЗагрузить || onAttachImage);

  function queueViewportRestore(snapshot: ReturnТип<typeof captureComposerViewportSnapshot>) {
    if (!snapshot) return;
    requestAnimationFrame(() => {
      restoreComposerViewportSnapshot(snapshot, composerContainerRef.current);
    });
  }

  function focusComposer() {
    if (typeof composerContainerRef.current?.scrollIntoView === "function") {
      composerContainerRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    requestAnimationFrame(() => {
      window.scrollBy({ top: COMPOSER_FOCUS_SCROLL_PADDING_PX, behavior: "smooth" });
      editorRef.current?.focus();
    });
  }

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

  useEffect(() => {
    setНе назначенПодтвердитьed(false);
  }, [reassignЦель]);

  useEffect(() => {
    setОжиданиеРаботаMode(resolvedЗадачаРаботаMode);
  }, [resolvedЗадачаРаботаMode]);

  useImperativeHandle(forwardedRef, () => ({
    focus: focusComposer,
    restoreЧерновик: (submittedBody: string) => {
      setBody((current) =>
        restoreОтправитьtedCommentЧерновик({
          currentBody: current,
          submittedBody,
        }),
      );
      focusComposer();
    },
  }), []);

  async function handleОтправить() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    const composerHasИсполнительPicker = enableReassign && reassignOptions.length > 0;
    if (
      composerHasИсполнительPicker
      && isНе назначенReassignЗначение(reassignЦель)
      && !unassignedПодтвердитьed
    ) {
      toastActions?.pushToast({
        title: "Нет assignee selected",
        body: "Pick an assignee or click Отправить again to post without one.",
        tone: "warn",
        dedupeКлюч: `issue-chat-no-assignee:${draftКлюч ?? ""}`,
      });
      setНе назначенПодтвердитьed(true);
      return;
    }

    const hasReassignment = enableReassign && reassignЦель !== currentИсполнительЗначение;
    const reassignment = hasReassignment ? parseReassignment(reassignЦель) : undefined;
    const reopen = shouldImplicitlyReopenComment(
      issueСтатус,
      hasReassignment ? reassignЦель : currentИсполнительЗначение,
    ) ? true : undefined;
    const submittedBody = trimmed;
    const viewportSnapshot = captureComposerViewportSnapshot(composerContainerRef.current);

    const workModeChanged = pendingРаботаMode !== resolvedЗадачаРаботаMode;
    setОтправитьting(true);
    setBody("");
    setНе назначенПодтвердитьed(false);
    try {
      if (workModeChanged && onРаботаModeChange) {
        await onРаботаModeChange(pendingРаботаMode);
      }
      const appendPromise = api.thread().append({
        role: "user",
        content: [{ type: "text", text: submittedBody }],
        metadata: { custom: {} },
        attachments: [],
        runConfig: {
          custom: {
            ...(reopen ? { reopen: true } : {}),
            ...(reassignment ? { reassignment } : {}),
          },
        },
      });
      queueViewportRestore(viewportSnapshot);
      await appendPromise;
      if (draftКлюч) clearЧерновик(draftКлюч);
      setComposerAttachments([]);
      setReassignЦель(effectiveSuggestedИсполнительЗначение);
    } catch {
      setBody((current) =>
        restoreОтправитьtedCommentЧерновик({
          currentBody: current,
          submittedBody,
        }),
      );
    } finally {
      setОтправитьting(false);
      queueViewportRestore(viewportSnapshot);
    }
  }

  async function attachFile(file: File) {
    const attachmentId = `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2)}`;
    const inline = Boolean(onImageЗагрузить && file.type.startsWith("image/"));
    setComposerAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        name: file.name,
        size: file.size,
        status: "uploading",
        inline,
      },
    ]);

    try {
      if (onImageЗагрузить && file.type.startsWith("image/")) {
        const url = await onImageЗагрузить(file);
        const safeИмя = file.name.replace(/[[\]]/g, "\\$&");
        const markdown = `![${safeИмя}](${url})`;
        setBody((prev) => prev ? `${prev}\n\n${markdown}` : markdown);
        setComposerAttachments((prev) => prev.map((item) =>
          item.id === attachmentId
            ? { ...item, status: "attached", contentПуть: url }
            : item,
        ));
      } else if (onAttachImage) {
        const attachment = await onAttachImage(file);
        setComposerAttachments((prev) => prev.map((item) =>
          item.id === attachmentId
            ? {
                ...item,
                status: "attached",
                contentПуть: attachment?.contentПуть,
                name: attachment?.originalFilename ?? item.name,
              }
            : item,
        ));
      } else {
        setComposerAttachments((prev) => prev.map((item) =>
          item.id === attachmentId
            ? { ...item, status: "error", error: "This file type cannot be attached here" }
            : item,
        ));
      }
    } catch (err) {
      setComposerAttachments((prev) => prev.map((item) =>
        item.id === attachmentId
          ? {
              ...item,
              status: "error",
              error: err instanceof Ошибка ? err.message : "Загрузить failed",
            }
          : item,
      ));
    }
  }

  async function handleAttachFile(evt: ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0];
    if (!file) return;
    setAttaching(true);
    try {
      await attachFile(file);
    } finally {
      setAttaching(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  }

  async function handleDroppedФайлы(files: FileList | null | undefined) {
    if (!files || files.length === 0) return;
    setAttaching(true);
    try {
      for (const file of Array.from(files)) {
        await attachFile(file);
      }
    } finally {
      setAttaching(false);
    }
  }

  function resetDragState() {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }

  function handleFileDragEnter(evt: ReactDragEvent<HTMLDivElement>) {
    if (!canПринятьФайлы || !hasFilePayload(evt)) return;
    evt.preventПо умолчанию();
    evt.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleFileDragOver(evt: ReactDragEvent<HTMLDivElement>) {
    if (!canПринятьФайлы || !hasFilePayload(evt)) return;
    evt.preventПо умолчанию();
    evt.stopPropagation();
    evt.dataTransfer.dropEffect = "copy";
  }

  function handleFileDragLeave(evt: ReactDragEvent<HTMLDivElement>) {
    if (!canПринятьФайлы || !hasFilePayload(evt)) return;
    evt.preventПо умолчанию();
    evt.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }

  function handleFileDrop(evt: ReactDragEvent<HTMLDivElement>) {
    if (!canПринятьФайлы || !hasFilePayload(evt)) return;
    evt.preventПо умолчанию();
    evt.stopPropagation();
    resetDragState();
    void handleDroppedФайлы(evt.dataTransfer?.files);
  }

  const canОтправить = !submitting && !!body.trim();

  if (composerОтключитьdReason) {
    return (
      <div classИмя="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        {composerОтключитьdReason}
      </div>
    );
  }

  const isPlanning = pendingРаботаMode === "planning";

  return (
    <div
      ref={composerContainerRef}
      data-testid="issue-chat-composer"
      data-pending-work-mode={pendingРаботаMode}
      classИмя={cn(
        "relative rounded-md border border-border/70 bg-background/95 p-[15px] shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur transition-[border-color,background-color,box-shadow] duration-150 supports-[backdrop-filter]:bg-background/85 dark:shadow-[0_-12px_28px_rgba(0,0,0,0.28)]",
        isPlanning && "border-amber-500/60 bg-amber-50/60 supports-[backdrop-filter]:bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/[0.07] dark:supports-[backdrop-filter]:bg-amber-500/[0.07]",
        isDragOver && "border-primary/45 bg-background shadow-[0_-12px_28px_rgba(15,23,42,0.08),0_0_0_1px_hsl(var(--primary)/0.16)]",
      )}
      onDragEnterCapture={handleFileDragEnter}
      onDragOverCapture={handleFileDragOver}
      onDragLeaveCapture={handleFileDragLeave}
      onDropCapture={handleFileDrop}
    >
      {isDragOver && canПринятьФайлы ? (
        <div
          data-testid="issue-chat-composer-drop-overlay"
          classИмя="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-sm border border-dashed border-primary/55 bg-background/75 px-4 py-3 text-center shadow-sm backdrop-blur-[2px] dark:bg-background/65"
        >
          <div classИмя="flex max-w-md items-center gap-3 rounded-md bg-background/80 px-3 py-2 text-left shadow-sm ring-1 ring-border/60">
            <span classИмя="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Paperclip classИмя="h-4 w-4" />
            </span>
            <div classИмя="min-w-0">
              <div classИмя="text-sm font-medium text-foreground">Drop to upload</div>
              <div classИмя="mt-0.5 text-xs leading-5 text-muted-foreground">
                Images insert into the reply. Other files are added to this issue.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MarkdownИзменитьor
        ref={editorRef}
        value={body}
        onChange={setBody}
        placeholder="Reply"
        mentions={mentions}
        onОтправить={handleОтправить}
        imageЗагрузитьHandler={onImageЗагрузить}
        fileDropЦель="parent"
        bordered={false}
        contentClassИмя="max-h-[28dvh] overflow-y-auto pr-1 pb-2 text-sm scrollbar-auto-hide"
      />

      {composerHint ? (
        <div classИмя="inline-flex items-center rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
          {composerHint}
        </div>
      ) : null}

      {composerAttachments.length > 0 ? (
        <div
          data-testid="issue-chat-composer-attachments"
          classИмя="mb-3 mt-2 space-y-1.5 rounded-md border border-dashed border-border/80 bg-muted/20 p-2"
        >
          {composerAttachments.map((attachment) => {
            const sizeLabel = formatAttachmentSize(attachment.size);
            const statusLabel =
              attachment.status === "uploading"
                ? "Загрузитьing to issue"
                : attachment.status === "error"
                  ? attachment.error ?? "Загрузить failed"
                  : attachment.inline
                    ? "Inserted inline"
                    : "Attached to issue";
            return (
              <div
                key={attachment.id}
                classИмя={cn(
                  "flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                  attachment.status === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-background/70 text-muted-foreground",
                )}
              >
                {attachment.status === "uploading" ? (
                  <Loader2 classИмя="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : attachment.status === "attached" ? (
                  <Check classИмя="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle classИмя="h-3.5 w-3.5 shrink-0" />
                )}
                <span classИмя="min-w-0 flex-1 truncate font-medium text-foreground">
                  {attachment.name}
                </span>
                {sizeLabel ? (
                  <span classИмя="shrink-0 text-muted-foreground">{sizeLabel}</span>
                ) : null}
                <span classИмя="shrink-0 text-muted-foreground">{statusLabel}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div classИмя="flex flex-wrap items-center justify-end gap-3">
        <div classИмя="mr-auto flex items-center gap-2">
          {(onImageЗагрузить || onAttachImage) ? (
            <>
              <input
                ref={attachInputRef}
                type="file"
                classИмя="hidden"
                onChange={handleAttachFile}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => attachInputRef.current?.click()}
                disabled={attaching}
                title="Attach file"
              >
                <Paperclip classИмя="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {canToggleРаботаMode ? (
            <Popover open={workModeMenuOpen} onOpenChange={setРаботаModeMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-testid="issue-chat-composer-work-mode-menu"
                  title="More composer options"
                >
                  <MoreHorizontal classИмя="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent classИмя="w-44 p-1" align="start">
                <button
                  type="button"
                  data-testid="issue-chat-composer-work-mode-menu-toggle"
                  data-pending-work-mode={pendingРаботаMode}
                  classИмя={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/50",
                    isPlanning ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                  )}
                  onClick={() => {
                    setОжиданиеРаботаMode((prev) => (prev === "planning" ? "standard" : "planning"));
                    setРаботаModeMenuOpen(false);
                  }}
                >
                  {isPlanning ? (
                    <Hammer classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ClipboardList classИмя="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
                  )}
                  <span>{isPlanning ? "Switch to standard" : "Switch to planning"}</span>
                </button>
              </PopoverContent>
            </Popover>
          ) : null}
          {canToggleРаботаMode && isPlanning ? (
            <button
              type="button"
              data-testid="issue-chat-composer-work-mode-toggle"
              data-pending-work-mode={pendingРаботаMode}
              aria-pressed
              title="Planning mode is on for this submission. Click to switch to Standard."
              onClick={() => setОжиданиеРаботаMode("standard")}
              classИмя="inline-flex items-center gap-1.5 rounded-md border border-amber-500/60 bg-amber-500/15 px-2 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-500/25 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
            >
              <ClipboardList classИмя="h-3.5 w-3.5" aria-hidden />
              <span>Planning</span>
            </button>
          ) : null}
        </div>

        {enableReassign && reassignOptions.length > 0 ? (
          <InlineEntitySelector
            value={reassignЦель}
            options={reassignOptions}
            placeholder="Исполнитель"
            noneLabel="Нет assignee"
            searchPlaceholder="Поиск assignees..."
            emptyMessage="Нет assignees found."
            onChange={setReassignЦель}
            classИмя="h-8 text-xs"
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
        ) : null}

        <Button size="sm" disabled={!canОтправить} onClick={() => void handleОтправить()}>
          {submitting ? "Posting..." : "Отправить"}
        </Button>
      </div>
    </div>
  );
});

export function ЗадачаChatThread({
  comments,
  interactions = [],
  feedbackVotes = [],
  feedbackDataSharingPreference = "prompt",
  feedbackTermsUrl = null,
  linkedЗапуститьs = [],
  timelineEvents = [],
  liveЗапуститьs = [],
  activeЗапустить = null,
  blockedBy = [],
  blockerAttention = null,
  successfulЗапуститьHandoff = null,
  companyId,
  projectId,
  issueСтатус,
  agentMap,
  currentUserId,
  userLabelMap,
  userПрофильMap,
  onVote,
  onДобавить,
  onОтменаЗапустить,
  onОстановитьЗапустить,
  stopЗапуститьLabel,
  stoppingЗапуститьLabel,
  stopЗапуститьVariant,
  imageЗагрузитьHandler,
  onAttachImage,
  draftКлюч,
  enableReassign = false,
  reassignOptions = [],
  currentИсполнительЗначение = "",
  suggestedИсполнительЗначение,
  mentions = [],
  composerОтключитьdReason = null,
  composerHint = null,
  showComposer = true,
  showJumpToLatest,
  emptyMessage,
  variant = "full",
  enableLiveTranscriptPolling = true,
  transcriptsByЗапуститьId,
  hasOutputForЗапустить: hasOutputForЗапуститьOverride,
  includeSucceededЗапуститьsWithoutOutput = false,
  onInterruptQueued,
  onОтменаQueued,
  interruptingQueuedЗапуститьId = null,
  stoppingЗапуститьId = null,
  onImageClick,
  onПринятьInteraction,
  onОтклонитьInteraction,
  onОтправитьInteractionAnswers,
  onОтменаInteraction,
  composerRef,
  issueРаботаMode,
  onРаботаModeChange,
  onОбновитьLatestКомментарии,
  assigneeUserId = null,
  onПродолжитьFromНазадlog,
  resumeFromНазадlogОжидание = false,
}: ЗадачаChatThreadProps) {
  const location = useLocation();
  const lastScrolledHashRef = useRef<string | null>(null);
  const virtualizedThreadRef = useRef<VirtualizedЗадачаChatThreadListHandle | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const composerViewportAnchorRef = useRef<HTMLDivElement | null>(null);
  const composerViewportSnapshotRef = useRef<ReturnТип<typeof captureComposerViewportSnapshot>>(null);
  const preserveComposerViewportRef = useRef(false);
  const pendingОтправитьScrollRef = useRef(false);
  const lastUserMessageIdRef = useRef<string | null>(null);
  const spacerBaselineAnchorRef = useRef<string | null>(null);
  const spacerInitialReserveRef = useRef(0);
  const latestSettleTimeoutsRef = useRef<number[]>([]);
  const latestSettleCleanupRef = useRef<(() => void) | null>(null);
  const [bottomSpacerHeight, setБотtomSpacerHeight] = useState(0);
  const displayLiveЗапуститьs = useMemo(() => {
    const deduped = new Map<string, LiveЗапуститьForЗадача>();
    for (const run of liveЗапуститьs) {
      deduped.set(run.id, run);
    }
    if (activeЗапустить) {
      deduped.set(activeЗапустить.id, {
        id: activeЗапустить.id,
        status: activeЗапустить.status,
        invocationSource: activeЗапустить.invocationSource,
        triggerDetail: activeЗапустить.triggerDetail,
        startedAt: toIsoString(activeЗапустить.startedAt),
        finishedAt: toIsoString(activeЗапустить.finishedAt),
        createdAt: toIsoString(activeЗапустить.createdAt) ?? new Date().toISOString(),
        agentId: activeЗапустить.agentId,
        agentИмя: activeЗапустить.agentИмя,
        adapterТип: activeЗапустить.adapterТип,
        logBytes: activeЗапустить.logBytes,
        lastOutputBytes: activeЗапустить.lastOutputBytes,
      });
    }
    return [...deduped.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeЗапустить, liveЗапуститьs]);
  const transcriptЗапуститьs = useMemo(() => {
    return resolveЗадачаChatTranscriptЗапуститьs({
      linkedЗапуститьs,
      liveЗапуститьs: displayLiveЗапуститьs,
      activeЗапустить,
    });
  }, [activeЗапустить, displayLiveЗапуститьs, linkedЗапуститьs]);
  const activeЗапуститьIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of displayLiveЗапуститьs) {
      if (run.status === "queued" || run.status === "running") {
        ids.add(run.id);
      }
    }
    return ids;
  }, [displayLiveЗапуститьs]);
  const clearLatestSettleTimeouts = useCallback(() => {
    for (const timeout of latestSettleTimeoutsRef.current) {
      window.clearTimeout(timeout);
    }
    latestSettleTimeoutsRef.current = [];
    latestSettleCleanupRef.current?.();
    latestSettleCleanupRef.current = null;
  }, []);

  useEffect(() => clearLatestSettleTimeouts, [clearLatestSettleTimeouts]);

  const { transcriptByЗапустить, hasOutputForЗапустить } = useLiveЗапуститьTranscripts({
    runs: enableLiveTranscriptPolling ? transcriptЗапуститьs : [],
    companyId,
  });
  const resolvedTranscriptByЗапустить = transcriptsByЗапуститьId ?? transcriptByЗапустить;
  const resolvedHasOutputForЗапустить = hasOutputForЗапуститьOverride ?? hasOutputForЗапустить;
  const rawMessages = useMemo(
    () =>
      buildЗадачаChatMessages({
        comments,
        interactions,
        timelineEvents,
        linkedЗапуститьs,
        liveЗапуститьs,
        activeЗапустить,
        transcriptsByЗапуститьId: resolvedTranscriptByЗапустить,
        hasOutputForЗапустить: resolvedHasOutputForЗапустить,
        includeSucceededЗапуститьsWithoutOutput,
        companyId,
        projectId,
        agentMap,
        currentUserId,
        userLabelMap,
      }),
    [
      comments,
      interactions,
      timelineEvents,
      linkedЗапуститьs,
      liveЗапуститьs,
      activeЗапустить,
      resolvedTranscriptByЗапустить,
      resolvedHasOutputForЗапустить,
      includeSucceededЗапуститьsWithoutOutput,
      companyId,
      projectId,
      agentMap,
      currentUserId,
      userLabelMap,
    ],
  );
  const stableMessagesRef = useRef<readonly ThreadMessage[]>([]);
  const stableMessageCacheRef = useRef<Map<string, StableThreadMessageCacheEntry>>(new Map());
  const messages = useMemo(() => {
    const stabilized = stabilizeThreadMessages(
      rawMessages,
      stableMessagesRef.current,
      stableMessageCacheRef.current,
    );
    stableMessagesRef.current = stabilized.messages;
    stableMessageCacheRef.current = stabilized.cache;
    return stabilized.messages;
  }, [rawMessages]);
  const latestMessagesRef = useRef<readonly ThreadMessage[]>(messages);
  latestMessagesRef.current = messages;

  const isВыполняется = displayLiveЗапуститьs.some((run) => run.status === "queued" || run.status === "running");
  const unresolvedBlockers = useMemo(
    () => blockedBy.filter((blocker) => blocker.status !== "done" && blocker.status !== "cancelled"),
    [blockedBy],
  );
  const assignedАгент = useMemo(() => {
    if (!currentИсполнительЗначение.startsWith("agent:")) return null;
    const assigneeАгентId = currentИсполнительЗначение.slice("agent:".length);
    return agentMap?.get(assigneeАгентId) ?? null;
  }, [agentMap, currentИсполнительЗначение]);
  const feedbackVoteByЦельId = useMemo(() => {
    const map = new Map<string, FeedbackVoteЗначение>();
    for (const feedbackVote of feedbackVotes) {
      if (feedbackVote.targetТип !== "issue_comment") continue;
      map.set(feedbackVote.targetId, feedbackVote.vote);
    }
    return map;
  }, [feedbackVotes]);
  const useVirtualizedThread = messages.length >= VIRTUALIZED_THREAD_ROW_THRESHOLD;
  const messageAnchorIndex = useMemo(() => {
    const map = new Map<string, number>();
    messages.forEach((message, index) => {
      const anchorId = issueChatMessageAnchorId(message);
      if (anchorId) map.set(anchorId, index);
    });
    return map;
  }, [messages]);

  function scrollToThreadAnchor(
    anchorId: string,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: ScrollBehavior },
    messageSnapshot: readonly ThreadMessage[] = messages,
  ) {
    const snapshotUsesVirtualizer = messageSnapshot.length >= VIRTUALIZED_THREAD_ROW_THRESHOLD;
    const virtualIndex =
      messageSnapshot === messages
        ? messageAnchorIndex.get(anchorId)
        : findMessageAnchorIndex(messageSnapshot, anchorId);
    if (snapshotUsesVirtualizer && virtualIndex !== undefined && virtualIndex >= 0) {
      if (!virtualizedThreadRef.current) return false;
      virtualizedThreadRef.current.scrollToIndex(virtualIndex, {
        align: options?.align ?? "center",
        behavior: options?.behavior ?? "smooth",
      });
      return true;
    }

    const element = document.getElementById(anchorId);
    if (!element) return false;
    element.scrollIntoView({
      behavior: options?.behavior ?? "smooth",
      block: options?.align === "start"
        ? "start"
        : options?.align === "end"
          ? "end"
          : "center",
    });
    return true;
  }

  const runtime = usePaperclipЗадачаЗапуститьtime({
    messages,
    isВыполняется,
    onОтправить: ({ body, reopen, reassignment }) => {
      pendingОтправитьScrollRef.current = true;
      return onДобавить(body, reopen, reassignment);
    },
    onОтмена: onОтменаЗапустить,
  });

  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const lastUserId = lastUserMessage?.id ?? null;

    if (
      pendingОтправитьScrollRef.current
      && lastUserId
      && lastUserId !== lastUserMessageIdRef.current
    ) {
      pendingОтправитьScrollRef.current = false;
      const custom = lastUserMessage?.metadata.custom as { anchorId?: unknown } | undefined;
      const anchorId = typeof custom?.anchorId === "string" ? custom.anchorId : null;
      if (anchorId) {
        const reserve = Math.round(window.innerHeight * SUBMIT_SCROLL_RESERVE_VH);
        spacerBaselineAnchorRef.current = anchorId;
        spacerInitialReserveRef.current = reserve;
        setБотtomSpacerHeight(reserve);
        requestAnimationFrame(() => {
          scrollToThreadAnchor(anchorId, { align: "start", behavior: "smooth" });
        });
      }
    }

    lastUserMessageIdRef.current = lastUserId;
  }, [messageAnchorIndex, messages, useVirtualizedThread]);

  useLayoutEffect(() => {
    const anchorId = spacerBaselineAnchorRef.current;
    if (!anchorId || spacerInitialReserveRef.current <= 0) return;
    const userEl = document.getElementById(anchorId);
    const bottomEl = bottomAnchorRef.current;
    if (!userEl || !bottomEl) return;
    const contentBelow = Math.max(
      0,
      bottomEl.getBoundingClientRect().top - userEl.getBoundingClientRect().bottom,
    );
    const next = Math.max(0, spacerInitialReserveRef.current - contentBelow);
    setБотtomSpacerHeight((prev) => (prev === next ? prev : next));
    if (next === 0) {
      spacerBaselineAnchorRef.current = null;
      spacerInitialReserveRef.current = 0;
    }
  }, [messages]);
  useLayoutEffect(() => {
    const composerElement = composerViewportAnchorRef.current;
    if (preserveComposerViewportRef.current) {
      restoreComposerViewportSnapshot(
        composerViewportSnapshotRef.current,
        composerElement,
      );
    }

    composerViewportSnapshotRef.current = captureComposerViewportSnapshot(composerElement);
    preserveComposerViewportRef.current = shouldPreserveComposerViewport(composerElement);
  }, [messages]);

  useEffect(() => {
    const hash = location.hash || (typeof window !== "undefined" ? window.location.hash : "");
    if (
      !(
        hash.startsWith("#comment-")
        || hash.startsWith("#activity-")
        || hash.startsWith("#run-")
        || hash.startsWith("#interaction-")
      )
    ) return;
    if (messages.length === 0 || lastScrolledHashRef.current === hash) return;
    const targetId = hash.slice(1);
    let cancelled = false;
    const attemptScroll = (finalAttempt = false) => {
      if (cancelled || lastScrolledHashRef.current === hash) return;
      const didScroll = scrollToThreadAnchor(targetId, { align: "center", behavior: "smooth" });
      if (!didScroll) return;
      if (finalAttempt || !useVirtualizedThread || document.getElementById(targetId)) {
        lastScrolledHashRef.current = hash;
      }
    };

    attemptScroll();
    const frame = requestAnimationFrame(() => attemptScroll());
    const timeout = window.setTimeout(() => attemptScroll(true), 250);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [location.hash, messageAnchorIndex, messages, useVirtualizedThread]);

  function jumpToLatestFallback() {
    if (useVirtualizedThread) {
      virtualizedThreadRef.current?.scrollToLatest({ behavior: "smooth" });
      return;
    }
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // Lands on the latest `comment-*` row and then drives the scroll the rest
  // of the way home as the virtualizer's per-row measurements arrive.
  //
  // The virtualizer estimates 220px for unmeasured rows. On long threads
  // with tall markdown comments (PAP-2536 et al.), totalSize is hugely
  // underestimated until rows render and get measured. A single scroll
  // lands above the actual bottom; rendered rows then expand, the layout
  // grows, and the user has to keep clicking Jump-to-latest to walk closer
  // to the real bottom. The convergence loop below issues `scrollIntoView`
  // on the latest comment element on every tick until the DOM bottom of
  // that element is at the scroll container's bottom (or scroll position
  // and content height stop changing).
  function scrollToLatestCommentWithSettle(messageSnapshot: readonly ThreadMessage[] = latestMessagesRef.current) {
    const latestCommentIndex = findLatestCommentMessageIndex(messageSnapshot);
    if (latestCommentIndex < 0) {
      jumpToLatestFallback();
      return;
    }
    const latestCommentAnchor = issueChatMessageAnchorId(messageSnapshot[latestCommentIndex]);
    if (!latestCommentAnchor) {
      jumpToLatestFallback();
      return;
    }

    const initial = scrollToThreadAnchor(
      latestCommentAnchor,
      { align: "end", behavior: "smooth" },
      messageSnapshot,
    );
    if (!initial) {
      jumpToLatestFallback();
      return;
    }

    if (typeof window === "undefined") return;

    const startedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const MAX_DURATION_MS = 4000;
    const TICK_MS = 80;
    const TOLERANCE_PX = 4;

    clearLatestSettleTimeouts();
    const resolveScrollContainer = (): HTMLElement | null =>
      (document.getElementById("main-content") as HTMLElement | null);
    const cancelЦель = resolveScrollContainer() ?? window;

    let lastScrollTop = -1;
    let lastScrollHeight = -1;
    let stableTicks = 0;
    let cancelled = false;

    const cancel = () => {
      cancelled = true;
    };

    const cleanup = () => {
      cancelЦель.removeEventListener("wheel", cancel);
      cancelЦель.removeEventListener("touchstart", cancel);
    };

    cancelЦель.addEventListener("wheel", cancel, { once: true, passive: true });
    cancelЦель.addEventListener("touchstart", cancel, { once: true, passive: true });
    latestSettleCleanupRef.current = cleanup;

    const finish = () => {
      cleanup();
      latestSettleCleanupRef.current = null;
      for (const timeout of latestSettleTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }
      latestSettleTimeoutsRef.current = [];
    };

    const scheduleTick = (delay: number) => {
      const timeout = window.setTimeout(() => {
        latestSettleTimeoutsRef.current = latestSettleTimeoutsRef.current.filter((entry) => entry !== timeout);
        tick();
      }, delay);
      latestSettleTimeoutsRef.current.push(timeout);
    };

    const tick = () => {
      const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
      if (cancelled || now - startedAt > MAX_DURATION_MS) {
        finish();
        return;
      }

      if (typeof document === "undefined") {
        finish();
        return;
      }

      const el = document.getElementById(latestCommentAnchor);
      if (!el) {
        // Row hasn't been rendered into the virtualizer's buffer yet — nudge
        // the offset (instant) so it gets mounted, then keep settling.
        virtualizedThreadRef.current?.scrollToIndex(latestCommentIndex, {
          align: "end",
          behavior: "auto",
        });
        scheduleTick(TICK_MS);
        return;
      }

      const container = resolveScrollContainer();
      const containerБотtom = container
        ? container.getBoundingClientRect().bottom
        : window.innerHeight;
      const elБотtom = el.getBoundingClientRect().bottom;
      const offБотtom = elБотtom - containerБотtom;

      if (Math.abs(offБотtom) > TOLERANCE_PX) {
        el.scrollIntoView({ behavior: "smooth", block: "end" });
      }

      const currentScrollTop = container?.scrollTop ?? window.scrollY;
      const currentScrollHeight = container?.scrollHeight ?? document.documentElement.scrollHeight;
      const scrollStable = Math.abs(currentScrollTop - lastScrollTop) < 1;
      const heightStable = currentScrollHeight === lastScrollHeight;
      const atБотtom = Math.abs(offБотtom) <= TOLERANCE_PX;
      if (scrollStable && heightStable && atБотtom) {
        stableTicks += 1;
        if (stableTicks >= 3) {
          finish();
          return;
        }
      } else {
        stableTicks = 0;
      }
      lastScrollTop = currentScrollTop;
      lastScrollHeight = currentScrollHeight;
      scheduleTick(TICK_MS);
    };

    // Hold the first iteration off for one frame so the initial smooth
    // scroll has begun (and the virtualizer has rendered the buffer around
    // the target) before we start settling.
    scheduleTick(120);
  }

  function handleJumpToLatest() {
    if (onОбновитьLatestКомментарии) {
      // Refetching the comments query (page 0 first) brings any comment that
      // arrived after the initial load — including ones live updates may
      // have missed during reconnects — into the loaded set before we
      // resolve the latest target. Otherwise we'd land on the latest
      // *loaded* comment but not the absolute newest. (PAP-2672 follow-up.)
      const refreshed = onОбновитьLatestКомментарии();
      if (refreshed && typeof (refreshed as Promise<unknown>).then === "function") {
        (refreshed as Promise<unknown>).then(
          () => scrollToLatestCommentWithSettle(latestMessagesRef.current),
          () => scrollToLatestCommentWithSettle(latestMessagesRef.current),
        );
        return;
      }
    }
    scrollToLatestCommentWithSettle(latestMessagesRef.current);
  }

  const stableOnVote = useStableEvent(onVote);
  const stableOnОстановитьЗапустить = useStableEvent(onОстановитьЗапустить);
  const stableOnInterruptQueued = useStableEvent(onInterruptQueued);
  const stableOnОтменаQueued = useStableEvent(onОтменаQueued);
  const stableOnImageClick = useStableEvent(onImageClick);
  const stableOnПринятьInteraction = useStableEvent(onПринятьInteraction);
  const stableOnОтклонитьInteraction = useStableEvent(onОтклонитьInteraction);
  const stableOnОтправитьInteractionAnswers = useStableEvent(onОтправитьInteractionAnswers);
  const stableOnОтменаInteraction = useStableEvent(onОтменаInteraction);

  const chatCtx = useMemo<ЗадачаChatMessageContext>(
    () => ({
      feedbackDataSharingPreference,
      feedbackTermsUrl,
      agentMap,
      currentUserId,
      userLabelMap,
      userПрофильMap,
      onVote: stableOnVote,
      onОстановитьЗапустить: stableOnОстановитьЗапустить,
      stopЗапуститьLabel,
      stoppingЗапуститьLabel,
      stopЗапуститьVariant,
      onInterruptQueued: stableOnInterruptQueued,
      onОтменаQueued: stableOnОтменаQueued,
      onImageClick: stableOnImageClick,
      onПринятьInteraction: stableOnПринятьInteraction,
      onОтклонитьInteraction: stableOnОтклонитьInteraction,
      onОтправитьInteractionAnswers: stableOnОтправитьInteractionAnswers,
      onОтменаInteraction: stableOnОтменаInteraction,
      issueСтатус,
      successfulЗапуститьHandoff,
    }),
    [
      feedbackDataSharingPreference,
      feedbackTermsUrl,
      agentMap,
      currentUserId,
      userLabelMap,
      userПрофильMap,
      stableOnVote,
      stableOnОстановитьЗапустить,
      stopЗапуститьLabel,
      stoppingЗапуститьLabel,
      stopЗапуститьVariant,
      stableOnInterruptQueued,
      stableOnОтменаQueued,
      stableOnImageClick,
      stableOnПринятьInteraction,
      stableOnОтклонитьInteraction,
      stableOnОтправитьInteractionAnswers,
      stableOnОтменаInteraction,
      issueСтатус,
      successfulЗапуститьHandoff,
    ],
  );

  const resolvedShowJumpToLatest = showJumpToLatest ?? variant === "full";
  const resolvedEmptyMessage = emptyMessage
    ?? (variant === "embedded"
      ? "Нет run output yet."
      : "This issue conversation is empty. Начать with a message below.");
  const previousОшибкаBoundaryMessagesRef = useRef<readonly ThreadMessage[] | null>(null);
  const errorBoundaryСброситьВерсияRef = useRef(0);
  if (previousОшибкаBoundaryMessagesRef.current !== messages) {
    previousОшибкаBoundaryMessagesRef.current = messages;
    errorBoundaryСброситьВерсияRef.current += 1;
  }
  const errorBoundaryСброситьКлюч = String(errorBoundaryСброситьВерсияRef.current);

  return (
    <AssistantЗапуститьtimeПровайдер runtime={runtime}>
      <ЗадачаChatCtx.Провайдер value={chatCtx}>
      <div classИмя={cn(variant === "embedded" ? "space-y-3" : "space-y-4")}>
        {resolvedShowJumpToLatest ? (
          <div classИмя="flex justify-end">
            <button
              type="button"
              onClick={handleJumpToLatest}
              classИмя="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Jump to latest
            </button>
          </div>
        ) : null}

        <ЗадачаChatОшибкаBoundary
          resetКлюч={errorBoundaryСброситьКлюч}
          messages={messages}
          emptyMessage={resolvedEmptyMessage}
          variant={variant}
        >
          <div data-testid="thread-root">
            <div
              data-testid="thread-viewport"
              classИмя={variant === "embedded" ? "space-y-3" : "space-y-4"}
            >
              {messages.length === 0 ? (
                <div classИмя={cn(
                  "text-center text-sm text-muted-foreground",
                  variant === "embedded"
                    ? "rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6"
                    : "rounded-2xl border border-dashed border-border bg-card px-6 py-10",
                )}>
                  {resolvedEmptyMessage}
                </div>
              ) : messages.length >= VIRTUALIZED_THREAD_ROW_THRESHOLD ? (
                <VirtualizedЗадачаChatThreadList
                  ref={virtualizedThreadRef}
                  messages={messages}
                  feedbackVoteByЦельId={feedbackVoteByЦельId}
                  activeЗапуститьIds={activeЗапуститьIds}
                  stoppingЗапуститьId={stoppingЗапуститьId}
                  interruptingQueuedЗапуститьId={interruptingQueuedЗапуститьId}
                  variant={variant}
                />
              ) : (
                // Keep transcript rendering independent from assistant-ui's
                // index-scoped message providers; live transcripts can shrink
                // or regroup while the runtime still holds stale indices.
                messages.map((message) => (
                  <ЗадачаChatMessageRow
                    key={message.id}
                    message={message}
                    feedbackVoteByЦельId={feedbackVoteByЦельId}
                    activeЗапуститьIds={activeЗапуститьIds}
                    stoppingЗапуститьId={stoppingЗапуститьId}
                    interruptingQueuedЗапуститьId={interruptingQueuedЗапуститьId}
                  />
              ))
            )}
              {showComposer ? (
                <div data-testid="issue-chat-thread-notices" classИмя="space-y-2">
                  <ЗадачаAssignedНазадlogНетtice
                    issueСтатус={issueСтатус ?? ""}
                    assigneeАгент={assignedАгент}
                    assigneeUserId={assigneeUserId}
                    onПродолжить={onПродолжитьFromНазадlog}
                    resuming={resumeFromНазадlogОжидание}
                  />
                  <ЗадачаЗаблокированНетtice
                    issueСтатус={issueСтатус}
                    blockers={unresolvedBlockers}
                    blockerAttention={blockerAttention}
                    successfulЗапуститьHandoff={successfulЗапуститьHandoff}
                    agentИмя={
                      successfulЗапуститьHandoff?.assigneeАгентId
                        ? agentMap?.get(successfulЗапуститьHandoff.assigneeАгентId)?.name ?? null
                        : null
                    }
                  />
                  <ЗадачаИсполнительПриостановленНетtice agent={assignedАгент} />
                </div>
              ) : null}
              <div ref={bottomAnchorRef} />
              {showComposer ? (
                <div
                  aria-hidden
                  data-testid="issue-chat-bottom-spacer"
                  style={{ height: bottomSpacerHeight }}
                />
              ) : null}
            </div>
          </div>
        </ЗадачаChatОшибкаBoundary>

        {showComposer ? (
          <div
            ref={composerViewportAnchorRef}
            data-testid="issue-chat-composer-dock"
            classИмя="sticky bottom-[calc(env(safe-area-inset-bottom)+20px)] z-20 space-y-2 bg-gradient-to-t from-background via-background/95 to-background/0 pt-6"
          >
            <ЗадачаChatComposer
              ref={composerRef}
              onImageЗагрузить={imageЗагрузитьHandler}
              onAttachImage={onAttachImage}
              draftКлюч={draftКлюч}
              enableReassign={enableReassign}
              reassignOptions={reassignOptions}
              currentИсполнительЗначение={currentИсполнительЗначение}
              suggestedИсполнительЗначение={suggestedИсполнительЗначение}
              mentions={mentions}
              agentMap={agentMap}
              composerОтключитьdReason={composerОтключитьdReason}
              composerHint={composerHint}
              issueСтатус={issueСтатус}
              issueРаботаMode={issueРаботаMode}
              onРаботаModeChange={onРаботаModeChange}
            />
          </div>
        ) : null}
      </div>
      </ЗадачаChatCtx.Провайдер>
    </AssistantЗапуститьtimeПровайдер>
  );
}
