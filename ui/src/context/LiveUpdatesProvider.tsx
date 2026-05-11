import { useEffect, useRef, type ReactНетde } from "react";
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { Агент, Задача, ЗадачаComment, LiveEvent } from "@paperclipai/shared";
import type { ЗапуститьForЗадача } from "../api/activity";
import type { АктивенЗапуститьForЗадача, LiveЗапуститьForЗадача } from "../api/heartbeats";
import type { КомпанияUserDirectoryResponse } from "../api/access";
import { issuesApi } from "../api/issues";
import { authApi } from "../api/auth";
import { useКомпания } from "./КомпанияContext";
import type { ToastInput } from "./ToastContext";
import { useToastActions } from "./ToastContext";
import { upsertЗадачаCommentInPages } from "../lib/optimistic-issue-comments";
import { clearЗадачаExecutionЗапустить, removeLiveЗапуститьById } from "../lib/optimistic-issue-runs";
import { queryКлючs } from "../lib/queryКлючs";
import { toКомпанияRelativeПуть } from "../lib/company-routes";
import { useLocation } from "../lib/router";

const TOAST_COOLDOWN_WINDOW_MS = 10_000;
const TOAST_COOLDOWN_MAX = 3;
const RECONNECT_SUPPRESS_MS = 2000;
const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);

