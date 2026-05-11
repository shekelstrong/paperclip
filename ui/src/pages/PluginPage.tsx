import { useEffect, useMemo } from "react";
import { Link, Navigate, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useКомпания } from "@/context/КомпанияContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { pluginsApi } from "@/api/plugins";
import { queryКлючs } from "@/lib/queryКлючs";
import {
  PluginSlotMount,
  resolveRouteSidebarSlot,
  type ResolvedPluginSlot,
} from "@/plugins/slots";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { НетtFoundPage } from "./НетtFound";

/**
 * Компания-context plugin page. Renders a plugin's `page` slot at
 * `/:companyPrefix/plugins/:pluginId` when the plugin declares a page slot
 * and is enabled for that company.
 *
 * @see doc/plugins/PLUGIN_SPEC.md §19.2 — Компания-Context Routes
 * @see doc/plugins/PLUGIN_SPEC.md §24.4 — Компания-Context Plugin Page
 */
export function PluginPage() {
  const params = useParams<{
    companyPrefix?: string;
    pluginId?: string;
    pluginRouteПуть?: string;
    "*": string | undefined;
  }>();
  const { companyPrefix: routeКомпанияPrefix, pluginId, pluginRouteПуть } = params;
  const pluginRouteSplat = params["*"];
  const { companies, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const routeКомпания = useMemo(() => {
    if (!routeКомпанияPrefix) return null;
    const requested = routeКомпанияPrefix.toUpperCase();
    return companies.find((c) => c.issuePrefix.toUpperCase() === requested) ?? null;
  }, [companies, routeКомпанияPrefix]);
  const hasInvalidКомпанияPrefix = Boolean(routeКомпанияPrefix) && !routeКомпания;

  const resolvedКомпанияId = useMemo(() => {
    if (routeКомпания) return routeКомпания.id;
    if (routeКомпанияPrefix) return null;
    return selectedКомпанияId ?? null;
  }, [routeКомпания, routeКомпанияPrefix, selectedКомпанияId]);

  const companyPrefix = useMemo(
    () => (resolvedКомпанияId ? companies.find((c) => c.id === resolvedКомпанияId)?.issuePrefix ?? null : null),
    [companies, resolvedКомпанияId],
  );

  const { data: contributions } = useQuery({
    queryКлюч: queryКлючs.plugins.uiContributions,
    queryFn: () => pluginsApi.listUiContributions(),
    enabled: !!resolvedКомпанияId && (!!pluginId || !!pluginRouteПуть),
  });

  const pageSlot = useMemo(() => {
    if (!contributions) return null;
    if (pluginId) {
      const contribution = contributions.find((c) => c.pluginId === pluginId);
      if (!contribution) return null;
      const slot = contribution.slots.find((s) => s.type === "page");
      if (!slot) return null;
      return {
        ...slot,
        pluginId: contribution.pluginId,
        pluginКлюч: contribution.pluginКлюч,
        pluginDisplayИмя: contribution.displayИмя,
        pluginВерсия: contribution.version,
      };
    }
    if (!pluginRouteПуть) return null;
    const matches = contributions.flatMap((contribution) => {
      const slot = contribution.slots.find((entry) => entry.type === "page" && entry.routeПуть === pluginRouteПуть);
      if (!slot) return [];
      return [{
        ...slot,
        pluginId: contribution.pluginId,
        pluginКлюч: contribution.pluginКлюч,
        pluginDisplayИмя: contribution.displayИмя,
        pluginВерсия: contribution.version,
      }];
    });
    if (matches.length !== 1) return null;
    return matches[0] ?? null;
  }, [pluginId, pluginRouteПуть, contributions]);

  const context = useMemo(
    () => ({
      companyId: resolvedКомпанияId ?? null,
      companyPrefix,
    }),
    [resolvedКомпанияId, companyPrefix],
  );

  // When the active route has a routeSidebar slot, the sidebar provides the
  // back affordance, but the top bar still needs a route-specific title.
  const routeSidebarАктивен = useMemo(() => {
    if (!pluginRouteПуть || !contributions) return false;
    const flattened: ResolvedPluginSlot[] = contributions.flatMap((contribution) =>
      contribution.slots.map((slot) => ({
        ...slot,
        pluginId: contribution.pluginId,
        pluginКлюч: contribution.pluginКлюч,
        pluginDisplayИмя: contribution.displayИмя,
        pluginВерсия: contribution.version,
      })),
    );
    return resolveRouteSidebarSlot(flattened, pluginRouteПуть) !== null;
  }, [contributions, pluginRouteПуть]);

  useEffect(() => {
    if (!pageSlot) return;
    if (routeSidebarАктивен) {
      setBreadcrumbs([{ label: resolveRouteSidebarPageНазвание(pageSlot, pluginRouteSplat) }]);
      return;
    }
    setBreadcrumbs([
      { label: "Plugins", href: "/instance/settings/plugins" },
      { label: pageSlot.pluginDisplayИмя },
    ]);
  }, [pageSlot, pluginRouteSplat, setBreadcrumbs, routeSidebarАктивен]);

  if (!resolvedКомпанияId) {
    if (hasInvalidКомпанияPrefix) {
      return <НетtFoundPage scope="invalid_company_prefix" requestedPrefix={routeКомпанияPrefix} />;
    }
    return (
      <div classИмя="space-y-4">
        <p classИмя="text-sm text-muted-foreground">Select a company to view this page.</p>
      </div>
    );
  }

  if (!contributions) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка…</div>;
  }

  if (!pluginId && pluginRouteПуть) {
    const duplicateMatches = contributions.filter((contribution) =>
      contribution.slots.some((slot) => slot.type === "page" && slot.routeПуть === pluginRouteПуть),
    );
    if (duplicateMatches.length > 1) {
      return (
        <div classИмя="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Multiple plugins declare the route <code>{pluginRouteПуть}</code>. Use the plugin-id route until the conflict is resolved.
        </div>
      );
    }
  }

  if (!pageSlot) {
    if (pluginRouteПуть) {
      return <НетtFoundPage scope="board" />;
    }
    // Нет page slot: redirect to plugin settings where plugin info is always shown
    const settingsПуть = pluginId ? `/instance/settings/plugins/${pluginId}` : "/instance/settings/plugins";
    return <Navigate to={settingsПуть} replace />;
  }

  return (
    <div classИмя="space-y-4">
      {!routeSidebarАктивен && (
        <div classИмя="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={companyPrefix ? `/${companyPrefix}/dashboard` : "/dashboard"}>
              <ArrowLeft classИмя="h-4 w-4 mr-1" />
              Назад
            </Link>
          </Button>
        </div>
      )}
      <PluginSlotMount
        slot={pageSlot}
        context={context}
        classИмя="min-h-[200px]"
        missingBehavior="placeholder"
      />
    </div>
  );
}

function resolveRouteSidebarPageНазвание(pageSlot: ResolvedPluginSlot, routeSplat: string | undefined): string {
  const title = titleFromRouteSplat(routeSplat);
  return title ?? pageSlot.displayИмя ?? pageSlot.pluginDisplayИмя;
}

function titleFromRouteSplat(routeSplat: string | undefined): string | null {
  const segments = (routeSplat ?? "")
    .split("/")
    .filter(Boolean)
    .map(decodeRouteSegment);
  if (segments.length === 0) return null;

  if (segments[0] === "page" && segments.length > 1) {
    return titleFromПуть(segments.slice(1).join("/"), { preserveCase: true });
  }

  return titleFromПуть(segments[0] ?? null);
}

function titleFromПуть(path: string | null | undefined, options: { preserveCase?: boolean } = {}): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  const basename = trimmed.split("/").filter(Boolean).at(-1) ?? trimmed;
  const withoutИмяspace = basename.split("::").at(-1) ?? basename;
  const withoutExtension = withoutИмяspace.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension.replace(/[-_]+/g, " ").trim();
  if (!normalized) return null;
  if (options.preserveCase) return normalized;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
