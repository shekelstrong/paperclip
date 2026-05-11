import type { КлючboardEvent, ReactНетde } from "react";
import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Папка,
  ПапкаOpen,
} from "lucide-react";
import { statusBadge, statusBadgeПо умолчанию } from "../lib/status-colors";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

// -- Tree types --------------------------------------------------------------

export type FileTreeНетde = {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: FileTreeНетde[];
  /** Опционально per-node metadata (e.g. import action) */
  action?: string | null;
};

export type FileTreeBadgeVariant = "ok" | "warning" | "error" | "info" | "pending";

export type FileTreeBadge = {
  label: string;
  status: FileTreeBadgeVariant;
  tooltip?: string;
};

export type FileTreeTone = "default" | "warning" | "error" | "muted";

export type FileTreeEmptyState = {
  title?: string;
  description?: string;
};

export type FileTreeОшибкаState = {
  message: string;
  retry?: () => void;
};

type VisibleFileTreeНетde = {
  node: FileTreeНетde;
  depth: number;
};

const TREE_BASE_INDENT = 16;
const TREE_STEP_INDENT = 24;
const TREE_ROW_HEIGHT_CLASS = "min-h-9";

const fileTreeToneClass: Record<FileTreeTone, string | undefined> = {
  default: undefined,
  warning: "bg-amber-500/5 text-amber-700 dark:text-amber-300",
  error: "bg-destructive/5 text-destructive",
  muted: "opacity-50",
};

// -- Helpers -----------------------------------------------------------------

export function buildFileTree(
  files: Record<string, unknown>,
  actionMap?: Map<string, string>,
): FileTreeНетde[] {
  const root: FileTreeНетde = { name: "", path: "", kind: "dir", children: [] };

  for (const fileПуть of Object.keys(files)) {
    const segments = fileПуть.split("/").filter(Boolean);
    let current = root;
    let currentПуть = "";
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentПуть = currentПуть ? `${currentПуть}/${segment}` : segment;
      const isLeaf = i === segments.length - 1;
      let next = current.children.find((c) => c.name === segment);
      if (!next) {
        next = {
          name: segment,
          path: currentПуть,
          kind: isLeaf ? "file" : "dir",
          children: [],
          action: isLeaf ? (actionMap?.get(fileПуть) ?? null) : null,
        };
        current.children.push(next);
      }
      current = next;
    }
  }

  function sortНетde(node: FileTreeНетde) {
    node.children.sort((a, b) => {
      // Файлы before directories so PROJECT.md appears above tasks/
      if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortНетde);
  }

  sortНетde(root);
  return root.children;
}

export function countФайлы(nodes: FileTreeНетde[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "file") count++;
    else count += countФайлы(node.children);
  }
  return count;
}

export function collectВсеПутьs(
  nodes: FileTreeНетde[],
  type: "file" | "dir" | "all" = "all",
): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (type === "all" || node.kind === type) paths.add(node.path);
    for (const p of collectВсеПутьs(node.children, type)) paths.add(p);
  }
  return paths;
}

function fileIcon(name: string) {
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return FileCode2;
  return FileText;
}

function flattenVisibleНетdes(
  nodes: FileTreeНетde[],
  expandedDirs: Set<string>,
  depth = 0,
): VisibleFileTreeНетde[] {
  const flattened: VisibleFileTreeНетde[] = [];
  for (const node of nodes) {
    flattened.push({ node, depth });
    if (node.kind === "dir" && expandedDirs.has(node.path)) {
      flattened.push(...flattenVisibleНетdes(node.children, expandedDirs, depth + 1));
    }
  }
  return flattened;
}

function checkboxState(node: FileTreeНетde, checkedФайлы: Set<string>) {
  if (node.kind === "file") {
    return {
      allChecked: checkedФайлы.has(node.path),
      someChecked: false,
    };
  }

  const childФайлы = collectВсеПутьs(node.children, "file");
  const childFileПутьs = [...childФайлы];
  const allChecked = childFileПутьs.length > 0 && childFileПутьs.every((p) => checkedФайлы.has(p));
  const someChecked = childFileПутьs.some((p) => checkedФайлы.has(p));
  return { allChecked, someChecked: someChecked && !allChecked };
}

// -- Frontmatter helpers -----------------------------------------------------

export type FrontmatterData = Record<string, string | string[]>;

