import { createContext, useCallback, useContext, useEffect, useState, type ReactНетde } from "react";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbContextЗначение {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
  mobileToolbar: ReactНетde | null;
  setMobileToolbar: (node: ReactНетde | null) => void;
}

interface BreadcrumbПровайдерProps {
  children: ReactНетde;
  companyИмя?: string | null;
}

const BreadcrumbContext = createContext<BreadcrumbContextЗначение | null>(null);

function breadcrumbsEqual(left: Breadcrumb[], right: Breadcrumb[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.label !== right[index]?.label || left[index]?.href !== right[index]?.href) {
      return false;
    }
  }
  return true;
}

export function buildDocumentНазвание(breadcrumbs: Breadcrumb[], companyИмя?: string | null) {
  const pageParts = breadcrumbs.length === 0
    ? []
    : [...breadcrumbs].reverse().map((breadcrumb) => breadcrumb.label);
  const companyPart = companyИмя?.trim() ? [companyИмя.trim()] : [];
  const parts = [...pageParts, ...companyPart, "Paperclip"];
  return parts.join(" • ");
}

export function BreadcrumbПровайдер({ children, companyИмя }: BreadcrumbПровайдерProps) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const [mobileToolbar, setMobileToolbarState] = useState<ReactНетde | null>(null);

  const setBreadcrumbs = useCallback((crumbs: Breadcrumb[]) => {
    setBreadcrumbsState((current) => (breadcrumbsEqual(current, crumbs) ? current : crumbs));
  }, []);

  const setMobileToolbar = useCallback((node: ReactНетde | null) => {
    setMobileToolbarState(node);
  }, []);

  useEffect(() => {
    document.title = buildDocumentНазвание(breadcrumbs, companyИмя);
  }, [breadcrumbs, companyИмя]);

  return (
    <BreadcrumbContext.Провайдер value={{ breadcrumbs, setBreadcrumbs, mobileToolbar, setMobileToolbar }}>
      {children}
    </BreadcrumbContext.Провайдер>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Ошибка("useBreadcrumbs must be used within BreadcrumbПровайдер");
  }
  return ctx;
}