type LiveОбновитьsSocketLike = {
  readyState: number;
  onopen: ((this: WebSocket, ev: Event) => unknown) | null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null;
  onclose: ((this: WebSocket, ev: ЗакрытьEvent) => unknown) | null;
  close: (code?: number, reason?: string) => void;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function resolveАгентИмя(
  queryClient: QueryClient,
  companyId: string,
  agentId: string,
): string | null {
  const agents = queryClient.getQueryData<Агент[]>(queryКлючs.agents.list(companyId));
  if (!agents) return null;
  const agent = agents.find((a) => a.id === agentId);
  return agent?.name ?? null;
}

function resolveUserИмя(
  queryClient: QueryClient,
  companyId: string,
  userId: string,
): string | null {
  const directory = queryClient.getQueryData<КомпанияUserDirectoryResponse>(
    queryКлючs.access.companyUserDirectory(companyId),
  );
  if (!directory) return null;
  const entry = directory.users.find((u) => u.principalId === userId);
  return entry?.user?.name?.trim() || entry?.user?.email?.trim() || null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function resolveActorLabel(
  queryClient: QueryClient,
  companyId: string,
  actorТип: string | null,
  actorId: string | null,
): string {
  if (actorТип === "agent" && actorId) {
    return resolveАгентИмя(queryClient, companyId, actorId) ?? `Агент ${shortId(actorId)}`;
  }
  if (actorТип === "system") return "System";
  if (actorТип === "user" && actorId) {
    return resolveUserИмя(queryClient, companyId, actorId) ?? "Совет";
  }
  return "Someone";
}

interface ЗадачаToastContext {
  ref: string;
  title: string | null;
  label: string;
  href: string;
}

interface VisibleRouteOptions {
  isForegrounded?: boolean;
}

interface VisibleЗадачаRouteContext {
  routeЗадачаRef: string;
  issueRefs: Set<string>;
  assigneeАгентId: string | null;
  runIds: Set<string>;
}

function resolveЗадачаQueryRefs(
  queryClient: QueryClient,
  companyId: string,
  issueId: string,
  details: Record<string, unknown> | null,
): string[] {
  const refs = new Set<string>([issueId]);
  const detailЗадача = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(issueId));
  const listЗадачи = queryClient.getQueryData<Задача[]>(queryКлючs.issues.list(companyId));
  const detailsIdentifier =
    readString(details?.identifier) ??
    readString(details?.issueIdentifier);

  if (detailsIdentifier) refs.add(detailsIdentifier);

  if (detailЗадача?.id) refs.add(detailЗадача.id);
  if (detailЗадача?.identifier) refs.add(detailЗадача.identifier);

  const listЗадача = listЗадачи?.find((issue) => {
    if (issue.id === issueId) return true;
    if (issue.identifier && issue.identifier === issueId) return true;
    if (detailsIdentifier && issue.identifier === detailsIdentifier) return true;
    return false;
  });
  if (listЗадача?.id) refs.add(listЗадача.id);
  if (listЗадача?.identifier) refs.add(listЗадача.identifier);

  return Array.from(refs);
}

function resolveЗадачаToastContext(
  queryClient: QueryClient,
  companyId: string,
  issueId: string,
  details: Record<string, unknown> | null,
): ЗадачаToastContext {
  const issueRefs = resolveЗадачаQueryRefs(queryClient, companyId, issueId, details);
  const detailЗадача = issueRefs
    .map((ref) => queryClient.getQueryData<Задача>(queryКлючs.issues.detail(ref)))
    .find((issue): issue is Задача => !!issue);
  const listЗадача = queryClient
    .getQueryData<Задача[]>(queryКлючs.issues.list(companyId))
    ?.find((issue) => issueRefs.some((ref) => issue.id === ref || issue.identifier === ref));
  const cachedЗадача = detailЗадача ?? listЗадача ?? null;
  const ref =
    readString(details?.identifier) ??
    readString(details?.issueIdentifier) ??
    cachedЗадача?.identifier ??
    `Задача ${shortId(issueId)}`;
  const title =
    readString(details?.title) ??
    readString(details?.issueНазвание) ??
    cachedЗадача?.title ??
    null;
  return {
    ref,
    title,
    label: title ? `${ref} - ${truncate(title, 72)}` : ref,
    href: `/issues/${cachedЗадача?.identifier ?? issueId}`,
  };
}

function isPageForegrounded(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
  return true;
}

function resolveVisibleЗадачаRouteContext(
  queryClient: QueryClient,
  pathname: string,
  options?: VisibleRouteOptions,
): VisibleЗадачаRouteContext | null {
  const isForegrounded = options?.isForegrounded ?? isPageForegrounded();
  if (!isForegrounded) return null;

  const relativeПуть = toКомпанияRelativeПуть(pathname);
  const segments = relativeПуть.split("/").filter(Boolean);
  if (segments[0] !== "issues" || !segments[1]) return null;

  const issueRef = decodeURIComponent(segments[1]);
  const issue = queryClient.getQueryData<Задача>(queryКлючs.issues.detail(issueRef)) ?? null;
  const issueRefs = new Set<string>([issueRef]);
  if (issue?.id) issueRefs.add(issue.id);
  if (issue?.identifier) issueRefs.add(issue.identifier);

  const runIds = new Set<string>();
  const activeЗапустить = queryClient.getQueryData<АктивенЗапуститьForЗадача | null>(queryКлючs.issues.activeЗапустить(issueRef));
  const liveЗапуститьs = queryClient.getQueryData<LiveЗапуститьForЗадача[]>(queryКлючs.issues.liveЗапуститьs(issueRef)) ?? [];
  const linkedЗапуститьs = queryClient.getQueryData<ЗапуститьForЗадача[]>(queryКлючs.issues.runs(issueRef)) ?? [];

  if (activeЗапустить?.id) runIds.add(activeЗапустить.id);
  for (const run of liveЗапуститьs) {
    if (run.id) runIds.add(run.id);
  }
  for (const run of linkedЗапуститьs) {
    if (run.runId) runIds.add(run.runId);
  }

  return {
    routeЗадачаRef: issueRef,
    issueRefs,
    assigneeАгентId: issue?.assigneeАгентId ?? null,
    runIds,
  };
}

function buildЗадачаRefsForPayload(entityId: string, details: Record<string, unknown> | null): Set<string> {
  const refs = new Set<string>([entityId]);
  const identifier = readString(details?.identifier) ?? readString(details?.issueIdentifier);
  if (identifier) refs.add(identifier);
  return refs;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function shouldSuppressАктивностьToastForVisibleЗадача(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const entityТип = readString(payload.entityТип);
  const entityId = readString(payload.entityId);
  if (entityТип !== "issue" || !entityId) return false;

  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  return overlaps(context.issueRefs, buildЗадачаRefsForPayload(entityId, readRecord(payload.details)));
}

function shouldSuppressЗапуститьСтатусToastForVisibleЗадача(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  const runId = readString(payload.runId);
  if (runId && context.runIds.has(runId)) return true;

  const agentId = readString(payload.agentId);
  return !!agentId && !!context.assigneeАгентId && agentId === context.assigneeАгентId;
}

function invalidateVisibleЗадачаЗапуститьQueries(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  const runId = readString(payload.runId);
  const agentId = readString(payload.agentId);
  const matchesVisibleЗадача =
    (runId !== null && context.runIds.has(runId)) ||
    (!!agentId && !!context.assigneeАгентId && agentId === context.assigneeАгентId);
  if (!matchesVisibleЗадача) return false;

  const status = readString(payload.status);
  if (runId && status && TERMINAL_RUN_STATUSES.has(status)) {
    for (const issueRef of context.issueRefs) {
      queryClient.setQueryData(
        queryКлючs.issues.liveЗапуститьs(issueRef),
        (current: LiveЗапуститьForЗадача[] | undefined) => removeLiveЗапуститьById(current, runId),
      );
      queryClient.setQueryData(
        queryКлючs.issues.activeЗапустить(issueRef),
        (current: АктивенЗапуститьForЗадача | null | undefined) => (current?.id === runId ? null : current),
      );
      queryClient.setQueryData(
        queryКлючs.issues.detail(issueRef),
        (current: Задача | undefined) => clearЗадачаExecutionЗапустить(current, runId),
      );
    }
  }

  for (const issueRef of context.issueRefs) {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issueRef) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(issueRef) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.runs(issueRef) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueRef) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueRef) });
  }
  return true;
}

