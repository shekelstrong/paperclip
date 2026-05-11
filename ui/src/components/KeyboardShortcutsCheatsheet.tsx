import { Dialog, DialogContent, DialogHeader, DialogНазвание } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: "Входящие",
    shortcuts: [
      { keys: ["j"], label: "Move down" },
      { keys: ["↓"], label: "Move down" },
      { keys: ["k"], label: "Move up" },
      { keys: ["↑"], label: "Move up" },
      { keys: ["←"], label: "Collapse selected group" },
      { keys: ["→"], label: "Expand selected group" },
      { keys: ["Enter"], label: "Open selected item" },
      { keys: ["a"], label: "Архивировать item" },
      { keys: ["y"], label: "Архивировать item" },
      { keys: ["r"], label: "Mark as read" },
      { keys: ["U"], label: "Mark as unread" },
    ],
  },
  {
    title: "Задача detail",
    shortcuts: [
      { keys: ["y"], label: "Quick-archive back to inbox" },
      { keys: ["g", "i"], label: "Перейти к входящим" },
      { keys: ["g", "c"], label: "Focus comment composer" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: ["/"], label: "Поиск current page or quick search" },
      { keys: ["c"], label: "Новая задача" },
      { keys: ["["], label: "Toggle sidebar" },
      { keys: ["]"], label: "Toggle panel" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
    ],
  },
];

function КлючCap({ children }: { children: string }) {
  return (
    <kbd classИмя="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-[0_1px_0_1px_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

export function КлючboardShortcutsCheatsheetContent() {
  return (
    <>
      <div classИмя="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} classИмя="px-5 py-3">
            <h3 classИмя="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div classИмя="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  classИмя="flex items-center justify-between gap-4"
                >
                  <span classИмя="text-sm text-foreground/90">{shortcut.label}</span>
                  <div classИмя="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} classИмя="flex items-center gap-1">
                        {i > 0 && <span classИмя="text-xs text-muted-foreground">then</span>}
                        <КлючCap>{key}</КлючCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div classИмя="border-t border-border px-5 py-3">
        <p classИмя="text-xs text-muted-foreground">
          Press <КлючCap>Esc</КлючCap> to close &middot; Shortcuts are disabled in text fields
        </p>
      </div>
    </>
  );
}

export function КлючboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent classИмя="sm:max-w-md gap-0 p-0 overflow-hidden" showЗакрытьButton={false}>
        <DialogHeader classИмя="px-5 pt-5 pb-3">
          <DialogНазвание classИмя="text-base">Ключboard shortcuts</DialogНазвание>
        </DialogHeader>
        <КлючboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
