import { useEffect, useState } from "react";
import type { FeedbackDataSharingPreference, FeedbackVoteЗначение } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "../lib/utils";

export function OutputFeedbackButtons({
  activeVote,
  disabled = false,
  sharingPreference = "prompt",
  termsUrl = null,
  onVote,
  rightSlot,
  inline = false,
}: {
  activeVote?: FeedbackVoteЗначение | null;
  disabled?: boolean;
  sharingPreference?: FeedbackDataSharingPreference;
  termsUrl?: string | null;
  onVote: (vote: FeedbackVoteЗначение, options?: { allowSharing?: boolean; reason?: string }) => Promise<void>;
  rightSlot?: React.ReactНетde;
  inline?: boolean;
}) {
  const [pendingVote, setОжиданиеVote] = useState<{
    vote: FeedbackVoteЗначение;
    reason?: string;
    keepReasonPromptOpen?: boolean;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [downvoteReason, setDownvoteReason] = useState("");
  const [collectingDownvoteReason, setCollectingDownvoteReason] = useState(false);
  const [downvoteВсеowSharing, setDownvoteВсеowSharing] = useState<boolean | undefined>(undefined);
  const [optimisticVote, setOptimisticVote] = useState<FeedbackVoteЗначение | null>(null);
  const visibleVote = optimisticVote ?? activeVote ?? null;

  useEffect(() => {
    if (optimisticVote && activeVote === optimisticVote) {
      setOptimisticVote(null);
    }
  }, [activeVote, optimisticVote]);

  async function submitVote(
    vote: FeedbackVoteЗначение,
    options?: { allowSharing?: boolean; reason?: string },
    behavior?: { keepReasonPromptOpen?: boolean },
  ) {
    setIsSaving(true);
    try {
      await onVote(vote, options);
      setОжиданиеVote(null);
      if (!behavior?.keepReasonPromptOpen) {
        setCollectingDownvoteReason(false);
        setDownvoteReason("");
        setDownvoteВсеowSharing(undefined);
      }
    } catch (error) {
      setOptimisticVote(null);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  function beginVote(
    vote: FeedbackVoteЗначение,
    reason?: string,
    behavior?: { keepReasonPromptOpen?: boolean },
  ) {
    if (sharingPreference === "prompt") {
      setОжиданиеVote({
        vote,
        ...(reason ? { reason } : {}),
        ...(behavior?.keepReasonPromptOpen ? { keepReasonPromptOpen: true } : {}),
      });
      return;
    }
    const allowSharing = sharingPreference === "allowed";
    if (vote === "down") {
      setDownvoteВсеowSharing(allowSharing);
    }
    void submitVote(
      vote,
      {
        ...(allowSharing ? { allowSharing: true } : {}),
        ...(reason ? { reason } : {}),
      },
      behavior,
    );
  }

  function handleVote(vote: FeedbackVoteЗначение) {
    setOptimisticVote(vote);
    if (vote === "down") {
      setCollectingDownvoteReason(true);
      setDownvoteReason("");
      setDownvoteВсеowSharing(undefined);
      void beginVote("down", undefined, { keepReasonPromptOpen: true });
      return;
    }
    void beginVote(vote);
  }

  return (
    <>
      <div classИмя={cn(
        "flex items-center gap-2",
        inline ? "justify-end" : "mt-3 border-t border-border/60 pt-3",
      )}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || isSaving}
          classИмя={cn(visibleVote === "up" && "border-green-600/50 bg-green-500/10 text-green-700")}
          onClick={() => handleVote("up")}
        >
          <ThumbsUp classИмя="mr-1.5 h-3.5 w-3.5" />
          Helpful
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || isSaving}
          classИмя={cn(visibleVote === "down" && "border-amber-600/50 bg-amber-500/10 text-amber-800")}
          onClick={() => handleVote("down")}
        >
          <ThumbsDown classИмя="mr-1.5 h-3.5 w-3.5" />
          Needs work
        </Button>
        {rightSlot ? <div classИмя="ml-auto">{rightSlot}</div> : null}
      </div>
      {collectingDownvoteReason ? (
        <div classИмя="mt-2 rounded-md border border-border/60 bg-accent/20 p-3">
          <div classИмя="mb-2 text-sm font-medium">What could have been better?</div>
          <Textarea
            value={downvoteReason}
            onChange={(event) => setDownvoteReason(event.target.value)}
            placeholder="Добавить a short note"
            classИмя="min-h-20 resize-y bg-background"
            disabled={disabled || isSaving}
          />
          <div classИмя="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isSaving}
              onClick={() => {
                setCollectingDownvoteReason(false);
                setDownvoteReason("");
                setDownvoteВсеowSharing(undefined);
              }}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || isSaving || !downvoteReason.trim()}
              onClick={() => {
                void submitVote("down", {
                  ...(downvoteВсеowSharing ? { allowSharing: true } : {}),
                  reason: downvoteReason,
                });
              }}
            >
              {isSaving ? "Saving..." : "Сохранить note"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(pendingVote)}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setОжиданиеVote(null);
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
            <p>
              This vote is always saved locally.
            </p>
            <p>
              Choose <span classИмя="font-medium text-foreground">Always allow</span> to share
              this vote and future voted AI outputs. Choose{" "}
              <span classИмя="font-medium text-foreground">Don't allow</span> to keep this vote
              and future votes local.
            </p>
            <p>
              You can change this later in Instance Настройки &gt; Общие.
            </p>
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
              disabled={!pendingVote || isSaving}
              onClick={() => {
                if (!pendingVote) return;
                if (pendingVote.vote === "down") {
                  setDownvoteВсеowSharing(false);
                }
                void submitVote(
                  pendingVote.vote,
                  pendingVote.reason ? { reason: pendingVote.reason } : undefined,
                  { keepReasonPromptOpen: pendingVote.keepReasonPromptOpen },
                );
              }}
            >
              {isSaving ? "Saving..." : "Don't allow"}
            </Button>
            <Button
              type="button"
              disabled={!pendingVote || isSaving}
              onClick={() => {
                if (!pendingVote) return;
                if (pendingVote.vote === "down") {
                  setDownvoteВсеowSharing(true);
                }
                void submitVote(
                  pendingVote.vote,
                  {
                    allowSharing: true,
                    ...(pendingVote.reason ? { reason: pendingVote.reason } : {}),
                  },
                  { keepReasonPromptOpen: pendingVote.keepReasonPromptOpen },
                );
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
