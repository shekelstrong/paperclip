import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Поиск as ПоискIcon, AlertTriangle, FileQuestion, Plus, X } from "lucide-react";
import {
  COMPANY_SEARCH_DEFAULT_LIMIT,
  COMPANY_SEARCH_SCOPES,
  type КомпанияПоискResponse,
  type КомпанияПоискResult,
  type КомпанияПоискОбласть,
} from "@paperclipai/shared";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate, useПоискParams } from "@/lib/router";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialogActions } from "../context/DialogContext";
import { searchApi } from "../api/search";
import { agentsApi } from "../api/agents";
import { queryКлючs } from "../lib/queryКлючs";
import { loadRecentПоискes, pushRecentПоиск } from "../lib/recent-searches";
import { PageTabBar, type PageTabItem } from "../components/PageTabBar";
import { ЗадачаGroupHeader } from "../components/ЗадачаGroupHeader";
import { ПоискResultRow } from "../components/search/ПоискResultRow";
import type { Агент } from "@paperclipai/shared";

const SEARCH_DEBOUNCE_MS = 250;
const IDENTIFIER_PATTERN = /^[A-Z]+-\d+$/;

const SCOPE_LABELS: Record<КомпанияПоискОбласть, string> = {
  all: "Все",
  issues: "Задачи",
  comments: "Комментарии",
  documents: "Документы",
  agents: "Агенты",
  projects: "Проекты",
};

type SubGroupКлюч = "issues" | "comments" | "documents" | "agents" | "projects";

const SUBGROUP_ORDER: SubGroupКлюч[] = ["issues", "comments", "documents", "agents", "projects"];

const SUBGROUP_LABELS: Record<SubGroupКлюч, string> = {
  issues: "Задачи",
  comments: "Комментарии",
  documents: "Документы",
  agents: "Агенты",
  projects: "Проекты",
};

function classifyResult(result: КомпанияПоискResult): SubGroupКлюч {
  if (result.type === "agent") return "agents";
  if (result.type === "project") return "projects";
  const matched = new Set(result.matchedFields);
  if (matched.has("title") || matched.has("identifier") || matched.has("description")) return "issues";
  if (matched.has("comment")) return "comments";
  if (matched.has("document")) return "documents";
  return "issues";
}

function buildSubgroups(results: КомпанияПоискResult[]): Array<{ key: SubGroupКлюч; results: КомпанияПоискResult[] }> {
  const buckets = new Map<SubGroupКлюч, КомпанияПоискResult[]>();
  for (const result of results) {
    const key = classifyResult(result);
    const list = buckets.get(key) ?? [];
    list.push(result);
    buckets.set(key, list);
  }
  return SUBGROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    results: buckets.get(key) ?? [],
  }));
}

function isКомпанияПоискОбласть(value: string | null): value is КомпанияПоискОбласть {
  return Boolean(value) && (COMPANY_SEARCH_SCOPES as readonly string[]).includes(value as string);
}

function describeОбласть(scope: КомпанияПоискОбласть) {
  if (scope === "all") return "Все scopes";
  return SCOPE_LABELS[scope];
}

