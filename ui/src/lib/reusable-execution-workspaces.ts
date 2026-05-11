export interface ReusableExecutionРабочая областьLike {
  id: string;
  name: string;
  cwd: string | null;
  lastUsedAt: Date | string;
}

function workspaceLastUsedTime(workspace: Pick<ReusableExecutionРабочая областьLike, "lastUsedAt">) {
  const time = new Date(workspace.lastUsedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareРабочая областьИмяs(a: ReusableExecutionРабочая областьLike, b: ReusableExecutionРабочая областьLike) {
  const nameCompare = a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (nameCompare !== 0) return nameCompare;
  return a.id.localeCompare(b.id);
}

export function orderReusableExecutionРабочие области<T extends ReusableExecutionРабочая областьLike>(
  workspaces: readonly T[],
): T[] {
  const deduplicatedByПуть = new Map<string, T>();

  for (const workspace of workspaces) {
    const key = workspace.cwd ?? workspace.id;
    const existing = deduplicatedByПуть.get(key);
    if (!existing || workspaceLastUsedTime(workspace) > workspaceLastUsedTime(existing)) {
      deduplicatedByПуть.set(key, workspace);
    }
  }

  const alphabetized = Array.from(deduplicatedByПуть.values()).sort(compareРабочая областьИмяs);
  if (alphabetized.length <= 1) return alphabetized;

  let mostRecentlyUsed = alphabetized[0]!;
  for (const workspace of alphabetized.slice(1)) {
    if (workspaceLastUsedTime(workspace) > workspaceLastUsedTime(mostRecentlyUsed)) {
      mostRecentlyUsed = workspace;
    }
  }

  return [
    mostRecentlyUsed,
    ...alphabetized.filter((workspace) => workspace.id !== mostRecentlyUsed.id),
  ];
}
