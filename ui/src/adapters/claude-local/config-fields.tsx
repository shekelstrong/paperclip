import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
  ЧерновикInput,
  ЧерновикNumberInput,
  help,
} from "../../components/agent-config-primitives";
import { ChooseПутьButton } from "../../components/ПутьInstructionsModal";
import { LocalРабочая областьЗапуститьtimeFields } from "../local-workspace-runtime-fields";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.";

export function ClaudeLocalConfigFields({
  mode,
  isСоздать,
  adapterТип,
  values,
  set,
  config,
  eff,
  mark,
  models,
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
      <LocalРабочая областьЗапуститьtimeFields
        isСоздать={isСоздать}
        values={values}
        set={set}
        config={config}
        mark={mark}
        eff={eff}
        mode={mode}
        adapterТип={adapterТип}
        models={models}
      />
    </>
  );
}

export function ClaudeLocalДополнительноFields({
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
}: АдаптерConfigFieldsProps) {
  return (
    <>
      <ToggleField
        label="Включить Chrome"
        hint={help.chrome}
        checked={
          isСоздать
            ? values!.chrome
            : eff("adapterConfig", "chrome", config.chrome === true)
        }
        onChange={(v) =>
          isСоздать
            ? set!({ chrome: v })
            : mark("adapterConfig", "chrome", v)
        }
      />
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
      <Field label="Max turns per run" hint={help.maxTurnsPerЗапустить}>
        {isСоздать ? (
          <input
            type="number"
            classИмя={inputClass}
            value={values!.maxTurnsPerЗапустить}
            onChange={(e) => set!({ maxTurnsPerЗапустить: Number(e.target.value) })}
          />
        ) : (
          <ЧерновикNumberInput
            value={eff(
              "adapterConfig",
              "maxTurnsPerЗапустить",
              Number(config.maxTurnsPerЗапустить ?? 1000),
            )}
            onCommit={(v) => mark("adapterConfig", "maxTurnsPerЗапустить", v || 1000)}
            immediate
            classИмя={inputClass}
          />
        )}
      </Field>
    </>
  );
}
