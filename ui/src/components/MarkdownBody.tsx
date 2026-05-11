import { isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactНетde } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Копировать, ExternalLink, Github } from "lucide-react";
import Markdown, { defaultUrlTransform, type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";
import { Link } from "@/lib/router";
import { useTheme } from "../context/ThemeContext";
import { mentionChipInlineStyle, parseMentionChipHref } from "../lib/mention-chips";
import { issuesApi } from "../api/issues";
import { queryКлючs } from "../lib/queryКлючs";
import { parseЗадачаReferenceFromHref, remarkLinkЗадачаСсылки } from "../lib/issue-reference";
import { remarkSoftBreaks } from "../lib/remark-soft-breaks";
import { СтатусIcon } from "./СтатусIcon";

interface MarkdownBodyProps {
  children: string;
  classИмя?: string;
  style?: React.CSSProperties;
  softBreaks?: boolean;
  linkЗадачаСсылки?: boolean;
  /** Opt into Obsidian-style [[target]] / [[target|label]] wikilinks. */
  enableWikiLinks?: boolean;
  /** Base href used for wikilinks when no resolver is supplied. */
  wikiLinkRoot?: string;
  /** Опционально href resolver for wikilinks. Return null to leave a token as plain text. */
  resolveWikiLinkHref?: (target: string, label: string) => string | null | undefined;
  /** Опционально resolver for relative image paths (e.g. within export packages) */
  resolveImageSrc?: (src: string) => string | null;
  /** Called when a user clicks an inline image */
  onImageClick?: (src: string) => void;
}

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;

function MarkdownЗадачаLink({
  issueПутьId,
  children,
}: {
  issueПутьId: string;
  children: ReactНетde;
}) {
  const { data } = useQuery({
    queryКлюч: queryКлючs.issues.detail(issueПутьId),
    queryFn: () => issuesApi.get(issueПутьId),
    staleTime: 60_000,
  });

  const identifier = data?.identifier ?? issueПутьId;
  const title = data?.title ?? identifier;
  const status = data?.status;
  const issueLabel = title !== identifier ? `Задача ${identifier}: ${title}` : `Задача ${identifier}`;

  return (
    <Link
      to={`/issues/${identifier}`}
      data-mention-kind="issue"
      classИмя="paperclip-markdown-issue-ref"
      title={title}
      aria-label={issueLabel}
    >
      {status ? (
        <СтатусIcon status={status} classИмя="mr-1 h-3 w-3 align-[-0.125em]" />
      ) : null}
      {children}
    </Link>
  );
}

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

const wrapAnywhereStyle: React.CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const scrollableBlockStyle: React.CSSProperties = {
  maxWidth: "100%",
  overflowX: "auto",
};

const tableCellWrapStyle: React.CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "normal",
};

function mergeWrapStyle(style?: React.CSSProperties): React.CSSProperties {
  return {
    ...wrapAnywhereStyle,
    ...style,
  };
}

function mergeTableCellStyle(style?: React.CSSProperties): React.CSSProperties {
  return {
    ...tableCellWrapStyle,
    ...style,
  };
}

function mergeScrollableBlockStyle(style?: React.CSSProperties): React.CSSProperties {
  return {
    ...scrollableBlockStyle,
    ...style,
  };
}

function flattenText(value: ReactНетde): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  return "";
}

function extractMermaidSource(children: ReactНетde): string | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { classИмя?: unknown; children?: ReactНетde };
  if (typeof childProps.classИмя !== "string") return null;
  if (!/\blanguage-mermaid\b/i.test(childProps.classИмя)) return null;
  return flattenText(childProps.children).replace(/\n$/, "");
}

function safeMarkdownUrlTransform(url: string): string {
  return parseMentionChipHref(url) ? url : defaultUrlTransform(url);
}

type MarkdownAstНетde = {
  type?: string;
  value?: string;
  children?: MarkdownAstНетde[];
  url?: string;
  title?: string | null;
  data?: {
    hProperties?: Record<string, string>;
  };
};

type ParsedWikiLink = {
  target: string;
  label: string;
};

const WIKI_LINK_PATTERN = /\[\[([^\]\r\n]+)\]\]/g;
const WIKI_LINK_SKIP_PARENT_TYPES = new Set([
  "definition",
  "image",
  "imageReference",
  "link",
  "linkReference",
]);

function parseWikiLinkBody(body: string): ParsedWikiLink | null {
  const [rawЦель, ...rawLabelParts] = body.split("|");
  const target = rawЦель?.trim() ?? "";
  const label = rawLabelParts.length > 0 ? rawLabelParts.join("|").trim() : target;
  if (!target || target.includes("[") || target.includes("]")) return null;
  return {
    target,
    label: label || target,
  };
}

