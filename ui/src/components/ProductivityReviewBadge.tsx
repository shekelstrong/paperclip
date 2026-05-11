import { Eye } from "lucide-react";
import type { ЗадачаProductivityReview } from "@paperclipai/shared";
import { Link } from "../lib/router";
import { cn } from "../lib/utils";
import { createЗадачаDetailПуть } from "../lib/issueDetailBreadcrumb";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const TRIGGER_LABELS: Record<string, string> = {
  no_comment_streak: "Нет-comment streak",
  long_active_duration: "Long active duration",
  high_churn: "Высокий churn",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  todo: "Open",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Заблокирован",
  backlog: "Open",
};

export function productivityReviewTriggerLabel(
  trigger: ЗадачаProductivityReview["trigger"],
): string {
  if (!trigger) return "Productivity review";
  return TRIGGER_LABELS[trigger] ?? "Productivity review";
}

export function ProductivityReviewBadge({
  review,
  classИмя,
  hideLabel = false,
}: {
  review: ЗадачаProductivityReview;
  classИмя?: string;
  hideLabel?: boolean;
}) {
  const label = productivityReviewTriggerLabel(review.trigger);
  const reviewIdentifier = review.reviewIdentifier ?? review.reviewЗадачаId.slice(0, 8);
  const reviewПуть = createЗадачаDetailПуть(review.reviewIdentifier ?? review.reviewЗадачаId);
  const statusLabel = REVIEW_STATUS_LABELS[review.status] ?? review.status.replace(/_/g, " ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={reviewПуть}
          classИмя={cn(
            "inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 shrink-0 hover:bg-amber-500/20 transition-colors",
            classИмя,
          )}
          aria-label={`Under review · productivity review ${reviewIdentifier} (${label})`}
        >
          <Eye classИмя="h-3 w-3" aria-hidden />
          {hideLabel ? null : <span>Under review</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <div classИмя="space-y-1 text-xs">
          <div classИмя="font-semibold">Productivity review open</div>
          <div>
            <span classИмя="text-muted-foreground">Trigger:</span> {label}
          </div>
          {typeof review.noCommentStreak === "number" && review.noCommentStreak > 0 ? (
            <div>
              <span classИмя="text-muted-foreground">Нет-comment streak:</span>{" "}
              {review.noCommentStreak} runs
            </div>
          ) : null}
          <div>
            <span classИмя="text-muted-foreground">Review:</span> {reviewIdentifier} ({statusLabel})
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
