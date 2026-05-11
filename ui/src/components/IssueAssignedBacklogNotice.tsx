import { Flag } from "lucide-react";
import type { Агент } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";

interface ЗадачаAssignedНазадlogНетticeProps {
  issueСтатус: string;
  assigneeАгент: Агент | null;
  assigneeUserId?: string | null;
  onПродолжить?: () => void;
  resuming?: boolean;
}

export function ЗадачаAssignedНазадlogНетtice({
  issueСтатус,
  assigneeАгент,
  assigneeUserId,
  onПродолжить,
  resuming,
}: ЗадачаAssignedНазадlogНетticeProps) {
  if (issueСтатус !== "backlog") return null;
  if (!assigneeАгент && !assigneeUserId) return null;

  const assigneeLabel = assigneeАгент?.name ?? "the assignee";

  return (
    <div
      data-testid="issue-assigned-backlog-notice"
      data-issue-status={issueСтатус}
      classИмя="mb-3 rounded-md border border-amber-300/70 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div classИмя="flex items-start gap-2">
        <Flag classИмя="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div classИмя="min-w-0 flex-1 space-y-1.5">
          <p classИмя="leading-5">
            <span classИмя="font-medium">Parked</span> —{" "}
            <span classИмя="font-medium">{assigneeLabel}</span> will not be woken until status changes to{" "}
            <code classИмя="rounded bg-amber-100 px-1 py-0.5 text-[12px] dark:bg-amber-400/15">todo</code> or{" "}
            <code classИмя="rounded bg-amber-100 px-1 py-0.5 text-[12px] dark:bg-amber-400/15">in_progress</code>.
          </p>
          {assigneeАгент ? (
            <p classИмя="text-xs leading-5 text-amber-800 dark:text-amber-200">
              Комментарии still wake the assignee for questions or triage. Leave this parked only if the work is intentionally on hold.
            </p>
          ) : null}
          {onПродолжить ? (
            <div classИмя="pt-0.5">
              <Button
                size="sm"
                variant="outline"
                classИмя="h-7 border-amber-400/70 bg-background/80 text-amber-950 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-background/40 dark:text-amber-100 dark:hover:bg-amber-500/15"
                onClick={onПродолжить}
                disabled={resuming}
                data-testid="issue-assigned-backlog-resume"
              >
                {resuming ? "Resuming…" : "Продолжить now"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
