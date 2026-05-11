import type { АктивностьEvent } from "@paperclipai/shared";
import { Plus, Minus } from "lucide-react";
import { ЗадачаReferencePill } from "./ЗадачаReferencePill";

type АктивностьЗадачаReference = {
  id: string;
  identifier?: string | null;
  title?: string | null;
};

function readЗадачаСсылки(details: Record<string, unknown> | null | undefined, key: string): АктивностьЗадачаReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is АктивностьЗадачаReference => !!item && typeof item === "object");
}

function Section({
  label,
  icon,
  items,
  strikethrough,
}: {
  label: string;
  icon: React.ReactНетde;
  items: АктивностьЗадачаReference[];
  strikethrough?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div classИмя="flex flex-wrap items-center gap-1.5">
      <span
        aria-label={label}
        classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        {icon}
        <span classИмя="sr-only">{label}</span>
      </span>
      {items.map((issue) => (
        <ЗадачаReferencePill
          key={`${label}:${issue.id}`}
          strikethrough={strikethrough}
          issue={{
            id: issue.id,
            identifier: issue.identifier ?? null,
            title: issue.title ?? issue.identifier ?? issue.id,
          }}
        />
      ))}
    </div>
  );
}

export function ЗадачаReferenceАктивностьSummary({ event }: { event: Pick<АктивностьEvent, "details"> }) {
  const added = readЗадачаСсылки(event.details, "addedReferencedЗадачи");
  const removed = readЗадачаСсылки(event.details, "removedReferencedЗадачи");
  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div classИмя="mt-2 space-y-1">
      <Section
        label="Добавитьed references"
        icon={<Plus classИмя="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />}
        items={added}
      />
      <Section
        label="Удалитьd references"
        icon={<Minus classИмя="h-3 w-3 text-red-600 dark:text-red-400" aria-hidden="true" />}
        items={removed}
        strikethrough
      />
    </div>
  );
}
