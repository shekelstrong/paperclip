export {
  getUIАдаптер,
  listUIАдаптеры,
  findUIАдаптер,
  registerUIАдаптер,
  unregisterUIАдаптер,
  syncExternalАдаптеры,
  onАдаптерChange,
} from "./registry";
export { buildTranscript } from "./transcript";
export type {
  TranscriptEntry,
  StdoutLineParser,
  UIАдаптерModule,
  АдаптерConfigFieldsProps,
} from "./types";
export type { ЗапуститьLogChunk } from "./transcript";
