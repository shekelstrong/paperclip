import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    title: "Inbox",
    shortcuts: [
      { keys: ["j"], label: "Переместить вниз" },
      { keys: ["↓"], label: "Переместить вниз" },
      { keys: ["k"], label: "Переместить вверх" },
      { keys: ["↑"], label: "Переместить вверх" },
      { keys: ["←"], label: "Свернуть выбранную группу" },
      { keys: ["→"], label: "Развернуть выбранную группу" },
      { keys: ["Enter"], label: "Открыть выбранный элемент" },
      { keys: ["a"], label: "Архивировать элемент" },
      { keys: ["y"], label: "Архивировать элемент" },
      { keys: ["r"], label: "Отметить прочитанным" },
      { keys: ["U"], label: "Отметить непрочитанным" },
    ],
  },
  {
    title: "Детали задачи",
    shortcuts: [
      { keys: ["y"], label: "Быстрое архивирование обратно во входящие" },
      { keys: ["g", "i"], label: "Перейти к входящим" },
      { keys: ["g", "c"], label: "Фокус на редакторе комментария" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: ["/"], label: "Поиск текущей страницы или быстрый поиск" },
      { keys: ["c"], label: "Новая задача" },
      { keys: ["["], label: "Переключить сайдбар" },
      { keys: ["]"], label: "Переключить панель" },
      { keys: ["?"], label: "Показать горячие клавиши" },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-[0_1px_0_1px_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-muted-foreground">then</span>}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Press <KeyCap>Esc</KeyCap> to close &middot; Shortcuts are disabled in text fields
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
