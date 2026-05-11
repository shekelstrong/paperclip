import type { Агент, КомпанияПортabilitySidebarOrder, Project } from "@paperclipai/shared";
import { deriveProjectUrlКлюч, normalizeАгентUrlКлюч } from "@paperclipai/shared";

function uniqueSlug(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let index = 2;
  while (true) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    index += 1;
  }
}

export function buildПортableАгентSlugMap(agents: Агент[]): Map<string, string> {
  const usedSlugs = new Set<string>();
  const byId = new Map<string, string>();
  const sortedАгенты = [...agents].sort((left, right) => left.name.localeCompare(right.name));

  for (const agent of sortedАгенты) {
    const baseSlug = normalizeАгентUrlКлюч(agent.name) ?? "agent";
    byId.set(agent.id, uniqueSlug(baseSlug, usedSlugs));
  }

  return byId;
}

export function buildПортableProjectSlugMap(projects: Project[]): Map<string, string> {
  const usedSlugs = new Set<string>();
  const byId = new Map<string, string>();
  const sortedПроекты = [...projects].sort((left, right) => left.name.localeCompare(right.name));

  for (const project of sortedПроекты) {
    const baseSlug = deriveProjectUrlКлюч(project.name, project.name);
    byId.set(project.id, uniqueSlug(baseSlug, usedSlugs));
  }

  return byId;
}

export function buildПортableSidebarOrder(input: {
  agents: Агент[];
  orderedАгенты: Агент[];
  projects: Project[];
  orderedПроекты: Project[];
}): КомпанияПортabilitySidebarOrder | undefined {
  const agentSlugById = buildПортableАгентSlugMap(input.agents);
  const projectSlugById = buildПортableProjectSlugMap(input.projects);
  const sidebar = {
    agents: input.orderedАгенты.map((agent) => agentSlugById.get(agent.id)).filter((slug): slug is string => Boolean(slug)),
    projects: input.orderedПроекты.map((project) => projectSlugById.get(project.id)).filter((slug): slug is string => Boolean(slug)),
  };

  return sidebar.agents.length > 0 || sidebar.projects.length > 0 ? sidebar : undefined;
}
