import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type Ref } from "react";
import { pickTextColorForPillBg } from "@/lib/color-contrast";
import { Link, useLocation, useNavigate, useNavigationТип, useParams } from "@/lib/router";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { ApiОшибка } from "../api/client";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { activityApi, type ЗапуститьForЗадача } from "../api/activity";
import { heartbeatsApi, type АктивенЗапуститьForЗадача, type LiveЗапуститьForЗадача } from "../api/heartbeats";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { projectsApi } from "../api/projects";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { useSidebar } from "../context/SidebarContext";
import { useToastActions } from "../context/ToastContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { assigneeЗначениеFromSelection, suggestedCommentИсполнительЗначение } from "../lib/assignees";
import { buildКомпанияUserInlineOptions, buildКомпанияUserLabelMap, buildКомпанияUserПрофильMap, buildMarkdownMentionOptions } from "../lib/company-members";
import { extractЗадачаTimelineEvents } from "../lib/issue-timeline-events";
import { queryКлючs } from "../lib/queryКлючs";
import { keepPreviousDataForSameQueryTail } from "../lib/query-placeholder-data";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import {
  hasLegacyЗадачаDetailQuery,
  createЗадачаDetailПуть,
  readЗадачаDetailLocationState,
  readЗадачаDetailBreadcrumb,
  readЗадачаDetailHeaderSeed,
  rememberЗадачаDetailLocationState,
} from "../lib/issueDetailBreadcrumb";
import { resolveЗадачаАктивенЗапустить, shouldTrackЗадачаАктивенЗапустить } from "../lib/issueАктивенЗапустить";
import { getЗадачаDetailQueryOptions } from "../lib/issueDetailCache";
import {
  hasBlockingShortcutDialog,
  resolveЗадачаDetailGoКлючAction,
  resolveВходящиеQuickАрхивироватьКлючAction,
} from "../lib/keyboardShortcuts";
import {
  applyOptimisticЗадачаFieldОбновить,
  applyOptimisticЗадачаFieldОбновитьToCollection,
  applyOptimisticЗадачаCommentОбновить,
  applyLocalQueuedЗадачаCommentState,
  createOptimisticЗадачаComment,
  flattenЗадачаCommentPages,
  getДалееЗадачаCommentPageParam,
  isQueuedЗадачаComment,
  loadRemainingЗадачаCommentPages,
  matchesЗадачаRef,
  mergeЗадачаКомментарии,
  removeЗадачаCommentFromPages,
  shouldАвтоloadOlderЗадачаКомментарии,
  takeOptimisticЗадачаComment,
  upsertЗадачаCommentInPages,
  type ЗадачаCommentReassignment,
  type OptimisticЗадачаComment,
} from "../lib/optimistic-issue-comments";
import { clearЗадачаExecutionЗапустить, removeLiveЗапуститьById, upsertInterruptedЗапустить } from "../lib/optimistic-issue-runs";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { relativeTime, cn, formatDurationMs, formatТокенs, visibleЗапуститьCostUsd } from "../lib/utils";
import { СогласованиеCard } from "../components/СогласованиеCard";
import { InlineИзменитьor } from "../components/InlineИзменитьor";
import { ЗадачаChatThread, type ЗадачаChatComposerHandle } from "../components/ЗадачаChatThread";
import { ЗадачаContinuationHandoff } from "../components/ЗадачаContinuationHandoff";
import { ЗадачаДокументыSection } from "../components/ЗадачаДокументыSection";
import { ЗадачиList } from "../components/ЗадачиList";
import { АгентIcon } from "../components/АгентIconPicker";
import { ЗадачаReferenceАктивностьSummary } from "../components/ЗадачаReferenceАктивностьSummary";
import { ЗадачаRelatedРаботаPanel } from "../components/ЗадачаRelatedРаботаPanel";
import { ЗадачаMonitorАктивностьCard } from "../components/ЗадачаMonitorАктивностьCard";
import { ЗадачаРасписаниеdПовторитьCard } from "../components/ЗадачаРасписаниеdПовторитьCard";
import { ЗадачаProperties } from "../components/ЗадачаProperties";
import { ЗадачаЗапуститьLedger } from "../components/ЗадачаЗапуститьLedger";
import { ЗадачаРабочая областьCard } from "../components/ЗадачаРабочая областьCard";
import type { MentionOption } from "../components/MarkdownИзменитьor";
import { ImageGalleryModal } from "../components/ImageGalleryModal";
import { ScrollToБотtom } from "../components/ScrollToБотtom";
import { СтатусIcon } from "../components/СтатусIcon";
import { ПриоритетIcon } from "../components/ПриоритетIcon";
import { ProductivityReviewBadge } from "../components/ProductivityReviewBadge";
import { Identity } from "../components/Identity";
import { PluginSlotMount, PluginSlotOutlet, usePluginSlots } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetНазвание } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatЗадачаАктивностьAction } from "@/lib/activity-format";
import { buildЗадачаPropertiesPanelКлюч } from "../lib/issue-properties-panel-key";
import { shouldRenderRichSubЗадачиSection } from "../lib/issue-detail-subissues";
import { filterЗадачаDescendants } from "../lib/issue-tree";
import { buildSubЗадачаПо умолчаниюsForViewer } from "../lib/subЗадачаПо умолчаниюs";
import {
  SUCCESSFUL_RUN_HANDOFF_ESCALATED_ACTION,
  SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION,
  successfulЗапуститьHandoffАктивностьTone,
} from "../lib/successful-run-handoff";
import { hasAssignedНазадlogBlocker } from "../lib/issue-blockers";
import {
  Активность as АктивностьIcon,
  AlertTriangle,
  Архивировать,
  ArrowLeft,
  Check,
  ChevronRight,
  Копировать,
  Eye,
  EyeOff,
  Flag,
  Hexagon,
  ListTree,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  ПаузаCircle,
  Paperclip,
  PlayCircle,
  Plus,
  Repeat,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  getЗакрытьdIsolatedExecutionРабочая областьMessage,
  isЗакрытьdIsolatedExecutionРабочая область,
  ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY,
  type AskUserQuestionsAnswer,
  type AskUserQuestionsInteraction,
  type АктивностьEvent,
  type Агент,
  type FeedbackVote,
  type Задача,
  type ЗадачаAttachment,
  type ЗадачаComment,
  type ЗадачаРаботаMode,
  type ЗадачаThreadInteraction,
  type RequestПодтвердитьationInteraction,
  type SuggestЗадачиInteraction,
  type ЗадачаTreeControlMode,
} from "@paperclipai/shared";

type CommentReassignment = ЗадачаCommentReassignment;
type ActionableЗадачаThreadInteraction = SuggestЗадачиInteraction | RequestПодтвердитьationInteraction;
type ЗадачаDetailComment = (ЗадачаComment | OptimisticЗадачаComment) & {
  runId?: string | null;
  runАгентId?: string | null;
  interruptedЗапуститьId?: string | null;
  queueState?: "queued";
  queueЦельЗапуститьId?: string | null;
  queueReason?: "hold" | "active_run" | "other";
};

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://paperclip.ing/tos";
const ISSUE_COMMENT_PAGE_SIZE = 50;
const ISSUE_COMMENT_AUTOLOAD_LIMIT = ISSUE_COMMENT_PAGE_SIZE * 3;
const JUMP_TO_LATEST_MAX_COMMENT_PAGES = 10;
const TREE_CONTROL_MODE_LABEL: Record<ЗадачаTreeControlMode, string> = {
  pause: "Пауза subtree",
  resume: "Продолжить subtree",
  cancel: "Отмена subtree",
  restore: "Restore subtree",
};
const LEAF_WORK_CONTROL_MODE_LABEL: Partial<Record<ЗадачаTreeControlMode, string>> = {
  pause: "Пауза work",
  resume: "Продолжить work",
};
const TREE_CONTROL_MODE_HELP_TEXT: Record<ЗадачаTreeControlMode, string> = {
  pause: "Пауза active execution in this issue subtree until an explicit resume.",
  resume: "Release the active subtree pause hold so held work can continue.",
  cancel: "Отмена non-terminal issues in this subtree and stop queued/running work where possible.",
  restore: "Restore issues cancelled by this subtree operation so work can resume.",
};
const LEAF_WORK_CONTROL_MODE_HELP_TEXT: Partial<Record<ЗадачаTreeControlMode, string>> = {
  pause: "Пауза active execution on this issue until an explicit resume.",
  resume: "Release the active pause hold so this issue can continue.",
};
function issueTreeControlLabel(mode: ЗадачаTreeControlMode, scope: "leaf" | "subtree") {
  return scope === "leaf"
    ? LEAF_WORK_CONTROL_MODE_LABEL[mode] ?? TREE_CONTROL_MODE_LABEL[mode]
    : TREE_CONTROL_MODE_LABEL[mode];
}

function issueTreeControlHelpText(mode: ЗадачаTreeControlMode, scope: "leaf" | "subtree") {
  return scope === "leaf"
    ? LEAF_WORK_CONTROL_MODE_HELP_TEXT[mode] ?? TREE_CONTROL_MODE_HELP_TEXT[mode]
    : TREE_CONTROL_MODE_HELP_TEXT[mode];
}

function treeControlПредпросмотрОшибкаКопировать(error: unknown): string {
  if (error instanceof ApiОшибка) {
    if (error.status === 403) return "Only board users can preview subtree controls.";
    if (error.status === 409) return "Предпросмотр is stale because subtree hold state changed. Повторить to refresh.";
    if (error.status === 422) return "This subtree action is currently invalid for the selected issues.";
  }
  return error instanceof Ошибка ? error.message : "Unable to load preview.";
}

function resolveВыполняетсяЗадачаЗапустить(
  activeЗапустить: АктивенЗапуститьForЗадача | null | undefined,
  liveЗапуститьs: readonly LiveЗапуститьForЗадача[] | undefined,
) {
  return activeЗапустить?.status === "running"
    ? activeЗапустить
    : (liveЗапуститьs ?? []).find((run) => run.status === "running") ?? null;
}

function dedupeLiveЗапуститьsById(liveЗапуститьs: readonly LiveЗапуститьForЗадача[]) {
  const seen = new Set<string>();
  return liveЗапуститьs.filter((run) => {
    if (seen.has(run.id)) return false;
    seen.add(run.id);
    return true;
  });
}

