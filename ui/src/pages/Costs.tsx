import { useEffect, useMemo, useRef, useState, type ComponentТип } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  БюджетPolicySummary,
  CostByАгентМодель,
  CostByBiller,
  CostByПровайдерМодель,
  CostWindowSpendRow,
  FinanceEvent,
  QuotaWindow,
} from "@paperclipai/shared";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Coins, DollarSign, ReceiptText } from "lucide-react";
import { budgetsApi } from "../api/budgets";
import { costsApi } from "../api/costs";
import { BillerSpendCard } from "../components/BillerSpendCard";
import { БюджетIncidentCard } from "../components/БюджетIncidentCard";
import { БюджетPolicyCard } from "../components/БюджетPolicyCard";
import { EmptyState } from "../components/EmptyState";
import { FinanceBillerCard } from "../components/FinanceBillerCard";
import { FinanceKindCard } from "../components/FinanceKindCard";
import { FinanceTimelineCard } from "../components/FinanceTimelineCard";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { ПровайдерQuotaCard } from "../components/ПровайдерQuotaCard";
import { СтатусBadge } from "../components/СтатусBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { useDateRange, PRESET_KEYS, PRESET_LABELS } from "../hooks/useDateRange";
import { queryКлючs } from "../lib/queryКлючs";
import { billingТипDisplayИмя, cn, formatCents, formatТокенs, providerDisplayИмя } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NO_COMPANY = "__none__";

function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function ПровайдерTabLabel({ provider, rows }: { provider: string; rows: CostByПровайдерМодель[] }) {
  const totalТокенs = rows.reduce((sum, row) => sum + row.inputТокенs + row.cachedInputТокенs + row.outputТокенs, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costCents, 0);
  return (
    <span classИмя="flex items-center gap-1.5">
      <span>{providerDisplayИмя(provider)}</span>
      <span classИмя="font-mono text-xs text-muted-foreground">{formatТокенs(totalТокенs)}</span>
      <span classИмя="text-xs text-muted-foreground">{formatCents(totalCost)}</span>
    </span>
  );
}

function BillerTabLabel({ biller, rows }: { biller: string; rows: CostByBiller[] }) {
  const totalТокенs = rows.reduce((sum, row) => sum + row.inputТокенs + row.cachedInputТокенs + row.outputТокенs, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costCents, 0);
  return (
    <span classИмя="flex items-center gap-1.5">
      <span>{providerDisplayИмя(biller)}</span>
      <span classИмя="font-mono text-xs text-muted-foreground">{formatТокенs(totalТокенs)}</span>
      <span classИмя="text-xs text-muted-foreground">{formatCents(totalCost)}</span>
    </span>
  );
}

function MetricTile({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: ComponentТип<{ classИмя?: string }>;
}) {
  return (
    <div classИмя="border border-border p-4">
      <div classИмя="flex items-center justify-between gap-3">
        <div classИмя="min-w-0">
          <div classИмя="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <div classИмя="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          <div classИмя="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</div>
        </div>
        <div classИмя="flex h-9 w-9 shrink-0 items-center justify-center border border-border">
          <Icon classИмя="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function FinanceSummaryCard({
  debitCents,
  creditCents,
  netCents,
  estimatedDebitCents,
  eventCount,
}: {
  debitCents: number;
  creditCents: number;
  netCents: number;
  estimatedDebitCents: number;
  eventCount: number;
}) {
  return (
    <Card>
      <CardHeader classИмя="px-5 pt-5 pb-2">
        <CardНазвание classИмя="text-base">Finance ledger</CardНазвание>
        <CardОписание>
          Аккаунт-level charges that do not map to a single inference request.
        </CardОписание>
      </CardHeader>
      <CardContent classИмя="grid gap-3 px-5 pb-5 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Debits"
          value={formatCents(debitCents)}
          subtitle={`${eventCount} total event${eventCount === 1 ? "" : "s"} in range`}
          icon={ArrowUpRight}
        />
        <MetricTile
          label="Кредиты"
          value={formatCents(creditCents)}
          subtitle="Refunds, offsets, and credit returns"
          icon={ArrowDownLeft}
        />
        <MetricTile
          label="Net"
          value={formatCents(netCents)}
          subtitle="Debit minus credit for the selected period"
          icon={ReceiptText}
        />
        <MetricTile
          label="Estimated"
          value={formatCents(estimatedDebitCents)}
          subtitle="Estimated debits that are not yet invoice-authoritative"
          icon={Coins}
        />
      </CardContent>
    </Card>
  );
}

