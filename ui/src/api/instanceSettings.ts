import type {
  InstanceExperimentalНастройки,
  InstanceОбщиеНастройки,
  ЗадачаGraphLivenessАвтоRecoveryПредпросмотр,
  PatchInstanceОбщиеНастройки,
  PatchInstanceExperimentalНастройки,
} from "@paperclipai/shared";
import { api } from "./client";

export const instanceНастройкиApi = {
  getОбщие: () =>
    api.get<InstanceОбщиеНастройки>("/instance/settings/general"),
  updateОбщие: (patch: PatchInstanceОбщиеНастройки) =>
    api.patch<InstanceОбщиеНастройки>("/instance/settings/general", patch),
  getExperimental: () =>
    api.get<InstanceExperimentalНастройки>("/instance/settings/experimental"),
  updateExperimental: (patch: PatchInstanceExperimentalНастройки) =>
    api.patch<InstanceExperimentalНастройки>("/instance/settings/experimental", patch),
  previewЗадачаGraphLivenessАвтоRecovery: (input: { lookbackHours?: number }) =>
    api.post<ЗадачаGraphLivenessАвтоRecoveryПредпросмотр>(
      "/instance/settings/experimental/issue-graph-liveness-auto-recovery/preview",
      input,
    ),
  runЗадачаGraphLivenessАвтоRecovery: (input: { lookbackHours?: number }) =>
    api.post<{
      findings: number;
      autoRecoveryВключитьd: boolean;
      lookbackHours: number;
      cutoff: string;
      escalationsСоздано: number;
      existingEscalations: number;
      skipped: number;
      skippedАвтоRecoveryОтключитьd: number;
      skippedOutsideLookback: number;
      escalationЗадачаIds: string[];
    }>(
      "/instance/settings/experimental/issue-graph-liveness-auto-recovery/run",
      input,
    ),
};
