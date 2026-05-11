import * as React from "react";
import * as RouterDom from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";
import type { Задача } from "@paperclipai/shared";
import { useКомпания } from "@/context/КомпанияContext";
import { ЗадачаLinkQuicklook } from "@/components/ЗадачаLinkQuicklook";
import {
  applyКомпанияPrefix,
  extractКомпанияPrefixFromПуть,
  normalizeКомпанияPrefix,
} from "@/lib/company-routes";
import { parseЗадачаПутьIdFromПуть } from "@/lib/issue-reference";

function resolveTo(to: To, companyPrefix: string | null): To {
  if (typeof to === "string") {
    return applyКомпанияPrefix(to, companyPrefix);
  }

  if (to.pathname && to.pathname.startsWith("/")) {
    const pathname = applyКомпанияPrefix(to.pathname, companyPrefix);
    if (pathname !== to.pathname) {
      return { ...to, pathname };
    }
  }

  return to;
}

function useАктивенКомпанияPrefix(): string | null {
  const { selectedКомпания } = useКомпания();
  const params = RouterDom.useParams<{ companyPrefix?: string }>();
  const location = RouterDom.useLocation();

  if (params.companyPrefix) {
    return normalizeКомпанияPrefix(params.companyPrefix);
  }

  const pathPrefix = extractКомпанияPrefixFromПуть(location.pathname);
  if (pathPrefix) return pathPrefix;

  return selectedКомпания ? normalizeКомпанияPrefix(selectedКомпания.issuePrefix) : null;
}

export * from "react-router-dom";

type КомпанияLinkProps = React.ComponentProps<typeof RouterDom.Link> & {
  disableЗадачаQuicklook?: boolean;
  issuePrefetch?: Задача | null;
};

export const Link = React.forwardRef<HTMLAnchorElement, КомпанияLinkProps>(
  function КомпанияLink({ to, disableЗадачаQuicklook = false, issuePrefetch = null, ...props }, ref) {
    const companyPrefix = useАктивенКомпанияPrefix();
    const resolvedTo = resolveTo(to, companyPrefix);
    const issueПутьId = parseЗадачаПутьIdFromПуть(typeof resolvedTo === "string" ? resolvedTo : resolvedTo.pathname);

    if (issueПутьId) {
      return (
        <ЗадачаLinkQuicklook
          ref={ref}
          to={resolvedTo}
          issueПутьId={issueПутьId}
          disableЗадачаQuicklook={disableЗадачаQuicklook}
          issuePrefetch={issuePrefetch}
          {...props}
        />
      );
    }

    return <RouterDom.Link ref={ref} to={resolvedTo} {...props} />;
  },
);

export const NavLink = React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof RouterDom.NavLink>>(
  function КомпанияNavLink({ to, ...props }, ref) {
    const companyPrefix = useАктивенКомпанияPrefix();
    return <RouterDom.NavLink ref={ref} to={resolveTo(to, companyPrefix)} {...props} />;
  },
);

export function Navigate({ to, ...props }: React.ComponentProps<typeof RouterDom.Navigate>) {
  const companyPrefix = useАктивенКомпанияPrefix();
  return <RouterDom.Navigate to={resolveTo(to, companyPrefix)} {...props} />;
}

export function useNavigate(): ReturnТип<typeof RouterDom.useNavigate> {
  const navigate = RouterDom.useNavigate();
  const companyPrefix = useАктивенКомпанияPrefix();

  return React.useCallback(
    ((to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }
      navigate(resolveTo(to, companyPrefix), options);
    }) as ReturnТип<typeof RouterDom.useNavigate>,
    [navigate, companyPrefix],
  );
}
