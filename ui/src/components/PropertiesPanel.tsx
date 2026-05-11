import { X } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { Button } from "@/components/ui/button";
import { ResizableSidebarPane } from "./ResizableSidebarPane";

const PROPERTIES_PANEL_DEFAULT = 320;
const PROPERTIES_PANEL_MIN = 320;
const PROPERTIES_PANEL_MAX = 640;
const PROPERTIES_PANEL_STORAGE_KEY = "paperclip.properties.width";

export function PropertiesPanel() {
  const { panelContent, panelLayout, panelVisible, setPanelVisible } = usePanel();

  if (!panelContent) return null;

  const storageКлюч = panelLayout.storageКлюч ?? PROPERTIES_PANEL_STORAGE_KEY;
  const defaultWidth = panelLayout.defaultWidth ?? PROPERTIES_PANEL_DEFAULT;
  const minWidth = panelLayout.minWidth ?? PROPERTIES_PANEL_MIN;
  const maxWidth = panelLayout.maxWidth ?? PROPERTIES_PANEL_MAX;
  const compactBelowViewport = panelLayout.compactBelowViewport;
  const compactMaxWidth = panelLayout.compactMaxWidth;

  return (
    <aside classИмя="hidden md:flex border-l border-border bg-card shrink-0 h-full">
      <ResizableSidebarPane
        // Remount when the layout key changes so the stored width is re-read fresh.
        key={storageКлюч}
        open={panelVisible}
        resizable
        side="right"
        storageКлюч={storageКлюч}
        defaultWidth={defaultWidth}
        minWidth={minWidth}
        maxWidth={maxWidth}
        compactBelowViewport={compactBelowViewport}
        compactMaxWidth={compactMaxWidth}
        widthVariable="--properties-panel-width"
        classИмя="h-full"
      >
        <div classИмя="flex h-full w-full flex-col min-h-0">
          <div classИмя="flex items-center justify-between px-4 py-2 border-b border-border">
            <span classИмя="text-sm font-medium">Properties</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPanelVisible(false)}
              aria-label="Закрыть properties panel"
            >
              <X classИмя="h-4 w-4" />
            </Button>
          </div>
          <div classИмя="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div classИмя="p-4 min-w-0">{panelContent}</div>
          </div>
        </div>
      </ResizableSidebarPane>
    </aside>
  );
}
