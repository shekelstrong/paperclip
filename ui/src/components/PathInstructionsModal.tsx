import { useState } from "react";
import { Apple, Monitor, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogНазвание,
  DialogОписание,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Platform = "mac" | "windows" | "linux";

const platforms: { id: Platform; label: string; icon: typeof Apple }[] = [
  { id: "mac", label: "macOS", icon: Apple },
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "linux", label: "Linux", icon: Terminal },
];

const instructions: Record<Platform, { steps: string[]; tip?: string }> = {
  mac: {
    steps: [
      "Open Finder and navigate to the folder.",
      "Right-click (or Control-click) the folder.",
      "Hold the Option (⌥) key — \"Копировать\" changes to \"Копировать as Путьname\".",
      "Click \"Копировать as Путьname\", then paste here.",
    ],
    tip: "You can also open Terminal, type cd, drag the folder into the terminal window, and press Enter. Then type pwd to see the full path.",
  },
  windows: {
    steps: [
      "Open File Explorer and navigate to the folder.",
      "Click in the address bar at the top — the full path will appear.",
      "Копировать the path, then paste here.",
    ],
    tip: "Alternatively, hold Shift and right-click the folder, then select \"Копировать as path\".",
  },
  linux: {
    steps: [
      "Open a terminal and navigate to the directory with cd.",
      "Запустить pwd to print the full path.",
      "Копировать the output and paste here.",
    ],
    tip: "In most file managers, Ctrl+L reveals the full path in the address bar.",
  },
};

function detectPlatform(): Platform {
  const ua = navigator.userАгент.toНизкийerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "linux";
}

interface ПутьInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ПутьInstructionsModal({
  open,
  onOpenChange,
}: ПутьInstructionsModalProps) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);

  const current = instructions[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="sm:max-w-md">
        <DialogHeader>
          <DialogНазвание classИмя="text-base">How to get a full path</DialogНазвание>
          <DialogОписание>
            Paste the absolute path (e.g.{" "}
            <code classИмя="text-xs bg-muted px-1 py-0.5 rounded">/Users/you/project</code>
            ) into the input field.
          </DialogОписание>
        </DialogHeader>

        {/* Platform tabs */}
        <div classИмя="flex gap-1 rounded-md border border-border p-0.5">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              classИмя={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                platform === p.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
              onClick={() => setPlatform(p.id)}
            >
              <p.icon classИмя="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <ol classИмя="space-y-2 text-sm">
          {current.steps.map((step, i) => (
            <li key={i} classИмя="flex gap-2">
              <span classИмя="text-muted-foreground font-mono text-xs mt-0.5 shrink-0">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {current.tip && (
          <p classИмя="text-xs text-muted-foreground border-l-2 border-border pl-3">
            {current.tip}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small "Choose" button that opens the ПутьInstructionsModal.
 * Drop-in replacement for the old showDirectoryPicker buttons.
 */
export function ChooseПутьButton({ classИмя }: { classИмя?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        classИмя={cn(
          "inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0",
          classИмя,
        )}
        onClick={() => setOpen(true)}
      >
        Choose
      </button>
      <ПутьInstructionsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
