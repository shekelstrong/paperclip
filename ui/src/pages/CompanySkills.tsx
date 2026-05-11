import { useEffect, useMemo, useState, type SVGProps } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  КомпанияНавыкСоздатьRequest,
  КомпанияНавыкDetail,
  КомпанияНавыкFileDetail,
  КомпанияНавыкFileInventoryEntry,
  КомпанияНавыкListItem,
  КомпанияНавыкProjectScanResult,
  КомпанияНавыкSourceBadge,
  КомпанияНавыкОбновитьСтатус,
} from "@paperclipai/shared";
import { companyНавыкиApi } from "../api/companyНавыки";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import { queryКлючs } from "../lib/queryКлючs";
import { EmptyState } from "../components/EmptyState";
import { MarkdownBody } from "../components/MarkdownBody";
import { MarkdownИзменитьor } from "../components/MarkdownИзменитьor";
import { PageSkeleton } from "../components/PageSkeleton";
import { КопироватьText } from "../components/КопироватьText";
import { Identity } from "../components/Identity";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  FileText,
  Папка,
  ПапкаOpen,
  Github,
  Link2,
  ExternalLink,
  Paperclip,
  Pencil,
  Plus,
  Копировать,
  ОбновитьCw,
  Сохранить,
  Поиск,
  Trash2,
} from "lucide-react";

type НавыкTreeНетde = {
  name: string;
  path: string | null;
  kind: "dir" | "file";
  fileKind?: КомпанияНавыкFileInventoryEntry["kind"];
  children: НавыкTreeНетde[];
};

const SKILL_TREE_BASE_INDENT = 16;
const SKILL_TREE_STEP_INDENT = 24;
const SKILL_TREE_ROW_HEIGHT_CLASS = "min-h-9";

function VercelMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 4 21 19H3z" />
    </svg>
  );
}

function stripFrontmatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return normalized.trim();
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) return normalized.trim();
  return normalized.slice(closing + 5).trim();
}

function splitFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: null, body: normalized };
  }
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) {
    return { frontmatter: null, body: normalized };
  }
  return {
    frontmatter: normalized.slice(4, closing).trim(),
    body: normalized.slice(closing + 5).trimНачать(),
  };
}

function mergeFrontmatter(markdown: string, body: string) {
  const parsed = splitFrontmatter(markdown);
  if (!parsed.frontmatter) return body;
  return ["---", parsed.frontmatter, "---", "", body].join("\n");
}

function buildTree(entries: КомпанияНавыкFileInventoryEntry[]) {
  const root: НавыкTreeНетde = { name: "", path: null, kind: "dir", children: [] };

  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);
    let current = root;
    let currentПуть = "";
    for (const [index, segment] of segments.entries()) {
      currentПуть = currentПуть ? `${currentПуть}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      let next = current.children.find((child) => child.name === segment);
      if (!next) {
        next = {
          name: segment,
          path: isLeaf ? entry.path : currentПуть,
          kind: isLeaf ? "file" : "dir",
          fileKind: isLeaf ? entry.kind : undefined,
          children: [],
        };
        current.children.push(next);
      }
      current = next;
    }
  }

  function sortНетde(node: НавыкTreeНетde) {
    node.children.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
      if (left.name === "SKILL.md") return -1;
      if (right.name === "SKILL.md") return 1;
      return left.name.localeCompare(right.name);
    });
    node.children.forEach(sortНетde);
  }

  sortНетde(root);
  return root.children;
}

function sourceMeta(sourceBadge: КомпанияНавыкSourceBadge, sourceLabel: string | null) {
  const normalizedLabel = sourceLabel?.toНизкийerCase() ?? "";
  const isНавыкиShManaged =
    normalizedLabel.includes("skills.sh") || normalizedLabel.includes("vercel-labs/skills");

  switch (sourceBadge) {
    case "skills_sh":
      return { icon: VercelMark, label: sourceLabel ?? "skills.sh", managedLabel: "skills.sh managed" };
    case "github":
      return isНавыкиShManaged
        ? { icon: VercelMark, label: sourceLabel ?? "skills.sh", managedLabel: "skills.sh managed" }
        : { icon: Github, label: sourceLabel ?? "GitHub", managedLabel: "GitHub managed" };
    case "url":
      return { icon: Link2, label: sourceLabel ?? "URL", managedLabel: "URL managed" };
    case "local":
      return { icon: Папка, label: sourceLabel ?? "Папка", managedLabel: "Папка managed" };
    case "paperclip":
      return { icon: Paperclip, label: sourceLabel ?? "Paperclip", managedLabel: "Paperclip managed" };
    default:
      return { icon: Boxes, label: sourceLabel ?? "Catalog", managedLabel: "Catalog managed" };
  }
}

function shortRef(ref: string | null | undefined) {
  if (!ref) return null;
  return ref.slice(0, 7);
}

function middleTruncate(value: string, maxLength = 72) {
  if (value.length <= maxLength) return value;
  const edgeLength = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, edgeLength)}...${value.slice(value.length - edgeLength)}`;
}

