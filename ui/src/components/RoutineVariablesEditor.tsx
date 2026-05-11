import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { syncПроцедураVariablesWithTemplate, type ПроцедураVariable } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogОписание,
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
import { Textarea } from "@/components/ui/textarea";

const variableТипs: ПроцедураVariable["type"][] = ["text", "textarea", "number", "boolean", "select"];

function serializeVariables(value: ПроцедураVariable[]) {
  return JSON.stringify(value);
}

function parseSelectOptions(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function updateVariableList(
  variables: ПроцедураVariable[],
  name: string,
  mutate: (variable: ПроцедураVariable) => ПроцедураVariable,
) {
  return variables.map((variable) => (variable.name === name ? mutate(variable) : variable));
}

export function ПроцедураVariablesИзменитьor({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: ПроцедураVariable[];
  onChange: (value: ПроцедураVariable[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const syncedVariables = useMemo(
    () => syncПроцедураVariablesWithTemplate([title, description], value),
    [description, title, value],
  );
  const syncedSignature = serializeVariables(syncedVariables);
  const currentSignature = serializeVariables(value);

  useEffect(() => {
    if (syncedSignature !== currentSignature) {
      onChange(syncedVariables);
    }
  }, [currentSignature, onChange, syncedSignature, syncedVariables]);

  if (syncedVariables.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} classИмя="overflow-hidden rounded-lg border border-border/70">
      <CollapsibleTrigger classИмя="flex w-full items-center justify-between px-3 py-2 text-left">
        <div>
          <p classИмя="text-sm font-medium">Variables</p>
          <p classИмя="text-xs text-muted-foreground">
            Detected from `{"{{name}}"}` placeholders in the routine title and instructions.
          </p>
        </div>
        {open ? <ChevronDown classИмя="h-4 w-4 text-muted-foreground" /> : <ChevronRight classИмя="h-4 w-4 text-muted-foreground" />}
      </CollapsibleTrigger>
      <CollapsibleContent classИмя="divide-y divide-border/70 border-t border-border/70">
        {syncedVariables.map((variable) => (
          <div key={variable.name} classИмя="p-4">
            <div classИмя="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" classИмя="font-mono text-xs">
                {`{{${variable.name}}}`}
              </Badge>
              <span classИмя="text-xs text-muted-foreground">
                Prompt the user for this value before each manual run.
              </span>
            </div>

            <div classИмя="grid gap-3 md:grid-cols-2">
              <div classИмя="space-y-1.5">
                <Label classИмя="text-xs">Label</Label>
                <Input
                  value={variable.label ?? ""}
                  onChange={(event) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                    ...current,
                    label: event.target.value || null,
                  })))}
                  placeholder={variable.name.replaceВсе("_", " ")}
                />
              </div>

              <div classИмя="space-y-1.5">
                <Label classИмя="text-xs">Тип</Label>
                <Select
                  value={variable.type}
                  onЗначениеChange={(type) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                    ...current,
                    type: type as ПроцедураVariable["type"],
                    defaultЗначение: type === "boolean" ? null : current.defaultЗначение,
                    options: type === "select" ? current.options : [],
                  })))}
                >
                  <SelectTrigger>
                    <SelectЗначение />
                  </SelectTrigger>
                  <SelectContent>
                    {variableТипs.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div classИмя="space-y-1.5 md:col-span-2">
                <div classИмя="flex items-center justify-between gap-3">
                  <Label classИмя="text-xs">По умолчанию value</Label>
                  <label classИмя="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={variable.required}
                      onChange={(event) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                        ...current,
                        required: event.target.checked,
                      })))}
                    />
                    Обязательно
                  </label>
                </div>

                {variable.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={variable.defaultЗначение == null ? "" : String(variable.defaultЗначение)}
                    onChange={(event) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                      ...current,
                      defaultЗначение: event.target.value || null,
                    })))}
                  />
                ) : variable.type === "boolean" ? (
                  <Select
                    value={variable.defaultЗначение === true ? "true" : variable.defaultЗначение === false ? "false" : "__unset__"}
                    onЗначениеChange={(next) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                      ...current,
                      defaultЗначение: next === "__unset__" ? null : next === "true",
                    })))}
                  >
                    <SelectTrigger>
                      <SelectЗначение />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">Нет default</SelectItem>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : variable.type === "select" ? (
                  <div classИмя="grid gap-3 md:grid-cols-2">
                    <div classИмя="space-y-1.5">
                      <Label classИмя="text-xs">Options</Label>
                      <Input
                        value={variable.options.join(", ")}
                        onChange={(event) => {
                          const options = parseSelectOptions(event.target.value);
                          onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                            ...current,
                            options,
                            defaultЗначение:
                              typeof current.defaultЗначение === "string" && options.includes(current.defaultЗначение)
                                ? current.defaultЗначение
                                : null,
                          })));
                        }}
                        placeholder="high, medium, low"
                      />
                    </div>
                    <div classИмя="space-y-1.5">
                      <Label classИмя="text-xs">По умолчанию option</Label>
                      <Select
                        value={typeof variable.defaultЗначение === "string" ? variable.defaultЗначение : "__unset__"}
                        onЗначениеChange={(next) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                          ...current,
                          defaultЗначение: next === "__unset__" ? null : next,
                        })))}
                      >
                        <SelectTrigger>
                          <SelectЗначение placeholder="Нет default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">Нет default</SelectItem>
                          {variable.options.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <Input
                    type={variable.type === "number" ? "number" : "text"}
                    value={variable.defaultЗначение == null ? "" : String(variable.defaultЗначение)}
                    onChange={(event) => onChange(updateVariableList(syncedVariables, variable.name, (current) => ({
                      ...current,
                      defaultЗначение: event.target.value || null,
                    })))}
                    placeholder={variable.type === "number" ? "42" : "По умолчанию value"}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

type BuiltinVariableDoc = {
  name: string;
  example: string;
  description: string;
};

const BUILTIN_VARIABLE_DOCS: BuiltinVariableDoc[] = [
  {
    name: "date",
    example: "2026-04-28",
    description: "Current date in YYYY-MM-DD format (UTC) at the time the routine runs.",
  },
  {
    name: "timestamp",
    example: "April 28, 2026 at 12:17 PM UTC",
    description: "Человек-readable date and time (UTC) at the time the routine runs.",
  },
];

export function ПроцедураVariablesHint() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <div classИмя="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
        <span>
          Use `{"{{variable_name}}"}` placeholders in the instructions to prompt for inputs when the routine runs.
        </span>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          classИмя="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Show variable help"
        >
          <HelpCircle classИмя="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent classИмя="sm:max-w-xl">
          <DialogHeader>
            <DialogНазвание>Процедура variables</DialogНазвание>
            <DialogОписание>
              How to prompt for inputs and which variables Paperclip fills in automatically.
            </DialogОписание>
          </DialogHeader>

          <div classИмя="space-y-5 text-sm">
            <section classИмя="space-y-2">
              <h3 classИмя="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Свой variables
              </h3>
              <p classИмя="text-muted-foreground">
                Тип{" "}
                <code classИмя="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
                  {"{{variable_name}}"}
                </code>{" "}
                anywhere in the title or instructions. Paperclip detects each placeholder, lists it
                under <span classИмя="font-medium text-foreground">Variables</span>, and prompts
                for a value before each run.
              </p>
              <ul classИмя="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Имяs must start with a letter and may use letters, numbers, and underscores.</li>
                <li>Pick a type (text, textarea, number, boolean, select), default value, and whether it is required.</li>
                <li>The same name reused across the title and instructions is treated as one variable.</li>
              </ul>
            </section>

            <section classИмя="space-y-2">
              <h3 classИмя="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Built-in variables
              </h3>
              <p classИмя="text-muted-foreground">
                These are filled in automatically — no setup needed and they will not appear in the
                Variables list.
              </p>
              <div classИмя="overflow-hidden rounded-lg border border-border/70">
                <table classИмя="w-full text-left text-xs">
                  <thead classИмя="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th classИмя="px-3 py-2 font-medium">Placeholder</th>
                      <th classИмя="px-3 py-2 font-medium">Example</th>
                      <th classИмя="px-3 py-2 font-medium">Описание</th>
                    </tr>
                  </thead>
                  <tbody classИмя="divide-y divide-border/70">
                    {BUILTIN_VARIABLE_DOCS.map((entry) => (
                      <tr key={entry.name} classИмя="align-top">
                        <td classИмя="px-3 py-2">
                          <Badge variant="outline" classИмя="font-mono text-xs">{`{{${entry.name}}}`}</Badge>
                        </td>
                        <td classИмя="px-3 py-2 font-mono text-muted-foreground">{entry.example}</td>
                        <td classИмя="px-3 py-2 text-muted-foreground">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
