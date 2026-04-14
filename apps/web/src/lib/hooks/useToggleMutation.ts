import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { ApiResult } from "@hously/shared/types";

type ToggleMutationOptions<TListData, TItem> = {
  listQueryKey: QueryKey;
  getItems: (data: TListData) => TItem[];
  setItems: (data: TListData, items: TItem[]) => TListData;
  getId: (item: TItem) => number;
  toggleCompleted: (item: TItem) => TItem;
  mutationFn: (id: number) => Promise<ApiResult<{ completed: boolean }>>;
  /** Extra query roots to invalidate on settle (e.g. dashboard, notifications). */
  extraInvalidateKeys?: QueryKey[];
};

/**
 * Shared optimistic toggle for list items with `completed` and numeric `id`.
 */
export function useToggleListItemMutation<TListData, TItem>({
  listQueryKey,
  getItems,
  setItems,
  getId,
  toggleCompleted,
  mutationFn,
  extraInvalidateKeys = [],
}: ToggleMutationOptions<TListData, TItem>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) => mutationFn(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<TListData>(listQueryKey);

      if (previous) {
        const items = getItems(previous).map((item) =>
          getId(item) === itemId ? toggleCompleted(item) : item,
        );
        queryClient.setQueryData<TListData>(
          listQueryKey,
          setItems(previous, items),
        );
      }

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
    },
    onSettled: () => {
      for (const key of [listQueryKey, ...extraInvalidateKeys]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
