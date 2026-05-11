import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactНетde,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Компания } from "@paperclipai/shared";
import { companiesApi } from "../api/companies";
import { ApiОшибка } from "../api/client";
import { queryКлючs } from "../lib/queryКлючs";
import type { КомпанияSelectionSource } from "../lib/company-selection";
type КомпанияSelectionOptions = { source?: КомпанияSelectionSource };
type КомпанияListResult = { companies: Компания[]; unauthorized: boolean };

interface КомпанияContextЗначение {
  companies: Компания[];
  selectedКомпанияId: string | null;
  selectedКомпания: Компания | null;
  selectionSource: КомпанияSelectionSource;
  loading: boolean;
  error: Ошибка | null;
  setSelectedКомпанияId: (companyId: string, options?: КомпанияSelectionOptions) => void;
  reloadКомпании: () => Promise<void>;
  createКомпания: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) => Promise<Компания>;
}

const STORAGE_KEY = "paperclip.selectedКомпанияId";

const КомпанияContext = createContext<КомпанияContextЗначение | null>(null);

export function resolveBootstrapКомпанияSelection(input: {
  companies: Array<Pick<Компания, "id">>;
  sidebarКомпании: Array<Pick<Компания, "id">>;
  selectedКомпанияId: string | null;
  storedКомпанияId: string | null;
}) {
  if (input.companies.length === 0) return null;

  const selectableКомпании = input.sidebarКомпании.length > 0
    ? input.sidebarКомпании
    : input.companies;
  if (input.selectedКомпанияId && selectableКомпании.some((company) => company.id === input.selectedКомпанияId)) {
    return input.selectedКомпанияId;
  }
  if (input.storedКомпанияId && selectableКомпании.some((company) => company.id === input.storedКомпанияId)) {
    return input.storedКомпанияId;
  }
  return selectableКомпании[0]?.id ?? null;
}

export function shouldОчиститьStoredКомпанияSelection(input: {
  companies: Array<Pick<Компания, "id">>;
  isЗагрузка: boolean;
  unauthorized: boolean;
}) {
  return !input.isЗагрузка && !input.unauthorized && input.companies.length === 0;
}

export function КомпанияПровайдер({ children }: { children: ReactНетde }) {
  const queryClient = useQueryClient();
  const [selectionSource, setSelectionSource] = useState<КомпанияSelectionSource>("bootstrap");
  const [selectedКомпанияId, setSelectedКомпанияIdState] = useState<string | null>(null);

  const { data: companiesResult = { companies: [], unauthorized: false }, isЗагрузка, error } = useQuery<КомпанияListResult>({
    queryКлюч: queryКлючs.companies.all,
    queryFn: async () => {
      try {
        return { companies: await companiesApi.list(), unauthorized: false };
      } catch (err) {
        if (err instanceof ApiОшибка && err.status === 401) {
          return { companies: [], unauthorized: true };
        }
        throw err;
      }
    },
    retry: false,
  });
  const companies = companiesResult.companies;
  const companyListUnauthorized = companiesResult.unauthorized;
  const sidebarКомпании = useMemo(
    () => companies.filter((company) => company.status !== "archived"),
    [companies],
  );

  // Авто-select first company when list loads
  useEffect(() => {
    if (isЗагрузка) return;
    if (companies.length === 0) {
      if (shouldОчиститьStoredКомпанияSelection({ companies, isЗагрузка: false, unauthorized: companyListUnauthorized })) {
        if (selectedКомпанияId !== null) {
          setSelectedКомпанияIdState(null);
        }
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const next = resolveBootstrapКомпанияSelection({
      companies,
      sidebarКомпании,
      selectedКомпанияId,
      storedКомпанияId: localStorage.getItem(STORAGE_KEY),
    });
    if (next === null || next === selectedКомпанияId) return;
    setSelectedКомпанияIdState(next);
    setSelectionSource("bootstrap");
    localStorage.setItem(STORAGE_KEY, next);
  }, [companies, companyListUnauthorized, isЗагрузка, selectedКомпанияId, sidebarКомпании]);

  const setSelectedКомпанияId = useCallback((companyId: string, options?: КомпанияSelectionOptions) => {
    setSelectedКомпанияIdState(companyId);
    setSelectionSource(options?.source ?? "manual");
    localStorage.setItem(STORAGE_KEY, companyId);
  }, []);

  const reloadКомпании = useCallback(async () => {
    await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      budgetMonthlyCents?: number;
    }) =>
      companiesApi.create(data),
    onУспешно: (company) => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      setSelectedКомпанияId(company.id);
    },
  });

  const createКомпания = useCallback(
    async (data: {
      name: string;
      description?: string | null;
      budgetMonthlyCents?: number;
    }) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation],
  );

  const selectedКомпания = useMemo(
    () => companies.find((company) => company.id === selectedКомпанияId) ?? null,
    [companies, selectedКомпанияId],
  );

  const value = useMemo(
    () => ({
      companies,
      selectedКомпанияId,
      selectedКомпания,
      selectionSource,
      loading: isЗагрузка,
      error: error as Ошибка | null,
      setSelectedКомпанияId,
      reloadКомпании,
      createКомпания,
    }),
    [
      companies,
      selectedКомпанияId,
      selectedКомпания,
      selectionSource,
      isЗагрузка,
      error,
      setSelectedКомпанияId,
      reloadКомпании,
      createКомпания,
    ],
  );

  return <КомпанияContext.Провайдер value={value}>{children}</КомпанияContext.Провайдер>;
}

export function useКомпания() {
  const ctx = useContext(КомпанияContext);
  if (!ctx) {
    throw new Ошибка("useКомпания must be used within КомпанияПровайдер");
  }
  return ctx;
}
