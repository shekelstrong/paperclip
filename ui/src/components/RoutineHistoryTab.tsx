import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { История as ИсторияIcon, RotateCcw } from "lucide-react";
import type {
  Процедура,
  ПроцедураRevision,
  ПроцедураRevisionSnapshotTriggerV1,
  ПроцедураVariable,
} from "@paperclipai/shared";
import {
  routinesApi,
  type RestoreПроцедураRevisionResponse,
} from "../api/routines";
import { ApiОшибка } from "../api/client";
import { queryКлючs } from "../lib/queryКлючs";
import { relativeTime } from "../lib/utils";
import { useToastActions } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { MarkdownBody } from "./MarkdownBody";

type АгентLookup = Map<string, { id: string; name: string }>;
type ProjectLookup = Map<string, { id: string; name: string }>;

type DirtyFieldDescriptor = {
  key: string;
  label: string;
};

type Props = {
  routine: Процедура;
  isИзменитьDirty: boolean;
  dirtyFields: DirtyFieldDescriptor[];
  onDiscardИзменитьs: () => void;
  onСохранитьИзменитьs: () => void;
  agents: АгентLookup;
  projects: ProjectLookup;
  onRestoreСекретMaterials: (response: RestoreПроцедураRevisionResponse) => void;
  onRestored?: (response: RestoreПроцедураRevisionResponse) => void;
};