function formatProjectScanSummary(result: КомпанияНавыкProjectScanResult) {
  const parts = [
    `${result.discovered} found`,
    `${result.imported.length} imported`,
    `${result.updated.length} updated`,
  ];
  if (result.conflicts.length > 0) parts.push(`${result.conflicts.length} conflicts`);
  if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
  return `${parts.join(", ")} across ${result.scannedРабочие области} workspace${result.scannedРабочие области === 1 ? "" : "s"}.`;
}

function fileIcon(kind: КомпанияНавыкFileInventoryEntry["kind"]) {
  if (kind === "script" || kind === "reference") return FileCode2;
  return FileText;
}

function encodeНавыкFileПуть(fileПуть: string) {
  return fileПуть.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function decodeНавыкFileПуть(fileПуть: string | undefined) {
  if (!fileПуть) return "SKILL.md";
  return fileПуть
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function parseНавыкRoute(routeПуть: string | undefined) {
  const segments = (routeПуть ?? "").split("/").filter(Boolean);
  if (segments.length === 0) {
    return { skillId: null, fileПуть: "SKILL.md" };
  }

  const [rawНавыкId, rawMode, ...rest] = segments;
  const skillId = rawНавыкId ? decodeURIComponent(rawНавыкId) : null;
  if (!skillId) {
    return { skillId: null, fileПуть: "SKILL.md" };
  }

  if (rawMode === "files") {
    return {
      skillId,
      fileПуть: decodeНавыкFileПуть(rest.join("/")),
    };
  }

  return { skillId, fileПуть: "SKILL.md" };
}

function skillRoute(skillId: string, fileПуть?: string | null) {
  return fileПуть ? `/skills/${skillId}/files/${encodeНавыкFileПуть(fileПуть)}` : `/skills/${skillId}`;
}

function parentDirectoryПутьs(fileПуть: string) {
  const segments = fileПуть.split("/").filter(Boolean);
  const parents: string[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    parents.push(segments.slice(0, index + 1).join("/"));
  }
  return parents;
}

function NewНавыкForm({
  onСоздать,
  isОжидание,
  onОтмена,
}: {
  onСоздать: (payload: КомпанияНавыкСоздатьRequest) => void;
  isОжидание: boolean;
  onОтмена: () => void;
}) {
  const [name, setИмя] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setОписание] = useState("");

  return (
    <div classИмя="border-b border-border px-4 py-4">
      <div classИмя="space-y-3">
        <Input
          value={name}
          onChange={(event) => setИмя(event.target.value)}
          placeholder="Название навыка"
          classИмя="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="optional-shortname"
          classИмя="h-9 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <Textarea
          value={description}
          onChange={(event) => setОписание(event.target.value)}
          placeholder="Short description"
          classИмя="min-h-20 rounded-none border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
        />
        <div classИмя="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onОтмена} disabled={isОжидание}>
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={() => onСоздать({ name, slug: slug || null, description: description || null })}
            disabled={isОжидание || name.trim().length === 0}
          >
            {isОжидание ? "Creating..." : "Создать навык"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function НавыкTree({
  nodes,
  skillId,
  selectedПуть,
  expandedDirs,
  onToggleDir,
  onSelectПуть,
  depth = 0,
}: {
  nodes: НавыкTreeНетde[];
  skillId: string;
  selectedПуть: string;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectПуть: (path: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => {
        const expanded = node.kind === "dir" && node.path ? expandedDirs.has(node.path) : false;
        if (node.kind === "dir") {
          return (
            <div key={node.path ?? node.name}>
              <div
                classИмя={cn(
                  "group grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  SKILL_TREE_ROW_HEIGHT_CLASS,
                )}
              >
                <button
                  type="button"
                  classИмя="flex min-w-0 items-center gap-2 py-1 text-left"
                  style={{ paddingLeft: `${SKILL_TREE_BASE_INDENT + depth * SKILL_TREE_STEP_INDENT}px` }}
                  onClick={() => node.path && onToggleDir(node.path)}
                >
                  <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center">
                    {expanded ? <ПапкаOpen classИмя="h-3.5 w-3.5" /> : <Папка classИмя="h-3.5 w-3.5" />}
                  </span>
                  <span classИмя="truncate">{node.name}</span>
                </button>
                <button
                  type="button"
                  classИмя="flex h-9 w-9 items-center justify-center self-center rounded-sm text-muted-foreground opacity-70 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  onClick={() => node.path && onToggleDir(node.path)}
                >
                  {expanded ? <ChevronDown classИмя="h-3.5 w-3.5" /> : <ChevronRight classИмя="h-3.5 w-3.5" />}
                </button>
              </div>
              {expanded && (
                <НавыкTree
                  nodes={node.children}
                  skillId={skillId}
                  selectedПуть={selectedПуть}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  onSelectПуть={onSelectПуть}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        const FileIcon = fileIcon(node.fileKind ?? "other");
        return (
          <Link
            key={node.path ?? node.name}
            classИмя={cn(
              "flex w-full items-center gap-2 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              SKILL_TREE_ROW_HEIGHT_CLASS,
              node.path === selectedПуть && "text-foreground",
            )}
            style={{ paddingInlineНачать: `${SKILL_TREE_BASE_INDENT + depth * SKILL_TREE_STEP_INDENT}px` }}
            to={skillRoute(skillId, node.path)}
            onClick={() => node.path && onSelectПуть(node.path)}
          >
            <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center">
              <FileIcon classИмя="h-3.5 w-3.5" />
            </span>
            <span classИмя="truncate">{node.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

function НавыкList({
  skills,
  selectedНавыкId,
  skillФильтр,
  expandedНавыкId,
  expandedDirs,
  selectedПутьs,
  onToggleНавык,
  onToggleDir,
  onSelectНавык,
  onSelectПуть,
}: {
  skills: КомпанияНавыкListItem[];
  selectedНавыкId: string | null;
  skillФильтр: string;
  expandedНавыкId: string | null;
  expandedDirs: Record<string, Set<string>>;
  selectedПутьs: Record<string, string>;
  onToggleНавык: (skillId: string) => void;
  onToggleDir: (skillId: string, path: string) => void;
  onSelectНавык: (skillId: string) => void;
  onSelectПуть: (skillId: string, path: string) => void;
}) {
  const filteredНавыки = skills.filter((skill) => {
    const haystack = `${skill.name} ${skill.key} ${skill.slug} ${skill.sourceLabel ?? ""}`.toНизкийerCase();
    return haystack.includes(skillФильтр.toНизкийerCase());
  });

  if (filteredНавыки.length === 0) {
    return (
      <div classИмя="px-4 py-6 text-sm text-muted-foreground">
        Нет skills match this filter.
      </div>
    );
  }

  return (
    <div>
      {filteredНавыки.map((skill) => {
        const expanded = expandedНавыкId === skill.id;
        const tree = buildTree(skill.fileInventory);
        const source = sourceMeta(skill.sourceBadge, skill.sourceLabel);
        const SourceIcon = source.icon;

        return (
          <div key={skill.id} classИмя="border-b border-border">
            <div
              classИмя={cn(
                "group grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 px-3 py-1.5 hover:bg-accent/30",
                skill.id === selectedНавыкId && "text-foreground",
              )}
            >
              <Link
                to={skillRoute(skill.id)}
                classИмя="flex min-w-0 items-center self-stretch pr-2 text-left no-underline"
                onClick={() => onSelectНавык(skill.id)}
              >
                <span classИмя="flex min-w-0 items-center gap-2 self-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground opacity-75 transition-opacity group-hover:opacity-100">
                        <SourceIcon classИмя="h-3.5 w-3.5" />
                        <span classИмя="sr-only">{source.managedLabel}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{source.managedLabel}</TooltipContent>
                  </Tooltip>
                  <span classИмя="min-w-0 overflow-hidden text-[13px] font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                    {skill.name}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                classИмя="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-sm text-muted-foreground opacity-80 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100"
                onClick={() => onToggleНавык(skill.id)}
                aria-label={expanded ? `Collapse ${skill.name}` : `Expand ${skill.name}`}
              >
                {expanded ? <ChevronDown classИмя="h-3.5 w-3.5" /> : <ChevronRight classИмя="h-3.5 w-3.5" />}
              </button>
            </div>
            <div
              aria-hidden={!expanded}
              classИмя={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div classИмя="min-h-0 overflow-hidden">
                <НавыкTree
                  nodes={tree}
                  skillId={skill.id}
                  selectedПуть={selectedПутьs[skill.id] ?? "SKILL.md"}
                  expandedDirs={expandedDirs[skill.id] ?? new Set<string>()}
                  onToggleDir={(path) => onToggleDir(skill.id, path)}
                  onSelectПуть={(path) => onSelectПуть(skill.id, path)}
                  depth={1}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function НавыкPane({
  loading,
  detail,
  file,
  fileЗагрузка,
  updateСтатус,
  updateСтатусЗагрузка,
  viewMode,
  editMode,
  draft,
  setViewMode,
  setИзменитьMode,
  setЧерновик,
  onCheckОбновитьs,
  checkОбновитьsОжидание,
  onInstallОбновить,
  installОбновитьОжидание,
  onУдалить,
  deleteОжидание,
  onСохранить,
  saveОжидание,
}: {
  loading: boolean;
  detail: КомпанияНавыкDetail | null | undefined;
  file: КомпанияНавыкFileDetail | null | undefined;
  fileЗагрузка: boolean;
  updateСтатус: КомпанияНавыкОбновитьСтатус | null | undefined;
  updateСтатусЗагрузка: boolean;
  viewMode: "preview" | "code";
  editMode: boolean;
  draft: string;
  setViewMode: (mode: "preview" | "code") => void;
  setИзменитьMode: (value: boolean) => void;
  setЧерновик: (value: string) => void;
  onCheckОбновитьs: () => void;
  checkОбновитьsОжидание: boolean;
  onInstallОбновить: () => void;
  installОбновитьОжидание: boolean;
  onУдалить: () => void;
  deleteОжидание: boolean;
  onСохранить: () => void;
  saveОжидание: boolean;
}) {
  if (!detail) {
    if (loading) {
      return <PageSkeleton variant="detail" />;
    }
    return (
      <EmptyState
        icon={Boxes}
        message="Select a skill to inspect its files."
      />
    );
  }

  const source = sourceMeta(detail.sourceBadge, detail.sourceLabel);
  const SourceIcon = source.icon;
  const usedBy = detail.usedByАгенты;
  const body = file?.markdown ? stripFrontmatter(file.content) : file?.content ?? "";
  const currentPin = shortRef(detail.sourceRef);
  const latestPin = shortRef(updateСтатус?.latestRef);
  const displaySourceПуть = detail.sourceПуть ? middleTruncate(detail.sourceПуть) : null;
  const removeЗаблокирован = usedBy.length > 0;
  const removeОтключитьdReason = removeЗаблокирован
    ? "Detach this skill from all agents before removing it."
    : null;

  return (
    <div classИмя="min-w-0">
      <div classИмя="border-b border-border px-5 py-4">
        <div classИмя="flex flex-wrap items-start justify-between gap-4">
          <div classИмя="min-w-0">
            <h1 classИмя="flex items-center gap-2 truncate text-2xl font-semibold">
              <SourceIcon classИмя="h-5 w-5 shrink-0 text-muted-foreground" />
              {detail.name}
            </h1>
            {detail.description && (
              <p classИмя="mt-2 max-w-3xl text-sm text-muted-foreground">{detail.description}</p>
            )}
          </div>
          <div classИмя="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onУдалить}
              disabled={deleteОжидание}
              title={removeОтключитьdReason ?? undefined}
            >
              <Trash2 classИмя="mr-1.5 h-3.5 w-3.5" />
              {deleteОжидание ? "Removing..." : "Удалить"}
            </Button>
            {detail.editable ? (
              <button
                classИмя="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setИзменитьMode(!editMode)}
              >
                <Pencil classИмя="h-3.5 w-3.5" />
                {editMode ? "Остановить editing" : "Изменить"}
              </button>
            ) : (
              <div classИмя="text-sm text-muted-foreground">{detail.editableReason}</div>
            )}
          </div>
        </div>

        <div classИмя="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <div classИмя="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div classИмя="flex min-w-0 items-center gap-2">
              <span classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source</span>
              <span classИмя="flex min-w-0 items-center gap-2">
                <SourceIcon classИмя="h-3.5 w-3.5 text-muted-foreground" />
                {detail.sourceПуть && displaySourceПуть ? (
                  <>
                    <span
                      classИмя="block min-w-0 max-w-[min(34rem,55vw)] truncate font-mono text-xs text-muted-foreground"
                      title={detail.sourceПуть}
                    >
                      {displaySourceПуть}
                    </span>
                    <КопироватьText
                      text={detail.sourceПуть}
                      copiedLabel="Copied path"
                      ariaLabel="Копировать source path"
                      title="Копировать source path"
                      classИмя="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Копировать classИмя="h-3.5 w-3.5" />
                    </КопироватьText>
                  </>
                ) : (
                  <span classИмя="truncate">{source.label}</span>
                )}
              </span>
            </div>
            {detail.sourceТип === "github" && (
              <div classИмя="flex flex-wrap items-center gap-2">
                <span classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pin</span>
                <span classИмя="font-mono text-xs">{currentPin ?? "untracked"}</span>
                {updateСтатус?.trackingRef && (
                  <span classИмя="text-xs text-muted-foreground">tracking {updateСтатус.trackingRef}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCheckОбновитьs}
                  disabled={checkОбновитьsОжидание || updateСтатусЗагрузка}
                >
                  <ОбновитьCw classИмя={cn("mr-1.5 h-3.5 w-3.5", (checkОбновитьsОжидание || updateСтатусЗагрузка) && "animate-spin")} />
                  Check for updates
                </Button>
                {updateСтатус?.supported && updateСтатус.hasОбновить && (
                  <Button
                    size="sm"
                    onClick={onInstallОбновить}
                    disabled={installОбновитьОжидание}
                  >
                    <ОбновитьCw classИмя={cn("mr-1.5 h-3.5 w-3.5", installОбновитьОжидание && "animate-spin")} />
                    Install update{latestPin ? ` ${latestPin}` : ""}
                  </Button>
                )}
                {updateСтатус?.supported && !updateСтатус.hasОбновить && !updateСтатусЗагрузка && (
                  <span classИмя="text-xs text-muted-foreground">Up to date</span>
                )}
                {!updateСтатус?.supported && updateСтатус?.reason && (
                  <span classИмя="text-xs text-muted-foreground">{updateСтатус.reason}</span>
                )}
              </div>
            )}
            <div classИмя="flex items-center gap-2">
              <span classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ключ</span>
              <span classИмя="font-mono text-xs">{detail.key}</span>
            </div>
            <div classИмя="flex items-center gap-2">
              <span classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</span>
              <span>{detail.editable ? "Изменитьable" : "Read only"}</span>
            </div>
          </div>
          <div classИмя="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Used by</span>
            {usedBy.length === 0 ? (
              <span classИмя="text-muted-foreground">Нет agents attached</span>
            ) : (
              <div classИмя="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {usedBy.map((agent) => (
                  <Link
                    key={agent.id}
                    to={`/agents/${agent.urlКлюч}/skills`}
                    classИмя="group rounded-md border border-transparent p-2 no-underline hover:border-border hover:bg-accent/40"
                  >
                    <Identity name={agent.name} size="sm" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div classИмя="border-b border-border px-5 py-3">
        <div classИмя="flex flex-wrap items-center justify-between gap-3">
          <div classИмя="min-w-0">
            <div classИмя="truncate font-mono text-sm">{file?.path ?? "SKILL.md"}</div>
          </div>
          <div classИмя="flex items-center gap-2">
            {file?.markdown && !editMode && (
              <div classИмя="flex items-center border border-border">
                <button
                  classИмя={cn("px-3 py-1.5 text-sm", viewMode === "preview" && "text-foreground", viewMode !== "preview" && "text-muted-foreground")}
                  onClick={() => setViewMode("preview")}
                >
                  <span classИмя="flex items-center gap-1.5">
                    <Eye classИмя="h-3.5 w-3.5" />
                    View
                  </span>
                </button>
                <button
                  classИмя={cn("border-l border-border px-3 py-1.5 text-sm", viewMode === "code" && "text-foreground", viewMode !== "code" && "text-muted-foreground")}
                  onClick={() => setViewMode("code")}
                >
                  <span classИмя="flex items-center gap-1.5">
                    <Code2 classИмя="h-3.5 w-3.5" />
                    Code
                  </span>
                </button>
              </div>
            )}
            {editMode && file?.editable && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setИзменитьMode(false)} disabled={saveОжидание}>
                  Отмена
                </Button>
                <Button size="sm" onClick={onСохранить} disabled={saveОжидание}>
                  <Сохранить classИмя="mr-1.5 h-3.5 w-3.5" />
                  {saveОжидание ? "Saving..." : "Сохранить"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div classИмя="min-h-[560px] px-5 py-5">
        {fileЗагрузка ? (
          <PageSkeleton variant="detail" />
        ) : !file ? (
          <div classИмя="text-sm text-muted-foreground">Select a file to inspect.</div>
        ) : editMode && file.editable ? (
          file.markdown ? (
            <MarkdownИзменитьor
              value={draft}
              onChange={setЧерновик}
              bordered={false}
              classИмя="min-h-[520px]"
            />
          ) : (
            <Textarea
              value={draft}
              onChange={(event) => setЧерновик(event.target.value)}
              classИмя="min-h-[520px] rounded-none border-0 bg-transparent px-0 py-0 font-mono text-sm shadow-none focus-visible:ring-0"
            />
          )
        ) : file.markdown && viewMode === "preview" ? (
          <MarkdownBody softBreaks={false} linkЗадачаСсылки={false}>{body}</MarkdownBody>
        ) : (
          <pre classИмя="overflow-x-auto whitespace-pre-wrap wrap-break-word border-0 bg-transparent p-0 font-mono text-sm text-foreground">
            <code>{file.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export function КомпанияНавыки() {
  const { "*": routeПуть } = useParams<{ "*": string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const [skillФильтр, setНавыкФильтр] = useState("");
  const [source, setSource] = useState("");
  const [createOpen, setСоздатьOpen] = useState(false);
  const [emptySourceHelpOpen, setEmptySourceHelpOpen] = useState(false);
  const [expandedНавыкId, setExpandedНавыкId] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, Set<string>>>({});
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [editMode, setИзменитьMode] = useState(false);
  const [draft, setЧерновик] = useState("");
  const [displayedDetail, setDisplayedDetail] = useState<КомпанияНавыкDetail | null>(null);
  const [displayedFile, setDisplayedFile] = useState<КомпанияНавыкFileDetail | null>(null);
  const [scanСтатусMessage, setScanСтатусMessage] = useState<string | null>(null);
  const [deleteOpen, setУдалитьOpen] = useState(false);
  const [deleteЦельНавыкId, setУдалитьЦельНавыкId] = useState<string | null>(null);
  const [deleteЦельDetail, setУдалитьЦельDetail] = useState<КомпанияНавыкDetail | null>(null);
  const parsedRoute = useMemo(() => parseНавыкRoute(routeПуть), [routeПуть]);
  const routeНавыкId = parsedRoute.skillId;
  const selectedПуть = parsedRoute.fileПуть;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Навыки", href: "/skills" },
      ...(routeНавыкId ? [{ label: "Detail" }] : []),
    ]);
  }, [routeНавыкId, setBreadcrumbs]);

  const skillsQuery = useQuery({
    queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId ?? ""),
    queryFn: () => companyНавыкиApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const selectedНавыкId = useMemo(() => {
    if (!routeНавыкId) return skillsQuery.data?.[0]?.id ?? null;
    return routeНавыкId;
  }, [routeНавыкId, skillsQuery.data]);

  useEffect(() => {
    if (routeНавыкId || !selectedНавыкId) return;
    navigate(skillRoute(selectedНавыкId), { replace: true });
  }, [navigate, routeНавыкId, selectedНавыкId]);

  const detailQuery = useQuery({
    queryКлюч: queryКлючs.companyНавыки.detail(selectedКомпанияId ?? "", selectedНавыкId ?? ""),
    queryFn: () => companyНавыкиApi.detail(selectedКомпанияId!, selectedНавыкId!),
    enabled: Boolean(selectedКомпанияId && selectedНавыкId),
  });

  const fileQuery = useQuery({
    queryКлюч: queryКлючs.companyНавыки.file(selectedКомпанияId ?? "", selectedНавыкId ?? "", selectedПуть),
    queryFn: () => companyНавыкиApi.file(selectedКомпанияId!, selectedНавыкId!, selectedПуть),
    enabled: Boolean(selectedКомпанияId && selectedНавыкId && selectedПуть),
  });

  const updateСтатусQuery = useQuery({
    queryКлюч: queryКлючs.companyНавыки.updateСтатус(selectedКомпанияId ?? "", selectedНавыкId ?? ""),
    queryFn: () => companyНавыкиApi.updateСтатус(selectedКомпанияId!, selectedНавыкId!),
    enabled: Boolean(
      selectedКомпанияId
      && selectedНавыкId
      && (detailQuery.data?.sourceТип === "github" || displayedDetail?.sourceТип === "github"),
    ),
    staleTime: 60_000,
  });

  useEffect(() => {
    setExpandedНавыкId(selectedНавыкId);
  }, [selectedНавыкId]);

  useEffect(() => {
    if (!selectedНавыкId || selectedПуть === "SKILL.md") return;
    const parents = parentDirectoryПутьs(selectedПуть);
    if (parents.length === 0) return;
    setExpandedDirs((current) => {
      const next = new Set(current[selectedНавыкId] ?? []);
      let changed = false;
      for (const parent of parents) {
        if (!next.has(parent)) {
          next.add(parent);
          changed = true;
        }
      }
      return changed ? { ...current, [selectedНавыкId]: next } : current;
    });
  }, [selectedПуть, selectedНавыкId]);

  useEffect(() => {
    setИзменитьMode(false);
  }, [selectedНавыкId, selectedПуть]);

  useEffect(() => {
    if (detailQuery.data) {
      setDisplayedDetail(detailQuery.data);
    }
  }, [detailQuery.data]);

  useEffect(() => {
    if (fileQuery.data) {
      setDisplayedFile(fileQuery.data);
      setЧерновик(fileQuery.data.markdown ? splitFrontmatter(fileQuery.data.content).body : fileQuery.data.content);
    }
  }, [fileQuery.data]);

  useEffect(() => {
    if (selectedНавыкId) return;
    setDisplayedDetail(null);
    setDisplayedFile(null);
  }, [selectedНавыкId]);

  const activeDetail = detailQuery.data ?? displayedDetail;
  const activeFile = fileQuery.data ?? displayedFile;

  function openУдалитьDialog() {
    setУдалитьЦельНавыкId(selectedНавыкId);
    setУдалитьЦельDetail(activeDetail ?? null);
    setУдалитьOpen(true);
  }

  function closeУдалитьDialog(open: boolean) {
    setУдалитьOpen(open);
    if (!open) {
      setУдалитьЦельНавыкId(null);
      setУдалитьЦельDetail(null);
    }
  }

  const importНавык = useMutation({
    mutationFn: (importSource: string) => companyНавыкиApi.importFromSource(selectedКомпанияId!, importSource),
    onУспешно: async (result) => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) });
      if (result.imported[0]) navigate(skillRoute(result.imported[0].id));
      pushToast({
        tone: "success",
        title: "Навыки imported",
        body: `${result.imported.length} skill${result.imported.length === 1 ? "" : "s"} added.`,
      });
      if (result.warnings[0]) {
        pushToast({ tone: "warn", title: "Импорт warnings", body: result.warnings[0] });
      }
      setSource("");
    },
    onОшибка: (error) => {
      pushToast({
        tone: "error",
        title: "Ошибка импорта навыка",
        body: error instanceof Ошибка ? error.message : "Ошибка to import skill source.",
      });
    },
  });

  const createНавык = useMutation({
    mutationFn: (payload: КомпанияНавыкСоздатьRequest) => companyНавыкиApi.create(selectedКомпанияId!, payload),
    onУспешно: async (skill) => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) });
      navigate(skillRoute(skill.id));
      setСоздатьOpen(false);
      pushToast({
        tone: "success",
        title: "Навык создан",
        body: `${skill.name} is now editable in the Paperclip workspace.`,
      });
    },
    onОшибка: (error) => {
      pushToast({
        tone: "error",
        title: "Ошибка создания навыка",
        body: error instanceof Ошибка ? error.message : "Ошибка to create skill.",
      });
    },
  });

  const scanПроекты = useMutation({
    mutationFn: () => companyНавыкиApi.scanПроекты(selectedКомпанияId!),
    onMutate: () => {
      setScanСтатусMessage("Scanning project workspaces for skills...");
    },
    onУспешно: async (result) => {
      setScanСтатусMessage("Обновитьing skills list...");
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) });
      const summary = formatProjectScanSummary(result);
      setScanСтатусMessage(summary);
      pushToast({
        tone: "success",
        title: "Project skill scan complete",
        body: summary,
      });
      if (result.conflicts[0]) {
        pushToast({
          tone: "warn",
          title: "Навык conflicts found",
          body: result.conflicts[0].reason,
        });
      } else if (result.warnings[0]) {
        pushToast({
          tone: "warn",
          title: "Scan warnings",
          body: result.warnings[0],
        });
      }
    },
    onОшибка: (error) => {
      setScanСтатусMessage(null);
      pushToast({
        tone: "error",
        title: "Project skill scan failed",
        body: error instanceof Ошибка ? error.message : "Ошибка to scan project workspaces.",
      });
    },
  });

  const saveFile = useMutation({
    mutationFn: () => companyНавыкиApi.updateFile(
      selectedКомпанияId!,
      selectedНавыкId!,
      selectedПуть,
      activeFile?.markdown ? mergeFrontmatter(activeFile.content, draft) : draft,
    ),
    onУспешно: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.detail(selectedКомпанияId!, selectedНавыкId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.file(selectedКомпанияId!, selectedНавыкId!, selectedПуть) }),
      ]);
      setЧерновик(result.markdown ? splitFrontmatter(result.content).body : result.content);
      setИзменитьMode(false);
      pushToast({
        tone: "success",
        title: "Навык сохранён",
        body: result.path,
      });
    },
    onОшибка: (error) => {
      pushToast({
        tone: "error",
        title: "Ошибка сохранения",
        body: error instanceof Ошибка ? error.message : "Ошибка to save skill file.",
      });
    },
  });

  const installОбновить = useMutation({
    mutationFn: () => companyНавыкиApi.installОбновить(selectedКомпанияId!, selectedНавыкId!),
    onУспешно: async (skill) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.detail(selectedКомпанияId!, selectedНавыкId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.updateСтатус(selectedКомпанияId!, selectedНавыкId!) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.file(selectedКомпанияId!, selectedНавыкId!, selectedПуть) }),
      ]);
      navigate(skillRoute(skill.id, selectedПуть));
      pushToast({
        tone: "success",
        title: "Навык обновлён",
        body: skill.sourceRef ? `Pinned to ${shortRef(skill.sourceRef)}` : skill.name,
      });
    },
    onОшибка: (error) => {
      pushToast({
        tone: "error",
        title: "Ошибка обновления",
        body: error instanceof Ошибка ? error.message : "Ошибка to install skill update.",
      });
    },
  });

  const deleteНавык = useMutation({
    mutationFn: () => companyНавыкиApi.delete(selectedКомпанияId!, deleteЦельНавыкId!),
    onУспешно: async (skill) => {
      closeУдалитьDialog(false);
      setDisplayedDetail(null);
      setDisplayedFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!) }),
        ...(deleteЦельНавыкId ? [
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.detail(selectedКомпанияId!, deleteЦельНавыкId) }),
          queryClient.invalidateQueries({ queryКлюч: queryКлючs.companyНавыки.updateСтатус(selectedКомпанияId!, deleteЦельНавыкId) }),
        ] : []),
        ...(deleteЦельНавыкId ? [
          queryClient.invalidateQueries({
            queryКлюч: queryКлючs.companyНавыки.file(selectedКомпанияId!, deleteЦельНавыкId, selectedПуть),
          }),
        ] : []),
      ]);
      await queryClient.refetchQueries({
        queryКлюч: queryКлючs.companyНавыки.list(selectedКомпанияId!),
        type: "active",
      });
      navigate("/skills", { replace: true });
      pushToast({
        tone: "success",
        title: "Навык удалён",
        body: `${skill.name} was removed from the company skill library.`,
      });
    },
    onОшибка: (error) => {
      pushToast({
        tone: "error",
        title: "Удалить failed",
        body: error instanceof Ошибка ? error.message : "Ошибка to remove skill.",
      });
    },
  });

  if (!selectedКомпанияId) {
    return <EmptyState icon={Boxes} message="Select a company to manage skills." />;
  }

  function handleДобавитьНавыкSource() {
    const trimmedSource = source.trim();
    if (trimmedSource.length === 0) {
      setEmptySourceHelpOpen(true);
      return;
    }
    importНавык.mutate(trimmedSource);
  }

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={closeУдалитьDialog}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>Удалить навык</DialogНазвание>
            <DialogОписание>
              Удалить this skill from the company library. If any agents still use it, removal will be blocked until it is detached.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-3 text-sm">
            <p>
              {deleteЦельDetail
                ? `You are about to remove ${deleteЦельDetail.name}.`
                : "You are about to remove this skill."}
            </p>
            {deleteЦельDetail?.usedByАгенты?.length ? (
              <div classИмя="rounded-md border border-border px-3 py-3 text-muted-foreground">
                Currently used by {deleteЦельDetail.usedByАгенты.map((agent) => agent.name).join(", ")}.
              </div>
            ) : null}
            {(deleteЦельDetail?.usedByАгенты.length ?? 0) > 0 ? (
              <p classИмя="text-muted-foreground">
                Detach this skill from all agents to enable removal.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            {(deleteЦельDetail?.usedByАгенты.length ?? 0) > 0 ? (
              <Button variant="ghost" onClick={() => closeУдалитьDialog(false)}>
                Закрыть
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => closeУдалитьDialog(false)} disabled={deleteНавык.isОжидание}>
                  Отмена
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteНавык.mutate()}
                  disabled={deleteНавык.isОжидание || !deleteЦельНавыкId}
                >
                  {deleteНавык.isОжидание ? "Removing..." : "Удалить навык"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emptySourceHelpOpen} onOpenChange={setEmptySourceHelpOpen}>
        <DialogContent classИмя="sm:max-w-md">
          <DialogHeader>
            <DialogНазвание>Добавить a skill source</DialogНазвание>
            <DialogОписание>
              Paste a local path, GitHub URL, or `skills.sh` command into the field first.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-3 text-sm">
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              classИмя="flex items-start justify-between rounded-md border border-border px-3 py-3 text-foreground no-underline transition-colors hover:bg-accent/40"
            >
              <span>
                <span classИмя="block font-medium">Browse skills.sh</span>
                <span classИмя="mt-1 block text-muted-foreground">
                  Find install commands and paste one here.
                </span>
              </span>
              <ExternalLink classИмя="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
            <a
              href="https://github.com/search?q=SKILL.md&type=code"
              target="_blank"
              rel="noreferrer"
              classИмя="flex items-start justify-between rounded-md border border-border px-3 py-3 text-foreground no-underline transition-colors hover:bg-accent/40"
            >
              <span>
                <span classИмя="block font-medium">Поиск GitHub</span>
                <span classИмя="mt-1 block text-muted-foreground">
                  Look for repositories with `SKILL.md`, then paste the repo URL here.
                </span>
              </span>
              <ExternalLink classИмя="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          </div>
          <DialogFooter showЗакрытьButton />
        </DialogContent>
      </Dialog>

      <div classИмя="grid min-h-[calc(100vh-12rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside classИмя="border-r border-border">
          <div classИмя="border-b border-border px-4 py-3">
            <div classИмя="flex items-center justify-between gap-2">
              <div>
                <h1 classИмя="text-base font-semibold">Навыки</h1>
                <p classИмя="text-xs text-muted-foreground">
                  {skillsQuery.data?.length ?? 0} available
                </p>
              </div>
              <div classИмя="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => scanПроекты.mutate()}
                  disabled={scanПроекты.isОжидание}
                  title="Scan project workspaces for skills"
                >
                  <ОбновитьCw classИмя={cn("h-4 w-4", scanПроекты.isОжидание && "animate-spin")} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setСоздатьOpen((value) => !value)}>
                  <Plus classИмя="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div classИмя="mt-3 flex items-center gap-2 border-b border-border pb-2">
              <Поиск classИмя="h-4 w-4 text-muted-foreground" />
              <input
                value={skillФильтр}
                onChange={(event) => setНавыкФильтр(event.target.value)}
                placeholder="Фильтр навыков"
                classИмя="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div classИмя="mt-3 flex items-center gap-2 border-b border-border pb-2">
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Paste path, GitHub URL, or skills.sh command"
                classИмя="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleДобавитьНавыкSource}
                disabled={importНавык.isОжидание}
              >
                {importНавык.isОжидание ? <ОбновитьCw classИмя="h-4 w-4 animate-spin" /> : "Добавить"}
              </Button>
            </div>
            {scanСтатусMessage && (
              <p classИмя="mt-3 text-xs text-muted-foreground">
                {scanСтатусMessage}
              </p>
            )}
          </div>

          {createOpen && (
            <NewНавыкForm
              onСоздать={(payload) => createНавык.mutate(payload)}
              isОжидание={createНавык.isОжидание}
              onОтмена={() => setСоздатьOpen(false)}
            />
          )}

          {skillsQuery.isЗагрузка ? (
            <PageSkeleton variant="list" />
          ) : skillsQuery.error ? (
            <div classИмя="px-4 py-6 text-sm text-destructive">{skillsQuery.error.message}</div>
          ) : (
            <НавыкList
              skills={skillsQuery.data ?? []}
              selectedНавыкId={selectedНавыкId}
              skillФильтр={skillФильтр}
              expandedНавыкId={expandedНавыкId}
              expandedDirs={expandedDirs}
              selectedПутьs={selectedНавыкId ? { [selectedНавыкId]: selectedПуть } : {}}
              onToggleНавык={(currentНавыкId) =>
                setExpandedНавыкId((current) => current === currentНавыкId ? null : currentНавыкId)
              }
              onToggleDir={(currentНавыкId, path) => {
                setExpandedDirs((current) => {
                  const next = new Set(current[currentНавыкId] ?? []);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return { ...current, [currentНавыкId]: next };
                });
              }}
              onSelectНавык={(currentНавыкId) => setExpandedНавыкId(currentНавыкId)}
              onSelectПуть={() => {}}
            />
          )}
        </aside>

        <div classИмя="min-w-0 pl-6">
          <НавыкPane
            loading={skillsQuery.isЗагрузка || detailQuery.isЗагрузка}
            detail={activeDetail}
            file={activeFile}
            fileЗагрузка={fileQuery.isЗагрузка && !activeFile}
            updateСтатус={updateСтатусQuery.data}
            updateСтатусЗагрузка={updateСтатусQuery.isЗагрузка}
            viewMode={viewMode}
            editMode={editMode}
            draft={draft}
            setViewMode={setViewMode}
            setИзменитьMode={setИзменитьMode}
            setЧерновик={setЧерновик}
            onCheckОбновитьs={() => {
              void updateСтатусQuery.refetch();
            }}
            checkОбновитьsОжидание={updateСтатусQuery.isFetching}
            onInstallОбновить={() => installОбновить.mutate()}
            installОбновитьОжидание={installОбновить.isОжидание}
            onУдалить={openУдалитьDialog}
            deleteОжидание={deleteНавык.isОжидание}
            onСохранить={() => saveFile.mutate()}
            saveОжидание={saveFile.isОжидание}
          />
        </div>
      </div>
    </>
  );
}
