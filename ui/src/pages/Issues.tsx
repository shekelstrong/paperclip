import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useLocation, useПоискParams } from "@/lib/router";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { collectLiveЗадачаIds } from "../lib/liveЗадачаIds";
import { queryКлючs } from "../lib/queryКлючs";
import { createЗадачаDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { EmptyState } from "../components/EmptyState";
import { ЗадачиList } from "../components/ЗадачиList";
import { CircleDot } from "lucide-react";
import type { Задача } from "@paperclipai/shared";

const WORKSPACE_FILTER_ISSUE_LIMIT = 1000;
const ISSUES_PAGE_SIZE = 500;

export function getДалееЗадачиPageOffset(
  loadedPageSize: number,
  currentOffset: number,
  pageSize: number = ISSUES_PAGE_SIZE,
): number | undefined {
  return loadedPageSize >= pageSize ? currentOffset + pageSize : undefined;
}

export function mergeЗадачаPagesStable(pages: Задача[][]): Задача[] {
  const seenЗадачаIds = new Set<string>();
  const merged: Задача[] = [];

  for (const page of pages) {
    for (const issue of page) {
      if (seenЗадачаIds.has(issue.id)) continue;
      seenЗадачаIds.add(issue.id);
      merged.push(issue);
    }
  }

  return merged;
}

export function buildЗадачиПоискUrl(currentHref: string, search: string): string | null {
  const url = new URL(currentHref);
  const currentПоиск = url.searchParams.get("q") ?? "";
  if (currentПоиск === search) return null;

  if (search.length > 0) {
    url.searchParams.set("q", search);
  } else {
    url.searchParams.delete("q");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function Задачи() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const location = useLocation();
  const [searchParams] = useПоискParams();
  const queryClient = useQueryClient();
  const fetchДалееPageInFlightRef = useRef(false);

  const urlПоиск = searchParams.get("q") ?? "";
  const [searchOverride, setПоискOverride] = useState<{ search: string; locationПоиск: string } | null>(null);
  const syncedПоиск = useMemo(() => {
    if (typeof window !== "undefined" && searchOverride?.locationПоиск === window.location.search) {
      return searchOverride.search;
    }
    return urlПоиск;
  }, [searchOverride, urlПоиск, location.search]);
  const participantАгентId = searchParams.get("participantАгентId") ?? undefined;
  const initialРабочие области = searchParams.getВсе("workspace").filter((workspaceId) => workspaceId.length > 0);
  const workspaceIdФильтр = initialРабочие области.length === 1 ? initialРабочие области[0] : undefined;
  const handleПоискChange = useCallback((search: string) => {
    const nextUrl = buildЗадачиПоискUrl(window.location.href, search);
    if (!nextUrl) {
      setПоискOverride(null);
      return;
    }
    window.history.replaceState(window.history.state, "", nextUrl);
    setПоискOverride({ search, locationПоиск: window.location.search });
  }, []);

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: projects } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
    refetchInterval: 5000,
  });

  const liveЗадачаIds = useMemo(() => collectLiveЗадачаIds(liveЗапуститьs), [liveЗапуститьs]);

  const issueLinkState = useMemo(
    () =>
      createЗадачаDetailLocationState(
        "Задачи",
        `${location.pathname}${location.search}${location.hash}`,
        "issues",
      ),
    [location.pathname, location.search, location.hash],
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Задачи" }]);
  }, [setBreadcrumbs]);

  const issuePageSize = workspaceIdФильтр ? WORKSPACE_FILTER_ISSUE_LIMIT : ISSUES_PAGE_SIZE;

  const {
    data: issuePages,
    isЗагрузка,
    isFetchingДалееPage,
    error,
    hasДалееPage,
    fetchДалееPage,
  } = useInfiniteQuery({
    queryКлюч: [
      ...queryКлючs.issues.list(selectedКомпанияId!),
      "participant-agent",
      participantАгентId ?? "__all__",
      "workspace",
      workspaceIdФильтр ?? "__all__",
      "with-routine-executions",
      "infinite",
      issuePageSize,
    ],
    queryFn: ({ pageParam }) => issuesApi.list(selectedКомпанияId!, {
      participantАгентId,
      workspaceId: workspaceIdФильтр,
      includeПроцедураExecutions: true,
      limit: issuePageSize,
      offset: pageParam,
    }),
    initialPageParam: 0,
    getДалееPageParam: (lastPage, _allPages, lastPageParam) =>
      getДалееЗадачиPageOffset(lastPage.length, lastPageParam, issuePageSize),
    enabled: !!selectedКомпанияId,
    placeholderData: (previousData) => previousData,
  });

  const issues = useMemo(() => mergeЗадачаPagesStable(issuePages?.pages ?? []), [issuePages]);
  const hasMoreServerЗадачи = syncedПоиск.trim().length === 0
    && hasДалееPage === true;
  const loadMoreServerЗадачи = useCallback(() => {
    if (!hasДалееPage || isFetchingДалееPage || fetchДалееPageInFlightRef.current) return;
    fetchДалееPageInFlightRef.current = true;
    void fetchДалееPage({ cancelRefetch: false }).finally(() => {
      fetchДалееPageInFlightRef.current = false;
    });
  }, [fetchДалееPage, hasДалееPage, isFetchingДалееPage]);

  const updateЗадача = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId!) });
    },
  });

  if (!selectedКомпанияId) {
    return <EmptyState icon={CircleDot} message="Select a company to view issues." />;
  }

  return (
    <ЗадачиList
      issues={issues ?? []}
      isЗагрузка={isЗагрузка}
      isЗагрузкаMoreЗадачи={isFetchingДалееPage}
      error={error as Ошибка | null}
      agents={agents}
      projects={projects}
      liveЗадачаIds={liveЗадачаIds}
      viewStateКлюч="paperclip:issues-view"
      issueLinkState={issueLinkState}
      initialИсполнители={searchParams.get("assignee") ? [searchParams.get("assignee")!] : undefined}
      initialРабочие области={initialРабочие области.length > 0 ? initialРабочие области : undefined}
      initialПоиск={syncedПоиск}
      onПоискChange={handleПоискChange}
      enableПроцедураVisibilityФильтр
      hasMoreЗадачи={hasMoreServerЗадачи}
      onLoadMoreЗадачи={loadMoreServerЗадачи}
      onОбновитьЗадача={(id, data) => updateЗадача.mutate({ id, data })}
      searchФильтрs={participantАгентId || workspaceIdФильтр ? { participantАгентId, workspaceId: workspaceIdФильтр } : undefined}
    />
  );
}