function encodeWikiLinkЦель(target: string): string | null {
  const trimmed = target.trim();
  if (!trimmed || /^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return null;

  const hashIndex = trimmed.indexOf("#");
  const rawПуть = (hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed)
    .trim()
    .replace(/^\/+/, "");
  if (
    !rawПуть ||
    rawПуть.includes("\\") ||
    rawПуть.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const encodedПуть = rawПуть.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const rawHash = hashIndex >= 0 ? trimmed.slice(hashIndex + 1).trim() : "";
  return rawHash ? `${encodedПуть}#${encodeURIComponent(rawHash)}` : encodedПуть;
}

function defaultWikiLinkHref(target: string, wikiLinkRoot?: string): string | null {
  const encodedЦель = encodeWikiLinkЦель(target);
  if (!encodedЦель) return null;
  const root = wikiLinkRoot?.trim().replace(/\/+$/, "") ?? "";
  return root ? `${root}/${encodedЦель}` : encodedЦель;
}

function createWikiLinkНетde(href: string, wikiLink: ParsedWikiLink): MarkdownAstНетde {
  return {
    type: "link",
    url: href,
    title: null,
    data: {
      hProperties: {
        "data-paperclip-wiki-link": "true",
        "data-paperclip-wiki-target": wikiLink.target,
      },
    },
    children: [{ type: "text", value: wikiLink.label }],
  };
}

function splitTextByWikiLinks(
  value: string,
  options: {
    wikiLinkRoot?: string;
    resolveWikiLinkHref?: (target: string, label: string) => string | null | undefined;
  },
): MarkdownAstНетde[] {
  const nodes: MarkdownAstНетde[] = [];
  let lastIndex = 0;

  for (const match of value.matchВсе(WIKI_LINK_PATTERN)) {
    const raw = match[0] ?? "";
    const body = match[1] ?? "";
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, start) });
    }

    const wikiLink = parseWikiLinkBody(body);
    let resolvedHref: string | null = null;
    if (wikiLink) {
      if (options.resolveWikiLinkHref) {
        const customHref = options.resolveWikiLinkHref(wikiLink.target, wikiLink.label);
        resolvedHref = customHref === undefined
          ? defaultWikiLinkHref(wikiLink.target, options.wikiLinkRoot)
          : customHref;
      } else {
        resolvedHref = defaultWikiLinkHref(wikiLink.target, options.wikiLinkRoot);
      }
    }

    if (wikiLink && resolvedHref) {
      nodes.push(createWikiLinkНетde(resolvedHref, wikiLink));
    } else {
      nodes.push({ type: "text", value: raw });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }

  return nodes;
}

function transformWikiLinkChildren(
  node: MarkdownAstНетde,
  options: {
    wikiLinkRoot?: string;
    resolveWikiLinkHref?: (target: string, label: string) => string | null | undefined;
  },
) {
  if (!node.children || WIKI_LINK_SKIP_PARENT_TYPES.has(node.type ?? "")) return;

  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && typeof child.value === "string" && child.value.includes("[[")) {
      return splitTextByWikiLinks(child.value, options);
    }
    transformWikiLinkChildren(child, options);
    return child;
  });
}

function createRemarkWikiLinks(options: {
  wikiLinkRoot?: string;
  resolveWikiLinkHref?: (target: string, label: string) => string | null | undefined;
}) {
  return function remarkWikiLinks() {
    return (tree: MarkdownAstНетde) => {
      transformWikiLinkChildren(tree, options);
    };
  };
}

function isGitHubUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && (url.hostname === "github.com" || url.hostname === "www.github.com");
  } catch {
    return false;
  }
}

function isExternalHttpUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (typeof window === "undefined") return true;
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function renderLinkBody(
  children: ReactНетde,
  leadingIcon: ReactНетde,
  trailingIcon: ReactНетde,
): ReactНетde {
  if (!leadingIcon && !trailingIcon) return children;

  // React-markdown can pass arrays/elements for styled link text; the nowrap
  // splitting below is intentionally limited to plain text links.
  if (typeof children === "string" && children.length > 0) {
    if (children.length === 1) {
      return (
        <span style={{ whiteSpace: "nowrap" }}>
          {leadingIcon}
          {children}
          {trailingIcon}
        </span>
      );
    }
    const first = children[0];
    const last = children[children.length - 1];
    const middle = children.slice(1, -1);
    return (
      <>
        {leadingIcon ? (
          <span style={{ whiteSpace: "nowrap" }}>
            {leadingIcon}
            {first}
          </span>
        ) : first}
        {middle}
        {trailingIcon ? (
          <span style={{ whiteSpace: "nowrap" }}>
            {last}
            {trailingIcon}
          </span>
        ) : last}
      </>
    );
  }

  return (
    <>
      {leadingIcon}
      {children}
      {trailingIcon}
    </>
  );
}