export function parseFrontmatter(content: string): { data: FrontmatterData; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const data: FrontmatterData = {};
  const rawYaml = match[1];
  const body = match[2];

  let currentКлюч: string | null = null;
  let currentList: string[] | null = null;

  for (const line of rawYaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentКлюч) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    if (currentКлюч && currentList) {
      data[currentКлюч] = currentList;
      currentList = null;
      currentКлюч = null;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      if (val === "null") {
        currentКлюч = null;
        continue;
      }
      if (val) {
        data[key] = val;
        currentКлюч = null;
      } else {
        currentКлюч = key;
      }
    }
  }

  if (currentКлюч && currentList) {
    data[currentКлюч] = currentList;
  }

  return Object.keys(data).length > 0 ? { data, body } : null;
}

export const FRONTMATTER_FIELD_LABELS: Record<string, string> = {
  name: "Имя",
  title: "Название",
  kind: "Kind",
  reportsTo: "Репозиторийrts to",
  skills: "Навыки",
  status: "Статус",
  description: "Описание",
  priority: "Приоритет",
  assignee: "Исполнитель",
  project: "Project",
  recurring: "Recurring",
  targetDate: "Дата цели",
};

// -- File tree component -----------------------------------------------------

export type FileTreeProps = {
  nodes: FileTreeНетde[];
  selectedFile: string | null;
  expandedDirs: Set<string>;
  checkedФайлы?: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onToggleCheck?: (path: string, kind: "file" | "dir") => void;
  /** Serializable badge metadata keyed by path. This is safe to expose through plugin UI contracts. */
  fileBadges?: Record<string, FileTreeBadge | undefined>;
  /** Закрытьd row tone metadata keyed by path. This avoids raw host class names in public contracts. */
  fileTones?: Record<string, FileTreeTone | undefined>;
  /** Internal-only escape hatch for current host call sites that need richer row content. */
  renderFileExtra?: (node: FileTreeНетde, checked: boolean) => ReactНетde;
  /** @deprecated Use fileTones for public surfaces. Kept for compatibility with host-only callers. */
  fileRowClassИмя?: (node: FileTreeНетde, checked: boolean) => string | undefined;
  showCheckboxes?: boolean;
  /** Всеow long file and directory names to wrap instead of forcing horizontal overflow. */
  wrapЯрлыки?: boolean;
  loading?: boolean;
  error?: FileTreeОшибкаState | null;
  empty?: FileTreeEmptyState;
  ariaLabel?: string;
};

