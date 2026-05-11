import type { ReactНетde } from "react";
import type { ЗадачаRelationЗадачаSummary } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";
import { СтатусIcon } from "./СтатусIcon";

export function ЗадачаReferencePill({
  issue,
  strikethrough,
  classИмя,
  children,
}: {
  issue: Pick<ЗадачаRelationЗадачаSummary, "id" | "identifier" | "title"> &
    Partial<Pick<ЗадачаRelationЗадачаSummary, "status">>;
  strikethrough?: boolean;
  classИмя?: string;
  children?: ReactНетde;
}) {
  const issueLabel = issue.identifier ?? issue.title;
  const classИмяs = cn(
    "paperclip-mention-chip paperclip-mention-chip--issue",
    "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs no-underline",
    issue.identifier && "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
    strikethrough && "opacity-60 line-through decoration-muted-foreground",
    classИмя,
  );
  const content = (
    <>
      {issue.status ? <СтатусIcon status={issue.status} classИмя="h-3 w-3 shrink-0" /> : null}
      {children !== undefined ? children : <span>{issue.identifier ?? issue.title}</span>}
    </>
  );

  if (!issue.identifier) {
    return (
      <span
        data-mention-kind="issue"
        classИмя={classИмяs}
        title={issue.title}
        aria-label={`Задача: ${issue.title}`}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to={`/issues/${issueLabel}`}
      data-mention-kind="issue"
      classИмя={classИмяs}
      title={issue.title}
      aria-label={`Задача ${issueLabel}: ${issue.title}`}
    >
      {content}
    </Link>
  );
}