function CodeBlock({
  children,
  preProps,
}: {
  children: ReactНетde;
  preProps: React.HTMLAttributes<HTMLPreElement>;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setОшибка] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnТип<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleКопировать = useCallback(async () => {
    const text = preRef.current?.innerText ?? flattenText(children);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          const success = document.execКоманда("copy");
          if (!success) throw new Ошибка("execКоманда copy failed");
        } finally {
          document.body.removeChild(textarea);
        }
      }
      setОшибка(false);
      setCopied(true);
    } catch {
      setОшибка(true);
      setCopied(true);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      setОшибка(false);
    }, 1500);
  }, [children]);

  const label = failed ? "Копировать failed" : copied ? "Copied!" : "Копировать";

  return (
    <div classИмя="paperclip-markdown-codeblock">
      <pre
        {...preProps}
        ref={preRef}
        style={mergeScrollableBlockStyle(preProps.style as React.CSSProperties | undefined)}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleКопировать}
        aria-label="Копировать code"
        title={label}
        classИмя="paperclip-markdown-codeblock-copy"
        data-copied={copied || undefined}
        data-failed={failed || undefined}
      >
        {copied && !failed ? (
          <Check aria-hidden="true" classИмя="h-3.5 w-3.5" />
        ) : (
          <Копировать aria-hidden="true" classИмя="h-3.5 w-3.5" />
        )}
        <span classИмя="paperclip-markdown-codeblock-copy-label">{label}</span>
      </button>
    </div>
  );
}

