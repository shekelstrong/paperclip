import { AGENT_DEFAULT_MAX_CONCURRENT_RUNS } from "@paperclipai/shared";
import { defaultСоздатьЗначениеs } from "../components/agent-config-defaults";

export function buildNewАгентЗапуститьtimeConfig(input?: {
  heartbeatВключитьd?: boolean;
  intervalSec?: number;
  cheapМодель?: string;
  cheapМодельВключитьd?: boolean;
}): Record<string, unknown> {
  const config: Record<string, unknown> = {
    heartbeat: {
      enabled: input?.heartbeatВключитьd ?? defaultСоздатьЗначениеs.heartbeatВключитьd,
      intervalSec: input?.intervalSec ?? defaultСоздатьЗначениеs.intervalSec,
      wakeOnDemand: true,
      cooldownSec: 10,
      maxConcurrentЗапуститьs: AGENT_DEFAULT_MAX_CONCURRENT_RUNS,
    },
  };

  const cheapМодель = input?.cheapМодель?.trim() ?? "";
  const cheapВключитьd = input?.cheapМодельВключитьd ?? false;
  if (cheapМодель && cheapВключитьd) {
    config.modelПрофильs = {
      cheap: {
        enabled: true,
        adapterConfig: { model: cheapМодель },
      },
    };
  }

  return config;
}
