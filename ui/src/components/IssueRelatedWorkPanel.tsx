import type { ЗадачаRelatedРаботаItem, ЗадачаRelatedРаботаSummary } from "@paperclipai/shared";
import { ЗадачаReferencePill } from "./ЗадачаReferencePill";

type GroupedSource = {
  label: string;
  count: number;
  sampleMatchedText: string | null;
};

function groupSourcesByLabel(sources: ЗадачаRelatedРаботаItem["sources"]): GroupedSource[] {
  const groups = new Map<string, GroupedSource>();
  for (const source of sources) {
    const existing = groups.get(source.label);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(source.label, {
        label: source.label,
        count: 1,
        sampleMatchedText: source.matchedText ?? null,
      });
    }
  }
  return Array.from(groups.values());
}

function Section({
  title,
  description,
  items,
  emptyLabel,
}: {
  title: string;
  description: string;
  items: ЗадачаRelatedРаботаItem[];
  emptyLabel: string;
}) {
  return (
    <section classИмя="space-y-3 rounded-lg border border-border p-3">
      <div classИмя="space-y-1">
        <h3 classИмя="text-sm font-semibold">{title}</h3>
        <p classИмя="text-xs text-muted-foreground">{description}</p>
      </div>

      {items.length === 0 ? (
        <p classИмя="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul classИмя="-mx-1 flex flex-col">
          {items.map((item) => {
            const groupedSources = groupSourcesByLabel(item.sources);
            const showНазвание = item.issue.identifier !== item.issue.title;
            return (
              <li
                key={item.issue.id}
                classИмя="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md px-1 py-1.5 hover:bg-accent/40"
              >
                <ЗадачаReferencePill issue={item.issue} />
                {showНазвание ? (
                  <span classИмя="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {item.issue.title}
                  </span>
                ) : null}
                <div classИмя="flex flex-wrap items-center gap-1.5">
                  {groupedSources.map((group) => (
                    <span
                      key={`${item.issue.id}:${group.label}`}
                      classИмя="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                      title={group.sampleMatchedText ?? undefined}
                    >
                      <span>{group.label}</span>
                      {group.count > 1 ? (
                        <span classИмя="tabular-nums text-[10px] font-medium opacity-80">×{group.count}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ЗадачаRelatedРаботаPanel({
  relatedРабота,
}: {
  relatedРабота?: ЗадачаRelatedРаботаSummary | null;
}) {
  const outbound = relatedРабота?.outbound ?? [];
  const inbound = relatedРабота?.inbound ?? [];

  return (
    <div classИмя="space-y-3">
      <Section
        title="Ссылки"
        description="Other tasks this issue currently points at in its title, description, comments, or documents."
        items={outbound}
        emptyLabel="This issue does not reference any other tasks yet."
      />
      <Section
        title="Referenced by"
        description="Other tasks that currently point at this issue."
        items={inbound}
        emptyLabel="Нет other tasks reference this issue yet."
      />
    </div>
  );
}
