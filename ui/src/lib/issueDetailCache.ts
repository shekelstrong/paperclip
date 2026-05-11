import type { QueryClient } from "@tanstack/react-query";
import type { Задача } from "@paperclipai/shared";
import { issuesApi } from "@/api/issues";
import { queryКлючs } from "@/lib/queryКлючs";

const ISSUE_DETAIL_QUERY_PREFIX = ["issues", "detail"] as const;
export const ISSUE_DETAIL_STALE_TIME_MS = 60_000;

function isНетnEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function collectЗадачаRefs(
  issueRef: string | null | undefined,
  issue?: Pick<Задача, "id" | "identifier"> | null,
): string[] {
  const refs = new Set<string>();
  if (isНетnEmptyString(issueRef)) refs.add(issueRef);
  if (isНетnEmptyString(issue?.id)) refs.add(issue.id);
  if (isНетnEmptyString(issue?.identifier)) refs.add(issue.identifier);
  return Array.from(refs);
}

function matchesЗадачаRef(issue: Pick<Задача, "id" | "identifier">, refs: Iterable<string>) {
  const refSet = refs instanceof Set ? refs : new Set(refs);
  return refSet.has(issue.id) || (!!issue.identifier && refSet.has(issue.identifier));
}

function mergeЗадачаSnapshots(existing: Задача | undefined, incoming: Задача): Задача {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
  };
}

export function getЗадачаDetailCacheRefs(issue: Pick<Задача, "id" | "identifier">): string[] {
  return collectЗадачаRefs(null, issue);
}

export function getCachedЗадачаDetail(
  queryClient: QueryClient,
  issueRef: string | null | undefined,
  issue?: Pick<Задача, "id" | "identifier"> | null,
): Задача | undefined {
  const refs = collectЗадачаRefs(issueRef, issue);

  for (const ref of refs) {
    const cached = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(ref));
    if (cached) return cached;
  }

  const cachedEntries = queryClient.getQueriesData<Задача>({ queryКлюч: ISSUE_DETAIL_QUERY_PREFIX });
  return cachedEntries
    .map(([, cachedЗадача]) => cachedЗадача)
    .find((cachedЗадача): cachedЗадача is Задача => !!cachedЗадача && matchesЗадачаRef(cachedЗадача, refs));
}

export function seedЗадачаDetailCache(
  queryClient: QueryClient,
  issue: Задача,
  options?: {
    issueRef?: string | null;
  },
): Задача {
  const refs = collectЗадачаRefs(options?.issueRef, issue);
  const merged = mergeЗадачаSnapshots(getCachedЗадачаDetail(queryClient, options?.issueRef, issue), issue);

  for (const ref of refs) {
    queryClient.setQueryData<Задача>(
      queryКлючs.issues.detail(ref),
      (existing) => mergeЗадачаSnapshots(existing, merged),
    );
  }

  return merged;
}

export async function fetchЗадачаDetail(
  queryClient: QueryClient,
  issueRef: string,
): Promise<Задача> {
  const issue = await issuesApi.get(issueRef);
  return seedЗадачаDetailCache(queryClient, issue, { issueRef });
}

export function getЗадачаDetailQueryOptions(
  queryClient: QueryClient,
  issueRef: string,
  options?: {
    placeholderЗадача?: Pick<Задача, "id" | "identifier"> | null;
  },
) {
  return {
    queryКлюч: queryКлючs.issues.detail(issueRef),
    queryFn: () => fetchЗадачаDetail(queryClient, issueRef),
    placeholderData: getCachedЗадачаDetail(queryClient, issueRef, options?.placeholderЗадача ?? undefined),
  };
}

export function prefetchЗадачаDetail(
  queryClient: QueryClient,
  issueRef: string,
  options?: {
    issue?: Задача | null;
  },
) {
  if (options?.issue) {
    seedЗадачаDetailCache(queryClient, options.issue, { issueRef });
  }

  return queryClient.prefetchQuery({
    queryКлюч: queryКлючs.issues.detail(issueRef),
    queryFn: () => fetchЗадачаDetail(queryClient, issueRef),
    staleTime: ISSUE_DETAIL_STALE_TIME_MS,
  });
}
