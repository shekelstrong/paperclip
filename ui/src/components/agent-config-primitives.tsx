import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogНазвание,
  DialogОписание,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";

/* ---- Help text for (?) tooltips ---- */
export const help: Record<string, string> = {
  name: "Display name for this agent.",
  title: "Job title shown in the org chart.",
  role: "Оргструктураanizational role. Determines position and capabilities.",
  reportsTo: "The agent this one reports to in the org hierarchy.",
  capabilities: "Describes what this agent can do. Shown in the org chart and used for task routing.",
  adapterТип: "How this agent runs: local CLI (Claude/Codex/OpenCode), OpenClaw Gateway, spawned process, or generic HTTP webhook.",
  cwd: "Deprecated legacy working directory fallback for local adapters. Existing agents may still carry this value, but new configurations should use project workspaces instead.",
  promptTemplate: "Sent on every heartbeat. Keep this small and dynamic. Use it for current-task framing, not large static instructions. Supports {{ agent.id }}, {{ agent.name }}, {{ agent.role }} and other template variables.",
  model: "Override the default model used by the adapter.",
  thinkingEffort: "Control model reasoning depth. Supported values vary by adapter/model.",
  chrome: "Включить Claude's Chrome integration by passing --chrome.",
  dangerouslySkipPermissions: "Запустить unattended by auto-approving adapter permission prompts when supported.",
  dangerouslyBypassSandbox: "Запустить Codex without sandbox restrictions. Обязательно for filesystem/network access.",
  search: "Включить Codex web search capability during runs.",
  fastMode: "Включить Codex Fast mode. This burns credits/tokens much faster and is supported on GPT-5.4 and manual Codex model IDs.",
  workspaceStrategy: "How Paperclip should realize an execution workspace for this agent. Keep project_primary for normal cwd execution, or use git_worktree for issue-scoped isolated checkouts.",
  workspaceBaseRef: "Base git ref used when creating a worktree branch. Leave blank to use the resolved workspace ref or HEAD.",
  workspaceВеткаTemplate: "Template for naming derived branches. Supports {{issue.identifier}}, {{issue.title}}, {{agent.name}}, {{project.id}}, {{workspace.repoRef}}, and {{slug}}.",
  worktreeРодительDir: "Directory where derived worktrees should be created. Absolute, ~-prefixed, and repo-relative paths are supported.",
  runtimeServicesJson: "Опционально workspace runtime service definitions. Use this for shared app servers, workers, or other long-lived companion processes attached to the workspace.",
  maxTurnsPerЗапустить: "Maximum number of agentic turns (tool calls) per heartbeat run.",
  command: "The command to execute (e.g. node, python).",
  localКоманда: "Override the path to the CLI command you want the adapter to call (e.g. /usr/local/bin/claude, codex, opencode).",
  args: "Команда-line arguments, comma-separated.",
  extraArgs: "Extra CLI arguments for local adapters, comma-separated.",
  envVars: "Окружение variables injected into the adapter process. Use plain values or secret references.",
  bootstrapPrompt: "Only sent when Paperclip starts a fresh session. Use this for stable setup guidance that should not be repeated on every heartbeat.",
  payloadTemplateJson: "Опционально JSON merged into remote adapter request payloads before Paperclip adds its standard wake and workspace fields.",
  webhookUrl: "The URL that receives POST requests when the agent is invoked.",
  heartbeatInterval: "Запустить this agent automatically on a timer. Useful for periodic tasks like checking for new work.",
  intervalSec: "Seconds between automatic heartbeat invocations.",
  timeoutSec: "Maximum seconds a run can take before being terminated. 0 means no timeout.",
  graceSec: "Seconds to wait after sending interrupt before force-killing the process.",
  wakeOnDemand: "Всеow this agent to be woken by assignments, API calls, UI actions, or automated systems.",
  cooldownSec: "Minimum seconds between consecutive heartbeat runs.",
  maxConcurrentЗапуститьs: "Maximum number of heartbeat runs that can execute simultaneously for this agent.",
  maxTurnContinuationВключитьd: "Автоmatically queue bounded continuation runs when an adapter stops because its per-run turn cap was exhausted.",
  maxTurnContinuationMaxAttempts: "Maximum automatic continuations after one max-turn stop. This is separate from max turns per run.",
  maxTurnContinuationDelaySec: "Seconds to wait before starting each max-turn continuation.",
  budgetMonthlyCents: "Monthly spending limit in cents. 0 means no limit.",
};

