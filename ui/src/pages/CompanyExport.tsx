import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  Агент,
  КомпанияПортabilityFileEntry,
  КомпанияПортabilityЭкспортПредпросмотрResult,
  КомпанияПортabilityЭкспортResult,
  КомпанияПортabilityManifest,
  Project,
} from "@paperclipai/shared";
import { useNavigate, useLocation } from "@/lib/router";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { companiesApi } from "../api/companies";
import { projectsApi } from "../api/projects";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { MarkdownBody } from "../components/MarkdownBody";
import { cn } from "../lib/utils";
import { queryКлючs } from "../lib/queryКлючs";
import { createZipАрхивировать } from "../lib/zip";
import { buildInitialЭкспортCheckedФайлы } from "../lib/company-export-selection";
import { useАгентOrder } from "../hooks/useАгентOrder";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { buildПортableSidebarOrder } from "../lib/company-portability-sidebar";
import { getПортableFileDataUrl, getПортableFileText, isПортableImageFile } from "../lib/portable-files";
import {
  Скачать,
  Package,
  Поиск,
} from "lucide-react";
import {
  type FileTreeНетde,
  type FrontmatterData,
  buildFileTree,
  countФайлы,
  collectВсеПутьs,
  parseFrontmatter,
  FRONTMATTER_FIELD_LABELS,
  FileTree,
} from "../components/FileTree";

/**
 * Extract the set of agent/project/task slugs that are "checked" based on
 * which file paths are in the checked set.
 *   agents/{slug}/AGENT.md   → agents slug
 *   projects/{slug}/PROJECT.md → projects slug
 *   tasks/{slug}/TASK.md     → tasks slug
 */
