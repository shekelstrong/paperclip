import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  КомпанияПортabilityCollisionStrategy,
  КомпанияПортabilityFileEntry,
  КомпанияПортabilityПредпросмотрResult,
  КомпанияПортabilitySource,
  КомпанияПортabilityАдаптерOverride,
} from "@paperclipai/shared";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import { authApi } from "../api/auth";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { sidebarPreferencesApi } from "../api/sidebarPreferences";
import { queryКлючs } from "../lib/queryКлючs";
import { getАгентOrderStorageКлюч, writeАгентOrder } from "../lib/agent-order";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { АгентConfigForm } from "../components/АгентConfigForm";
import { cn } from "../lib/utils";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Скачать,
  Github,
  Package,
  Загрузить,
} from "lucide-react";
import { Field, adapterЯрлыки } from "../components/agent-config-primitives";
import { getАдаптерLabel } from "../adapters/adapter-display-registry";
import { defaultСоздатьЗначениеs } from "../components/agent-config-defaults";
import { getUIАдаптер, listUIАдаптеры } from "../adapters";
import type { СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";
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
import { readZipАрхивировать } from "../lib/zip";
import { getПортableFileDataUrl, getПортableFileText, isПортableImageFile } from "../lib/portable-files";

// ── Импорт-specific helpers ───────────────────────────────────────────

/** Build a map from file path → planned action (create/update/skip) using the manifest + plan */
function buildActionMap(preview: КомпанияПортabilityПредпросмотрResult): Map<string, string> {
  const map = new Map<string, string>();
  const manifest = preview.manifest;

  for (const ap of preview.plan.agentPlans) {
    const agent = manifest.agents.find((a) => a.slug === ap.slug);
    if (agent) {
      const path = ensureMarkdownПуть(agent.path);
      map.set(path, ap.action);
    }
  }

  for (const pp of preview.plan.projectPlans) {
    const project = manifest.projects.find((p) => p.slug === pp.slug);
    if (project) {
      const path = ensureMarkdownПуть(project.path);
      map.set(path, pp.action);
    }
  }

  for (const ip of preview.plan.issuePlans) {
    const issue = manifest.issues.find((i) => i.slug === ip.slug);
    if (issue) {
      const path = ensureMarkdownПуть(issue.path);
      map.set(path, ip.action);
    }
  }

  for (const skill of manifest.skills) {
    const path = ensureMarkdownПуть(skill.path);
    map.set(path, "create");
    // Also mark skill file inventory
    for (const file of skill.fileInventory) {
      if (preview.files[file.path]) {
        map.set(file.path, "create");
      }
    }
  }

  // Компания file
  if (manifest.company) {
    const path = ensureMarkdownПуть(manifest.company.path);
    map.set(path, preview.plan.companyAction === "none" ? "skip" : preview.plan.companyAction);
  }

  return map;
}

function ensureMarkdownПуть(p: string): string {
  return p.endsWith(".md") ? p : `${p}.md`;
}

const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-500 border-emerald-500/30",
  update: "text-amber-500 border-amber-500/30",
  overwrite: "text-red-500 border-red-500/30",
  replace: "text-red-500 border-red-500/30",
  skip: "text-muted-foreground border-border",
  none: "text-muted-foreground border-border",
};

