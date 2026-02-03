import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";
import type { ShoppingItemsResponse } from "../../../types";

export function useReorderShoppingItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: number[]) => shoppingApi.reorderItems(itemIds),
    onMutate: async (itemIds: number[]) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });

      // Sauvegarder l'état précédent pour le rollback
      const previousData = queryClient.getQueryData<ShoppingItemsResponse>(
        queryKeys.shopping.items()
      );

      // Mise à jour optimiste
      if (previousData) {
        // Créer un map pour un accès rapide
        const itemMap = new Map(previousData.items.map((item) => [item.id, item]));
        
        // Réordonner selon l'ordre des IDs fournis et mettre à jour les positions
        const reorderedItems = itemIds
          .map((id, index) => {
            const item = itemMap.get(id);
            if (item) {
              return { ...item, position: index };
            }
            return null;
          })
          .filter((item): item is typeof previousData.items[0] => item !== null);

        // Ajouter les items qui ne sont pas dans la liste de réordonnancement (complétés, etc.)
        const otherItems = previousData.items.filter(
          (item) => !itemIds.includes(item.id)
        );

        queryClient.setQueryData<ShoppingItemsResponse>(
          queryKeys.shopping.items(),
          {
            ...previousData,
            items: [...reorderedItems, ...otherItems],
          }
        );
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.shopping.items(),
          context.previousData
        );
      }
    },
    onSuccess: () => {
      // Invalider pour synchroniser avec le serveur
      // L'état local dans SortableList maintient l'ordre visuel pendant le refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.items() });
    },
  });
}