export function buildПоискUrl(href: string, query: string, scope: КомпанияПоискОбласть): string {
  const url = new URL(href);
  if (query.length === 0) {
    url.searchParams.delete("q");
  } else {
    url.searchParams.set("q", query);
  }
  if (scope === "all") {
    url.searchParams.delete("scope");
  } else {
    url.searchParams.set("scope", scope);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function shapeОшибка(error: unknown): { message: string; status?: number } {
  if (!error) return { message: "Неизвестно error" };
  if (error instanceof Ошибка) {
    const status = (error as Ошибка & { status?: number }).status;
    return { message: error.message, status: typeof status === "number" ? status : undefined };
  }
  return { message: String(error) };
}

export function Поиск() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewЗадача } = useDialogActions();
  const navigate = useNavigate();
  const [searchParams] = useПоискParams();

  const urlQuery = searchParams.get("q") ?? "";
  const urlОбластьRaw = searchParams.get("scope");
  const urlОбласть: КомпанияПоискОбласть = isКомпанияПоискОбласть(urlОбластьRaw) ? urlОбластьRaw : "all";

  const [draftQuery, setЧерновикQuery] = useState(urlQuery);
  const [committedQuery, setCommittedQuery] = useState(urlQuery);
  const [scope, setОбласть] = useState<КомпанияПоискОбласть>(urlОбласть);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastUrlSyncRef = useRef<string>("");
  const lastIdentifierRedirectRef = useRef<string>("");
  const [recentПоискes, setRecentПоискes] = useState<string[]>([]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Поиск" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (!selectedКомпанияId) return;
    setRecentПоискes(loadRecentПоискes(selectedКомпанияId));
  }, [selectedКомпанияId]);

  // Pull URL changes back into local state (e.g. browser back/forward).
  useEffect(() => {
    setЧерновикQuery(urlQuery);
    setCommittedQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    setОбласть(urlОбласть);
  }, [urlОбласть]);

  // Debounce the draft query into committedQuery and write to URL via replaceState.
  useEffect(() => {
    if (draftQuery === committedQuery) return;
    const handle = window.setTimeout(() => {
      setCommittedQuery(draftQuery);
      if (typeof window !== "undefined") {
        const next = buildПоискUrl(window.location.href, draftQuery, scope);
        if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}` && next !== lastUrlSyncRef.current) {
          lastUrlSyncRef.current = next;
          window.history.replaceState(window.history.state, "", next);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, committedQuery, scope]);

  const handleОбластьChange = useCallback(
    (next: string) => {
      if (!isКомпанияПоискОбласть(next) || next === scope) return;
      setОбласть(next);
      if (typeof window !== "undefined") {
        const url = buildПоискUrl(window.location.href, committedQuery, next);
        window.history.pushState(window.history.state, "", url);
      }
    },
    [committedQuery, scope],
  );

  const trimmedQuery = committedQuery.trim();
  const queryВключитьd = !!selectedКомпанияId && trimmedQuery.length > 0;

  const { data, isFetching, error, refetch } = useQuery<КомпанияПоискResponse>({
    queryКлюч: queryКлючs.companyПоиск.search(
      selectedКомпанияId ?? "__no-company__",
      trimmedQuery,
      scope,
      COMPANY_SEARCH_DEFAULT_LIMIT,
      0,
    ),
    queryFn: () =>
      searchApi.search(selectedКомпанияId!, {
        q: trimmedQuery,
        scope,
        limit: COMPANY_SEARCH_DEFAULT_LIMIT,
      }),
    enabled: queryВключитьd,
    placeholderData: (previousData) => previousData,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const agentsById = useMemo<ReadonlyMap<string, Pick<Агент, "id" | "name">>>(() => {
    const map = new Map<string, Pick<Агент, "id" | "name">>();
    for (const agent of agents ?? []) map.set(agent.id, agent);
    return map;
  }, [agents]);

  // Persist recent searches once we have a successful response with a non-empty query.
  useEffect(() => {
    if (!selectedКомпанияId) return;
    if (!data || !trimmedQuery) return;
    const next = pushRecentПоиск(selectedКомпанияId, trimmedQuery);
    setRecentПоискes(next);
  }, [data, trimmedQuery, selectedКомпанияId]);

  // Identifier shortcut: when q matches PAP-123 and the API returns an exact identifier match, redirect to it.
  useEffect(() => {
    if (!data) return;
    const upper = trimmedQuery.toUpperCase();
    if (!IDENTIFIER_PATTERN.test(upper)) return;
    if (lastIdentifierRedirectRef.current === upper) return;
    const exact = data.results.find(
      (result) => result.type === "issue" && result.issue?.identifier?.toUpperCase() === upper,
    );
    if (!exact?.issue) return;
    lastIdentifierRedirectRef.current = upper;
    // Strip the comment/document deep-link suffix so an exact identifier match
    // lands on the issue root, not the top-scored snippet.
    const baseHref = exact.href.split("#")[0] ?? exact.href;
    const navigateHref = baseHref.startsWith("/") ? baseHref : `/${baseHref}`;
    navigate(navigateHref, { replace: true });
  }, [data, navigate, trimmedQuery]);

  const handleОчистить = useCallback(() => {
    setЧерновикQuery("");
    setCommittedQuery("");
    inputRef.current?.focus();
    if (typeof window !== "undefined") {
      const next = buildПоискUrl(window.location.href, "", scope);
      window.history.replaceState(window.history.state, "", next);
    }
  }, [scope]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Global "/" focus shortcut.
  useEffect(() => {
    function handler(event: КлючboardEvent) {
      if (event.key !== "/" || event.metaКлюч || event.ctrlКлюч || event.altКлюч) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagИмя?.toНизкийerCase();
      if (target?.isContentИзменитьable || tag === "input" || tag === "textarea") return;
      event.preventПо умолчанию();
      focusInput();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusInput]);

  const counts = data?.countsByТип ?? { issue: 0, agent: 0, project: 0 };
  const totalResults = data?.results.length ?? 0;

  const tabItems = useMemo<PageTabItem[]>(() => {
    function pill(value: number) {
      if (!data) return null;
      return (
        <Badge variant="outline" classИмя="ml-1.5 px-1.5 py-0 text-[10px] tabular-nums font-normal">
          {value}
        </Badge>
      );
    }
    const issuesTotal = counts.issue ?? 0;
    return COMPANY_SEARCH_SCOPES.map((value) => {
      let count: number | null = null;
      if (value === "all") count = (counts.issue ?? 0) + (counts.agent ?? 0) + (counts.project ?? 0);
      else if (value === "issues") count = issuesTotal;
      else if (value === "agents") count = counts.agent ?? 0;
      else if (value === "projects") count = counts.project ?? 0;
      return {
        value,
        label: (
          <span classИмя="flex items-center">
            {SCOPE_LABELS[value as КомпанияПоискОбласть]}
            {count !== null ? pill(count) : null}
          </span>
        ),
      } satisfies PageTabItem;
    });
  }, [counts, data]);

  const subgroups = useMemo(() => buildSubgroups(data?.results ?? []), [data?.results]);

  const showInitialState = !trimmedQuery;
  const isЗагрузка = queryВключитьd && isFetching && !data;
  const hasResults = !!data && totalResults > 0;
  const isEmpty = !!data && !isFetching && totalResults === 0;
  const hasОшибка = !!error && !isЗагрузка;
  const apiОшибка = hasОшибка ? shapeОшибка(error) : null;
  const apiMessage = data?.results === undefined && data ? null : null;
  void apiMessage;

  function navigateЗадачиFallback() {
    navigate(`/issues?q=${encodeURIComponent(trimmedQuery)}`);
  }

  function handleRecentClick(value: string) {
    setЧерновикQuery(value);
    setCommittedQuery(value);
    if (typeof window !== "undefined") {
      const next = buildПоискUrl(window.location.href, value, scope);
      window.history.replaceState(window.history.state, "", next);
    }
  }

  function showВсеОбласть() {
    if (scope === "all") return;
    handleОбластьChange("all");
  }

  return (
    <div classИмя="flex h-full min-h-0 flex-col" data-page="search">
      <div classИмя="border-b border-border px-4 py-3 sm:px-6">
        <h1 classИмя="sr-only">Поиск</h1>
        <div classИмя="relative">
          <ПоискIcon classИмя="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={draftQuery}
            onChange={(event) => setЧерновикQuery(event.currentЦель.value)}
            onКлючDown={(event) => {
              if (event.key === "Escape") {
                if (draftQuery.length > 0) {
                  event.preventПо умолчанию();
                  handleОчистить();
                } else {
                  event.currentЦель.blur();
                }
              }
            }}
            placeholder="Поиск issues, comments, documents, agents, projects…"
            aria-label="Поиск query"
            classИмя="h-10 pl-9 pr-20 text-sm"
          />
          {draftQuery.length > 0 ? (
            <button
              type="button"
              onClick={handleОчистить}
              aria-label="Очистить search"
              classИмя="absolute right-12 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/50"
            >
              <X classИмя="h-3.5 w-3.5" />
            </button>
          ) : null}
          <kbd
            aria-hidden
            classИмя="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            ⌘K
          </kbd>
        </div>
      </div>

      <Tabs value={scope} onЗначениеChange={handleОбластьChange} classИмя="flex h-full min-h-0 flex-col">
        <div classИмя="border-b border-border px-2 sm:px-4">
          <PageTabBar items={tabItems} value={scope} onЗначениеChange={handleОбластьChange} align="start" />
        </div>

        {COMPANY_SEARCH_SCOPES.map((scopeЗначение) => (
          <TabsContent
            key={scopeЗначение}
            value={scopeЗначение}
            classИмя="flex h-full min-h-0 flex-col overflow-y-auto"
          >
            {scopeЗначение === scope ? (
              <ПоискTabContent
                showInitialState={showInitialState}
                isЗагрузка={isЗагрузка}
                hasResults={hasResults}
                hasОшибка={hasОшибка}
                apiОшибка={apiОшибка}
                isEmpty={isEmpty}
                trimmedQuery={trimmedQuery}
                scope={scope}
                showВсеОбласть={showВсеОбласть}
                navigateЗадачиFallback={navigateЗадачиFallback}
                openNewЗадача={() => openNewЗадача({ title: trimmedQuery })}
                refetch={() => void refetch()}
                recentПоискes={recentПоискes}
                onRecentClick={handleRecentClick}
                subgroups={subgroups}
                totalResults={totalResults}
                isFetching={isFetching && !!data}
                agentsById={agentsById}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface ПоискTabContentProps {
  showInitialState: boolean;
  isЗагрузка: boolean;
  hasResults: boolean;
  hasОшибка: boolean;
  apiОшибка: { message: string; status?: number } | null;
  isEmpty: boolean;
  trimmedQuery: string;
  scope: КомпанияПоискОбласть;
  showВсеОбласть: () => void;
  navigateЗадачиFallback: () => void;
  openNewЗадача: () => void;
  refetch: () => void;
  recentПоискes: string[];
  onRecentClick: (query: string) => void;
  subgroups: Array<{ key: SubGroupКлюч; results: КомпанияПоискResult[] }>;
  totalResults: number;
  isFetching: boolean;
  agentsById: ReadonlyMap<string, Pick<Агент, "id" | "name">>;
}

function ПоискTabContent({
  showInitialState,
  isЗагрузка,
  hasResults,
  hasОшибка,
  apiОшибка,
  isEmpty,
  trimmedQuery,
  scope,
  showВсеОбласть,
  navigateЗадачиFallback,
  openNewЗадача,
  refetch,
  recentПоискes,
  onRecentClick,
  subgroups,
  totalResults,
  isFetching,
  agentsById,
}: ПоискTabContentProps) {
  if (showInitialState) {
    return (
      <div classИмя="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
        <div>
          <h2 classИмя="text-lg font-semibold">Тип to search company memory.</h2>
          <p classИмя="mt-1 text-sm text-muted-foreground">
            Задачи, comments, plan documents, agents, projects — same surface, ranked by relevance.
          </p>
        </div>
        {recentПоискes.length > 0 ? (
          <div>
            <div classИмя="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent searches
            </div>
            <ul classИмя="flex flex-col divide-y divide-border rounded-md border border-border">
              {recentПоискes.map((entry) => (
                <li key={entry}>
                  <button
                    type="button"
                    onClick={() => onRecentClick(entry)}
                    classИмя="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                  >
                    <ПоискIcon classИмя="h-3.5 w-3.5 text-muted-foreground" />
                    <span classИмя="flex-1 truncate">{entry}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul classИмя="space-y-1 text-xs text-muted-foreground">
          <li>
            <span classИмя="font-medium text-foreground">Identifier lookup:</span> type{" "}
            <code classИмя="rounded bg-muted px-1 py-0.5 text-[11px]">PAP-123</code> to jump straight to an issue.
          </li>
          <li>
            <span classИмя="font-medium text-foreground">Quoted phrases:</span> wrap a phrase in quotes to match the
            exact sequence.
          </li>
          <li>
            <span classИмя="font-medium text-foreground">⌘K:</span> reopens the command palette pre-seeded with your
            current query.
          </li>
        </ul>
      </div>
    );
  }

  if (hasОшибка) {
    const status = apiОшибка?.status;
    return (
      <div classИмя="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <AlertTriangle classИмя="h-10 w-10 text-destructive" aria-hidden />
        <div classИмя="text-base font-semibold">Couldn’t run that search</div>
        <p classИмя="text-sm text-muted-foreground">
          {status ? `The server returned ${status}.` : "Запрос не выполнен."} Your input and filters are still here, so
          you can retry or fall back to the Задачи filter.
        </p>
        <div classИмя="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={refetch} variant="default" size="sm">
            Повторить
          </Button>
          <Button onClick={navigateЗадачиFallback} variant="outline" size="sm">
            Открытые задачи filter view
          </Button>
        </div>
      </div>
    );
  }

  if (isЗагрузка) {
    return (
      <div classИмя="flex flex-col gap-2 px-2 py-3 sm:px-4">
        <div classИмя="px-3 text-xs text-muted-foreground" data-testid="search-loading">
          Поискing for &ldquo;{trimmedQuery}&rdquo;…
        </div>
        <div classИмя="flex flex-col">
          <div classИмя="px-3 py-2">
            <Skeleton classИмя="h-3 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} classИмя="flex items-start gap-3 px-3 py-2">
              <Skeleton classИмя="mt-1 h-4 w-4 rounded-full" />
              <div classИмя="flex flex-1 flex-col gap-1.5">
                <Skeleton classИмя="h-3 w-3/4" />
                <Skeleton classИмя="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div classИмя="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <FileQuestion classИмя="h-10 w-10 text-muted-foreground" aria-hidden />
        <div classИмя="text-base font-semibold">Нет results for &ldquo;{trimmedQuery}&rdquo;</div>
        <p classИмя="text-sm text-muted-foreground">
          We couldn’t find a match in {describeОбласть(scope).toНизкийerCase()}. Try widening the scope or rephrasing your
          query.
        </p>
        <div classИмя="flex flex-wrap items-center justify-center gap-2">
          {scope !== "all" ? (
            <Button onClick={showВсеОбласть} size="sm" variant="outline">
              Поиск all scopes
            </Button>
          ) : null}
          <Button onClick={openNewЗадача} size="sm" variant="default">
            <Plus classИмя="mr-1.5 h-4 w-4" />
            Создать issue from this query
          </Button>
          <Button onClick={navigateЗадачиFallback} size="sm" variant="ghost">
            Открытые задачи filter view
          </Button>
        </div>
        <ul classИмя="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <li>Try fewer tokens or a single distinctive term.</li>
          <li>
            Use an identifier shortcut like <code classИмя="rounded bg-muted px-1 py-0.5">PAP-123</code>.
          </li>
          <li>Wrap multi-word phrases in quotes.</li>
        </ul>
      </div>
    );
  }

  if (!hasResults) return null;

  return (
    <div classИмя="flex w-full max-w-[960px] flex-col px-2 sm:px-4" data-testid="search-results">
      <div classИмя="flex items-center justify-between py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>
          {totalResults === 1 ? "1 result" : `${totalResults} results`} · sorted by relevance
        </span>
        {isFetching ? <span aria-live="polite" classИмя="normal-case tracking-normal">Updating…</span> : null}
      </div>
      <div classИмя="flex flex-col pb-10">
        {scope === "all" ? (
          subgroups.map((group, groupIndex) => (
            <section
              key={group.key}
              aria-label={SUBGROUP_LABELS[group.key]}
              classИмя={cn("flex flex-col", groupIndex > 0 && "mt-6")}
            >
              <ЗадачаGroupHeader
                label={SUBGROUP_LABELS[group.key]}
                trailing={
                  <span classИмя="text-xs font-normal tabular-nums text-muted-foreground">
                    {group.results.length}
                  </span>
                }
                classИмя="pt-2 pb-1 text-[11px] tracking-wider text-muted-foreground"
              />
              <div classИмя="flex flex-col gap-y-1">
                {group.results.map((result) => (
                  <ПоискResultRow
                    key={`${result.type}:${result.id}:${result.href}`}
                    result={result}
                    agentsById={agentsById}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div classИмя="flex flex-col gap-y-1">
            {subgroups
              .flatMap((group) => group.results)
              .map((result) => (
                <ПоискResultRow
                  key={`${result.type}:${result.id}:${result.href}`}
                  result={result}
                  agentsById={agentsById}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
