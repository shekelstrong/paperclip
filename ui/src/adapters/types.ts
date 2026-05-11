import type { ComponentТип } from "react";
import type { СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";

// Re-export shared types so local consumers don't need to change imports
export type { TranscriptEntry, StdoutLineParser, СоздатьConfigЗначениеs } from "@paperclipai/adapter-utils";

export interface StatefulStdoutParser {
  parseLine: (line: string, ts: string) => import("@paperclipai/adapter-utils").TranscriptEntry[];
  reset: () => void;
}

export type StdoutParserFactory = () => StatefulStdoutParser;

export interface TranscriptParserSource {
  parseStdoutLine: (line: string, ts: string) => import("@paperclipai/adapter-utils").TranscriptEntry[];
  createStdoutParser?: StdoutParserFactory;
}

export interface АдаптерConfigFieldsProps {
  mode: "create" | "edit";
  isСоздать: boolean;
  adapterТип: string;
  /** Создать mode: raw form values */
  values: СоздатьConfigЗначениеs | null;
  /** Создать mode: setter for form values */
  set: ((patch: Partial<СоздатьConfigЗначениеs>) => void) | null;
  /** Изменить mode: original adapterConfig from agent */
  config: Record<string, unknown>;
  /** Изменить mode: read effective value */
  eff: <T>(group: "adapterConfig", field: string, original: T) => T;
  /** Изменить mode: mark field dirty */
  mark: (group: "adapterConfig", field: string, value: unknown) => void;
  /** Available models for dropdowns */
  models: { id: string; label: string }[];
  /** When true, hides the instructions file path field (e.g. during import where it's set automatically) */
  hideInstructionsFile?: boolean;
}

export interface UIАдаптерModule extends TranscriptParserSource {
  type: string;
  label: string;
  ConfigFields: ComponentТип<АдаптерConfigFieldsProps>;
  buildАдаптерConfig: (values: СоздатьConfigЗначениеs) => Record<string, unknown>;
}
