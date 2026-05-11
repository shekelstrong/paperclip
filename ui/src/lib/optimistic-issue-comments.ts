import type { Задача, ЗадачаComment } from "@paperclipai/shared";

export interface ЗадачаCommentReassignment {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
}

export interface OptimisticЗадачаComment extends ЗадачаComment {
  clientId: string;
  clientСтатус: "pending" | "queued";
  queueЦельЗапуститьId?: string | null;
}

export type ЗадачаTimelineComment = ЗадачаComment | OptimisticЗадачаComment;
export type LocallyQueuedЗадачаComment<T extends ЗадачаComment> = T & {
  clientСтатус: "queued";
  queueState: "queued";
  queueЦельЗапуститьId: string;
};

function toTimestamp(value: Date | string) {
  return new Date(value).getTime();
}

function createOptimisticCommentId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `optimistic-${randomUuid}`;
  }
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sortЗадачаКомментарии<T extends { createdAt: Date | string; id: string }>(comments: T[]) {
  return [...comments].sort((a, b) => {
    const createdAtDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    if (createdAtDiff !== 0) return createdAtDiff;
    return a.id.localeCompare(b.id);
  });
}

function sortЗадачаКомментарииDesc<T extends { createdAt: Date | string; id: string }>(comments: T[]) {
  return sortЗадачаКомментарии(comments).reverse();
}