export function ПроцедураИсторияTab({
  routine,
  isИзменитьDirty,
  dirtyFields,
  onDiscardИзменитьs,
  onСохранитьИзменитьs,
  agents,
  projects,
  onRestoreСекретMaterials,
  onRestored,
}: Props) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [highlightedRevisionId, setВысокийlightedRevisionId] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [confirmOpen, setПодтвердитьOpen] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState("");

  const revisionsQuery = useQuery({
    queryКлюч: queryКлючs.routines.revisions(routine.id),
    queryFn: () => routinesApi.listRevisions(routine.id),
  });

  const revisions = useMemo(() => revisionsQuery.data ?? [], [revisionsQuery.data]);
  const sortedRevisions = useMemo(
    () => [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber),
    [revisions],
  );
  const currentRevision = useMemo(
    () => sortedRevisions.find((r) => r.id === routine.latestRevisionId) ?? sortedRevisions[0] ?? null,
    [sortedRevisions, routine.latestRevisionId],
  );

  const selectedRevision = useMemo(
    () => sortedRevisions.find((r) => r.id === selectedRevisionId) ?? null,
    [sortedRevisions, selectedRevisionId],
  );
  const isHistoricalSelected = !!selectedRevision && selectedRevision.id !== routine.latestRevisionId;
  const visibleRevisions = useMemo(() => {
    if (showOlder || sortedRevisions.length <= 8) return sortedRevisions;
    return sortedRevisions.slice(0, 8);
  }, [sortedRevisions, showOlder]);

  const restoreMutation = useMutation({
    mutationFn: (input: { revisionId: string; changeSummary: string }) =>
      routinesApi.restoreRevision(routine.id, input.revisionId, {
        changeSummary: input.changeSummary.trim() || null,
      }),
    onУспешно: async (data) => {
      const restoredFromNumber = data.restoredFromRevisionNumber;
      const newNumber = data.revision.revisionNumber;
      pushToast({
        title: `Restored revision ${restoredFromNumber} as revision ${newNumber}`,
        body: data.secretMaterials.length > 0
          ? "Trigger enabled state was restored from the snapshot. New webhook secrets are available in the banner above."
          : "Trigger enabled state was restored from the snapshot.",
        tone: "success",
      });
      onRestoreСекретMaterials(data);
      onRestored?.(data);
      setПодтвердитьOpen(false);
      setSnapshotOpen(false);
      setCompareOn(false);
      setRestoreSummary("");
      setSelectedRevisionId(data.revision.id);
      setВысокийlightedRevisionId(data.revision.id);
      window.setTimeout(() => {
        setВысокийlightedRevisionId((current) =>
          current === data.revision.id ? null : current,
        );
      }, 3000);
      await Promise.all([
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.detail(routine.id) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.runs(routine.id) }),
        queryClient.invalidateQueries({
          queryКлюч: queryКлючs.routines.activity(routine.companyId, routine.id),
        }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.list(routine.companyId) }),
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.routines.revisions(routine.id) }),
      ]);
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to restore revision",
        body: error instanceof Ошибка ? error.message : "Paperclip could not restore the revision.",
        tone: "error",
      });
    },
  });

  const handleSelectRevision = (revisionId: string) => {
    if (isИзменитьDirty) return;
    setSelectedRevisionId(revisionId);
    setCompareOn(false);
    setSnapshotOpen(true);
  };

  const openRestoreПодтвердить = () => {
    if (!selectedRevision || !isHistoricalSelected) return;
    setRestoreSummary("");
    setSnapshotOpen(false);
    setCompareOn(false);
    setПодтвердитьOpen(true);
  };

  const confirmRestore = () => {
    if (!selectedRevision) return;
    restoreMutation.mutate({
      revisionId: selectedRevision.id,
      changeSummary: restoreSummary,
    });
  };

  if (revisionsQuery.isЗагрузка) {
    return (
      <div classИмя="grid gap-5">
        <div classИмя="space-y-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} classИмя="h-10 w-full" />
          ))}
        </div>
        <Skeleton classИмя="h-32 w-full" />
      </div>
    );
  }

  if (revisionsQuery.error) {
    return (
      <div classИмя="rounded-md border border-l-2 border-l-destructive border-border p-4 space-y-3">
        <div>
          <p classИмя="text-sm font-medium">Could not load revisions</p>
          <p classИмя="text-xs text-muted-foreground">
            {revisionsQuery.error instanceof Ошибка
              ? revisionsQuery.error.message
              : "Неизвестно error loading revisions."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => revisionsQuery.refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  const onlyBootstrapRevision = revisions.length <= 1;

  return (
    <div classИмя="grid gap-5">
      {isИзменитьDirty && (
        <ConflictBanner
          dirtyFields={dirtyFields}
          onDiscard={onDiscardИзменитьs}
          onСохранить={onСохранитьИзменитьs}
        />
      )}
      {!isИзменитьDirty && onlyBootstrapRevision ? (
        <div classИмя="space-y-2">
          <EmptyState icon={ИсторияIcon} message="Нет edits yet" />
          <p classИмя="text-center text-xs text-muted-foreground">
            Revision 1 is the only history this routine has. Saving an edit creates the first
            additional revision.
          </p>
        </div>
      ) : (
        <RevisionList
          revisions={visibleRevisions}
          latestRevisionId={routine.latestRevisionId}
          selectedRevisionId={selectedRevisionId}
          highlightedRevisionId={highlightedRevisionId}
          isИзменитьDirty={isИзменитьDirty}
          totalRevisions={sortedRevisions.length}
          onSelect={handleSelectRevision}
          onShowOlder={() => setShowOlder(true)}
          showOlder={showOlder}
        />
      )}

      {selectedRevision && (
        <RevisionSnapshotDialog
          open={snapshotOpen}
          onOpenChange={(next) => {
            setSnapshotOpen(next);
            if (!next) setCompareOn(false);
          }}
          revision={selectedRevision}
          currentRevision={currentRevision}
          isHistorical={isHistoricalSelected}
          compareOn={compareOn}
          onCompareToggle={setCompareOn}
          agents={agents}
          projects={projects}
          onRestore={openRestoreПодтвердить}
          restoreОжидание={restoreMutation.isОжидание}
          highlighted={highlightedRevisionId === selectedRevision.id}
        />
      )}

      {selectedRevision && currentRevision && (
        <RestoreПодтвердитьDialog
          open={confirmOpen}
          onOpenChange={setПодтвердитьOpen}
          target={selectedRevision}
          currentRevisionNumber={currentRevision.revisionNumber}
          changeSummary={restoreSummary}
          onChangeSummaryChange={setRestoreSummary}
          onПодтвердить={confirmRestore}
          pending={restoreMutation.isОжидание}
          recreatedWebhookЯрлыки={collectWebhookTriggerDifferences(
            selectedRevision,
            currentRevision,
          )}
        />
      )}
    </div>
  );
}

function RevisionSnapshotDialog({
  open,
  onOpenChange,
  revision,
  currentRevision,
  isHistorical,
  compareOn,
  onCompareToggle,
  agents,
  projects,
  onRestore,
  restoreОжидание,
  highlighted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: ПроцедураRevision;
  currentRevision: ПроцедураRevision | null;
  isHistorical: boolean;
  compareOn: boolean;
  onCompareToggle: (next: boolean) => void;
  agents: АгентLookup;
  projects: ProjectLookup;
  onRestore: () => void;
  restoreОжидание: boolean;
  highlighted: boolean;
}) {
  const showCompare = compareOn && !!currentRevision && isHistorical;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        classИмя={`${
          showCompare ? "!max-w-[95%]" : "!max-w-[90%]"
        } w-full max-h-[85vh] overflow-hidden flex flex-col`}
      >
        <DialogHeader>
          <div classИмя="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogНазвание>
              {isHistorical
                ? `Viewing revision ${revision.revisionNumber} (read-only)`
                : `Revision ${revision.revisionNumber} (current)`}
            </DialogНазвание>
            {isHistorical && currentRevision && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCompareToggle(!compareOn)}
              >
                {compareOn ? "Hide current" : "Compare with current"}
              </Button>
            )}
          </div>
          {isHistorical && currentRevision && (
            <DialogОписание>
              Restoring this revision creates a new revision {currentRevision.revisionNumber + 1}{" "}
              with the same content. История stays append-only.
            </DialogОписание>
          )}
        </DialogHeader>
        <div classИмя="overflow-auto flex-1">
          {showCompare && currentRevision ? (
            <div classИмя="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div classИмя="space-y-3 min-w-0">
                <ColumnLabel
                  tone="amber"
                  title={`rev ${revision.revisionNumber} (selected)`}
                />
                <RevisionПредпросмотр
                  revision={revision}
                  currentRevision={currentRevision}
                  agents={agents}
                  projects={projects}
                  highlighted={highlighted}
                />
              </div>
              <div classИмя="space-y-3 min-w-0">
                <ColumnLabel
                  tone="emerald"
                  title={`rev ${currentRevision.revisionNumber} (current)`}
                />
                <RevisionПредпросмотр
                  revision={currentRevision}
                  currentRevision={revision}
                  agents={agents}
                  projects={projects}
                  highlighted={false}
                />
              </div>
            </div>
          ) : (
            <RevisionПредпросмотр
              revision={revision}
              currentRevision={currentRevision}
              agents={agents}
              projects={projects}
              highlighted={highlighted}
            />
          )}
        </div>
        <DialogFooter classИмя="justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={restoreОжидание}>
            Закрыть
          </Button>
          {isHistorical && (
            <Button onClick={onRestore} disabled={restoreОжидание}>
              <RotateCcw classИмя="mr-1.5 h-3.5 w-3.5" />
              Restore as new revision
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffPill({ kind }: { kind: "differs" | "only-here" }) {
  const label = kind === "differs" ? "differs" : "only here";
  return (
    <span classИмя="ml-1 rounded-full border border-amber-400 bg-amber-300 px-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-950">
      {label}
    </span>
  );
}

function ColumnLabel({ tone, title }: { tone: "amber" | "emerald"; title: string }) {
  const cls =
    tone === "amber"
      ? "border-amber-400 bg-amber-300 text-amber-950"
      : "border-emerald-400 bg-emerald-300 text-emerald-950";
  return (
    <div
      classИмя={`rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${cls}`}
    >
      {title}
    </div>
  );
}


function ConflictBanner({
  dirtyFields,
  onDiscard,
  onСохранить,
}: {
  dirtyFields: DirtyFieldDescriptor[];
  onDiscard: () => void;
  onСохранить: () => void;
}) {
  const labels = dirtyFields.length > 0
    ? dirtyFields.map((field) => field.label)
    : ["the routine"];
  const fieldsText = formatDirtyFieldList(labels);
  return (
    <div classИмя="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div classИмя="flex flex-col gap-3">
        <div classИмя="space-y-1">
          <p classИмя="text-sm font-medium text-amber-200">Unsaved routine edits</p>
          <p classИмя="text-xs text-muted-foreground">
            You changed {fieldsText} but haven&apos;t saved yet. Сохранить or discard before previewing or
            restoring an older revision.
          </p>
        </div>
        <div classИмя="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>
            Discard changes
          </Button>
          <Button size="sm" onClick={onСохранить}>
            Сохранить and continue
          </Button>
        </div>
      </div>
      {dirtyFields.length > 0 && (
        <ul classИмя="mt-3 space-y-1 text-xs text-muted-foreground">
          {dirtyFields.map((field) => (
            <li key={field.key} classИмя="flex items-center gap-2">
              <span classИмя="h-1 w-1 rounded-full bg-amber-400" />
              {field.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RevisionList({
  revisions,
  latestRevisionId,
  selectedRevisionId,
  highlightedRevisionId,
  isИзменитьDirty,
  totalRevisions,
  onSelect,
  onShowOlder,
  showOlder,
}: {
  revisions: ПроцедураRevision[];
  latestRevisionId: string | null;
  selectedRevisionId: string | null;
  highlightedRevisionId: string | null;
  isИзменитьDirty: boolean;
  totalRevisions: number;
  onSelect: (revisionId: string) => void;
  onShowOlder: () => void;
  showOlder: boolean;
}) {
  return (
    <aside classИмя="space-y-1">
      <header classИмя="flex items-center justify-between pb-2">
        <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Revisions
        </p>
        <span classИмя="text-[11px] text-muted-foreground">{totalRevisions} total</span>
      </header>
      {revisions.map((revision) => {
        const isSelected = revision.id === selectedRevisionId;
        const isCurrent = revision.id === latestRevisionId;
        const isHistorical = !isCurrent;
        const isВысокийlighted = revision.id === highlightedRevisionId;
        const blockedByИзменитьs = isИзменитьDirty && isHistorical;
        const baseClass = "w-full rounded-md border px-3 py-2 text-left transition-colors";
        const stateClass = isВысокийlighted
          ? "border-emerald-500/40 bg-emerald-500/10"
          : isSelected && isHistorical
          ? "border-amber-500/40 bg-amber-500/10"
          : isSelected
          ? "border-border bg-accent/40"
          : blockedByИзменитьs
          ? "border-amber-500/30 bg-amber-500/5 opacity-70 cursor-not-allowed"
          : "border-border/60 hover:bg-accent/40";
        return (
          <button
            key={revision.id}
            type="button"
            disabled={blockedByИзменитьs}
            onClick={() => onSelect(revision.id)}
            classИмя={`${baseClass} ${stateClass}`}
            data-testid={`revision-row-${revision.revisionNumber}`}
          >
            <div classИмя="flex items-center gap-2 text-sm font-medium">
              <span>rev {revision.revisionNumber}</span>
              {isCurrent && (
                <span classИмя="rounded-full border border-border px-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Current
                </span>
              )}
              {revision.restoredFromRevisionId && (
                <span classИмя="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                  Restored
                </span>
              )}
            </div>
            <div classИмя="text-xs text-muted-foreground truncate">
              {relativeTime(revision.createdAt)} • {getActorLabel(revision)}
              {revision.changeSummary ? ` • ${revision.changeSummary}` : ""}
            </div>
          </button>
        );
      })}
      {totalRevisions > revisions.length && !showOlder && (
        <Button variant="ghost" size="sm" classИмя="w-full" onClick={onShowOlder}>
          Show {totalRevisions - revisions.length} older…
        </Button>
      )}
    </aside>
  );
}

function RevisionПредпросмотр({
  revision,
  currentRevision,
  agents,
  projects,
  highlighted,
}: {
  revision: ПроцедураRevision;
  currentRevision: ПроцедураRevision | null;
  agents: АгентLookup;
  projects: ProjectLookup;
  highlighted: boolean;
}) {
  const snapshot = revision.snapshot.routine;
  const triggers = revision.snapshot.triggers;
  const currentSnapshot = currentRevision?.snapshot.routine ?? null;
  const otherТриггеры = currentRevision?.snapshot.triggers ?? [];
  const otherTriggerById = new Map(otherТриггеры.map((t) => [t.id, t]));
  const otherVariableByИмя = new Map(
    (currentSnapshot?.variables ?? []).map((v) => [v.name, v]),
  );
  const cardWrapper = `rounded-md border transition-colors duration-1000 ${
    highlighted ? "border-emerald-500/40 bg-emerald-500/10" : "border-border"
  }`;
  const descriptionDiffers =
    !!currentSnapshot &&
    (currentSnapshot.description ?? "") !== (snapshot.description ?? "");

  const fieldRows: Array<{ key: string; label: string; value: string; differs: boolean }> = [
    {
      key: "title",
      label: "Название",
      value: snapshot.title,
      differs: !!currentSnapshot && currentSnapshot.title !== snapshot.title,
    },
    {
      key: "priority",
      label: "Приоритет",
      value: snapshot.priority,
      differs: !!currentSnapshot && currentSnapshot.priority !== snapshot.priority,
    },
    {
      key: "status",
      label: "Статус",
      value: snapshot.status,
      differs: !!currentSnapshot && currentSnapshot.status !== snapshot.status,
    },
    {
      key: "assigneeАгентId",
      label: "Агент по умолчанию",
      value: resolveАгентИмя(snapshot.assigneeАгентId, agents),
      differs: !!currentSnapshot && currentSnapshot.assigneeАгентId !== snapshot.assigneeАгентId,
    },
    {
      key: "projectId",
      label: "Project",
      value: resolveProjectИмя(snapshot.projectId, projects),
      differs: !!currentSnapshot && currentSnapshot.projectId !== snapshot.projectId,
    },
    {
      key: "concurrencyPolicy",
      label: "Concurrency",
      value: snapshot.concurrencyPolicy.replaceВсе("_", " "),
      differs: !!currentSnapshot && currentSnapshot.concurrencyPolicy !== snapshot.concurrencyPolicy,
    },
    {
      key: "catchUpPolicy",
      label: "Catch-up",
      value: snapshot.catchUpPolicy.replaceВсе("_", " "),
      differs: !!currentSnapshot && currentSnapshot.catchUpPolicy !== snapshot.catchUpPolicy,
    },
  ];

  const triggerСтатус = (trigger: ПроцедураRevisionSnapshotTriggerV1): "same" | "differs" | "only-here" => {
    if (!currentRevision) return "same";
    const other = otherTriggerById.get(trigger.id);
    if (!other) return "only-here";
    return JSON.stringify(other) === JSON.stringify(trigger) ? "same" : "differs";
  };

  const variableСтатус = (variable: ПроцедураVariable): "same" | "differs" | "only-here" => {
    if (!currentRevision) return "same";
    const other = otherVariableByИмя.get(variable.name);
    if (!other) return "only-here";
    return JSON.stringify(other) === JSON.stringify(variable) ? "same" : "differs";
  };

  return (
    <div classИмя="space-y-4">
      <header classИмя={`${cardWrapper} p-4 space-y-2`}>
        <div classИмя="space-y-1 min-w-0">
          <p classИмя="text-sm font-medium">rev {revision.revisionNumber}</p>
          <p classИмя="text-xs text-muted-foreground truncate">
            Сохранитьd {relativeTime(revision.createdAt)} by {getActorLabel(revision)}
            {revision.changeSummary ? ` · ${revision.changeSummary}` : ""}
          </p>
        </div>
      </header>

      <div classИмя={`${cardWrapper} p-3`}>
        <p classИмя="pb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Structured fields
        </p>
        <div classИмя="grid gap-3 divide-y divide-border">
          {fieldRows.map((row) => (
            <div key={row.key} classИмя="space-y-1 p-2">
              <p classИмя="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <p classИмя="text-sm">
                {row.value || <span classИмя="text-muted-foreground">—</span>}
                {row.differs && <DiffPill kind="differs" />}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div classИмя={`${cardWrapper} p-3 space-y-2`}>
        <div classИмя="flex items-center gap-2">
          <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Описание
          </p>
          {descriptionDiffers && <DiffPill kind="differs" />}
        </div>
        <div classИмя="rounded-md bg-background/40 p-3 text-sm leading-7">
          {snapshot.description ? (
            <MarkdownBody>{snapshot.description}</MarkdownBody>
          ) : (
            <span classИмя="text-muted-foreground">Нет описания</span>
          )}
        </div>
      </div>

      <div classИмя={`${cardWrapper} p-3 space-y-2`}>
        <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Триггеры ({triggers.length})
        </p>
        {triggers.length === 0 ? (
          <p classИмя="text-sm text-muted-foreground">Нет triggers in this revision.</p>
        ) : (
          <ul classИмя="divide-y divide-border">
            {triggers.map((trigger) => {
              const status = triggerСтатус(trigger);
              return (
                <li key={trigger.id} classИмя="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span classИмя="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {trigger.kind}
                  </span>
                  <span classИмя="font-medium">{trigger.label ?? trigger.kind}</span>
                  <span classИмя="text-xs text-muted-foreground">
                    {summarizeTriggerSnapshot(trigger)}
                  </span>
                  {status !== "same" && <DiffPill kind={status} />}
                  <span
                    classИмя={`ml-auto text-xs ${trigger.enabled ? "text-emerald-400" : "text-muted-foreground"}`}
                  >
                    {trigger.enabled ? "enabled" : "disabled"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p classИмя="text-xs text-muted-foreground">
          Webhook secrets are not stored in revisions. If a restored webhook trigger needs re-creation,
          Paperclip mints fresh secret material at restore time.
        </p>
      </div>

      {snapshot.variables.length > 0 && (
        <div classИмя={`${cardWrapper} p-3 space-y-2`}>
          <p classИмя="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Variables ({snapshot.variables.length})
          </p>
          <ul classИмя="divide-y divide-border">
            {snapshot.variables.map((variable) => {
              const status = variableСтатус(variable);
              return (
                <li key={variable.name} classИмя="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span classИмя="font-mono text-xs">{variable.name}</span>
                  <span classИмя="text-xs text-muted-foreground">
                    default: {formatVariableПо умолчанию(variable)}
                  </span>
                  {status !== "same" && <DiffPill kind={status} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function RestoreПодтвердитьDialog({
  open,
  onOpenChange,
  target,
  currentRevisionNumber,
  changeSummary,
  onChangeSummaryChange,
  onПодтвердить,
  pending,
  recreatedWebhookЯрлыки,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ПроцедураRevision;
  currentRevisionNumber: number;
  changeSummary: string;
  onChangeSummaryChange: (value: string) => void;
  onПодтвердить: () => void;
  pending: boolean;
  recreatedWebhookЯрлыки: string[];
}) {
  const newRevisionNumber = currentRevisionNumber + 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="sm:max-w-md">
        <DialogHeader>
          <DialogНазвание>Restore revision {target.revisionNumber}?</DialogНазвание>
          <DialogОписание>
            This creates a new revision {newRevisionNumber} with the same content as revision{" "}
            {target.revisionNumber}. Revisions {target.revisionNumber}–{currentRevisionNumber} stay
            in history and are not modified.
          </DialogОписание>
        </DialogHeader>
        <ul classИмя="space-y-2 text-sm">
          <li classИмя="flex items-start gap-2">
            <span classИмя="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Процедура field values, variables, and schedule cron will revert.
          </li>
          <li classИмя="flex items-start gap-2">
            <span classИмя="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Previous run history is preserved.
          </li>
          {recreatedWebhookЯрлыки.map((label) => (
            <li key={label} classИмя="flex items-start gap-2 text-amber-200">
              <span classИмя="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              The webhook trigger {label} will be recreated with a new URL and secret. Paperclip will
              show the secret once after restore — copy it before closing.
            </li>
          ))}
        </ul>
        <div classИмя="space-y-1.5">
          <Label htmlFor="restore-change-summary" classИмя="text-xs">
            Change summary (optional)
          </Label>
          <Input
            id="restore-change-summary"
            value={changeSummary}
            placeholder="Why are you restoring? Visible in history."
            onChange={(event) => onChangeSummaryChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onПодтвердить} disabled={pending}>
            <RotateCcw classИмя="mr-1.5 h-3.5 w-3.5" />
            {pending ? "Restoring…" : `Restore as revision ${newRevisionNumber}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function getActorLabel(revision: ПроцедураRevision): string {
  if (revision.createdByUserId) return "board";
  if (revision.createdByАгентId) return "agent";
  return "system";
}

function resolveАгентИмя(agentId: string | null, lookup: АгентLookup) {
  if (!agentId) return "Не назначен";
  return lookup.get(agentId)?.name ?? agentId;
}

function resolveProjectИмя(projectId: string | null, lookup: ProjectLookup) {
  if (!projectId) return "Нет project";
  return lookup.get(projectId)?.name ?? projectId;
}

function summarizeTriggerSnapshot(trigger: ПроцедураRevisionSnapshotTriggerV1): string {
  if (trigger.kind === "schedule") {
    return [trigger.cronExpression, trigger.timezone].filter(Boolean).join(" · ");
  }
  if (trigger.kind === "webhook") {
    const replay = trigger.replayWindowSec != null ? `replay ${trigger.replayWindowSec}s` : "";
    return [trigger.signingMode, replay].filter(Boolean).join(" · ");
  }
  return "API";
}

function formatVariableПо умолчанию(variable: ПроцедураVariable): string {
  if (variable.defaultЗначение == null) return "—";
  return String(variable.defaultЗначение);
}

function formatDirtyFieldList(labels: string[]): string {
  if (labels.length === 0) return "the routine";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function collectWebhookTriggerDifferences(
  target: ПроцедураRevision,
  current: ПроцедураRevision,
): string[] {
  const currentIds = new Set(current.snapshot.triggers.map((t) => t.id));
  return target.snapshot.triggers
    .filter((trigger) => trigger.kind === "webhook" && !currentIds.has(trigger.id))
    .map((trigger) => trigger.label ?? "webhook");
}


export function isОбновитьConflictОшибка(error: unknown): error is ApiОшибка {
  return error instanceof ApiОшибка && error.status === 409;
}

export type ПроцедураИсторияDirtyFieldDescriptor = DirtyFieldDescriptor;
export type ПроцедураИсторияАгентLookup = АгентLookup;
export type ПроцедураИсторияProjectLookup = ProjectLookup;
