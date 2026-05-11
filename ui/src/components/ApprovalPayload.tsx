import { UserPlus, Lightbulb, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatCents } from "../lib/utils";

export const typeLabel: Record<string, string> = {
  hire_agent: "Нанять агента",
  approve_ceo_strategy: "CEO Strategy",
  budget_override_required: "Бюджет Override",
  request_board_approval: "Совет Согласование",
};

function firstНетnEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function approvalSubject(payload?: Record<string, unknown> | null): string | null {
  return firstНетnEmptyString(
    payload?.title,
    payload?.name,
    payload?.summary,
    payload?.recommendedAction,
  );
}

/** Build a contextual label for an approval, e.g. "Нанять агента: Designer" */
export function approvalLabel(type: string, payload?: Record<string, unknown> | null): string {
  const base = typeLabel[type] ?? type;
  const subject = approvalSubject(payload);
  if (subject) {
    return `${base}: ${subject}`;
  }
  return base;
}

export const typeIcon: Record<string, typeof UserPlus> = {
  hire_agent: UserPlus,
  approve_ceo_strategy: Lightbulb,
  budget_override_required: ShieldAlert,
  request_board_approval: ShieldCheck,
};

export const defaultТипIcon = ShieldCheck;

function PayloadField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div classИмя="flex items-center gap-2">
      <span classИмя="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

function НавыкList({ values }: { values: unknown }) {
  if (!Array.isArray(values)) return null;
  const items = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div classИмя="flex items-start gap-2">
      <span classИмя="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Навыки</span>
      <div classИмя="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            classИмя="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HireАгентPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div classИмя="mt-3 space-y-1.5 text-sm">
      <div classИмя="flex items-center gap-2">
        <span classИмя="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Имя</span>
        <span classИмя="font-medium">{String(payload.name ?? "—")}</span>
      </div>
      <PayloadField label="Role" value={payload.role} />
      <PayloadField label="Название" value={payload.title} />
      <PayloadField label="Icon" value={payload.icon} />
      {!!payload.capabilities && (
        <div classИмя="flex items-start gap-2">
          <span classИмя="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Capabilities</span>
          <span classИмя="text-muted-foreground">{String(payload.capabilities)}</span>
        </div>
      )}
      {!!payload.adapterТип && (
        <div classИмя="flex items-center gap-2">
          <span classИмя="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Адаптер</span>
          <span classИмя="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.adapterТип)}
          </span>
        </div>
      )}
      <НавыкList values={payload.desiredНавыки} />
    </div>
  );
}

export function CeoStrategyPayload({ payload }: { payload: Record<string, unknown> }) {
  const plan = payload.plan ?? payload.description ?? payload.strategy ?? payload.text;
  return (
    <div classИмя="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Название" value={payload.title} />
      {!!plan && (
        <div classИмя="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
          {String(plan)}
        </div>
      )}
      {!plan && (
        <pre classИмя="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground overflow-x-auto max-h-48">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function БюджетOverridePayload({ payload }: { payload: Record<string, unknown> }) {
  const budgetAmount = typeof payload.budgetAmount === "number" ? payload.budgetAmount : null;
  const observedAmount = typeof payload.observedAmount === "number" ? payload.observedAmount : null;
  return (
    <div classИмя="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Область" value={payload.scopeИмя ?? payload.scopeТип} />
      <PayloadField label="Window" value={payload.windowKind} />
      <PayloadField label="Metric" value={payload.metric} />
      {(budgetAmount !== null || observedAmount !== null) ? (
        <div classИмя="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Limit {budgetAmount !== null ? formatCents(budgetAmount) : "—"} · Observed {observedAmount !== null ? formatCents(observedAmount) : "—"}
        </div>
      ) : null}
      {!!payload.guidance && (
        <p classИмя="text-muted-foreground">{String(payload.guidance)}</p>
      )}
    </div>
  );
}

export function СоветСогласованиеPayload({
  payload,
  hideНазвание = false,
}: {
  payload: Record<string, unknown>;
  hideНазвание?: boolean;
}) {
  const nextPayload = hideНазвание ? { ...payload, title: undefined } : payload;
  return (
    <СоветСогласованиеPayloadContent payload={nextPayload} />
  );
}

function СоветСогласованиеPayloadContent({ payload }: { payload: Record<string, unknown> }) {
  const risks = Array.isArray(payload.risks)
    ? payload.risks
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const title = firstНетnEmptyString(payload.title);
  const summary = firstНетnEmptyString(payload.summary);
  const recommendedAction = firstНетnEmptyString(payload.recommendedAction);
  const nextActionOnСогласование = firstНетnEmptyString(payload.nextActionOnСогласование);
  const proposedComment = firstНетnEmptyString(payload.proposedComment);

  return (
    <div classИмя="mt-4 space-y-3.5 text-sm">
      {title && (
        <div classИмя="space-y-1">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Название</p>
          <p classИмя="font-medium leading-6 text-foreground">{title}</p>
        </div>
      )}
      {summary && (
        <div classИмя="space-y-1">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Summary</p>
          <p classИмя="leading-6 text-foreground/90">{summary}</p>
        </div>
      )}
      {recommendedAction && (
        <div classИмя="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-3">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
            Recommended action
          </p>
          <p classИмя="mt-1 leading-6 text-foreground">{recommendedAction}</p>
        </div>
      )}
      {nextActionOnСогласование && (
        <div classИмя="rounded-lg border border-border/60 bg-background/60 px-3.5 py-3">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">On approval</p>
          <p classИмя="mt-1 leading-6 text-foreground">{nextActionOnСогласование}</p>
        </div>
      )}
      {risks.length > 0 && (
        <div classИмя="space-y-1.5">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Risks</p>
          <ul classИмя="space-y-1 text-sm text-muted-foreground">
            {risks.map((risk) => (
              <li key={risk} classИмя="flex items-start gap-2">
                <span classИмя="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                <span classИмя="leading-6">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposedComment && (
        <div classИмя="space-y-1.5">
          <p classИмя="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Proposed comment
          </p>
          <pre classИмя="max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/50 px-3.5 py-3 font-mono text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
            {proposedComment}
          </pre>
        </div>
      )}
    </div>
  );
}

export function СогласованиеPayloadRenderer({
  type,
  payload,
  hidePrimaryНазвание = false,
}: {
  type: string;
  payload: Record<string, unknown>;
  hidePrimaryНазвание?: boolean;
}) {
  if (type === "hire_agent") return <HireАгентPayload payload={payload} />;
  if (type === "budget_override_required") return <БюджетOverridePayload payload={payload} />;
  if (type === "request_board_approval") {
    return <СоветСогласованиеPayload payload={payload} hideНазвание={hidePrimaryНазвание} />;
  }
  return <CeoStrategyPayload payload={payload} />;
}