export function Расходы() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<"overview" | "budgets" | "providers" | "billers" | "finance">("overview");
  const [activeПровайдер, setАктивенПровайдер] = useState("all");
  const [activeBiller, setАктивенBiller] = useState("all");

  const {
    preset,
    setPreset,
    customFrom,
    setСвойFrom,
    customTo,
    setСвойTo,
    from,
    to,
    customГотово,
  } = useDateRange();

  useEffect(() => {
    setBreadcrumbs([{ label: "Расходы" }]);
  }, [setBreadcrumbs]);

  const [today, setСегодня] = useState(() => new Date().toDateString());
  const todayTimerRef = useRef<ReturnТип<typeof setTimeout> | null>(null);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
      todayTimerRef.current = setTimeout(() => {
        setСегодня(new Date().toDateString());
        schedule();
      }, ms);
    };
    schedule();
    return () => {
      if (todayTimerRef.current != null) clearTimeout(todayTimerRef.current);
    };
  }, []);

  const weekRange = useMemo(() => currentWeekRange(), [today]);
  const companyId = selectedКомпанияId ?? NO_COMPANY;

  const { data: budgetData, isЗагрузка: budgetЗагрузка, error: budgetОшибка } = useQuery({
    queryКлюч: queryКлючs.budgets.overview(companyId),
    queryFn: () => budgetsApi.overview(companyId),
    enabled: !!selectedКомпанияId && customГотово,
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const invalidateБюджетViews = () => {
    if (!selectedКомпанияId) return;
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.budgets.overview(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.dashboard(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.agents.list(selectedКомпанияId) });
    queryClient.invalidateQueries({ queryКлюч: queryКлючs.projects.list(selectedКомпанияId) });
  };

  const policyMutation = useMutation({
    mutationFn: (input: {
      scopeТип: БюджетPolicySummary["scopeТип"];
      scopeId: string;
      amount: number;
      windowKind: БюджетPolicySummary["windowKind"];
    }) =>
      budgetsApi.upsertPolicy(companyId, {
        scopeТип: input.scopeТип,
        scopeId: input.scopeId,
        amount: input.amount,
        windowKind: input.windowKind,
      }),
    onУспешно: invalidateБюджетViews,
  });

  const incidentMutation = useMutation({
    mutationFn: (input: { incidentId: string; action: "keep_paused" | "raise_budget_and_resume"; amount?: number }) =>
      budgetsApi.resolveIncident(companyId, input.incidentId, input),
    onУспешно: invalidateБюджетViews,
  });

  const { data: spendData, isЗагрузка: spendЗагрузка, error: spendОшибка } = useQuery({
    queryКлюч: queryКлючs.costs(companyId, from || undefined, to || undefined),
    queryFn: async () => {
      const [summary, byАгент, byProject, byАгентМодель] = await Promise.all([
        costsApi.summary(companyId, from || undefined, to || undefined),
        costsApi.byАгент(companyId, from || undefined, to || undefined),
        costsApi.byProject(companyId, from || undefined, to || undefined),
        costsApi.byАгентМодель(companyId, from || undefined, to || undefined),
      ]);
      return { summary, byАгент, byProject, byАгентМодель };
    },
    enabled: !!selectedКомпанияId && customГотово,
  });

  const { data: financeData, isЗагрузка: financeЗагрузка, error: financeОшибка } = useQuery({
    queryКлюч: [
      queryКлючs.financeSummary(companyId, from || undefined, to || undefined),
      queryКлючs.financeByBiller(companyId, from || undefined, to || undefined),
      queryКлючs.financeByKind(companyId, from || undefined, to || undefined),
      queryКлючs.financeEvents(companyId, from || undefined, to || undefined, 18),
    ],
    queryFn: async () => {
      const [summary, byBiller, byKind, events] = await Promise.all([
        costsApi.financeSummary(companyId, from || undefined, to || undefined),
        costsApi.financeByBiller(companyId, from || undefined, to || undefined),
        costsApi.financeByKind(companyId, from || undefined, to || undefined),
        costsApi.financeEvents(companyId, from || undefined, to || undefined, 18),
      ]);
      return { summary, byBiller, byKind, events };
    },
    enabled: !!selectedКомпанияId && customГотово,
  });

  const [expandedАгенты, setExpandedАгенты] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedАгенты(new Set());
  }, [companyId, from, to]);

  function toggleАгент(agentId: string) {
    setExpandedАгенты((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }

  const agentМодельRows = useMemo(() => {
    const map = new Map<string, CostByАгентМодель[]>();
    for (const row of spendData?.byАгентМодель ?? []) {
      const rows = map.get(row.agentId) ?? [];
      rows.push(row);
      map.set(row.agentId, rows);
    }
    for (const [agentId, rows] of map) {
      map.set(agentId, rows.slice().sort((a, b) => b.costCents - a.costCents));
    }
    return map;
  }, [spendData?.byАгентМодель]);

  const { data: providerData } = useQuery({
    queryКлюч: queryКлючs.usageByПровайдер(companyId, from || undefined, to || undefined),
    queryFn: () => costsApi.byПровайдер(companyId, from || undefined, to || undefined),
    enabled: !!selectedКомпанияId && customГотово && (mainTab === "providers" || mainTab === "billers"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: billerData } = useQuery({
    queryКлюч: queryКлючs.usageByBiller(companyId, from || undefined, to || undefined),
    queryFn: () => costsApi.byBiller(companyId, from || undefined, to || undefined),
    enabled: !!selectedКомпанияId && customГотово && mainTab === "billers",
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: weekData } = useQuery({
    queryКлюч: queryКлючs.usageByПровайдер(companyId, weekRange.from, weekRange.to),
    queryFn: () => costsApi.byПровайдер(companyId, weekRange.from, weekRange.to),
    enabled: !!selectedКомпанияId && (mainTab === "providers" || mainTab === "billers"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: weekBillerData } = useQuery({
    queryКлюч: queryКлючs.usageByBiller(companyId, weekRange.from, weekRange.to),
    queryFn: () => costsApi.byBiller(companyId, weekRange.from, weekRange.to),
    enabled: !!selectedКомпанияId && mainTab === "billers",
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: windowData } = useQuery({
    queryКлюч: queryКлючs.usageWindowSpend(companyId),
    queryFn: () => costsApi.windowSpend(companyId),
    enabled: !!selectedКомпанияId && mainTab === "providers",
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: quotaData, isЗагрузка: quotaЗагрузка } = useQuery({
    queryКлюч: queryКлючs.usageQuotaWindows(companyId),
    queryFn: () => costsApi.quotaWindows(companyId),
    enabled: !!selectedКомпанияId && mainTab === "providers",
    refetchInterval: 300_000,
    staleTime: 60_000,
  });

  const byПровайдер = useMemo(() => {
    const map = new Map<string, CostByПровайдерМодель[]>();
    for (const row of providerData ?? []) {
      const rows = map.get(row.provider) ?? [];
      rows.push(row);
      map.set(row.provider, rows);
    }
    return map;
  }, [providerData]);

  const byBiller = useMemo(() => {
    const map = new Map<string, CostByBiller[]>();
    for (const row of billerData ?? []) {
      const rows = map.get(row.biller) ?? [];
      rows.push(row);
      map.set(row.biller, rows);
    }
    return map;
  }, [billerData]);

  const weekSpendByПровайдер = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of weekData ?? []) {
      map.set(row.provider, (map.get(row.provider) ?? 0) + row.costCents);
    }
    return map;
  }, [weekData]);

  const weekSpendByBiller = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of weekBillerData ?? []) {
      map.set(row.biller, (map.get(row.biller) ?? 0) + row.costCents);
    }
    return map;
  }, [weekBillerData]);

  const windowSpendByПровайдер = useMemo(() => {
    const map = new Map<string, CostWindowSpendRow[]>();
    for (const row of windowData ?? []) {
      const rows = map.get(row.provider) ?? [];
      rows.push(row);
      map.set(row.provider, rows);
    }
    return map;
  }, [windowData]);

  const quotaWindowsByПровайдер = useMemo(() => {
    const map = new Map<string, QuotaWindow[]>();
    for (const result of quotaData ?? []) {
      if (result.ok && result.windows.length > 0) {
        map.set(result.provider, result.windows);
      }
    }
    return map;
  }, [quotaData]);

  const quotaОшибкаsByПровайдер = useMemo(() => {
    const map = new Map<string, string>();
    for (const result of quotaData ?? []) {
      if (!result.ok && result.error) map.set(result.provider, result.error);
    }
    return map;
  }, [quotaData]);

  const quotaSourcesByПровайдер = useMemo(() => {
    const map = new Map<string, string>();
    for (const result of quotaData ?? []) {
      if (typeof result.source === "string" && result.source.length > 0) {
        map.set(result.provider, result.source);
      }
    }
    return map;
  }, [quotaData]);

  const deficitНетtchByПровайдер = useMemo(() => {
    const map = new Map<string, boolean>();
    if (preset !== "mtd") return map;
    const budget = spendData?.summary.budgetCents ?? 0;
    if (budget <= 0) return map;
    const totalSpend = spendData?.summary.spendCents ?? 0;
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (const [providerКлюч, rows] of byПровайдер) {
      const providerCostCents = rows.reduce((sum, row) => sum + row.costCents, 0);
      const providerShare = totalSpend > 0 ? providerCostCents / totalSpend : 0;
      const providerБюджет = budget * providerShare;
      if (providerБюджет <= 0) {
        map.set(providerКлюч, false);
        continue;
      }
      const burnRate = providerCostCents / Math.max(daysElapsed, 1);
      map.set(providerКлюч, providerCostCents + burnRate * (daysInMonth - daysElapsed) > providerБюджет);
    }
    return map;
  }, [preset, spendData, byПровайдер]);

  const providers = useMemo(() => Array.from(byПровайдер.keys()), [byПровайдер]);
  const billers = useMemo(() => Array.from(byBiller.keys()), [byBiller]);

  const effectiveПровайдер =
    activeПровайдер === "all" || providers.includes(activeПровайдер) ? activeПровайдер : "all";
  useEffect(() => {
    if (effectiveПровайдер !== activeПровайдер) setАктивенПровайдер("all");
  }, [effectiveПровайдер, activeПровайдер]);

  const effectiveBiller =
    activeBiller === "all" || billers.includes(activeBiller) ? activeBiller : "all";
  useEffect(() => {
    if (effectiveBiller !== activeBiller) setАктивенBiller("all");
  }, [effectiveBiller, activeBiller]);

  const providerTabItems = useMemo(() => {
    const providerКлючs = Array.from(byПровайдер.keys());
    const allТокенs = providerКлючs.reduce(
      (sum, provider) => sum + (byПровайдер.get(provider)?.reduce((acc, row) => acc + row.inputТокенs + row.cachedInputТокенs + row.outputТокенs, 0) ?? 0),
      0,
    );
    const allCents = providerКлючs.reduce(
      (sum, provider) => sum + (byПровайдер.get(provider)?.reduce((acc, row) => acc + row.costCents, 0) ?? 0),
      0,
    );
    return [
      {
        value: "all",
        label: (
          <span classИмя="flex items-center gap-1.5">
            <span>Все providers</span>
            {providerКлючs.length > 0 ? (
              <>
                <span classИмя="font-mono text-xs text-muted-foreground">{formatТокенs(allТокенs)}</span>
                <span classИмя="text-xs text-muted-foreground">{formatCents(allCents)}</span>
              </>
            ) : null}
          </span>
        ),
      },
      ...providerКлючs.map((provider) => ({
        value: provider,
        label: <ПровайдерTabLabel provider={provider} rows={byПровайдер.get(provider) ?? []} />,
      })),
    ];
  }, [byПровайдер]);

  const billerTabItems = useMemo(() => {
    const billerКлючs = Array.from(byBiller.keys());
    const allТокенs = billerКлючs.reduce(
      (sum, biller) => sum + (byBiller.get(biller)?.reduce((acc, row) => acc + row.inputТокенs + row.cachedInputТокенs + row.outputТокенs, 0) ?? 0),
      0,
    );
    const allCents = billerКлючs.reduce(
      (sum, biller) => sum + (byBiller.get(biller)?.reduce((acc, row) => acc + row.costCents, 0) ?? 0),
      0,
    );
    return [
      {
        value: "all",
        label: (
          <span classИмя="flex items-center gap-1.5">
            <span>Все billers</span>
            {billerКлючs.length > 0 ? (
              <>
                <span classИмя="font-mono text-xs text-muted-foreground">{formatТокенs(allТокенs)}</span>
                <span classИмя="text-xs text-muted-foreground">{formatCents(allCents)}</span>
              </>
            ) : null}
          </span>
        ),
      },
      ...billerКлючs.map((biller) => ({
        value: biller,
        label: <BillerTabLabel biller={biller} rows={byBiller.get(biller) ?? []} />,
      })),
    ];
  }, [byBiller]);

  const inferenceТокенTotal =
    (spendData?.byАгент ?? []).reduce(
      (sum, row) => sum + row.inputТокенs + row.cachedInputТокенs + row.outputТокенs,
      0,
    );

  const topFinanceEvents = (financeData?.events ?? []) as FinanceEvent[];
  const budgetPolicies = budgetData?.policies ?? [];
  const activeБюджетIncidents = budgetData?.activeIncidents ?? [];
  const budgetPoliciesByОбласть = useMemo(() => ({
    company: budgetPolicies.filter((policy) => policy.scopeТип === "company"),
    agent: budgetPolicies.filter((policy) => policy.scopeТип === "agent"),
    project: budgetPolicies.filter((policy) => policy.scopeТип === "project"),
  }), [budgetPolicies]);

  if (!selectedКомпанияId) {
    return <EmptyState icon={DollarSign} message="Select a company to view costs." />;
  }

  const showСвойPrompt = preset === "custom" && !customГотово;
  const showОбзорЗагрузка = (spendЗагрузка || financeЗагрузка) && customГотово;
  const overviewОшибка = spendОшибка ?? financeОшибка;

  return (
    <div classИмя="space-y-6">
      <div classИмя="space-y-5">
          <div classИмя="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
                <h1 classИмя="text-3xl font-semibold tracking-tight">Расходы</h1>
                <p classИмя="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Inference spend, platform fees, credits, and live quota windows.
                </p>
            </div>

            <div classИмя="flex flex-wrap items-center gap-2">
              {PRESET_KEYS.map((key) => (
                <Button
                  key={key}
                  variant={preset === key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPreset(key)}
                >
                  {PRESET_LABELS[key]}
                </Button>
              ))}
            </div>
          </div>

          {preset === "custom" ? (
            <div classИмя="flex flex-wrap items-center gap-2 border border-border p-3">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setСвойFrom(event.target.value)}
                classИмя="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
              <span classИмя="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setСвойTo(event.target.value)}
                classИмя="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </div>
          ) : null}

          <div classИмя="grid gap-3 lg:grid-cols-4">
            <MetricTile
              label="Inference spend"
              value={formatCents(spendData?.summary.spendCents ?? 0)}
              subtitle={`${formatТокенs(inferenceТокенTotal)} tokens across request-scoped events`}
              icon={DollarSign}
            />
            <MetricTile
              label="Бюджет"
              value={activeБюджетIncidents.length > 0 ? String(activeБюджетIncidents.length) : (
                spendData?.summary.budgetCents && spendData.summary.budgetCents > 0
                  ? `${spendData.summary.utilizationPercent}%`
                  : "Open"
              )}
              subtitle={
                activeБюджетIncidents.length > 0
                  ? `${budgetData?.pausedАгентCount ?? 0} agents paused · ${budgetData?.pausedProjectCount ?? 0} projects paused`
                  : spendData?.summary.budgetCents && spendData.summary.budgetCents > 0
                    ? `${formatCents(spendData.summary.spendCents)} of ${formatCents(spendData.summary.budgetCents)}`
                    : "Нет monthly cap configured"
              }
              icon={Coins}
            />
            <MetricTile
              label="Finance net"
              value={formatCents(financeData?.summary.netCents ?? 0)}
              subtitle={`${formatCents(financeData?.summary.debitCents ?? 0)} debits · ${formatCents(financeData?.summary.creditCents ?? 0)} credits`}
              icon={ReceiptText}
            />
            <MetricTile
              label="Finance events"
              value={String(financeData?.summary.eventCount ?? 0)}
              subtitle={`${formatCents(financeData?.summary.estimatedDebitCents ?? 0)} estimated in range`}
              icon={ArrowUpRight}
            />
          </div>
      </div>

      <Tabs value={mainTab} onЗначениеChange={(value) => setMainTab(value as typeof mainTab)}>
        <TabsList variant="line" classИмя="justify-start">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="budgets">Бюджетs</TabsTrigger>
          <TabsTrigger value="providers">Провайдерs</TabsTrigger>
          <TabsTrigger value="billers">Billers</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" classИмя="mt-4 space-y-4">
          {showСвойPrompt ? (
            <p classИмя="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : showОбзорЗагрузка ? (
            <PageSkeleton variant="costs" />
          ) : overviewОшибка ? (
            <p classИмя="text-sm text-destructive">{(overviewОшибка as Ошибка).message}</p>
          ) : (
            <>
              {activeБюджетIncidents.length > 0 ? (
                <div classИмя="grid gap-4 xl:grid-cols-2">
                  {activeБюджетIncidents.slice(0, 2).map((incident) => (
                    <БюджетIncidentCard
                      key={incident.id}
                      incident={incident}
                      isMutating={incidentMutation.isОжидание}
                      onKeepПриостановлен={() => incidentMutation.mutate({ incidentId: incident.id, action: "keep_paused" })}
                      onRaiseAndПродолжить={(amount) =>
                        incidentMutation.mutate({
                          incidentId: incident.id,
                          action: "raise_budget_and_resume",
                          amount,
                        })}
                    />
                  ))}
                </div>
              ) : null}

              <div classИмя="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
                <Card>
                  <CardHeader classИмя="px-5 pt-5 pb-2">
                    <CardНазвание classИмя="text-base">Inference ledger</CardНазвание>
                    <CardОписание>
                      Request-scoped inference spend for the selected period.
                    </CardОписание>
                  </CardHeader>
                  <CardContent classИмя="space-y-4 px-5 pb-5 pt-2">
                    <div classИмя="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div classИмя="text-3xl font-semibold tabular-nums">
                          {formatCents(spendData?.summary.spendCents ?? 0)}
                        </div>
                        <div classИмя="mt-1 text-sm text-muted-foreground">
                          {spendData?.summary.budgetCents && spendData.summary.budgetCents > 0
                            ? `Бюджет ${formatCents(spendData.summary.budgetCents)}`
                            : "Безлимит budget"}
                        </div>
                      </div>
                      <div classИмя="border border-border px-4 py-3 text-right">
                        <div classИмя="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">usage</div>
                        <div classИмя="mt-1 text-lg font-medium tabular-nums">
                          {formatТокенs(inferenceТокенTotal)}
                        </div>
                      </div>
                    </div>
                    {spendData?.summary.budgetCents && spendData.summary.budgetCents > 0 ? (
                      <div classИмя="space-y-2">
                        <div classИмя="h-2 overflow-hidden bg-muted">
                          <div
                            classИмя={cn(
                              "h-full transition-[width,background-color] duration-150",
                              spendData.summary.utilizationPercent > 90
                                ? "bg-red-400"
                                : spendData.summary.utilizationPercent > 70
                                  ? "bg-yellow-400"
                                  : "bg-emerald-400",
                            )}
                            style={{ width: `${Math.min(100, spendData.summary.utilizationPercent)}%` }}
                          />
                        </div>
                        <div classИмя="text-xs text-muted-foreground">
                          {spendData.summary.utilizationPercent}% of monthly budget consumed in this range.
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <FinanceSummaryCard
                  debitCents={financeData?.summary.debitCents ?? 0}
                  creditCents={financeData?.summary.creditCents ?? 0}
                  netCents={financeData?.summary.netCents ?? 0}
                  estimatedDebitCents={financeData?.summary.estimatedDebitCents ?? 0}
                  eventCount={financeData?.summary.eventCount ?? 0}
                />
              </div>

              <div classИмя="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
                <Card>
                  <CardHeader classИмя="px-5 pt-5 pb-2">
                    <CardНазвание classИмя="text-base">By agent</CardНазвание>
                    <CardОписание>What each agent consumed in the selected period.</CardОписание>
                  </CardHeader>
                  <CardContent classИмя="space-y-2 px-5 pb-5 pt-2">
                    {(spendData?.byАгент.length ?? 0) === 0 ? (
                      <p classИмя="text-sm text-muted-foreground">Нет cost events yet.</p>
                    ) : (
                      spendData?.byАгент.map((row) => {
                        const modelRows = agentМодельRows.get(row.agentId) ?? [];
                        const isExpanded = expandedАгенты.has(row.agentId);
                        const hasBreakdown = modelRows.length > 0;
                        return (
                          <div key={row.agentId} classИмя="border border-border px-4 py-3">
                            <div
                              classИмя={cn("flex items-start justify-between gap-3", hasBreakdown ? "cursor-pointer select-none" : "")}
                              onClick={() => hasBreakdown && toggleАгент(row.agentId)}
                            >
                              <div classИмя="flex min-w-0 items-center gap-2">
                                {hasBreakdown ? (
                                  isExpanded
                                    ? <ChevronDown classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
                                    : <ChevronRight classИмя="h-3 w-3 shrink-0 text-muted-foreground" />
                                ) : (
                                  <span classИмя="h-3 w-3 shrink-0" />
                                )}
                                <Identity name={row.agentИмя ?? row.agentId} size="sm" />
                                {row.agentСтатус === "terminated" ? <СтатусBadge status="terminated" /> : null}
                              </div>
                              <div classИмя="text-right text-sm tabular-nums">
                                <div classИмя="font-medium">{formatCents(row.costCents)}</div>
                                <div classИмя="text-xs text-muted-foreground">
                                  in {formatТокенs(row.inputТокенs + row.cachedInputТокенs)} · out {formatТокенs(row.outputТокенs)}
                                </div>
                                {(row.apiЗапуститьCount > 0 || row.subscriptionЗапуститьCount > 0) ? (
                                  <div classИмя="text-xs text-muted-foreground">
                                    {row.apiЗапуститьCount > 0 ? `${row.apiЗапуститьCount} api` : "0 api"}
                                    {" · "}
                                    {row.subscriptionЗапуститьCount > 0
                                      ? `${row.subscriptionЗапуститьCount} subscription`
                                      : "0 subscription"}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {isExpanded && modelRows.length > 0 ? (
                              <div classИмя="mt-3 space-y-2 border-l border-border pl-4">
                                {modelRows.map((modelRow) => {
                                  const sharePct = row.costCents > 0 ? Math.round((modelRow.costCents / row.costCents) * 100) : 0;
                                  return (
                                    <div
                                      key={`${modelRow.provider}:${modelRow.model}:${modelRow.billingТип}`}
                                      classИмя="flex items-start justify-between gap-3 text-xs"
                                    >
                                      <div classИмя="min-w-0">
                                        <div classИмя="truncate font-medium text-foreground">
                                          {providerDisplayИмя(modelRow.provider)}
                                          <span classИмя="mx-1 text-border">/</span>
                                          <span classИмя="font-mono">{modelRow.model}</span>
                                        </div>
                                        <div classИмя="truncate text-muted-foreground">
                                          {providerDisplayИмя(modelRow.biller)} · {billingТипDisplayИмя(modelRow.billingТип)}
                                        </div>
                                      </div>
                                      <div classИмя="text-right tabular-nums">
                                        <div classИмя="font-medium">
                                          {formatCents(modelRow.costCents)}
                                          <span classИмя="ml-1 font-normal text-muted-foreground">({sharePct}%)</span>
                                        </div>
                                        <div classИмя="text-muted-foreground">
                                          {formatТокенs(modelRow.inputТокенs + modelRow.cachedInputТокенs + modelRow.outputТокенs)} tok
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <div classИмя="space-y-4">
                  <Card>
                    <CardHeader classИмя="px-5 pt-5 pb-2">
                      <CardНазвание classИмя="text-base">By project</CardНазвание>
                      <CardОписание>Запустить costs attributed through project-linked issues.</CardОписание>
                    </CardHeader>
                    <CardContent classИмя="space-y-2 px-5 pb-5 pt-2">
                      {(spendData?.byProject.length ?? 0) === 0 ? (
                        <p classИмя="text-sm text-muted-foreground">Нет project-attributed run costs yet.</p>
                      ) : (
                        spendData?.byProject.map((row, index) => (
                          <div
                            key={row.projectId ?? `unattributed-${index}`}
                            classИмя="flex items-center justify-between gap-3 border border-border px-3 py-2 text-sm"
                          >
                            <span classИмя="truncate">{row.projectИмя ?? row.projectId ?? "Unattributed"}</span>
                            <span classИмя="font-medium tabular-nums">{formatCents(row.costCents)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <FinanceTimelineCard rows={topFinanceEvents.slice(0, 6)} emptyMessage="Нет finance events yet. Добавить account-level charges once biller invoices or credits land." />
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="budgets" classИмя="mt-4 space-y-4">
          {budgetЗагрузка ? (
            <PageSkeleton variant="costs" />
          ) : budgetОшибка ? (
            <p classИмя="text-sm text-destructive">{(budgetОшибка as Ошибка).message}</p>
          ) : (
            <>
              <Card classИмя="border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
                <CardHeader classИмя="px-5 pt-5 pb-3">
                  <CardНазвание classИмя="text-base">Бюджет control plane</CardНазвание>
                  <CardОписание>
                    Hard-stop spend limits for agents and projects. Провайдер subscription quota stays separate and appears under Провайдерs.
                  </CardОписание>
                </CardHeader>
                <CardContent classИмя="grid gap-3 px-5 pb-5 pt-0 md:grid-cols-4">
                  <MetricTile
                    label="Активен incidents"
                    value={String(activeБюджетIncidents.length)}
                    subtitle="Open soft or hard threshold crossings"
                    icon={ReceiptText}
                  />
                  <MetricTile
                    label="Ожидание approvals"
                    value={String(budgetData?.pendingСогласованиеCount ?? 0)}
                    subtitle="Бюджет override approvals awaiting board action"
                    icon={ArrowUpRight}
                  />
                  <MetricTile
                    label="Приостановлен agents"
                    value={String(budgetData?.pausedАгентCount ?? 0)}
                    subtitle="Пульс агента заблокирован (бюджет)"
                    icon={Coins}
                  />
                  <MetricTile
                    label="Приостановлен projects"
                    value={String(budgetData?.pausedProjectCount ?? 0)}
                    subtitle="Project execution blocked by budget"
                    icon={DollarSign}
                  />
                </CardContent>
              </Card>

              {activeБюджетIncidents.length > 0 ? (
                <div classИмя="space-y-3">
                  <div>
                    <h2 classИмя="text-lg font-semibold">Активен incidents</h2>
                    <p classИмя="text-sm text-muted-foreground">
                      Resolve hard stops here by raising the budget or explicitly keeping the scope paused.
                    </p>
                  </div>
                  <div classИмя="grid gap-4 xl:grid-cols-2">
                    {activeБюджетIncidents.map((incident) => (
                      <БюджетIncidentCard
                        key={incident.id}
                        incident={incident}
                        isMutating={incidentMutation.isОжидание}
                        onKeepПриостановлен={() => incidentMutation.mutate({ incidentId: incident.id, action: "keep_paused" })}
                        onRaiseAndПродолжить={(amount) =>
                          incidentMutation.mutate({
                            incidentId: incident.id,
                            action: "raise_budget_and_resume",
                            amount,
                          })}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div classИмя="space-y-5">
                {(["company", "agent", "project"] as const).map((scopeТип) => {
                  const rows = budgetPoliciesByОбласть[scopeТип];
                  if (rows.length === 0) return null;
                  return (
                    <section key={scopeТип} classИмя="space-y-3">
                      <div>
                        <h2 classИмя="text-lg font-semibold capitalize">{scopeТип} budgets</h2>
                        <p classИмя="text-sm text-muted-foreground">
                          {scopeТип === "company"
                            ? "Компания-wide monthly policy."
                            : scopeТип === "agent"
                              ? "Recurring monthly spend policies for individual agents."
                              : "Lifetime spend policies for execution-bound projects."}
                        </p>
                      </div>
                      <div classИмя="grid gap-4 xl:grid-cols-2">
                        {rows.map((summary) => (
                          <БюджетPolicyCard
                            key={summary.policyId}
                            summary={summary}
                            isSaving={policyMutation.isОжидание}
                            onСохранить={(amount) =>
                              policyMutation.mutate({
                                scopeТип: summary.scopeТип,
                                scopeId: summary.scopeId,
                                amount,
                                windowKind: summary.windowKind,
                              })}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}

                {budgetPolicies.length === 0 ? (
                  <Card>
                    <CardContent classИмя="px-5 py-8 text-sm text-muted-foreground">
                      Нет budget policies yet. Set agent and project budgets from their detail pages, or use the existing company monthly budget control.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="providers" classИмя="mt-4 space-y-4">
          {showСвойPrompt ? (
            <p classИмя="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : (
            <>
              <Tabs value={effectiveПровайдер} onЗначениеChange={setАктивенПровайдер}>
                <PageTabBar items={providerTabItems} value={effectiveПровайдер} />

                <TabsContent value="all" classИмя="mt-4">
                  {providers.length === 0 ? (
                    <p classИмя="text-sm text-muted-foreground">Нет cost events in this period.</p>
                  ) : (
                    <div classИмя="grid gap-4 md:grid-cols-2">
                      {providers.map((provider) => (
                        <ПровайдерQuotaCard
                          key={provider}
                          provider={provider}
                          rows={byПровайдер.get(provider) ?? []}
                          budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                          totalКомпанияSpendCents={spendData?.summary.spendCents ?? 0}
                          weekSpendCents={weekSpendByПровайдер.get(provider) ?? 0}
                          windowRows={windowSpendByПровайдер.get(provider) ?? []}
                          showDeficitНетtch={deficitНетtchByПровайдер.get(provider) ?? false}
                          quotaWindows={quotaWindowsByПровайдер.get(provider) ?? []}
                          quotaОшибка={quotaОшибкаsByПровайдер.get(provider) ?? null}
                          quotaSource={quotaSourcesByПровайдер.get(provider) ?? null}
                          quotaЗагрузка={quotaЗагрузка}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {providers.map((provider) => (
                  <TabsContent key={provider} value={provider} classИмя="mt-4">
                    <ПровайдерQuotaCard
                      provider={provider}
                      rows={byПровайдер.get(provider) ?? []}
                      budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                      totalКомпанияSpendCents={spendData?.summary.spendCents ?? 0}
                      weekSpendCents={weekSpendByПровайдер.get(provider) ?? 0}
                      windowRows={windowSpendByПровайдер.get(provider) ?? []}
                      showDeficitНетtch={deficitНетtchByПровайдер.get(provider) ?? false}
                      quotaWindows={quotaWindowsByПровайдер.get(provider) ?? []}
                      quotaОшибка={quotaОшибкаsByПровайдер.get(provider) ?? null}
                      quotaSource={quotaSourcesByПровайдер.get(provider) ?? null}
                      quotaЗагрузка={quotaЗагрузка}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </TabsContent>

        <TabsContent value="billers" classИмя="mt-4 space-y-4">
          {showСвойPrompt ? (
            <p classИмя="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : (
            <>
              <Tabs value={effectiveBiller} onЗначениеChange={setАктивенBiller}>
                <PageTabBar items={billerTabItems} value={effectiveBiller} />

                <TabsContent value="all" classИмя="mt-4">
                  {billers.length === 0 ? (
                    <p classИмя="text-sm text-muted-foreground">Нет billable events in this period.</p>
                  ) : (
                    <div classИмя="grid gap-4 md:grid-cols-2">
                      {billers.map((biller) => {
                        const row = (byBiller.get(biller) ?? [])[0];
                        if (!row) return null;
                        const providerRows = (providerData ?? []).filter((entry) => entry.biller === biller);
                        return (
                          <BillerSpendCard
                            key={biller}
                            row={row}
                            weekSpendCents={weekSpendByBiller.get(biller) ?? 0}
                            budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                            totalКомпанияSpendCents={spendData?.summary.spendCents ?? 0}
                            providerRows={providerRows}
                          />
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {billers.map((biller) => {
                  const row = (byBiller.get(biller) ?? [])[0];
                  if (!row) return null;
                  const providerRows = (providerData ?? []).filter((entry) => entry.biller === biller);
                  return (
                    <TabsContent key={biller} value={biller} classИмя="mt-4">
                      <BillerSpendCard
                        row={row}
                        weekSpendCents={weekSpendByBiller.get(biller) ?? 0}
                        budgetMonthlyCents={spendData?.summary.budgetCents ?? 0}
                        totalКомпанияSpendCents={spendData?.summary.spendCents ?? 0}
                        providerRows={providerRows}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            </>
          )}
        </TabsContent>

        <TabsContent value="finance" classИмя="mt-4 space-y-4">
          {showСвойPrompt ? (
            <p classИмя="text-sm text-muted-foreground">Select a start and end date to load data.</p>
          ) : financeЗагрузка ? (
            <PageSkeleton variant="costs" />
          ) : financeОшибка ? (
            <p classИмя="text-sm text-destructive">{(financeОшибка as Ошибка).message}</p>
          ) : (
            <>
              <FinanceSummaryCard
                debitCents={financeData?.summary.debitCents ?? 0}
                creditCents={financeData?.summary.creditCents ?? 0}
                netCents={financeData?.summary.netCents ?? 0}
                estimatedDebitCents={financeData?.summary.estimatedDebitCents ?? 0}
                eventCount={financeData?.summary.eventCount ?? 0}
              />

              <div classИмя="grid gap-4 xl:grid-cols-[1.2fr,0.95fr]">
                <div classИмя="space-y-4">
                  <Card>
                    <CardHeader classИмя="px-5 pt-5 pb-2">
                      <CardНазвание classИмя="text-base">By biller</CardНазвание>
                      <CardОписание>Аккаунт-level financial events grouped by who charged or credited them.</CardОписание>
                    </CardHeader>
                    <CardContent classИмя="grid gap-4 px-5 pb-5 pt-2 md:grid-cols-2">
                      {(financeData?.byBiller.length ?? 0) === 0 ? (
                        <p classИмя="text-sm text-muted-foreground">Нет finance events yet.</p>
                      ) : (
                        financeData?.byBiller.map((row) => <FinanceBillerCard key={row.biller} row={row} />)
                      )}
                    </CardContent>
                  </Card>
                  <FinanceTimelineCard rows={topFinanceEvents} />
                </div>

                <FinanceKindCard rows={financeData?.byKind ?? []} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
