import {
  extractКомпанияPrefixFromПуть,
  normalizeКомпанияPrefix,
  toКомпанияRelativeПуть,
} from "./company-routes";

const GLOBAL_SEGMENTS = new Set(["auth", "invite", "board-claim", "cli-auth", "docs"]);

export function isRememberableКомпанияПуть(path: string): boolean {
  const pathname = path.split("?")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return true;
  const [root] = segments;
  if (GLOBAL_SEGMENTS.has(root!)) return false;
  return true;
}

function findКомпанияByPrefix<T extends { id: string; issuePrefix: string }>(params: {
  companies: T[];
  companyPrefix: string;
}): T | null {
  const normalizedPrefix = normalizeКомпанияPrefix(params.companyPrefix);
  return params.companies.find((company) => normalizeКомпанияPrefix(company.issuePrefix) === normalizedPrefix) ?? null;
}

export function getRememberedПутьВладелецКомпанияId<T extends { id: string; issuePrefix: string }>(params: {
  companies: T[];
  pathname: string;
  fallbackКомпанияId: string | null;
}): string | null {
  const routeКомпанияPrefix = extractКомпанияPrefixFromПуть(params.pathname);
  if (!routeКомпанияPrefix) {
    return params.fallbackКомпанияId;
  }

  return findКомпанияByPrefix({
    companies: params.companies,
    companyPrefix: routeКомпанияPrefix,
  })?.id ?? null;
}

export function sanitizeRememberedПутьForКомпания(params: {
  path: string | null | undefined;
  companyPrefix: string;
}): string {
  const relativeПуть = params.path ? toКомпанияRelativeПуть(params.path) : "/dashboard";
  if (!isRememberableКомпанияПуть(relativeПуть)) {
    return "/dashboard";
  }

  const pathname = relativeПуть.split("?")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const [root, entityId] = segments;
  if (root === "issues" && entityId) {
    const identifierMatch = /^([A-Za-z]+)-\d+$/.exec(entityId);
    if (
      identifierMatch &&
      normalizeКомпанияPrefix(identifierMatch[1] ?? "") !== normalizeКомпанияPrefix(params.companyPrefix)
    ) {
      return "/dashboard";
    }
  }

  return relativeПуть;
}
