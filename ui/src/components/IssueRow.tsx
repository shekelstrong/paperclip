import type { ReactНетde } from "react";
import type { Задача } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Eye, Flag, X } from "lucide-react";
import {
  createЗадачаDetailПуть,
  rememberЗадачаDetailLocationState,
  withЗадачаDetailHeaderSeed,
} from "../lib/issueDetailBreadcrumb";
import { cn } from "../lib/utils";
import { СтатусIcon } from "./СтатусIcon";
import { productivityReviewTriggerLabel } from "./ProductivityReviewBadge";
import { hasAssignedНазадlogBlocker } from "../lib/issue-blockers";

type UnreadState = "hidden" | "visible" | "fading";

interface ЗадачаRowProps {
  issue: Задача;
  issueLinkState?: unknown;
  selected?: boolean;
  mobileLeading?: ReactНетde;
  desktopMetaLeading?: ReactНетde;
  desktopLeadingSpacer?: boolean;
  mobileMeta?: ReactНетde;
  desktopTrailing?: ReactНетde;
  trailingMeta?: ReactНетde;
  titleSuffix?: ReactНетde;
  titleClassИмя?: string;
  checklistStepNumber?: number | string | null;
  checklistCurrentStep?: boolean;
  checklistDependencyChips?: ReactНетde;
  checklistRowId?: string;
  unreadState?: UnreadState | null;
  onMarkRead?: () => void;
  onАрхивировать?: () => void;
  archiveОтключитьd?: boolean;
  classИмя?: string;
}

