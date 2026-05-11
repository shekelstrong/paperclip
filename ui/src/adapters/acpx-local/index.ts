import type { UIАдаптерModule } from "../types";
import { parseAcpxStdoutLine, buildAcpxLocalConfig } from "@paperclipai/adapter-acpx-local/ui";
import { SchemaConfigFields } from "../schema-config-fields";

export const acpxLocalUIАдаптер: UIАдаптерModule = {
  type: "acpx_local",
  label: "ACPX (local)",
  parseStdoutLine: parseAcpxStdoutLine,
  ConfigFields: SchemaConfigFields,
  buildАдаптерConfig: buildAcpxLocalConfig,
};
