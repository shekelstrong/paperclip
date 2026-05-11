import { createContext, useContext, useMemo, type ReactНетde } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildНавыкMentionHref } from "@paperclipai/shared";
import { companyНавыкиApi } from "../api/companyНавыки";
import { useКомпания } from "./КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";

export interface НавыкКомандаOption {
  id: string;
  kind: "skill";
  skillId: string;
  key: string;
  name: string;
  slug: string;
  description: string | null;
  href: string;
  aliases: string[];
}

interface ИзменитьorАвтоcompleteContextЗначение {
  slashКоманды: НавыкКомандаOption[];
}

const ИзменитьorАвтоcompleteContext = createContext<ИзменитьorАвтоcompleteContextЗначение>({
  slashКоманды: [],
});

export function ИзменитьorАвтоcompleteПровайдер({ children }: { children: ReactНетde }) {
  const { selectedКомпанияId } = useКомпания();
  const { data: companyНавыки = [] } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.companyНавыки.list(selectedКомпанияId)
      : ["company-skills", "__none__"],
    queryFn: () => companyНавыкиApi.list(selectedКомпанияId!),
    enabled: Boolean(selectedКомпанияId),
  });

  const value = useMemo<ИзменитьorАвтоcompleteContextЗначение>(() => ({
    slashКоманды: companyНавыки.map((skill) => ({
      id: `skill:${skill.id}`,
      kind: "skill",
      skillId: skill.id,
      key: skill.key,
      name: skill.name,
      slug: skill.slug,
      description: skill.description ?? null,
      href: buildНавыкMentionHref(skill.id, skill.slug),
      aliases: [skill.slug, skill.name, skill.key],
    })),
  }), [companyНавыки]);

  return (
    <ИзменитьorАвтоcompleteContext.Провайдер value={value}>
      {children}
    </ИзменитьorАвтоcompleteContext.Провайдер>
  );
}

export function useИзменитьorАвтоcomplete() {
  return useContext(ИзменитьorАвтоcompleteContext);
}
