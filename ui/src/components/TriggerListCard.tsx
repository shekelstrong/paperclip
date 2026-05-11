import { Clock3, Pencil, ОбновитьCw, Trash2, Webhook, Zap } from "lucide-react";
import type { ПроцедураTrigger } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { describeРасписание } from "./РасписаниеИзменитьor";
import { timeAgo } from "../lib/timeAgo";

interface TriggerListCardProps {
  trigger: ПроцедураTrigger;
  onИзменить: () => void;
  onУдалить: () => void;
  onToggleВключитьd: (enabled: boolean) => void;
  onRotateСекрет?: () => void;
  toggleОжидание?: boolean;
}

export function TriggerListCard({
  trigger,
  onИзменить,
  onУдалить,
  onToggleВключитьd,
  onRotateСекрет,
  toggleОжидание,
}: TriggerListCardProps) {
  const isРасписание = trigger.kind === "schedule";
  const isWebhook = trigger.kind === "webhook";
  const Icon = isРасписание ? Clock3 : isWebhook ? Webhook : Zap;

  const summary = isРасписание && trigger.cronExpression
    ? describeРасписание(trigger.cronExpression)
    : isWebhook
      ? `Webhook${trigger.publicId ? ` · ${trigger.publicId}` : ""}`
      : "API trigger";

  const nextЗапустить = isРасписание && trigger.enabled && trigger.nextЗапуститьAt
    ? new Date(trigger.nextЗапуститьAt).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    : trigger.enabled ? "—" : "Отключитьd";

  const lastFired = trigger.lastFiredAt ? timeAgo(trigger.lastFiredAt) : "Никогда";

  const resultIsОшибка = typeof trigger.lastResult === "string" && /error|fail/i.test(trigger.lastResult);

  return (
    <div
      className={`rounded-lg border border-border p-3 transition-colors ${trigger.enabled ? "bg-card" : "bg-muted/40"}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className={`text-sm font-medium truncate flex-1 min-w-0 ${trigger.enabled ? "" : "text-muted-foreground"}`}>
          {trigger.label || (isРасписание ? "Расписание" : isWebhook ? "Webhook" : "Trigger")}
        </span>
        <ToggleSwitch
          checked={trigger.enabled}
          onCheckedChange={onToggleВключитьd}
          disabled={toggleОжидание}
          aria-label={trigger.enabled ? "Отключить trigger" : "Включить trigger"}
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Badge variant="outline" className="text-[11px]">
          {trigger.kind}
        </Badge>
        {!trigger.enabled && (
          <Badge variant="secondary" className="text-[11px] text-muted-foreground">
            paused
          </Badge>
        )}
      </div>

      <div className="mt-2 text-sm break-words">{summary}</div>
      {isРасписание && trigger.cronExpression && (
        <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
          {trigger.cronExpression}
          {trigger.timezone ? ` · ${trigger.timezone}` : ""}
        </div>
      )}

      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-muted-foreground">Далее run</dt>
          <dd className="break-words">{nextЗапустить}</dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-muted-foreground">Last fired</dt>
          <dd className="break-words">{lastFired}</dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-muted-foreground">Last result</dt>
          <dd className="min-w-0">
            {trigger.lastResult ? (
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[11px] break-words ${
                  resultIsОшибка
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary text-secondary-foreground"
                }`}
                title={trigger.lastResult}
              >
                {trigger.lastResult}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
        {isWebhook && onRotateСекрет && (
          <Button variant="ghost" size="xs" onClick={onRotateСекрет} title="Rotate secret">
            <ОбновитьCw className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={onИзменить} title="Изменить">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onУдалить}
          title="Удалить"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
