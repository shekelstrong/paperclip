import { useState, useEffect, useRef, useCallback } from "react";

import type { АдаптерConfigSchema, ConfigFieldSchema, СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";

import type { АдаптерConfigFieldsProps } from "./types";
import {
  Field,
  ЧерновикInput,
  ЧерновикNumberInput,
  ЧерновикTextarea,
  ToggleField,
} from "../components/agent-config-primitives";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { ChevronDown } from "lucide-react";

// ── Select field (extracted to keep hooks at component top level) ──────
function SelectField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOpt = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button classИмя="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
          <span classИмя={!value ? "text-muted-foreground" : ""}>
            {selectedOpt?.label ?? value ?? "Выбрать..."}
          </span>
          <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent classИмя="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {options.map((opt) => (
          <button
            key={opt.value}
            classИмя={`flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50 ${opt.value === value ? "bg-accent" : ""}`}
            onMouseDown={(e) => {
              e.preventПо умолчанию();
              onChange(opt.value);
              setOpen(false);
            }}
          >
            <span>{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";


// ---------------------------------------------------------------------------
// Combobox: type-to-filter dropdown with free text fallback
// ---------------------------------------------------------------------------

function ComboboxField({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { label: string; value: string; group?: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setФильтр] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync filter with external value when it changes (e.g. provider switch resets model)
  useEffect(() => {
    setФильтр("");
  }, [value]);

  const filtered = options.filter((opt) => {
    if (!filter) return true;
    const q = filter.toНизкийerCase();
    return (
      opt.value.toНизкийerCase().includes(q) ||
      opt.label.toНизкийerCase().includes(q) ||
      (opt.group && opt.group.toНизкийerCase().includes(q))
    );
  });

  const selectedOpt = options.find((o) => o.value === value);
  const displayЗначение = filter || selectedOpt?.value || value || "";

  // Group filtered options by `group` field if present
  const grouped = new Map<string, typeof filtered>();
  for (const opt of filtered) {
    const g = opt.group ?? "";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(opt);
  }

  const select = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setФильтр("");
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleКлючDown = (e: React.КлючboardEvent) => {
    if (e.key === "Enter") {
      e.preventПо умолчанию();
      // If exactly one match, select it. Otherwise commit the typed value.
      if (filtered.length === 1) {
        select(filtered[0].value);
      } else if (filter) {
        select(filter);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setФильтр("");
    } else if (e.key === "ArrowDown" && !open) {
      e.preventПо умолчанию();
      setOpen(true);
    }
  };

  return (
    <div classИмя="relative">
      <div classИмя="flex items-center gap-0">
        <input
          ref={inputRef}
          type="text"
          classИмя="flex-1 rounded-l-md border border-r-0 border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 focus:z-10"
          value={displayЗначение}
          placeholder={placeholder ?? "Тип or select..."}
          onChange={(e) => {
            setФильтр(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!open) setOpen(true);
          }}
          onBlur={() => {
            // Delay close to allow click on option to register
            setTimeout(() => setOpen(false), 150);
          }}
          onКлючDown={handleКлючDown}
        />
        <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button classИмя="rounded-r-md border border-border px-2 py-1.5 hover:bg-accent/50 transition-colors">
              <ChevronDown classИмя="h-3 w-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            classИмя="p-1 max-h-60 overflow-y-auto"
            style={{ minWidth: 280 }}
            align="start"
            onOpenАвтоFocus={(e) => e.preventПо умолчанию()}
          >
            {Array.from(grouped.entries()).map(([group, opts]) => (
              <div key={group || "_ungrouped"}>
                {group && (
                  <div classИмя="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group}
                  </div>
                )}
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    classИмя={`flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50 ${
                      opt.value === value ? "bg-accent" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventПо умолчанию(); // prevent input blur
                      select(opt.value);
                    }}
                  >
                    <span classИмя="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            ))}
            {filter && filtered.length === 0 && (
              <div classИмя="px-2 py-1.5 text-sm text-muted-foreground">
                Use &quot;{filter}&quot; as custom value (press Enter)
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SchemaConfigFields component
// ---------------------------------------------------------------------------

const schemaCache = new Map<string, АдаптерConfigSchema | null>();
const schemaFetchInflight = new Map<string, Promise<АдаптерConfigSchema | null>>();
const failedSchemaТипs = new Set<string>();

async function fetchConfigSchema(adapterТип: string): Promise<АдаптерConfigSchema | null> {
  const cached = schemaCache.get(adapterТип);
  if (cached !== undefined) return cached;
  if (failedSchemaТипs.has(adapterТип)) return null;

  const inflight = schemaFetchInflight.get(adapterТип);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/adapters/${encodeURIComponent(adapterТип)}/config-schema`);
      if (!res.ok) {
        failedSchemaТипs.add(adapterТип);
        return null;
      }
      const schema = (await res.json()) as АдаптерConfigSchema;
      schemaCache.set(adapterТип, schema);
      return schema;
    } catch {
      failedSchemaТипs.add(adapterТип);
      return null;
    } finally {
      schemaFetchInflight.delete(adapterТип);
    }
  })();

  schemaFetchInflight.set(adapterТип, promise);
  return promise;
}

export function invalidateConfigSchemaCache(adapterТип: string): void {
  schemaCache.delete(adapterТип);
  failedSchemaТипs.delete(adapterТип);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useConfigSchema(adapterТип: string): АдаптерConfigSchema | null {
  const [schema, setSchema] = useState<АдаптерConfigSchema | null>(
    schemaCache.get(adapterТип) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    fetchConfigSchema(adapterТип).then((s) => {
      if (!cancelled) setSchema(s);
    });
    return () => {
      cancelled = true;
    };
  }, [adapterТип]);

  return schema;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getПо умолчаниюЗначение(field: ConfigFieldSchema): unknown {
  if (field.default !== undefined) return field.default;
  switch (field.type) {
    case "toggle":
      return false;
    case "number":
      return 0;
    case "text":
    case "textarea":
      return "";
    case "select":
      return field.options?.[0]?.value ?? "";
  }
}

export function fieldMatchesVisibleWhen(
  field: ConfigFieldSchema,
  readЗначение: (field: ConfigFieldSchema) => unknown,
  schema: АдаптерConfigSchema,
): boolean {
  const visibleWhen = field.meta?.visibleWhen;
  if (!visibleWhen || typeof visibleWhen !== "object" || Array.isArray(visibleWhen)) return true;

  const condition = visibleWhen as {
    key?: unknown;
    value?: unknown;
    values?: unknown;
    notЗначениеs?: unknown;
  };
  if (typeof condition.key !== "string" || condition.key.length === 0) return true;

  const sourceField = schema.fields.find((candidate) => candidate.key === condition.key);
  if (!sourceField) return true;

  const actual = String(readЗначение(sourceField) ?? "");
  if (typeof condition.value === "string") return actual === condition.value;
  if (Array.isArray(condition.values)) {
    const values = condition.values.filter((value): value is string => typeof value === "string");
    return values.length > 0 && values.includes(actual);
  }
  if (Array.isArray(condition.notЗначениеs)) {
    const values = condition.notЗначениеs.filter((value): value is string => typeof value === "string");
    return !values.includes(actual);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchemaConfigFields({
  adapterТип,
  isСоздать,
  values,
  set,
  config,
  eff,
  mark,
}: АдаптерConfigFieldsProps) {
  const schema = useConfigSchema(adapterТип);

  const [defaultsApplied, setПо умолчаниюsApplied] = useState(false);
  useEffect(() => {
    if (!schema || !isСоздать || defaultsApplied) return;
    const defaults: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const def = getПо умолчаниюЗначение(field);
      if (def !== undefined && def !== "") {
        defaults[field.key] = def;
      }
    }
    if (Object.keys(defaults).length > 0) {
      set?.({
        adapterSchemaЗначениеs: { ...values?.adapterSchemaЗначениеs, ...defaults },
      });
    }
    setПо умолчаниюsApplied(true);
  }, [schema, isСоздать, defaultsApplied, set, values?.adapterSchemaЗначениеs]);

  if (!schema || schema.fields.length === 0) return null;

  function readЗначение(field: ConfigFieldSchema): unknown {
    if (isСоздать) {
      return values?.adapterSchemaЗначениеs?.[field.key] ?? getПо умолчаниюЗначение(field);
    }
    const stored = config[field.key];
    return eff("adapterConfig", field.key, (stored ?? getПо умолчаниюЗначение(field)) as string);
  }

  function writeЗначение(field: ConfigFieldSchema, value: unknown): void {
    if (isСоздать) {
      const next = {
        adapterSchemaЗначениеs: {
          ...values?.adapterSchemaЗначениеs,
          [field.key]: value,
        },
      };

      // When provider changes, auto-clear model if it's not in the new provider's list
      if (field.key === "provider" && schema) {
        const modelField = schema.fields.find((f) => f.key === "model");
        if (modelField?.meta?.providerМодельs) {
          const modelsByПровайдер = modelField.meta.providerМодельs as Record<string, string[]>;
          const providerМодельs = modelsByПровайдер[String(value)] ?? [];
          const currentМодель = values?.adapterSchemaЗначениеs?.model;
          if (currentМодель && String(value) !== "auto" && !providerМодельs.includes(String(currentМодель))) {
            next.adapterSchemaЗначениеs.model = "";
          }
        }
      }

      set?.(next);
    } else {
      mark("adapterConfig", field.key, value);

      // Same logic for edit mode
      if (field.key === "provider" && schema) {
        const modelField = schema.fields.find((f) => f.key === "model");
        if (modelField?.meta?.providerМодельs) {
          const modelsByПровайдер = modelField.meta.providerМодельs as Record<string, string[]>;
          const providerМодельs = modelsByПровайдер[String(value)] ?? [];
          const currentМодель = eff("adapterConfig", "model", "");
          if (currentМодель && String(value) !== "auto" && !providerМодельs.includes(String(currentМодель))) {
            mark("adapterConfig", "model", "");
          }
        }
      }
    }
  }

  return (
    <>
      {schema.fields
        .filter((field) => fieldMatchesVisibleWhen(field, readЗначение, schema))
        .map((field) => {
          switch (field.type) {
            case "select": {
              const currentVal = String(readЗначение(field) ?? "");
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <SelectField
                    value={currentVal}
                    options={field.options ?? []}
                    onChange={(v) => writeЗначение(field, v)}
                  />
                </Field>
              );
            }

            case "toggle":
              return (
                <ToggleField
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  checked={readЗначение(field) === true}
                  onChange={(v) => writeЗначение(field, v)}
                />
              );

            case "number":
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <ЧерновикNumberInput
                    value={Number(readЗначение(field) ?? 0)}
                    onCommit={(v) => writeЗначение(field, v)}
                    immediate
                    classИмя={inputClass}
                  />
                </Field>
              );

            case "textarea":
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <ЧерновикTextarea
                    value={String(readЗначение(field) ?? "")}
                    onCommit={(v) => writeЗначение(field, v || undefined)}
                    immediate
                  />
                </Field>
              );

            case "combobox": {
              const currentVal = String(readЗначение(field) ?? "");
              // Dynamic options: if meta.providerМодельs exists, compute options
              // based on the current provider value
              let comboboxOptions = field.options ?? [];
              if (field.meta?.providerМодельs) {
                const providerVal = String(readЗначение(schema.fields.find((f) => f.key === "provider")!) ?? "auto");
                const modelsByПровайдер = field.meta.providerМодельs as Record<string, string[]>;
                if (providerVal === "auto") {
                  // Авто: show all models from all providers, grouped by provider
                  const providerLabel = schema.fields.find((f) => f.key === "provider");
                  const providerOptions = providerLabel?.options ?? [];
                  comboboxOptions = Object.entries(modelsByПровайдер).flatMap(([prov, models]) =>
                    models.map((m) => ({
                      label: m,
                      value: m,
                      group: providerOptions.find((p) => p.value === prov)?.label ?? prov,
                    })),
                  );
                } else {
                  const providerМодельs = modelsByПровайдер[providerVal] ?? [];
                  const providerLabel = schema.fields.find((f) => f.key === "provider");
                  const provИмя = providerLabel?.options?.find((p) => p.value === providerVal)?.label ?? providerVal;
                  comboboxOptions = providerМодельs.map((m) => ({
                    label: m,
                    value: m,
                    group: provИмя,
                  }));
                }
              }
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <ComboboxField
                    value={currentVal}
                    options={comboboxOptions}
                    onChange={(v) => writeЗначение(field, v || undefined)}
                    placeholder={field.hint}
                  />
                </Field>
              );
            }

            case "text":
            default:
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <ЧерновикInput
                    value={String(readЗначение(field) ?? "")}
                    onCommit={(v) => writeЗначение(field, v || undefined)}
                    immediate
                    classИмя={inputClass}
                  />
                </Field>
              );
          }
        })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Build adapter config from schema values + standard СоздатьConfigЗначениеs fields
// ---------------------------------------------------------------------------

export function buildSchemaАдаптерConfig(
  values: СоздатьConfigЗначениеs,
): Record<string, unknown> {
  const ac: Record<string, unknown> = {};

  if (values.model?.trim()) ac.model = values.model.trim();
  if (values.cwd) ac.cwd = values.cwd;
  if (values.command) ac.command = values.command;
  if (values.instructionsFileПуть) ac.instructionsFileПуть = values.instructionsFileПуть;
  if (values.thinkingEffort) ac.thinkingEffort = values.thinkingEffort;

  if (values.extraArgs) {
    ac.extraArgs = values.extraArgs
      .split(/\s+/)
      .filter(Boolean);
  }

  if (values.adapterSchemaЗначениеs) {
    Object.assign(ac, values.adapterSchemaЗначениеs);
  }

  return ac;
}
