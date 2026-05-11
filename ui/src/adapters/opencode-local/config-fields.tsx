import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
  ЧерновикInput,
  help,
} from "../../components/agent-config-primitives";
import { ChooseПутьButton } from "../../components/ПутьInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.";

export function OpenCodeLocalConfigFields({
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
  hideInstructionsFile,
}: АдаптерConfigFieldsProps) {
  return (
    <>
      {!hideInstructionsFile && (
        <Field label="Агент instructions file" hint={instructionsFileHint}>
          <div classИмя="flex items-center gap-2">
            <ЧерновикInput
              value={
                isСоздать
                  ? values!.instructionsFileПуть ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFileПуть",
                      String(config.instructionsFileПуть ?? ""),
                    )
              }
              onCommit={(v) =>
                isСоздать
                  ? set!({ instructionsFileПуть: v })
                  : mark("adapterConfig", "instructionsFileПуть", v || undefined)
              }
              immediate
              classИмя={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChooseПутьButton />
          </div>
        </Field>
      )}
      <ToggleField
        label="Skip permissions"
        hint={help.dangerouslySkipPermissions}
        checked={
          isСоздать
            ? values!.dangerouslySkipPermissions
            : eff(
                "adapterConfig",
                "dangerouslySkipPermissions",
                config.dangerouslySkipPermissions !== false,
              )
        }
        onChange={(v) =>
          isСоздать
            ? set!({ dangerouslySkipPermissions: v })
            : mark("adapterConfig", "dangerouslySkipPermissions", v)
        }
      />
    </>
  );
}
