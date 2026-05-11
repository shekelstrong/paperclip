import type { FinanceEvent } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import {
  financeDirectionDisplayИмя,
  financeEventKindDisplayИмя,
  formatCents,
  formatDateTime,
  providerDisplayИмя,
} from "@/lib/utils";

interface FinanceTimelineCardProps {
  rows: FinanceEvent[];
  emptyMessage?: string;
}

export function FinanceTimelineCard({
  rows,
  emptyMessage = "Нет financial events in this period.",
}: FinanceTimelineCardProps) {
  return (
    <Card>
      <CardHeader classИмя="px-4 pt-4 pb-1">
        <CardНазвание classИмя="text-base">Recent financial events</CardНазвание>
        <CardОписание>Top-ups, fees, credits, commitments, and other non-request charges.</CardОписание>
      </CardHeader>
      <CardContent classИмя="space-y-3 px-4 pb-4 pt-3">
        {rows.length === 0 ? (
          <p classИмя="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              classИмя="border border-border p-3"
            >
              <div classИмя="flex items-start justify-between gap-3">
                <div classИмя="min-w-0 space-y-2">
                  <div classИмя="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{financeEventKindDisplayИмя(row.eventKind)}</Badge>
                    <Badge variant={row.direction === "credit" ? "outline" : "secondary"}>
                      {financeDirectionDisplayИмя(row.direction)}
                    </Badge>
                    <span classИмя="text-xs text-muted-foreground">{formatDateTime(row.occurredAt)}</span>
                  </div>
                  <div classИмя="text-sm font-medium">
                    {providerDisplayИмя(row.biller)}
                    {row.provider ? ` -> ${providerDisplayИмя(row.provider)}` : ""}
                    {row.model ? <span classИмя="ml-1 font-mono text-xs text-muted-foreground">{row.model}</span> : null}
                  </div>
                  {(row.description || row.externalInvoiceId || row.region || row.pricingTier) && (
                    <div classИмя="space-y-1 text-xs text-muted-foreground">
                      {row.description ? <div>{row.description}</div> : null}
                      {row.externalInvoiceId ? <div>invoice {row.externalInvoiceId}</div> : null}
                      {row.region ? <div>region {row.region}</div> : null}
                      {row.pricingTier ? <div>tier {row.pricingTier}</div> : null}
                    </div>
                  )}
                </div>
                <div classИмя="text-right tabular-nums">
                  <div classИмя="text-sm font-semibold">{formatCents(row.amountCents)}</div>
                  <div classИмя="text-xs text-muted-foreground">{row.currency}</div>
                  {row.estimated ? <div classИмя="text-[11px] uppercase tracking-[0.12em] text-amber-600">estimated</div> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
