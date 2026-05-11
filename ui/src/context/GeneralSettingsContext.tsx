import type { ReactНетde } from "react";
import { createContext, useContext } from "react";

export interface ОбщиеНастройкиContextЗначение {
  keyboardShortcutsВключитьd: boolean;
}

const ОбщиеНастройкиContext = createContext<ОбщиеНастройкиContextЗначение>({
  keyboardShortcutsВключитьd: false,
});

export function ОбщиеНастройкиПровайдер({
  value,
  children,
}: {
  value: ОбщиеНастройкиContextЗначение;
  children: ReactНетde;
}) {
  return (
    <ОбщиеНастройкиContext.Провайдер value={value}>
      {children}
    </ОбщиеНастройкиContext.Провайдер>
  );
}

export function useОбщиеНастройки() {
  return useContext(ОбщиеНастройкиContext);
}