export function createOptimisticЗадачаComment(params: {
  companyId: string;
  issueId: string;
  body: string;
  authorUserId: string | null;
  clientСтатус?: OptimisticЗадачаComment["clientСтатус"];
  queueЦельЗапуститьId?: string | null;
}): OptimisticЗадачаComment {
  const now = new Date();
  const clientId = createOptimisticCommentId();
  return {
    id: clientId,
    clientId,
    companyId: params.companyId,
    issueId: params.issueId,
    authorТип: "user",
    authorАгентId: null,
    authorUserId: params.authorUserId,
    body: params.body,
    presentation: null,
    metadata: null,
    clientСтатус: params.clientСтатус ?? "pending",
    queueЦельЗапуститьId: params.queueЦельЗапуститьId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isQueuedЗадачаComment(params: {
  comment: Pick<ЗадачаTimelineComment, "createdAt"> &
    Partial<Pick<OptimisticЗадачаComment, "clientСтатус">> & {
      id?: string;
      authorАгентId?: string | null;
    };
  activeЗапуститьЗапущенAt?: Date | string | null;
  activeЗапуститьАгентId?: string | null;
  activeЗапуститьCommentId?: string | null;
  activeЗапуститьWakeCommentId?: string | null;
  runId?: string | null;
  interruptedЗапуститьId?: string | null;
}) {
  if (params.runId) return false;
  if (params.interruptedЗапуститьId) return false;
  if (
    params.comment.id &&
    (params.comment.id === params.activeЗапуститьWakeCommentId || params.comment.id === params.activeЗапуститьCommentId)
  ) {
    return false;
  }
  if (params.comment.authorАгентId && params.activeЗапуститьАгентId && params.comment.authorАгентId === params.activeЗапуститьАгентId) {
    return false;
  }
  if (params.comment.clientСтатус === "queued") return true;
  if (!params.activeЗапуститьЗапущенAt) return false;
  return toTimestamp(params.comment.createdAt) >= toTimestamp(params.activeЗапуститьЗапущенAt);
}

export function applyLocalQueuedЗадачаCommentState<T extends ЗадачаComment>(
  comment: T,
  params: {
    queuedЦельЗапуститьId?: string | null;
    targetЗапуститьIsLive: boolean;
    runningЗапуститьId?: string | null;
  },
): T | LocallyQueuedЗадачаComment<T> {
  const queuedЦельЗапуститьId = params.queuedЦельЗапуститьId ?? null;
  if (!queuedЦельЗапуститьId || !params.targetЗапуститьIsLive) return comment;
  if (params.runningЗапуститьId && params.runningЗапуститьId !== queuedЦельЗапуститьId) return comment;

  return {
    ...comment,
    clientСтатус: "queued",
    queueState: "queued",
    queueЦельЗапуститьId: queuedЦельЗапуститьId,
  };
}

export function mergeЗадачаКомментарии(
  comments: ЗадачаComment[] | undefined,
  optimisticКомментарии: OptimisticЗадачаComment[],
): ЗадачаTimelineComment[] {
  const merged = [...(comments ?? [])];
  const existingIds = new Set(merged.map((comment) => comment.id));
  for (const comment of optimisticКомментарии) {
    if (!existingIds.has(comment.id)) {
      merged.push(comment);
    }
  }
  return sortЗадачаКомментарии(merged);
}

export function takeOptimisticЗадачаComment(
  comments: OptimisticЗадачаComment[],
  clientId: string,
): { comments: OptimisticЗадачаComment[]; comment: OptimisticЗадачаComment | null } {
  const index = comments.findIndex((comment) => comment.clientId === clientId);
  if (index === -1) {
    return { comments, comment: null };
  }

  return {
    comments: comments.filter((comment) => comment.clientId !== clientId),
    comment: comments[index] ?? null,
  };
}

export function flattenЗадачаCommentPages(
  pages: ReadonlyArray<ReadonlyArray<ЗадачаComment>> | undefined,
): ЗадачаComment[] {
  return sortЗадачаКомментарии((pages ?? []).flatMap((page) => page));
}

export function getДалееЗадачаCommentPageParam(
  lastPage: ReadonlyArray<ЗадачаComment> | undefined,
  pageSize: number,
): string | undefined {
  if (!lastPage || lastPage.length < pageSize) return undefined;
  return lastPage[lastPage.length - 1]?.id;
}

function getДалееPageCursor<T extends { id: string }>(
  lastPage: ReadonlyArray<T> | undefined,
  pageSize: number,
): string | undefined {
  if (!lastPage || lastPage.length < pageSize) return undefined;
  return lastPage[lastPage.length - 1]?.id;
}

export async function loadRemainingЗадачаCommentPages<T extends { id: string }>(params: {
  pages: ReadonlyArray<ReadonlyArray<T>> | undefined;
  pageParams: ReadonlyArray<string | null> | undefined;
  pageSize: number;
  maxPages?: number;
  fetchPage: (afterCommentId: string) => Promise<ReadonlyArray<T>>;
}): Promise<{ pages: T[][]; pageParams: Array<string | null> }> {
  const pages = (params.pages ?? []).map((page) => [...page]);
  const pageParams = params.pageParams
    ? [...params.pageParams].slice(0, pages.length)
    : pages.map(() => null);

  while (pageParams.length < pages.length) {
    pageParams.push(null);
  }

  if (params.pageSize <= 0) return { pages, pageParams };

  let cursor = getДалееPageCursor(pages[pages.length - 1], params.pageSize);
  const maxPages = Math.max(0, params.maxPages ?? Number.POSITIVE_INFINITY);
  const seenCursors = new Set<string>();
  while (cursor && !seenCursors.has(cursor) && seenCursors.size < maxPages) {
    seenCursors.add(cursor);
    const nextPage = [...await params.fetchPage(cursor)];
    pages.push(nextPage);
    pageParams.push(cursor);

    cursor = getДалееPageCursor(nextPage, params.pageSize);
  }

  return { pages, pageParams };
}

export function shouldАвтоloadOlderЗадачаКомментарии(params: {
  activeDetailTab: string;
  hasOlderКомментарии: boolean;
  loadedCommentCount: number;
  initialPageЗагрузка: boolean;
  olderPageЗагрузка: boolean;
  autoLoadLimit: number;
}) {
  if (params.activeDetailTab !== "chat") return false;
  if (!params.hasOlderКомментарии) return false;
  if (params.initialPageЗагрузка || params.olderPageЗагрузка) return false;
  if (params.loadedCommentCount === 0) return false;
  return params.loadedCommentCount < params.autoLoadLimit;
}

export function upsertЗадачаComment(
  comments: ЗадачаComment[] | undefined,
  nextComment: ЗадачаComment,
): ЗадачаComment[] {
  const current = comments ?? [];
  const existingIndex = current.findIndex((comment) => comment.id === nextComment.id);
  if (existingIndex === -1) {
    return sortЗадачаКомментарии([...current, nextComment]);
  }

  const updated = [...current];
  updated[existingIndex] = nextComment;
  return sortЗадачаКомментарии(updated);
}

export function applyOptimisticЗадачаCommentОбновить(
  issue: Задача | undefined,
  params: {
    reopen?: boolean;
    reassignment?: ЗадачаCommentReassignment;
  },
) {
  if (!issue) return issue;
  const nextЗадача: Задача = { ...issue };

  if (params.reopen === true && (issue.status === "done" || issue.status === "cancelled" || issue.status === "blocked")) {
    nextЗадача.status = "todo";
  }

  if (params.reassignment) {
    nextЗадача.assigneeАгентId = params.reassignment.assigneeАгентId;
    nextЗадача.assigneeUserId = params.reassignment.assigneeUserId;
  }

  return nextЗадача;
}

export function applyOptimisticЗадачаFieldОбновить(
  issue: Задача | undefined,
  data: Record<string, unknown>,
) {
  if (!issue) return issue;

  const nextЗадача: Задача = {
    ...issue,
    updatedAt: new Date(),
  };
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(data, key);
  const assign = <K extends keyof Задача>(key: K) => {
    if (hasOwn(key)) {
      nextЗадача[key] = data[key] as Задача[K];
    }
  };

  assign("status");
  assign("priority");
  assign("assigneeАгентId");
  assign("assigneeUserId");
  assign("projectId");
  assign("parentId");
  assign("projectРабочая областьId");
  assign("executionРабочая областьId");
  assign("executionРабочая областьPreference");
  assign("executionРабочая областьНастройки");
  assign("hiddenAt");

  if (hasOwn("labelIds") && Array.isArray(data.labelIds)) {
    const nextLabelIds = data.labelIds.filter((value): value is string => typeof value === "string");
    nextЗадача.labelIds = nextLabelIds;
    if (issue.labels) {
      nextЗадача.labels = issue.labels.filter((label) => nextLabelIds.includes(label.id));
    }
  }

  if (hasOwn("blockedByЗадачаIds") && Array.isArray(data.blockedByЗадачаIds) && issue.blockedBy) {
    const nextЗаблокированByIds = new Set(
      data.blockedByЗадачаIds.filter((value): value is string => typeof value === "string"),
    );
    nextЗадача.blockedBy = issue.blockedBy.filter((relation) => nextЗаблокированByIds.has(relation.id));
  }

  if (hasOwn("projectId")) {
    nextЗадача.project = issue.project?.id === nextЗадача.projectId ? issue.project : null;
  }

  if (hasOwn("parentId")) {
    nextЗадача.ancestors = undefined;
  }

  if (hasOwn("executionРабочая областьId")) {
    nextЗадача.currentExecutionРабочая область =
      issue.currentExecutionРабочая область?.id === nextЗадача.executionРабочая областьId
        ? issue.currentExecutionРабочая область
        : null;
  }

  return nextЗадача;
}

export function matchesЗадачаRef(
  issue: Pick<Задача, "id" | "identifier">,
  refs: Iterable<string>,
) {
  const refSet = refs instanceof Set ? refs : new Set(refs);
  return refSet.has(issue.id) || (!!issue.identifier && refSet.has(issue.identifier));
}

export function applyOptimisticЗадачаFieldОбновитьToCollection(
  issues: Задача[] | undefined,
  refs: Iterable<string>,
  data: Record<string, unknown>,
) {
  if (!issues) return issues;

  let changed = false;
  const nextЗадачи = issues.map((issue) => {
    if (!matchesЗадачаRef(issue, refs)) return issue;
    changed = true;
    return applyOptimisticЗадачаFieldОбновить(issue, data) ?? issue;
  });

  return changed ? nextЗадачи : issues;
}

export function upsertЗадачаCommentInPages(
  pages: ReadonlyArray<ReadonlyArray<ЗадачаComment>> | undefined,
  nextComment: ЗадачаComment,
): ЗадачаComment[][] {
  if (!pages || pages.length === 0) {
    return [[nextComment]];
  }

  const nextPages = pages.map((page) => [...page]);
  for (let pageIndex = 0; pageIndex < nextPages.length; pageIndex += 1) {
    const existingIndex = nextPages[pageIndex]!.findIndex((comment) => comment.id === nextComment.id);
    if (existingIndex === -1) continue;
    nextPages[pageIndex]![existingIndex] = nextComment;
    nextPages[pageIndex] = sortЗадачаКомментарииDesc(nextPages[pageIndex]!);
    return nextPages;
  }

  nextPages[0] = sortЗадачаКомментарииDesc([...nextPages[0]!, nextComment]);
  return nextPages;
}

export function removeЗадачаCommentFromPages(
  pages: ReadonlyArray<ReadonlyArray<ЗадачаComment>> | undefined,
  commentId: string,
): ЗадачаComment[][] {
  if (!pages || pages.length === 0) {
    return [];
  }

  return pages
    .map((page) => page.filter((comment) => comment.id !== commentId))
    .filter((page) => page.length > 0);
}