function shouldSuppressАгентСтатусToastForVisibleЗадача(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context?.assigneeАгентId) return false;

  const agentId = readString(payload.agentId);
  return !!agentId && agentId === context.assigneeАгентId;
}

function shouldDeferЗадачаRefetchForVisibleАгентАктивность(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const entityТип = readString(payload.entityТип);
  const entityId = readString(payload.entityId);
  const actorТип = readString(payload.actorТип);
  const action = readString(payload.action);
  const details = readRecord(payload.details);

  if (entityТип !== "issue" || !entityId) return false;
  if (actorТип !== "agent" && actorТип !== "system") return false;
  if (action !== "issue.updated") return false;
  if (readString(details?.source) === "comment") return false;

  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  return overlaps(context.issueRefs, buildЗадачаRefsForPayload(entityId, details));
}

function shouldDeferVisibleЗадачаCommentАктивность(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
): boolean {
  const entityТип = readString(payload.entityТип);
  const entityId = readString(payload.entityId);
  const action = readString(payload.action);
  const details = readRecord(payload.details);

  if (entityТип !== "issue" || !entityId) return false;
  if (action !== "issue.comment_added") return false;

  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  return overlaps(context.issueRefs, buildЗадачаRefsForPayload(entityId, details));
}

async function hydrateVisibleЗадачаComment(
  queryClient: QueryClient,
  pathname: string,
  payload: Record<string, unknown>,
  options?: VisibleRouteOptions,
) {
  const entityТип = readString(payload.entityТип);
  const action = readString(payload.action);
  const details = readRecord(payload.details);
  const commentId = readString(details?.commentId);

  if (entityТип !== "issue" || action !== "issue.comment_added" || !commentId) return false;

  const context = resolveVisibleЗадачаRouteContext(queryClient, pathname, options);
  if (!context) return false;

  const entityId = readString(payload.entityId);
  if (!entityId || !overlaps(context.issueRefs, buildЗадачаRefsForPayload(entityId, details))) {
    return false;
  }

  try {
    const comment = await issuesApi.getComment(context.routeЗадачаRef, commentId);
    queryClient.setQueryData<InfiniteData<ЗадачаComment[], string | null> | undefined>(
      queryКлючs.issues.comments(context.routeЗадачаRef),
      (current) => {
        if (!current) {
          return {
            pages: [[comment]],
            pageParams: [null],
          };
        }

        return {
          ...current,
          pages: upsertЗадачаCommentInPages(current.pages, comment),
        };
      },
    );
    return true;
  } catch {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.comments(context.routeЗадачаRef) });
    return false;
  }
}

