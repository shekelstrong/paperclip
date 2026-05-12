import type { UIAdapterModule } from "../types";
import { parseOpenClawGatewayStdoutLine } from "@paperclipai/adapter-openclaw-gateway/ui";
import { buildOpenClawGatewayConfig } from "@paperclipai/adapter-openclaw-gateway/ui";
import { OpenClawGatewayConfigFields } from "./config-fields";

export const openClawGatewayUIAdapter: UIAdapterModule = {
  type: "openclaw_gateway",
  label: "Шлюз OpenClaw",
  parseStdoutLine: parseOpenClawGatewayStdoutLine,
  ConfigFields: OpenClawGatewayConfigFields,
  buildAdapterConfig: buildOpenClawGatewayConfig,
};
