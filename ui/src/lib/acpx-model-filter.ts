import type { АдаптерМодель } from "../api/agents";
import { models as CLAUDE_LOCAL_MODELS } from "@paperclipai/adapter-claude-local";
import { models as CODEX_LOCAL_MODELS } from "@paperclipai/adapter-codex-local";

const claudeМодельIds = new Set(CLAUDE_LOCAL_MODELS.map((model) => model.id));
const codexМодельIds = new Set(CODEX_LOCAL_MODELS.map((model) => model.id));

export function filterAcpxМодельsByАгент(models: АдаптерМодель[], acpxАгент: string): АдаптерМодель[] {
  if (acpxАгент === "claude") {
    return models.filter((model) => claudeМодельIds.has(model.id) || model.label.startsWith("Claude: "));
  }
  if (acpxАгент === "codex") {
    return models.filter((model) => codexМодельIds.has(model.id) || model.label.startsWith("Codex: "));
  }
  return [];
}
