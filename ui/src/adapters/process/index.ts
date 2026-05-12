import type { UIAdapterModule } from "../types";
import { parseProcessStdoutLine } from "./parse-stdout";
import { ProcessConfigFields } from "./config-fields";
import { buildProcessConfig } from "./build-config";

export const processUIAdapter: UIAdapterModule = {
  type: "process",
  label: "Процесс оболочки",
  parseStdoutLine: parseProcessStdoutLine,
  ConfigFields: ProcessConfigFields,
  buildAdapterConfig: buildProcessConfig,
};
