import { useEffect, useState } from "react";
import type { БюджетPolicySummary } from "@paperclipai/shared";
import { AlertTriangle, ПаузаCircle, ShieldAlert, Wallet } from "lucide-react";
import { cn, formatCents } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function centsInputЗначение(value: number) {
  return (value / 100).toFixed(2);
}

function parseDollarInput(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function windowLabel(windowKind: БюджетPolicySummary["windowKind"]) {
  return windowKind === "lifetime" ? "Lifetime budget" : "Monthly UTC budget";
}

function statusTone(status: БюджетPolicySummary["status"]) {
  if (status === "hard_stop") return "text-red-300 border-red-500/30 bg-red-500/10";
  if (status === "warning") return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-emerald-200 border-emerald-500/30 bg-emerald-500/10";
}

export function БюджетPolicyCard({
  summary,
  onСохранить,
  isSaving,
  compact = false,
  variant = "card",
}: {
  summary: БюджетPolicySummary;
  onСохранить?: (amountCents: number) => void;
  isSaving?: boolean;
  compact?: boolean;
  variant?: "card" | "plain";
}) {
  const [draftБюджет, setЧерновикБюджет] = useState(centsInputЗначение(summary.amount));

  useEffect(() => {
    setЧерновикБюджет(centsInputЗначение(summary.amount));
  }, [summary.amount]);

  const parsedЧерновик = parseDollarInput(draftБюджет);
  const canСохранить = typeof parsedЧерновик === "number" && parsedЧерновик !== summary.amount && Boolean(onСохранить);
  const progress = summary.amount > 0 ? Math.min(100, summary.utilizationPercent) : 0;
  const СтатусIcon = summary.status === "hard_stop" ? ShieldAlert : summary.status === "warning" ? AlertTriangle : Wallet;
  const isPlain = variant === "plain";

  const observedБюджетGrid = isPlain ? (
    <div classИмя="grid gap-6 sm:grid-cols-2">
      <div>
        <div classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Observed</div>
        <div classИмя="mt-2 text-xl font-semibold tabular-nums">{formatCents(summary.observedAmount)}</div>
        <div classИмя="mt-1 text-xs text-muted-foreground">
          {summary.amount > 0 ? `${summary.utilizationPercent}% of limit` : "Нет cap configured"}
        </div>
      </div>
      <div>
        <div classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Бюджет</div>
        <div classИмя="mt-2 text-xl font-semibold tabular-nums">
          {summary.amount > 0 ? formatCents(summary.amount) : "Отключитьd"}
        </div>
        <div classИмя="mt-1 text-xs text-muted-foreground">
          Soft alert at {summary.warnPercent}%{summary.paused && summary.pauseReason ? ` · ${summary.pauseReason} pause` : ""}
        </div>
      </div>
    </div>
  ) : (
    <div classИмя="grid gap-3 sm:grid-cols-2">
      <div classИмя="rounded-xl border border-border/70 bg-black/[0.18] px-4 py-3">
        <div classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Observed</div>
        <div classИмя="mt-2 text-xl font-semibold tabular-nums">{formatCents(summary.observedAmount)}</div>
        <div classИмя="mt-1 text-xs text-muted-foreground">
          {summary.amount > 0 ? `${summary.utilizationPercent}% of limit` : "Нет cap configured"}
        </div>
      </div>
      <div classИмя="rounded-xl border border-border/70 bg-black/[0.18] px-4 py-3">
        <div classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Бюджет</div>
        <div classИмя="mt-2 text-xl font-semibold tabular-nums">
          {summary.amount > 0 ? formatCents(summary.amount) : "Отключитьd"}
        </div>
        <div classИмя="mt-1 text-xs text-muted-foreground">
          Soft alert at {summary.warnPercent}%{summary.paused && summary.pauseReason ? ` · ${summary.pauseReason} pause` : ""}
        </div>
      </div>
    </div>
  );

  const progressSection = (
    <div classИмя="space-y-2">
      <div classИмя="flex items-center justify-between text-xs text-muted-foreground">
        <span>Remaining</span>
        <span>{summary.amount > 0 ? formatCents(summary.remainingAmount) : "Безлимит"}</span>
      </div>
      <div classИмя={cn("h-2 overflow-hidden rounded-full", isPlain ? "bg-border/70" : "bg-muted/70")}>
        <div
          classИмя={cn(
            "h-full rounded-full transition-[width,background-color] duration-200",
            summary.status === "hard_stop"
              ? "bg-red-400"
              : summary.status === "warning"
                ? "bg-amber-300"
                : "bg-emerald-300",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  const pausedPane = summary.paused ? (
    <div classИмя="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
      <ПаузаCircle classИмя="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {summary.scopeТип === "project"
          ? "Execution is paused for this project until the budget is raised or the incident is dismissed."
          : "Heartbeats are paused for this scope until the budget is raised or the incident is dismissed."}
      </div>
    </div>
  ) : null;

  const saveSection = onСохранить ? (
    <div classИмя={cn("flex flex-col gap-3 sm:flex-row sm:items-end", isPlain ? "" : "rounded-xl border border-border/70 bg-background/50 p-3")}>
      <div classИмя="min-w-0 flex-1">
        <label classИмя="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Бюджет (USD)
        </label>
        <Input
          value={draftБюджет}
          onChange={(event) => setЧерновикБюджет(event.target.value)}
          classИмя="mt-2"
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>
      <Button
        onClick={() => {
          if (typeof parsedЧерновик === "number" && onСохранить) onСохранить(parsedЧерновик);
        }}
        disabled={!canСохранить || isSaving || parsedЧерновик === null}
      >
        {isSaving ? "Saving..." : summary.amount > 0 ? "Обновить бюджет" : "Установить бюджет"}
      </Button>
    </div>
  ) : null;

  if (isPlain) {
    return (
      <div classИмя="space-y-6">
        <div classИмя="flex items-start justify-between gap-6">
          <div>
            <div classИмя="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {summary.scopeТип}
            </div>
            <div classИмя="mt-2 text-xl font-semibold">{summary.scopeИмя}</div>
            <div classИмя="mt-2 text-sm text-muted-foreground">{windowLabel(summary.windowKind)}</div>
          </div>
          <div
            classИмя={cn(
              "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]",
              summary.status === "hard_stop"
                ? "text-red-300"
                : summary.status === "warning"
                  ? "text-amber-200"
                  : "text-muted-foreground",
            )}
          >
            <СтатусIcon classИмя="h-3.5 w-3.5" />
            {summary.paused ? "Приостановлен" : summary.status === "warning" ? "Предупреждение" : summary.status === "hard_stop" ? "Hard stop" : "Работает"}
          </div>
        </div>

        {observedБюджетGrid}
        {progressSection}
        {pausedPane}
        {saveSection}
        {parsedЧерновик === null ? (
          <p classИмя="text-xs text-destructive">Enter a valid non-negative dollar amount.</p>
        ) : null}
      </div>
    );
  }

  return (
    <Card classИмя={cn("overflow-hidden border-border/70 bg-card/80", compact ? "" : "shadow-[0_20px_80px_-40px_rgba(0,0,0,0.55)]")}>
      <CardHeader classИмя={cn("gap-3", compact ? "px-4 pt-4 pb-2" : "px-5 pt-5 pb-3")}>
        <div classИмя="flex items-start justify-between gap-3">
          <div>
            <div classИмя="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {summary.scopeТип}
            </div>
            <CardНазвание classИмя="mt-1 text-base">{summary.scopeИмя}</CardНазвание>
            <CardОписание classИмя="mt-1">{windowLabel(summary.windowKind)}</CardОписание>
          </div>
          <div classИмя={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]", statusTone(summary.status))}>
            <СтатусIcon classИмя="h-3.5 w-3.5" />
            {summary.paused ? "Приостановлен" : summary.status === "warning" ? "Предупреждение" : summary.status === "hard_stop" ? "Hard stop" : "Работает"}
          </div>
        </div>
      </CardHeader>
      <CardContent classИмя={cn("space-y-4", compact ? "px-4 pb-4 pt-0" : "px-5 pb-5 pt-0")}>
        {observedБюджетGrid}
        {progressSection}
        {pausedPane}
        {saveSection}
        {parsedЧерновик === null ? (
          <p classИмя="text-xs text-destructive">Enter a valid non-negative dollar amount.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
