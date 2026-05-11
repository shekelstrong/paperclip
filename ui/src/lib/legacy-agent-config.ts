function asНетnEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasLegacyРаботаingDirectory(value: unknown): boolean {
  return asНетnEmptyString(value) !== null;
}

export function shouldShowLegacyРаботаingDirectoryField(input: {
  isСоздать: boolean;
  adapterConfig: Record<string, unknown> | null | undefined;
}): boolean {
  if (input.isСоздать) return false;
  return hasLegacyРаботаingDirectory(input.adapterConfig?.cwd);
}
