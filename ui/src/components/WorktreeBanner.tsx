import { useCallback, useState } from "react";
import { getРаботаtreeUiBranding } from "../lib/worktree-branding";

export function РаботаtreeBanner() {
  const branding = getРаботаtreeUiBranding();
  const [copied, setCopied] = useState(false);

  const handleКопироватьИмя = useCallback(() => {
    if (!branding) return;
    navigator.clipboard.writeText(branding.name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [branding]);

  if (!branding) return null;

  return (
    <div
      classИмя="relative overflow-hidden border-b px-3 py-1.5 text-[11px] font-medium tracking-[0.2em] uppercase"
      style={{
        backgroundColor: branding.color,
        color: branding.textColor,
        borderColor: `${branding.textColor}22`,
        boxShadow: `inset 0 -1px 0 ${branding.textColor}18`,
        backgroundImage: `linear-gradient(90deg, ${branding.textColor}14, transparent 28%, transparent 72%, ${branding.textColor}12), repeating-linear-gradient(135deg, transparent 0 10px, ${branding.textColor}08 10px 20px)`,
      }}
    >
      <div classИмя="flex items-center gap-2 overflow-hidden whitespace-nowrap">
        <span classИмя="shrink-0 opacity-70">Работаtree</span>
        <span classИмя="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
        <button
          type="button"
          onClick={handleКопироватьИмя}
          title="Click to copy worktree name"
          classИмя="truncate font-semibold tracking-[0.12em] cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 text-current uppercase text-[11px]"
        >
          {copied ? "Copied!" : branding.name}
        </button>
      </div>
    </div>
  );
}
