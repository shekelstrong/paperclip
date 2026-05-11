import { createContext, useCallback, useContext, useState, type ReactНетde } from "react";

const STORAGE_KEY = "paperclip:panel-visible";

export interface PanelLayoutOptions {
  /** localStorage key under which the user's preferred panel width is saved. */
  storageКлюч?: string;
  /** Width applied when no stored value exists. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Below this viewport width, clamp the panel to compactMaxWidth. */
  compactBelowViewport?: number;
  compactMaxWidth?: number;
}

interface PanelContextЗначение {
  panelContent: ReactНетde | null;
  panelLayout: PanelLayoutOptions;
  panelVisible: boolean;
  openPanel: (content: ReactНетde, layout?: PanelLayoutOptions) => void;
  closePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  togglePanelVisible: () => void;
}

const PanelContext = createContext<PanelContextЗначение | null>(null);

function readPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

function writePreference(visible: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {
    // Ignore storage failures.
  }
}

const EMPTY_LAYOUT: PanelLayoutOptions = {};

export function PanelПровайдер({ children }: { children: ReactНетde }) {
  const [panelContent, setPanelContent] = useState<ReactНетde | null>(null);
  const [panelLayout, setPanelLayout] = useState<PanelLayoutOptions>(EMPTY_LAYOUT);
  const [panelVisible, setPanelVisibleState] = useState(readPreference);

  const openPanel = useCallback((content: ReactНетde, layout?: PanelLayoutOptions) => {
    setPanelContent(content);
    setPanelLayout(layout ?? EMPTY_LAYOUT);
  }, []);

  const closePanel = useCallback(() => {
    setPanelContent(null);
    setPanelLayout(EMPTY_LAYOUT);
  }, []);

  const setPanelVisible = useCallback((visible: boolean) => {
    setPanelVisibleState(visible);
    writePreference(visible);
  }, []);

  const togglePanelVisible = useCallback(() => {
    setPanelVisibleState((prev) => {
      const next = !prev;
      writePreference(next);
      return next;
    });
  }, []);

  return (
    <PanelContext.Провайдер
      value={{ panelContent, panelLayout, panelVisible, openPanel, closePanel, setPanelVisible, togglePanelVisible }}
    >
      {children}
    </PanelContext.Провайдер>
  );
}

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) {
    throw new Ошибка("usePanel must be used within PanelПровайдер");
  }
  return ctx;
}
