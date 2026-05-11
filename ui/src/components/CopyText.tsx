import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface КопироватьTextProps {
  text: string;
  /** What to display. По умолчаниюs to `text`. */
  children?: React.ReactНетde;
  containerClassИмя?: string;
  classИмя?: string;
  ariaLabel?: string;
  title?: string;
  /** Tooltip message shown after copying. По умолчанию: "Copied!" */
  copiedLabel?: string;
}

export function КопироватьText({
  text,
  children,
  containerClassИмя,
  classИмя,
  ariaLabel,
  title,
  copiedLabel = "Copied!",
}: КопироватьTextProps) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState(copiedLabel);
  const timerRef = useRef<ReturnТип<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (e.g. HTTP on non-localhost)
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          const success = document.execКоманда("copy");
          if (!success) throw new Ошибка("execКоманда copy failed");
        } finally {
          document.body.removeChild(textarea);
        }
      }
      setLabel(copiedLabel);
    } catch {
      setLabel("Копировать failed");
    }
    clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1500);
  }, [copiedLabel, text]);

  return (
    <span classИмя={cn("relative inline-flex", containerClassИмя)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        title={title}
        classИмя={cn(
          "cursor-copy hover:text-foreground transition-colors",
          classИмя,
        )}
        onClick={handleClick}
      >
        {children ?? text}
      </button>
      <span
        role="status"
        aria-live="polite"
        classИмя={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 rounded-md bg-foreground text-background px-2 py-1 text-xs whitespace-nowrap transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