export function FileTree({
  nodes,
  selectedFile,
  expandedDirs,
  checkedФайлы,
  onToggleDir,
  onSelectFile,
  onToggleCheck,
  fileBadges,
  fileTones,
  renderFileExtra,
  fileRowClassИмя,
  showCheckboxes = true,
  wrapЯрлыки = true,
  loading = false,
  error,
  empty,
  ariaLabel = "Файлы",
}: FileTreeProps) {
  const effectiveCheckedФайлы = checkedФайлы ?? new Set<string>();
  const visibleНетdes = useMemo(
    () => flattenVisibleНетdes(nodes, expandedDirs),
    [expandedDirs, nodes],
  );
  const [focusedПуть, setFocusedПуть] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  function focusПуть(path: string) {
    setFocusedПуть(path);
    window.requestAnimationFrame(() => {
      rowRefs.current.get(path)?.focus();
    });
  }

  function toggleНетde(node: FileTreeНетde) {
    if (node.kind === "dir") onToggleDir(node.path);
    else onSelectFile(node.path);
  }

  function handleRowКлючDown(event: КлючboardEvent<HTMLDivElement>, index: number, node: FileTreeНетde) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventПо умолчанию();
        const next = visibleНетdes[Math.min(index + 1, visibleНетdes.length - 1)];
        if (next) focusПуть(next.node.path);
        break;
      }
      case "ArrowUp": {
        event.preventПо умолчанию();
        const previous = visibleНетdes[Math.max(index - 1, 0)];
        if (previous) focusПуть(previous.node.path);
        break;
      }
      case "ArrowRight":
        if (node.kind === "dir" && !expandedDirs.has(node.path)) {
          event.preventПо умолчанию();
          onToggleDir(node.path);
        }
        break;
      case "ArrowLeft":
        if (node.kind === "dir" && expandedDirs.has(node.path)) {
          event.preventПо умолчанию();
          onToggleDir(node.path);
        }
        break;
      case "Enter":
        event.preventПо умолчанию();
        toggleНетde(node);
        break;
      case " ":
        if (showCheckboxes && onToggleCheck) {
          event.preventПо умолчанию();
          onToggleCheck(node.path, node.kind);
        }
        break;
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label={ariaLabel} role="tree" classИмя="py-1">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} classИмя={cn("flex items-center gap-2 px-4", TREE_ROW_HEIGHT_CLASS)}>
            <Skeleton classИмя="h-4 w-4 shrink-0 rounded-sm" />
            <Skeleton classИмя={cn("h-3.5", row === 1 ? "w-3/5" : "w-4/5")} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div aria-label={ariaLabel} role="tree" classИмя="p-3">
        <div
          role="treeitem"
          aria-level={1}
          classИмя="flex min-h-9 items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        >
          <div classИмя="flex min-w-0 items-center gap-2">
            <span
              classИмя={cn(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                statusBadge.error ?? statusBadgeПо умолчанию,
              )}
            >
              error
            </span>
            <span classИмя="min-w-0 text-destructive">{error.message}</span>
          </div>
          {error.retry && (
            <Button type="button" size="xs" variant="outline" onClick={error.retry}>
              Повторить
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div aria-label={ariaLabel} role="tree" classИмя="p-3">
        <div classИмя="rounded-md border border-dashed border-border px-4 py-8 text-center">
          <div classИмя="text-sm font-medium">{empty?.title ?? "Нет files"}</div>
          <div classИмя="mt-1 text-xs text-muted-foreground">
            {empty?.description ?? "Файлы will appear here when they are available."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-label={ariaLabel} role="tree">
      {visibleНетdes.map(({ node, depth }, index) => {
        const expanded = node.kind === "dir" && expandedDirs.has(node.path);
        const { allChecked, someChecked } = checkboxState(node, effectiveCheckedФайлы);
        const badge = fileBadges?.[node.path];
        const tone = fileTones?.[node.path] ?? "default";
        const extraClassИмя = node.kind === "file" ? fileRowClassИмя?.(node, allChecked) : undefined;
        const FileIcon = node.kind === "file" ? fileIcon(node.name) : null;
        const isSelected = node.kind === "file" && node.path === selectedFile;

        return (
          <div
            key={node.path}
            ref={(element) => {
              if (element) rowRefs.current.set(node.path, element);
              else rowRefs.current.delete(node.path);
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={node.kind === "dir" ? expanded : undefined}
            aria-selected={node.kind === "file" ? isSelected : undefined}
            aria-checked={showCheckboxes ? (someChecked ? "mixed" : allChecked) : undefined}
            tabIndex={(focusedПуть ?? visibleНетdes[0]?.node.path) === node.path ? 0 : -1}
            classИмя={cn(
              node.kind === "dir"
                ? showCheckboxes
                  ? "group grid w-full grid-cols-[auto_minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                  : "group grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground max-[480px]:grid-cols-[minmax(0,1fr)]"
                : "group flex w-full items-center gap-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground cursor-pointer",
              TREE_ROW_HEIGHT_CLASS,
              isSelected && "text-foreground bg-accent/20",
              fileTreeToneClass[tone],
              extraClassИмя,
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
            )}
            style={{
              paddingInlineНачать: `${TREE_BASE_INDENT + depth * TREE_STEP_INDENT - 8}px`,
            }}
            onFocus={() => setFocusedПуть(node.path)}
            onClick={() => toggleНетde(node)}
            onКлючDown={(event) => handleRowКлючDown(event, index, node)}
            data-file-tree-path={node.path}
          >
            {showCheckboxes && (
              <label classИмя="flex items-center pl-2" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(element) => {
                    if (element) element.indeterminate = someChecked;
                  }}
                  onChange={() => onToggleCheck?.(node.path, node.kind)}
                  classИмя="mr-2 accent-foreground"
                />
              </label>
            )}
            <span classИмя="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
              <span classИмя="flex h-4 w-4 shrink-0 items-center justify-center">
                {node.kind === "dir" ? (
                  expanded ? (
                    <ПапкаOpen classИмя="h-3.5 w-3.5" />
                  ) : (
                    <Папка classИмя="h-3.5 w-3.5" />
                  )
                ) : FileIcon ? (
                  <FileIcon classИмя="h-3.5 w-3.5" />
                ) : null}
              </span>
              <span classИмя={cn("min-w-0", wrapЯрлыки ? "break-all leading-4" : "truncate")}>
                {node.name}
              </span>
            </span>
            {badge && (
              <span
                classИмя={cn(
                  "ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  statusBadge[badge.status] ?? statusBadgeПо умолчанию,
                )}
                title={badge.tooltip}
              >
                {badge.label}
              </span>
            )}
            {node.kind === "file" && renderFileExtra?.(node, allChecked)}
            {node.kind === "dir" && (
              <button
                type="button"
                classИмя="flex h-9 w-9 items-center justify-center self-center rounded-sm text-muted-foreground opacity-70 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 max-[480px]:hidden"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDir(node.path);
                }}
                aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
              >
                {expanded ? (
                  <ChevronDown classИмя="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight classИмя="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
