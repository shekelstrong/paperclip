import { createContext, useCallback, useContext, useMemo, useState, type ReactНетde } from "react";
import type { ЗадачаРаботаMode } from "@paperclipai/shared";

interface NewЗадачаПо умолчаниюs {
  status?: string;
  workMode?: ЗадачаРаботаMode;
  priority?: string;
  projectId?: string;
  projectРабочая областьId?: string;
  goalId?: string;
  parentId?: string;
  parentIdentifier?: string;
  parentНазвание?: string;
  executionРабочая областьId?: string;
  executionРабочая областьMode?: string;
  parentExecutionРабочая областьLabel?: string;
  assigneeАгентId?: string;
  assigneeUserId?: string;
  title?: string;
  description?: string;
}

interface NewЦельПо умолчаниюs {
  parentId?: string;
}

interface OnboardingOptions {
  initialStep?: 1 | 2 | 3 | 4;
  companyId?: string;
}

interface DialogContextЗначение {
  newЗадачаOpen: boolean;
  newЗадачаПо умолчаниюs: NewЗадачаПо умолчаниюs;
  openNewЗадача: (defaults?: NewЗадачаПо умолчаниюs) => void;
  closeNewЗадача: () => void;
  newProjectOpen: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;
  newЦельOpen: boolean;
  newЦельПо умолчаниюs: NewЦельПо умолчаниюs;
  openNewЦель: (defaults?: NewЦельПо умолчаниюs) => void;
  closeNewЦель: () => void;
  newАгентOpen: boolean;
  openNewАгент: () => void;
  closeNewАгент: () => void;
  onboardingOpen: boolean;
  onboardingOptions: OnboardingOptions;
  openOnboarding: (options?: OnboardingOptions) => void;
  closeOnboarding: () => void;
}

type DialogStateЗначение = Pick<
  DialogContextЗначение,
  | "newЗадачаOpen"
  | "newЗадачаПо умолчаниюs"
  | "newProjectOpen"
  | "newЦельOpen"
  | "newЦельПо умолчаниюs"
  | "newАгентOpen"
  | "onboardingOpen"
  | "onboardingOptions"
>;

type DialogActionsЗначение = Omit<DialogContextЗначение, keyof DialogStateЗначение>;

const DialogStateContext = createContext<DialogStateЗначение | null>(null);
const DialogActionsContext = createContext<DialogActionsЗначение | null>(null);

export function DialogПровайдер({ children }: { children: ReactНетde }) {
  const [newЗадачаOpen, setNewЗадачаOpen] = useState(false);
  const [newЗадачаПо умолчаниюs, setNewЗадачаПо умолчаниюs] = useState<NewЗадачаПо умолчаниюs>({});
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newЦельOpen, setNewЦельOpen] = useState(false);
  const [newЦельПо умолчаниюs, setNewЦельПо умолчаниюs] = useState<NewЦельПо умолчаниюs>({});
  const [newАгентOpen, setNewАгентOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingOptions, setOnboardingOptions] = useState<OnboardingOptions>({});

  const openNewЗадача = useCallback((defaults: NewЗадачаПо умолчаниюs = {}) => {
    setNewЗадачаПо умолчаниюs(defaults);
    setNewЗадачаOpen(true);
  }, []);

  const closeNewЗадача = useCallback(() => {
    setNewЗадачаOpen(false);
    setNewЗадачаПо умолчаниюs({});
  }, []);

  const openNewProject = useCallback(() => {
    setNewProjectOpen(true);
  }, []);

  const closeNewProject = useCallback(() => {
    setNewProjectOpen(false);
  }, []);

  const openNewЦель = useCallback((defaults: NewЦельПо умолчаниюs = {}) => {
    setNewЦельПо умолчаниюs(defaults);
    setNewЦельOpen(true);
  }, []);

  const closeNewЦель = useCallback(() => {
    setNewЦельOpen(false);
    setNewЦельПо умолчаниюs({});
  }, []);

  const openNewАгент = useCallback(() => {
    setNewАгентOpen(true);
  }, []);

  const closeNewАгент = useCallback(() => {
    setNewАгентOpen(false);
  }, []);

  const openOnboarding = useCallback((options: OnboardingOptions = {}) => {
    setOnboardingOptions(options);
    setOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    setOnboardingOptions({});
  }, []);

  const stateЗначение = useMemo<DialogStateЗначение>(
    () => ({
      newЗадачаOpen,
      newЗадачаПо умолчаниюs,
      newProjectOpen,
      newЦельOpen,
      newЦельПо умолчаниюs,
      newАгентOpen,
      onboardingOpen,
      onboardingOptions,
    }),
    [
      newЗадачаOpen,
      newЗадачаПо умолчаниюs,
      newProjectOpen,
      newЦельOpen,
      newЦельПо умолчаниюs,
      newАгентOpen,
      onboardingOpen,
      onboardingOptions,
    ],
  );

  const actionsЗначение = useMemo<DialogActionsЗначение>(
    () => ({
      openNewЗадача,
      closeNewЗадача,
      openNewProject,
      closeNewProject,
      openNewЦель,
      closeNewЦель,
      openNewАгент,
      closeNewАгент,
      openOnboarding,
      closeOnboarding,
    }),
    [
      openNewЗадача,
      closeNewЗадача,
      openNewProject,
      closeNewProject,
      openNewЦель,
      closeNewЦель,
      openNewАгент,
      closeNewАгент,
      openOnboarding,
      closeOnboarding,
    ],
  );

  return (
    <DialogActionsContext.Провайдер value={actionsЗначение}>
      <DialogStateContext.Провайдер value={stateЗначение}>
        {children}
      </DialogStateContext.Провайдер>
    </DialogActionsContext.Провайдер>
  );
}

export function useDialogActions() {
  const ctx = useContext(DialogActionsContext);
  if (!ctx) {
    throw new Ошибка("useDialogActions must be used within DialogПровайдер");
  }
  return ctx;
}

export function useDialogState() {
  const ctx = useContext(DialogStateContext);
  if (!ctx) {
    throw new Ошибка("useDialogState must be used within DialogПровайдер");
  }
  return ctx;
}

export function useDialog() {
  return {
    ...useDialogState(),
    ...useDialogActions(),
  };
}