export function ЗадачаRow({
  issue,
  issueLinkState,
  selected = false,
  mobileLeading,
  desktopMetaLeading,
  desktopLeadingSpacer = false,
  mobileMeta,
  desktopTrailing,
  trailingMeta,
  titleSuffix,
  titleClassИмя,
  checklistStepNumber = null,
  checklistCurrentStep = false,
  checklistDependencyChips,
  checklistRowId,
  unreadState = null,
  onMarkRead,
  onАрхивировать,
  archiveОтключитьd,
  classИмя,
}: ЗадачаRowProps) {
  const issueПутьId = issue.identifier ?? issue.id;
  const identifier = issue.identifier ?? issue.id.slice(0, 8);
  const showUnreadSlot = unreadState !== null;
  const showUnreadDot = unreadState === "visible" || unreadState === "fading";
  const selectedСтатусClass = selected ? "!text-muted-foreground !border-muted-foreground" : undefined;
  const detailState = withЗадачаDetailHeaderSeed(issueLinkState, issue);
  const productivityReview = issue.productivityReview ?? null;
  const productivityReviewIndicator = productivityReview ? (
    <span
      classИмя={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
        selected ? "border-muted-foreground text-muted-foreground" : null,
      )}
      title={`Productivity review: ${productivityReviewTriggerLabel(productivityReview.trigger)}`}
      aria-label="Productivity review open"
    >
      <Eye classИмя="h-2.5 w-2.5" aria-hidden />
    </span>
  ) : null;
  const hasChecklistStep = checklistStepNumber !== null;
  const checklistStep = hasChecklistStep ? (
    <span classИмя="shrink-0 font-mono text-xs text-muted-foreground" aria-hidden="true">
      {checklistStepNumber}.
    </span>
  ) : null;
  const planningModeIndicator = issue.workMode === "planning" ? (
    <span
      classИмя="ml-1.5 inline-flex shrink-0 items-center rounded-full border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
      title="This issue is in planning mode."
    >
      Planning
    </span>
  ) : null;
  const parkedBlockerIndicator = hasAssignedНазадlogBlocker(issue.blockedBy) ? (
    <span
      data-testid="issue-row-parked-blocker"
      classИмя="ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
      title="Заблокирован by parked work — at least one assigned blocker is in backlog and will not wake its assignee."
    >
      <Flag classИмя="h-2.5 w-2.5" aria-hidden />
      Заблокирован by parked work
    </span>
  ) : null;

  return (
    <Link
      to={createЗадачаDetailПуть(issueПутьId)}
      state={detailState}
      disableЗадачаQuicklook
      issuePrefetch={issue}
      data-inbox-issue-link
      id={checklistRowId}
      aria-current={checklistCurrentStep ? "step" : undefined}
      onClickCapture={() => rememberЗадачаDetailLocationState(issueПутьId, detailState)}
      classИмя={cn(
        "group flex items-start gap-2 border-b border-border py-2.5 pl-2 pr-3 text-sm no-underline text-inherit transition-colors last:border-b-0 sm:items-center sm:py-2 sm:pl-1",
        selected ? "hover:bg-transparent" : "hover:bg-accent/50",
        checklistCurrentStep ? "border-l-2 border-l-primary bg-primary/5 pl-[calc(theme(spacing.2)-2px)] sm:pl-[calc(theme(spacing.1)-2px)]" : null,
        classИмя,
      )}
    >
      <span classИмя="flex shrink-0 items-center gap-1 pt-px sm:hidden">
        {mobileLeading ?? <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} classИмя={selectedСтатусClass} />}
        {productivityReviewIndicator}
        {planningModeIndicator}
        {parkedBlockerIndicator}
      </span>
      <span classИмя="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
        <span classИмя={cn("line-clamp-2 text-sm sm:order-2 sm:min-w-0 sm:flex-1 sm:truncate sm:line-clamp-none", titleClassИмя)}>
          {issue.title}{titleSuffix}
        </span>
        {checklistDependencyChips ? (
          <span classИмя="flex flex-wrap gap-1 sm:order-3 sm:ml-[calc(theme(spacing.3)+theme(spacing.2))]">
            {checklistDependencyChips}
          </span>
        ) : null}
        <span classИмя="flex items-center gap-2 sm:order-1 sm:shrink-0">
          {desktopLeadingSpacer ? (
            <span classИмя="hidden w-3.5 shrink-0 sm:block" />
          ) : null}
          {desktopMetaLeading ?? (
            <>
              <span classИмя="hidden shrink-0 items-center gap-1 sm:inline-flex">
                <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} classИмя={selectedСтатусClass} />
                {productivityReviewIndicator}
              </span>
              {checklistStep}
              <span classИмя="shrink-0 font-mono text-xs text-muted-foreground">
                {identifier}
              </span>
              {planningModeIndicator}
              {parkedBlockerIndicator}
            </>
          )}
          {mobileMeta ? (
            <>
              <span classИмя="text-xs text-muted-foreground sm:hidden" aria-hidden="true">
                &middot;
              </span>
              <span classИмя="text-xs text-muted-foreground sm:hidden">{mobileMeta}</span>
            </>
          ) : null}
        </span>
      </span>
      {(desktopTrailing || trailingMeta) ? (
        <span classИмя="ml-auto hidden shrink-0 items-center gap-2 sm:order-3 sm:flex sm:gap-3">
          {desktopTrailing}
          {trailingMeta ? (
            <span classИмя="text-xs text-muted-foreground">{trailingMeta}</span>
          ) : null}
        </span>
      ) : null}
      {showUnreadSlot ? (
        <span classИмя="inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
          {showUnreadDot ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventПо умолчанию();
                event.stopPropagation();
                onMarkRead?.();
              }}
              onКлючDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventПо умолчанию();
                  event.stopPropagation();
                  onMarkRead?.();
                }
              }}
              classИмя={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                selected ? "hover:bg-muted/80" : "hover:bg-blue-500/20",
              )}
              aria-label="Mark as read"
            >
              <span
                classИмя={cn(
                  "block h-2 w-2 rounded-full transition-opacity duration-300",
                  selected ? "bg-muted-foreground/70" : "bg-blue-600 dark:bg-blue-400",
                  unreadState === "fading" ? "opacity-0" : "opacity-100",
                )}
              />
            </button>
          ) : onАрхивировать ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventПо умолчанию();
                event.stopPropagation();
                onАрхивировать();
              }}
              onКлючDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventПо умолчанию();
                event.stopPropagation();
                onАрхивировать();
              }}
              disabled={archiveОтключитьd}
              classИмя="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
              aria-label="Закрыть from inbox"
            >
              <X classИмя="h-3.5 w-3.5" />
            </button>
          ) : (
            <span classИмя="inline-flex h-4 w-4" aria-hidden="true" />
          )}
        </span>
      ) : null}
    </Link>
  );
}
