import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate, useNavigationТип, useParams } from "@/lib/router";
import { Sidebar } from "./Sidebar";
import { InstanceSidebar } from "./InstanceSidebar";
import { КомпанияНастройкиSidebar } from "./КомпанияНастройкиSidebar";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { PropertiesPanel } from "./PropertiesPanel";
import { КомандаPalette } from "./КомандаPalette";
import { NewЗадачаDialog } from "./NewЗадачаDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewЦельDialog } from "./NewЦельDialog";
import { NewАгентDialog } from "./NewАгентDialog";
import { КлючboardShortcutsCheatsheet } from "./КлючboardShortcutsCheatsheet";
import { ToastViewport } from "./ToastViewport";
import { MobileБотtomNav } from "./MobileБотtomNav";
import { РаботаtreeBanner } from "./РаботаtreeBanner";
import { DevПерезапуститьBanner } from "./DevПерезапуститьBanner";
import { ResizableSidebarPane } from "./ResizableSidebarPane";
import { SidebarАккаунтMenu } from "./SidebarАккаунтMenu";
import { useDialogActions } from "../context/DialogContext";
import { ОбщиеНастройкиПровайдер } from "../context/ОбщиеНастройкиContext";
import { usePanel } from "../context/PanelContext";
import { useКомпания } from "../context/КомпанияContext";
import { useSidebar } from "../context/SidebarContext";
import { useКлючboardShortcuts } from "../hooks/useКлючboardShortcuts";
import { useКомпанияPageMemory } from "../hooks/useКомпанияPageMemory";
import { healthApi } from "../api/health";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { shouldSyncКомпанияSelectionFromRoute } from "../lib/company-selection";
import {
  DEFAULT_INSTANCE_SETTINGS_PATH,
  normalizeRememberedInstanceНастройкиПуть,
} from "../lib/instance-settings";
import {
  resetNavigationScroll,
  shouldСброситьScrollOnNavigation,
} from "../lib/navigation-scroll";
import { queryКлючs } from "../lib/queryКлючs";
import { scheduleMainContentFocus } from "../lib/main-content-focus";
import { cn } from "../lib/utils";
import { НетtFoundPage } from "../pages/НетtFound";
import { PluginSlotMount, resolveRouteSidebarSlot, usePluginSlots } from "../plugins/slots";

const INSTANCE_SETTINGS_MEMORY_KEY = "paperclip.lastInstanceНастройкиПуть";

function getКомпанияRouteSegment(pathname: string, companyPrefix: string | undefined): string | null {
  if (!companyPrefix) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  if (segments[0]?.toUpperCase() !== companyPrefix.toUpperCase()) return null;
  return segments[1]?.toНизкийerCase() ?? null;
}

function readRememberedInstanceНастройкиПуть(): string {
  if (typeof window === "undefined") return DEFAULT_INSTANCE_SETTINGS_PATH;
  try {
    return normalizeRememberedInstanceНастройкиПуть(window.localStorage.getItem(INSTANCE_SETTINGS_MEMORY_KEY));
  } catch {
    return DEFAULT_INSTANCE_SETTINGS_PATH;
  }
}

