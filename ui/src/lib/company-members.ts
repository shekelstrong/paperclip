import type { КомпанияMember, КомпанияUserDirectoryEntry } from "@/api/access";
import type { InlineEntityOption } from "@/components/InlineEntitySelector";
import type { MentionOption } from "@/components/MarkdownИзменитьor";
import type { Агент, Project } from "@paperclipai/shared";

export interface КомпанияUserПрофиль {
  label: string;
  image: string | null;
}

type КомпанияUserRecord = Pick<КомпанияMember, "principalId" | "status" | "user">
  | КомпанияUserDirectoryEntry;

function fallbackUserLabel(userId: string): string {
  if (userId === "local-board") return "Совет";
  return userId.slice(0, 5);
}

function baseMemberLabel(member: Pick<КомпанияUserRecord, "principalId" | "user">): string {
  const name = member.user?.name?.trim();
  if (name) return name;
  const email = member.user?.email?.trim();
  if (email) return email;
  return fallbackUserLabel(member.principalId);
}

function activeUniqueMembers(members: КомпанияUserRecord[] | null | undefined) {
  const byId = new Map<string, КомпанияUserRecord>();
  for (const member of members ?? []) {
    if (member.status !== "active") continue;
    if (!byId.has(member.principalId)) {
      byId.set(member.principalId, member);
    }
  }
  return [...byId.values()].sort((left, right) => baseMemberLabel(left).localeCompare(baseMemberLabel(right)));
}

export function buildКомпанияUserLabelMap(members: КомпанияUserRecord[] | null | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  for (const member of members ?? []) {
    labels.set(member.principalId, baseMemberLabel(member));
  }
  return labels;
}

export function buildКомпанияUserПрофильMap(
  members: КомпанияUserRecord[] | null | undefined,
): Map<string, КомпанияUserПрофиль> {
  const profiles = new Map<string, КомпанияUserПрофиль>();
  for (const member of members ?? []) {
    profiles.set(member.principalId, {
      label: baseMemberLabel(member),
      image: member.user?.image ?? null,
    });
  }
  return profiles;
}

export function buildКомпанияUserInlineOptions(
  members: КомпанияUserRecord[] | null | undefined,
  options?: { excludeUserIds?: Iterable<string | null | undefined> },
): InlineEntityOption[] {
  const exclude = new Set(
    [...(options?.excludeUserIds ?? [])].filter((value): value is string => Boolean(value)),
  );

  return activeUniqueMembers(members)
    .filter((member) => !exclude.has(member.principalId))
    .map((member) => ({
      id: `user:${member.principalId}`,
      label: baseMemberLabel(member),
      searchText: [member.user?.name, member.user?.email, member.principalId].filter(Boolean).join(" "),
    }));
}

export function buildКомпанияUserMentionOptions(
  members: КомпанияUserRecord[] | null | undefined,
): MentionOption[] {
  return activeUniqueMembers(members).map((member) => ({
    id: `user:${member.principalId}`,
    name: baseMemberLabel(member),
    kind: "user",
    userId: member.principalId,
  }));
}

export function buildMarkdownMentionOptions(args: {
  agents?: Array<Pick<Агент, "id" | "name" | "status" | "icon">> | null | undefined;
  projects?: Array<Pick<Project, "id" | "name" | "color">> | null | undefined;
  members?: КомпанияUserRecord[] | null | undefined;
}): MentionOption[] {
  const options: MentionOption[] = [
    ...buildКомпанияUserMentionOptions(args.members),
    ...[...(args.agents ?? [])]
      .filter((agent) => agent.status !== "terminated")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((agent) => ({
        id: `agent:${agent.id}`,
        name: agent.name,
        kind: "agent" as const,
        agentId: agent.id,
        agentIcon: agent.icon,
      })),
    ...[...(args.projects ?? [])]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((project) => ({
        id: `project:${project.id}`,
        name: project.name,
        kind: "project" as const,
        projectId: project.id,
        projectColor: project.color,
      })),
  ];

  return options;
}
