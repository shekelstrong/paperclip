import type { FinanceByBiller } from "@paperclipai/shared";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { formatCents, providerDisplayИмя } from "@/lib/utils";

interface FinanceBillerCardProps {
  row: FinanceByBiller;
}

export function FinanceBillerCard({ row }: FinanceBillerCardProps) {
  return (
    <Card>
      <CardHeader classИмя="px-4 pt-4 pb-1">
        <div classИмя="flex items-start justify-between gap-3">
          <div>
            <CardНазвание classИмя="text-base">{providerDisplayИмя(row.biller)}</CardНазвание>
            <CardОписание classИмя="mt-1 text-xs">
              {row.eventCount} event{row.eventCount === 1 ? "" : "s"} across {row.kindCount} kind{row.kindCount === 1 ? "" : "s"}
            </CardОписание>
          </div>
          <div classИмя="text-right">
            <div classИмя="text-lg font-semibold tabular-nums">{formatCents(row.netCents)}</div>
            <div classИмя="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">net</div>
          </div>
        </div>
      </CardHeader>
      <CardContent classИмя="space-y-3 px-4 pb-4 pt-3">
        <div classИмя="grid gap-2 text-sm sm:grid-cols-3">
          <div classИмя="border border-border p-3">
            <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">debits</div>
            <div classИмя="mt-1 font-medium tabular-nums">{formatCents(row.debitCents)}</div>
          </div>
          <div classИмя="border border-border p-3">
            <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">credits</div>
            <div classИмя="mt-1 font-medium tabular-nums">{formatCents(row.creditCents)}</div>
          </div>
          <div classИмя="border border-border p-3">
            <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">estimated</div>
            <div classИмя="mt-1 font-medium tabular-nums">{formatCents(row.estimatedDebitCents)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