function MermaidDiagramBlock({ source, darkMode }: { source: string; darkMode: boolean }) {
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setОшибка] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setОшибка(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: darkMode ? "dark" : "default",
          fontFamily: "inherit",
          suppressОшибкаRendering: true,
        });
        const rendered = await mermaid.render(`paperclip-mermaid-${renderId}`, source);
        if (!active) return;
        setSvg(rendered.svg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Ошибка && err.message
            ? err.message
            : "Ошибка to render Mermaid diagram.";
        setОшибка(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  return (
    <div classИмя="paperclip-mermaid">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <>
          <p classИмя={cn("paperclip-mermaid-status", error && "paperclip-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram..."}
          </p>
          <pre classИмя="paperclip-mermaid-source">
            <code classИмя="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}

export function MarkdownBody({
  children,
  classИмя,
  style,
  softBreaks = true,
  linkЗадачаСсылки = true,
  enableWikiLinks = false,
  wikiLinkRoot,
  resolveWikiLinkHref,
  resolveImageSrc,
  onImageClick,
}: MarkdownBodyProps) {
  const { theme } = useTheme();
  const remarkPlugins: НетnNullable<Options["remarkPlugins"]> = [remarkGfm];
  if (enableWikiLinks) {
    remarkPlugins.push(createRemarkWikiLinks({ wikiLinkRoot, resolveWikiLinkHref }));
  }
  if (linkЗадачаСсылки) {
    remarkPlugins.push(remarkLinkЗадачаСсылки);
  }
  if (softBreaks) {
    remarkPlugins.push(remarkSoftBreaks);
  }
  const components: Components = {
    p: ({ node: _node, style: paragraphStyle, children: paragraphChildren, ...paragraphProps }) => (
      <p {...paragraphProps} style={mergeWrapStyle(paragraphStyle as React.CSSProperties | undefined)}>
        {paragraphChildren}
      </p>
    ),
    li: ({ node: _node, style: listItemStyle, children: listItemChildren, ...listItemProps }) => (
      <li {...listItemProps} style={mergeWrapStyle(listItemStyle as React.CSSProperties | undefined)}>
        {listItemChildren}
      </li>
    ),
    blockquote: ({ node: _node, style: blockquoteStyle, children: blockquoteChildren, ...blockquoteProps }) => (
      <blockquote {...blockquoteProps} style={mergeWrapStyle(blockquoteStyle as React.CSSProperties | undefined)}>
        {blockquoteChildren}
      </blockquote>
    ),
    table: ({ node: _node, style: tableStyle, children: tableChildren, ...tableProps }) => (
      <div classИмя="paperclip-markdown-table-scroll" role="region" aria-label="Scrollable table" tabIndex={0}>
        <table {...tableProps} style={tableStyle as React.CSSProperties | undefined}>
          {tableChildren}
        </table>
      </div>
    ),
    td: ({ node: _node, style: tableCellStyle, children: tableCellChildren, ...tableCellProps }) => (
      <td {...tableCellProps} style={mergeTableCellStyle(tableCellStyle as React.CSSProperties | undefined)}>
        {tableCellChildren}
      </td>
    ),
    th: ({ node: _node, style: tableHeaderStyle, children: tableHeaderChildren, ...tableHeaderProps }) => (
      <th {...tableHeaderProps} style={mergeTableCellStyle(tableHeaderStyle as React.CSSProperties | undefined)}>
        {tableHeaderChildren}
      </th>
    ),
    pre: ({ node: _node, children: preChildren, ...preProps }) => {
      const mermaidSource = extractMermaidSource(preChildren);
      if (mermaidSource) {
        return <MermaidDiagramBlock source={mermaidSource} darkMode={theme === "dark"} />;
      }
      return <CodeBlock preProps={preProps}>{preChildren}</CodeBlock>;
    },
    code: ({ node: _node, style: codeStyle, children: codeChildren, ...codeProps }) => (
      <code {...codeProps} style={mergeWrapStyle(codeStyle as React.CSSProperties | undefined)}>
        {codeChildren}
      </code>
    ),
    a: ({ node: _node, href, style: linkStyle, children: linkChildren, ...anchorProps }) => {
      const dataProps = anchorProps as Record<string, unknown>;
      const isWikiLink = dataProps["data-paperclip-wiki-link"] === "true";
      if (isWikiLink && href && !/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith("//")) {
        return (
          <Link
            to={href}
            {...anchorProps}
            rel="noreferrer"
            style={mergeWrapStyle(linkStyle as React.CSSProperties | undefined)}
          >
            {linkChildren}
          </Link>
        );
      }

      const issueRef = linkЗадачаСсылки ? parseЗадачаReferenceFromHref(href) : null;
      if (issueRef) {
        return (
          <MarkdownЗадачаLink issueПутьId={issueRef.issueПутьId}>
            {linkChildren}
          </MarkdownЗадачаLink>
        );
      }

      const parsed = href ? parseMentionChipHref(href) : null;
      if (parsed) {
        const targetHref = parsed.kind === "project"
          ? `/projects/${parsed.projectId}`
          : parsed.kind === "issue"
            ? `/issues/${parsed.identifier}`
          : parsed.kind === "skill"
            ? `/skills/${parsed.skillId}`
            : parsed.kind === "user"
              ? "/company/settings/access"
            : `/agents/${parsed.agentId}`;
        return (
          <a
            href={targetHref}
            classИмя={cn(
              "paperclip-mention-chip",
              `paperclip-mention-chip--${parsed.kind}`,
              parsed.kind === "project" && "paperclip-project-mention-chip",
            )}
            data-mention-kind={parsed.kind}
            style={{ ...mergeWrapStyle(linkStyle as React.CSSProperties | undefined), ...mentionChipInlineStyle(parsed) }}
          >
            {linkChildren}
          </a>
        );
      }
      const isGitHubLink = isGitHubUrl(href);
      const isExternal = isExternalHttpUrl(href);
      const leadingIcon = isGitHubLink ? (
        <Github aria-hidden="true" classИмя="mr-1 inline h-3.5 w-3.5 align-[-0.125em]" />
      ) : null;
      const trailingIcon = isExternal && !isGitHubLink ? (
        <ExternalLink aria-hidden="true" classИмя="ml-1 inline h-3 w-3 align-[-0.125em]" />
      ) : null;
      return (
        <a
          href={href}
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : { rel: "noreferrer" })}
          style={mergeWrapStyle(linkStyle as React.CSSProperties | undefined)}
        >
          {renderLinkBody(linkChildren, leadingIcon, trailingIcon)}
        </a>
      );
    },
  };
  if (resolveImageSrc || onImageClick) {
    components.img = ({ node: _node, src, alt, ...imgProps }) => {
      const resolved = resolveImageSrc && src ? resolveImageSrc(src) : null;
      const finalSrc = resolved ?? src;
      return (
        <img
          {...imgProps}
          src={finalSrc}
          alt={alt ?? ""}
          onClick={onImageClick && finalSrc ? (e) => { e.preventПо умолчанию(); onImageClick(finalSrc); } : undefined}
          style={onImageClick ? { cursor: "pointer", ...(imgProps.style as React.CSSProperties | undefined) } : imgProps.style as React.CSSProperties | undefined}
        />
      );
    };
  }

  return (
    <div
      classИмя={cn(
        "paperclip-markdown prose prose-sm min-w-0 max-w-full break-words overflow-hidden",
        theme === "dark" && "prose-invert",
        classИмя,
      )}
      style={mergeWrapStyle(style)}
    >
      <Markdown
        remarkPlugins={remarkPlugins}
        components={components}
        urlTransform={safeMarkdownUrlTransform}
      >
        {children}
      </Markdown>
    </div>
  );
}
