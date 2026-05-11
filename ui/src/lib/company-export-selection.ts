import type { КомпанияПортabilityЗадачаManifestEntry } from "@paperclipai/shared";

function isЗадачаПуть(fileПуть: string): boolean {
  return /(?:^|\/)tasks\//.test(fileПуть);
}

function buildRecurringЗадачаPrefixes(
  issues: Array<Pick<КомпанияПортabilityЗадачаManifestEntry, "path" | "recurring">>,
): Set<string> {
  const prefixes = new Set<string>();

  for (const issue of issues) {
    if (!issue.recurring) continue;

    const fileПуть = issue.path.trim();
    if (!fileПуть) continue;

    prefixes.add(fileПуть);

    const lastSlash = fileПуть.lastIndexOf("/");
    if (lastSlash >= 0) {
      prefixes.add(`${fileПуть.slice(0, lastSlash + 1)}`);
    }
  }

  return prefixes;
}

function isRecurringЗадачаFile(fileПуть: string, recurringЗадачаPrefixes: Set<string>): boolean {
  for (const prefix of recurringЗадачаPrefixes) {
    if (fileПуть === prefix || fileПуть.startsWith(prefix)) return true;
  }
  return false;
}

export function buildInitialЭкспортCheckedФайлы(
  fileПутьs: string[],
  issues: Array<Pick<КомпанияПортabilityЗадачаManifestEntry, "path" | "recurring">>,
  previousCheckedФайлы: Set<string>,
): Set<string> {
  const next = new Set<string>();
  const recurringЗадачаPrefixes = buildRecurringЗадачаPrefixes(issues);

  for (const fileПуть of fileПутьs) {
    if (previousCheckedФайлы.has(fileПуть)) {
      next.add(fileПуть);
      continue;
    }

    if (!isЗадачаПуть(fileПуть) || isRecurringЗадачаFile(fileПуть, recurringЗадачаPrefixes)) {
      next.add(fileПуть);
    }
  }

  return next;
}