const ISSUE_TOAST_ACTIONS = new Set(["issue.created", "issue.updated", "issue.comment_added"]);
const AGENT_TOAST_STATUSES = new Set(["error"]);
const RUN_TOAST_STATUSES = new Set(["failed", "timed_out", "cancelled"]);

function describeЗадачаОбновить(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const changes: string[] = [];
  if (typeof details.status === "string") changes.push(`status -> ${details.status.replace(/_/g, " ")}`);
  if (typeof details.priority === "string") changes.push(`priority -> ${details.priority}`);
  if (typeof details.assigneeАгентId === "string" || typeof details.assigneeUserId === "string") {
    changes.push("reassigned");
  } else if (details.assigneeАгентId === null || details.assigneeUserId === null) {
    changes.push("unassigned");
  }
  if (details.reopened === true) {
    const from = readString(details.reopenedFrom);
    changes.push(from ? `reopened from ${from.replace(/_/g, " ")}` : "reopened");
  }
  if (typeof details.title === "string") changes.push("title changed");
  if (typeof details.description === "string") changes.push("description changed");
  if (changes.length > 0) return changes.join(", ");
  return null;
}

function buildАктивностьToast(
  queryClient: QueryClient,
  companyId: string,
  payload: Record<string, unknown>,
  currentActor: { userId: string | null; agentId: string | null },
): ToastInput | null {
  const entityТип = readString(payload.entityТип);
  const entityId = readString(payload.entityId);
  const action = readString(payload.action);
  const details = readRecord(payload.details);
  const actorId = readString(payload.actorId);
  const actorТип = readString(payload.actorТип);

  if (entityТип !== "issue" || !entityId || !action || !ISSUE_TOAST_ACTIONS.has(action)) {
    return null;
  }

  const issue = resolveЗадачаToastContext(queryClient, companyId, entityId, details);
  const actor = resolveActorLabel(queryClient, companyId, actorТип, actorId);
  const isSelfАктивность =
    (actorТип === "user" && !!currentActor.userId && actorId === currentActor.userId) ||
    (actorТип === "agent" && !!currentActor.agentId && actorId === currentActor.agentId);
  if (isSelfАктивность) return null;

  if (action === "issue.created") {
    return {
      title: `${actor} created ${issue.ref}`,
      body: issue.title ? truncate(issue.title, 96) : undefined,
      tone: "success",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeКлюч: `activity:${action}:${entityId}`,
    };
  }

  if (action === "issue.updated") {
    if (readString(details?.source) === "comment") {
      // Comment-driven updates emit a paired comment event; show one combined toast on the comment event.
      return null;
    }
    const changeDesc = describeЗадачаОбновить(details);
    const body = changeDesc
      ? issue.title
        ? `${truncate(issue.title, 64)} - ${changeDesc}`
        : changeDesc
      : issue.title
        ? truncate(issue.title, 96)
        : issue.label;
    return {
      title: `${actor} updated ${issue.ref}`,
      body: truncate(body, 100),
      tone: "info",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeКлюч: `activity:${action}:${entityId}`,
    };
  }

  const commentId = readString(details?.commentId);
  const bodySnippet = readString(details?.bodySnippet);
  const reopened = details?.reopened === true;
  const updated = details?.updated === true;
  const reopenedFrom = readString(details?.reopenedFrom);
  const reopenedLabel = reopened
    ? reopenedFrom
      ? `reopened from ${reopenedFrom.replace(/_/g, " ")}`
      : "reopened"
    : null;
  const title = reopened
    ? `${actor} reopened and commented on ${issue.ref}`
    : updated
      ? `${actor} commented and updated ${issue.ref}`
      : `${actor} commented on ${issue.ref}`;
  const body = bodySnippet
    ? reopenedLabel
      ? `${reopenedLabel} - ${bodySnippet.replace(/^#+\s*/m, "").replace(/\n/g, " ")}`
      : bodySnippet.replace(/^#+\s*/m, "").replace(/\n/g, " ")
    : reopenedLabel
      ? issue.title
        ? `${reopenedLabel} - ${issue.title}`
        : reopenedLabel
      : issue.title ?? undefined;
  return {
    title,
    body: body ? truncate(body, 96) : undefined,
    tone: "info",
    action: { label: `View ${issue.ref}`, href: issue.href },
    dedupeКлюч: `activity:${action}:${entityId}:${commentId ?? "na"}`,
  };
}

function buildJoinRequestToast(
  payload: Record<string, unknown>,
): ToastInput | null {
  const entityТип = readString(payload.entityТип);
  const action = readString(payload.action);
  const entityId = readString(payload.entityId);
  const details = readRecord(payload.details);

  if (entityТип !== "join_request" || !action || !entityId) return null;
  if (action !== "join.requested" && action !== "join.request_replayed") return null;

  const requestТип = readString(details?.requestТип);
  const label = requestТип === "agent" ? "Агент" : "Someone";

  return {
    title: `${label} wants to join`,
    body: "A new join request is waiting for approval.",
    tone: "info",
    action: { label: "Просмотр входящих", href: "/inbox/mine" },
    dedupeКлюч: `join-request:${entityId}`,
  };
}

function buildАгентСтатусToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
  queryClient: QueryClient,
  companyId: string,
): ToastInput | null {
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!agentId || !status || !AGENT_TOAST_STATUSES.has(status)) return null;

  const tone = status === "error" ? "error" : "info";
  const name = nameOf(agentId) ?? `Агент ${shortId(agentId)}`;
  const title =
    status === "running"
      ? `${name} started`
      : `${name} errored`;

  const agents = queryClient.getQueryData<Агент[]>(queryКлючs.agents.list(companyId));
  const agent = agents?.find((a) => a.id === agentId);
  const body = agent?.title ?? undefined;

  return {
    title,
    body,
    tone,
    action: { label: "Просмотр агента", href: `/agents/${agentId}` },
    dedupeКлюч: `agent-status:${agentId}:${status}`,
  };
}

function buildЗапуститьСтатусToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
): ToastInput | null {
  const runId = readString(payload.runId);
  const agentId = readString(payload.agentId);
  const status = readString(payload.status);
  if (!runId || !agentId || !status || !RUN_TOAST_STATUSES.has(status)) return null;

  const error = readString(payload.error);
  const triggerDetail = readString(payload.triggerDetail);
  const name = nameOf(agentId) ?? `Агент ${shortId(agentId)}`;
  const tone = status === "succeeded" ? "success" : status === "cancelled" ? "warn" : "error";
  const statusLabel =
    status === "succeeded" ? "succeeded"
      : status === "failed" ? "failed"
        : status === "timed_out" ? "timed out"
          : "cancelled";
  const title = `${name} run ${statusLabel}`;

  let body: string | undefined;
  if (error) {
    body = truncate(error, 100);
  } else if (triggerDetail) {
    body = `Trigger: ${triggerDetail}`;
  }

  return {
    title,
    body,
    tone,
    ttlMs: status === "succeeded" ? 5000 : 7000,
    action: { label: "Просмотр запуска", href: `/agents/${agentId}/runs/${runId}` },
    dedupeКлюч: `run-status:${runId}:${status}`,
  };
}

function invalidateHeartbeatQueries(
  queryClient: ReturnТип<typeof useQueryClient>,
  companyId: string,
  payload: Record<string, unknown>,
) {
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.liveЗапуститьs(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.costs(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(companyId) });

  const agentId = readString(payload.agentId);
  if (agentId) {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(companyId, agentId) });
  }
}

