import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { useКомпания } from "../context/КомпанияContext";
import { toКомпанияRelativeПуть } from "../lib/company-routes";
import {
  getRememberedПутьВладелецКомпанияId,
  isRememberableКомпанияПуть,
  sanitizeRememberedПутьForКомпания,
} from "../lib/company-page-memory";

const STORAGE_KEY = "paperclip.companyПутьs";

function getКомпанияПутьs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveКомпанияПуть(companyId: string, path: string) {
  const paths = getКомпанияПутьs();
  paths[companyId] = path;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/**
 * Remembers the last visited page per company and navigates to it on company switch.
 * Falls back to /dashboard if no page was previously visited for a company.
 */
export function useКомпанияPageMemory() {
  const { companies, selectedКомпанияId, selectedКомпания, selectionSource } = useКомпания();
  const location = useLocation();
  const navigate = useNavigate();
  const prevКомпанияId = useRef<string | null>(selectedКомпанияId);
  const rememberedПутьВладелецКомпанияId = useMemo(
    () =>
      getRememberedПутьВладелецКомпанияId({
        companies,
        pathname: location.pathname,
        fallbackКомпанияId: prevКомпанияId.current,
      }),
    [companies, location.pathname],
  );

  // Сохранить current path for current company on every location change.
  // Uses prevКомпанияId ref so we save under the correct company even
  // during the render where selectedКомпанияId has already changed.
  const fullПуть = location.pathname + location.search;
  useEffect(() => {
    const companyId = rememberedПутьВладелецКомпанияId;
    const relativeПуть = toКомпанияRelativeПуть(fullПуть);
    if (companyId && isRememberableКомпанияПуть(relativeПуть)) {
      saveКомпанияПуть(companyId, relativeПуть);
    }
  }, [fullПуть, rememberedПутьВладелецКомпанияId]);

  // Navigate to saved path when company changes
  useEffect(() => {
    if (!selectedКомпанияId) return;

    if (
      prevКомпанияId.current !== null &&
      selectedКомпанияId !== prevКомпанияId.current
    ) {
      if (selectionSource !== "route_sync" && selectedКомпания) {
        const paths = getКомпанияПутьs();
        const targetПуть = sanitizeRememberedПутьForКомпания({
          path: paths[selectedКомпанияId],
          companyPrefix: selectedКомпания.issuePrefix,
        });
        navigate(`/${selectedКомпания.issuePrefix}${targetПуть}`, { replace: true });
      }
    }
    prevКомпанияId.current = selectedКомпанияId;
  }, [selectedКомпания, selectedКомпанияId, selectionSource, navigate]);
}
