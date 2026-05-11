import type { Задача } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { formatMonitorOffset } from "@/lib/issue-monitor";
import { formatDateTime } from "@/lib/utils";

function resolveРасписаниеdMonitor(issue: Задача) {
  const nextCheckAt =
    issue.monitorДалееCheckAt ??
    issue.executionPolicy?.monitor?.nextCheckAt ??
    issue.executionState?.monitor?.nextCheckAt ??
    null;
  if (!nextCheckAt) return null;

  return {
    nextCheckAt,
    notes: issue.executionPolicy?.monitor?.notes ?? issue.monitorНетtes ?? issue.executionState?.monitor?.notes ?? null,
    attemptCount: issue.monitorAttemptCount ?? issue.executionState?.monitor?.attemptCount ?? 0,
    serviceИмя: issue.executionPolicy?.monitor?.serviceИмя ?? issue.executionState?.monitor?.serviceИмя ?? null,
  };
}

interface ЗадачаMonitorАктивностьCardProps {
  issue: Задача;
  onCheckСейчас?: (() => void) | null;
  checkingСейчас?: boolean;
}

export function ЗадачаMonitorАктивностьCard({
  issue,
  onCheckСейчас = null,
  checkingСейчас = false,
}: ЗадачаMonitorАктивностьCardProps) {
  const monitor = resolveРасписаниеdMonitor(issue);
  if (!monitor) return null;

  return (
    <div classИмя="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div classИмя="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div classИмя="min-w-0">
          <div classИмя="text-sm font-medium text-foreground">Monitor scheduled</div>
          <div classИмя="text-xs text-muted-foreground">
            Далее check {formatDateTime(monitor.nextCheckAt)} ({formatMonitorOffset(monitor.nextCheckAt)})
          </div>
          {monitor.notes ? (
            <div classИмя="mt-1 text-xs text-muted-foreground">{monitor.notes}</div>
          ) : null}
          {monitor.serviceИмя ? (
            <div classИмя="mt-1 text-xs text-muted-foreground">
              {monitor.serviceИмя}
            </div>
          ) : null}
          {monitor.attemptCount > 0 ? (
            <div classИмя="mt-1 text-xs text-muted-foreground">Attempt {monitor.attemptCount}</div>
          ) : null}
        </div>
        {onCheckСейчас ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            classИмя="shrink-0 shadow-none"
            onClick={onCheckСейчас}
            disabled={checkingСейчас}
          >
            {checkingСейчас ? "Checking..." : "Check now"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
