import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DocumentRevision } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { queryКлючs } from "../lib/queryКлючs";
import { buildLineDiff, type DiffRow } from "../lib/line-diff";
import { relativeTime } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";

function getRevisionLabel(revision: DocumentRevision) {
  const actor = revision.createdByUserId
    ? "board"
    : revision.createdByАгентId
      ? "agent"
      : "system";
  return `rev ${revision.revisionNumber} — ${relativeTime(revision.createdAt)} • ${actor}`;
}

export function DocumentDiffModal({
  issueId,
  documentКлюч,
  latestRevisionNumber,
  open,
  onOpenChange,
}: {
  issueId: string;
  documentКлюч: string;
  latestRevisionNumber: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: revisions } = useQuery({
    queryКлюч: queryКлючs.issues.documentRevisions(issueId, documentКлюч),
    queryFn: () => issuesApi.listDocumentRevisions(issueId, documentКлюч),
    enabled: open,
  });

  const sortedRevisions = useMemo(() => {
    if (!revisions) return [];
    return [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);
  }, [revisions]);

  // По умолчанию: compare previous (latestRevisionNumber - 1) with current (latestRevisionNumber)
  const [leftRevisionId, setLeftRevisionId] = useState<string | null>(null);
  const [rightRevisionId, setRightRevisionId] = useState<string | null>(null);

  const effectiveLeftId = leftRevisionId ?? sortedRevisions.find(
    (r) => r.revisionNumber === latestRevisionNumber - 1,
  )?.id ?? null;

  const effectiveRightId = rightRevisionId ?? sortedRevisions.find(
    (r) => r.revisionNumber === latestRevisionNumber,
  )?.id ?? null;

  const leftRevision = sortedRevisions.find((r) => r.id === effectiveLeftId) ?? null;
  const rightRevision = sortedRevisions.find((r) => r.id === effectiveRightId) ?? null;

  const leftBody = leftRevision?.body ?? "";
  const rightBody = rightRevision?.body ?? "";
  const diffRows = useMemo(() => buildLineDiff(leftBody, rightBody), [leftBody, rightBody]);

  const lineClassesByKind: Record<DiffRow["kind"], string> = {
    context: "bg-transparent",
    removed: "bg-red-500/10 text-red-100",
    added: "bg-green-500/10 text-green-100",
  };

  const markerByKind: Record<DiffRow["kind"], string> = {
    context: " ",
    removed: "-",
    added: "+",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="!max-w-[90%] w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div classИмя="flex items-center justify-between gap-4">
          <DialogHeader classИмя="shrink-0">
            <DialogНазвание>
              Diff — <span classИмя="font-mono text-sm">{documentКлюч}</span>
            </DialogНазвание>
          </DialogHeader>

          <div classИмя="flex items-center gap-4 shrink-0">
            <div classИмя="flex items-center gap-2">
              <span classИмя="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">Old</span>
              <Select
                value={effectiveLeftId ?? ""}
                onЗначениеChange={(value) => setLeftRevisionId(value)}
              >
                <SelectTrigger classИмя="h-7 w-60 text-xs border-border/60">
                  <SelectЗначение placeholder="Select revision" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRevisions.map((revision) => (
                    <SelectItem key={revision.id} value={revision.id} classИмя="text-xs">
                      {getRevisionLabel(revision)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div classИмя="flex items-center gap-2">
              <span classИмя="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">New</span>
              <Select
                value={effectiveRightId ?? ""}
                onЗначениеChange={(value) => setRightRevisionId(value)}
              >
                <SelectTrigger classИмя="h-7 w-60 text-xs border-border/60">
                  <SelectЗначение placeholder="Select revision" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRevisions.map((revision) => (
                    <SelectItem key={revision.id} value={revision.id} classИмя="text-xs">
                      {getRevisionLabel(revision)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div classИмя="overflow-auto flex-1 rounded-md border border-border text-xs">
          {!revisions ? (
            <div classИмя="p-6 text-center text-muted-foreground text-sm">Загрузка revisions...</div>
          ) : !leftRevision || !rightRevision ? (
            <div classИмя="p-6 text-center text-muted-foreground text-sm">Select two revisions to compare.</div>
          ) : leftRevision.id === rightRevision.id ? (
            <div classИмя="p-6 text-center text-muted-foreground text-sm">Ботh sides are the same revision.</div>
          ) : (
            <div classИмя="font-mono text-[12px] leading-6">
              <div classИмя="grid grid-cols-[56px_56px_24px_minmax(0,1fr)] border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Old</span>
                <span>New</span>
                <span />
                <span>Content</span>
              </div>
              {diffRows.map((row, index) => (
                <div
                  key={`${row.kind}-${index}-${row.oldLineNumber ?? "x"}-${row.newLineNumber ?? "x"}`}
                  classИмя={`grid grid-cols-[56px_56px_24px_minmax(0,1fr)] gap-0 border-b border-border/30 px-3 ${lineClassesByKind[row.kind]}`}
                >
                  <span classИмя="select-none border-r border-border/30 pr-3 text-right text-muted-foreground">
                    {row.oldLineNumber ?? ""}
                  </span>
                  <span classИмя="select-none border-r border-border/30 px-3 text-right text-muted-foreground">
                    {row.newLineNumber ?? ""}
                  </span>
                  <span classИмя="select-none px-3 text-center text-muted-foreground">
                    {markerByKind[row.kind]}
                  </span>
                  <pre classИмя="overflow-x-auto whitespace-pre-wrap break-words px-3 py-0 text-inherit">
                    {row.text.length > 0 ? row.text : " "}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
