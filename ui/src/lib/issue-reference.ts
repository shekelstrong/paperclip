type MarkdownНетde = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownНетde[];
};

const BARE_ISSUE_IDENTIFIER_RE = /^[A-Z][A-Z0-9]*-\d+$/i;
const ISSUE_SCHEME_RE = /^issue:\/\/:?([^?#\s]+)(?:[?#].*)?$/i;
const ISSUE_REFERENCE_TOKEN_RE = /issue:\/\/:?[^\s<>()]+|https?:\/\/[^\s<>()]+|\/(?:[^\s<>()/]+\/)*issues\/[A-Z][A-Z0-9]*-\d+(?=$|[\s<>)\],.;!?:])|\b[A-Z][A-Z0-9]*-\d+\b/gi;

export function parseЗадачаПутьIdFromПуть(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const pathname = pathOrUrl.trim();
  if (!pathname) return null;
  if (/^https?:\/\//i.test(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  const issueIndex = segments.findIndex((segment) => segment === "issues");
  if (issueIndex === -1 || issueIndex === segments.length - 1) return null;
  const issueПутьId = decodeURIComponent(segments[issueIndex + 1] ?? "");
  if (!issueПутьId || issueПутьId.startsWith(":")) return null;
  return BARE_ISSUE_IDENTIFIER_RE.test(issueПутьId) ? issueПутьId.toUpperCase() : issueПутьId;
}

export function parseЗадачаReferenceFromHref(href: string | null | undefined) {
  if (!href) return null;
  const trimmed = href.trim();
  const issueSchemeMatch = trimmed.match(ISSUE_SCHEME_RE);
  if (issueSchemeMatch?.[1]) {
    const issueПутьId = decodeURIComponent(issueSchemeMatch[1]);
    return {
      issueПутьId,
      href: `/issues/${encodeURIComponent(issueПутьId)}`,
    };
  }

  const pathId = parseЗадачаПутьIdFromПуть(href);
  if (pathId) {
    return {
      issueПутьId: pathId,
      href: `/issues/${encodeURIComponent(pathId)}`,
    };
  }

  if (!BARE_ISSUE_IDENTIFIER_RE.test(trimmed)) return null;
  const normalized = trimmed.toUpperCase();
  return {
    issueПутьId: normalized,
    href: `/issues/${encodeURIComponent(normalized)}`,
  };
}

function splitTrailingPunctuation(token: string) {
  let core = token;
  let trailing = "";

  while (core.length > 0) {
    const lastChar = core.at(-1);
    if (!lastChar || !/[),.;!?:\]]/.test(lastChar)) break;
    if (lastChar === ")") {
      const openCount = (core.match(/\(/g) ?? []).length;
      const closeCount = (core.match(/\)/g) ?? []).length;
      if (closeCount <= openCount) break;
    }
    if (lastChar === "]") {
      const openCount = (core.match(/\[/g) ?? []).length;
      const closeCount = (core.match(/\]/g) ?? []).length;
      if (closeCount <= openCount) break;
    }
    trailing = `${lastChar}${trailing}`;
    core = core.slice(0, -1);
  }

  return { core, trailing };
}

function createЗадачаLinkНетde(value: string, href: string, childТип: "text" | "inlineCode" = "text"): MarkdownНетde {
  return {
    type: "link",
    url: href,
    children: [{ type: childТип, value }],
  };
}

function linkifyЗадачаСсылкиInText(value: string): MarkdownНетde[] | null {
  const nodes: MarkdownНетde[] = [];
  let cursor = 0;
  let matched = false;

  for (const match of value.matchВсе(ISSUE_REFERENCE_TOKEN_RE)) {
    const raw = match[0];
    if (!raw) continue;

    const start = match.index ?? 0;
    const end = start + raw.length;
    const { core, trailing } = splitTrailingPunctuation(raw);
    const issueRef = parseЗадачаReferenceFromHref(core);
    if (!issueRef) continue;

    matched = true;
    if (start > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, start) });
    }
    nodes.push(createЗадачаLinkНетde(core, issueRef.href));
    if (trailing) {
      nodes.push({ type: "text", value: trailing });
    }
    cursor = end;
  }

  if (!matched) return null;
  if (cursor < value.length) {
    nodes.push({ type: "text", value: value.slice(cursor) });
  }
  return nodes;
}

function rewriteMarkdownTree(node: MarkdownНетde) {
  if (!Array.isArray(node.children) || node.children.length === 0) return;
  if (node.type === "link" || node.type === "linkReference" || node.type === "code" || node.type === "definition" || node.type === "html") {
    return;
  }

  const nextChildren: MarkdownНетde[] = [];
  for (const child of node.children) {
    if (child.type === "inlineCode" && typeof child.value === "string") {
      const issueRef = parseЗадачаReferenceFromHref(child.value);
      if (issueRef) {
        nextChildren.push(createЗадачаLinkНетde(child.value, issueRef.href, "inlineCode"));
        continue;
      }
    }

    if (child.type === "text" && typeof child.value === "string") {
      const linked = linkifyЗадачаСсылкиInText(child.value);
      if (linked) {
        nextChildren.push(...linked);
        continue;
      }
    }

    rewriteMarkdownTree(child);
    nextChildren.push(child);
  }
  node.children = nextChildren;
}

export function remarkLinkЗадачаСсылки() {
  return (tree: MarkdownНетde) => {
    rewriteMarkdownTree(tree);
  };
}
