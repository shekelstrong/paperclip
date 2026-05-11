import { useMemo } from "react";
import type { CostByПровайдерМодель, CostWindowSpendRow, QuotaWindow } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardНазвание, CardОписание } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaBar } from "./QuotaBar";
import { ClaudeSubscriptionPanel } from "./ClaudeSubscriptionPanel";
import { CodexSubscriptionPanel } from "./CodexSubscriptionPanel";
import {
  billingТипDisplayИмя,
  formatCents,
  formatТокенs,
  providerDisplayИмя,
  quotaSourceDisplayИмя,
} from "@/lib/utils";

// ordered display labels for rolling-window rows
const ROLLING_WINDOWS = ["5h", "24h", "7d"] as const;

interface ПровайдерQuotaCardProps {
  provider: string;
  rows: CostByПровайдерМодель[];
  /** company monthly budget in cents (0 means unlimited) */
  budgetMonthlyCents: number;
  /** total company spend in this period in cents, all providers */
  totalКомпанияSpendCents: number;
  /** spend in the current calendar week in cents, this provider only */
  weekSpendCents: number;
  /** rolling window rows for this provider: 5h, 24h, 7d */
  windowRows: CostWindowSpendRow[];
  showDeficitНетtch: boolean;
  /** live subscription quota windows from the provider's own api */
  quotaWindows?: QuotaWindow[];
  quotaОшибка?: string | null;
  quotaSource?: string | null;
  quotaЗагрузка?: boolean;
}

