import { useEffect, useState } from "react";
import type { ПроцедураTrigger } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { РасписаниеИзменитьor } from "./РасписаниеИзменитьor";

const triggerKinds = ["schedule", "webhook"] as const;
const signingModes = ["bearer", "hmac_sha256", "github_hmac", "none"] as const;
const SIGNING_MODES_WITHOUT_REPLAY_WINDOW = new Set<string>(["github_hmac", "none"]);
const signingModeОписаниеs: Record<string, string> = {
  bearer: "Expect a shared bearer token in the Authorization header.",
  hmac_sha256: "Expect an HMAC SHA-256 signature over the request using the shared secret.",
  github_hmac: "Принять GitHub-style X-Hub-Signature-256 header (HMAC over raw body, no timestamp).",
  none: "Нет authentication — the webhook URL itself acts as a shared secret.",
};

type TriggerKind = (typeof triggerKinds)[number];

export interface TriggerDialogState {
  label: string;
  kind: TriggerKind;
  cronExpression: string;
  signingMode: string;
  replayWindowSec: string;
  enabled: boolean;
}

interface TriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing an existing trigger, pass it here. Null for create. */
  trigger: ПроцедураTrigger | null;
  /** Timezone to use when creating a new schedule trigger (the detail page uses the browser's zone). */
  fallbackTimezone: string;
  /** Called when the user submits. For updates `id` is non-null. */
  onОтправить: (payload: {
    id: string | null;
    kind: TriggerKind;
    // For create: full body. For update: partial patch ready to send.
    body: Record<string, unknown>;
  }) => void;
  submitting?: boolean;
}

const BLANK: TriggerDialogState = {
  label: "",
  kind: "schedule",
  cronExpression: "0 9 * * 1-5",
  signingMode: "bearer",
  replayWindowSec: "300",
  enabled: true,
};

function draftFromTrigger(trigger: ПроцедураTrigger | null): TriggerDialogState {
  if (!trigger) return { ...BLANK };
  return {
    label: trigger.label ?? "",
    kind: (trigger.kind as TriggerKind) ?? "schedule",
    cronExpression: trigger.cronExpression ?? "0 9 * * 1-5",
    signingMode: trigger.signingMode ?? "bearer",
    replayWindowSec: String(trigger.replayWindowSec ?? 300),
    enabled: trigger.enabled,
  };
}

function parseReplayWindowSec(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 300;
  return Math.trunc(parsed);
}

