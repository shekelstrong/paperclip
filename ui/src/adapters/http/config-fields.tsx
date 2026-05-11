import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ЧерновикInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function HttpConfigFields({
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
}: АдаптерConfigFieldsProps) {
  return (
    <Field label="Webhook URL" hint={help.webhookUrl}>
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
        placeholder="https://..."
      />
    </Field>
  );
}
