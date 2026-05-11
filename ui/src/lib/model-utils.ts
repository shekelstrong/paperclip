export function extractПровайдерId(modelId: string): string | null {
  const trimmed = modelId.trim();
  if (!trimmed.includes("/")) return null;
  const provider = trimmed.slice(0, trimmed.indexOf("/")).trim();
  return provider || null;
}

export function extractПровайдерIdWithFallback(modelId: string, fallback = "other"): string {
  return extractПровайдерId(modelId) ?? fallback;
}

export function extractМодельИмя(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed.includes("/")) return trimmed;
  return trimmed.slice(trimmed.indexOf("/") + 1).trim();
}