export function Layout() {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, isMobile } = useSidebar();
  const { openNewЗадача, openOnboarding } = useDialogActions();
  const { togglePanelVisible } = usePanel();
  const {
    companies,
    loading: companiesЗагрузка,
    selectedКомпания,
    selectedКомпанияId,
    selectionSource,
    setSelectedКомпанияId,
  } = useКомпания();
  const { companyPrefix } = useParams<{ companyPrefix: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationТип = useNavigationТип();
  const isInstanceНастройкиRoute = location.pathname.startsWith("/instance/");
  const isКомпанияНастройкиRoute = location.pathname.includes("/company/settings");
  const onboardingTriggered = useRef(false);
  const lastMainScrollTop = useRef(0);
  const previousПутьname = useRef<string | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const [instanceНастройкиЦель, setInstanceНастройкиЦель] = useState<string>(() => readRememberedInstanceНастройкиПуть());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const matchedКомпания = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix) ?? null;
  }, [companies, companyPrefix]);
  const hasНеизвестноКомпанияPrefix =
    Boolean(companyPrefix) && !companiesЗагрузка && companies.length > 0 && !matchedКомпания;
  const pluginRouteПуть = useMemo(
    () => getКомпанияRouteSegment(location.pathname, companyPrefix),
    [companyPrefix, location.pathname],
  );
  const routeSidebarКомпанияId = matchedКомпания?.id ?? null;
  const routeSidebarКомпанияPrefix = matchedКомпания?.issuePrefix ?? null;
  const { slots: routeSidebarSlots } = usePluginSlots({
    slotТипs: ["page", "routeSidebar"],
    companyId: routeSidebarКомпанияId,
    enabled: Boolean(routeSidebarКомпанияId && pluginRouteПуть),
  });
  const routeSidebarSlot = useMemo(
    () => resolveRouteSidebarSlot(routeSidebarSlots, pluginRouteПуть),
    [pluginRouteПуть, routeSidebarSlots],
  );
  const sidebarContext = useMemo(
    () => ({
      companyId: routeSidebarКомпанияId,
      companyPrefix: routeSidebarКомпанияPrefix,
    }),
    [routeSidebarКомпанияId, routeSidebarКомпанияPrefix],
  );
  const companySidebar = routeSidebarSlot ? (
    <PluginSlotMount
      slot={routeSidebarSlot}
      context={sidebarContext}
      classИмя="h-full w-full"
      missingBehavior="placeholder"
    />
  ) : (
    <Sidebar />
  );
  const { data: health } = useQuery({
    queryКлюч: queryКлючs.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as { devServer?: { enabled?: boolean } } | undefined;
      return data?.devServer?.enabled ? 2000 : false;
    },
    refetchIntervalInНазадground: true,
  });
  const keyboardShortcutsВключитьd = useQuery({
    queryКлюч: queryКлючs.instance.generalНастройки,
    queryFn: () => instanceНастройкиApi.getОбщие(),
  }).data?.keyboardShortcuts === true;

  useEffect(() => {
    if (companiesЗагрузка || onboardingTriggered.current) return;
    if (health?.deploymentMode === "authenticated") return;
    if (companies.length === 0) {
      onboardingTriggered.current = true;
      openOnboarding();
    }
  }, [companies, companiesЗагрузка, openOnboarding, health?.deploymentMode]);

  useEffect(() => {
    if (!companyPrefix || companiesЗагрузка || companies.length === 0) return;

    if (!matchedКомпания) {
      const fallback = (selectedКомпанияId ? companies.find((company) => company.id === selectedКомпанияId) : null)
        ?? companies[0]
        ?? null;
      if (fallback && selectedКомпанияId !== fallback.id) {
        setSelectedКомпанияId(fallback.id, { source: "route_sync" });
      }
      return;
    }

    if (companyPrefix !== matchedКомпания.issuePrefix) {
      const suffix = location.pathname.replace(/^\/[^/]+/, "");
      navigate(`/${matchedКомпания.issuePrefix}${suffix}${location.search}`, { replace: true });
      return;
    }

    if (
      shouldSyncКомпанияSelectionFromRoute({
        selectionSource,
        selectedКомпанияId,
        routeКомпанияId: matchedКомпания.id,
      })
    ) {
      setSelectedКомпанияId(matchedКомпания.id, { source: "route_sync" });
    }
  }, [
    companyPrefix,
    companies,
    companiesЗагрузка,
    matchedКомпания,
    location.pathname,
    location.search,
    navigate,
    selectionSource,
    selectedКомпанияId,
    setSelectedКомпанияId,
  ]);

  const togglePanel = togglePanelVisible;
  const openПоиск = useCallback(() => {
    document.dispatchEvent(new КлючboardEvent("keydown", {
      key: "k",
      metaКлюч: true,
      bubbles: true,
      cancelable: true,
    }));
  }, []);

  useКомпанияPageMemory();

  useКлючboardShortcuts({
    enabled: keyboardShortcutsВключитьd,
    onNewЗадача: () => openNewЗадача(),
    onПоиск: openПоиск,
    onToggleSidebar: toggleSidebar,
    onTogglePanel: togglePanel,
    onShowShortcuts: () => setShortcutsOpen(true),
  });

  useEffect(() => {
    if (!isMobile) {
      setMobileNavVisible(true);
      return;
    }
    lastMainScrollTop.current = 0;
    setMobileNavVisible(true);
  }, [isMobile]);

  // Swipe gesture to open/close sidebar on mobile
  useEffect(() => {
    if (!isMobile) return;

    const EDGE_ZONE = 30; // px from left edge to start open-swipe
    const MIN_DISTANCE = 50; // minimum horizontal swipe distance
    const MAX_VERTICAL = 75; // max vertical drift before we ignore

    let startX = 0;
    let startY = 0;

    const onTouchНачать = (e: TouchEvent) => {
      const t = e.touches[0]!;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]!;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);

      if (dy > MAX_VERTICAL) return; // vertical scroll, ignore

      // Swipe right from left edge → open
      if (!sidebarOpen && startX < EDGE_ZONE && dx > MIN_DISTANCE) {
        setSidebarOpen(true);
        return;
      }

      // Swipe left when open → close
      if (sidebarOpen && dx < -MIN_DISTANCE) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("touchstart", onTouchНачать, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchНачать);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, sidebarOpen, setSidebarOpen]);

  const updateMobileNavVisibility = useCallback((currentTop: number) => {
    const delta = currentTop - lastMainScrollTop.current;

    if (currentTop <= 24) {
      setMobileNavVisible(true);
    } else if (delta > 8) {
      setMobileNavVisible(false);
    } else if (delta < -8) {
      setMobileNavVisible(true);
    }

    lastMainScrollTop.current = currentTop;
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavVisible(true);
      lastMainScrollTop.current = 0;
      return;
    }

    const onScroll = () => {
      updateMobileNavVisibility(window.scrollY || document.documentElement.scrollTop || 0);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [isMobile, updateMobileNavVisibility]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = isMobile ? "visible" : "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile]);

  useEffect(() => {
    if (!location.pathname.startsWith("/instance/settings/")) return;

    const nextПуть = normalizeRememberedInstanceНастройкиПуть(
      `${location.pathname}${location.search}${location.hash}`,
    );
    setInstanceНастройкиЦель(nextПуть);

    try {
      window.localStorage.setItem(INSTANCE_SETTINGS_MEMORY_KEY, nextПуть);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const mainContent = mainContentRef.current;
    return scheduleMainContentFocus(mainContent);
  }, [location.pathname]);

  useEffect(() => {
    const shouldСброситьScroll = shouldСброситьScrollOnNavigation({
      previousПутьname: previousПутьname.current,
      pathname: location.pathname,
      navigationТип,
      state: location.state,
    });

    previousПутьname.current = location.pathname;

    if (!shouldСброситьScroll) return;
    resetNavigationScroll(mainContentRef.current);
  }, [location.pathname, navigationТип]);

  return (
    <ОбщиеНастройкиПровайдер value={{ keyboardShortcutsВключитьd }}>
      <div
      classИмя={cn(
        "bg-background text-foreground pt-[env(safe-area-inset-top)]",
        isMobile ? "min-h-dvh" : "flex h-dvh flex-col overflow-hidden",
      )}
      >
      <a
        href="#main-content"
        classИмя="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to Main Content
      </a>
      <РаботаtreeBanner />
      <DevПерезапуститьBanner devServer={health?.devServer} />
      <div classИмя={cn("min-h-0 flex-1", isMobile ? "w-full" : "flex overflow-hidden")}>
        {isMobile && sidebarOpen && (
          <button
            type="button"
            classИмя="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-label="Закрыть sidebar"
          />
        )}

        {isMobile ? (
          <div
            classИмя={cn(
              "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] transition-transform duration-100 ease-out",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div classИмя="flex flex-1 min-h-0 overflow-hidden">
              <div classИмя="w-60 shrink-0 overflow-hidden">
                {isInstanceНастройкиRoute ? (
                  <InstanceSidebar />
                ) : isКомпанияНастройкиRoute ? (
                  <КомпанияНастройкиSidebar />
                ) : (
                  companySidebar
                )}
              </div>
            </div>
            <SidebarАккаунтMenu
              deploymentMode={health?.deploymentMode}
              instanceНастройкиЦель={instanceНастройкиЦель}
              version={health?.version}
            />
          </div>
        ) : (
          <div classИмя="flex h-full flex-col shrink-0">
            <div classИмя="flex flex-1 min-h-0">
              <ResizableSidebarPane open={sidebarOpen} resizable classИмя="h-full shrink-0">
                {isInstanceНастройкиRoute ? (
                  <InstanceSidebar />
                ) : isКомпанияНастройкиRoute ? (
                  <КомпанияНастройкиSidebar />
                ) : (
                  companySidebar
                )}
              </ResizableSidebarPane>
            </div>
            <SidebarАккаунтMenu
              deploymentMode={health?.deploymentMode}
              instanceНастройкиЦель={instanceНастройкиЦель}
              version={health?.version}
            />
          </div>
        )}

        <div classИмя={cn("flex min-w-0 flex-col", isMobile ? "w-full" : "h-full flex-1")}>
          <div
            classИмя={cn(
              isMobile && "sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
            )}
          >
            <BreadcrumbBar />
          </div>
          <div classИмя={cn(isMobile ? "block" : "flex flex-1 min-h-0")}>
            <main
              id="main-content"
              ref={mainContentRef}
              tabIndex={-1}
              classИмя={cn(
                "flex-1 p-4 outline-none md:p-6",
                isMobile ? "overflow-visible pb-[calc(5rem+env(safe-area-inset-bottom))]" : "overflow-auto",
              )}
            >
              {hasНеизвестноКомпанияPrefix ? (
                <НетtFoundPage
                  scope="invalid_company_prefix"
                  requestedPrefix={companyPrefix ?? selectedКомпания?.issuePrefix}
                />
              ) : (
                <Outlet />
              )}
            </main>
            <PropertiesPanel />
          </div>
        </div>
      </div>
      {isMobile && <MobileБотtomNav visible={mobileNavVisible} />}
      <КомандаPalette />
      <NewЗадачаDialog />
      <NewProjectDialog />
      <NewЦельDialog />
      <NewАгентDialog />
      <КлючboardShortcutsCheatsheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ToastViewport />
      </div>
    </ОбщиеНастройкиПровайдер>
  );
}
