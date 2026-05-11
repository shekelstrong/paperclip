import type { СоздатьConfigЗначениеs } from "../components/АгентConfigForm";
import { buildNewАгентЗапуститьtimeConfig } from "./new-agent-runtime-config";

export function buildNewАгентHirePayload(input: {
  name: string;
  effectiveRole: string;
  title?: string;
  reportsTo?: string | null;
  selectedНавыкКлючs?: string[];
  configЗначениеs: СоздатьConfigЗначениеs;
  adapterConfig: Record<string, unknown>;
}) {
  const {
    name,
    effectiveRole,
    title,
    reportsTo,
    selectedНавыкКлючs = [],
    configЗначениеs,
    adapterConfig,
  } = input;

  return {
    name: name.trim(),
    role: effectiveRole,
    ...(title?.trim() ? { title: title.trim() } : {}),
    ...(reportsTo ? { reportsTo } : {}),
    ...(selectedНавыкКлючs.length > 0 ? { desiredНавыки: selectedНавыкКлючs } : {}),
    adapterТип: configЗначениеs.adapterТип,
    defaultОкружениеId: configЗначениеs.defaultОкружениеId ?? null,
    adapterConfig,
    runtimeConfig: buildNewАгентЗапуститьtimeConfig({
      heartbeatВключитьd: configЗначениеs.heartbeatВключитьd,
      intervalSec: configЗначениеs.intervalSec,
      cheapМодель: configЗначениеs.cheapМодель,
      cheapМодельВключитьd: configЗначениеs.cheapМодельВключитьd,
    }),
    budgetMonthlyCents: 0,
  };
}
