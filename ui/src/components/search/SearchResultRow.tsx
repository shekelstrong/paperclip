import { memo, type ComponentТип, type SVGProps } from "react";
import { Бот, FileText, Hexagon, MessageSquare, Quote } from "lucide-react";
import type { Агент, КомпанияПоискResult } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { СтатусIcon } from "../СтатусIcon";
import { Identity } from "../Identity";
import { ВысокийlightedText, type ВысокийlightedTextProps } from "./ВысокийlightedText";

type SnippetStyle = {
  Icon: ComponentТип<SVGProps<SVGSVGElement>>;
  label: string;
};

const SNIPPET_STYLES: Record<string, SnippetStyle> = {
  comment: { Icon: MessageSquare, label: "Comment" },
  document: { Icon: FileText, label: "Doc" },
  description: { Icon: Quote, label: "Описание" },
};

function snippetStyle(field: string, fallbackLabel: string): SnippetStyle {
  return SNIPPET_STYLES[field] ?? { Icon: Quote, label: fallbackLabel };
}

function formatRelativeTime(input: string | null): string {
  if (!input) return "";
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return "";
  const diffMs = Date.now() - value.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}

export interface ПоискResultRowProps {
  result: КомпанияПоискResult;
  agentsById?: ReadonlyMap<string, Pick<Агент, "id" | "name">>;
  isАктивен?: boolean;
  classИмя?: string;
}

const ROW_BASE =
  "group flex items-start gap-3 rounded-md px-3 transition-colors no-underline text-inherit hover:bg-muted/40";

function ПоискResultRowImpl({
  result,
  agentsById,
  isАктивен,
  classИмя,
}: ПоискResultRowProps) {
  if (result.type === "agent") {
    return (
      <Link
        to={result.href}
        classИмя={cn(ROW_BASE, "py-3", isАктивен && "bg-muted/40", classИмя)}
        data-result-type="agent"
      >
        <span classИмя="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Бот classИмя="h-3 w-3" />
        </span>
        <div classИмя="min-w-0 flex-1">
          <div classИмя="flex min-w-0 items-center gap-2">
            <span classИмя="truncate text-sm font-medium">{result.title}</span>
          </div>
          {result.snippet ? (
            <SnippetLine
              text={result.snippets[0]?.text ?? result.snippet}
              highlights={result.snippets[0]?.highlights}
              field="agent"
              fallbackLabel={result.sourceLabel ?? "Агент"}
            />
          ) : null}
        </div>
      </Link>
    );
  }

  if (result.type === "project") {
    return (
      <Link
        to={result.href}
        classИмя={cn(ROW_BASE, "py-3", isАктивен && "bg-muted/40", classИмя)}
        data-result-type="project"
      >
        <Hexagon classИмя="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div classИмя="min-w-0 flex-1">
          <span classИмя="truncate text-sm font-medium">{result.title}</span>
          {result.snippet ? (
            <SnippetLine
              text={result.snippets[0]?.text ?? result.snippet}
              highlights={result.snippets[0]?.highlights}
              field="project"
              fallbackLabel={result.sourceLabel ?? "Project"}
            />
          ) : null}
        </div>
      </Link>
    );
  }

  const issue = result.issue;
  if (!issue) return null;
  const assigneeИмя = issue.assigneeАгентId
    ? agentsById?.get(issue.assigneeАгентId)?.name ?? null
    : null;
  const updated = formatRelativeTime(result.updatedAt ?? issue.updatedAt);
  const titleВысокийlights = result.snippets.find((snippet) => snippet.field === "title")?.highlights;
  const bodySnippets = result.snippets.filter((snippet) => snippet.field !== "title").slice(0, 2);
  const previewImageUrl = result.previewImageUrl;
  const hasRightRail = previewImageUrl || assigneeИмя || updated;

  return (
    <Link
      to={result.href}
      disableЗадачаQuicklook
      classИмя={cn(ROW_BASE, "py-4", isАктивен && "bg-muted/40", classИмя)}
      data-result-type="issue"
    >
      <div classИмя="mt-1 shrink-0">
        <СтатусIcon status={issue.status} />
      </div>
      <div classИмя="min-w-0 flex-1">
        <div classИмя="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {issue.identifier ? (
            <span classИмя="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {issue.identifier}
            </span>
          ) : null}
          <ВысокийlightedText
            text={issue.title}
            highlights={titleВысокийlights}
            classИмя="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground"
          />
        </div>
        {bodySnippets.map((snippet, index) => (
          <SnippetLine
            key={`${snippet.field}-${index}`}
            text={snippet.text}
            highlights={snippet.highlights}
            field={snippet.field}
            fallbackLabel={snippet.label}
            multiline
          />
        ))}
        {hasRightRail ? (
          <div classИмя="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
            {assigneeИмя ? <span classИмя="truncate">{assigneeИмя}</span> : null}
            {updated ? <span classИмя="ml-auto tabular-nums">{updated}</span> : null}
          </div>
        ) : null}
      </div>
      {hasRightRail ? (
        <div classИмя="ml-2 hidden shrink-0 flex-col items-end gap-2 sm:flex">
          {assigneeИмя || updated ? (
            <div classИмя="flex items-center gap-2 text-xs text-muted-foreground">
              {assigneeИмя ? <Identity name={assigneeИмя} size="sm" /> : null}
              {updated ? <span classИмя="tabular-nums">{updated}</span> : null}
            </div>
          ) : null}
          {previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              classИмя="h-[88px] w-[88px] shrink-0 rounded-md border border-border bg-muted object-cover"
            />
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

export const ПоискResultRow = memo(ПоискResultRowImpl);

interface SnippetLineProps {
  text: string;
  highlights?: ВысокийlightedTextProps["highlights"];
  field: string;
  fallbackLabel: string;
  multiline?: boolean;
}

function SnippetLine({ text, highlights, field, fallbackLabel, multiline = false }: SnippetLineProps) {
  const { Icon, label } = snippetStyle(field, fallbackLabel);
  return (
    <div
      classИмя={cn(
        "mt-2.5 flex min-w-0 gap-1.5 text-xs text-muted-foreground",
        multiline ? "items-start" : "items-center",
      )}
    >
      <Icon
        classИмя={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/60", multiline && "mt-0.5")}
        aria-hidden
      />
      <span classИмя="sr-only">{label}: </span>
      <ВысокийlightedText
        text={text}
        highlights={highlights}
        classИмя={multiline ? "line-clamp-2 leading-relaxed" : "line-clamp-1 truncate"}
      />
    </div>
  );
}
