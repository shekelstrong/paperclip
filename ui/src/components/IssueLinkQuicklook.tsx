import * as React from "react";
import { useMemo, useState } from "react";
import * as RouterDom from "react-router-dom";
import type { Задача } from "@paperclipai/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { timeAgo } from "@/lib/timeAgo";
import { createЗадачаDetailПуть, withЗадачаDetailHeaderSeed } from "@/lib/issueDetailBreadcrumb";
import {
  getЗадачаDetailQueryOptions,
  ISSUE_DETAIL_STALE_TIME_MS,
  prefetchЗадачаDetail,
} from "@/lib/issueDetailCache";
import { queryКлючs } from "@/lib/queryКлючs";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { СтатусIcon } from "@/components/СтатусIcon";

function summarizeЗадачаОписание(description: string | null | undefined) {
  if (!description) return null;
  const summary = description
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!summary) return null;
  return summary.length > 180 ? `${summary.slice(0, 177).trimEnd()}...` : summary;
}

export function ЗадачаQuicklookCard({
  issue,
  linkTo,
  linkState,
  compact = false,
}: {
  issue: Задача;
  linkTo: RouterDom.To;
  linkState?: unknown;
  compact?: boolean;
}) {
  const description = useMemo(() => summarizeЗадачаОписание(issue.description), [issue.description]);

  return (
    <div classИмя={cn("space-y-2", compact && "space-y-1.5")}>
      <div classИмя="flex items-start gap-2">
        <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} classИмя="mt-0.5 shrink-0" />
        <RouterDom.Link
          to={linkTo}
          state={linkState ?? withЗадачаDetailHeaderSeed(null, issue)}
          classИмя="text-sm font-medium leading-snug hover:underline line-clamp-2"
        >
          {issue.title}
        </RouterDom.Link>
      </div>
      <div classИмя="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span classИмя="font-mono">{issue.identifier ?? issue.id.slice(0, 8)}</span>
        <span>&middot;</span>
        <span>{issue.status.replace(/_/g, " ")}</span>
        <span>&middot;</span>
        <span>{timeAgo(new Date(issue.updatedAt))}</span>
      </div>
      {description ? (
        <p classИмя="text-xs leading-5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export const ЗадачаLinkQuicklook = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof RouterDom.Link> & {
    issueПутьId: string;
    disableЗадачаQuicklook?: boolean;
    issuePrefetch?: Задача | null;
  }
>(function ЗадачаLinkQuicklookImpl(
  {
    issueПутьId,
    to,
    children,
    classИмя,
    state,
    disableЗадачаQuicklook = false,
    issuePrefetch = null,
    onClick,
    onClickCapture,
    onMouseEnter,
    onFocus,
    onTouchНачать,
    ...props
  },
  ref,
) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const prefetchedState = issuePrefetch ? withЗадачаDetailHeaderSeed(state, issuePrefetch) : state;
  const { data, isЗагрузка } = useQuery({
    ...getЗадачаDetailQueryOptions(queryClient, issueПутьId, { placeholderЗадача: issuePrefetch ?? undefined }),
    enabled: open,
    staleTime: ISSUE_DETAIL_STALE_TIME_MS,
  });

  const detailПуть = createЗадачаDetailПуть(issueПутьId);
  const handlePrefetch = React.useCallback(() => {
    void prefetchЗадачаDetail(queryClient, issueПутьId, { issue: issuePrefetch });
  }, [issueПутьId, issuePrefetch, queryClient]);
  const link = (
    <RouterDom.Link
      ref={ref}
      to={to}
      state={prefetchedState}
      classИмя={classИмя}
      onMouseEnter={(event) => {
        handlePrefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        handlePrefetch();
        onFocus?.(event);
      }}
      onTouchНачать={(event) => {
        handlePrefetch();
        onTouchНачать?.(event);
      }}
      onClickCapture={(event) => {
        handlePrefetch();
        onClickCapture?.(event);
      }}
      onClick={(event) => {
        setOpen(false);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </RouterDom.Link>
  );

  if (disableЗадачаQuicklook) {
    return link;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => {
          handlePrefetch();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
      >
        {link}
      </PopoverTrigger>
      <PopoverContent
        classИмя="w-72 p-3"
        side="top"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenАвтоFocus={(event) => event.preventПо умолчанию()}
      >
        {data ? (
          <ЗадачаQuicklookCard issue={data} linkTo={detailПуть} linkState={prefetchedState} compact />
        ) : (
          <div classИмя="space-y-2">
            <div classИмя="h-4 w-24 rounded bg-accent/50" />
            <div classИмя="h-4 w-full rounded bg-accent/40" />
            <div classИмя="h-4 w-3/4 rounded bg-accent/30" />
            {!isЗагрузка ? (
              <p classИмя="text-xs text-muted-foreground">Unable to load issue preview.</p>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
