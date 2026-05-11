import type { АдаптерConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
  ЧерновикInput,
  help,
} from "../../components/agent-config-primitives";
import { ChooseПутьButton } from "../../components/ПутьInstructionsModal";
import { LocalРабочая областьЗапуститьtimeFields } from "../local-workspace-runtime-fields";
import {
  CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS,
  isCodexLocalFastModeSupported,
  isCodexLocalManualМодель,
} from "@paperclipai/adapter-codex-local";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime. Нетte: Codex may still auto-apply repo-scoped AGENTS.md files from the workspace.";

export function CodexLocalConfigFields({
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
  const bypassВключитьd =
    config.dangerouslyBypassСогласованияAndSandbox === true || config.dangerouslyBypassSandbox === true;
  const fastModeВключитьd = isСоздать
    ? Boolean(values!.fastMode)
    : eff("adapterConfig", "fastMode", Boolean(config.fastMode));
  const currentМодель = isСоздать
    ? String(values!.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));
  const fastModeManualМодель = isCodexLocalManualМодель(currentМодель);
  const fastModeSupported = isCodexLocalFastModeSupported(currentМодель);
  const supportedМодельsLabel = CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS.join(", ");
  const fastModeMessage = fastModeManualМодель
    ? "Fast mode will be passed through for this manual model. If Codex rejects it, turn the toggle off."
    : fastModeSupported
      ? "Fast mode consumes credits/tokens much faster than standard Codex runs."
      : `Fast mode currently only works on ${supportedМодельsLabel} or manual model IDs. Paperclip will ignore this toggle until the model is switched.`;

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
        label="Bypass sandbox"
        hint={help.dangerouslyBypassSandbox}
        checked={
          isСоздать
            ? values!.dangerouslyBypassSandbox
            : eff(
                "adapterConfig",
                "dangerouslyBypassСогласованияAndSandbox",
                bypassВключитьd,
              )
        }
        onChange={(v) =>
          isСоздать
            ? set!({ dangerouslyBypassSandbox: v })
            : mark("adapterConfig", "dangerouslyBypassСогласованияAndSandbox", v)
        }
      />
      <ToggleField
        label="Включить search"
        hint={help.search}
        checked={
          isСоздать
            ? values!.search
            : eff("adapterConfig", "search", !!config.search)
        }
        onChange={(v) =>
          isСоздать
            ? set!({ search: v })
            : mark("adapterConfig", "search", v)
        }
      />
      <ToggleField
        label="Fast mode"
        hint={help.fastMode}
        checked={fastModeВключитьd}
        onChange={(v) =>
          isСоздать
            ? set!({ fastMode: v })
            : mark("adapterConfig", "fastMode", v)
        }
      />
      {fastModeВключитьd && (
        <div classИмя="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {fastModeMessage}
        </div>
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