function checkedSlugs(checkedФайлы: Set<string>): {
  agents: Set<string>;
  projects: Set<string>;
  tasks: Set<string>;
  routines: Set<string>;
} {
  const agents = new Set<string>();
  const projects = new Set<string>();
  const tasks = new Set<string>();
  for (const p of checkedФайлы) {
    const agentMatch = p.match(/^agents\/([^/]+)\//);
    if (agentMatch) agents.add(agentMatch[1]);
    const projectMatch = p.match(/^projects\/([^/]+)\//);
    if (projectMatch) projects.add(projectMatch[1]);
    const taskMatch = p.match(/^tasks\/([^/]+)\//);
    if (taskMatch) tasks.add(taskMatch[1]);
  }
  return { agents, projects, tasks, routines: new Set(tasks) };
}

/**
 * Фильтр .paperclip.yaml content so it only includes entries whose
 * corresponding files are checked. Работаs by line-level YAML parsing
 * since the file has a known, simple structure produced by our own
 * renderYamlBlock.
 */
function filterPaperclipYaml(yaml: string, checkedФайлы: Set<string>): string {
  const slugs = checkedSlugs(checkedФайлы);
  const lines = yaml.split("\n");
  const out: string[] = [];

  // Sections whose entries are slug-keyed and should be filtered
  const filterableSections = new Set(["agents", "projects", "tasks", "routines"]);
  const sidebarSections = new Set(["agents", "projects"]);

  let currentSection: string | null = null; // top-level key (e.g. "agents")
  let currentEntry: string | null = null;   // slug under that section
  let includeEntry = true;
  let currentSidebarList: string | null = null;
  let currentSidebarHeaderLine: string | null = null;
  let currentSidebarBuffer: string[] = [];
  // Collect entries per section so we can omit empty section headers
  let sectionHeaderLine: string | null = null;
  let sectionBuffer: string[] = [];

  function flushSidebarSection() {
    if (currentSidebarHeaderLine !== null && currentSidebarBuffer.length > 0) {
      sectionBuffer.push(currentSidebarHeaderLine);
      sectionBuffer.push(...currentSidebarBuffer);
    }
    currentSidebarHeaderLine = null;
    currentSidebarBuffer = [];
  }

  function flushSection() {
    flushSidebarSection();
    if (sectionHeaderLine !== null && sectionBuffer.length > 0) {
      out.push(sectionHeaderLine);
      out.push(...sectionBuffer);
    }
    sectionHeaderLine = null;
    sectionBuffer = [];
  }

  for (const line of lines) {
    // Detect top-level key (no indentation)
    const topMatch = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (topMatch && !line.startsWith(" ")) {
      // Flush previous section
      flushSection();
      currentEntry = null;
      includeEntry = true;

      const key = topMatch[0].split(":")[0];
      if (filterableSections.has(key)) {
        currentSection = key;
        sectionHeaderLine = line;
        continue;
      } else if (key === "sidebar") {
        currentSection = key;
        currentSidebarList = null;
        sectionHeaderLine = line;
        continue;
      } else {
        currentSection = null;
        out.push(line);
        continue;
      }
    }

    if (currentSection === "sidebar") {
      const sidebarMatch = line.match(/^  ([\w-]+):\s*$/);
      if (sidebarMatch && !line.startsWith("    ")) {
        flushSidebarSection();
        const sidebarКлюч = sidebarMatch[1];
        currentSidebarList = sidebarКлюч && sidebarSections.has(sidebarКлюч) ? sidebarКлюч : null;
        currentSidebarHeaderLine = currentSidebarList ? line : null;
        continue;
      }

      const sidebarEntryMatch = line.match(/^    - ["']?([^"'\n]+)["']?\s*$/);
      if (sidebarEntryMatch && currentSidebarList) {
        const slug = sidebarEntryMatch[1];
        const sectionSlugs = slugs[currentSidebarList as keyof typeof slugs];
        if (slug && sectionSlugs.has(slug)) {
          currentSidebarBuffer.push(line);
        }
        continue;
      }

      if (currentSidebarList) {
        currentSidebarBuffer.push(line);
        continue;
      }
    }

    // Inside a filterable section
    if (currentSection && filterableSections.has(currentSection)) {
      // 2-space indented key = entry slug (slugs may start with digits/hyphens)
      const entryMatch = line.match(/^  ([\w][\w-]*):\s*(.*)$/);
      if (entryMatch && !line.startsWith("    ")) {
        const slug = entryMatch[1];
        currentEntry = slug;
        const sectionSlugs = slugs[currentSection as keyof typeof slugs];
        includeEntry = sectionSlugs.has(slug);
        if (includeEntry) sectionBuffer.push(line);
        continue;
      }

      // Deeper indented line belongs to current entry
      if (currentEntry !== null) {
        if (includeEntry) sectionBuffer.push(line);
        continue;
      }

      // Shouldn't happen in well-formed output, but pass through
      sectionBuffer.push(line);
      continue;
    }

    // Outside filterable sections — pass through
    out.push(line);
  }

  // Flush last section
  flushSection();

  let filtered = out.join("\n");
  const logoПутьMatch = filtered.match(/^\s{2}logoПуть:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (logoПутьMatch && !checkedФайлы.has(logoПутьMatch[1]!)) {
    filtered = filtered.replace(/^\s{2}logoПуть:\s*["']?([^"'\n]+)["']?\s*\n?/m, "");
  }

  return filtered;
}

/** Фильтр tree nodes whose path (or descendant paths) match a search string */
function filterTree(nodes: FileTreeНетde[], query: string): FileTreeНетde[] {
  if (!query) return nodes;
  const lower = query.toНизкийerCase();
  return nodes
    .map((node) => {
      if (node.kind === "file") {
        return node.name.toНизкийerCase().includes(lower) || node.path.toНизкийerCase().includes(lower)
          ? node
          : null;
      }
      const filteredChildren = filterTree(node.children, query);
      return filteredChildren.length > 0
        ? { ...node, children: filteredChildren }
        : null;
    })
    .filter((n): n is FileTreeНетde => n !== null);
}

/** Collect all ancestor dir paths for files that match a filter */
function collectMatchedРодительDirs(nodes: FileTreeНетde[], query: string): Set<string> {
  const dirs = new Set<string>();
  const lower = query.toНизкийerCase();

  function walk(node: FileTreeНетde, ancestors: string[]) {
    if (node.kind === "file") {
      if (node.name.toНизкийerCase().includes(lower) || node.path.toНизкийerCase().includes(lower)) {
        for (const a of ancestors) dirs.add(a);
      }
    } else {
      for (const child of node.children) {
        walk(child, [...ancestors, node.path]);
      }
    }
  }

  for (const node of nodes) walk(node, []);
  return dirs;
}

/** Сортировка tree: checked files first, then unchecked */
function sortByChecked(nodes: FileTreeНетde[], checkedФайлы: Set<string>): FileTreeНетde[] {
  return nodes.map((node) => {
    if (node.kind === "dir") {
      return { ...node, children: sortByChecked(node.children, checkedФайлы) };
    }
    return node;
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
    if (a.kind === "file" && b.kind === "file") {
      const aChecked = checkedФайлы.has(a.path);
      const bChecked = checkedФайлы.has(b.path);
      if (aChecked !== bChecked) return aChecked ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

const TASKS_PAGE_SIZE = 10;

/**
 * Paginate children of `tasks/` directories: show up to `limit` entries,
 * but always include children that are checked or match the search query.
 * Returns the paginated tree and the total count of task children.
 */
function paginateЗадачаНетdes(
  nodes: FileTreeНетde[],
  limit: number,
  checkedФайлы: Set<string>,
  searchQuery: string,
): { nodes: FileTreeНетde[]; totalЗадачаChildren: number; visibleЗадачаChildren: number } {
  let totalЗадачаChildren = 0;
  let visibleЗадачаChildren = 0;

  const result = nodes.map((node) => {
    // Only paginate direct children of "tasks" directories
    if (node.kind === "dir" && node.name === "tasks") {
      totalЗадачаChildren = node.children.length;

      // Partition children: pinned (checked or search-matched) vs rest
      const pinned: FileTreeНетde[] = [];
      const rest: FileTreeНетde[] = [];
      const lower = searchQuery.toНизкийerCase();

      for (const child of node.children) {
        const childФайлы = collectВсеПутьs([child], "file");
        const isChecked = [...childФайлы].some((p) => checkedФайлы.has(p));
        const isПоискMatch = searchQuery && (
          child.name.toНизкийerCase().includes(lower) ||
          child.path.toНизкийerCase().includes(lower) ||
          [...childФайлы].some((p) => p.toНизкийerCase().includes(lower))
        );
        if (isChecked || isПоискMatch) {
          pinned.push(child);
        } else {
          rest.push(child);
        }
      }

      // Show pinned + up to `limit` from rest
      const remaining = Math.max(0, limit - pinned.length);
      const visible = [...pinned, ...rest.slice(0, remaining)];
      visibleЗадачаChildren = visible.length;

      return { ...node, children: visible };
    }
    return node;
  });

  return { nodes: result, totalЗадачаChildren, visibleЗадачаChildren };
}

function downloadZip(
  exported: КомпанияПортabilityЭкспортResult,
  selectedФайлы: Set<string>,
  effectiveФайлы: Record<string, КомпанияПортabilityFileEntry>,
) {
  const filteredФайлы: Record<string, КомпанияПортabilityFileEntry> = {};
  for (const [path] of Object.entries(exported.files)) {
    if (selectedФайлы.has(path)) filteredФайлы[path] = effectiveФайлы[path] ?? exported.files[path];
  }
  const zipBytes = createZipАрхивировать(filteredФайлы, exported.rootПуть);
  const zipBuffer = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(zipBuffer).set(zipBytes);
  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${exported.rootПуть}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Frontmatter card (export-specific: skill click support) ──────────

function FrontmatterCard({
  data,
  onНавыкClick,
}: {
  data: FrontmatterData;
  onНавыкClick?: (skill: string) => void;
}) {
  return (
    <div classИмя="rounded-md border border-border bg-accent/20 px-4 py-3 mb-4">
      <dl classИмя="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} classИмя="contents">
            <dt classИмя="text-muted-foreground whitespace-nowrap py-0.5">
              {FRONTMATTER_FIELD_LABELS[key] ?? key}
            </dt>
            <dd classИмя="py-0.5">
              {Array.isArray(value) ? (
                <div classИмя="flex flex-wrap gap-1.5">
                  {value.map((item) => (
                    <button
                      key={item}
                      type="button"
                      classИмя={cn(
                        "inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs",
                        key === "skills" && onНавыкClick && "cursor-pointer hover:bg-accent/50 hover:border-foreground/30 transition-colors",
                      )}
                      onClick={() => key === "skills" && onНавыкClick?.(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <span>{value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Client-side README generation ────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO", cto: "CTO", cmo: "CMO", cfo: "CFO", coo: "COO",
  vp: "VP", manager: "Manager", engineer: "Инженер", agent: "Агент",
};

/**
 * Regenerate README.md content based on the currently checked files.
 * Only counts/lists entities whose files are in the checked set.
 */
function generateReadmeFromSelection(
  manifest: КомпанияПортabilityManifest,
  checkedФайлы: Set<string>,
  companyИмя: string,
  companyОписание: string | null,
): string {
  const slugs = checkedSlugs(checkedФайлы);

  const agents = manifest.agents.filter((a) => slugs.agents.has(a.slug));
  const projects = manifest.projects.filter((p) => slugs.projects.has(p.slug));
  const tasks = manifest.issues.filter((t) => slugs.tasks.has(t.slug));
  const skills = manifest.skills.filter((s) => {
    // Навык files live under skills/{key}/...
    return [...checkedФайлы].some((f) => f.startsWith(`skills/${s.key}/`) || f.startsWith(`skills/`) && f.includes(`/${s.slug}/`));
  });

  const lines: string[] = [];
  lines.push(`# ${companyИмя}`);
  lines.push("");
  if (companyОписание) {
    lines.push(`> ${companyОписание}`);
    lines.push("");
  }
  // Оргструктура chart image (generated during export as images/org-chart.png)
  if (agents.length > 0) {
    lines.push("![Оргструктура Chart](images/org-chart.png)");
    lines.push("");
  }

  lines.push("## What's Inside");
  lines.push("");
  lines.push("This is an [Агент Компания](https://paperclip.ing) package.");
  lines.push("");

  const counts: Array<[string, number]> = [];
  if (agents.length > 0) counts.push(["Агенты", agents.length]);
  if (projects.length > 0) counts.push(["Проекты", projects.length]);
  if (skills.length > 0) counts.push(["Навыки", skills.length]);
  if (tasks.length > 0) counts.push(["Задачи", tasks.length]);

  if (counts.length > 0) {
    lines.push("| Content | Count |");
    lines.push("|---------|-------|");
    for (const [label, count] of counts) {
      lines.push(`| ${label} | ${count} |`);
    }
    lines.push("");
  }

  if (agents.length > 0) {
    lines.push("### Агенты");
    lines.push("");
    lines.push("| Агент | Role | Репозиторийrts To |");
    lines.push("|-------|------|------------|");
    for (const agent of agents) {
      const roleLabel = ROLE_LABELS[agent.role] ?? agent.role;
      const reportsTo = agent.reportsToSlug ?? "\u2014";
      lines.push(`| ${agent.name} | ${roleLabel} | ${reportsTo} |`);
    }
    lines.push("");
  }

  if (projects.length > 0) {
    lines.push("### Проекты");
    lines.push("");
    for (const project of projects) {
      const desc = project.description ? ` \u2014 ${project.description}` : "";
      lines.push(`- **${project.name}**${desc}`);
    }
    lines.push("");
  }

  lines.push("## Getting Запущен");
  lines.push("");
  lines.push("```bash");
  lines.push("pnpm paperclipai company import this-github-url-or-folder");
  lines.push("```");
  lines.push("");
  lines.push("See [Paperclip](https://paperclip.ing) for more information.");
  lines.push("");
  lines.push("---");
  lines.push(`Экспортed from [Paperclip](https://paperclip.ing) on ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  return lines.join("\n");
}

// ── Предпросмотр pane ──────────────────────────────────────────────────────

function ЭкспортПредпросмотрPane({
  selectedFile,
  content,
  allФайлы,
  onНавыкClick,
}: {
  selectedFile: string | null;
  content: КомпанияПортabilityFileEntry | null;
  allФайлы: Record<string, КомпанияПортabilityFileEntry>;
  onНавыкClick?: (skill: string) => void;
}) {
  if (!selectedFile || content === null) {
    return (
      <EmptyState icon={Package} message="Select a file to preview its contents." />
    );
  }

  const textContent = getПортableFileText(content);
  const isMarkdown = selectedFile.endsWith(".md") && textContent !== null;
  const parsed = isMarkdown && textContent ? parseFrontmatter(textContent) : null;
  const imageSrc = isПортableImageFile(selectedFile, content) ? getПортableFileDataUrl(selectedFile, content) : null;

  // Resolve relative image paths within the export package (e.g. images/org-chart.png)
  const resolveImageSrc = isMarkdown
    ? (src: string) => {
        // Skip absolute URLs and data URIs
        if (/^(?:https?:|data:)/i.test(src)) return null;
        // Resolve relative to the directory of the current markdown file
        const dir = selectedFile.includes("/") ? selectedFile.slice(0, selectedFile.lastIndexOf("/") + 1) : "";
        const resolved = dir + src;
        const entry = allФайлы[resolved] ?? allФайлы[src];
        if (!entry) return null;
        return getПортableFileDataUrl(resolved in allФайлы ? resolved : src, entry);
      }
    : undefined;

  return (
    <div classИмя="min-w-0">
      <div classИмя="border-b border-border px-5 py-3">
        <div classИмя="truncate font-mono text-sm">{selectedFile}</div>
      </div>
      <div classИмя="min-h-[560px] px-5 py-5">
        {parsed ? (
          <>
            <FrontmatterCard data={parsed.data} onНавыкClick={onНавыкClick} />
            {parsed.body.trim() && <MarkdownBody resolveImageSrc={resolveImageSrc} softBreaks={false} linkЗадачаСсылки={false}>{parsed.body}</MarkdownBody>}
          </>
        ) : isMarkdown ? (
          <MarkdownBody resolveImageSrc={resolveImageSrc} softBreaks={false} linkЗадачаСсылки={false}>{textContent ?? ""}</MarkdownBody>
        ) : imageSrc ? (
          <div classИмя="flex min-h-[520px] items-center justify-center rounded-lg border border-border bg-accent/10 p-6">
            <img src={imageSrc} alt={selectedFile} classИмя="max-h-[480px] max-w-full object-contain" />
          </div>
        ) : textContent !== null ? (
          <pre classИмя="overflow-x-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-mono text-sm text-foreground">
            <code>{textContent}</code>
          </pre>
        ) : (
          <div classИмя="rounded-lg border border-border bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
            Binary asset preview is not available for this file type.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

/** Extract the file path from the current URL pathname (after /company/export/files/) */
function fileПутьFromLocation(pathname: string): string | null {
  const marker = "/company/export/files/";
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const fileПуть = decodeURIComponent(pathname.slice(idx + marker.length));
  return fileПуть || null;
}

/** Expand all ancestor directories for a given file path */
function expandAncestors(fileПуть: string): string[] {
  const parts = fileПуть.split("/").slice(0, -1);
  const dirs: string[] = [];
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    dirs.push(current);
  }
  return dirs;
}

export function КомпанияЭкспорт() {
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isFetched: isSessionFetched } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const { data: agents = [], isFetched: areАгентыFetched } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });
  const { data: projects = [], isFetched: areПроектыFetched } = useQuery({
    queryКлюч: queryКлючs.projects.list(selectedКомпанияId!),
    queryFn: () => projectsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const [exportData, setЭкспортData] = useState<КомпанияПортabilityЭкспортПредпросмотрResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [checkedФайлы, setCheckedФайлы] = useState<Set<string>>(new Set());
  const [treeПоиск, setTreeПоиск] = useState("");
  const [taskLimit, setЗадачаLimit] = useState(TASKS_PAGE_SIZE);
  const savedExpandedRef = useRef<Set<string> | null>(null);
  const initialFileFromUrl = useRef(fileПутьFromLocation(location.pathname));
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const visibleАгенты = useMemo(
    () => agents.filter((agent: Агент) => agent.status !== "terminated"),
    [agents],
  );
  const visibleПроекты = useMemo(
    () => projects.filter((project: Project) => !project.archivedAt),
    [projects],
  );
  const { orderedАгенты } = useАгентOrder({
    agents: visibleАгенты,
    companyId: selectedКомпанияId,
    userId: currentUserId,
  });
  const { orderedПроекты } = useProjectOrder({
    projects: visibleПроекты,
    companyId: selectedКомпанияId,
    userId: currentUserId,
  });
  const sidebarOrder = useMemo(
    () => buildПортableSidebarOrder({
      agents: visibleАгенты,
      orderedАгенты,
      projects: visibleПроекты,
      orderedПроекты,
    }),
    [orderedАгенты, orderedПроекты, visibleАгенты, visibleПроекты],
  );
  const sidebarOrderКлюч = useMemo(
    () => JSON.stringify(sidebarOrder ?? null),
    [sidebarOrder],
  );

  // Navigate-aware file selection: updates state + URL without page reload.
  // `replace` = true skips history entry (used for initial load); false = pushes (used for clicks).
  const selectFile = useCallback(
    (fileПуть: string | null, replace = false) => {
      setSelectedFile(fileПуть);
      if (fileПуть) {
        navigate(`/company/export/files/${encodeURI(fileПуть)}`, { replace });
      } else {
        navigate("/company/export", { replace });
      }
    },
    [navigate],
  );

  // Sync selectedFile from URL on browser back/forward
  useEffect(() => {
    if (!exportData) return;
    const urlFile = fileПутьFromLocation(location.pathname);
    if (urlFile && urlFile in exportData.files && urlFile !== selectedFile) {
      setSelectedFile(urlFile);
      // Expand ancestors so the file is visible in the tree
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        for (const dir of expandAncestors(urlFile)) next.add(dir);
        return next;
      });
    } else if (!urlFile && selectedFile) {
      setSelectedFile(null);
    }
  }, [location.pathname, exportData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBreadcrumbs([
      { label: "Оргструктура Chart", href: "/org" },
      { label: "Экспорт" },
    ]);
  }, [setBreadcrumbs]);

  const exportПредпросмотрMutation = useMutation({
    mutationFn: () =>
      companiesApi.exportПредпросмотр(selectedКомпанияId!, {
        include: { company: true, agents: true, projects: true, issues: true },
        sidebarOrder,
      }),
    onУспешно: (result) => {
      setЭкспортData(result);
      setCheckedФайлы((prev) =>
        buildInitialЭкспортCheckedФайлы(
          Object.keys(result.files),
          result.manifest.issues,
          prev,
        ),
      );
      // Expand top-level dirs (except tasks — collapsed by default)
      const tree = buildFileTree(result.files);
      const topDirs = new Set<string>();
      for (const node of tree) {
        if (node.kind === "dir" && node.name !== "tasks") topDirs.add(node.path);
      }

      // If URL contains a deep-linked file path, select it and expand ancestors
      const urlFile = initialFileFromUrl.current;
      if (urlFile && urlFile in result.files) {
        setSelectedFile(urlFile);
        const ancestors = expandAncestors(urlFile);
        setExpandedDirs(new Set([...topDirs, ...ancestors]));
      } else {
        // По умолчанию to README.md if present, otherwise fall back to first file
        const defaultFile = "README.md" in result.files
          ? "README.md"
          : Object.keys(result.files)[0];
        if (defaultFile) {
          selectFile(defaultFile, true);
        }
        setExpandedDirs(topDirs);
      }
    },
    onОшибка: (err) => {
      pushToast({
        tone: "error",
        title: "Экспорт failed",
        body: err instanceof Ошибка ? err.message : "Ошибка to load export data.",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () =>
      companiesApi.exportBundle(selectedКомпанияId!, {
        include: { company: true, agents: true, projects: true, issues: true },
        selectedФайлы: Array.from(checkedФайлы).sort(),
        sidebarOrder,
      }),
    onУспешно: (result) => {
      const resultCheckedФайлы = new Set(Object.keys(result.files));
      downloadZip(result, resultCheckedФайлы, result.files);
      pushToast({
        tone: "success",
        title: "Экспорт downloaded",
        body: `${resultCheckedФайлы.size} file${resultCheckedФайлы.size === 1 ? "" : "s"} exported as ${result.rootПуть}.zip`,
      });
    },
    onОшибка: (err) => {
      pushToast({
        tone: "error",
        title: "Экспорт failed",
        body: err instanceof Ошибка ? err.message : "Ошибка to build export package.",
      });
    },
  });

  useEffect(() => {
    if (!selectedКомпанияId || exportПредпросмотрMutation.isОжидание) return;
    if (!isSessionFetched || !areАгентыFetched || !areПроектыFetched) return;
    setЭкспортData(null);
    exportПредпросмотрMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedКомпанияId, isSessionFetched, areАгентыFetched, areПроектыFetched, sidebarOrderКлюч]);

  const tree = useMemo(
    () => (exportData ? buildFileTree(exportData.files) : []),
    [exportData],
  );

  const { displayTree, totalЗадачаChildren, visibleЗадачаChildren } = useMemo(() => {
    let result = tree;
    if (treeПоиск) result = filterTree(result, treeПоиск);
    result = sortByChecked(result, checkedФайлы);
    const paginated = paginateЗадачаНетdes(result, taskLimit, checkedФайлы, treeПоиск);
    return {
      displayTree: paginated.nodes,
      totalЗадачаChildren: paginated.totalЗадачаChildren,
      visibleЗадачаChildren: paginated.visibleЗадачаChildren,
    };
  }, [tree, treeПоиск, checkedФайлы, taskLimit]);

  // Recompute .paperclip.yaml and README.md content whenever checked files
  // change so the preview & download always reflect the current selection.
  const effectiveФайлы = useMemo(() => {
    if (!exportData) return {} as Record<string, КомпанияПортabilityFileEntry>;
    const filtered = { ...exportData.files };

    // Фильтр .paperclip.yaml
    const yamlПуть = exportData.paperclipExtensionПуть;
    if (yamlПуть && typeof exportData.files[yamlПуть] === "string") {
      filtered[yamlПуть] = filterPaperclipYaml(exportData.files[yamlПуть], checkedФайлы);
    }

    // Regenerate README.md based on checked selection
    if (typeof exportData.files["README.md"] === "string") {
      const companyИмя = exportData.manifest.company?.name ?? selectedКомпания?.name ?? "Компания";
      const companyОписание = exportData.manifest.company?.description ?? null;
      filtered["README.md"] = generateReadmeFromSelection(
        exportData.manifest,
        checkedФайлы,
        companyИмя,
        companyОписание,
      );
    }

    return filtered;
  }, [exportData, checkedФайлы, selectedКомпания?.name]);

  const totalФайлы = useMemo(() => countФайлы(tree), [tree]);
  const selectedCount = checkedФайлы.size;

  // Фильтр out terminated agent messages — they don't need to be shown
  const warnings = useMemo(() => {
    if (!exportData) return [] as string[];
    return exportData.warnings.filter((w) => !/terminated agent/i.test(w));
  }, [exportData]);

  function handleToggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleToggleCheck(path: string, kind: "file" | "dir") {
    if (!exportData) return;
    setCheckedФайлы((prev) => {
      const next = new Set(prev);
      if (kind === "file") {
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        // Find all child file paths under this dir
        const dirTree = buildFileTree(exportData.files);
        const findНетde = (nodes: FileTreeНетde[], target: string): FileTreeНетde | null => {
          for (const n of nodes) {
            if (n.path === target) return n;
            const found = findНетde(n.children, target);
            if (found) return found;
          }
          return null;
        };
        const dirНетde = findНетde(dirTree, path);
        if (dirНетde) {
          const childФайлы = collectВсеПутьs(dirНетde.children, "file");
          // Добавить the dir's own file children
          for (const child of dirНетde.children) {
            if (child.kind === "file") childФайлы.add(child.path);
          }
          const allChecked = [...childФайлы].every((p) => next.has(p));
          for (const f of childФайлы) {
            if (allChecked) next.delete(f);
            else next.add(f);
          }
        }
      }
      return next;
    });
  }

  function handleПоискChange(query: string) {
    const wasПоискing = treeПоиск.length > 0;
    const isПоискing = query.length > 0;

    if (isПоискing && !wasПоискing) {
      // Сохранить current expansion state before search
      savedExpandedRef.current = new Set(expandedDirs);
    }

    setTreeПоиск(query);

    if (isПоискing) {
      // Expand all parent dirs of matched files
      const matchedРодительs = collectMatchedРодительDirs(tree, query);
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        for (const d of matchedРодительs) next.add(d);
        return next;
      });
    } else if (wasПоискing) {
      // Restore pre-search expansion state
      if (savedExpandedRef.current) {
        setExpandedDirs(savedExpandedRef.current);
        savedExpandedRef.current = null;
      }
    }
  }

  function handleНавыкClick(skillКлюч: string) {
    if (!exportData) return;
    const manifestНавык = exportData.manifest.skills.find(
      (skill) => skill.key === skillКлюч || skill.slug === skillКлюч,
    );
    const skillПуть = manifestНавык?.path ?? `skills/${skillКлюч}/SKILL.md`;
    if (!(skillПуть in exportData.files)) return;
    selectFile(skillПуть);
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.add("skills");
      const parts = skillПуть.split("/").slice(0, -1);
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        next.add(current);
      }
      return next;
    });
  }

  function handleСкачать() {
    if (!exportData || checkedФайлы.size === 0 || downloadMutation.isОжидание) return;
    downloadMutation.mutate();
  }

  if (!selectedКомпанияId) {
    return <EmptyState icon={Package} message="Select a company to export." />;
  }

  if (exportПредпросмотрMutation.isОжидание && !exportData) {
    return <PageSkeleton variant="detail" />;
  }

  if (!exportData) {
    return <EmptyState icon={Package} message="Загрузка export data..." />;
  }

  const previewContent = selectedFile
    ? (() => {
        return effectiveФайлы[selectedFile] ?? null;
      })()
    : null;

  return (
    <div>
      {/* Sticky top action bar */}
      <div classИмя="sticky top-0 z-10 border-b border-border bg-background px-5 py-3">
        <div classИмя="flex flex-wrap items-center justify-between gap-3">
          <div classИмя="flex items-center gap-4 text-sm">
            <span classИмя="font-medium">
              {selectedКомпания?.name ?? "Компания"} export
            </span>
            <span classИмя="text-muted-foreground">
              {selectedCount} / {totalФайлы} file{totalФайлы === 1 ? "" : "s"} selected
            </span>
            {warnings.length > 0 && (
              <span classИмя="text-amber-500">
                {warnings.length} warning{warnings.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleСкачать}
            disabled={selectedCount === 0 || downloadMutation.isОжидание}
          >
            <Скачать classИмя="mr-1.5 h-3.5 w-3.5" />
            {downloadMutation.isОжидание
              ? "Building export..."
              : `Экспорт ${selectedCount} file${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      {/* Предупреждениеs */}
      {warnings.length > 0 && (
        <div classИмя="mx-5 mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          {warnings.map((w) => (
            <div key={w} classИмя="text-xs text-amber-500">{w}</div>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div classИмя="grid h-[calc(100vh-12rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside classИмя="flex flex-col border-r border-border overflow-hidden">
          <div classИмя="border-b border-border px-4 py-3 shrink-0">
            <h2 classИмя="text-base font-semibold">Package files</h2>
          </div>
          <div classИмя="border-b border-border px-3 py-2 shrink-0">
            <div classИмя="flex items-center gap-2 rounded-md border border-border px-2 py-1">
              <Поиск classИмя="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={treeПоиск}
                onChange={(e) => handleПоискChange(e.target.value)}
                placeholder="Поиск files..."
                classИмя="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-page-search-target="true"
              />
            </div>
          </div>
          <div classИмя="flex-1 overflow-y-auto">
            <FileTree
              nodes={displayTree}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              checkedФайлы={checkedФайлы}
              onToggleDir={handleToggleDir}
              onSelectFile={selectFile}
              onToggleCheck={handleToggleCheck}
              wrapЯрлыки={false}
            />
            {totalЗадачаChildren > visibleЗадачаChildren && !treeПоиск && (
              <div classИмя="px-4 py-2">
                <button
                  type="button"
                  onClick={() => setЗадачаLimit((prev) => prev + TASKS_PAGE_SIZE)}
                  classИмя="w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors"
                >
                  Показать больше issues ({visibleЗадачаChildren} of {totalЗадачаChildren})
                </button>
              </div>
            )}
          </div>
        </aside>
        <div classИмя="min-w-0 overflow-y-auto pl-6">
          <ЭкспортПредпросмотрPane selectedFile={selectedFile} content={previewContent} allФайлы={effectiveФайлы} onНавыкClick={handleНавыкClick} />
        </div>
      </div>
    </div>
  );
}
