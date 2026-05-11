import type { СоздатьConfigЗначениеs } from "../../components/АгентConfigForm";

export function buildHttpConfig(v: СоздатьConfigЗначениеs): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  ac.method = "POST";
  ac.timeoutMs = 15000;
  return ac;
}