function FrontmatterCard({ data }: { data: FrontmatterData }) {
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
                    <span
                      key={item}
                      classИмя="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs"
                    >
                      {item}
                    </span>
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

// ── Импорт file tree customization ───────────────────────────────────

function renderИмпортFileExtra(node: FileTreeНетde, checked: boolean, renameMap: Map<string, string>) {
  // Show rename indicator only on directories (folders), not individual files
  const renamedTo = node.kind === "dir" ? renameMap.get(node.path) : undefined;
  const actionBadge = node.action ? (
    <span classИмя={cn(
      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
      ACTION_COLORS[node.action] ?? ACTION_COLORS.skip,
    )}>
      {checked ? node.action : "skip"}
    </span>
  ) : null;

  if (!actionBadge && !renamedTo) return null;

  return (
    <span classИмя="inline-flex items-center gap-1.5 shrink-0">
      {renamedTo && checked && (
        <span classИмя="text-[10px] text-cyan-500 font-mono truncate max-w-[7rem]" title={renamedTo}>
          &rarr; {renamedTo}
        </span>
      )}
      {actionBadge}
    </span>
  );
}

function importFileRowClassИмя(_node: FileTreeНетde, checked: boolean) {
  return !checked ? "opacity-50" : undefined;
}

// ── Предпросмотр pane ──────────────────────────────────────────────────────

function ИмпортПредпросмотрPane({
  selectedFile,
  content,
  allФайлы,
  action,
  renamedTo,
}: {
  selectedFile: string | null;
  content: КомпанияПортabilityFileEntry | null;
  allФайлы: Record<string, КомпанияПортabilityFileEntry>;
  action: string | null;
  renamedTo: string | null;
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
  const actionColor = action ? (ACTION_COLORS[action] ?? ACTION_COLORS.skip) : "";

  // Resolve relative image paths within the import package
  const resolveImageSrc = isMarkdown
    ? (src: string) => {
        if (/^(?:https?:|data:)/i.test(src)) return null;
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
        <div classИмя="flex items-center justify-between gap-3">
          <div classИмя="min-w-0 flex items-center gap-2">
            <span classИмя="truncate font-mono text-sm">{selectedFile}</span>
            {renamedTo && (
              <span classИмя="shrink-0 font-mono text-sm text-cyan-500">
                &rarr; {renamedTo}
              </span>
            )}
          </div>
          {action && (
            <span classИмя={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide",
              actionColor,
            )}>
              {action}
            </span>
          )}
        </div>
      </div>
      <div classИмя="min-h-[560px] px-5 py-5">
        {parsed ? (
          <>
            <FrontmatterCard data={parsed.data} />
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

// ── Conflict item type ───────────────────────────────────────────────

interface ConflictItem {
  slug: string;
  kind: "agent" | "project" | "issue" | "skill";
  originalИмя: string;
  plannedИмя: string;
  fileПуть: string | null;
  action: "rename" | "update";
}

function buildConflictList(
  preview: КомпанияПортabilityПредпросмотрResult,
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  const manifest = preview.manifest;

  // Агенты with collisions
  for (const ap of preview.plan.agentPlans) {
    if (ap.existingАгентId) {
      const agent = manifest.agents.find((a) => a.slug === ap.slug);
      conflicts.push({
        slug: ap.slug,
        kind: "agent",
        originalИмя: agent?.name ?? ap.slug,
        plannedИмя: ap.plannedИмя,
        fileПуть: agent ? ensureMarkdownПуть(agent.path) : null,
        action: ap.action === "update" ? "update" : "rename",
      });
    }
  }

  // Проекты with collisions
  for (const pp of preview.plan.projectPlans) {
    if (pp.existingProjectId) {
      const project = manifest.projects.find((p) => p.slug === pp.slug);
      conflicts.push({
        slug: pp.slug,
        kind: "project",
        originalИмя: project?.name ?? pp.slug,
        plannedИмя: pp.plannedИмя,
        fileПуть: project ? ensureMarkdownПуть(project.path) : null,
        action: pp.action === "update" ? "update" : "rename",
      });
    }
  }

  return conflicts;
}

/** Extract a prefix from the import source URL or uploaded zip package name */
function deriveSourcePrefix(
  sourceMode: string,
  importUrl: string,
  localPackageИмя: string | null,
  localRootПуть: string | null,
): string | null {
  if (sourceMode === "local") {
    if (localRootПуть) return localRootПуть.split("/").pop() ?? null;
    if (!localPackageИмя) return null;
    return localPackageИмя.replace(/\.zip$/i, "") || null;
  }
  if (sourceMode === "github") {
    const url = importUrl.trim();
    if (!url) return null;
    try {
      const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
      // For github URLs like /owner/repo/tree/branch/path - take last segment
      const segments = pathname.split("/").filter(Boolean);
      return segments.length > 0 ? segments[segments.length - 1] : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Generate a prefix-based rename: e.g. "gstack" + "CEO" → "gstack-CEO" */
function prefixedИмя(prefix: string | null, originalИмя: string): string {
  if (!prefix) return originalИмя;
  return `${prefix}-${originalИмя}`;
}

async function applyИмпортedSidebarOrder(
  preview: КомпанияПортabilityПредпросмотрResult | null,
  result: {
    company: { id: string };
    agents: Array<{ slug: string; id: string | null }>;
    projects: Array<{ slug: string; id: string | null }>;
  },
  userId: string | null | undefined,
) {
  const sidebar = preview?.manifest.sidebar;
  if (!sidebar) return;
  if (!userId?.trim()) return;

  const agentIdBySlug = new Map(
    result.agents
      .filter((agent): agent is { slug: string; id: string } => typeof agent.id === "string" && agent.id.length > 0)
      .map((agent) => [agent.slug, agent.id]),
  );
  const projectIdBySlug = new Map(
    result.projects
      .filter((project): project is { slug: string; id: string } => typeof project.id === "string" && project.id.length > 0)
      .map((project) => [project.slug, project.id]),
  );

  const orderedАгентIds = sidebar.agents
    .map((slug) => agentIdBySlug.get(slug))
    .filter((id): id is string => Boolean(id));
  const orderedProjectIds = sidebar.projects
    .map((slug) => projectIdBySlug.get(slug))
    .filter((id): id is string => Boolean(id));

  if (orderedАгентIds.length > 0) {
    writeАгентOrder(getАгентOrderStorageКлюч(result.company.id, userId), orderedАгентIds);
  }
  if (orderedProjectIds.length > 0) {
    await sidebarPreferencesApi.updateProjectOrder(result.company.id, { orderedIds: orderedProjectIds });
  }
}

// ── Conflict resolution UI ───────────────────────────────────────────

function ConflictResolutionList({
  conflicts,
  nameOverrides,
  skippedSlugs,
  confirmedSlugs,
  onRename,
  onToggleSkip,
  onToggleПодтвердить,
}: {
  conflicts: ConflictItem[];
  nameOverrides: Record<string, string>;
  skippedSlugs: Set<string>;
  confirmedSlugs: Set<string>;
  onRename: (slug: string, newИмя: string) => void;
  onToggleSkip: (slug: string, fileПуть: string | null) => void;
  onToggleПодтвердить: (slug: string) => void;
}) {
  if (conflicts.length === 0) return null;

  return (
    <div classИмя="mx-5 mt-3">
      <div classИмя="rounded-md border border-border">
        <div classИмя="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h3 classИмя="text-sm font-medium">
            Renames
          </h3>
          <span classИмя="text-xs text-muted-foreground">
            {conflicts.length} item{conflicts.length === 1 ? "" : "s"}
          </span>
        </div>
        <div classИмя="divide-y divide-border">
          {conflicts.map((item) => {
            const isSkipped = skippedSlugs.has(item.slug);
            const isПодтвердитьed = confirmedSlugs.has(item.slug);
            const currentИмя = nameOverrides[item.slug] ?? item.plannedИмя;
            return (
              <div
                key={item.slug}
                classИмя={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm",
                  isSkipped && "opacity-40",
                  isПодтвердитьed && !isSkipped && "bg-emerald-500/5",
                )}
              >
                {/* Skip button on the left */}
                <button
                  type="button"
                  classИмя={cn(
                    "shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors",
                    isSkipped
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50",
                  )}
                  onClick={() => onToggleSkip(item.slug, item.fileПуть)}
                >
                  {isSkipped ? "skipped" : "skip"}
                </button>

                <span classИмя={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                  isSkipped
                    ? "text-muted-foreground border-border"
                    : isПодтвердитьed
                      ? "text-emerald-500 border-emerald-500/30"
                      : "text-amber-500 border-amber-500/30",
                )}>
                  {item.kind}
                </span>

                <span classИмя={cn(
                  "shrink-0 font-mono text-xs",
                  isSkipped ? "text-muted-foreground line-through" : "text-muted-foreground",
                )}>
                  {item.originalИмя}
                </span>

                {!isSkipped && (
                  <>
                    <ArrowRight classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
                    {isПодтвердитьed ? (
                      <span classИмя="min-w-0 flex-1 font-mono text-xs text-emerald-500">
                        {currentИмя}
                      </span>
                    ) : (
                      <input
                        classИмя="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-foreground"
                        value={currentИмя}
                        onChange={(e) => onRename(item.slug, e.target.value)}
                      />
                    )}
                  </>
                )}

                {/* Подтвердить rename button on the right */}
                {!isSkipped && (
                  <button
                    type="button"
                    classИмя={cn(
                      "ml-auto shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1.5",
                      isПодтвердитьed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        : "border-border text-muted-foreground hover:bg-accent/50",
                    )}
                    onClick={() => onToggleПодтвердить(item.slug)}
                  >
                    {isПодтвердитьed ? (
                      <>
                        <Check classИмя="h-3 w-3" />
                        confirmed
                      </>
                    ) : (
                      "confirm rename"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Адаптер type options for import ───────────────────────────────────

const IMPORT_ADAPTER_OPTIONS: { value: string; label: string }[] = listUIАдаптеры().map((adapter) => ({
  value: adapter.type,
  label: adapterЯрлыки[adapter.type] ?? getАдаптерLabel(adapter.type),
}));

// ── Адаптер picker for imported agents ───────────────────────────────

interface АдаптерPickerItem {
  slug: string;
  name: string;
  adapterТип: string;
}

function АдаптерPickerList({
  agents,
  adapterOverrides,
  expandedSlugs,
  configЗначениеs,
  onChangeАдаптер,
  onToggleExpand,
  onChangeConfig,
}: {
  agents: АдаптерPickerItem[];
  adapterOverrides: Record<string, string>;
  expandedSlugs: Set<string>;
  configЗначениеs: Record<string, СоздатьConfigЗначениеs>;
  onChangeАдаптер: (slug: string, adapterТип: string) => void;
  onToggleExpand: (slug: string) => void;
  onChangeConfig: (slug: string, patch: Partial<СоздатьConfigЗначениеs>) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <div classИмя="mx-5 mt-3">
      <div classИмя="rounded-md border border-border">
        <div classИмя="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h3 classИмя="text-sm font-medium">Адаптеры</h3>
          <span classИмя="text-xs text-muted-foreground">
            {agents.length} agent{agents.length === 1 ? "" : "s"}
          </span>
        </div>
        <div classИмя="divide-y divide-border">
          {agents.map((agent) => {
            const selectedТип = adapterOverrides[agent.slug] ?? agent.adapterТип;
            const isExpanded = expandedSlugs.has(agent.slug);
            const vals = configЗначениеs[agent.slug] ?? { ...defaultСоздатьЗначениеs, adapterТип: selectedТип };

            return (
              <div key={agent.slug}>
                <div classИмя="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span classИмя={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                    "text-blue-500 border-blue-500/30",
                  )}>
                    agent
                  </span>
                  <span classИмя="shrink-0 font-mono text-xs text-muted-foreground">
                    {agent.name}
                  </span>
                  <ArrowRight classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
                  <select
                    classИмя="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground"
                    value={selectedТип}
                    onChange={(e) => onChangeАдаптер(agent.slug, e.target.value)}
                  >
                    {IMPORT_ADAPTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    classИмя={cn(
                      "ml-auto shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1.5",
                      isExpanded
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent/50",
                    )}
                    onClick={() => onToggleExpand(agent.slug)}
                  >
                    <ChevronRight classИмя={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                    configure adapter
                  </button>
                </div>
                {isExpanded && (
                  <div classИмя="border-t border-border bg-accent/10 px-4 py-3 space-y-3">
                    <АгентConfigForm
                      mode="create"
                      values={vals}
                      onChange={(patch) => onChangeConfig(agent.slug, patch)}
                      showАдаптерТипField={false}
                      showАдаптерПроверитьОкружениеButton={false}
                      showСоздатьЗапуститьPolicySection={false}
                      hideInstructionsFile
                      sectionLayout="cards"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

async function readLocalPackageZip(file: File): Promise<{
  name: string;
  rootПуть: string | null;
  files: Record<string, КомпанияПортabilityFileEntry>;
}> {
  if (!/\.zip$/i.test(file.name)) {
    throw new Ошибка("Select a .zip company package.");
  }
  const archive = await readZipАрхивировать(await file.arrayBuffer());
  if (Object.keys(archive.files).length === 0) {
    throw new Ошибка("Нет package files were found in the selected zip archive.");
  }
  return {
    name: file.name,
    rootПуть: archive.rootПуть,
    files: archive.files,
  };
}

// ── Main page ─────────────────────────────────────────────────────────

export function КомпанияИмпорт() {
  const {
    selectedКомпанияId,
    selectedКомпания,
    setSelectedКомпанияId,
  } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const packageInputRef = useRef<HTMLInputElement | null>(null);
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;

  // Source state
  const [sourceMode, setSourceMode] = useState<"github" | "local">("github");
  const [importUrl, setИмпортUrl] = useState("");
  const [localPackage, setLocalPackage] = useState<{
    name: string;
    rootПуть: string | null;
    files: Record<string, КомпанияПортabilityFileEntry>;
  } | null>(null);

  // Цель state
  const [targetMode, setЦельMode] = useState<"existing" | "new">("new");
  const [newКомпанияИмя, setNewКомпанияИмя] = useState("");

  // Предпросмотр state
  const [importПредпросмотр, setИмпортПредпросмотр] =
    useState<КомпанияПортabilityПредпросмотрResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [checkedФайлы, setCheckedФайлы] = useState<Set<string>>(new Set());

  // Conflict resolution state
  const [nameOverrides, setИмяOverrides] = useState<Record<string, string>>({});
  const [skippedSlugs, setSkippedSlugs] = useState<Set<string>>(new Set());
  const [confirmedSlugs, setПодтвердитьedSlugs] = useState<Set<string>>(new Set());
  const [collisionStrategy, setCollisionStrategy] = useState<КомпанияПортabilityCollisionStrategy>("rename");

  // Адаптер override state
  const [adapterOverrides, setАдаптерOverrides] = useState<Record<string, string>>({});
  const [adapterExpandedSlugs, setАдаптерExpandedSlugs] = useState<Set<string>>(new Set());
  const [adapterConfigЗначениеs, setАдаптерConfigЗначениеs] = useState<Record<string, СоздатьConfigЗначениеs>>({});

  // Fetch current company agents to find CEO adapter type
  const { data: companyАгенты } = useQuery({
    queryКлюч: selectedКомпанияId ? queryКлючs.agents.list(selectedКомпанияId) : ["agents", "none"],
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });
  const ceoАдаптерТип = useMemo(() => {
    if (!companyАгенты) return "claude_local";
    const ceo = companyАгенты.find((a) => a.role === "ceo");
    return ceo?.adapterТип ?? "claude_local";
  }, [companyАгенты]);

  const localZipHelpText =
    "Загрузить a .zip exported directly from Paperclip. Re-zipped archives created by Finder, Explorer, or other zip tools may not import correctly.";

  useEffect(() => {
    setBreadcrumbs([
      { label: "Оргструктура Chart", href: "/org" },
      { label: "Импорт" },
    ]);
  }, [setBreadcrumbs]);

  function buildSource(): КомпанияПортabilitySource | null {
    if (sourceMode === "local") {
      if (!localPackage) return null;
      return { type: "inline", rootПуть: localPackage.rootПуть, files: localPackage.files };
    }
    const url = importUrl.trim();
    if (!url) return null;
    return { type: "github", url };
  }

  // Предпросмотр mutation
  const previewMutation = useMutation({
    mutationFn: () => {
      const source = buildSource();
      if (!source) throw new Ошибка("Нет source configured.");
      return companiesApi.importПредпросмотр({
        source,
        include: { company: true, agents: true, projects: true, issues: true },
        target:
          targetMode === "new"
            ? { mode: "new_company", newКомпанияИмя: newКомпанияИмя || null }
            : { mode: "existing_company", companyId: selectedКомпанияId! },
        collisionStrategy,
      });
    },
    onУспешно: (result) => {
      setИмпортПредпросмотр(result);

      // Build conflicts and set default name overrides with prefix
      const conflicts = buildConflictList(result);
      const prefix = deriveSourcePrefix(
        sourceMode,
        importUrl,
        localPackage?.name ?? null,
        localPackage?.rootПуть ?? null,
      );
      const defaultOverrides: Record<string, string> = {};

      for (const c of conflicts) {
        if (c.action === "rename" && prefix) {
          // Use prefix-based default rename
          defaultOverrides[c.slug] = prefixedИмя(prefix, c.originalИмя);
        }
      }
      setИмяOverrides(defaultOverrides);
      setSkippedSlugs(new Set());
      setПодтвердитьedSlugs(new Set());

      // Initialize adapter overrides — default all agents to the CEO's adapter type
      const defaultАдаптеры: Record<string, string> = {};
      for (const agent of result.manifest.agents) {
        defaultАдаптеры[agent.slug] = ceoАдаптерТип;
      }
      setАдаптерOverrides(defaultАдаптеры);
      setАдаптерExpandedSlugs(new Set());
      setАдаптерConfigЗначениеs({});

      // Check all files by default, then uncheck COMPANY.md for existing company
      const allФайлы = new Set(Object.keys(result.files));
      if (targetMode === "existing" && result.manifest.company && result.plan.companyAction === "update") {
        const companyПуть = ensureMarkdownПуть(result.manifest.company.path);
        allФайлы.delete(companyПуть);
      }
      setCheckedФайлы(allФайлы);

      // Expand top-level dirs + all ancestor dirs of files with conflicts (update action)
      const am = buildActionMap(result);
      const tree = buildFileTree(result.files, am);
      const dirsToExpand = new Set<string>();
      for (const node of tree) {
        if (node.kind === "dir") dirsToExpand.add(node.path);
      }
      // Авто-expand directories containing conflicting files so they're visible
      for (const [fileПуть, action] of am) {
        if (action === "update") {
          const segments = fileПуть.split("/").filter(Boolean);
          let current = "";
          for (let i = 0; i < segments.length - 1; i++) {
            current = current ? `${current}/${segments[i]}` : segments[i];
            dirsToExpand.add(current);
          }
        }
      }
      setExpandedDirs(dirsToExpand);
      // Select first file
      const firstFile = Object.keys(result.files)[0];
      if (firstFile) setSelectedFile(firstFile);
    },
    onОшибка: (err) => {
      pushToast({
        tone: "error",
        title: "Предпросмотр failed",
        body: err instanceof Ошибка ? err.message : "Ошибка to preview import.",
      });
    },
  });

  // Build the final nameOverrides to send (only overrides that differ from plannedИмя)
  function buildFinalИмяOverrides(): Record<string, string> | undefined {
    if (!importПредпросмотр) return undefined;
    const overrides: Record<string, string> = {};
    for (const [slug, name] of Object.entries(nameOverrides)) {
      if (name.trim()) {
        overrides[slug] = name.trim();
      }
    }
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }

  function buildSelectedФайлы(): string[] | undefined {
    const selected = Array.from(checkedФайлы).sort();
    return selected.length > 0 ? selected : undefined;
  }

  // Apply mutation
  const importMutation = useMutation({
    mutationFn: () => {
      const source = buildSource();
      if (!source) throw new Ошибка("Нет source configured.");
      return companiesApi.importBundle({
        source,
        include: { company: true, agents: true, projects: true, issues: true },
        target:
          targetMode === "new"
            ? { mode: "new_company", newКомпанияИмя: newКомпанияИмя || null }
            : { mode: "existing_company", companyId: selectedКомпанияId! },
        collisionStrategy,
        nameOverrides: buildFinalИмяOverrides(),
        selectedФайлы: buildSelectedФайлы(),
        adapterOverrides: buildFinalАдаптерOverrides(),
      });
    },
    onУспешно: async (result) => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      const importedКомпания = await companiesApi.get(result.company.id);
      const refreshedSession = currentUserId
        ? null
        : await queryClient.fetchQuery({
          queryКлюч: queryКлючs.auth.session,
          queryFn: () => authApi.getSession(),
        });
      const sidebarOrderUserId =
        currentUserId
        ?? refreshedSession?.user?.id
        ?? refreshedSession?.session?.userId
        ?? null;
      await applyИмпортedSidebarOrder(importПредпросмотр, result, sidebarOrderUserId);
      setSelectedКомпанияId(importedКомпания.id);
      pushToast({
        tone: "success",
        title: "Импорт complete",
        body: `${result.company.name}: ${result.agents.length} agent${result.agents.length === 1 ? "" : "s"} processed.`,
      });
      // Force a fresh dashboard load so newly imported agents are immediately visible.
      window.location.assign(`/${importedКомпания.issuePrefix}/dashboard`);
    },
    onОшибка: (err) => {
      pushToast({
        tone: "error",
        title: "Импорт failed",
        body: err instanceof Ошибка ? err.message : "Ошибка to apply import.",
      });
    },
  });

  async function handleChooseLocalPackage(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const pkg = await readLocalPackageZip(fileList[0]!);
      setLocalPackage(pkg);
      setИмпортПредпросмотр(null);
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Package read failed",
        body: err instanceof Ошибка ? err.message : "Ошибка to read folder.",
      });
    }
  }

  const actionMap = useMemo(
    () => (importПредпросмотр ? buildActionMap(importПредпросмотр) : new Map<string, string>()),
    [importПредпросмотр],
  );

  const tree = useMemo(
    () => (importПредпросмотр ? buildFileTree(importПредпросмотр.files, actionMap) : []),
    [importПредпросмотр, actionMap],
  );

  const conflicts = useMemo(
    () => (importПредпросмотр ? buildConflictList(importПредпросмотр) : []),
    [importПредпросмотр],
  );

  // Map directory paths → planned rename name for display in the file tree
  // Also maps file paths for use in the preview header
  const renameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!importПредпросмотр) return map;
    for (const c of conflicts) {
      if (!c.fileПуть) continue;
      const isSkipped = skippedSlugs.has(c.slug);
      if (isSkipped) continue;
      const renamedTo = nameOverrides[c.slug] ?? c.plannedИмя;
      if (renamedTo === c.originalИмя) continue;
      // Map the parent directory (e.g. agents/ceo → gstack-ceo) for the file tree
      const parentDir = c.fileПуть.split("/").slice(0, -1).join("/");
      if (parentDir) map.set(parentDir, renamedTo);
      // Map the file path too — used by the preview header, not shown in tree
      map.set(c.fileПуть, renamedTo);
    }
    return map;
  }, [importПредпросмотр, conflicts, nameOverrides, skippedSlugs]);

  const totalФайлы = useMemo(() => countФайлы(tree), [tree]);
  const selectedCount = checkedФайлы.size;

  function handleToggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleToggleCheck(path: string, kind: "file" | "dir") {
    if (!importПредпросмотр) return;
    setCheckedФайлы((prev) => {
      const next = new Set(prev);
      if (kind === "file") {
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        const findНетde = (nodes: FileTreeНетde[], target: string): FileTreeНетde | null => {
          for (const n of nodes) {
            if (n.path === target) return n;
            const found = findНетde(n.children, target);
            if (found) return found;
          }
          return null;
        };
        const dirНетde = findНетde(tree, path);
        if (dirНетde) {
          const childФайлы = collectВсеПутьs(dirНетde.children, "file");
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

  function handleConflictRename(slug: string, newИмя: string) {
    setИмяOverrides((prev) => ({ ...prev, [slug]: newИмя }));
    // Изменитьing the name un-confirms
    setПодтвердитьedSlugs((prev) => {
      if (!prev.has(slug)) return prev;
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }

  function handleConflictToggleПодтвердить(slug: string) {
    setПодтвердитьedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function handleConflictToggleSkip(slug: string, fileПуть: string | null) {
    setSkippedSlugs((prev) => {
      const next = new Set(prev);
      const wasSkipped = next.has(slug);
      if (wasSkipped) {
        next.delete(slug);
      } else {
        next.add(slug);
      }

      // Sync with file tree checkboxes
      if (fileПуть) {
        setCheckedФайлы((prevChecked) => {
          const nextChecked = new Set(prevChecked);
          if (wasSkipped) {
            nextChecked.add(fileПуть);
          } else {
            nextChecked.delete(fileПуть);
          }
          return nextChecked;
        });
      }

      return next;
    });
  }

  function handleАдаптерChange(slug: string, adapterТип: string) {
    setАдаптерOverrides((prev) => ({ ...prev, [slug]: adapterТип }));
    // Сбросить config values when adapter type changes
    setАдаптерConfigЗначениеs((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }

  function handleАдаптерToggleExpand(slug: string) {
    setАдаптерExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function handleАдаптерConfigChange(slug: string, patch: Partial<СоздатьConfigЗначениеs>) {
    setАдаптерConfigЗначениеs((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? { ...defaultСоздатьЗначениеs, adapterТип: adapterOverrides[slug] ?? "claude_local" }), ...patch },
    }));
  }

  // Build the list of agents for adapter picking
  const adapterАгенты = useMemo<АдаптерPickerItem[]>(() => {
    if (!importПредпросмотр) return [];
    return importПредпросмотр.manifest.agents.map((a) => ({
      slug: a.slug,
      name: a.name,
      adapterТип: a.adapterТип,
    }));
  }, [importПредпросмотр]);

  // Build final adapterOverrides for import request
  function buildFinalАдаптерOverrides(): Record<string, КомпанияПортabilityАдаптерOverride> | undefined {
    if (adapterАгенты.length === 0) return undefined;
    const overrides: Record<string, КомпанияПортabilityАдаптерOverride> = {};
    for (const agent of adapterАгенты) {
      const selectedТип = adapterOverrides[agent.slug] ?? agent.adapterТип;
      const configVals = adapterConfigЗначениеs[agent.slug];
      const override: КомпанияПортabilityАдаптерOverride = { adapterТип: selectedТип };
      if (configVals) {
        const uiАдаптер = getUIАдаптер(selectedТип);
        override.adapterConfig = uiАдаптер.buildАдаптерConfig(configVals);
      }
      overrides[agent.slug] = override;
    }
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }

  const hasSource =
    sourceMode === "local" ? !!localPackage : importUrl.trim().length > 0;
  const hasОшибкаs = importПредпросмотр ? importПредпросмотр.errors.length > 0 : false;

  const previewContent = selectedFile && importПредпросмотр
    ? (() => {
        return importПредпросмотр.files[selectedFile] ?? null;
      })()
    : null;
  const selectedAction = selectedFile ? (actionMap.get(selectedFile) ?? null) : null;

  if (!selectedКомпанияId) {
    return <EmptyState icon={Скачать} message="Select a company to import into." />;
  }

  return (
    <div>
      {/* Source form section */}
      <div classИмя="border-b border-border px-5 py-5 space-y-4">
        <div>
          <h2 classИмя="text-base font-semibold">Импорт source</h2>
          <p classИмя="text-xs text-muted-foreground mt-1">
            Choose a Репозиторий GitHub or upload a local Paperclip zip package.
          </p>
        </div>

        <div classИмя="grid gap-2 md:grid-cols-2">
          {(
            [
              { key: "github", icon: Github, label: "Репозиторий GitHub" },
              { key: "local", icon: Загрузить, label: "Local zip" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              classИмя={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                sourceMode === key
                  ? "border-foreground bg-accent"
                  : "border-border hover:bg-accent/50",
              )}
              onClick={() => {
                setSourceMode(key);
                setИмпортПредпросмотр(null);
              }}
            >
              <div classИмя="flex items-center gap-2">
                <Icon classИмя="h-4 w-4" />
                {label}
              </div>
            </button>
          ))}
        </div>

        {sourceMode === "local" ? (
          <div classИмя="rounded-md border border-dashed border-border px-3 py-3">
            <input
              ref={packageInputRef}
              type="file"
              accept=".zip,application/zip"
              classИмя="hidden"
              onChange={handleChooseLocalPackage}
            />
            <div classИмя="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => packageInputRef.current?.click()}
              >
                Choose zip
              </Button>
              {localPackage && (
                <span classИмя="text-xs text-muted-foreground">
                  {localPackage.name} with{" "}
                  {Object.keys(localPackage.files).length} file
                  {Object.keys(localPackage.files).length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {!localPackage && (
              <p classИмя="mt-2 text-xs text-muted-foreground">
                {localZipHelpText}
              </p>
            )}
          </div>
        ) : (
          <Field
            label="GitHub URL"
            hint="Репозиторий tree path or blob URL to COMPANY.md (e.g. github.com/owner/repo/tree/main/company)."
          >
            <input
              classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={importUrl}
              placeholder="https://github.com/owner/repo/tree/main/company"
              onChange={(e) => {
                setИмпортUrl(e.target.value);
                setИмпортПредпросмотр(null);
              }}
            />
          </Field>
        )}

        <Field label="Цель" hint="Импорт into this company or create a new one.">
          <select
            classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={targetMode}
            onChange={(e) => {
              setЦельMode(e.target.value as "existing" | "new");
              setИмпортПредпросмотр(null);
            }}
          >
            <option value="new">Создать new company</option>
            <option value="existing">
              Existing company: {selectedКомпания?.name}
            </option>
          </select>
        </Field>

        {targetMode === "new" && (
          <Field
            label="New company name"
            hint="Опционально override. Leave blank to use the package name."
          >
            <input
              classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={newКомпанияИмя}
              onChange={(e) => setNewКомпанияИмя(e.target.value)}
              placeholder="Импортed Компания"
            />
          </Field>
        )}

        <Field
          label="Collision strategy"
          hint="Совет imports can rename, skip, or replace matching company content."
        >
          <select
            classИмя="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={collisionStrategy}
            onChange={(e) => {
              setCollisionStrategy(e.target.value as КомпанияПортabilityCollisionStrategy);
              setИмпортПредпросмотр(null);
            }}
          >
            <option value="rename">Rename on conflict</option>
            <option value="skip">Skip on conflict</option>
            <option value="replace">Replace existing</option>
          </select>
        </Field>

        <div classИмя="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isОжидание || !hasSource}
          >
            {previewMutation.isОжидание ? "Предпросмотрing..." : "Предпросмотр import"}
          </Button>
        </div>
      </div>

      {/* Предпросмотр results */}
      {importПредпросмотр && (
        <>
          {/* Sticky import action bar */}
          <div classИмя="sticky top-0 z-10 border-b border-border bg-background px-5 py-3">
            <div classИмя="flex flex-wrap items-center gap-4 text-sm">
              <span classИмя="font-medium">
                Импорт preview
              </span>
              <span classИмя="text-muted-foreground">
                {selectedCount} / {totalФайлы} file{totalФайлы === 1 ? "" : "s"} selected
              </span>
              {conflicts.length > 0 && (
                <span classИмя="text-amber-500">
                  {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
                </span>
              )}
              {importПредпросмотр.errors.length > 0 && (
                <span classИмя="text-destructive">
                  {importПредпросмотр.errors.length} error{importПредпросмотр.errors.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {/* Conflict resolution list */}
          <ConflictResolutionList
            conflicts={conflicts}
            nameOverrides={nameOverrides}
            skippedSlugs={skippedSlugs}
            confirmedSlugs={confirmedSlugs}
            onRename={handleConflictRename}
            onToggleSkip={handleConflictToggleSkip}
            onToggleПодтвердить={handleConflictToggleПодтвердить}
          />

          {/* Адаптер picker list */}
          <АдаптерPickerList
            agents={adapterАгенты}
            adapterOverrides={adapterOverrides}
            expandedSlugs={adapterExpandedSlugs}
            configЗначениеs={adapterConfigЗначениеs}
            onChangeАдаптер={handleАдаптерChange}
            onToggleExpand={handleАдаптерToggleExpand}
            onChangeConfig={handleАдаптерConfigChange}
          />

          {/* Импорт button — below renames */}
          <div classИмя="mx-5 mt-3 flex justify-end">
            <Button
              size="sm"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isОжидание || hasОшибкаs || selectedCount === 0}
            >
              <Скачать classИмя="mr-1.5 h-3.5 w-3.5" />
              {importMutation.isОжидание
                ? "Импортing..."
                : `Импорт ${selectedCount} file${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>

          {/* Предупреждениеs */}
          {importПредпросмотр.warnings.length > 0 && (
            <div classИмя="mx-5 mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              {importПредпросмотр.warnings.map((w) => (
                <div key={w} classИмя="text-xs text-amber-500">{w}</div>
              ))}
            </div>
          )}

          {/* Ошибкаs */}
          {importПредпросмотр.errors.length > 0 && (
            <div classИмя="mx-5 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              {importПредпросмотр.errors.map((e) => (
                <div key={e} classИмя="text-xs text-destructive">{e}</div>
              ))}
            </div>
          )}

          {/* Two-column layout */}
          <div classИмя="grid h-[calc(100vh-16rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
            <aside classИмя="flex flex-col border-r border-border overflow-hidden">
              <div classИмя="border-b border-border px-4 py-3 shrink-0">
                <h2 classИмя="text-base font-semibold">Package files</h2>
              </div>
              <div classИмя="flex-1 overflow-y-auto">
                <FileTree
                  nodes={tree}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  checkedФайлы={checkedФайлы}
                  onToggleDir={handleToggleDir}
                  onSelectFile={setSelectedFile}
                  onToggleCheck={handleToggleCheck}
                  renderFileExtra={(node, checked) => renderИмпортFileExtra(node, checked, renameMap)}
                  fileRowClassИмя={importFileRowClassИмя}
                  wrapЯрлыки={false}
                />
              </div>
            </aside>
            <div classИмя="min-w-0 overflow-y-auto pl-6">
              <ИмпортПредпросмотрPane
                selectedFile={selectedFile}
                content={previewContent}
                allФайлы={importПредпросмотр?.files ?? {}}
                action={selectedAction}
                renamedTo={selectedFile ? (renameMap.get(selectedFile) ?? null) : null}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
