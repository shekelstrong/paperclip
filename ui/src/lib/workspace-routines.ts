import {
  extractПроцедураVariableИмяs,
  WORKSPACE_BRANCH_ROUTINE_VARIABLE,
  type ПроцедураListItem,
} from "@paperclipai/shared";

const WORKSPACE_SPECIFIC_ROUTINE_VARIABLES = new Set([
  WORKSPACE_BRANCH_ROUTINE_VARIABLE,
]);

export function getРабочая областьSpecificПроцедураVariableИмяs(routine: ПроцедураListItem): string[] {
  const names = new Set<string>();

  for (const variable of routine.variables) {
    if (WORKSPACE_SPECIFIC_ROUTINE_VARIABLES.has(variable.name)) {
      names.add(variable.name);
    }
  }

  for (const name of extractПроцедураVariableИмяs([routine.title, routine.description])) {
    if (WORKSPACE_SPECIFIC_ROUTINE_VARIABLES.has(name)) {
      names.add(name);
    }
  }

  return [...names];
}

export function routineHasРабочая областьSpecificVariables(routine: ПроцедураListItem): boolean {
  return getРабочая областьSpecificПроцедураVariableИмяs(routine).length > 0;
}
