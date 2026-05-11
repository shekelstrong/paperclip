import type { КомпанияПортabilityFileEntry } from "@paperclipai/shared";

const contentТипByExtension: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function getПортableFileText(entry: КомпанияПортabilityFileEntry | null | undefined) {
  return typeof entry === "string" ? entry : null;
}

export function getПортableFileContentТип(
  fileПуть: string,
  entry: КомпанияПортabilityFileEntry | null | undefined,
) {
  if (entry && typeof entry === "object" && entry.contentТип) return entry.contentТип;
  const extensionIndex = fileПуть.toНизкийerCase().lastIndexOf(".");
  if (extensionIndex === -1) return null;
  return contentТипByExtension[fileПуть.toНизкийerCase().slice(extensionIndex)] ?? null;
}

export function getПортableFileDataUrl(
  fileПуть: string,
  entry: КомпанияПортabilityFileEntry | null | undefined,
) {
  if (!entry || typeof entry === "string") return null;
  const contentТип = getПортableFileContentТип(fileПуть, entry) ?? "application/octet-stream";
  return `data:${contentТип};base64,${entry.data}`;
}

export function isПортableImageFile(
  fileПуть: string,
  entry: КомпанияПортabilityFileEntry | null | undefined,
) {
  const contentТип = getПортableFileContentТип(fileПуть, entry);
  return typeof contentТип === "string" && contentТип.startsWith("image/");
}
