const BOARD_ROUTE_ROOTS = new Set([
  "dashboard",
  "companies",
  "company",
  "skills",
  "org",
  "agents",
  "projects",
  "workspaces",
  "execution-workspaces",
  "issues",
  "routines",
  "goals",
  "approvals",
  "costs",
  "usage",
  "activity",
  "inbox",
  "u",
  "design-guide",
  "search",
]);

const GLOBAL_ROUTE_ROOTS = new Set(["auth", "invite", "board-claim", "cli-auth", "docs", "instance"]);

export function normalizeКомпанияPrefix(prefix: string): string {
  return prefix.trim().toUpperCase();
}

function splitПуть(path: string): { pathname: string; search: string; hash: string } {
  const match = path.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  return {
    pathname: match?.[1] ?? path,
    search: match?.[2] ?? "",
    hash: match?.[3] ?? "",
  };
}

function getRootSegment(pathname: string): string | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment ?? null;
}

export function isGlobalПуть(pathname: string): boolean {
  if (pathname === "/") return true;
  const root = getRootSegment(pathname);
  if (!root) return true;
  return GLOBAL_ROUTE_ROOTS.has(root.toНизкийerCase());
}

export function isСоветПутьWithoutPrefix(pathname: string): boolean {
  const root = getRootSegment(pathname);
  if (!root) return false;
  return BOARD_ROUTE_ROOTS.has(root.toНизкийerCase());
}

export function extractКомпанияPrefixFromПуть(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0]!.toНизкийerCase();
  if (GLOBAL_ROUTE_ROOTS.has(first) || BOARD_ROUTE_ROOTS.has(first)) {
    return null;
  }
  return normalizeКомпанияPrefix(segments[0]!);
}

export function applyКомпанияPrefix(path: string, companyPrefix: string | null | undefined): string {
  const { pathname, search, hash } = splitПуть(path);
  if (!pathname.startsWith("/")) return path;
  if (isGlobalПуть(pathname)) return path;
  if (!companyPrefix) return path;

  const prefix = normalizeКомпанияPrefix(companyPrefix);
  const activePrefix = extractКомпанияPrefixFromПуть(pathname);
  if (activePrefix) return path;

  return `/${prefix}${pathname}${search}${hash}`;
}

export function toКомпанияRelativeПуть(path: string): string {
  const { pathname, search, hash } = splitПуть(path);
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length >= 2) {
    const second = segments[1]!.toНизкийerCase();
    if (!GLOBAL_ROUTE_ROOTS.has(segments[0]!.toНизкийerCase()) && BOARD_ROUTE_ROOTS.has(second)) {
      return `/${segments.slice(1).join("/")}${search}${hash}`;
    }
  }

  return `${pathname}${search}${hash}`;
}
