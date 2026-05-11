import type { FinanceByKind } from "@paperclipai/shared";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { financeEventKindDisplayИмя, formatCents } from "@/lib/utils";

interface FinanceKindCardProps {
  rows: FinanceByKind[];
}

export function FinanceKindCard({ rows }: FinanceKindCardProps) {
  return (
    <Card>
      <CardHeader classИмя="px-4 pt-4 pb-1">
        <CardНазвание classИмя="text-base">Financial event mix</CardНазвание>
        <CardОписание>Аккаунт-level charges grouped by event kind.</CardОписание>
      </CardHeader>
      <CardContent classИмя="space-y-2 px-4 pb-4 pt-3">
        {rows.length === 0 ? (
          <p classИмя="text-sm text-muted-foreground">Нет finance events in this period.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.eventKind}
              classИмя="flex items-center justify-between gap-3 border border-border px-3 py-2"
            >
              <div classИмя="min-w-0">
                <div classИмя="truncate text-sm font-medium">{financeEventKindDisplayИмя(row.eventKind)}</div>
                <div classИмя="text-xs text-muted-foreground">
                  {row.eventCount} event{row.eventCount === 1 ? "" : "s"} · {row.billerCount} biller{row.billerCount === 1 ? "" : "s"}
                </div>
              </div>
              <div classИмя="text-right tabular-nums">
                <div classИмя="text-sm font-medium">{formatCents(row.netCents)}</div>
                <div classИмя="text-xs text-muted-foreground">
                  {formatCents(row.debitCents)} debits
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
