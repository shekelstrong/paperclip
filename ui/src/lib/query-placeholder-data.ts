import type { PlaceholderDataFunction, QueryКлюч } from "@tanstack/react-query";

export function keepPreviousDataForSameQueryTail<TQueryData, TQueryКлюч extends QueryКлюч = QueryКлюч>(
  tail: unknown,
): PlaceholderDataFunction<TQueryData, Ошибка, TQueryData, TQueryКлюч> {
  return (previousData, previousQuery) => {
    const previousКлюч = Array.isArray(previousQuery?.queryКлюч) ? previousQuery.queryКлюч : [];
    return previousКлюч.at(-1) === tail ? previousData : undefined;
  };
}
