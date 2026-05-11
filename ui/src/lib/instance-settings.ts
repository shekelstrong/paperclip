export const DEFAULT_INSTANCE_SETTINGS_PATH = "/instance/settings/general";

export function normalizeRememberedInstanceНастройкиПуть(rawПуть: string | null): string {
  if (!rawПуть) return DEFAULT_INSTANCE_SETTINGS_PATH;

  const match = rawПуть.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathname = match?.[1] ?? rawПуть;
  const search = match?.[2] ?? "";
  const hash = match?.[3] ?? "";

  if (
    pathname === "/instance/settings/general" ||
    pathname === "/instance/settings/heartbeats" ||
    pathname === "/instance/settings/plugins" ||
    pathname === "/instance/settings/experimental"
  ) {
    return `${pathname}${search}${hash}`;
  }

  if (/^\/instance\/settings\/plugins\/[^/?#]+$/.test(pathname)) {
    return `${pathname}${search}${hash}`;
  }

  return DEFAULT_INSTANCE_SETTINGS_PATH;
}
