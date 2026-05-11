import { cn } from "../lib/utils";
import { statusBadge, statusBadgeПо умолчанию } from "../lib/status-colors";

export function СтатусBadge({ status }: { status: string }) {
  return (
    <span
      classИмя={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeПо умолчанию
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