function readЗадачаЗапуститьStateFromCache(queryClient: QueryClient, issueId: string) {
  const liveЗапуститьs = queryClient.getQueryData<LiveЗапуститьForЗадача[]>(
    queryКлючs.issues.liveЗапуститьs(issueId),
  );
  const activeЗапустить = queryClient.getQueryData<АктивенЗапуститьForЗадача | null>(
    queryКлючs.issues.activeЗапустить(issueId),
  );
  return {
    liveЗапуститьs,
    activeЗапустить,
    runningЗадачаЗапустить: resolveВыполняетсяЗадачаЗапустить(activeЗапустить, liveЗапуститьs),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function isMarkdownFile(file: File) {
  const name = file.name.toНизкийerCase();
  return (
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    file.type === "text/markdown"
  );
}

function fileBaseИмя(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function slugifyDocumentКлюч(input: string) {
  const slug = input
    .trim()
    .toНизкийerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}

function titleizeFilename(input: string) {
  return input
    .split(/[-_ ]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mergeOptimisticFeedbackVote(
  previousVotes: FeedbackVote[] | undefined,
  nextVote: {
    issueId: string;
    targetТип: "issue_comment" | "issue_document_revision";
    targetId: string;
    vote: "up" | "down";
    reason?: string;
  },
  currentUserId: string | null,
): FeedbackVote[] {
  const now = new Date();
  const existingVotes = previousVotes ?? [];
  const existingIndex = existingVotes.findIndex(
    (feedbackVote) =>
      feedbackVote.targetТип === nextVote.targetТип &&
      feedbackVote.targetId === nextVote.targetId &&
      (!currentUserId || feedbackVote.authorUserId === currentUserId),
  );

  if (existingIndex >= 0) {
    const existingVote = existingVotes[existingIndex]!;
    const updatedVote: FeedbackVote = {
      ...existingVote,
      vote: nextVote.vote,
      reason:
        nextVote.reason !== undefined
          ? nextVote.reason.trim() || null
          : existingVote.reason,
      updatedAt: now,
    };
    const nextVotes = [...existingVotes];
    nextVotes[existingIndex] = updatedVote;
    return nextVotes;
  }

  return [
    ...existingVotes,
    {
      id: `optimistic:${nextVote.targetТип}:${nextVote.targetId}`,
      companyId: "",
      issueId: nextVote.issueId,
      targetТип: nextVote.targetТип,
      targetId: nextVote.targetId,
      authorUserId: currentUserId ?? "current-user",
      vote: nextVote.vote,
      reason: nextVote.reason?.trim() || null,
      sharedWithLabs: false,
      sharedAt: null,
      consentВерсия: null,
      redactionSummary: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function ActorIdentity({ evt, agentMap, userПрофильMap }: { evt: АктивностьEvent; agentMap: Map<string, Агент>; userПрофильMap?: Map<string, import("../lib/company-members").КомпанияUserПрофиль> }) {
  const id = evt.actorId;
  if (evt.actorТип === "agent") {
    const agent = agentMap.get(id);
    return <Identity name={agent?.name ?? id.slice(0, 8)} size="sm" />;
  }
  if (evt.actorТип === "system") return <Identity name="System" size="sm" />;
  if (evt.actorТип === "user") {
    const profile = userПрофильMap?.get(id);
    return <Identity name={profile?.label ?? "Совет"} avatarUrl={profile?.image} size="sm" />;
  }
  return <Identity name={id || "Неизвестно"} size="sm" />;
}

function ЗадачаSectionSkeleton({
  titleWidth = "w-28",
  rows = 3,
}: {
  titleWidth?: string;
  rows?: number;
}) {
  return (
    <div classИмя="space-y-3 rounded-lg border border-border p-3">
      <Skeleton classИмя={cn("h-4", titleWidth)} />
      <div classИмя="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} classИмя="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function ЗадачаChatSkeleton() {
  return (
    <div classИмя="space-y-3 rounded-lg border border-border p-3">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <Skeleton classИмя="h-8 w-8 rounded-full" />
          <div classИмя="space-y-2">
            <Skeleton classИмя="h-3 w-24" />
            <Skeleton classИмя="h-3 w-16" />
          </div>
        </div>
        <Skeleton classИмя="h-20 w-full rounded-xl" />
      </div>
      <div classИмя="space-y-2">
        <div classИмя="flex items-center justify-end gap-2">
          <div classИмя="space-y-2 text-right">
            <Skeleton classИмя="ml-auto h-3 w-20" />
            <Skeleton classИмя="ml-auto h-3 w-14" />
          </div>
          <Skeleton classИмя="h-8 w-8 rounded-full" />
        </div>
        <Skeleton classИмя="ml-auto h-16 w-[85%] rounded-xl" />
      </div>
      <div classИмя="space-y-2 border-t border-border pt-3">
        <Skeleton classИмя="h-3 w-28" />
        <Skeleton classИмя="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

function ЗадачаDetailЗагрузкаState({
  headerSeed,
}: {
  headerSeed: ReturnТип<typeof readЗадачаDetailHeaderSeed>;
}) {
  const identifier = headerSeed?.identifier ?? headerSeed?.id.slice(0, 8) ?? null;

  return (
    <div classИмя="max-w-3xl space-y-6">
      <div classИмя="space-y-3">
        <Skeleton classИмя="h-3 w-40" />

        <div classИмя="flex items-center gap-2 min-w-0 flex-wrap">
          {headerSeed ? (
            <>
              <СтатусIcon status={headerSeed.status} blockerAttention={headerSeed.blockerAttention} />
              <ПриоритетIcon priority={headerSeed.priority} />
              {identifier ? (
                <span classИмя="text-sm font-mono text-muted-foreground shrink-0">{identifier}</span>
              ) : null}
              {headerSeed.originKind === "routine_execution" && headerSeed.originId ? (
                <span classИмя="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 shrink-0">
                  <Repeat classИмя="h-3 w-3" />
                  Процедура
                </span>
              ) : null}
              {headerSeed.projectId ? (
                <span classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground rounded px-1 -mx-1 py-0.5 min-w-0">
                  <Hexagon classИмя="h-3 w-3 shrink-0" />
                  <span classИмя="truncate">
                    {headerSeed.projectИмя ?? headerSeed.projectId.slice(0, 8)}
                  </span>
                </span>
              ) : (
                <span classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-50 px-1 -mx-1 py-0.5">
                  <Hexagon classИмя="h-3 w-3 shrink-0" />
                  Нет project
                </span>
              )}
            </>
          ) : (
            <>
              <Skeleton classИмя="h-6 w-6" />
              <Skeleton classИмя="h-6 w-6" />
              <Skeleton classИмя="h-4 w-20" />
              <Skeleton classИмя="h-4 w-28" />
            </>
          )}
        </div>

        {headerSeed ? (
          <>
            <h2 classИмя="text-xl font-bold leading-tight">{headerSeed.title}</h2>
            <div classИмя="space-y-2">
              <Skeleton classИмя="h-4 w-full max-w-xl" />
              <Skeleton classИмя="h-4 w-[72%]" />
            </div>
          </>
        ) : (
          <>
            <Skeleton classИмя="h-8 w-[min(100%,22rem)]" />
            <Skeleton classИмя="h-16 w-full" />
          </>
        )}
      </div>

      <Skeleton classИмя="h-28 w-full rounded-lg border border-border" />

      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <Skeleton classИмя="h-8 w-20" />
          <Skeleton classИмя="h-8 w-20" />
        </div>
        <ЗадачаChatSkeleton />
      </div>

      <ЗадачаSectionSkeleton titleWidth="w-24" rows={3} />
    </div>
  );
}

interface ВходящиеMobileToolbarProps {
  backHref: string;
  issueId: string | undefined;
  issueHidden: boolean;
  onАрхивировать: () => void;
  archiveОжидание: boolean;
  onКопировать: () => void;
  onProperties: () => void;
  onHide: () => void;
}

function ВходящиеMobileToolbar({
  backHref,
  issueId: issueIdProp,
  issueHidden,
  onАрхивировать,
  archiveОжидание,
  onКопировать,
  onProperties,
  onHide,
}: ВходящиеMobileToolbarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div classИмя="flex items-center w-full">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          // Use browser back when we have real history so the inbox
          // restores its scroll position. Fall back to a PUSH to
          // backHref when there's no prior entry (e.g. deep-link).
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate(backHref);
          }
        }}
        aria-label="Назад к входящим"
      >
        <ArrowLeft classИмя="h-5 w-5" />
      </Button>

      <div classИмя="ml-auto flex items-center gap-0.5">
        {issueIdProp && !issueHidden && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onАрхивировать}
            disabled={archiveОжидание}
            aria-label="Архивировать from inbox"
          >
            <Архивировать classИмя="h-5 w-5" />
          </Button>
        )}

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreVertical classИмя="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent classИмя="w-44 p-1" align="end">
            <button
              classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
              onClick={() => { onКопировать(); setMenuOpen(false); }}
            >
              <Копировать classИмя="h-3 w-3" />
              Копировать as markdown
            </button>
            <button
              classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
              onClick={() => { onProperties(); setMenuOpen(false); }}
            >
              <SlidersHorizontal classИмя="h-3 w-3" />
              Properties
            </button>
            {issueIdProp && (
              <button
                classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                onClick={() => { onHide(); setMenuOpen(false); }}
              >
                <EyeOff classИмя="h-3 w-3" />
                Hide this issue
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

type ЗадачаDetailChatTabProps = {
  issueId: string;
  companyId: string;
  projectId: string | null;
  issueСтатус: Задача["status"];
  issueРаботаMode: ЗадачаРаботаMode;
  executionЗапуститьId: string | null;
  blockedBy: Задача["blockedBy"];
  blockerAttention: Задача["blockerAttention"] | null;
  successfulЗапуститьHandoff: Задача["successfulЗапуститьHandoff"] | null;
  comments: ЗадачаDetailComment[];
  locallyQueuedCommentЗапуститьIds: ReadonlyMap<string, string>;
  interactions: ЗадачаThreadInteraction[];
  hasOlderКомментарии: boolean;
  commentsЗагрузкаOlder: boolean;
  onLoadOlderКомментарии: () => void;
  onОбновитьLatestКомментарии: () => Promise<unknown> | void;
  onРаботаModeChange?: (workMode: ЗадачаРаботаMode) => Promise<void> | void;
  composerRef: Ref<ЗадачаChatComposerHandle>;
  feedbackVotes?: FeedbackVote[];
  feedbackDataSharingPreference: "allowed" | "not_allowed" | "prompt";
  feedbackTermsUrl: string | null;
  agentMap: Map<string, Агент>;
  currentUserId: string | null;
  userLabelMap: ReadonlyMap<string, string> | null;
  userПрофильMap: ReadonlyMap<string, import("../lib/company-members").КомпанияUserПрофиль> | null;
  draftКлюч: string;
  reassignOptions: Array<{ id: string; label: string; searchText?: string }>;
  currentИсполнительЗначение: string;
  suggestedИсполнительЗначение: string;
  mentions: MentionOption[];
  composerОтключитьdReason: string | null;
  composerHint: string | null;
  queuedCommentReason: "hold" | "active_run" | "other";
  onVote: (
    commentId: string,
    vote: "up" | "down",
    options?: { allowSharing?: boolean; reason?: string },
  ) => Promise<void>;
  onДобавить: (body: string, reopen?: boolean, reassignment?: CommentReassignment) => Promise<void>;
  onImageЗагрузить: (file: File) => Promise<string>;
  onAttachImage: (file: File) => Promise<ЗадачаAttachment | void>;
  onInterruptQueued: (runId: string) => Promise<void>;
  onПаузаРаботаЗапустить?: (runId: string) => Promise<void>;
  onОтменаQueued: (commentId: string) => void;
  interruptingQueuedЗапуститьId: string | null;
  pausingРаботаЗапуститьId: string | null;
  onImageClick: (src: string) => void;
  onПринятьInteraction: (
    interaction: ActionableЗадачаThreadInteraction,
    selectedClientКлючs?: string[],
  ) => Promise<void>;
  onОтклонитьInteraction: (interaction: ActionableЗадачаThreadInteraction, reason?: string) => Promise<void>;
  onОтправитьInteractionAnswers: (
    interaction: ЗадачаThreadInteraction,
    answers: AskUserQuestionsAnswer[],
  ) => Promise<void>;
  onОтменаInteraction: (interaction: AskUserQuestionsInteraction) => Promise<void>;
  assigneeUserId: string | null;
  onПродолжитьFromНазадlog?: () => Promise<void> | void;
  resumeFromНазадlogОжидание?: boolean;
};

const ЗадачаDetailChatTab = memo(function ЗадачаDetailChatTab({
  issueId,
  companyId,
  projectId,
  issueРаботаMode,
  issueСтатус,
  executionЗапуститьId,
  blockedBy,
  blockerAttention,
  successfulЗапуститьHandoff,
  comments,
  locallyQueuedCommentЗапуститьIds,
  interactions,
  hasOlderКомментарии,
  commentsЗагрузкаOlder,
  onLoadOlderКомментарии,
  onОбновитьLatestКомментарии,
  onРаботаModeChange,
  composerRef,
  feedbackVotes,
  feedbackDataSharingPreference,
  feedbackTermsUrl,
  agentMap,
  currentUserId,
  userLabelMap,
  userПрофильMap,
  draftКлюч,
  reassignOptions,
  currentИсполнительЗначение,
  suggestedИсполнительЗначение,
  mentions,
  composerОтключитьdReason,
  composerHint,
  queuedCommentReason,
  onVote,
  onДобавить,
  onImageЗагрузить,
  onAttachImage,
  onInterruptQueued,
  onПаузаРаботаЗапустить,
  onОтменаQueued,
  interruptingQueuedЗапуститьId,
  pausingРаботаЗапуститьId,
  onImageClick,
  onПринятьInteraction,
  onОтклонитьInteraction,
  onОтправитьInteractionAnswers,
  onОтменаInteraction,
  assigneeUserId,
  onПродолжитьFromНазадlog,
  resumeFromНазадlogОжидание,
}: ЗадачаDetailChatTabProps) {
  const { data: activity } = useQuery({
    queryКлюч: queryКлючs.issues.activity(issueId),
    queryFn: () => activityApi.forЗадача(issueId),
    placeholderData: keepPreviousDataForSameQueryTail<АктивностьEvent[]>(issueId),
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId),
    queryFn: () => heartbeatsApi.liveЗапуститьsForЗадача(issueId),
    refetchInterval: 3000,
    placeholderData: keepPreviousDataForSameQueryTail<LiveЗапуститьForЗадача[]>(issueId),
  });
  const resolvedLiveЗапуститьs = liveЗапуститьs ?? [];
  const liveЗапуститьCount = resolvedLiveЗапуститьs.length;
  const { data: activeЗапустить = null } = useQuery({
    queryКлюч: queryКлючs.issues.activeЗапустить(issueId),
    queryFn: () => heartbeatsApi.activeЗапуститьForЗадача(issueId),
    enabled: !!executionЗапуститьId || issueСтатус === "in_progress",
    refetchInterval: liveЗапуститьCount > 0 ? false : 3000,
    placeholderData: keepPreviousDataForSameQueryTail<АктивенЗапуститьForЗадача | null>(issueId),
  });
  const resolvedАктивенЗапустить = useMemo(
    () => resolveЗадачаАктивенЗапустить({ status: issueСтатус, executionЗапуститьId }, activeЗапустить),
    [activeЗапустить, executionЗапуститьId, issueСтатус],
  );
  const hasLiveЗапуститьs = liveЗапуститьCount > 0 || !!resolvedАктивенЗапустить;
  const { data: linkedЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.issues.runs(issueId),
    queryFn: () => activityApi.runsForЗадача(issueId),
    refetchInterval: hasLiveЗапуститьs ? 5000 : false,
    placeholderData: keepPreviousDataForSameQueryTail<ЗапуститьForЗадача[]>(issueId),
  });
  const resolvedАктивность = activity ?? [];
  const resolvedLinkedЗапуститьs = linkedЗапуститьs ?? [];

  const runningЗадачаЗапустить = useMemo(
    () => resolveВыполняетсяЗадачаЗапустить(resolvedАктивенЗапустить, resolvedLiveЗапуститьs),
    [resolvedАктивенЗапустить, resolvedLiveЗапуститьs],
  );
  const liveЗапуститьIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of resolvedLiveЗапуститьs) ids.add(run.id);
    if (resolvedАктивенЗапустить) ids.add(resolvedАктивенЗапустить.id);
    return ids;
  }, [resolvedАктивенЗапустить, resolvedLiveЗапуститьs]);
  const timelineЗапуститьs = useMemo(() => {
    const historicalЗапуститьs = liveЗапуститьIds.size === 0
      ? resolvedLinkedЗапуститьs
      : resolvedLinkedЗапуститьs.filter((run) => !liveЗапуститьIds.has(run.runId));
    return historicalЗапуститьs.map((run) => ({
      ...run,
      adapterТип: run.adapterТип,
      hasStoredOutput: (run.logBytes ?? 0) > 0,
    }));
  }, [liveЗапуститьIds, resolvedLinkedЗапуститьs]);
  const commentsWithЗапуститьMeta = useMemo<ЗадачаDetailComment[]>(() => {
    const activeЗапуститьЗапущенAt = runningЗадачаЗапустить?.startedAt ?? runningЗадачаЗапустить?.createdAt ?? null;
    const runMetaByCommentId = new Map<string, { runId: string; runАгентId: string | null; interruptedЗапуститьId: string | null }>();
    const followUpCommentIds = new Set<string>();
    const agentIdByЗапуститьId = new Map<string, string>();

    for (const run of resolvedLinkedЗапуститьs) {
      agentIdByЗапуститьId.set(run.runId, run.agentId);
    }
    for (const evt of resolvedАктивность) {
      if (evt.action !== "issue.comment_added" || !evt.runId) continue;
      const details = evt.details ?? {};
      const commentId = typeof details["commentId"] === "string" ? details["commentId"] : null;
      if (!commentId || runMetaByCommentId.has(commentId)) continue;
      const interruptedЗапуститьId =
        typeof details["interruptedЗапуститьId"] === "string" ? details["interruptedЗапуститьId"] : null;
      runMetaByCommentId.set(commentId, {
        runId: evt.runId,
        runАгентId: evt.agentId ?? agentIdByЗапуститьId.get(evt.runId) ?? null,
        interruptedЗапуститьId,
      });
    }
    for (const evt of resolvedАктивность) {
      if (evt.action !== "issue.comment_added") continue;
      const details = evt.details ?? {};
      const commentId = typeof details["commentId"] === "string" ? details["commentId"] : null;
      if (!commentId) continue;
      if (details["followUpRequested"] === true || details["resumeIntent"] === true) {
        followUpCommentIds.add(commentId);
      }
    }

    return comments.map((comment) => {
      const meta = runMetaByCommentId.get(comment.id);
      const nextComment: ЗадачаDetailComment = meta ? { ...comment, ...meta } : { ...comment };
      if (followUpCommentIds.has(comment.id)) {
        nextComment.followUpRequested = true;
      }
      const queuedЦельЗапуститьId = locallyQueuedCommentЗапуститьIds.get(comment.id) ?? null;
      const locallyQueuedComment = applyLocalQueuedЗадачаCommentState(nextComment, {
        queuedЦельЗапуститьId,
        targetЗапуститьIsLive: queuedЦельЗапуститьId ? liveЗапуститьIds.has(queuedЦельЗапуститьId) : false,
        runningЗапуститьId: runningЗадачаЗапустить?.id ?? null,
      });
      if (locallyQueuedComment !== nextComment) {
        return locallyQueuedComment;
      }
      if (
        isQueuedЗадачаComment({
          comment: nextComment,
          activeЗапуститьЗапущенAt,
          activeЗапуститьАгентId: runningЗадачаЗапустить?.agentId ?? null,
          activeЗапуститьCommentId: runningЗадачаЗапустить?.contextCommentId ?? null,
          activeЗапуститьWakeCommentId: runningЗадачаЗапустить?.contextWakeCommentId ?? null,
          runId: meta?.runId ?? nextComment.runId ?? null,
          interruptedЗапуститьId: meta?.interruptedЗапуститьId ?? nextComment.interruptedЗапуститьId ?? null,
        })
      ) {
        return {
          ...nextComment,
          queueState: "queued" as const,
          queueЦельЗапуститьId: runningЗадачаЗапустить?.id ?? nextComment.queueЦельЗапуститьId ?? null,
          queueReason: queuedCommentReason,
        };
      }
      return nextComment;
    });
  }, [
    comments,
    liveЗапуститьIds,
    locallyQueuedCommentЗапуститьIds,
    queuedCommentReason,
    resolvedАктивность,
    resolvedLinkedЗапуститьs,
    runningЗадачаЗапустить,
  ]);
  const timelineEvents = useMemo(
    () => extractЗадачаTimelineEvents(resolvedАктивность),
    [resolvedАктивность],
  );

  return (
    <div classИмя="space-y-3">
      {hasOlderКомментарии ? (
        <div classИмя="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={commentsЗагрузкаOlder}
            onClick={onLoadOlderКомментарии}
          >
            {commentsЗагрузкаOlder ? "Загрузка earlier comments..." : "Load earlier comments"}
          </Button>
        </div>
      ) : null}
      <ЗадачаChatThread
        composerRef={composerRef}
        comments={commentsWithЗапуститьMeta}
        interactions={interactions}
        feedbackVotes={feedbackVotes}
        feedbackDataSharingPreference={feedbackDataSharingPreference}
        feedbackTermsUrl={feedbackTermsUrl}
        linkedЗапуститьs={timelineЗапуститьs}
        timelineEvents={timelineEvents}
        liveЗапуститьs={resolvedLiveЗапуститьs}
        activeЗапустить={resolvedАктивенЗапустить}
        blockedBy={blockedBy ?? []}
        blockerAttention={blockerAttention}
        successfulЗапуститьHandoff={successfulЗапуститьHandoff}
        companyId={companyId}
        projectId={projectId}
        issueСтатус={issueСтатус}
        agentMap={agentMap}
        currentUserId={currentUserId}
        userLabelMap={userLabelMap}
        userПрофильMap={userПрофильMap}
        draftКлюч={draftКлюч}
        enableReassign
        reassignOptions={reassignOptions}
        currentИсполнительЗначение={currentИсполнительЗначение}
        suggestedИсполнительЗначение={suggestedИсполнительЗначение}
        mentions={mentions}
        composerОтключитьdReason={composerОтключитьdReason}
        composerHint={composerHint}
        onVote={onVote}
        onДобавить={onДобавить}
        imageЗагрузитьHandler={onImageЗагрузить}
        onAttachImage={onAttachImage}
        onInterruptQueued={onInterruptQueued}
        onОтменаQueued={onОтменаQueued}
        interruptingQueuedЗапуститьId={interruptingQueuedЗапуститьId}
        stoppingЗапуститьId={pausingРаботаЗапуститьId}
        onОстановитьЗапустить={onПаузаРаботаЗапустить}
        stopЗапуститьLabel="Пауза work"
        stoppingЗапуститьLabel="Pausing..."
        stopЗапуститьVariant="pause"
        onПринятьInteraction={onПринятьInteraction}
        onОтклонитьInteraction={onОтклонитьInteraction}
        onОтправитьInteractionAnswers={(interaction, answers) =>
          onОтправитьInteractionAnswers(interaction, answers)
        }
        onОтменаInteraction={onОтменаInteraction}
        issueРаботаMode={issueРаботаMode}
        onРаботаModeChange={onРаботаModeChange}
        onОтменаЗапустить={runningЗадачаЗапустить && onПаузаРаботаЗапустить
          ? async () => {
              await onПаузаРаботаЗапустить(runningЗадачаЗапустить.id);
            }
          : undefined}
        onImageClick={onImageClick}
        onОбновитьLatestКомментарии={onОбновитьLatestКомментарии}
        assigneeUserId={assigneeUserId}
        onПродолжитьFromНазадlog={onПродолжитьFromНазадlog}
        resumeFromНазадlogОжидание={resumeFromНазадlogОжидание}
      />
    </div>
  );
});

type ЗадачаDetailАктивностьTabProps = {
  issue: Задача;
  issueId: string;
  companyId: string;
  issueСтатус: Задача["status"];
  childЗадачи: Задача[];
  agentMap: Map<string, Агент>;
  hasLiveЗапуститьs: boolean;
  currentUserId: string | null;
  userПрофильMap: Map<string, import("../lib/company-members").КомпанияUserПрофиль>;
  pendingСогласованиеAction: { approvalId: string; action: "approve" | "reject" } | null;
  onСогласованиеAction: (approvalId: string, action: "approve" | "reject") => void;
  onCheckMonitorСейчас: () => void;
  checkingMonitorСейчас: boolean;
  handoffFocusSignal?: number;
};

function ЗадачаDetailАктивностьTab({
  issue,
  issueId,
  companyId,
  issueСтатус,
  childЗадачи,
  agentMap,
  hasLiveЗапуститьs,
  currentUserId,
  userПрофильMap,
  pendingСогласованиеAction,
  onСогласованиеAction,
  onCheckMonitorСейчас,
  checkingMonitorСейчас,
  handoffFocusSignal = 0,
}: ЗадачаDetailАктивностьTabProps) {
  const { data: activity, isЗагрузка: activityЗагрузка } = useQuery({
    queryКлюч: queryКлючs.issues.activity(issueId),
    queryFn: () => activityApi.forЗадача(issueId),
    placeholderData: keepPreviousDataForSameQueryTail<АктивностьEvent[]>(issueId),
  });
  const { data: linkedЗапуститьs, isЗагрузка: linkedЗапуститьsЗагрузка } = useQuery({
    queryКлюч: queryКлючs.issues.runs(issueId),
    queryFn: () => activityApi.runsForЗадача(issueId),
    placeholderData: keepPreviousDataForSameQueryTail<ЗапуститьForЗадача[]>(issueId),
  });
  const { data: linkedСогласования } = useQuery({
    queryКлюч: queryКлючs.issues.approvals(issueId),
    queryFn: () => issuesApi.listСогласования(issueId),
    placeholderData: keepPreviousDataForSameQueryTail<Awaited<ReturnТип<typeof issuesApi.listСогласования>>>(issueId),
  });
  const { data: continuationHandoff } = useQuery({
    queryКлюч: queryКлючs.issues.document(issueId, ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY),
    queryFn: async () => {
      try {
        return await issuesApi.getDocument(issueId, ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY);
      } catch (error) {
        if (error instanceof ApiОшибка && error.status === 404) return null;
        throw error;
      }
    },
    retry: false,
    placeholderData: keepPreviousDataForSameQueryTail<Awaited<ReturnТип<typeof issuesApi.getDocument>> | null>(
      issueId,
    ),
  });
  const { data: issueTreeCostSummary } = useQuery({
    queryКлюч: queryКлючs.issues.costSummary(issueId),
    queryFn: () => issuesApi.getCostSummary(issueId),
    placeholderData: keepPreviousDataForSameQueryTail<Awaited<ReturnТип<typeof issuesApi.getCostSummary>>>(issueId),
  });
  const initialЗагрузка =
    (activityЗагрузка && activity === undefined)
    || (linkedЗапуститьsЗагрузка && linkedЗапуститьs === undefined);
  const issueCostSummary = useMemo(() => {
    let input = 0;
    let output = 0;
    let cached = 0;
    let cost = 0;
    let runtimeMs = 0;
    let runCount = 0;
    let hasCost = false;
    let hasТокенs = false;
    const nowMs = Date.now();

    for (const run of linkedЗапуститьs ?? []) {
      const usage = asRecord(run.usageJson);
      const result = asRecord(run.resultJson);
      const runInput = usageNumber(usage, "inputТокенs", "input_tokens");
      const runOutput = usageNumber(usage, "outputТокенs", "output_tokens");
      const runCached = usageNumber(
        usage,
        "cachedInputТокенs",
        "cached_input_tokens",
        "cache_read_input_tokens",
      );
      const runCost = visibleЗапуститьCostUsd(usage, result);
      if (runCost > 0) hasCost = true;
      if (runInput + runOutput + runCached > 0) hasТокенs = true;
      input += runInput;
      output += runOutput;
      cached += runCached;
      cost += runCost;

      if (run.startedAt) {
        const startMs = new Date(run.startedAt).getTime();
        const endMs = run.finishedAt ? new Date(run.finishedAt).getTime() : nowMs;
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
          runtimeMs += endMs - startMs;
          runCount += 1;
        }
      }
    }

    return {
      input,
      output,
      cached,
      cost,
      totalТокенs: input + output,
      hasCost,
      hasТокенs,
      runtimeMs,
      runCount,
      hasЗапуститьtime: runtimeMs > 0,
    };
  }, [linkedЗапуститьs]);
  const issueTreeCostТокенs =
    (issueTreeCostSummary?.inputТокенs ?? 0) + (issueTreeCostSummary?.outputТокенs ?? 0);
  const hasЗадачаTreeCost =
    !!issueTreeCostSummary
    && (issueTreeCostSummary.costCents > 0
      || issueTreeCostТокенs > 0
      || issueTreeCostSummary.cachedInputТокенs > 0
      || issueTreeCostSummary.runtimeMs > 0
      || issueTreeCostSummary.issueCount > 1);
  const shouldShowCostSummary =
    (linkedЗапуститьs && linkedЗапуститьs.length > 0) || hasЗадачаTreeCost;

  if (initialЗагрузка) {
    return <ЗадачаSectionSkeleton titleWidth="w-20" rows={4} />;
  }

  return (
    <>
      {shouldShowCostSummary && (
        <div classИмя="mb-3 px-3 py-2 rounded-lg border border-border">
          <div classИмя="text-sm font-medium text-muted-foreground mb-1">Cost Summary</div>
          {!issueCostSummary.hasCost && !issueCostSummary.hasТокенs && !hasЗадачаTreeCost ? (
            <div classИмя="text-xs text-muted-foreground">Нет cost data yet.</div>
          ) : (
            <div classИмя="space-y-1 text-xs text-muted-foreground tabular-nums">
              <div classИмя="flex flex-wrap gap-3">
                <span classИмя="font-medium text-foreground">This issue</span>
                {issueCostSummary.hasCost ? (
                  <span classИмя="font-medium text-foreground">
                    ${issueCostSummary.cost.toFixed(4)}
                  </span>
                ) : null}
                {issueCostSummary.hasТокенs ? (
                  <span>
                    Токенs {formatТокенs(issueCostSummary.totalТокенs)}
                    {issueCostSummary.cached > 0
                      ? ` (in ${formatТокенs(issueCostSummary.input)}, out ${formatТокенs(issueCostSummary.output)}, cached ${formatТокенs(issueCostSummary.cached)})`
                      : ` (in ${formatТокенs(issueCostSummary.input)}, out ${formatТокенs(issueCostSummary.output)})`}
                  </span>
                ) : null}
                {issueCostSummary.hasЗапуститьtime ? (
                  <span>
                    Запуститьtime {formatDurationMs(issueCostSummary.runtimeMs)}
                    {` (${issueCostSummary.runCount} run${issueCostSummary.runCount === 1 ? "" : "s"})`}
                  </span>
                ) : null}
                {!issueCostSummary.hasCost && !issueCostSummary.hasТокенs && !issueCostSummary.hasЗапуститьtime ? (
                  <span>Нет direct cost data.</span>
                ) : null}
              </div>
              {hasЗадачаTreeCost && issueTreeCostSummary ? (
                <div classИмя="flex flex-wrap gap-3">
                  <span classИмя="font-medium text-foreground">
                    Including sub-issues {(issueTreeCostSummary.costCents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}
                  </span>
                  <span>
                    Токенs {formatТокенs(issueTreeCostТокенs)}
                    {issueTreeCostSummary.cachedInputТокенs > 0
                      ? ` (in ${formatТокенs(issueTreeCostSummary.inputТокенs)}, out ${formatТокенs(issueTreeCostSummary.outputТокенs)}, cached ${formatТокенs(issueTreeCostSummary.cachedInputТокенs)})`
                      : ` (in ${formatТокенs(issueTreeCostSummary.inputТокенs)}, out ${formatТокенs(issueTreeCostSummary.outputТокенs)})`}
                  </span>
                  {issueTreeCostSummary.runCount > 0 ? (
                    <span>
                      Запуститьtime {formatDurationMs(issueTreeCostSummary.runtimeMs)}
                      {` (${issueTreeCostSummary.runCount} run${issueTreeCostSummary.runCount === 1 ? "" : "s"})`}
                    </span>
                  ) : null}
                  <span>{issueTreeCostSummary.issueCount} issue{issueTreeCostSummary.issueCount === 1 ? "" : "s"}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
      <div classИмя="mb-3">
        <ЗадачаЗапуститьLedger
          issueId={issueId}
          companyId={companyId}
          issueСтатус={issueСтатус}
          childЗадачи={childЗадачи}
          agentMap={agentMap}
          hasLiveЗапуститьs={hasLiveЗапуститьs}
          activityEvents={activity ?? []}
          renderАктивностьEvent={(evt) => {
            const tone = successfulЗапуститьHandoffАктивностьTone(evt.action);
            const isHandoffПредупреждение =
              evt.action === SUCCESSFUL_RUN_HANDOFF_REQUIRED_ACTION
              || evt.action === SUCCESSFUL_RUN_HANDOFF_ESCALATED_ACTION;
            return (
              <div classИмя={cn("space-y-1.5 rounded-lg border px-3 py-2 text-xs", tone.classИмя)}>
                <div classИмя="flex items-center gap-1.5">
                  {isHandoffПредупреждение ? (
                    <AlertTriangle classИмя={cn("h-3.5 w-3.5 shrink-0", tone.iconClassИмя)} />
                  ) : null}
                  <ActorIdentity evt={evt} agentMap={agentMap} userПрофильMap={userПрофильMap} />
                  <span>{formatЗадачаАктивностьAction(evt.action, evt.details, { agentMap, userПрофильMap, currentUserId })}</span>
                  <span classИмя="ml-auto shrink-0">{relativeTime(evt.createdAt)}</span>
                </div>
                <ЗадачаReferenceАктивностьSummary event={evt} />
              </div>
            );
          }}
        />
      </div>
      {linkedСогласования && linkedСогласования.length > 0 && (
        <div classИмя="mb-3 space-y-3">
          {linkedСогласования.map((approval) => (
            <СогласованиеCard
              key={approval.id}
              approval={approval}
              requesterАгент={approval.requestedByАгентId ? agentMap.get(approval.requestedByАгентId) ?? null : null}
              onОдобрить={() => onСогласованиеAction(approval.id, "approve")}
              onОтклонить={() => onСогласованиеAction(approval.id, "reject")}
              detailLink={`/approvals/${approval.id}`}
              isОжидание={pendingСогласованиеAction?.approvalId === approval.id}
              pendingAction={
                pendingСогласованиеAction?.approvalId === approval.id
                  ? pendingСогласованиеAction.action
                  : null
              }
            />
          ))}
        </div>
      )}
      <ЗадачаContinuationHandoff document={continuationHandoff} focusSignal={handoffFocusSignal} />
      <ЗадачаРасписаниеdПовторитьCard issueId={issue.id} scheduledПовторить={issue.scheduledПовторить ?? null} />
      <ЗадачаMonitorАктивностьCard
        issue={issue}
        onCheckСейчас={onCheckMonitorСейчас}
        checkingСейчас={checkingMonitorСейчас}
      />
    </>
  );
}

export function ЗадачаDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const { selectedКомпанияId } = useКомпания();
  const { openNewЗадача } = useDialogActions();
  const { openPanel, closePanel, panelVisible, setPanelVisible } = usePanel();
  const { setBreadcrumbs, setMobileToolbar } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigationТип = useNavigationТип();
  const location = useLocation();
  const { pushToast } = useToastActions();
  const { isMobile } = useSidebar();
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("chat");
  const [handoffFocusSignal, setHandoffFocusSignal] = useState(0);
  const [pendingСогласованиеAction, setОжиданиеСогласованиеAction] = useState<{
    approvalId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [confirmУдалитьId, setПодтвердитьУдалитьId] = useState<string | null>(null);
  const [attachmentОшибка, setAttachmentОшибка] = useState<string | null>(null);
  const [attachmentDragАктивен, setAttachmentDragАктивен] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [treeControlOpen, setTreeControlOpen] = useState(false);
  const [treeControlMode, setTreeControlMode] = useState<ЗадачаTreeControlMode>("pause");
  const [treeControlReason, setTreeControlReason] = useState("");
  const [treeControlWakeАгентыOnПродолжить, setTreeControlWakeАгентыOnПродолжить] = useState(false);
  const [treeControlОтменаПодтвердитьed, setTreeControlОтменаПодтвердитьed] = useState(false);
  const [optimisticКомментарии, setOptimisticКомментарии] = useState<OptimisticЗадачаComment[]>([]);
  const [locallyQueuedCommentЗапуститьIds, setLocallyQueuedCommentЗапуститьIds] = useState<Map<string, string>>(() => new Map());
  const [pendingCommentComposerFocusКлюч, setОжиданиеCommentComposerFocusКлюч] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastMarkedReadЗадачаIdRef = useRef<string | null>(null);
  const commentComposerRef = useRef<ЗадачаChatComposerHandle | null>(null);
  const cancelledQueuedOptimisticCommentIdsRef = useRef(new Set<string>());
  const resolvedЗадачаDetailState = useMemo(
    () => readЗадачаDetailLocationState(issueId, location.state, location.search),
    [issueId, location.state, location.search],
  );
  const issueHeaderSeed = useMemo(
    () => readЗадачаDetailHeaderSeed(location.state) ?? readЗадачаDetailHeaderSeed(resolvedЗадачаDetailState),
    [location.state, resolvedЗадачаDetailState],
  );

  const { data: issue, isЗагрузка, error } = useQuery({
    ...getЗадачаDetailQueryOptions(queryClient, issueId!, {
      placeholderЗадача: issueHeaderSeed ? {
        id: issueHeaderSeed.id,
        identifier: issueHeaderSeed.identifier,
      } : null,
    }),
    enabled: !!issueId,
  });
  const resolvedКомпанияId = issue?.companyId ?? selectedКомпанияId;
  const commentComposerОтключитьdReason = useMemo(() => {
    if (!issue?.currentExecutionРабочая область || !isЗакрытьdIsolatedExecutionРабочая область(issue.currentExecutionРабочая область)) {
      return null;
    }
    return getЗакрытьdIsolatedExecutionРабочая областьMessage(issue.currentExecutionРабочая область);
  }, [issue?.currentExecutionРабочая область]);

  const {
    data: commentPages,
    isЗагрузка: commentsЗагрузка,
    isFetchingДалееPage: commentsЗагрузкаOlder,
    hasДалееPage: hasOlderКомментарии,
    fetchДалееPage: fetchOlderКомментарии,
    refetch: refetchКомментарии,
  } = useInfiniteQuery({
    queryКлюч: queryКлючs.issues.comments(issueId!),
    queryFn: ({ pageParam }) =>
      issuesApi.listКомментарии(issueId!, {
        order: "desc",
        limit: ISSUE_COMMENT_PAGE_SIZE,
        ...(pageParam ? { after: pageParam } : {}),
      }),
    enabled: !!issueId,
    initialPageParam: null as string | null,
    getДалееPageParam: (lastPage) =>
      getДалееЗадачаCommentPageParam(lastPage, ISSUE_COMMENT_PAGE_SIZE),
    placeholderData: keepPreviousDataForSameQueryTail<InfiniteData<ЗадачаComment[], string | null>>(issueId ?? "pending"),
  });
  const comments = useMemo(
    () => flattenЗадачаCommentPages(commentPages?.pages),
    [commentPages?.pages],
  );
  const shouldPrefetchOlderКомментарии = useMemo(
    () =>
      shouldАвтоloadOlderЗадачаКомментарии({
        activeDetailTab: detailTab,
        hasOlderКомментарии: hasOlderКомментарии ?? false,
        loadedCommentCount: comments.length,
        initialPageЗагрузка: commentsЗагрузка,
        olderPageЗагрузка: commentsЗагрузкаOlder,
        autoLoadLimit: ISSUE_COMMENT_AUTOLOAD_LIMIT,
      }),
    [comments.length, commentsЗагрузка, commentsЗагрузкаOlder, detailTab, hasOlderКомментарии],
  );
  const { data: interactions = [] } = useQuery({
    queryКлюч: queryКлючs.issues.interactions(issueId!),
    queryFn: () => issuesApi.listInteractions(issueId!),
    enabled: !!issueId,
    placeholderData: keepPreviousDataForSameQueryTail<ЗадачаThreadInteraction[]>(issueId ?? "pending"),
  });

  const { data: attachments, isЗагрузка: attachmentsЗагрузка } = useQuery({
    queryКлюч: queryКлючs.issues.attachments(issueId!),
    queryFn: () => issuesApi.listAttachments(issueId!),
    enabled: !!issueId,
    placeholderData: keepPreviousDataForSameQueryTail<ЗадачаAttachment[]>(issueId ?? "pending"),
  });

  const { data: liveЗапуститьCount = 0 } = useQuery<LiveЗапуститьForЗадача[], Ошибка, number>({
    queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForЗадача(issueId!),
    enabled: !!issueId,
    refetchInterval: 3000,
    select: (runs) => runs.length,
    placeholderData: keepPreviousDataForSameQueryTail<LiveЗапуститьForЗадача[]>(issueId ?? "pending"),
  });

  const { data: hasАктивенЗапустить = false } = useQuery<АктивенЗапуститьForЗадача | null, Ошибка, boolean>({
    queryКлюч: queryКлючs.issues.activeЗапустить(issueId!),
    queryFn: () => heartbeatsApi.activeЗапуститьForЗадача(issueId!),
    enabled: !!issueId && (!!issue?.executionЗапуститьId || issue?.status === "in_progress"),
    refetchInterval: liveЗапуститьCount > 0 ? false : 3000,
    select: (run) => !!run,
    placeholderData: keepPreviousDataForSameQueryTail<АктивенЗапуститьForЗадача | null>(issueId ?? "pending"),
  });
  const resolvedHasАктивенЗапустить = issue ? shouldTrackЗадачаАктивенЗапустить(issue) && hasАктивенЗапустить : hasАктивенЗапустить;
  const hasLiveЗапуститьs = liveЗапуститьCount > 0 || resolvedHasАктивенЗапустить;
  useEffect(() => {
    if (!hasLiveЗапуститьs && locallyQueuedCommentЗапуститьIds.size > 0) {
      setLocallyQueuedCommentЗапуститьIds(new Map());
    }
  }, [hasLiveЗапуститьs, locallyQueuedCommentЗапуститьIds.size]);
  const sourceBreadcrumb = useMemo(
    () => readЗадачаDetailBreadcrumb(issueId, location.state, location.search) ?? { label: "Задачи", href: "/issues" },
    [issueId, location.state, location.search],
  );

  const { data: rawChildЗадачи = [], isЗагрузка: childЗадачиЗагрузка } = useQuery({
    queryКлюч:
      issue?.id && resolvedКомпанияId
        ? queryКлючs.issues.listByDescendantRoot(resolvedКомпанияId, issue.id)
        : ["issues", "parent", "pending"],
    queryFn: () => issuesApi.list(resolvedКомпанияId!, { descendantOf: issue!.id, includeЗаблокированBy: true }),
    enabled: !!resolvedКомпанияId && !!issue?.id,
    placeholderData: keepPreviousDataForSameQueryTail<Задача[]>(issue?.id ?? "pending"),
  });
  const { data: companyLiveЗапуститьs } = useQuery({
    queryКлюч: resolvedКомпанияId ? queryКлючs.liveЗапуститьs(resolvedКомпанияId) : ["live-runs", "pending"],
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(resolvedКомпанияId!),
    enabled: !!resolvedКомпанияId,
    refetchInterval: 5000,
    placeholderData: keepPreviousDataForSameQueryTail<LiveЗапуститьForЗадача[]>(resolvedКомпанияId ?? "pending"),
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { data: boardДоступ } = useQuery({
    queryКлюч: queryКлючs.access.currentСоветДоступ,
    queryFn: () => accessApi.getCurrentСоветДоступ(),
    enabled: !!session?.user?.id,
    retry: false,
  });
  const canManageTreeControl = Boolean(
    selectedКомпанияId
    && boardДоступ?.companyIds?.includes(selectedКомпанияId),
  );
  const { data: feedbackVotes } = useQuery({
    queryКлюч: queryКлючs.issues.feedbackVotes(issueId!),
    queryFn: () => issuesApi.listFeedbackVotes(issueId!),
    enabled: !!issueId && !!currentUserId,
  });
  const { data: instanceОбщиеНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.generalНастройки,
    queryFn: () => instanceНастройкиApi.getОбщие(),
    enabled: !!issueId,
    retry: false,
  });
  const keyboardShortcutsВключитьd = instanceОбщиеНастройки?.keyboardShortcuts === true;
  const feedbackDataSharingPreference = instanceОбщиеНастройки?.feedbackDataSharingPreference ?? "prompt";
  const { orderedПроекты } = useProjectOrder({
    projects: projects ?? [],
    companyId: selectedКомпанияId,
    userId: currentUserId,
  });
  const { slots: issuePluginDetailSlots } = usePluginSlots({
    slotТипs: ["detailTab"],
    entityТип: "issue",
    companyId: resolvedКомпанияId,
    enabled: !!resolvedКомпанияId,
  });
  const issuePluginTabItems = useMemo(
    () => issuePluginDetailSlots.map((slot) => ({
      value: `plugin:${slot.pluginКлюч}:${slot.id}`,
      label: slot.displayИмя,
      slot,
    })),
    [issuePluginDetailSlots],
  );
  const activePluginTab = issuePluginTabItems.find((item) => item.value === detailTab) ?? null;
  const {
    data: treeControlПредпросмотр,
    isFetching: treeControlПредпросмотрЗагрузка,
    error: treeControlПредпросмотрОшибка,
    refetch: refetchTreeControlПредпросмотр,
  } = useQuery({
    queryКлюч: [
      "issues",
      "tree-control-preview",
      issueId ?? "pending",
      treeControlMode,
    ],
    queryFn: () =>
      issuesApi.previewTreeControl(issueId!, {
        mode: treeControlMode,
        releasePolicy: {
          strategy: "manual",
        },
      }),
    enabled: treeControlOpen && !!issueId && canManageTreeControl,
    staleTime: 0,
    retry: false,
  });
  const { data: treeControlState } = useQuery({
    queryКлюч: ["issues", "tree-control-state", issueId ?? "pending"],
    queryFn: () => issuesApi.getTreeControlState(issueId!),
    enabled: !!issueId && canManageTreeControl,
    retry: false,
  });
  const { data: activeRootПаузаHolds = [] } = useQuery({
    queryКлюч: ["issues", "tree-holds", issueId ?? "pending", "active-pause-with-members"],
    queryFn: () =>
      issuesApi.listTreeHolds(issueId!, {
        status: "active",
        mode: "pause",
        includeMembers: true,
      }),
    enabled: !!issueId && treeControlState?.activeПаузаHold?.isRoot === true,
  });
  const { data: activeОтменаHolds = [] } = useQuery({
    queryКлюч: ["issues", "tree-holds", issueId ?? "pending", "active-cancel"],
    queryFn: () =>
      issuesApi.listTreeHolds(issueId!, {
        status: "active",
        mode: "cancel",
      }),
    enabled: !!issueId && canManageTreeControl,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Агент>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);
  const userПрофильMap = useMemo(
    () => buildКомпанияUserПрофильMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const userLabelMap = useMemo(
    () => buildКомпанияUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const mentionOptions = useMemo<MentionOption[]>(() => {
    return buildMarkdownMentionOptions({
      agents,
      projects: orderedПроекты,
      members: companyMembers?.users,
    });
  }, [agents, companyMembers?.users, orderedПроекты]);

  const resolvedProject = useMemo(
    () => (issue?.projectId ? orderedПроекты.find((project) => project.id === issue.projectId) ?? issue.project ?? null : null),
    [issue?.project, issue?.projectId, orderedПроекты],
  );
  const childЗадачи = useMemo(
    () => {
      const descendants = issue?.id ? filterЗадачаDescendants(issue.id, rawChildЗадачи) : rawChildЗадачи;
      return [...descendants].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    [issue?.id, rawChildЗадачи],
  );
  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(companyLiveЗапуститьs), [companyLiveЗапуститьs]);
  const issuePanelКлюч = useMemo(
    () => buildЗадачаPropertiesPanelКлюч(issue ?? null, childЗадачи),
    [childЗадачи, issue],
  );
  const panelЗадача = useMemo(
    () => issue ?? null,
    [issue?.id, issuePanelКлюч],
  );
  const panelChildЗадачи = useMemo(
    () => childЗадачи,
    [issuePanelКлюч],
  );
  const showRichSubЗадачиSection = shouldRenderRichSubЗадачиSection(childЗадачиЗагрузка, childЗадачи.length);
  const openNewSubЗадача = useCallback(() => {
    if (!issue) return;
    openNewЗадача(buildSubЗадачаПо умолчаниюsForViewer(issue, currentUserId));
  }, [
    currentUserId,
    issue,
    openNewЗадача,
  ]);

  const commentReassignOptions = useMemo(() => {
    const options: Array<{ id: string; label: string; searchText?: string }> = [];
    options.push(...buildКомпанияUserInlineOptions(companyMembers?.users, { excludeUserIds: [currentUserId] }));
    const activeАгенты = [...(agents ?? [])]
      .filter((agent) => agent.status !== "terminated")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const agent of activeАгенты) {
      options.push({ id: `agent:${agent.id}`, label: agent.name });
    }
    if (currentUserId) {
      options.push({ id: `user:${currentUserId}`, label: "Me" });
    }
    return options;
  }, [agents, companyMembers?.users, currentUserId]);

  const actualИсполнительЗначение = useMemo(
    () => assigneeЗначениеFromSelection(issue ?? {}),
    [issue],
  );

  const suggestedИсполнительЗначение = useMemo(
    () =>
      suggestedCommentИсполнительЗначение(
        issue ?? {},
        mergeЗадачаКомментарии(comments ?? [], optimisticКомментарии),
        currentUserId,
      ),
    [issue, comments, optimisticКомментарии, currentUserId],
  );

  const threadКомментарии = useMemo(
    () => mergeЗадачаКомментарии(comments ?? [], optimisticКомментарии),
    [comments, optimisticКомментарии],
  );
  const breadcrumbНазвание = issue?.title ?? issueId ?? "Задача";
  const issueCacheRefs = useMemo(() => {
    const refs = new Set<string>();
    if (issueId) refs.add(issueId);
    if (issue?.id) refs.add(issue.id);
    if (issue?.identifier) refs.add(issue.identifier);
    return [...refs];
  }, [issue?.id, issue?.identifier, issueId]);

  const invalidateЗадачаDetail = useCallback(() => {
    for (const ref of issueCacheRefs) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(ref) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(ref) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.interactions(ref) });
    }
  }, [issueCacheRefs, queryClient]);
  const invalidateЗадачаThreadLazily = useCallback(() => {
    for (const ref of issueCacheRefs) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(ref), refetchТип: "inactive" });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(ref), refetchТип: "inactive" });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.interactions(ref), refetchТип: "inactive" });
    }
  }, [issueCacheRefs, queryClient]);

  const invalidateЗадачаЗапуститьState = useCallback(() => {
    for (const ref of issueCacheRefs) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.runs(ref) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(ref) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(ref) });
    }
  }, [issueCacheRefs, queryClient]);

  const removeCommentFromCache = useCallback((commentId: string) => {
    queryClient.setQueryData<InfiniteData<ЗадачаComment[], string | null> | undefined>(
      queryКлючs.issues.comments(issueId!),
      (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: removeЗадачаCommentFromPages(current.pages, commentId),
        };
      },
    );
  }, [issueId, queryClient]);

  const restoreQueuedCommentЧерновик = useCallback((body: string) => {
    commentComposerRef.current?.restoreЧерновик(body);
  }, []);

  const invalidateЗадачаCollections = useCallback(() => {
    if (selectedКомпанияId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listMineByMe(selectedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(selectedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listUnreadTouchedByMe(selectedКомпанияId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId) });
    }
  }, [queryClient, selectedКомпанияId]);
  const upsertInteractionInCache = useCallback((interaction: ЗадачаThreadInteraction) => {
    queryClient.setQueryData<ЗадачаThreadInteraction[] | undefined>(
      queryКлючs.issues.interactions(issueId!),
      (current) => {
        const existing = current ?? [];
        const next = existing.filter((entry) => entry.id !== interaction.id);
        next.push(interaction);
        next.sort((left, right) => {
          const createdAtDelta =
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          return createdAtDelta === 0 ? left.id.localeCompare(right.id) : createdAtDelta;
        });
        return next;
      },
    );
  }, [issueId, queryClient]);

  const applyOptimisticЗадачаCacheОбновить = useCallback((refs: Iterable<string>, data: Record<string, unknown>) => {
    queryClient.setQueriesData<Задача>(
      { queryКлюч: ["issues", "detail"] },
      (cached) => (cached && matchesЗадачаRef(cached, refs) ? applyOptimisticЗадачаFieldОбновить(cached, data) : cached),
    );

    if (!selectedКомпанияId) return;
    queryClient.setQueryData<Задача[] | undefined>(
      queryКлючs.issues.list(selectedКомпанияId),
      (cached) => applyOptimisticЗадачаFieldОбновитьToCollection(cached, refs, data),
    );
  }, [queryClient, selectedКомпанияId]);

  const mergeЗадачаResponseIntoCaches = useCallback((refs: Iterable<string>, nextЗадача: Задача) => {
    queryClient.setQueriesData<Задача>(
      { queryКлюч: ["issues", "detail"] },
      (cached) => (cached && matchesЗадачаRef(cached, refs) ? { ...cached, ...nextЗадача } : cached),
    );

    if (!selectedКомпанияId) return;
    queryClient.setQueryData<Задача[] | undefined>(
      queryКлючs.issues.list(selectedКомпанияId),
      (cached) => cached?.map((item) => (matchesЗадачаRef(item, refs) ? { ...item, ...nextЗадача } : item)),
    );
  }, [queryClient, selectedКомпанияId]);

  const markЗадачаRead = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onУспешно: () => {
      if (selectedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listMineByMe(selectedКомпанияId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(selectedКомпанияId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listUnreadTouchedByMe(selectedКомпанияId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(selectedКомпанияId) });
      }
    },
  });

  const updateЗадача = useMutation({
    mutationFn: (data: Record<string, unknown>) => issuesApi.update(issueId!, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) });
      if (selectedКомпанияId) {
        await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId) });
      }

      const previousЗадача = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(issueId!));
      const issueRefs = new Set<string>([issueId!]);
      if (previousЗадача?.id) issueRefs.add(previousЗадача.id);
      if (previousЗадача?.identifier) issueRefs.add(previousЗадача.identifier);

      const previousDetailQueries = queryClient
        .getQueriesData<Задача>({ queryКлюч: ["issues", "detail"] })
        .filter(([, cachedЗадача]) => cachedЗадача && matchesЗадачаRef(cachedЗадача, issueRefs));
      const previousList = selectedКомпанияId
        ? queryClient.getQueryData<Задача[]>(queryКлючs.issues.list(selectedКомпанияId))
        : undefined;

      applyOptimisticЗадачаCacheОбновить(issueRefs, data);

      return { previousDetailQueries, previousList, selectedКомпанияId };
    },
    onУспешно: ({ comment: _comment, ...nextЗадача }) => {
      const issueRefs = new Set<string>([issueId!, nextЗадача.id]);
      if (nextЗадача.identifier) issueRefs.add(nextЗадача.identifier);
      mergeЗадачаResponseIntoCaches(issueRefs, nextЗадача);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(issueId!) });
      invalidateЗадачаCollections();
    },
    onОшибка: (err, _variables, context) => {
      for (const [queryКлюч, previousЗадача] of context?.previousDetailQueries ?? []) {
        queryClient.setQueryData(queryКлюч, previousЗадача);
      }
      if (context?.selectedКомпанияId) {
        queryClient.setQueryData(queryКлючs.issues.list(context.selectedКомпанияId), context.previousList);
      }
      pushToast({
        title: "Задача update failed",
        body: err instanceof Ошибка ? err.message : "Unable to save issue changes",
        tone: "error",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) });
      if (selectedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId) });
      }
    },
  });
  const executeTreeControl = useMutation({
    mutationFn: async () => {
      if (treeControlMode === "resume") {
        const pauseHoldId = treeControlState?.activeПаузаHold?.holdId;
        if (!pauseHoldId) {
          throw new Ошибка("Нет active subtree pause hold is available to resume.");
        }
        const releasedHold = await issuesApi.releaseTreeHold(issueId!, pauseHoldId, {
          reason: treeControlReason.trim() || null,
          metadata: {
            wakeАгенты: treeControlWakeАгентыOnПродолжить,
          },
        });
        return { kind: "release" as const, hold: releasedHold };
      }
      const created = await issuesApi.createTreeHold(issueId!, {
        mode: treeControlMode,
        reason: treeControlReason.trim() || null,
        releasePolicy: {
          strategy: "manual",
          ...(treeControlMode === "pause" ? { note: treeControlОбласть === "leaf" ? "leaf_pause" : "full_pause" } : {}),
        },
        ...(treeControlMode === "restore"
          ? { metadata: { wakeАгенты: treeControlWakeАгентыOnПродолжить } }
          : {}),
      });
      return { kind: "create" as const, hold: created.hold, preview: created.preview };
    },
    onУспешно: async (result) => {
      const modeLabel = issueTreeControlLabel(result.hold.mode, treeControlОбласть);
      const cancelCount = result.preview?.totals.activeЗапуститьs ?? 0;
      pushToast({
        title: result.kind === "release"
          ? treeControlОбласть === "leaf" ? "Работа resumed" : "Subtree resumed"
          : result.hold.mode === "pause"
            ? treeControlОбласть === "leaf" ? "Работа paused" : "Subtree paused"
            : `${modeLabel} applied`,
        body: result.kind === "release"
          ? (result.hold.releaseReason?.trim() || (treeControlОбласть === "leaf" ? "Активен issue pause released." : "Активен subtree pause released."))
          : result.hold.mode === "pause"
            ? treeControlОбласть === "leaf"
              ? `Работа paused. ${cancelCount} run${cancelCount === 1 ? "" : "s"} cancelled.`
              : `Subtree paused. ${cancelCount} run${cancelCount === 1 ? "" : "s"} cancelled.`
            : result.hold.reason?.trim()
              ? result.hold.reason
              : "Subtree control applied.",
      });
      setTreeControlOpen(false);
      setTreeControlReason("");
      setTreeControlWakeАгентыOnПродолжить(false);
      setTreeControlОтменаПодтвердитьed(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.runs(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-control-state", issueId ?? "pending"] }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-holds", issueId ?? "pending"] }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-control-preview", issueId ?? "pending"] }),
      ]);
      if (selectedКомпанияId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId) }),
          ...(issue?.id
            ? [
                queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByРодитель(selectedКомпанияId, issue.id) }),
                queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByDescendantRoot(selectedКомпанияId, issue.id) }),
              ]
            : []),
        ]);
      }
    },
    onОшибка: (err) => {
      pushToast({
        title: "Unable to apply subtree control",
        body: err instanceof Ошибка ? err.message : "Please try again.",
        tone: "error",
      });
    },
  });
  const pauseЗадачаРаботаЗапустить = useMutation({
    mutationFn: async ({ runId, scope }: { runId: string; scope: "leaf" | "subtree" }) => {
      const created = await issuesApi.createTreeHold(issueId!, {
        mode: "pause",
        reason: "Приостановлен from active run controls.",
        releasePolicy: { strategy: "manual", note: scope === "leaf" ? "leaf_pause" : "full_pause" },
        metadata: { source: "issue_active_run_control", runId },
      });
      return created;
    },
    onУспешно: async (result) => {
      const cancelCount = result.preview?.totals.activeЗапуститьs ?? 0;
      pushToast({
        title: "Работа paused",
        body: cancelCount > 0
          ? `Работа paused. ${cancelCount} run${cancelCount === 1 ? "" : "s"} cancelled.`
          : "Работа paused. This issue is held until resume.",
        tone: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.runs(issueId!) }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-control-state", issueId ?? "pending"] }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-holds", issueId ?? "pending"] }),
        queryClient.invalidateQueries({ queryКлюч: ["issues", "tree-control-preview", issueId ?? "pending"] }),
      ]);
      invalidateЗадачаCollections();
    },
    onОшибка: (err) => {
      pushToast({
        title: "Unable to pause work",
        body: err instanceof Ошибка ? err.message : "Please try again.",
        tone: "error",
      });
    },
  });
  const handleЗадачаPropertiesОбновить = useCallback((data: Record<string, unknown>) => {
    updateЗадача.mutate(data);
  }, [updateЗадача.mutate]);

  const updateChildЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => issuesApi.update(id, data),
    onУспешно: () => {
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: ["issues", resolvedКомпанияId] });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(resolvedКомпанияId) });
      }
    },
    onОшибка: (err) => {
      pushToast({
        title: "Задача update failed",
        body: err instanceof Ошибка ? err.message : "Unable to save sub-issue changes",
        tone: "error",
      });
    },
  });
  const handleChildЗадачаОбновить = useCallback((id: string, data: Record<string, unknown>) => {
    updateChildЗадача.mutate({ id, data });
  }, [updateChildЗадача]);

  const checkЗадачаMonitorСейчас = useMutation({
    mutationFn: () => issuesApi.checkMonitorСейчас(issueId!),
    onУспешно: () => {
      invalidateЗадачаDetail();
      invalidateЗадачаЗапуститьState();
      invalidateЗадачаCollections();
      pushToast({
        title: "Monitor check queued",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Monitor check failed",
        body: err instanceof Ошибка ? err.message : "Unable to trigger the monitor right now",
        tone: "error",
      });
    },
  });

  const approvalDecision = useMutation({
    mutationFn: async ({ approvalId, action }: { approvalId: string; action: "approve" | "reject" }) => {
      if (action === "approve") {
        return approvalsApi.approve(approvalId);
      }
      return approvalsApi.reject(approvalId);
    },
    onMutate: ({ approvalId, action }) => {
      setОжиданиеСогласованиеAction({ approvalId, action });
    },
    onУспешно: (_approval, variables) => {
      invalidateЗадачаDetail();
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.approvals(issueId!) });
      invalidateЗадачаCollections();
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.detail(variables.approvalId) });
      if (resolvedКомпанияId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(resolvedКомпанияId) });
      }
      pushToast({
        title: variables.action === "approve" ? "Согласование approved" : "Согласование rejected",
        tone: "success",
      });
    },
    onОшибка: (err, variables) => {
      pushToast({
        title: variables.action === "approve" ? "Согласование failed" : "Отклонитьion failed",
        body: err instanceof Ошибка ? err.message : "Unable to update approval",
        tone: "error",
      });
    },
    onSettled: () => {
      setОжиданиеСогласованиеAction(null);
    },
  });

  const addComment = useMutation({
    mutationFn: ({ body, reopen, interrupt }: { body: string; reopen?: boolean; interrupt?: boolean }) =>
      issuesApi.addComment(issueId!, body, reopen, interrupt),
    onMutate: async ({ body, reopen, interrupt }) => {
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.comments(issueId!) });
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) });

      const previousЗадача = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(issueId!));
      const queuedComment = !interrupt ? readЗадачаЗапуститьStateFromCache(queryClient, issueId!).runningЗадачаЗапустить : null;
      const optimisticComment = issue
        ? createOptimisticЗадачаComment({
            companyId: issue.companyId,
            issueId: issue.id,
            body,
            authorUserId: currentUserId,
            clientСтатус: queuedComment ? "queued" : "pending",
            queueЦельЗапуститьId: queuedComment?.id ?? null,
          })
        : null;

      if (optimisticComment) {
        setOptimisticКомментарии((current) => [...current, optimisticComment]);
      }
      if (previousЗадача) {
        queryClient.setQueryData(
          queryКлючs.issues.detail(issueId!),
          applyOptimisticЗадачаCommentОбновить(previousЗадача, { reopen }),
        );
      }

      return {
        optimisticCommentId: optimisticComment?.clientId ?? null,
        queuedCommentЦельЗапуститьId: queuedComment?.id ?? null,
        previousЗадача,
      };
    },
    onУспешно: async (comment, _variables, context) => {
      if (context?.optimisticCommentId) {
        setOptimisticКомментарии((current) =>
          current.filter((entry) => entry.clientId !== context.optimisticCommentId),
        );
      }
      if (context?.optimisticCommentId && cancelledQueuedOptimisticCommentIdsRef.current.has(context.optimisticCommentId)) {
        cancelledQueuedOptimisticCommentIdsRef.current.delete(context.optimisticCommentId);
        try {
          await issuesApi.cancelComment(issueId!, comment.id);
          invalidateЗадачаDetail();
          invalidateЗадачаThreadLazily();
          invalidateЗадачаCollections();
          return;
        } catch (err) {
          pushToast({
            title: "Отмена failed",
            body: err instanceof Ошибка ? err.message : "Unable to cancel the queued comment",
            tone: "error",
          });
        }
      }
      if (context?.queuedCommentЦельЗапуститьId) {
        setLocallyQueuedCommentЗапуститьIds((current) => {
          const next = new Map(current);
          next.set(comment.id, context.queuedCommentЦельЗапуститьId!);
          return next;
        });
      }
      queryClient.setQueryData<InfiniteData<ЗадачаComment[], string | null>>(
        queryКлючs.issues.comments(issueId!),
        (current) => current ? {
          ...current,
          pages: upsertЗадачаCommentInPages(current.pages, comment),
        } : {
          pageParams: [null],
          pages: upsertЗадачаCommentInPages(undefined, comment),
        },
      );
    },
    onОшибка: (err, _variables, context) => {
      if (context?.optimisticCommentId) {
        setOptimisticКомментарии((current) =>
          current.filter((entry) => entry.clientId !== context.optimisticCommentId),
        );
      }
      if (context?.previousЗадача) {
        queryClient.setQueryData(queryКлючs.issues.detail(issueId!), context.previousЗадача);
      }
      pushToast({
        title: "Comment failed",
        body: err instanceof Ошибка ? err.message : "Unable to post comment",
        tone: "error",
      });
    },
    onSettled: (_result, _error, variables) => {
      invalidateЗадачаThreadLazily();
      if (variables.interrupt) {
        invalidateЗадачаЗапуститьState();
      }
      if (variables.reopen) {
        invalidateЗадачаCollections();
      }
    },
  });
  const acceptInteraction = useMutation({
    mutationFn: ({
      interaction,
      selectedClientКлючs,
    }: {
      interaction: ActionableЗадачаThreadInteraction;
      selectedClientКлючs?: string[];
    }) => issuesApi.acceptInteraction(issueId!, interaction.id, { selectedClientКлючs }),
    onУспешно: (interaction) => {
      upsertInteractionInCache(interaction);
      if (interaction.kind === "suggest_tasks" && resolvedКомпанияId && issue?.id) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listByРодитель(resolvedКомпанияId, issue.id) });
      }
      invalidateЗадачаDetail();
      invalidateЗадачаCollections();
      const createdCount = interaction.kind === "suggest_tasks"
        ? interaction.result?.createdЗадачи?.length ?? 0
        : 0;
      const skippedCount = interaction.kind === "suggest_tasks"
        ? interaction.result?.skippedClientКлючs?.length ?? 0
        : 0;
      pushToast({
        title: interaction.kind === "request_confirmation"
          ? "Request confirmed"
          : skippedCount > 0
          ? `Принятьed ${createdCount} draft${createdCount === 1 ? "" : "s"} and skipped ${skippedCount}`
          : "Suggested tasks accepted",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Принять failed",
        body: err instanceof Ошибка ? err.message : "Unable to accept the suggested tasks",
        tone: "error",
      });
    },
  });
  const rejectInteraction = useMutation({
    mutationFn: ({ interaction, reason }: { interaction: ActionableЗадачаThreadInteraction; reason?: string }) =>
      issuesApi.rejectInteraction(issueId!, interaction.id, reason),
    onУспешно: (interaction) => {
      upsertInteractionInCache(interaction);
      invalidateЗадачаDetail();
      invalidateЗадачаCollections();
      pushToast({
        title: interaction.kind === "request_confirmation" ? "Request declined" : "Suggestion rejected",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Отклонить failed",
        body: err instanceof Ошибка ? err.message : "Unable to reject the suggested tasks",
        tone: "error",
      });
    },
  });
  const answerInteraction = useMutation({
    mutationFn: ({
      interaction,
      answers,
    }: {
      interaction: ЗадачаThreadInteraction;
      answers: AskUserQuestionsAnswer[];
    }) => issuesApi.respondToInteraction(issueId!, interaction.id, { answers }),
    onУспешно: (interaction) => {
      upsertInteractionInCache(interaction);
      invalidateЗадачаDetail();
      invalidateЗадачаCollections();
      pushToast({
        title: "Answers submitted",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Отправить failed",
        body: err instanceof Ошибка ? err.message : "Unable to submit answers",
        tone: "error",
      });
    },
  });

  const cancelInteraction = useMutation({
    mutationFn: ({ interaction }: { interaction: AskUserQuestionsInteraction }) =>
      issuesApi.cancelInteraction(issueId!, interaction.id),
    onУспешно: (interaction) => {
      upsertInteractionInCache(interaction);
      invalidateЗадачаDetail();
      invalidateЗадачаCollections();
      pushToast({
        title: "Question cancelled",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Отмена failed",
        body: err instanceof Ошибка ? err.message : "Unable to cancel the question",
        tone: "error",
      });
    },
  });

  const addCommentAndReassign = useMutation({
    mutationFn: ({
      body,
      reopen,
      interrupt,
      reassignment,
    }: {
      body: string;
      reopen?: boolean;
      interrupt?: boolean;
      reassignment: CommentReassignment;
    }) =>
      issuesApi.update(issueId!, {
        comment: body,
        assigneeАгентId: reassignment.assigneeАгентId,
        assigneeUserId: reassignment.assigneeUserId,
        ...(reopen ? { status: "todo" } : {}),
        ...(interrupt ? { interrupt } : {}),
      }),
    onMutate: async ({ body, reopen, reassignment, interrupt }) => {
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.comments(issueId!) });
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.detail(issueId!) });

      const previousЗадача = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(issueId!));
      const queuedComment = !interrupt ? readЗадачаЗапуститьStateFromCache(queryClient, issueId!).runningЗадачаЗапустить : null;
      const optimisticComment = issue
        ? createOptimisticЗадачаComment({
            companyId: issue.companyId,
            issueId: issue.id,
            body,
            authorUserId: currentUserId,
            clientСтатус: queuedComment ? "queued" : "pending",
            queueЦельЗапуститьId: queuedComment?.id ?? null,
          })
        : null;

      if (optimisticComment) {
        setOptimisticКомментарии((current) => [...current, optimisticComment]);
      }
      if (previousЗадача) {
        queryClient.setQueryData(
          queryКлючs.issues.detail(issueId!),
          applyOptimisticЗадачаCommentОбновить(previousЗадача, { reopen, reassignment }),
        );
      }

      return {
        optimisticCommentId: optimisticComment?.clientId ?? null,
        queuedCommentЦельЗапуститьId: queuedComment?.id ?? null,
        previousЗадача,
      };
    },
    onУспешно: async (result, _variables, context) => {
      if (context?.optimisticCommentId) {
        setOptimisticКомментарии((current) =>
          current.filter((entry) => entry.clientId !== context.optimisticCommentId),
        );
      }

      const { comment, ...nextЗадача } = result;
      queryClient.setQueryData(queryКлючs.issues.detail(issueId!), nextЗадача);
      if (comment && context?.optimisticCommentId && cancelledQueuedOptimisticCommentIdsRef.current.has(context.optimisticCommentId)) {
        cancelledQueuedOptimisticCommentIdsRef.current.delete(context.optimisticCommentId);
        try {
          await issuesApi.cancelComment(issueId!, comment.id);
          invalidateЗадачаDetail();
          invalidateЗадачаThreadLazily();
          invalidateЗадачаCollections();
          return;
        } catch (err) {
          pushToast({
            title: "Отмена failed",
            body: err instanceof Ошибка ? err.message : "Unable to cancel the queued comment",
            tone: "error",
          });
        }
      }
      if (comment && context?.queuedCommentЦельЗапуститьId) {
        setLocallyQueuedCommentЗапуститьIds((current) => {
          const next = new Map(current);
          next.set(comment.id, context.queuedCommentЦельЗапуститьId!);
          return next;
        });
      }
      if (comment) {
        queryClient.setQueryData<InfiniteData<ЗадачаComment[], string | null>>(
          queryКлючs.issues.comments(issueId!),
          (current) => current ? {
            ...current,
            pages: upsertЗадачаCommentInPages(current.pages, comment),
          } : {
            pageParams: [null],
            pages: upsertЗадачаCommentInPages(undefined, comment),
          },
        );
      }
    },
    onОшибка: (err, _variables, context) => {
      if (context?.optimisticCommentId) {
        setOptimisticКомментарии((current) =>
          current.filter((entry) => entry.clientId !== context.optimisticCommentId),
        );
      }
      if (context?.previousЗадача) {
        queryClient.setQueryData(queryКлючs.issues.detail(issueId!), context.previousЗадача);
      }
      pushToast({
        title: "Comment failed",
        body: err instanceof Ошибка ? err.message : "Unable to post comment",
        tone: "error",
      });
    },
    onSettled: (_result, _error, variables) => {
      invalidateЗадачаThreadLazily();
      if (variables.interrupt) {
        invalidateЗадачаЗапуститьState();
      }
      invalidateЗадачаCollections();
    },
  });

  const interruptQueuedComment = useMutation({
    mutationFn: (runId: string) => heartbeatsApi.cancel(runId),
    onMutate: async (runId) => {
      await Promise.all(issueCacheRefs.flatMap((ref) => [
        queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.runs(ref) }),
        queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(ref) }),
        queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(ref) }),
        queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.detail(ref) }),
      ]));

      const previousЗапуститьState = issueCacheRefs.map((ref) => ({
        ref,
        runs: queryClient.getQueryData<ЗапуститьForЗадача[]>(queryКлючs.issues.runs(ref)),
        liveЗапуститьs: queryClient.getQueryData<LiveЗапуститьForЗадача[]>(queryКлючs.issues.liveЗапуститьs(ref)),
        activeЗапустить: queryClient.getQueryData<АктивенЗапуститьForЗадача | null>(queryКлючs.issues.activeЗапустить(ref)),
        issue: queryClient.getQueryData<Задача>(queryКлючs.issues.detail(ref)),
      }));
      const previousLocalQueuedCommentЗапуститьIds = locallyQueuedCommentЗапуститьIds;
      const cachedАктивенЗапустить =
        previousЗапуститьState.find((state) => state.activeЗапустить?.id === runId)?.activeЗапустить ??
        previousЗапуститьState.find((state) => state.activeЗапустить)?.activeЗапустить ??
        null;
      const liveЗапуститьList = dedupeLiveЗапуститьsById(previousЗапуститьState.flatMap((state) => state.liveЗапуститьs ?? []));
      const runningЗадачаЗапустить = resolveВыполняетсяЗадачаЗапустить(cachedАктивенЗапустить, liveЗапуститьList);
      const targetЗапустить =
        cachedАктивенЗапустить?.id === runId
          ? cachedАктивенЗапустить
          : liveЗапуститьList?.find((run) => run.id === runId) ?? runningЗадачаЗапустить ?? null;

      if (targetЗапустить) {
        const interruptedAt = new Date().toISOString();
        for (const ref of issueCacheRefs) {
          queryClient.setQueryData<ЗапуститьForЗадача[] | undefined>(
            queryКлючs.issues.runs(ref),
            (current) => upsertInterruptedЗапустить(current, targetЗапустить, interruptedAt),
          );
        }
      }

      for (const ref of issueCacheRefs) {
        queryClient.setQueryData(
          queryКлючs.issues.liveЗапуститьs(ref),
          (current: LiveЗапуститьForЗадача[] | undefined) => removeLiveЗапуститьById(current, runId),
        );
        queryClient.setQueryData(
          queryКлючs.issues.activeЗапустить(ref),
          (current: АктивенЗапуститьForЗадача | null | undefined) => (current?.id === runId ? null : current),
        );
        queryClient.setQueryData(
          queryКлючs.issues.detail(ref),
          (current: Задача | undefined) => clearЗадачаExecutionЗапустить(current, runId),
        );
      }
      setLocallyQueuedCommentЗапуститьIds((current) => {
        const next = new Map([...current].filter(([, targetЗапуститьId]) => targetЗапуститьId !== runId));
        return next.size === current.size ? current : next;
      });

      return {
        previousЗапуститьState,
        previousLocalQueuedCommentЗапуститьIds,
      };
    },
    onУспешно: () => {
      invalidateЗадачаDetail();
      invalidateЗадачаЗапуститьState();
      pushToast({
        title: "Interrupt requested",
        body: "The active run is stopping so queued comments can continue next.",
        tone: "success",
      });
    },
    onОшибка: (err, _runId, context) => {
      for (const state of context?.previousЗапуститьState ?? []) {
        queryClient.setQueryData(queryКлючs.issues.runs(state.ref), state.runs);
        queryClient.setQueryData(queryКлючs.issues.liveЗапуститьs(state.ref), state.liveЗапуститьs);
        queryClient.setQueryData(queryКлючs.issues.activeЗапустить(state.ref), state.activeЗапустить);
        queryClient.setQueryData(queryКлючs.issues.detail(state.ref), state.issue);
      }
      if (context?.previousLocalQueuedCommentЗапуститьIds) {
        setLocallyQueuedCommentЗапуститьIds(context.previousLocalQueuedCommentЗапуститьIds);
      }
      pushToast({
        title: "Interrupt failed",
        body: err instanceof Ошибка ? err.message : "Unable to interrupt the active run",
        tone: "error",
      });
    },
  });

  const cancelQueuedComment = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => issuesApi.cancelComment(issueId!, commentId),
    onУспешно: (comment) => {
      setLocallyQueuedCommentЗапуститьIds((current) => {
        if (!current.has(comment.id)) return current;
        const next = new Map(current);
        next.delete(comment.id);
        return next;
      });
      removeCommentFromCache(comment.id);
      restoreQueuedCommentЧерновик(comment.body);
      invalidateЗадачаDetail();
      invalidateЗадачаThreadLazily();
      invalidateЗадачаCollections();
      pushToast({
        title: "Queued comment canceled",
        body: "The queued message was restored to the composer.",
        tone: "success",
      });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Отмена failed",
        body: err instanceof Ошибка ? err.message : "Unable to cancel the queued comment",
        tone: "error",
      });
    },
  });

  const handleОтменаQueuedComment = useCallback((commentId: string) => {
    if (commentId.startsWith("optimistic-")) {
      cancelledQueuedOptimisticCommentIdsRef.current.add(commentId);
      let cancelledCommentBody: string | null = null;
      setOptimisticКомментарии((current) => {
        const next = takeOptimisticЗадачаComment(current, commentId);
        cancelledCommentBody = next.comment?.body ?? null;
        return next.comments;
      });
      if (cancelledCommentBody) {
        restoreQueuedCommentЧерновик(cancelledCommentBody);
        pushToast({
          title: "Queued comment canceled",
          body: "The queued message was restored to the composer.",
          tone: "success",
        });
      }
      return;
    }

    void cancelQueuedComment.mutateAsync({ commentId });
  }, [cancelQueuedComment, restoreQueuedCommentЧерновик, pushToast]);

  const feedbackVoteMutation = useMutation({
    mutationFn: (variables: {
      targetТип: "issue_comment" | "issue_document_revision";
      targetId: string;
      vote: "up" | "down";
      reason?: string;
      allowSharing?: boolean;
      sharingPreferenceAtОтправить: "allowed" | "not_allowed" | "prompt";
    }) =>
      issuesApi.upsertFeedbackVote(issueId!, {
        targetТип: variables.targetТип,
        targetId: variables.targetId,
        vote: variables.vote,
        ...(variables.reason ? { reason: variables.reason } : {}),
        ...(variables.allowSharing ? { allowSharing: true } : {}),
      }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryКлюч: queryКлючs.issues.feedbackVotes(issueId!) });
      const previousVotes = queryClient.getQueryData<FeedbackVote[]>(
        queryКлючs.issues.feedbackVotes(issueId!),
      );
      queryClient.setQueryData<FeedbackVote[]>(
        queryКлючs.issues.feedbackVotes(issueId!),
        mergeOptimisticFeedbackVote(
          previousVotes,
          {
            issueId: issueId!,
            targetТип: variables.targetТип,
            targetId: variables.targetId,
            vote: variables.vote,
            reason: variables.reason,
          },
          currentUserId,
        ),
      );
      return { previousVotes };
    },
    onУспешно: (_savedVote, variables) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.feedbackVotes(issueId!) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.instance.generalНастройки });
      pushToast({
        title:
          variables.sharingPreferenceAtОтправить === "prompt"
            ? variables.allowSharing
              ? "Feedback saved. Future votes will share"
              : "Feedback saved. Future votes will stay local"
            : variables.allowSharing
              ? "Feedback saved and sharing enabled"
              : "Feedback saved",
        tone: "success",
      });
    },
    onОшибка: (err, _variables, context) => {
      if (context?.previousVotes) {
        queryClient.setQueryData(queryКлючs.issues.feedbackVotes(issueId!), context.previousVotes);
      }
      pushToast({
        title: "Ошибка to save feedback",
        body: err instanceof Ошибка ? err.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedКомпанияId) throw new Ошибка("Нет company selected");
      return issuesApi.uploadAttachment(selectedКомпанияId, issueId!, file);
    },
    onУспешно: () => {
      setAttachmentОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.attachments(issueId!) });
      invalidateЗадачаDetail();
    },
    onОшибка: (err) => {
      setAttachmentОшибка(err instanceof Ошибка ? err.message : "Загрузить failed");
    },
  });

  const importMarkdownDocument = useMutation({
    mutationFn: async (file: File) => {
      const baseИмя = fileBaseИмя(file.name);
      const key = slugifyDocumentКлюч(baseИмя);
      const existing = (issue?.documentSummaries ?? []).find((doc) => doc.key === key) ?? null;
      const body = await file.text();
      const inferredНазвание = titleizeFilename(baseИмя);
      const nextНазвание = existing?.title ?? inferredНазвание ?? null;
      return issuesApi.upsertDocument(issueId!, key, {
        title: key === "plan" ? null : nextНазвание,
        format: "markdown",
        body,
        baseRevisionId: existing?.latestRevisionId ?? null,
      });
    },
    onУспешно: () => {
      setAttachmentОшибка(null);
      invalidateЗадачаDetail();
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.documents(issueId!) });
    },
    onОшибка: (err) => {
      setAttachmentОшибка(err instanceof Ошибка ? err.message : "Document import failed");
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) => issuesApi.deleteAttachment(attachmentId),
    onУспешно: () => {
      setAttachmentОшибка(null);
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.attachments(issueId!) });
      invalidateЗадачаDetail();
    },
    onОшибка: (err) => {
      setAttachmentОшибка(err instanceof Ошибка ? err.message : "Ошибка удаления");
    },
  });

  const archiveFromВходящие = useMutation({
    mutationFn: (id: string) => issuesApi.archiveFromВходящие(id),
    onУспешно: () => {
      invalidateЗадачаCollections();
      navigate(sourceBreadcrumb.href.startsWith("/inbox") ? sourceBreadcrumb.href : "/inbox", { replace: true });
      pushToast({ title: "Задача archived from inbox", tone: "success" });
    },
    onОшибка: (err) => {
      pushToast({
        title: "Архивировать failed",
        body: err instanceof Ошибка ? err.message : "Unable to archive this issue from the inbox",
        tone: "error",
      });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      sourceBreadcrumb,
      { label: hasLiveЗапуститьs ? `🔵 ${breadcrumbНазвание}` : breadcrumbНазвание },
    ]);
  }, [
    breadcrumbНазвание,
    hasLiveЗапуститьs,
    setBreadcrumbs,
    sourceBreadcrumb.href,
    sourceBreadcrumb.label,
  ]);

  const isFromВходящие = resolvedЗадачаDetailState?.issueDetailSource === "inbox";

  // Scroll to top on forward navigation (PUSH/REPLACE) so issue doesn't
  // inherit the inbox/issues-list scroll position on mobile.
  useEffect(() => {
    if (navigationТип === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
  }, [issueId, navigationТип]);

  // Redirect to identifier-based URL if navigated via UUID
  useEffect(() => {
    const nextState = resolvedЗадачаDetailState ?? location.state;
    if (issue?.identifier && issueId !== issue.identifier) {
      rememberЗадачаDetailLocationState(issue.identifier, nextState, location.search);
      navigate(createЗадачаDetailПуть(issue.identifier), {
        replace: true,
        state: nextState,
      });
      return;
    }

    if (issueId && hasLegacyЗадачаDetailQuery(location.search)) {
      rememberЗадачаDetailLocationState(issueId, nextState, location.search);
      navigate(createЗадачаDetailПуть(issueId), {
        replace: true,
        state: nextState,
      });
    }
  }, [issue, issueId, navigate, location.state, location.search, resolvedЗадачаDetailState]);

  useEffect(() => {
    if (!issue?.id) return;
    if (lastMarkedReadЗадачаIdRef.current === issue.id) return;
    lastMarkedReadЗадачаIdRef.current = issue.id;
    markЗадачаRead.mutate(issue.id);
  }, [issue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelЗадача) {
      closePanel();
      return;
    }
    openPanel(
      <ЗадачаProperties
        issue={panelЗадача}
        childЗадачи={panelChildЗадачи}
        onДобавитьSubЗадача={openNewSubЗадача}
        onОбновить={handleЗадачаPropertiesОбновить}
      />
    );
    return () => closePanel();
  }, [
    closePanel,
    handleЗадачаPropertiesОбновить,
    issuePanelКлюч,
    openNewSubЗадача,
    openPanel,
    panelChildЗадачи,
    panelЗадача,
  ]);

  const goToВходящиеShortcutArmedRef = useRef(false);
  const goToВходящиеShortcutTimeoutRef = useRef<number | null>(null);
  const canQuickАрхивироватьFromВходящие =
    keyboardShortcutsВключитьd &&
    !issue?.hiddenAt;

  useEffect(() => {
    if (!issue?.id || !canQuickАрхивироватьFromВходящие) return;
    const handleКлючDown = (event: КлючboardEvent) => {
      const action = resolveВходящиеQuickАрхивироватьКлючAction({
        armed: canQuickАрхивироватьFromВходящие,
        defaultPrevented: event.defaultPrevented,
        key: event.key,
        metaКлюч: event.metaКлюч,
        ctrlКлюч: event.ctrlКлюч,
        altКлюч: event.altКлюч,
        target: event.target,
        hasOpenDialog: hasBlockingShortcutDialog(document),
      });

      if (action !== "archive") return;

      event.preventПо умолчанию();
      if (!archiveFromВходящие.isОжидание) {
        archiveFromВходящие.mutate(issue.id);
      }
    };

    document.addEventListener("keydown", handleКлючDown, true);
    return () => {
      document.removeEventListener("keydown", handleКлючDown, true);
    };
  }, [archiveFromВходящие, canQuickАрхивироватьFromВходящие, issue?.id]);

  useEffect(() => {
    if (!keyboardShortcutsВключитьd) {
      goToВходящиеShortcutArmedRef.current = false;
      if (goToВходящиеShortcutTimeoutRef.current !== null) {
        window.clearTimeout(goToВходящиеShortcutTimeoutRef.current);
        goToВходящиеShortcutTimeoutRef.current = null;
      }
      return;
    }

    const clearArmTimeout = () => {
      if (goToВходящиеShortcutTimeoutRef.current !== null) {
        window.clearTimeout(goToВходящиеShortcutTimeoutRef.current);
        goToВходящиеShortcutTimeoutRef.current = null;
      }
    };

    const disarm = () => {
      goToВходящиеShortcutArmedRef.current = false;
      clearArmTimeout();
    };

    const arm = () => {
      goToВходящиеShortcutArmedRef.current = true;
      clearArmTimeout();
      goToВходящиеShortcutTimeoutRef.current = window.setTimeout(() => {
        goToВходящиеShortcutArmedRef.current = false;
        goToВходящиеShortcutTimeoutRef.current = null;
      }, 1200);
    };

    const handlePointerDown = () => {
      disarm();
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target !== document.body) {
        disarm();
      }
    };

    const handleКлючDown = (event: КлючboardEvent) => {
      const action = resolveЗадачаDetailGoКлючAction({
        armed: goToВходящиеShortcutArmedRef.current,
        defaultPrevented: event.defaultPrevented,
        key: event.key,
        metaКлюч: event.metaКлюч,
        ctrlКлюч: event.ctrlКлюч,
        altКлюч: event.altКлюч,
        target: event.target,
        hasOpenDialog: hasBlockingShortcutDialog(document),
      });

      if (action === "ignore") return;
      if (action === "arm") {
        arm();
        return;
      }

      disarm();
      if (action === "navigate_inbox") {
        event.preventПо умолчанию();
        event.stopPropagation();
        navigate(sourceBreadcrumb.href.startsWith("/inbox") ? sourceBreadcrumb.href : "/inbox");
        return;
      }
      if (action === "focus_comment") {
        event.preventПо умолчанию();
        event.stopPropagation();
        setDetailTab("chat");
        setОжиданиеCommentComposerFocusКлюч((current) => current + 1);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleКлючDown, true);
    return () => {
      disarm();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleКлючDown, true);
    };
  }, [keyboardShortcutsВключитьd, navigate, sourceBreadcrumb.href]);

  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith("#document-")) return;
    const documentКлюч = decodeURIComponent(hash.slice("#document-".length));
    if (documentКлюч !== ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY) return;
    setDetailTab("activity");
    setHandoffFocusSignal((current) => current + 1);
  }, [location.hash]);

  useEffect(() => {
    if (pendingCommentComposerFocusКлюч === 0) return;
    if (detailTab !== "chat") return;
    commentComposerRef.current?.focus();
  }, [detailTab, pendingCommentComposerFocusКлюч]);

  const isImageAttachment = (attachment: ЗадачаAttachment) => attachment.contentТип.startsWith("image/");
  const attachmentList = attachments ?? [];
  const imageAttachments = attachmentList.filter(isImageAttachment);
  const nonImageAttachments = attachmentList.filter((a) => !isImageAttachment(a));

  const handleChatImageClick = useCallback(
    (src: string) => {
      // Try exact contentПуть match first
      let idx = imageAttachments.findIndex((a) => a.contentПуть === src);
      if (idx < 0) {
        // Try matching by asset ID extracted from /api/assets/{assetId}/content URLs
        const assetMatch = src.match(/\/api\/assets\/([^/]+)\/content/);
        if (assetMatch) {
          idx = imageAttachments.findIndex((a) => a.assetId === assetMatch[1]);
        }
      }
      if (idx >= 0) {
        setGalleryIndex(idx);
        setGalleryOpen(true);
      } else {
        // Image not in attachment list — open in new tab
        window.open(src, "_blank");
      }
    },
    [imageAttachments],
  );

  const copyЗадачаToClipboard = async () => {
    if (!issue) return;
    const decodeEntities = (text: string) => {
      const el = document.createElement("textarea");
      el.innerHTML = text;
      return el.value;
    };
    const title = decodeEntities(issue.title);
    const body = decodeEntities(issue.description ?? "");
    const md = `# ${issue.identifier}: ${title}\n\n${body}`.trimEnd();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    pushToast({ title: "Copied to clipboard", tone: "success" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Gmail-style mobile toolbar when viewing an issue from inbox.
  // Callbacks are stored in a ref so the effect deps stay stable and
  // don't trigger an infinite render loop (useMutation results and
  // non-memoized functions change identity every render).
  const inboxToolbarCallbacksRef = useRef({
    onАрхивировать: () => {
      if (!archiveFromВходящие.isОжидание && issue?.id) archiveFromВходящие.mutate(issue.id);
    },
    onКопировать: () => copyЗадачаToClipboard(),
    onProperties: () => setMobilePropsOpen(true),
    onHide: () => {
      updateЗадача.mutate(
        { hiddenAt: new Date().toISOString() },
        { onУспешно: () => navigate("/issues/all") },
      );
    },
  });
  inboxToolbarCallbacksRef.current = {
    onАрхивировать: () => {
      if (!archiveFromВходящие.isОжидание && issue?.id) archiveFromВходящие.mutate(issue.id);
    },
    onКопировать: () => copyЗадачаToClipboard(),
    onProperties: () => setMobilePropsOpen(true),
    onHide: () => {
      updateЗадача.mutate(
        { hiddenAt: new Date().toISOString() },
        { onУспешно: () => navigate("/issues/all") },
      );
    },
  };

  const backHref = sourceBreadcrumb.href ?? "/inbox";
  const showВходящиеToolbar = isMobile && isFromВходящие;
  const archiveОжидание = archiveFromВходящие.isОжидание;
  const issueHidden = !!issue?.hiddenAt;
  const canАрхивироватьFromВходящие = isFromВходящие && !!issue?.id && !issueHidden;

  useEffect(() => {
    if (!showВходящиеToolbar) {
      setMobileToolbar(null);
      return;
    }

    setMobileToolbar(
      <ВходящиеMobileToolbar
        backHref={backHref}
        issueId={issue?.id}
        issueHidden={issueHidden}
        archiveОжидание={archiveОжидание}
        onАрхивировать={() => inboxToolbarCallbacksRef.current.onАрхивировать()}
        onКопировать={() => inboxToolbarCallbacksRef.current.onКопировать()}
        onProperties={() => inboxToolbarCallbacksRef.current.onProperties()}
        onHide={() => inboxToolbarCallbacksRef.current.onHide()}
      />,
    );

    return () => setMobileToolbar(null);
  }, [showВходящиеToolbar, backHref, issue?.id, issueHidden, archiveОжидание, setMobileToolbar]);

  const attachmentsInitialЗагрузка = attachmentsЗагрузка && attachments === undefined;
  const loadOlderКомментарии = useCallback(() => {
    void fetchOlderКомментарии();
  }, [fetchOlderКомментарии]);
  const refetchLatestКомментарии = useCallback(async () => {
    // Refetch page 0 first so comments that arrived after initial load are
    // visible, then load every remaining older page. The chat thread is
    // paginated and virtualized, so "latest" must be resolved against the
    // complete comment set rather than the current loaded window.
    const refreshed = await refetchКомментарии();
    const loaded = await loadRemainingЗадачаCommentPages<ЗадачаComment>({
      pages: refreshed.data?.pages,
      pageParams: refreshed.data?.pageParams as Array<string | null> | undefined,
      pageSize: ISSUE_COMMENT_PAGE_SIZE,
      maxPages: JUMP_TO_LATEST_MAX_COMMENT_PAGES,
      fetchPage: (afterCommentId) =>
        issuesApi.listКомментарии(issueId!, {
          order: "desc",
          limit: ISSUE_COMMENT_PAGE_SIZE,
          after: afterCommentId,
        }),
    });
    queryClient.setQueryData<InfiniteData<ЗадачаComment[], string | null>>(
      queryКлючs.issues.comments(issueId!),
      loaded,
    );
    await new Promise<void>((resolve) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => resolve());
    });
  }, [issueId, queryClient, refetchКомментарии]);
  useEffect(() => {
    if (!shouldPrefetchOlderКомментарии) return;
    void fetchOlderКомментарии();
  }, [fetchOlderКомментарии, shouldPrefetchOlderКомментарии]);
  const handleCommentVote = useCallback(async (commentId: string, vote: "up" | "down", options?: { allowSharing?: boolean; reason?: string }) => {
    await feedbackVoteMutation.mutateAsync({
      targetТип: "issue_comment",
      targetId: commentId,
      vote,
      reason: options?.reason,
      allowSharing: options?.allowSharing,
      sharingPreferenceAtОтправить: feedbackDataSharingPreference,
    });
  }, [feedbackDataSharingPreference, feedbackVoteMutation]);
  const handleChatДобавить = useCallback(async (body: string, reopen?: boolean, reassignment?: CommentReassignment) => {
    if (reassignment) {
      await addCommentAndReassign.mutateAsync({ body, reopen, reassignment });
      return;
    }
    await addComment.mutateAsync({ body, reopen });
  }, [addComment, addCommentAndReassign]);
  const handleCommentImageЗагрузить = useCallback(async (file: File) => {
    const attachment = await uploadAttachment.mutateAsync(file);
    return attachment.contentПуть;
  }, [uploadAttachment]);
  const handleCommentAttachImage = useCallback(async (file: File) => {
    return uploadAttachment.mutateAsync(file);
  }, [uploadAttachment]);
  const handleInterruptQueuedЗапустить = useCallback(async (runId: string) => {
    await interruptQueuedComment.mutateAsync(runId);
  }, [interruptQueuedComment]);
  const handleПринятьInteraction = useCallback(async (
    interaction: ActionableЗадачаThreadInteraction,
    selectedClientКлючs?: string[],
  ) => {
    await acceptInteraction.mutateAsync({ interaction, selectedClientКлючs });
  }, [acceptInteraction]);
  const handleОтклонитьInteraction = useCallback(async (interaction: ActionableЗадачаThreadInteraction, reason?: string) => {
    await rejectInteraction.mutateAsync({ interaction, reason });
  }, [rejectInteraction]);
  const handleОтправитьInteractionAnswers = useCallback(async (
    interaction: ЗадачаThreadInteraction,
    answers: AskUserQuestionsAnswer[],
  ) => {
    await answerInteraction.mutateAsync({ interaction, answers });
  }, [answerInteraction]);
  const handleОтменаInteraction = useCallback(async (interaction: AskUserQuestionsInteraction) => {
    await cancelInteraction.mutateAsync({ interaction });
  }, [cancelInteraction]);
  const canПродолжитьFromНазадlog = issue?.status === "backlog" && Boolean(issue.assigneeАгентId || issue.assigneeUserId);
  const handleПродолжитьFromНазадlog = useCallback(async () => {
    await updateЗадача.mutateAsync({ status: "todo" });
  }, [updateЗадача.mutateAsync]);

  const treeПредпросмотрAffectedЗадачи = useMemo(
    () => (treeControlПредпросмотр?.issues ?? []).filter((candidate) => !candidate.skipped),
    [treeControlПредпросмотр],
  );
  const treeПредпросмотрDisplayЗадачи = useMemo(
    () => {
      const previewЗадачи = treeControlПредпросмотр?.issues ?? [];
      if (treeControlMode !== "pause") {
        return previewЗадачи.filter((candidate) => !candidate.skipped);
      }
      return previewЗадачи.filter((candidate) => !candidate.skipped || candidate.skipReason === "terminal_status");
    },
    [treeControlMode, treeControlПредпросмотр],
  );
  const activeПаузаHold = treeControlState?.activeПаузаHold ?? null;
  const activeRootПаузаHoldsForDisplay = useMemo(
    () => activeПаузаHold?.isRoot === true ? activeRootПаузаHolds : [],
    [activeПаузаHold?.isRoot, activeRootПаузаHolds],
  );
  const heldЗадачаIds = useMemo(() => {
    const ids = new Set<string>();
    for (const hold of activeRootПаузаHoldsForDisplay) {
      for (const member of hold.members ?? []) {
        if (member.skipped) continue;
        ids.add(member.issueId);
      }
    }
    return ids;
  }, [activeRootПаузаHoldsForDisplay]);
  const mutedChildЗадачаIds = useMemo(() => {
    const ids = new Set<string>();
    for (const child of childЗадачи) {
      if (heldЗадачаIds.has(child.id)) ids.add(child.id);
    }
    return ids;
  }, [childЗадачи, heldЗадачаIds]);
  const childПаузаBadgeById = useMemo(() => {
    const badges = new Map<string, string>();
    for (const child of childЗадачи) {
      if (!heldЗадачаIds.has(child.id)) continue;
      badges.set(child.id, "Приостановлен");
    }
    return badges;
  }, [childЗадачи, heldЗадачаIds]);
  const activeПаузаHoldRoot = useMemo(() => {
    if (!activeПаузаHold) return null;
    if (activeПаузаHold.rootЗадачаId === issue?.id) return issue ?? null;
    return issue?.ancestors?.find((ancestor) => ancestor.id === activeПаузаHold.rootЗадачаId) ?? null;
  }, [activeПаузаHold, issue]);
  const activeRootПаузаHold = useMemo(
    () => activeRootПаузаHoldsForDisplay.find((hold) => hold.id === activeПаузаHold?.holdId) ?? null,
    [activeПаузаHold?.holdId, activeRootПаузаHoldsForDisplay],
  );

  if (isЗагрузка) return <ЗадачаDetailЗагрузкаState headerSeed={issueHeaderSeed} />;
  if (error) return <p classИмя="text-sm text-destructive">{error.message}</p>;
  if (!issue) return null;

  // Ancestors are returned oldest-first from the server (root at end, immediate parent at start)
  const ancestors = issue.ancestors ?? [];
  const handleFilePicked = async (evt: ChangeEvent<HTMLInputElement>) => {
    const files = evt.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (isMarkdownFile(file)) {
        await importMarkdownDocument.mutateAsync(file);
      } else {
        await uploadAttachment.mutateAsync(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAttachmentDrop = async (evt: DragEvent<HTMLDivElement>) => {
    evt.preventПо умолчанию();
    setAttachmentDragАктивен(false);
    const files = evt.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (isMarkdownFile(file)) {
        await importMarkdownDocument.mutateAsync(file);
      } else {
        await uploadAttachment.mutateAsync(file);
      }
    }
  };

  const hasAttachments = attachmentList.length > 0;
  const treeПредпросмотрПредупреждениеs = treeControlПредпросмотр?.warnings ?? [];
  const heldDescendantCount = activeRootПаузаHold?.members?.filter((member) => member.depth > 0 && !member.skipped).length
    ?? Math.max(heldЗадачаIds.size - 1, 0);
  const canShowSubtreeControls = canManageTreeControl && childЗадачи.length > 0;
  const canПродолжитьSubtree = canShowSubtreeControls && activeПаузаHold?.isRoot === true;
  const canRestoreSubtree = canShowSubtreeControls && activeОтменаHolds.length > 0;
  const isTerminalЗадача = issue.status === "done" || issue.status === "cancelled";
  const isАгентOwnedНетnTerminalЗадача = Boolean(issue.assigneeАгентId) && !isTerminalЗадача;
  const canПаузаLeafРабота = canManageTreeControl && childЗадачи.length === 0 && !activeПаузаHold && !isTerminalЗадача;
  const canПродолжитьLeafРабота = canManageTreeControl && childЗадачи.length === 0 && activeПаузаHold?.isRoot === true;
  const treeControlОбласть: "leaf" | "subtree" = childЗадачи.length === 0 ? "leaf" : "subtree";
  const previewAffectedЗадачаCount = treeПредпросмотрAffectedЗадачи.length;
  const previewAffectedАгентCount = treeControlПредпросмотр?.totals.affectedАгенты ?? 0;
  const treeControlPrimaryButtonLabel =
    treeControlMode === "pause"
      ? treeControlОбласть === "leaf"
        ? "Пауза work"
        : "Пауза and stop work"
      : treeControlMode === "cancel"
        ? `Отмена ${previewAffectedЗадачаCount} issues`
      : treeControlMode === "restore"
          ? `Restore ${previewAffectedЗадачаCount} issues`
          : treeControlОбласть === "leaf"
            ? "Продолжить work"
            : "Продолжить subtree";
  const treeПредпросмотрAffectedЗадачаRows = treeПредпросмотрDisplayЗадачи.map((candidate) => ({
    candidate,
    issue: {
      ...issue,
      id: candidate.id,
      identifier: candidate.identifier,
      title: candidate.title,
      status: candidate.status,
      parentId: candidate.parentId,
      assigneeАгентId: candidate.assigneeАгентId,
      assigneeUserId: candidate.assigneeUserId,
      executionЗапуститьId: candidate.activeЗапустить?.id ?? null,
    } satisfies Задача,
  }));
  const treeПредпросмотрAffectedАгентRows = (treeControlПредпросмотр?.affectedАгенты ?? [])
    .map((previewАгент) => ({
      ...previewАгент,
      agent: agentMap.get(previewАгент.agentId) ?? null,
    }))
    .sort((a, b) => (a.agent?.name ?? a.agentId).localeCompare(b.agent?.name ?? b.agentId));
  const pausedComposerHint = activeПаузаHold
    ? (
      issue.assigneeАгентId
        ? `Отправитьing this comment will wake ${agentMap.get(issue.assigneeАгентId)?.name ?? "the assignee"} for triage while the subtree remains paused.`
        : "Assign an agent to wake them for triage while the subtree remains paused."
    )
    : null;
  const composerHint = pausedComposerHint;
  const queuedCommentReason: "hold" | "active_run" | "other" = activeПаузаHold ? "hold" : "active_run";
  const canApplyTreeControl =
    Boolean(treeControlПредпросмотр)
    && !treeControlПредпросмотрЗагрузка
    && (treeControlMode !== "cancel" || treeControlОтменаПодтвердитьed);
  const attachmentЗагрузитьButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        classИмя="hidden"
        onChange={handleFilePicked}
        multiple
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadAttachment.isОжидание || importMarkdownDocument.isОжидание}
        classИмя={cn(
          "shadow-none",
          attachmentDragАктивен && "border-primary bg-primary/5",
        )}
      >
        <Paperclip classИмя="h-3.5 w-3.5 mr-1.5" />
        {uploadAttachment.isОжидание || importMarkdownDocument.isОжидание ? "Загрузитьing..." : (
          <>
            <span classИмя="hidden sm:inline">Загрузить attachment</span>
            <span classИмя="sm:hidden">Загрузить</span>
          </>
        )}
      </Button>
    </>
  );

  return (
    <div classИмя="max-w-3xl space-y-6">
      {/* Родитель chain breadcrumb */}
      {ancestors.length > 0 && (
        <nav classИмя="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          {[...ancestors].reverse().map((ancestor, i) => (
            <span key={ancestor.id} classИмя="flex items-center gap-1">
              {i > 0 && <ChevronRight classИмя="h-3 w-3 shrink-0" />}
              <Link
                to={createЗадачаDetailПуть(ancestor.identifier ?? ancestor.id)}
                state={resolvedЗадачаDetailState ?? location.state}
                onClickCapture={() =>
                  rememberЗадачаDetailLocationState(
                    ancestor.identifier ?? ancestor.id,
                    resolvedЗадачаDetailState ?? location.state,
                    location.search,
                  )}
                classИмя="hover:text-foreground transition-colors truncate max-w-[200px]"
                title={ancestor.title}
              >
                {ancestor.title}
              </Link>
            </span>
          ))}
          <ChevronRight classИмя="h-3 w-3 shrink-0" />
          <span classИмя="text-foreground/60 truncate max-w-[200px]">{issue.title}</span>
        </nav>
      )}

      {issue.hiddenAt && (
        <div classИмя="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <EyeOff classИмя="h-4 w-4 shrink-0" />
          This issue is hidden
        </div>
      )}
      {activeПаузаHold && (
        <div classИмя="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          {activeПаузаHold.isRoot ? (
            <div classИмя="space-y-2">
              <div classИмя="flex flex-wrap items-center gap-2">
                <span classИмя="font-medium">
                  {childЗадачи.length === 0 ? "Приостановлен by board." : "Subtree pause is active."}
                </span>
                <span classИмя="text-xs text-amber-900/80 dark:text-amber-100/80">
                  {childЗадачи.length === 0
                    ? "Задача execution is held until resume. Человек comments can still wake the assignee for triage."
                    : "Root and descendant execution is held until resume. Человек comments can still wake assignees for triage."}
                </span>
              </div>
              <div classИмя="text-xs text-amber-900/80 dark:text-amber-100/80">
                {childЗадачи.length === 0
                  ? "1 issue held"
                  : `${heldDescendantCount} descendant${heldDescendantCount === 1 ? "" : "s"} held`}
                {activeRootПаузаHold?.createdAt ? ` · started ${relativeTime(activeRootПаузаHold.createdAt)}` : ""}
              </div>
              {canShowSubtreeControls || canПродолжитьLeafРабота ? (
                <div classИмя="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setTreeControlMode("resume");
                      setTreeControlWakeАгентыOnПродолжить(isАгентOwnedНетnTerminalЗадача || canShowSubtreeControls);
                      setTreeControlOpen(true);
                    }}
                  >
                    {childЗадачи.length === 0 ? "Продолжить work" : "Продолжить subtree"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTreeControlMode("resume");
                      setTreeControlWakeАгентыOnПродолжить(isАгентOwnedНетnTerminalЗадача || canShowSubtreeControls);
                      setTreeControlOpen(true);
                    }}
                  >
                    View affected ({childЗадачи.length === 0 ? 1 : heldDescendantCount})
                  </Button>
                  {canShowSubtreeControls ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      classИмя="text-destructive hover:text-destructive"
                      onClick={() => {
                        setTreeControlMode("cancel");
                        setTreeControlОтменаПодтвердитьed(false);
                        setTreeControlOpen(true);
                      }}
                    >
                      Отмена subtree...
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div classИмя="text-xs">
              This issue is paused by ancestor{" "}
              {activeПаузаHoldRoot?.identifier ? (
                <Link to={createЗадачаDetailПуть(activeПаузаHoldRoot.identifier)} classИмя="underline">
                  {activeПаузаHoldRoot.identifier}
                </Link>
              ) : (
                activeПаузаHold.rootЗадачаId.slice(0, 8)
              )}
              . Продолжить from the root issue to deliver deferred work.
            </div>
          )}
        </div>
      )}

      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2 min-w-0 flex-wrap">
          <СтатусIcon
            status={issue.status}
            blockerAttention={issue.blockerAttention}
            onChange={(status) => updateЗадача.mutate({ status })}
          />
          <ПриоритетIcon
            priority={issue.priority}
            onChange={(priority) => updateЗадача.mutate({ priority })}
          />
          <span classИмя="text-sm font-mono text-muted-foreground shrink-0">{issue.identifier ?? issue.id.slice(0, 8)}</span>

          {hasLiveЗапуститьs && (
            <span classИмя="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 shrink-0">
              <span classИмя="relative flex h-1.5 w-1.5">
                <span classИмя="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span classИмя="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
              </span>
              Live
            </span>
          )}

          {issue.originKind === "routine_execution" && issue.originId && (
            <Link
              to={`/routines/${issue.originId}`}
              classИмя="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 shrink-0 hover:bg-violet-500/20 transition-colors"
            >
              <Repeat classИмя="h-3 w-3" />
              Процедура
            </Link>
          )}

          {issue.productivityReview ? (
            <ProductivityReviewBadge review={issue.productivityReview} />
          ) : null}

          {issue.originKind === "issue_productivity_review" ? (
            <span
              classИмя="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 shrink-0"
              title="This task is a productivity review."
            >
              <Eye classИмя="h-3 w-3" />
              Productivity review
            </span>
          ) : null}

          {issue.workMode === "planning" ? (
            <span
              classИмя="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 shrink-0"
              title="This issue is in planning mode."
            >
              Planning
            </span>
          ) : null}

          {hasAssignedНазадlogBlocker(issue.blockedBy) ? (
            <span
              data-testid="issue-detail-parked-blocker"
              classИмя="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 shrink-0"
              title="Заблокирован by parked work — at least one assigned blocker is in backlog and will not wake its assignee."
            >
              <Flag classИмя="h-3 w-3" />
              Заблокирован by parked work
            </span>
          ) : null}

          {issue.projectId ? (
            <Link
              to={`/projects/${issue.projectId}`}
              classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 -mx-1 py-0.5 min-w-0"
            >
              <Hexagon classИмя="h-3 w-3 shrink-0" />
              <span classИмя="truncate">{resolvedProject?.name ?? issue.project?.name ?? issue.projectId.slice(0, 8)}</span>
            </Link>
          ) : (
            <span classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-50 px-1 -mx-1 py-0.5">
              <Hexagon classИмя="h-3 w-3 shrink-0" />
              Нет project
            </span>
          )}

          {(issue.labels ?? []).length > 0 && (
            <div classИмя="hidden sm:flex items-center gap-1">
              {(issue.labels ?? []).slice(0, 4).map((label) => (
                <span
                  key={label.id}
                  classИмя="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    borderColor: label.color,
                    color: pickTextColorForPillBg(label.color, 0.12),
                    backgroundColor: `${label.color}1f`,
                  }}
                >
                  {label.name}
                </span>
              ))}
              {(issue.labels ?? []).length > 4 && (
                <span classИмя="text-[10px] text-muted-foreground">+{(issue.labels ?? []).length - 4}</span>
              )}
            </div>
          )}

          {!(isMobile && isFromВходящие) && (
            <div classИмя="ml-auto flex items-center gap-0.5 md:hidden shrink-0">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={copyЗадачаToClipboard}
                title="Копировать issue as markdown"
              >
                {copied ? <Check classИмя="h-4 w-4 text-green-500" /> : <Копировать classИмя="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setMobilePropsOpen(true)}
                title="Properties"
              >
                <SlidersHorizontal classИмя="h-4 w-4" />
              </Button>
            </div>
          )}

          <div classИмя="hidden md:flex items-center md:ml-auto shrink-0">
            {canАрхивироватьFromВходящие && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  if (!archiveОжидание && issue?.id) archiveFromВходящие.mutate(issue.id);
                }}
                disabled={archiveОжидание}
                title="Архивировать from inbox"
                aria-label="Архивировать from inbox"
              >
                <Архивировать classИмя="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copyЗадачаToClipboard}
              title="Копировать issue as markdown"
            >
              {copied ? <Check classИмя="h-4 w-4 text-green-500" /> : <Копировать classИмя="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              classИмя={cn(
                "shrink-0 transition-opacity duration-200",
                panelVisible ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100",
              )}
              onClick={() => setPanelVisible(true)}
              title="Показать свойства"
            >
              <SlidersHorizontal classИмя="h-4 w-4" />
            </Button>

            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  classИмя="shrink-0"
                  aria-label="More issue actions"
                  title="More issue actions"
                  onКлючDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventПо умолчанию();
                      setMoreOpen(true);
                    }
                  }}
                >
                  <MoreHorizontal classИмя="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            <PopoverContent classИмя="w-52 p-1" align="end">
              {canПаузаLeafРабота ? (
                <button
                  classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                  onClick={() => {
                    setTreeControlMode("pause");
                    setTreeControlОтменаПодтвердитьed(false);
                    setTreeControlOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  <ПаузаCircle classИмя="h-3 w-3" />
                  Пауза work...
                </button>
              ) : null}
              {canПродолжитьLeafРабота ? (
                <button
                  classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                  onClick={() => {
                    setTreeControlMode("resume");
                    setTreeControlWakeАгентыOnПродолжить(isАгентOwnedНетnTerminalЗадача);
                    setTreeControlOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  <PlayCircle classИмя="h-3 w-3" />
                  Продолжить work
                </button>
              ) : null}
              {canShowSubtreeControls ? (
                <>
                  <button
                    classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                    onClick={() => {
                      setTreeControlMode("pause");
                      setTreeControlОтменаПодтвердитьed(false);
                      setTreeControlOpen(true);
                      setMoreOpen(false);
                    }}
                  >
                    <ПаузаCircle classИмя="h-3 w-3" />
                    Пауза subtree...
                  </button>
                  {canПродолжитьSubtree ? (
                    <button
                      classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => {
                        setTreeControlMode("resume");
                        setTreeControlWakeАгентыOnПродолжить(true);
                        setTreeControlOpen(true);
                        setMoreOpen(false);
                      }}
                    >
                      <PlayCircle classИмя="h-3 w-3" />
                      Продолжить subtree
                    </button>
                  ) : null}
                  <button
                    classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                    onClick={() => {
                      setTreeControlMode("cancel");
                      setTreeControlОтменаПодтвердитьed(false);
                      setTreeControlOpen(true);
                      setMoreOpen(false);
                    }}
                  >
                    <XCircle classИмя="h-3 w-3" />
                    Отмена subtree...
                  </button>
                  {canRestoreSubtree ? (
                    <button
                      classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => {
                        setTreeControlMode("restore");
                        setTreeControlWakeАгентыOnПродолжить(false);
                        setTreeControlОтменаПодтвердитьed(false);
                        setTreeControlOpen(true);
                        setMoreOpen(false);
                      }}
                    >
                      <Repeat classИмя="h-3 w-3" />
                      Restore subtree...
                    </button>
                  ) : null}
                </>
              ) : null}
              <button
                classИмя="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-destructive"
                onClick={() => {
                  updateЗадача.mutate(
                    { hiddenAt: new Date().toISOString() },
                    { onУспешно: () => navigate("/issues/all") },
                  );
                  setMoreOpen(false);
                }}
              >
                <EyeOff classИмя="h-3 w-3" />
                Hide this Задача
              </button>
            </PopoverContent>
            </Popover>
          </div>
        </div>

        <InlineИзменитьor
          value={issue.title}
          onСохранить={(title) => updateЗадача.mutateAsync({ title })}
          as="h2"
          classИмя="text-xl font-bold"
        />

        <InlineИзменитьor
          value={issue.description ?? ""}
          onСохранить={(description) => updateЗадача.mutateAsync({ description })}
          as="p"
          classИмя="text-[15px] leading-7 text-foreground"
          placeholder="Добавить a description..."
          multiline
          foldable
          mentions={mentionOptions}
          imageЗагрузитьHandler={async (file) => {
            const attachment = await uploadAttachment.mutateAsync(file);
            return attachment.contentПуть;
          }}
          onDropFile={async (file) => {
            await uploadAttachment.mutateAsync(file);
          }}
        />
      </div>

      <PluginSlotOutlet
        slotТипs={["toolbarButton", "contextMenuItem"]}
        entityТип="issue"
        context={{
          companyId: issue.companyId,
          projectId: issue.projectId ?? null,
          entityId: issue.id,
          entityТип: "issue",
        }}
        classИмя="flex flex-wrap gap-2"
        itemClassИмя="inline-flex"
        missingBehavior="placeholder"
      />

      <PluginLauncherOutlet
        placementZones={["toolbarButton"]}
        entityТип="issue"
        context={{
          companyId: issue.companyId,
          projectId: issue.projectId ?? null,
          entityId: issue.id,
          entityТип: "issue",
        }}
        classИмя="flex flex-wrap gap-2"
        itemClassИмя="inline-flex"
      />

      <PluginSlotOutlet
        slotТипs={["taskDetailView"]}
        entityТип="issue"
        context={{
          companyId: issue.companyId,
          projectId: issue.projectId ?? null,
          entityId: issue.id,
          entityТип: "issue",
        }}
        classИмя="space-y-3"
        itemClassИмя="rounded-lg border border-border p-3"
        missingBehavior="placeholder"
      />

      {showRichSubЗадачиSection ? (
        <div classИмя="space-y-3">
          <div classИмя="flex items-center justify-between gap-2">
            <h3 classИмя="text-sm font-medium text-muted-foreground">Подзадачи</h3>
          </div>
          <ЗадачиList
            issues={childЗадачи}
            isЗагрузка={childЗадачиЗагрузка}
            agents={agents}
            projects={projects}
            liveЗадачаIds={liveЗадачаIds}
            mutedЗадачаIds={mutedChildЗадачаIds}
            issueBadgeById={childПаузаBadgeById}
            projectId={issue.projectId ?? undefined}
            viewStateКлюч={`paperclip:issue-detail:${issue.id}:subissues-view`}
            issueLinkState={resolvedЗадачаDetailState ?? location.state}
            searchФильтрs={{ descendantOf: issue.id, includeЗаблокированBy: true }}
            searchWithinLoadedЗадачи
            baseСоздатьЗадачаПо умолчаниюs={buildSubЗадачаПо умолчаниюsForViewer(issue, currentUserId)}
            createЗадачаLabel="Подзадача"
            defaultСортировкаField="workflow"
            showProgressSummary
            parentЗадачаIdForCostSummary={issue.id}
            onОбновитьЗадача={handleChildЗадачаОбновить}
          />
        </div>
      ) : (
        <div classИмя="flex flex-wrap items-center justify-end gap-2 min-w-0">
          <Button variant="outline" size="sm" onClick={openNewSubЗадача} classИмя="shrink-0 shadow-none">
            <Plus classИмя="mr-1.5 h-3.5 w-3.5" />
            New Подзадача
          </Button>
        </div>
      )}

      <ЗадачаДокументыSection
        issue={issue}
        canУдалитьДокументы={Boolean(session?.user?.id)}
        feedbackVotes={feedbackVotes}
        feedbackDataSharingPreference={feedbackDataSharingPreference}
        feedbackTermsUrl={FEEDBACK_TERMS_URL}
        mentions={mentionOptions}
        imageЗагрузитьHandler={async (file) => {
          const attachment = await uploadAttachment.mutateAsync(file);
          return attachment.contentПуть;
        }}
        onVote={async (revisionId, vote, options) => {
          await feedbackVoteMutation.mutateAsync({
            targetТип: "issue_document_revision",
            targetId: revisionId,
            vote,
            reason: options?.reason,
            allowSharing: options?.allowSharing,
            sharingPreferenceAtОтправить: feedbackDataSharingPreference,
          });
        }}
        extraActions={!hasAttachments ? attachmentЗагрузитьButton : null}
      />

      {attachmentsInitialЗагрузка ? (
        <ЗадачаSectionSkeleton titleWidth="w-24" rows={2} />
      ) : hasAttachments ? (
        <div
        classИмя={cn(
          "space-y-3 rounded-lg transition-colors",
        )}
        onDragEnter={(evt) => {
          evt.preventПо умолчанию();
          setAttachmentDragАктивен(true);
        }}
        onDragOver={(evt) => {
          evt.preventПо умолчанию();
          setAttachmentDragАктивен(true);
        }}
        onDragLeave={(evt) => {
          if (evt.currentЦель.contains(evt.relatedЦель as Нетde | null)) return;
          setAttachmentDragАктивен(false);
        }}
        onDrop={(evt) => void handleAttachmentDrop(evt)}
      >
        <div classИмя="flex items-center justify-between gap-2">
          <h3 classИмя="text-sm font-medium text-muted-foreground">Attachments</h3>
          {attachmentЗагрузитьButton}
        </div>

        {attachmentОшибка && (
          <p classИмя="text-xs text-destructive">{attachmentОшибка}</p>
        )}

        {imageAttachments.length > 0 && (
          <div classИмя="grid grid-cols-4 gap-2">
            {imageAttachments.map((attachment) => (
              <div
                key={attachment.id}
                classИмя="group relative aspect-square rounded-lg overflow-hidden border border-border bg-accent/10 cursor-pointer"
                onClick={() => {
                  const idx = imageAttachments.findIndex((a) => a.id === attachment.id);
                  setGalleryIndex(idx >= 0 ? idx : 0);
                  setGalleryOpen(true);
                }}
              >
                <img
                  src={attachment.contentПуть}
                  alt={attachment.originalFilename ?? "attachment"}
                  classИмя="h-full w-full object-cover"
                  loading="lazy"
                />
                <div classИмя="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                {confirmУдалитьId === attachment.id ? (
                  <div
                    classИмя="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p classИмя="text-xs text-white font-medium">Удалить?</p>
                    <div classИмя="flex gap-1.5">
                      <button
                        type="button"
                        classИмя="rounded bg-destructive px-2 py-0.5 text-xs text-white hover:bg-destructive/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAttachment.mutate(attachment.id);
                          setПодтвердитьУдалитьId(null);
                        }}
                        disabled={deleteAttachment.isОжидание}
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        classИмя="rounded bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setПодтвердитьУдалитьId(null);
                        }}
                      >
                        Нет
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    classИмя="absolute top-1.5 right-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setПодтвердитьУдалитьId(attachment.id);
                    }}
                    title="Удалить attachment"
                  >
                    <Trash2 classИмя="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {nonImageAttachments.length > 0 && (
          <div classИмя="space-y-2">
            {nonImageAttachments.map((attachment) => (
              <div key={attachment.id} classИмя="border border-border rounded-md p-2">
                <div classИмя="flex items-center justify-between gap-2">
                  <a
                    href={attachment.contentПуть}
                    target="_blank"
                    rel="noreferrer"
                    classИмя="text-xs hover:underline truncate"
                    title={attachment.originalFilename ?? attachment.id}
                  >
                    {attachment.originalFilename ?? attachment.id}
                  </a>
                  <button
                    type="button"
                    classИмя="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteAttachment.mutate(attachment.id)}
                    disabled={deleteAttachment.isОжидание}
                    title="Удалить attachment"
                  >
                    <Trash2 classИмя="h-3.5 w-3.5" />
                  </button>
                </div>
                <p classИмя="text-[11px] text-muted-foreground">
                  {attachment.contentТип} · {(attachment.byteSize / 1024).toFixed(1)} KB
                </p>
              </div>
            ))}
          </div>
        )}
        </div>
      ) : null}

      <ImageGalleryModal
        images={imageAttachments}
        initialIndex={galleryIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />

      <ЗадачаРабочая областьCard
        issue={issue}
        project={resolvedProject}
        onОбновить={(data) => updateЗадача.mutate(data)}
      />

      <Separator />

      <Tabs value={detailTab} onЗначениеChange={setDetailTab} classИмя="space-y-3">
        <TabsList variant="line" classИмя="w-full justify-start gap-1">
          <TabsTrigger value="chat" classИмя="gap-1.5">
            <MessageSquare classИмя="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="activity" classИмя="gap-1.5">
            <АктивностьIcon classИмя="h-3.5 w-3.5" />
            Активность
          </TabsTrigger>
          <TabsTrigger value="related-work" classИмя="gap-1.5">
            <ListTree classИмя="h-3.5 w-3.5" />
            Related work
          </TabsTrigger>
          {issuePluginTabItems.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="chat">
          {detailTab === "chat" ? (
            <ЗадачаDetailChatTab
              issueId={issue.id}
              companyId={issue.companyId}
              projectId={issue.projectId ?? null}
              issueСтатус={issue.status}
              issueРаботаMode={issue.workMode ?? "standard"}
              executionЗапуститьId={issue.executionЗапуститьId ?? null}
              blockedBy={issue.blockedBy ?? []}
              blockerAttention={issue.blockerAttention ?? null}
              successfulЗапуститьHandoff={issue.successfulЗапуститьHandoff ?? null}
              comments={threadКомментарии}
              locallyQueuedCommentЗапуститьIds={locallyQueuedCommentЗапуститьIds}
              interactions={interactions}
              hasOlderКомментарии={hasOlderКомментарии}
              commentsЗагрузкаOlder={commentsЗагрузкаOlder}
              onLoadOlderКомментарии={loadOlderКомментарии}
              onОбновитьLatestКомментарии={refetchLatestКомментарии}
              composerRef={commentComposerRef}
              feedbackVotes={feedbackVotes}
              feedbackDataSharingPreference={feedbackDataSharingPreference}
              feedbackTermsUrl={FEEDBACK_TERMS_URL}
              agentMap={agentMap}
              currentUserId={currentUserId}
              userLabelMap={userLabelMap}
              userПрофильMap={userПрофильMap}
              draftКлюч={`paperclip:issue-comment-draft:${issue.id}`}
              reassignOptions={commentReassignOptions}
              currentИсполнительЗначение={actualИсполнительЗначение}
              suggestedИсполнительЗначение={suggestedИсполнительЗначение}
              mentions={mentionOptions}
              composerОтключитьdReason={commentComposerОтключитьdReason}
              composerHint={composerHint}
              queuedCommentReason={queuedCommentReason}
              onVote={handleCommentVote}
              onДобавить={handleChatДобавить}
              onImageЗагрузить={handleCommentImageЗагрузить}
              onAttachImage={handleCommentAttachImage}
              onInterruptQueued={handleInterruptQueuedЗапустить}
              onПаузаРаботаЗапустить={canManageTreeControl
                ? (runId) => pauseЗадачаРаботаЗапустить.mutateAsync({ runId, scope: treeControlОбласть }).then(() => undefined)
                : undefined}
              onРаботаModeChange={(nextMode) => {
                const currentMode: ЗадачаРаботаMode = issue.workMode ?? "standard";
                if (currentMode === nextMode) return;
                return updateЗадача.mutateAsync({ workMode: nextMode }).then(() => undefined);
              }}
              onОтменаQueued={handleОтменаQueuedComment}
              interruptingQueuedЗапуститьId={interruptQueuedComment.isОжидание ? interruptQueuedComment.variables ?? null : null}
              pausingРаботаЗапуститьId={pauseЗадачаРаботаЗапустить.isОжидание ? pauseЗадачаРаботаЗапустить.variables?.runId ?? null : null}
              onImageClick={handleChatImageClick}
              onПринятьInteraction={handleПринятьInteraction}
              onОтклонитьInteraction={handleОтклонитьInteraction}
              onОтправитьInteractionAnswers={handleОтправитьInteractionAnswers}
              onОтменаInteraction={handleОтменаInteraction}
              assigneeUserId={issue.assigneeUserId ?? null}
              onПродолжитьFromНазадlog={canПродолжитьFromНазадlog ? handleПродолжитьFromНазадlog : undefined}
              resumeFromНазадlogОжидание={
                updateЗадача.isОжидание && updateЗадача.variables?.status === "todo"
              }
            />
          ) : null}
        </TabsContent>

        <TabsContent value="activity">
          {detailTab === "activity" ? (
            <ЗадачаDetailАктивностьTab
              issue={issue}
              issueId={issue.id}
              companyId={issue.companyId}
              issueСтатус={issue.status}
              childЗадачи={childЗадачи}
              agentMap={agentMap}
              hasLiveЗапуститьs={hasLiveЗапуститьs}
              currentUserId={currentUserId}
              userПрофильMap={userПрофильMap}
              pendingСогласованиеAction={pendingСогласованиеAction}
              handoffFocusSignal={handoffFocusSignal}
              onСогласованиеAction={(approvalId, action) => {
                approvalDecision.mutate({ approvalId, action });
              }}
              onCheckMonitorСейчас={() => checkЗадачаMonitorСейчас.mutate()}
              checkingMonitorСейчас={checkЗадачаMonitorСейчас.isОжидание}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="related-work">
          <ЗадачаRelatedРаботаPanel relatedРабота={issue.relatedРабота} />
        </TabsContent>

        {activePluginTab && (
          <TabsContent value={activePluginTab.value}>
            <PluginSlotMount
              slot={activePluginTab.slot}
              context={{
                companyId: issue.companyId,
                projectId: issue.projectId ?? null,
                entityId: issue.id,
                entityТип: "issue",
              }}
              missingBehavior="placeholder"
            />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={treeControlOpen} onOpenChange={setTreeControlOpen}>
        <DialogContent classИмя="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
          <DialogHeader classИмя="border-b border-border/60 px-6 pb-4 pr-12 pt-6">
            <DialogНазвание>{issueTreeControlLabel(treeControlMode, treeControlОбласть)}</DialogНазвание>
            <DialogОписание>
              {issueTreeControlHelpText(treeControlMode, treeControlОбласть)}
            </DialogОписание>
          </DialogHeader>
          <div classИмя="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
            {treeControlMode === "cancel" ? (
              <div classИмя="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                Отменаling a subtree is destructive. Нетn-terminal issues will be marked cancelled, and running or queued work will be interrupted where possible.
              </div>
            ) : null}

            <div classИмя="space-y-1.5">
              <label classИмя="text-xs text-muted-foreground">
                Reason (optional)
              </label>
              <Textarea
                value={treeControlReason}
                onChange={(event) => setTreeControlReason(event.target.value)}
                placeholder="Explain why this subtree control is being applied..."
                classИмя="min-h-[88px]"
              />
            </div>

            {(treeControlMode === "resume" || treeControlMode === "restore") ? (
              <div classИмя="space-y-2">
                <label classИмя="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    classИмя="mt-0.5"
                    disabled={previewAffectedАгентCount === 0}
                    checked={treeControlWakeАгентыOnПродолжить}
                    onChange={(event) => setTreeControlWakeАгентыOnПродолжить(event.target.checked)}
                  />
                  <span>
                    <span classИмя="block font-medium">Wake affected agents ({previewAffectedАгентCount})</span>
                    <span classИмя="text-xs text-muted-foreground">
                      {previewAffectedАгентCount === 0
                        ? "Нет assigned agents are eligible to wake from this preview."
                        : "Wake assigned agents after this operation completes."}
                    </span>
                  </span>
                </label>
                {treeControlWakeАгентыOnПродолжить && treeПредпросмотрAffectedАгентRows.length > 0 ? (
                  <div classИмя="max-h-32 space-y-1 overflow-y-auto overscroll-contain">
                    {treeПредпросмотрAffectedАгентRows.map(({ agentId, agent }) => (
                      <div key={agentId} classИмя="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent/50">
                        <span classИмя="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                          <АгентIcon icon={agent?.icon} classИмя="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                        <span classИмя="min-w-0 flex-1 truncate">{agent?.name ?? agentId.slice(0, 8)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {treeControlMode === "cancel" ? (
              <label classИмя="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm">
                <input
                  type="checkbox"
                  classИмя="mt-0.5"
                  checked={treeControlОтменаПодтвердитьed}
                  onChange={(event) => setTreeControlОтменаПодтвердитьed(event.target.checked)}
                />
                <span>I understand this will cancel {previewAffectedЗадачаCount} issues.</span>
              </label>
            ) : null}

            <div classИмя="space-y-2">
              {treeControlПредпросмотрЗагрузка ? (
                <div classИмя="space-y-2">
                  <Skeleton classИмя="h-4 w-40" />
                  <Skeleton classИмя="h-3 w-full" />
                  <Skeleton classИмя="h-3 w-4/5" />
                  <Skeleton classИмя="h-3 w-2/3" />
                </div>
              ) : treeControlПредпросмотрОшибка ? (
                <div classИмя="space-y-2">
                  <p classИмя="text-xs text-destructive">{treeControlПредпросмотрОшибкаКопировать(treeControlПредпросмотрОшибка)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void refetchTreeControlПредпросмотр();
                    }}
                  >
                    Повторить preview
                  </Button>
                </div>
              ) : treeControlПредпросмотр ? (
                <div classИмя="space-y-2">
                  {treeПредпросмотрПредупреждениеs.length > 0 ? (
                    <div classИмя="space-y-1">
                      {treeПредпросмотрПредупреждениеs.map((warning) => (
                        <p key={warning.code} classИмя="text-xs text-amber-700 dark:text-amber-300">
                          {warning.message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {treeПредпросмотрAffectedЗадачаRows.length > 0 ? (
                    <div classИмя="max-h-56 overflow-y-auto overscroll-contain">
                      {treeПредпросмотрAffectedЗадачаRows.map(({ candidate, issue: previewЗадача }) => (
                        <div key={candidate.id} style={candidate.depth > 0 ? { paddingLeft: `${Math.min(candidate.depth, 6) * 14}px` } : undefined}>
                          <Link
                            to={createЗадачаDetailПуть(candidate.identifier ?? candidate.id)}
                            issuePrefetch={previewЗадача}
                            classИмя={cn(
                              "group flex items-start gap-2 border-b border-border py-2 pl-1 pr-2 text-sm no-underline text-inherit transition-colors last:border-b-0 hover:bg-accent/50 sm:items-center",
                              candidate.skipped && "opacity-60",
                            )}
                          >
                            <СтатусIcon status={candidate.status} />
                            <span classИмя="shrink-0 font-mono text-xs text-muted-foreground">
                              {candidate.identifier ?? candidate.id.slice(0, 8)}
                            </span>
                            <span classИмя="min-w-0 flex-1 truncate">{candidate.title}</span>
                            {candidate.skipped && candidate.skipReason === "terminal_status" ? (
                              <span classИмя="shrink-0 text-xs text-muted-foreground">Complete</span>
                            ) : null}
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p classИмя="text-xs text-muted-foreground">Предпросмотр unavailable.</p>
              )}
            </div>
          </div>
          <DialogFooter classИмя="border-t border-border/60 bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setTreeControlOpen(false)} disabled={executeTreeControl.isОжидание}>
              Закрыть
            </Button>
            <Button
              onClick={() => executeTreeControl.mutate()}
              disabled={executeTreeControl.isОжидание || !canApplyTreeControl}
              variant={treeControlMode === "cancel" ? "destructive" : "default"}
            >
              {executeTreeControl.isОжидание ? "Applying..." : treeControlPrimaryButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile properties drawer */}
      <Sheet open={mobilePropsOpen} onOpenChange={setMobilePropsOpen}>
        <SheetContent side="bottom" classИмя="max-h-[85dvh] pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetНазвание classИмя="text-sm">Properties</SheetНазвание>
          </SheetHeader>
          <ScrollArea classИмя="flex-1 overflow-y-auto">
            <div classИмя="px-4 pb-4">
              <ЗадачаProperties
                issue={issue}
                childЗадачи={childЗадачи}
                onДобавитьSubЗадача={openNewSubЗадача}
                onОбновить={(data) => updateЗадача.mutate(data)}
                inline
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <ScrollToБотtom />
    </div>
  );
}
