import type { UIАдаптерModule } from "../types";
import { parseHermesStdoutLine } from "hermes-paperclip-adapter/ui";
import { buildHermesConfig } from "hermes-paperclip-adapter/ui";
import { SchemaConfigFields } from "../schema-config-fields";

export const hermesLocalUIАдаптер: UIАдаптерModule = {
  type: "hermes_local",
  label: "Hermes Агент",
  parseStdoutLine: parseHermesStdoutLine,
  ConfigFields: SchemaConfigFields,
  buildАдаптерConfig: buildHermesConfig,
};