function invalidateАктивностьQueries(
  queryClient: ReturnТип<typeof useQueryClient>,
  companyId: string,
  payload: Record<string, unknown>,
  currentActor: { userId: string | null; agentId: string | null },
  options?: { pathname?: string; isForegrounded?: boolean },
) {
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.activity(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(companyId) });
  queryClient.invalidateQueries({ queryКлюч: queryКлючs.sidebarBadges(companyId) });

  const entityТип = readString(payload.entityТип);
  const entityId = readString(payload.entityId);
  const action = readString(payload.action);
  const actorТип = readString(payload.actorТип);
  const actorId = readString(payload.actorId);

  if (entityТип === "issue") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listMineByMe(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listUnreadTouchedByMe(companyId) });
    if (entityId) {
      const details = readRecord(payload.details);
      const selfCommentАктивность =
        ((action === "issue.comment_added") ||
          (action === "issue.updated" && readString(details?.source) === "comment")) &&
        ((actorТип === "user" && !!currentActor.userId && actorId === currentActor.userId) ||
          (actorТип === "agent" && !!currentActor.agentId && actorId === currentActor.agentId));
      const visibleЗадачаАгентАктивность =
        !!options?.pathname &&
        shouldDeferЗадачаRefetchForVisibleАгентАктивность(
          queryClient,
          options.pathname,
          payload,
          { isForegrounded: options.isForegrounded },
        );
      const visibleЗадачаCommentАктивность =
        !!options?.pathname &&
        shouldDeferVisibleЗадачаCommentАктивность(
          queryClient,
          options.pathname,
          payload,
          { isForegrounded: options.isForegrounded },
        );
      const issueRefs = resolveЗадачаQueryRefs(queryClient, companyId, entityId, details);
      for (const ref of issueRefs) {
        const invalidationOptions =
          (selfCommentАктивность || visibleЗадачаАгентАктивность || visibleЗадачаCommentАктивность)
            ? { refetchТип: "inactive" as const }
            : undefined;
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(ref), ...invalidationOptions });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(ref), ...invalidationOptions });
        if (action === "issue.comment_added") {
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.comments(ref), ...invalidationOptions });
        }
        if (action?.startsWith("issue.thread_interaction_")) {
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.interactions(ref), ...invalidationOptions });
        }
      }
    }
    return;
  }

  if (entityТип === "agent") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.org(companyId) });
    if (entityId) {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(entityId) });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.heartbeats(companyId, entityId) });
    }
    return;
  }

  if (entityТип === "project") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(companyId) });
    if (entityId) queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.detail(entityId) });
    return;
  }

  if (entityТип === "goal") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.goals.list(companyId) });
    if (entityId) queryClient.invalidateQueries({ queryКлюч: queryКлючs.goals.detail(entityId) });
    return;
  }

  if (entityТип === "approval") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.approvals.list(companyId) });
    return;
  }

  if (entityТип === "join_request") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(companyId) });
    return;
  }

  if (entityТип === "cost_event") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.costs(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.usageByПровайдер(companyId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.usageWindowSpend(companyId) });
    // usageQuotaWindows is intentionally excluded: quota windows come from external provider
    // apis on a 5-minute poll and do not change in response to cost events logged by agents
    return;
  }

  if (entityТип === "routine" || entityТип === "routine_trigger" || entityТип === "routine_run") {
    queryClient.invalidateQueries({ queryКлюч: ["routines"] });
    return;
  }

  if (entityТип === "company") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
  }
}

interface ToastGate {
  cooldownHits: Map<string, number[]>;
  suppressUntil: number;
}