import { getАдаптерЯрлыки } from "../adapters/adapter-display-registry";

export const adapterЯрлыки = getАдаптерЯрлыки();

export const roleЯрлыки = AGENT_ROLE_LABELS as Record<string, string>;

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" classИмя="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle classИмя="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" classИмя="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactНетde }) {
  return (
    <div>
      <div classИмя="flex items-center gap-1.5 mb-1">
        <label classИмя="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleПроверитьId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleПроверитьId?: string;
}) {
  return (
    <div classИмя="flex items-center justify-between">
      <div classИмя="flex items-center gap-1.5">
        <span classИмя="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      <button
        data-slot="toggle"
        data-testid={toggleПроверитьId}
        type="button"
        classИмя={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-green-600" : "bg-muted"
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          classИмя={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div classИмя="space-y-2">
      <div classИмя="flex items-center justify-between gap-3">
        <div classИмя="flex items-center gap-1.5">
          <span classИмя="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div classИмя="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            classИмя="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactНетde;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactНетde;
}) {
  return (
    <div classИмя={cn(bordered && "border-t border-border")}>
      <button
        classИмя="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown classИмя="h-3 w-3" /> : <ChevronRight classИмя="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div classИмя="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function АвтоExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      classИмя="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function ЧерновикInput({
  value,
  onCommit,
  immediate,
  classИмя,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  classИмя?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "classИмя">) {
  const [draft, setЧерновик] = useState(value);
  useEffect(() => setЧерновик(value), [value]);

  return (
    <input
      classИмя={classИмя}
      value={draft}
      onChange={(e) => {
        setЧерновик(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Авто-expanding textarea with draft state and blur-commit.
 */
export function ЧерновикTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setЧерновик] = useState(value);
  useEffect(() => setЧерновик(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      classИмя="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setЧерновик(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function ЧерновикNumberInput({
  value,
  onCommit,
  immediate,
  classИмя,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  classИмя?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "classИмя" | "type">) {
  const [draft, setЧерновик] = useState(String(value));
  useEffect(() => setЧерновик(String(value)), [value]);

  return (
    <input
      type="number"
      classИмя={classИмя}
      value={draft}
      onChange={(e) => {
        setЧерновик(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChooseПутьButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        classИмя="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        Choose
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogНазвание>Specify path manually</DialogНазвание>
            <DialogОписание>
              Browser security blocks apps from reading full local paths via a file picker.
              Копировать the absolute path and paste it into the input.
            </DialogОписание>
          </DialogHeader>
          <div classИмя="space-y-4 text-sm">
            <section classИмя="space-y-1.5">
              <p classИмя="font-medium">macOS (Finder)</p>
              <ol classИмя="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Find the folder in Finder.</li>
                <li>Hold <kbd>Option</kbd> and right-click the folder.</li>
                <li>Click "Копировать &lt;folder name&gt; as Путьname".</li>
                <li>Paste the result into the path input.</li>
              </ol>
              <p classИмя="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                /Users/yourname/Документы/project
              </p>
            </section>
            <section classИмя="space-y-1.5">
              <p classИмя="font-medium">Windows (File Explorer)</p>
              <ol classИмя="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Find the folder in File Explorer.</li>
                <li>Hold <kbd>Shift</kbd> and right-click the folder.</li>
                <li>Click "Копировать as path".</li>
                <li>Paste the result into the path input.</li>
              </ol>
              <p classИмя="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                C:\Users\yourname\Документы\project
              </p>
            </section>
            <section classИмя="space-y-1.5">
              <p classИмя="font-medium">Terminal fallback (macOS/Linux)</p>
              <ol classИмя="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Запустить <code>cd /path/to/folder</code>.</li>
                <li>Запустить <code>pwd</code>.</li>
                <li>Копировать the output and paste it into the path input.</li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex items-center gap-3">
      <div classИмя="flex items-center gap-1.5 shrink-0">
        <label classИмя="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div classИмя="w-24 ml-auto">{children}</div>
    </div>
  );
}
