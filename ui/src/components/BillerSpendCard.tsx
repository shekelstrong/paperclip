import { useMemo } from "react";
import type { CostByBiller, CostByПровайдерМодель } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardНазвание, CardОписание } from "@/components/ui/card";
import { QuotaBar } from "./QuotaBar";
import { billingТипDisplayИмя, formatCents, formatТокенs, providerDisplayИмя } from "@/lib/utils";

interface BillerSpendCardProps {
  row: CostByBiller;
  weekSpendCents: number;
  budgetMonthlyCents: number;
  totalКомпанияSpendCents: number;
  providerRows: CostByПровайдерМодель[];
}

export function BillerSpendCard({
  row,
  weekSpendCents,
  budgetMonthlyCents,
  totalКомпанияSpendCents,
  providerRows,
}: BillerSpendCardProps) {
  const providerBreakdown = useMemo(() => {
    const map = new Map<string, { provider: string; costCents: number; inputТокенs: number; outputТокенs: number }>();
    for (const entry of providerRows) {
      const current = map.get(entry.provider) ?? {
        provider: entry.provider,
        costCents: 0,
        inputТокенs: 0,
        outputТокенs: 0,
      };
      current.costCents += entry.costCents;
      current.inputТокенs += entry.inputТокенs + entry.cachedInputТокенs;
      current.outputТокенs += entry.outputТокенs;
      map.set(entry.provider, current);
    }
    return Array.from(map.values()).sort((a, b) => b.costCents - a.costCents);
  }, [providerRows]);

  const billingТипBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of providerRows) {
      map.set(entry.billingТип, (map.get(entry.billingТип) ?? 0) + entry.costCents);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [providerRows]);

  const providerБюджетShare =
    budgetMonthlyCents > 0 && totalКомпанияSpendCents > 0
      ? (row.costCents / totalКомпанияSpendCents) * budgetMonthlyCents
      : budgetMonthlyCents;
  const budgetPct =
    providerБюджетShare > 0
      ? Math.min(100, (row.costCents / providerБюджетShare) * 100)
      : 0;

  return (
    <Card>
      <CardHeader classИмя="px-4 pt-4 pb-0 gap-1">
        <div classИмя="flex items-start justify-between gap-3">
          <div classИмя="min-w-0">
            <CardНазвание classИмя="text-sm font-semibold">
              {providerDisplayИмя(row.biller)}
            </CardНазвание>
            <CardОписание classИмя="text-xs mt-0.5">
              <span classИмя="font-mono">{formatТокенs(row.inputТокенs + row.cachedInputТокенs)}</span> in
              {" · "}
              <span classИмя="font-mono">{formatТокенs(row.outputТокенs)}</span> out
              {" · "}
              {row.providerCount} provider{row.providerCount === 1 ? "" : "s"}
              {" · "}
              {row.modelCount} model{row.modelCount === 1 ? "" : "s"}
            </CardОписание>
          </div>
          <span classИмя="text-xl font-bold tabular-nums shrink-0">
            {formatCents(row.costCents)}
          </span>
        </div>
      </CardHeader>

      <CardContent classИмя="px-4 pb-4 pt-3 space-y-4">
        {budgetMonthlyCents > 0 && (
          <QuotaBar
            label="Period spend"
            percentUsed={budgetPct}
            leftLabel={formatCents(row.costCents)}
            rightLabel={`${Math.round(budgetPct)}% of allocation`}
          />
        )}

        <div classИмя="text-xs text-muted-foreground">
          {row.apiЗапуститьCount > 0 ? `${row.apiЗапуститьCount} metered run${row.apiЗапуститьCount === 1 ? "" : "s"}` : "0 metered runs"}
          {" · "}
          {row.subscriptionЗапуститьCount > 0
            ? `${row.subscriptionЗапуститьCount} subscription run${row.subscriptionЗапуститьCount === 1 ? "" : "s"}`
            : "0 subscription runs"}
          {" · "}
          {formatCents(weekSpendCents)} this week
        </div>

        {billingТипBreakdown.length > 0 && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Биллинг types
              </p>
              <div classИмя="space-y-1.5">
                {billingТипBreakdown.map(([billingТип, costCents]) => (
                  <div key={billingТип} classИмя="flex items-center justify-between gap-2 text-xs">
                    <span classИмя="text-muted-foreground">{billingТипDisplayИмя(billingТип as any)}</span>
                    <span classИмя="font-medium tabular-nums">{formatCents(costCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {providerBreakdown.length > 0 && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Upstream providers
              </p>
              <div classИмя="space-y-1.5">
                {providerBreakdown.map((entry) => (
                  <div key={entry.provider} classИмя="flex items-center justify-between gap-2 text-xs">
                    <span classИмя="text-muted-foreground">{providerDisplayИмя(entry.provider)}</span>
                    <div classИмя="text-right tabular-nums">
                      <div classИмя="font-medium">{formatCents(entry.costCents)}</div>
                      <div classИмя="text-muted-foreground">
                        {formatТокенs(entry.inputТокенs + entry.outputТокенs)} tok
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