export function TriggerDialog({
  open,
  onOpenChange,
  trigger,
  fallbackTimezone,
  onОтправить,
  submitting,
}: TriggerDialogProps) {
  const isИзменить = !!trigger;
  const [draft, setЧерновик] = useState<TriggerDialogState>(() => draftFromTrigger(trigger));

  // Сбросить the draft whenever the dialog opens with a different trigger.
  useEffect(() => {
    if (open) setЧерновик(draftFromTrigger(trigger));
  }, [open, trigger]);

  const handleОтправить = () => {
    const labelTrimmed = draft.label.trim();

    if (isИзменить && trigger) {
      // Build a PATCH body. Match the fields the backend accepts on
      // PATCH /routine-triggers/:id (see updateПроцедураTriggerSchema).
      const patch: Record<string, unknown> = {
        label: labelTrimmed || null,
        enabled: draft.enabled,
      };
      if (trigger.kind === "schedule") {
        patch.cronExpression = draft.cronExpression.trim();
        patch.timezone = trigger.timezone ?? fallbackTimezone;
      }
      if (trigger.kind === "webhook") {
        patch.signingMode = draft.signingMode;
        patch.replayWindowSec = parseReplayWindowSec(draft.replayWindowSec);
      }
      onОтправить({ id: trigger.id, kind: trigger.kind as TriggerKind, body: patch });
      return;
    }

    // Создать body: match POST /routines/:id/triggers (createПроцедураTriggerSchema).
    const body: Record<string, unknown> = {
      kind: draft.kind,
      label: labelTrimmed || draft.kind,
    };
    if (draft.kind === "schedule") {
      body.cronExpression = draft.cronExpression.trim();
      body.timezone = fallbackTimezone;
    }
    if (draft.kind === "webhook") {
      body.signingMode = draft.signingMode;
      body.replayWindowSec = parseReplayWindowSec(draft.replayWindowSec);
    }
    onОтправить({ id: null, kind: draft.kind, body });
  };

  const showWebhookFields = draft.kind === "webhook";
  const showРасписаниеFields = draft.kind === "schedule";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogНазвание>{isИзменить ? "Изменить trigger" : "Добавить триггер"}</DialogНазвание>
          <DialogОписание>
            Configure when and how this routine fires.
          </DialogОписание>
        </DialogHeader>

        <div classИмя="space-y-5 pt-1">
          <div classИмя="space-y-1.5">
            <Label htmlFor="trigger-label" classИмя="text-xs">Label</Label>
            <Input
              id="trigger-label"
              placeholder="e.g. Morning digest"
              value={draft.label}
              onChange={(e) => setЧерновик((d) => ({ ...d, label: e.target.value }))}
            />
            <p classИмя="text-xs text-muted-foreground">
              Опционально — shown in the trigger list.
            </p>
          </div>

          <div classИмя="space-y-1.5">
            <Label classИмя="text-xs">Kind</Label>
            <Select
              value={draft.kind}
              onЗначениеChange={(kind) => setЧерновик((d) => ({ ...d, kind: kind as TriggerKind }))}
              disabled={isИзменить}
            >
              <SelectTrigger>
                <SelectЗначение />
              </SelectTrigger>
              <SelectContent>
                {triggerKinds.map((kind) => (
                  <SelectItem
                    key={kind}
                    value={kind}
                    disabled={!isИзменить && kind === "webhook"}
                  >
                    {kind}
                    {!isИзменить && kind === "webhook" ? " — COMING SOON" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isИзменить && (
              <p classИмя="text-xs text-muted-foreground">
                Kind can't be changed after creation.
              </p>
            )}
          </div>

          {showРасписаниеFields && (
            <РасписаниеИзменитьor
              value={draft.cronExpression}
              onChange={(cronExpression) => setЧерновик((d) => ({ ...d, cronExpression }))}
            />
          )}

          {showWebhookFields && (
            <div classИмя="grid gap-3 md:grid-cols-2">
              <div classИмя="space-y-1.5">
                <Label classИмя="text-xs">Signing mode</Label>
                <Select
                  value={draft.signingMode}
                  onЗначениеChange={(signingMode) => setЧерновик((d) => ({ ...d, signingMode }))}
                >
                  <SelectTrigger>
                    <SelectЗначение />
                  </SelectTrigger>
                  <SelectContent>
                    {signingModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p classИмя="text-xs text-muted-foreground">
                  {signingModeОписаниеs[draft.signingMode]}
                </p>
              </div>
              {!SIGNING_MODES_WITHOUT_REPLAY_WINDOW.has(draft.signingMode) && (
                <div classИмя="space-y-1.5">
                  <Label classИмя="text-xs">Replay window (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.replayWindowSec}
                    onChange={(e) =>
                      setЧерновик((d) => ({ ...d, replayWindowSec: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter classИмя="mt-6">
          {isИзменить && (
            <label classИмя="flex items-center gap-2 cursor-pointer text-sm mr-auto">
              <ToggleSwitch
                checked={draft.enabled}
                onCheckedChange={(enabled) => setЧерновик((d) => ({ ...d, enabled }))}
              />
              <span>{draft.enabled ? "Включитьd" : "Приостановлен"}</span>
            </label>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleОтправить} disabled={submitting}>
            {submitting ? "Saving…" : isИзменить ? "Сохранить изменения" : "Добавить триггер"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
