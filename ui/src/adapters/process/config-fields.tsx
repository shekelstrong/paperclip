import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ЧерновикInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function formatArgList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }
  return typeof value === "string" ? value : "";
}

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProcessConfigFields({
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
}: АдаптерConfigFieldsProps) {
  return (
    <>
      <Field label="Команда" hint={help.command}>
        <ЧерновикInput
          value={
            isСоздать
              ? values!.command
              : eff("adapterConfig", "command", String(config.command ?? ""))
          }
          onCommit={(v) =>
            isСоздать
              ? set!({ command: v })
              : mark("adapterConfig", "command", v || undefined)
          }
          immediate
          classИмя={inputClass}
          placeholder="e.g. node, python"
        />
      </Field>
      <Field label="Args (comma-separated)" hint={help.args}>
        <ЧерновикInput
          value={
            isСоздать
              ? values!.args
              : eff("adapterConfig", "args", formatArgList(config.args))
          }
          onCommit={(v) =>
            isСоздать
              ? set!({ args: v })
              : mark(
                  "adapterConfig",
                  "args",
                  v ? parseCommaArgs(v) : undefined,
                )
          }
          immediate
          classИмя={inputClass}
          placeholder="e.g. script.js, --flag"
        />
      </Field>
    </>
  );
}