function shouldSuppressToast(gate: ToastGate, category: string): boolean {
  const now = Date.now();
  if (now < gate.suppressUntil) return true;

  const hits = gate.cooldownHits.get(category);
  if (!hits) return false;

  const recent = hits.filter((t) => now - t < TOAST_COOLDOWN_WINDOW_MS);
  gate.cooldownHits.set(category, recent);
  return recent.length >= TOAST_COOLDOWN_MAX;
}

function recordToastHit(gate: ToastGate, category: string) {
  const now = Date.now();
  const hits = gate.cooldownHits.get(category) ?? [];
  hits.push(now);
  gate.cooldownHits.set(category, hits);
}

function gatedPushToast(
  gate: ToastGate,
  pushToast: (toast: ToastInput) => string | null,
  category: string,
  toast: ToastInput,
) {
  if (shouldSuppressToast(gate, category)) return;
  const id = pushToast(toast);
  if (id !== null) recordToastHit(gate, category);
}

function handleLiveEvent(
  queryClient: QueryClient,
  expectedКомпанияId: string,
  pathname: string,
  event: LiveEvent,
  pushToast: (toast: ToastInput) => string | null,
  gate: ToastGate,
  currentActor: { userId: string | null; agentId: string | null },
) {
  if (event.companyId !== expectedКомпанияId) return;

  const nameOf = (id: string) => resolveАгентИмя(queryClient, expectedКомпанияId, id);
  const payload = event.payload ?? {};
  if (event.type === "heartbeat.run.log") {
    return;
  }

  if (event.type === "heartbeat.run.queued" || event.type === "heartbeat.run.status") {
    invalidateHeartbeatQueries(queryClient, expectedКомпанияId, payload);
    invalidateVisibleЗадачаЗапуститьQueries(queryClient, pathname, payload);
    if (event.type === "heartbeat.run.status") {
      const toast = buildЗапуститьСтатусToast(payload, nameOf);
      if (
        toast &&
        !shouldSuppressЗапуститьСтатусToastForVisibleЗадача(queryClient, pathname, payload)
      ) {
        gatedPushToast(gate, pushToast, "run-status", toast);
      }
    }
    return;
  }

  if (event.type === "heartbeat.run.event") {
    return;
  }

  if (event.type === "agent.status") {
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(expectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(expectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.org(expectedКомпанияId) });
    const agentId = readString(payload.agentId);
    if (agentId) queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.detail(agentId) });
    const toast = buildАгентСтатусToast(payload, nameOf, queryClient, expectedКомпанияId);
    if (
      toast &&
      !shouldSuppressАгентСтатусToastForVisibleЗадача(queryClient, pathname, payload)
    ) {
      gatedPushToast(gate, pushToast, "agent-status", toast);
    }
    return;
  }

  if (event.type === "activity.logged") {
    invalidateАктивностьQueries(queryClient, expectedКомпанияId, payload, currentActor, { pathname });
    if (shouldDeferVisibleЗадачаCommentАктивность(queryClient, pathname, payload)) {
      void hydrateVisibleЗадачаComment(queryClient, pathname, payload);
    }
    const action = readString(payload.action);
    const toast =
      buildАктивностьToast(queryClient, expectedКомпанияId, payload, currentActor) ??
      buildJoinRequestToast(payload);
    if (
      toast &&
      !shouldSuppressАктивностьToastForVisibleЗадача(queryClient, pathname, payload)
    ) {
      gatedPushToast(gate, pushToast, `activity:${action ?? "unknown"}`, toast);
    }
  }
}

function resolveLiveКомпанияId(
  selectedКомпанияId: string | null,
  selectedКомпанияLiveId: string | null,
): string | null {
  return selectedКомпанияId && selectedКомпанияId === selectedКомпанияLiveId
    ? selectedКомпанияId
    : null;
}

function resetSocketHandlers(target: LiveОбновитьsSocketLike) {
  target.onopen = null;
  target.onmessage = null;
  target.onerror = null;
  target.onclose = null;
}

