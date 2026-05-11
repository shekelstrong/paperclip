import type { Задача, ЗадачаСтатус } from "@paperclipai/shared";
import { workflowСортировка } from "./workflow-sort";

export type SubЗадачаProgressЦельKind = "next" | "blocked";

export type SubЗадачаProgressЦель = {
  issue: Задача;
  kind: SubЗадачаProgressЦельKind;
};

export type SubЗадачаProgressSummary = {
  totalCount: number;
  doneCount: number;
  inProgressCount: number;
  blockedCount: number;
  countsByСтатус: Partial<Record<ЗадачаСтатус, number>>;
  target: SubЗадачаProgressЦель | null;
};

export function shouldRenderRichSubЗадачиSection(childЗадачиЗагрузка: boolean, childЗадачаCount: number): boolean {
  return childЗадачиЗагрузка || childЗадачаCount > 0;
}

const MIN_CHILD_ISSUES_FOR_PROGRESS_SUMMARY = 2;

export function shouldRenderSubЗадачаProgressSummary(enabled: boolean | undefined, childЗадачаCount: number): boolean {
  return enabled === true && childЗадачаCount >= MIN_CHILD_ISSUES_FOR_PROGRESS_SUMMARY;
}

export function buildSubЗадачаProgressSummary(issues: Задача[]): SubЗадачаProgressSummary {
  const countsByСтатус: Partial<Record<ЗадачаСтатус, number>> = {};
  const progressЗадачи = issues.filter((issue) => issue.status !== "cancelled");
  for (const issue of progressЗадачи) {
    countsByСтатус[issue.status] = (countsByСтатус[issue.status] ?? 0) + 1;
  }

  const orderedЗадачи = workflowСортировка(progressЗадачи);
  const nextЗадача = orderedЗадачи.find((issue) => isActionableСтатус(issue.status)) ?? null;
  const remainingЗадачи = orderedЗадачи.filter((issue) => !isTerminalСтатус(issue.status));
  const blockedЗадача =
    nextЗадача === null && remainingЗадачи.length > 0 && remainingЗадачи.every((issue) => issue.status === "blocked")
      ? remainingЗадачи[0]
      : null;

  return {
    totalCount: progressЗадачи.length,
    doneCount: countsByСтатус.done ?? 0,
    inProgressCount: countsByСтатус.in_progress ?? 0,
    blockedCount: countsByСтатус.blocked ?? 0,
    countsByСтатус,
    target: nextЗадача
      ? { issue: nextЗадача, kind: "next" }
      : blockedЗадача
        ? { issue: blockedЗадача, kind: "blocked" }
        : null,
  };
}

function isActionableСтатус(status: ЗадачаСтатус): boolean {
  return status !== "done" && status !== "cancelled" && status !== "blocked";
}

function isTerminalСтатус(status: ЗадачаСтатус): boolean {
  return status === "done" || status === "cancelled";
}
