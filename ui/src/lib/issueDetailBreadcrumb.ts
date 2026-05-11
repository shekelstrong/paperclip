import type { Задача } from "@paperclipai/shared";

type ЗадачаDetailSource = "issues" | "inbox";

type ЗадачаDetailBreadcrumb = {
  label: string;
  href: string;
};

export type ЗадачаDetailHeaderSeed = {
  id: string;
  identifier: string | null;
  title: string;
  status: Задача["status"];
  blockerAttention?: Задача["blockerAttention"];
  priority: Задача["priority"];
  projectId: string | null;
  projectИмя: string | null;
  originKind?: Задача["originKind"];
  originId?: string | null;
};

type ЗадачаDetailLocationState = {
  issueDetailBreadcrumb?: ЗадачаDetailBreadcrumb;
  issueDetailSource?: ЗадачаDetailSource;
  issueDetailВходящиеQuickАрхивироватьArmed?: boolean;
  issueDetailHeaderSeed?: ЗадачаDetailHeaderSeed;
};

const ISSUE_DETAIL_SOURCE_QUERY_PARAM = "from";
const ISSUE_DETAIL_BREADCRUMB_HREF_QUERY_PARAM = "fromHref";
const ISSUE_DETAIL_STORAGE_KEY_PREFIX = "paperclip:issue-detail-breadcrumb:";

function isЗадачаDetailBreadcrumb(value: unknown): value is ЗадачаDetailBreadcrumb {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ЗадачаDetailBreadcrumb>;
  return typeof candidate.label === "string" && typeof candidate.href === "string";
}

function isЗадачаDetailSource(value: unknown): value is ЗадачаDetailSource {
  return value === "issues" || value === "inbox";
}

function isЗадачаDetailHeaderSeed(value: unknown): value is ЗадачаDetailHeaderSeed {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ЗадачаDetailHeaderSeed>;
  const hasOriginKind =
    candidate.originKind === undefined || typeof candidate.originKind === "string";
  const hasOriginId =
    candidate.originId === undefined || candidate.originId === null || typeof candidate.originId === "string";
  const hasBlockerAttention =
    candidate.blockerAttention === undefined
    || (typeof candidate.blockerAttention === "object" && candidate.blockerAttention !== null);
  return (
    typeof candidate.id === "string"
    && (candidate.identifier === null || typeof candidate.identifier === "string")
    && typeof candidate.title === "string"
    && typeof candidate.status === "string"
    && hasBlockerAttention
    && typeof candidate.priority === "string"
    && (candidate.projectId === null || typeof candidate.projectId === "string")
    && (candidate.projectИмя === null || typeof candidate.projectИмя === "string")
    && hasOriginKind
    && hasOriginId
  );
}

function createЗадачаDetailHeaderSeed(issue: Задача): ЗадачаDetailHeaderSeed {
  return {
    id: issue.id,
    identifier: issue.identifier ?? null,
    title: issue.title,
    status: issue.status,
    blockerAttention: issue.blockerAttention,
    priority: issue.priority,
    projectId: issue.projectId ?? null,
    projectИмя: issue.project?.name ?? null,
    originKind: issue.originKind,
    originId: issue.originId ?? null,
  };
}

export function withЗадачаDetailHeaderSeed(state: unknown, issue: Задача): ЗадачаDetailLocationState {
  const headerSeed = createЗадачаDetailHeaderSeed(issue);
  if (typeof state !== "object" || state === null) {
    return { issueDetailHeaderSeed: headerSeed };
  }

  return {
    ...(state as ЗадачаDetailLocationState),
    issueDetailHeaderSeed: headerSeed,
  };
}

export function readЗадачаDetailHeaderSeed(state: unknown): ЗадачаDetailHeaderSeed | null {
  if (typeof state !== "object" || state === null) return null;
  const candidate = (state as ЗадачаDetailLocationState).issueDetailHeaderSeed;
  return isЗадачаDetailHeaderSeed(candidate) ? candidate : null;
}

function readЗадачаDetailSource(state: unknown): ЗадачаDetailSource | null {
  if (typeof state !== "object" || state === null) return null;
  const source = (state as ЗадачаDetailLocationState).issueDetailSource;
  return isЗадачаDetailSource(source) ? source : null;
}

function readЗадачаDetailSourceFromПоиск(search?: string): ЗадачаDetailSource | null {
  if (!search) return null;
  const params = new URLПоискParams(search);
  const source = params.get(ISSUE_DETAIL_SOURCE_QUERY_PARAM);
  return isЗадачаDetailSource(source) ? source : null;
}

function readЗадачаDetailBreadcrumbHrefFromПоиск(search?: string): string | null {
  if (!search) return null;
  const params = new URLПоискParams(search);
  const href = params.get(ISSUE_DETAIL_BREADCRUMB_HREF_QUERY_PARAM);
  return href && href.startsWith("/") ? href : null;
}

function inferЗадачаDetailSource(
  state: Partial<ЗадачаDetailLocationState> | null,
  breadcrumb: ЗадачаDetailBreadcrumb | null,
): ЗадачаDetailSource | null {
  if (isЗадачаDetailSource(state?.issueDetailSource)) return state.issueDetailSource;
  if (!breadcrumb) return null;
  if (breadcrumb.label === "Входящие" || breadcrumb.href.includes("/inbox")) return "inbox";
  if (breadcrumb.label === "Задачи" || breadcrumb.href.includes("/issues")) return "issues";
  return null;
}