function closeSocketQuietly(target: LiveОбновитьsSocketLike | null, reason: string) {
  if (!target) return;

  if (target.readyState === SOCKET_CONNECTING) {
    // Let the handshake complete and then close. Calling close() while the
    // socket is still CONNECTING is what triggers the noisy browser error.
    target.onopen = () => {
      resetSocketHandlers(target);
      target.close(1000, reason);
    };
    target.onmessage = null;
    target.onerror = () => undefined;
    target.onclose = null;
    return;
  }

  resetSocketHandlers(target);

  if (target.readyState === SOCKET_OPEN) {
    target.close(1000, reason);
  }
}

export const __liveОбновитьsПроверитьUtils = {
  buildАгентСтатусToast,
  buildЗапуститьСтатусToast,
  closeSocketQuietly,
  hydrateVisibleЗадачаComment,
  invalidateАктивностьQueries,
  invalidateVisibleЗадачаЗапуститьQueries,
  resolveLiveКомпанияId,
  shouldDeferЗадачаRefetchForVisibleАгентАктивность,
  shouldDeferVisibleЗадачаCommentАктивность,
  shouldSuppressАктивностьToastForVisibleЗадача,
  shouldSuppressЗапуститьСтатусToastForVisibleЗадача,
  shouldSuppressАгентСтатусToastForVisibleЗадача,
};

export function LiveОбновитьsПровайдер({ children }: { children: ReactНетde }) {
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const location = useLocation();
  const gateRef = useRef<ToastGate>({ cooldownHits: new Map(), suppressUntil: 0 });
  const pathnameRef = useRef(location.pathname);
  const { data: session, status: sessionСтатус } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const socketAuthКлюч = session?.session?.id ?? currentUserId ?? "signed_out";
  const liveКомпанияId = resolveLiveКомпанияId(selectedКомпанияId, selectedКомпания?.id ?? null);
  const canConnectSocket = sessionСтатус === "success" && session !== null && liveКомпанияId !== null;
  const currentActorRef = useRef<{ userId: string | null; agentId: string | null }>({
    userId: currentUserId,
    agentId: null,
  });

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    currentActorRef.current = {
      userId: currentUserId,
      agentId: null,
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!canConnectSocket || !liveКомпанияId) return;

    let closed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectAttempt += 1;
      const delayMs = Math.min(15000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 4));
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(liveКомпанияId)}/events/ws`;
      const nextSocket = new WebSocket(url);
      socket = nextSocket;

      nextSocket.onopen = () => {
        if (closed || socket !== nextSocket) {
          closeSocketQuietly(nextSocket, "stale_connection");
          return;
        }
        if (reconnectAttempt > 0) {
          gateRef.current.suppressUntil = Date.now() + RECONNECT_SUPPRESS_MS;
        }
        reconnectAttempt = 0;
      };

      nextSocket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw) as LiveEvent;
          handleLiveEvent(queryClient, liveКомпанияId, pathnameRef.current, parsed, pushToast, gateRef.current, {
            userId: currentActorRef.current.userId,
            agentId: currentActorRef.current.agentId,
          });
        } catch {
          // Ignore non-JSON payloads.
        }
      };

      nextSocket.onerror = () => {
        // Wait for onclose to drive the reconnect. Self-closing here is what
        // produces the "closed before connection established" browser noise.
      };

      nextSocket.onclose = () => {
        if (socket !== nextSocket) return;
        socket = null;
        if (closed) return;
        scheduleReconnect();
      };
    };

    // Delay initial connect slightly so React StrictMode's double-invoke
    // cleanup fires before the WebSocket is created, avoiding the
    // "WebSocket closed before connection established" dev-mode error.
    const connectTimer = window.setTimeout(connect, 0);

    return () => {
      closed = true;
      window.clearTimeout(connectTimer);
      clearReconnect();
      const activeSocket = socket;
      socket = null;
      closeSocketQuietly(activeSocket, "provider_unmount");
    };
  }, [queryClient, liveКомпанияId, pushToast, canConnectSocket, socketAuthКлюч]);

  return <>{children}</>;
}
