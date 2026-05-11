import { useState } from "react";
import type { ЗадачаBlockerAttention } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { issueСтатусIcon, issueСтатусIconПо умолчанию } from "../lib/status-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const allСтатусes = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface СтатусIconProps {
  status: string;
  blockerAttention?: ЗадачаBlockerAttention | null;
  onChange?: (status: string) => void;
  classИмя?: string;
  showLabel?: boolean;
}

function blockedAttentionLabel(blockerAttention: ЗадачаBlockerAttention | null | undefined) {
  if (!blockerAttention || blockerAttention.state === "none") return "Заблокирован";

  if (blockerAttention.reason === "active_child") {
    const count = blockerAttention.coveredBlockerCount;
    if (count === 1 && blockerAttention.sampleBlockerIdentifier) {
      return `Заблокирован · waiting on active sub-issue ${blockerAttention.sampleBlockerIdentifier}`;
    }
    if (count === 1) return "Заблокирован · waiting on 1 active sub-issue";
    return `Заблокирован · waiting on ${count} active sub-issues`;
  }

  if (blockerAttention.reason === "active_dependency") {
    const count = blockerAttention.coveredBlockerCount;
    if (count === 1 && blockerAttention.sampleBlockerIdentifier) {
      return `Заблокирован · covered by active dependency ${blockerAttention.sampleBlockerIdentifier}`;
    }
    if (count === 1) return "Заблокирован · covered by 1 active dependency";
    return `Заблокирован · covered by ${count} active dependencies`;
  }

  if (blockerAttention.reason === "stalled_review") {
    const count = blockerAttention.stalledBlockerCount;
    const leaf = blockerAttention.sampleStalledBlockerIdentifier ?? blockerAttention.sampleBlockerIdentifier;
    if (count === 1 && leaf) return `Заблокирован · review stalled on ${leaf}`;
    if (count === 1) return "Заблокирован · review stalled with no clear next step";
    return `Заблокирован · ${count} reviews stalled with no clear next step`;
  }

  if (blockerAttention.reason === "attention_required") {
    const count = blockerAttention.attentionBlockerCount || blockerAttention.unresolvedBlockerCount;
    const attentionКопировать = `${count} ${count === 1 ? "blocker needs" : "blockers need"} attention`;
    const coveredCount = blockerAttention.coveredBlockerCount;
    if (coveredCount > 0) {
      return `Заблокирован · ${attentionКопировать}; ${coveredCount} covered by active work`;
    }
    return `Заблокирован · ${attentionКопировать}`;
  }

  return "Заблокирован";
}

export function СтатусIcon({ status, blockerAttention, onChange, classИмя, showLabel }: СтатусIconProps) {
  const [open, setOpen] = useState(false);
  const isCoveredЗаблокирован = status === "blocked" && blockerAttention?.state === "covered";
  const isStalledЗаблокирован = status === "blocked" && blockerAttention?.state === "stalled";
  const isAttentionЗаблокирован = status === "blocked" && blockerAttention?.state === "needs_attention";
  const hasCoveredЗаблокированРабота = isAttentionЗаблокирован && (blockerAttention?.coveredBlockerCount ?? 0) > 0;
  const colorClass = isCoveredЗаблокирован
    ? "text-cyan-600 border-cyan-600 dark:text-cyan-400 dark:border-cyan-400"
    : isStalledЗаблокирован
      ? "text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400"
      : issueСтатусIcon[status] ?? issueСтатусIconПо умолчанию;
  const isГотово = status === "done";
  const ariaLabel = status === "blocked" ? blockedAttentionLabel(blockerAttention) : statusLabel(status);
  const blockerAttentionState = isCoveredЗаблокирован
    ? "covered"
    : isStalledЗаблокирован
      ? "stalled"
      : isAttentionЗаблокирован
        ? "needs_attention"
        : undefined;

  const circle = (
    <span
      classИмя={cn(
        "relative inline-flex h-4 w-4 rounded-full border-2 shrink-0",
        colorClass,
        onChange && !showLabel && "cursor-pointer",
        classИмя
      )}
      data-blocker-attention-state={blockerAttentionState}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {isГотово && (
        <span classИмя="absolute inset-0 m-auto h-2 w-2 rounded-full bg-current" />
      )}
      {isCoveredЗаблокирован && (
        <span classИмя="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-current" />
      )}
      {hasCoveredЗаблокированРабота && (
        <span classИмя="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-cyan-600 dark:bg-cyan-400" />
      )}
      {isStalledЗаблокирован && (
        <span classИмя="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-current" />
      )}
    </span>
  );

  if (!onChange) return showLabel ? <span classИмя="inline-flex items-center gap-1.5">{circle}<span classИмя="text-sm">{statusLabel(status)}</span></span> : circle;

  const trigger = showLabel ? (
    <button classИмя="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors">
      {circle}
      <span classИмя="text-sm">{statusLabel(status)}</span>
    </button>
  ) : circle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent classИмя="w-40 p-1" align="start">
        {allСтатусes.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            classИмя={cn("w-full justify-start gap-2 text-xs", s === status && "bg-accent")}
            onClick={() => {
              onChange(s);
              setOpen(false);
            }}
          >
            <СтатусIcon status={s} />
            {statusLabel(s)}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
