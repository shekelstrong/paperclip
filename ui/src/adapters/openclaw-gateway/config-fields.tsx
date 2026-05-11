import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ЧерновикInput,
  help,
} from "../../components/agent-config-primitives";
import {
  PayloadTemplateJsonField,
  ЗапуститьtimeServicesJsonField,
} from "../runtime-json-fields";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function СекретField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div classИмя="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          classИмя="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye classИмя="h-3.5 w-3.5" /> : <EyeOff classИмя="h-3.5 w-3.5" />}
        </button>
        <ЧерновикInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          classИмя={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

function parseОбластьs(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").join(", ");
  }
  return typeof value === "string" ? value : "";
}

export function OpenClawGatewayConfigFields({
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
}: АдаптерConfigFieldsProps) {
  const configuredHeaders =
    config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
      ? (config.headers as Record<string, unknown>)
      : {};
  const effectiveHeaders =
    (eff("adapterConfig", "headers", configuredHeaders) as Record<string, unknown>) ?? {};

  const effectiveGatewayТокен = typeof effectiveHeaders["x-openclaw-token"] === "string"
    ? String(effectiveHeaders["x-openclaw-token"])
    : typeof effectiveHeaders["x-openclaw-auth"] === "string"
      ? String(effectiveHeaders["x-openclaw-auth"])
      : "";

  const commitGatewayТокен = (rawЗначение: string) => {
    const nextЗначение = rawЗначение.trim();
    const nextHeaders: Record<string, unknown> = { ...effectiveHeaders };
    if (nextЗначение) {
      nextHeaders["x-openclaw-token"] = nextЗначение;
      delete nextHeaders["x-openclaw-auth"];
    } else {
      delete nextHeaders["x-openclaw-token"];
      delete nextHeaders["x-openclaw-auth"];
    }
    mark("adapterConfig", "headers", Object.keys(nextHeaders).length > 0 ? nextHeaders : undefined);
  };

  const sessionStrategy = eff(
    "adapterConfig",
    "sessionКлючStrategy",
    String(config.sessionКлючStrategy ?? "fixed"),
  );

  return (
    <>
      <Field label="Gateway URL" hint={help.webhookUrl}>
        <ЧерновикInput
          value={
            isСоздать
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isСоздать
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          classИмя={inputClass}
          placeholder="ws://127.0.0.1:18789"
        />
      </Field>

      <PayloadTemplateJsonField
        isСоздать={isСоздать}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      <ЗапуститьtimeServicesJsonField
        isСоздать={isСоздать}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      {!isСоздать && (
        <>
          <Field label="Paperclip API URL override">
            <ЧерновикInput
              value={
                eff(
                  "adapterConfig",
                  "paperclipApiUrl",
                  String(config.paperclipApiUrl ?? ""),
                )
              }
              onCommit={(v) => mark("adapterConfig", "paperclipApiUrl", v || undefined)}
              immediate
              classИмя={inputClass}
              placeholder="https://paperclip.example"
            />
          </Field>

          <Field label="Claimed API key path">
            <ЧерновикInput
              value={eff("adapterConfig", "claimedApiКлючПуть", String(config.claimedApiКлючПуть ?? ""))}
              onCommit={(v) => mark("adapterConfig", "claimedApiКлючПуть", v || undefined)}
              immediate
              classИмя={inputClass}
              placeholder="~/.openclaw/workspace/paperclip-claimed-api-key.json"
            />
          </Field>

          <Field label="Session strategy">
            <select
              value={sessionStrategy}
              onChange={(e) => mark("adapterConfig", "sessionКлючStrategy", e.target.value)}
              classИмя={inputClass}
            >
              <option value="fixed">Fixed</option>
              <option value="issue">Per issue</option>
              <option value="run">Per run</option>
            </select>
          </Field>

          {sessionStrategy === "fixed" && (
            <Field label="Session key">
              <ЧерновикInput
                value={eff("adapterConfig", "sessionКлюч", String(config.sessionКлюч ?? "paperclip"))}
                onCommit={(v) => mark("adapterConfig", "sessionКлюч", v || undefined)}
                immediate
                classИмя={inputClass}
                placeholder="paperclip"
              />
            </Field>
          )}

          <СекретField
            label="Gateway auth token (x-openclaw-token)"
            value={effectiveGatewayТокен}
            onCommit={commitGatewayТокен}
            placeholder="OpenClaw gateway token"
          />

          <Field label="Role">
            <ЧерновикInput
              value={eff("adapterConfig", "role", String(config.role ?? "operator"))}
              onCommit={(v) => mark("adapterConfig", "role", v || undefined)}
              immediate
              classИмя={inputClass}
              placeholder="operator"
            />
          </Field>

          <Field label="Областьs (comma-separated)">
            <ЧерновикInput
              value={eff("adapterConfig", "scopes", parseОбластьs(config.scopes ?? ["operator.admin"]))}
              onCommit={(v) => {
                const parsed = v
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                mark("adapterConfig", "scopes", parsed.length > 0 ? parsed : undefined);
              }}
              immediate
              classИмя={inputClass}
              placeholder="operator.admin"
            />
          </Field>

          <Field label="Wait timeout (ms)">
            <ЧерновикInput
              value={eff("adapterConfig", "waitTimeoutMs", String(config.waitTimeoutMs ?? "120000"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "waitTimeoutMs",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                );
              }}
              immediate
              classИмя={inputClass}
              placeholder="120000"
            />
          </Field>

          <Field label="Device auth">
            <div classИмя="text-xs text-muted-foreground leading-relaxed">
              Always enabled for gateway agents. Paperclip persists a device key during onboarding so pairing approvals
              remain stable across runs.
            </div>
          </Field>
        </>
      )}
    </>
  );
}
