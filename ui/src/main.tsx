import * as React from "react";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "@/lib/router";
import { QueryClient, QueryClientПровайдер } from "@tanstack/react-query";
import { App } from "./App";
import { КомпанияПровайдер, useКомпания } from "./context/КомпанияContext";
import { LiveОбновитьsПровайдер } from "./context/LiveОбновитьsПровайдер";
import { BreadcrumbПровайдер } from "./context/BreadcrumbContext";
import { PanelПровайдер } from "./context/PanelContext";
import { SidebarПровайдер } from "./context/SidebarContext";
import { DialogПровайдер } from "./context/DialogContext";
import { ИзменитьorАвтоcompleteПровайдер } from "./context/ИзменитьorАвтоcompleteContext";
import { ToastПровайдер } from "./context/ToastContext";
import { ThemeПровайдер } from "./context/ThemeContext";
import { TooltipПровайдер } from "@/components/ui/tooltip";
import { initPluginBridge } from "./plugins/bridge-init";
import { PluginLauncherПровайдер } from "./plugins/launchers";
import "@mdxeditor/editor/style.css";
import "./index.css";

initPluginBridge(React, ReactDOM);

if ("serviceРаботаer" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceРаботаer.register("/sw.js");
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

function КомпанияAwareBreadcrumbПровайдер({ children }: { children: React.ReactНетde }) {
  const { selectedКомпания } = useКомпания();
  return <BreadcrumbПровайдер companyИмя={selectedКомпания?.name ?? null}>{children}</BreadcrumbПровайдер>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientПровайдер client={queryClient}>
      <ThemeПровайдер>
        <BrowserRouter>
          <КомпанияПровайдер>
            <ИзменитьorАвтоcompleteПровайдер>
              <ToastПровайдер>
                <LiveОбновитьsПровайдер>
                  <TooltipПровайдер>
                    <КомпанияAwareBreadcrumbПровайдер>
                      <SidebarПровайдер>
                        <PanelПровайдер>
                          <PluginLauncherПровайдер>
                            <DialogПровайдер>
                              <App />
                            </DialogПровайдер>
                          </PluginLauncherПровайдер>
                        </PanelПровайдер>
                      </SidebarПровайдер>
                    </КомпанияAwareBreadcrumbПровайдер>
                  </TooltipПровайдер>
                </LiveОбновитьsПровайдер>
              </ToastПровайдер>
            </ИзменитьorАвтоcompleteПровайдер>
          </КомпанияПровайдер>
        </BrowserRouter>
      </ThemeПровайдер>
    </QueryClientПровайдер>
  </StrictMode>
);
