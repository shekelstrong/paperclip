import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adaptersApi, type АдаптерCapabilities } from "@/api/adapters";
import { queryКлючs } from "@/lib/queryКлючs";

const ALL_FALSE: АдаптерCapabilities = {
  supportsInstructionsBundle: false,
  supportsНавыки: false,
  supportsLocalАгентJwt: false,
  requiresMaterializedЗапуститьtimeНавыки: false,
  supportsМодельПрофильs: false,
};

/**
 * Synchronous fallback for known built-in adapter types so capability checks
 * return correct values on first render before the /api/adapters call resolves.
 */
const KNOWN_DEFAULTS: Record<string, АдаптерCapabilities> = {
  acpx_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: false, supportsМодельПрофильs: false },
  claude_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: false, supportsМодельПрофильs: true },
  codex_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: false, supportsМодельПрофильs: true },
  cursor: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: true, supportsМодельПрофильs: true },
  gemini_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: true, supportsМодельПрофильs: true },
  opencode_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: true, supportsМодельПрофильs: true },
  pi_local: { supportsInstructionsBundle: true, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: true, supportsМодельПрофильs: false },
  hermes_local: { supportsInstructionsBundle: false, supportsНавыки: true, supportsLocalАгентJwt: true, requiresMaterializedЗапуститьtimeНавыки: false, supportsМодельПрофильs: false },
  openclaw_gateway: ALL_FALSE,
};

/**
 * Returns a lookup function that resolves adapter capabilities by type.
 *
 * Capabilities are fetched from the server adapter listing API and cached
 * via react-query. Before the data loads, known built-in adapter types
 * return correct synchronous defaults to avoid cold-load regressions.
 */
export function useАдаптерCapabilities(): (type: string) => АдаптерCapabilities {
  const { data: adapters } = useQuery({
    queryКлюч: queryКлючs.adapters.all,
    queryFn: () => adaptersApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const capMap = useMemo(() => {
    const map = new Map<string, АдаптерCapabilities>();
    if (adapters) {
      for (const a of adapters) {
        map.set(a.type, a.capabilities);
      }
    }
    return map;
  }, [adapters]);

  return (type: string): АдаптерCapabilities =>
    capMap.get(type) ?? KNOWN_DEFAULTS[type] ?? ALL_FALSE;
}