function breadcrumbForSource(source: ЗадачаDetailSource): ЗадачаDetailBreadcrumb {
  if (source === "inbox") return { label: "Входящие", href: "/inbox" };
  return { label: "Задачи", href: "/issues" };
}

export function createЗадачаDetailLocationState(
  label: string,
  href: string,
  source?: ЗадачаDetailSource,
): ЗадачаDetailLocationState {
  return {
    issueDetailBreadcrumb: { label, href },
    issueDetailSource: source,
  };
}

export function armЗадачаDetailВходящиеQuickАрхивировать(state: unknown): ЗадачаDetailLocationState {
  if (typeof state !== "object" || state === null) {
    return { issueDetailВходящиеQuickАрхивироватьArmed: true };
  }

  return {
    ...(state as ЗадачаDetailLocationState),
    issueDetailВходящиеQuickАрхивироватьArmed: true,
  };
}

function readStoredЗадачаDetailLocationState(issueПутьId: string): ЗадачаDetailLocationState | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  const raw = window.sessionStorage.getItem(`${ISSUE_DETAIL_STORAGE_KEY_PREFIX}${issueПутьId}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ЗадачаDetailLocationState>;
    const breadcrumb = isЗадачаDetailBreadcrumb(parsed.issueDetailBreadcrumb)
      ? parsed.issueDetailBreadcrumb
      : null;
    const source = inferЗадачаDetailSource(parsed, breadcrumb);
    if (!breadcrumb || !source) return null;
    const headerSeed = isЗадачаDetailHeaderSeed(parsed.issueDetailHeaderSeed)
      ? parsed.issueDetailHeaderSeed
      : undefined;
    return {
      issueDetailBreadcrumb: breadcrumb,
      issueDetailSource: source,
      issueDetailВходящиеQuickАрхивироватьArmed: parsed.issueDetailВходящиеQuickАрхивироватьArmed === true,
      issueDetailHeaderSeed: headerSeed,
    };
  } catch {
    return null;
  }
}

function normalizeЗадачаDetailLocationState(
  state: unknown,
  search?: string,
): ЗадачаDetailLocationState | null {
  if (typeof state === "object" && state !== null) {
    const candidate = (state as ЗадачаDetailLocationState).issueDetailBreadcrumb;
    if (isЗадачаDetailBreadcrumb(candidate)) {
      const source = inferЗадачаDetailSource(state as Partial<ЗадачаDetailLocationState>, candidate);
      if (!source) return null;
      const headerSeed = readЗадачаDetailHeaderSeed(state) ?? undefined;
      return {
        issueDetailBreadcrumb: candidate,
        issueDetailSource: source,
        issueDetailВходящиеQuickАрхивироватьArmed:
          (state as ЗадачаDetailLocationState).issueDetailВходящиеQuickАрхивироватьArmed === true,
        issueDetailHeaderSeed: headerSeed,
      };
    }
  }

  const source = readЗадачаDetailSourceFromПоиск(search);
  const href = readЗадачаDetailBreadcrumbHrefFromПоиск(search);
  if (!source) return null;

  return {
    issueDetailBreadcrumb: href ? { ...breadcrumbForSource(source), href } : breadcrumbForSource(source),
    issueDetailSource: source,
    issueDetailВходящиеQuickАрхивироватьArmed: false,
  };
}

export function rememberЗадачаDetailLocationState(issueПутьId: string, state: unknown, search?: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  const normalized = normalizeЗадачаDetailLocationState(state, search);
  if (!normalized) return;

  window.sessionStorage.setItem(
    `${ISSUE_DETAIL_STORAGE_KEY_PREFIX}${issueПутьId}`,
    JSON.stringify(normalized),
  );
}

export function createЗадачаDetailПуть(issueПутьId: string): string {
  return `/issues/${issueПутьId}`;
}

export function hasLegacyЗадачаDetailQuery(search?: string): boolean {
  if (!search) return false;
  const params = new URLПоискParams(search);
  return params.has(ISSUE_DETAIL_SOURCE_QUERY_PARAM) || params.has(ISSUE_DETAIL_BREADCRUMB_HREF_QUERY_PARAM);
}

export function readЗадачаDetailLocationState(
  issueПутьId: string | null | undefined,
  state: unknown,
  search?: string,
): ЗадачаDetailLocationState | null {
  const normalized = normalizeЗадачаDetailLocationState(state, search);
  if (normalized) return normalized;
  if (!issueПутьId) return null;
  return readStoredЗадачаDetailLocationState(issueПутьId);
}

export function readЗадачаDetailBreadcrumb(
  issueПутьId: string | null | undefined,
  state: unknown,
  search?: string,
): ЗадачаDetailBreadcrumb | null {
  return readЗадачаDetailLocationState(issueПутьId, state, search)?.issueDetailBreadcrumb ?? null;
}

export function shouldArmЗадачаDetailВходящиеQuickАрхивировать(state: unknown): boolean {
  if (typeof state !== "object" || state === null) return false;
  return (state as ЗадачаDetailLocationState).issueDetailВходящиеQuickАрхивироватьArmed === true;
}