export function ПровайдерQuotaCard({
  provider,
  rows,
  budgetMonthlyCents,
  totalКомпанияSpendCents,
  weekSpendCents,
  windowRows,
  showDeficitНетtch,
  quotaWindows = [],
  quotaОшибка = null,
  quotaSource = null,
  quotaЗагрузка = false,
}: ПровайдерQuotaCardProps) {
  // single-pass aggregation over rows — memoized so the 8 derived values are not
  // recomputed on every parent render tick (providers tab polls every 30s, and each
  // card is mounted twice: once in the "all" tab grid and once in its per-provider tab).
  const totals = useMemo(() => {
    let inputТокенs = 0, outputТокенs = 0, costCents = 0;
    let apiЗапуститьCount = 0, subЗапуститьCount = 0, subInputТокенs = 0, subOutputТокенs = 0;
    for (const r of rows) {
      inputТокенs += r.inputТокенs;
      outputТокенs += r.outputТокенs;
      costCents += r.costCents;
      apiЗапуститьCount += r.apiЗапуститьCount;
      subЗапуститьCount += r.subscriptionЗапуститьCount;
      subInputТокенs += r.subscriptionInputТокенs;
      subOutputТокенs += r.subscriptionOutputТокенs;
    }
    const totalТокенs = inputТокенs + outputТокенs;
    const subТокенs = subInputТокенs + subOutputТокенs;
    // denominator: api-billed tokens (from cost_events) + subscription tokens (from heartbeat_runs)
    const allТокенs = totalТокенs + subТокенs;
    return {
      totalInputТокенs: inputТокенs,
      totalOutputТокенs: outputТокенs,
      totalТокенs,
      totalCostCents: costCents,
      totalApiЗапуститьs: apiЗапуститьCount,
      totalSubЗапуститьs: subЗапуститьCount,
      totalSubInputТокенs: subInputТокенs,
      totalSubOutputТокенs: subOutputТокенs,
      totalSubТокенs: subТокенs,
      subSharePct: allТокенs > 0 ? (subТокенs / allТокенs) * 100 : 0,
    };
  }, [rows]);

  const {
    totalInputТокенs,
    totalOutputТокенs,
    totalТокенs,
    totalCostCents,
    totalApiЗапуститьs,
    totalSubЗапуститьs,
    totalSubInputТокенs,
    totalSubOutputТокенs,
    totalSubТокенs,
    subSharePct,
  } = totals;

  // budget bars: use this provider's own spend vs its pro-rata share of budget
  // pro-rata: if a provider is 40% of total spend, it gets 40% of the budget allocated.
  // falls back to raw provider spend vs total budget when totalКомпанияSpend is 0.
  const providerБюджетShare =
    budgetMonthlyCents > 0 && totalКомпанияSpendCents > 0
      ? (totalCostCents / totalКомпанияSpendCents) * budgetMonthlyCents
      : budgetMonthlyCents;

  const budgetPct =
    providerБюджетShare > 0
      ? Math.min(100, (totalCostCents / providerБюджетShare) * 100)
      : 0;

  // 4.33 = average weeks per calendar month (52 / 12)
  const weeklyБюджетShare = providerБюджетShare > 0 ? providerБюджетShare / 4.33 : 0;
  const weekPct =
    weeklyБюджетShare > 0 ? Math.min(100, (weekSpendCents / weeklyБюджетShare) * 100) : 0;

  const hasБюджет = budgetMonthlyCents > 0;

  // memoized so the Map and max are not reconstructed on every parent render tick
  const windowMap = useMemo(
    () => new Map(windowRows.map((r) => [r.window, r])),
    [windowRows],
  );
  const maxWindowCents = useMemo(
    () => Math.max(...windowRows.map((r) => r.costCents), 0),
    [windowRows],
  );
  const isClaudeQuotaPanel = provider === "anthropic";
  const isCodexQuotaPanel = provider === "openai" && quotaSource?.startsWith("codex-");
  const supportsSubscriptionQuota = provider === "anthropic" || provider === "openai";
  const showSubscriptionQuotaSection =
    supportsSubscriptionQuota && (quotaЗагрузка || quotaWindows.length > 0 || quotaОшибка != null);

  return (
    <Card>
      <CardHeader classИмя="px-4 pt-4 pb-0 gap-1">
        <div classИмя="flex items-start justify-between gap-3">
          <div classИмя="min-w-0">
            <CardНазвание classИмя="text-sm font-semibold">
              {providerDisplayИмя(provider)}
            </CardНазвание>
            <CardОписание classИмя="text-xs mt-0.5">
              <span classИмя="font-mono">{formatТокенs(totalInputТокенs)}</span> in
              {" · "}
              <span classИмя="font-mono">{formatТокенs(totalOutputТокенs)}</span> out
              {(totalApiЗапуститьs > 0 || totalSubЗапуститьs > 0) && (
                <span classИмя="ml-1.5">
                  ·{" "}
                  {totalApiЗапуститьs > 0 && `~${totalApiЗапуститьs} api`}
                  {totalApiЗапуститьs > 0 && totalSubЗапуститьs > 0 && " / "}
                  {totalSubЗапуститьs > 0 && `~${totalSubЗапуститьs} sub`}
                  {" runs"}
                </span>
              )}
            </CardОписание>
          </div>
          <span classИмя="text-xl font-bold tabular-nums shrink-0">
            {formatCents(totalCostCents)}
          </span>
        </div>
      </CardHeader>

      <CardContent classИмя="px-4 pb-4 pt-3 space-y-4">
        {hasБюджет && (
          <div classИмя="space-y-3">
            <QuotaBar
              label="Period spend"
              percentUsed={budgetPct}
              leftLabel={formatCents(totalCostCents)}
              rightLabel={`${Math.round(budgetPct)}% of allocation`}
              showDeficitНетtch={showDeficitНетtch}
            />
            <QuotaBar
              label="На этой неделе"
              percentUsed={weekPct}
              leftLabel={formatCents(weekSpendCents)}
              rightLabel={`~${formatCents(Math.round(weeklyБюджетShare))} / wk`}
              showDeficitНетtch={weekPct >= 100}
            />
          </div>
        )}

        {/* rolling window consumption — always shown when data is available */}
        {windowRows.length > 0 && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rolling windows
              </p>
              <div classИмя="space-y-2.5">
                {ROLLING_WINDOWS.map((w) => {
                  const row = windowMap.get(w);
                  // omit windows with no data rather than showing false $0.00 zeros
                  if (!row) return null;
                  const cents = row.costCents;
                  const tokens = row.inputТокенs + row.outputТокенs;
                  const barPct = maxWindowCents > 0 ? (cents / maxWindowCents) * 100 : 0;
                  return (
                    <div key={w} classИмя="space-y-1">
                      <div classИмя="flex items-center justify-between gap-2 text-xs">
                        <span classИмя="font-mono text-muted-foreground w-6 shrink-0">{w}</span>
                        <span classИмя="text-muted-foreground font-mono flex-1">
                          {formatТокенs(tokens)} tok
                        </span>
                        <span classИмя="font-medium tabular-nums">{formatCents(cents)}</span>
                      </div>
                      <div classИмя="h-2 w-full border border-border overflow-hidden">
                        <div
                          classИмя="h-full bg-primary/60 transition-[width] duration-150"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* subscription usage — shown when any subscription-billed runs exist */}
        {totalSubЗапуститьs > 0 && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-2">
              <p classИмя="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Subscription
              </p>
              <p classИмя="text-xs text-muted-foreground">
                <span classИмя="font-mono text-foreground">{totalSubЗапуститьs}</span> runs
                {" · "}
                {totalSubТокенs > 0 && (
                  <>
                    <span classИмя="font-mono text-foreground">{formatТокенs(totalSubТокенs)}</span> total
                    {" · "}
                  </>
                )}
                <span classИмя="font-mono text-foreground">{formatТокенs(totalSubInputТокенs)}</span> in
                {" · "}
                <span classИмя="font-mono text-foreground">{formatТокенs(totalSubOutputТокенs)}</span> out
              </p>
              {subSharePct > 0 && (
                <>
                  <div classИмя="h-1.5 w-full border border-border overflow-hidden">
                    <div
                      classИмя="h-full bg-primary/60 transition-[width] duration-150"
                      style={{ width: `${subSharePct}%` }}
                    />
                  </div>
                  <p classИмя="text-xs text-muted-foreground">
                    {Math.round(subSharePct)}% of token usage via subscription
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {/* model breakdown — always shown, with token-share bars */}
        {rows.length > 0 && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-3">
              {rows.map((row) => {
                const rowТокенs = row.inputТокенs + row.outputТокенs;
                const tokenPct = totalТокенs > 0 ? (rowТокенs / totalТокенs) * 100 : 0;
                const costPct = totalCostCents > 0 ? (row.costCents / totalCostCents) * 100 : 0;
                return (
                  <div key={`${row.provider}:${row.model}`} classИмя="space-y-1.5">
                    {/* model name and cost */}
                    <div classИмя="flex items-center justify-between gap-2">
                      <div classИмя="min-w-0">
                        <span classИмя="text-xs text-muted-foreground truncate font-mono block">
                          {row.model}
                        </span>
                        <span classИмя="text-[11px] text-muted-foreground truncate block">
                          {providerDisplayИмя(row.biller)} · {billingТипDisplayИмя(row.billingТип)}
                        </span>
                      </div>
                      <div classИмя="flex items-center gap-3 shrink-0 tabular-nums text-xs">
                        <span classИмя="text-muted-foreground">
                          {formatТокенs(rowТокенs)} tok
                        </span>
                        <span classИмя="font-medium">{formatCents(row.costCents)}</span>
                      </div>
                    </div>
                    {/* token share bar */}
                    <div classИмя="relative h-2 w-full border border-border overflow-hidden">
                      <div
                        classИмя="absolute inset-y-0 left-0 bg-primary/60 transition-[width] duration-150"
                        style={{ width: `${tokenPct}%` }}
                        title={`${Math.round(tokenPct)}% of provider tokens`}
                      />
                      {/* cost share overlay — narrower, opaque, shows relative cost weight */}
                      <div
                        classИмя="absolute inset-y-0 left-0 bg-primary/85 transition-[width] duration-150"
                        style={{ width: `${costPct}%` }}
                        title={`${Math.round(costPct)}% of provider cost`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* subscription quota windows from provider api — shown when data is available */}
        {showSubscriptionQuotaSection && (
          <>
            <div classИмя="border-t border-border" />
            <div classИмя="space-y-2">
              <div classИмя="flex items-center justify-between gap-3">
                <p classИмя="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Subscription quota
                </p>
                {quotaSource && !isClaudeQuotaPanel && !isCodexQuotaPanel ? (
                  <span classИмя="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {quotaSourceDisplayИмя(quotaSource)}
                  </span>
                ) : null}
              </div>
              {quotaЗагрузка ? (
                <QuotaPanelSkeleton />
              ) : isClaudeQuotaPanel ? (
                <ClaudeSubscriptionPanel windows={quotaWindows} source={quotaSource} error={quotaОшибка} />
              ) : isCodexQuotaPanel ? (
                <CodexSubscriptionPanel windows={quotaWindows} source={quotaSource} error={quotaОшибка} />
              ) : (
                <>
                  {quotaОшибка ? (
                    <p classИмя="text-xs text-destructive">
                      {quotaОшибка}
                    </p>
                  ) : null}
                  <div classИмя="space-y-2.5">
                    {quotaWindows.map((qw) => {
                      const fillColor =
                        qw.usedPercent == null
                          ? null
                          : qw.usedPercent >= 90
                            ? "bg-red-400"
                            : qw.usedPercent >= 70
                              ? "bg-yellow-400"
                              : "bg-green-400";
                      return (
                        <div key={qw.label} classИмя="space-y-1">
                          <div classИмя="flex items-center justify-between gap-2 text-xs">
                            <span classИмя="font-mono text-muted-foreground shrink-0">{qw.label}</span>
                            <span classИмя="flex-1" />
                            {qw.valueLabel != null ? (
                              <span classИмя="font-medium tabular-nums">{qw.valueLabel}</span>
                            ) : qw.usedPercent != null ? (
                              <span classИмя="font-medium tabular-nums">{qw.usedPercent}% used</span>
                            ) : null}
                          </div>
                          {qw.usedPercent != null && fillColor != null && (
                            <div classИмя="h-2 w-full border border-border overflow-hidden">
                              <div
                                classИмя={`h-full transition-[width] duration-150 ${fillColor}`}
                                style={{ width: `${qw.usedPercent}%` }}
                              />
                            </div>
                          )}
                          {qw.detail ? (
                            <p classИмя="text-xs text-muted-foreground">
                              {qw.detail}
                            </p>
                          ) : qw.resetsAt ? (
                            <p classИмя="text-xs text-muted-foreground">
                              resets {new Date(qw.resetsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QuotaPanelSkeleton() {
  return (
    <div classИмя="border border-border px-4 py-4">
      <div classИмя="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div classИмя="min-w-0 space-y-2">
          <Skeleton classИмя="h-3 w-36" />
          <Skeleton classИмя="h-4 w-64 max-w-full" />
        </div>
        <Skeleton classИмя="h-7 w-28" />
      </div>
      <div classИмя="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            classИмя="border border-border px-3.5 py-3"
          >
            <div classИмя="flex items-start justify-between gap-3">
              <div classИмя="min-w-0 space-y-2">
                <Skeleton classИмя="h-4 w-32" />
                <Skeleton classИмя="h-3 w-44 max-w-full" />
              </div>
              <Skeleton classИмя="h-4 w-20" />
            </div>
            <Skeleton classИмя="mt-3 h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
