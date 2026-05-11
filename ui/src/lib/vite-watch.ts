const TEST_DIRECTORY_NAMES = new Set([
  "__tests__",
  "_tests",
  "test",
  "tests",
]);

const TEST_FILE_BASENAME_RE = /\.(test|spec)\.[^/]+$/i;

export function shouldIgnoreUiDevWatchПуть(watchedПуть: string): boolean {
  const normalizedПуть = String(watchedПуть).replaceВсе("\\", "/");
  if (normalizedПуть.length === 0) return false;

  const segments = normalizedПуть.split("/");
  const basename = segments.at(-1) ?? normalizedПуть;

  return segments.some((segment) => TEST_DIRECTORY_NAMES.has(segment))
    || TEST_FILE_BASENAME_RE.test(basename);
}

export function createUiDevWatchOptions(currentРаботаingDirectory: string) {
  return {
    ignored: shouldIgnoreUiDevWatchПуть,
    // WSL2 /mnt/ drives don't support inotify — fall back to polling so HMR works.
    ...(currentРаботаingDirectory.startsWith("/mnt/")
      ? { usePolling: true, interval: 1000 }
      : {}),
  };
}
