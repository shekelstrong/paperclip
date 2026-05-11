import { Button } from "@/components/ui/button";
import {
  ПроцедураListRow,
  type ПроцедураListАгентSummary,
  type ПроцедураListProjectSummary,
  type ПроцедураListRowItem,
} from "@/components/ПроцедураList";

export type ManagedПроцедурыListАгент = {
  id: string;
  name: string;
  icon?: string | null;
};

export type ManagedПроцедурыListProject = {
  id: string;
  name: string;
  color?: string | null;
};

export type ManagedПроцедураMissingRef = {
  resourceKind: string;
  resourceКлюч: string;
};

export type ManagedПроцедурыListItem = {
  key: string;
  title: string;
  status: string;
  routineId?: string | null;
  href?: string | null;
  resourceКлюч?: string | null;
  projectId?: string | null;
  assigneeАгентId?: string | null;
  cronExpression?: string | null;
  lastЗапуститьAt?: Date | string | null;
  lastЗапуститьСтатус?: string | null;
  managedByPluginDisplayИмя?: string | null;
  missingRefs?: ManagedПроцедураMissingRef[];
};

export type ManagedПроцедурыListProps = {
  routines: ManagedПроцедурыListItem[];
  agents?: ManagedПроцедурыListАгент[];
  projects?: ManagedПроцедурыListProject[];
  pluginDisplayИмя?: string | null;
  emptyMessage?: string;
  runningПроцедураКлюч?: string | null;
  statusMutationПроцедураКлюч?: string | null;
  reconcilingПроцедураКлюч?: string | null;
  resettingПроцедураКлюч?: string | null;
  onЗапуститьСейчас?: (routine: ManagedПроцедурыListItem) => void;
  onToggleВключитьd?: (routine: ManagedПроцедурыListItem, enabled: boolean) => void;
  onReconcile?: (routine: ManagedПроцедурыListItem) => void;
  onСбросить?: (routine: ManagedПроцедурыListItem) => void;
};

function managedПроцедураToRow(routine: ManagedПроцедурыListItem): ПроцедураListRowItem {
  return {
    id: routine.key,
    title: routine.title,
    status: routine.status,
    projectId: routine.projectId ?? null,
    assigneeАгентId: routine.assigneeАгентId ?? null,
    lastЗапустить: routine.lastЗапуститьAt || routine.lastЗапуститьСтатус
      ? {
          triggeredAt: routine.lastЗапуститьAt ?? null,
          status: routine.lastЗапуститьСтатус ?? null,
        }
      : null,
  };
}

export function ManagedПроцедурыList({
  routines,
  agents = [],
  projects = [],
  pluginDisplayИмя = null,
  emptyMessage = "Нет managed routines.",
  runningПроцедураКлюч = null,
  statusMutationПроцедураКлюч = null,
  reconcilingПроцедураКлюч = null,
  resettingПроцедураКлюч = null,
  onЗапуститьСейчас,
  onToggleВключитьd,
  onReconcile,
  onСбросить,
}: ManagedПроцедурыListProps) {
  const agentById = new Map<string, ПроцедураListАгентSummary>(
    agents.map((agent) => [agent.id, { name: agent.name, icon: agent.icon }]),
  );
  const projectById = new Map<string, ПроцедураListProjectSummary>(
    projects.map((project) => [project.id, { name: project.name, color: project.color }]),
  );

  if (routines.length === 0) {
    return (
      <div classИмя="rounded-lg border border-border px-3 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div classИмя="rounded-lg border border-border">
      {routines.map((routine) => {
        const row = managedПроцедураToRow(routine);
        const href = routine.href ?? (routine.routineId ? `/routines/${routine.routineId}` : "/routines");
        const missingRefs = routine.missingRefs ?? [];
        const canUseПроцедура = Boolean(routine.routineId && routine.resourceКлюч && missingRefs.length === 0);
        const managedBy = routine.managedByPluginDisplayИмя ?? pluginDisplayИмя;
        const hasRepairActions = Boolean(onReconcile || onСбросить);

        return (
          <div key={routine.key} classИмя="last:[&_a]:border-b-0">
            <ПроцедураListRow
              routine={row}
              projectById={projectById}
              agentById={agentById}
              runningПроцедураId={runningПроцедураКлюч}
              statusMutationПроцедураId={statusMutationПроцедураКлюч}
              href={href}
              configureLabel="Configure"
              managedByLabel={managedBy ? `Managed by ${managedBy}` : null}
              runСейчасButton
              hideАрхивироватьAction
              disableЗапуститьСейчас={!canUseПроцедура}
              disableToggle={!canUseПроцедура}
              secondaryДетали={
                <span classИмя="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {routine.resourceКлюч ? <span>{routine.resourceКлюч}</span> : null}
                  {routine.cronExpression ? <span>Расписание {routine.cronExpression}</span> : null}
                </span>
              }
              onЗапуститьСейчас={() => onЗапуститьСейчас?.(routine)}
              onToggleВключитьd={() => onToggleВключитьd?.(routine, row.status === "active")}
            />
            {hasRepairActions ? (
              <div
                classИмя="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 pb-3 text-xs text-muted-foreground last:border-b-0"
                onClick={(event) => {
                  event.preventПо умолчанию();
                  event.stopPropagation();
                }}
              >
                <span>
                  {missingRefs.length
                    ? `Missing ${missingRefs.map((ref) => `${ref.resourceKind}:${ref.resourceКлюч}`).join(", ")}`
                    : "Процедура defaults can be repaired."}
                </span>
                <span classИмя="flex items-center gap-2">
                  {onReconcile ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reconcilingПроцедураКлюч === routine.key}
                      onClick={() => onReconcile(routine)}
                    >
                      {reconcilingПроцедураКлюч === routine.key ? "Reconciling..." : "Reconcile"}
                    </Button>
                  ) : null}
                  {onСбросить ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={resettingПроцедураКлюч === routine.key}
                      onClick={() => onСбросить(routine)}
                    >
                      {resettingПроцедураКлюч === routine.key ? "Сброситьting..." : "Сбросить"}
                    </Button>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
