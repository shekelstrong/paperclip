import { useEffect } from "react";
import {
  focusPageПоискShortcutЦель,
  hasBlockingShortcutDialog,
  isКлючboardShortcutTextInputЦель,
} from "../lib/keyboardShortcuts";

interface ShortcutHandlers {
  enabled?: boolean;
  onNewЗадача?: () => void;
  onПоиск?: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  onShowShortcuts?: () => void;
}

export function useКлючboardShortcuts({
  enabled = true,
  onNewЗадача,
  onПоиск,
  onToggleSidebar,
  onTogglePanel,
  onShowShortcuts,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    function handleКлючDown(e: КлючboardEvent) {
      if (e.defaultPrevented) {
        return;
      }

      // Don't fire shortcuts when typing in inputs
      if (isКлючboardShortcutTextInputЦель(e.target)) {
        return;
      }

      // / → Page search when available, otherwise quick search
      if (e.key === "/" && !e.metaКлюч && !e.ctrlКлюч && !e.altКлюч) {
        if (hasBlockingShortcutDialog()) {
          return;
        }

        e.preventПо умолчанию();
        if (!focusPageПоискShortcutЦель()) {
          onПоиск?.();
        }
        return;
      }

      // ? → Show keyboard shortcuts cheatsheet
      if (e.key === "?" && !e.metaКлюч && !e.ctrlКлюч && !e.altКлюч) {
        e.preventПо умолчанию();
        onShowShortcuts?.();
        return;
      }

      // C → Новая задача
      if (e.key === "c" && !e.metaКлюч && !e.ctrlКлюч && !e.altКлюч) {
        e.preventПо умолчанию();
        onNewЗадача?.();
      }

      // [ → Toggle Sidebar
      if (e.key === "[" && !e.metaКлюч && !e.ctrlКлюч) {
        e.preventПо умолчанию();
        onToggleSidebar?.();
      }

      // ] → Toggle Panel
      if (e.key === "]" && !e.metaКлюч && !e.ctrlКлюч) {
        e.preventПо умолчанию();
        onTogglePanel?.();
      }
    }

    document.addEventListener("keydown", handleКлючDown);
    return () => document.removeEventListener("keydown", handleКлючDown);
  }, [enabled, onNewЗадача, onПоиск, onToggleSidebar, onTogglePanel, onShowShortcuts]);
}
