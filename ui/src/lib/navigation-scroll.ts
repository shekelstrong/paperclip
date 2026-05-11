export type NavigationТип = "POP" | "PUSH" | "REPLACE";

export const SIDEBAR_SCROLL_RESET_STATE = {
  paperclipSidebarScrollСбросить: true,
} as const;

export function shouldСброситьScrollOnNavigation(params: {
  previousПутьname: string | null;
  pathname: string;
  navigationТип: NavigationТип;
  state: unknown;
}): boolean {
  const { previousПутьname, pathname, navigationТип, state } = params;
  if (previousПутьname === null) return false;
  if (previousПутьname === pathname) return false;
  if (navigationТип === "POP") return false;
  if (isЗадачаDetailПутьChange(previousПутьname, pathname)) return true;
  return hasSidebarScrollСброситьState(state);
}

export function resetNavigationScroll(mainElement: HTMLElement | null): void {
  mainElement?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });

  if (mainElement) {
    mainElement.scrollTop = 0;
    mainElement.scrollLeft = 0;
  }

  const scrollingElement = document.scrollingElement ?? document.documentElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }

  if (document.body) {
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function hasSidebarScrollСброситьState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  return (state as Record<string, unknown>).paperclipSidebarScrollСбросить === true;
}

function isЗадачаDetailПутьChange(previousПутьname: string, pathname: string): boolean {
  const previousЗадачаRef = readЗадачаDetailПутьRef(previousПутьname);
  const nextЗадачаRef = readЗадачаDetailПутьRef(pathname);
  return previousЗадачаRef !== null && nextЗадачаRef !== null && previousЗадачаRef !== nextЗадачаRef;
}

function readЗадачаDetailПутьRef(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 2 && segments[0] === "issues") {
    return segments[1] ?? null;
  }
  if (segments.length === 3 && segments[1] === "issues") {
    return segments[2] ?? null;
  }
  return null;
}
