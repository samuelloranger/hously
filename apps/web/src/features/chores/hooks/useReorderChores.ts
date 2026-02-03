import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";
import type { ChoresResponse } from "../../../types";

export function useReorderChores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreIds: number[]) => choresApi.reorderChores(choreIds),
    onMutate: async (choreIds: number[]) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: queryKeys.chores.list() });

      // Sauvegarder l'état précédent pour le rollback
      const previousData = queryClient.getQueryData<ChoresResponse>(
        queryKeys.chores.list()
      );

      // Mise à jour optimiste
      if (previousData) {
        // Créer un map pour un accès rapide
        const choreMap = new Map(previousData.chores.map((chore) => [chore.id, chore]));
        
        // Réordonner selon l'ordre des IDs fournis et mettre à jour les positions
        const reorderedChores = choreIds
          .map((id, index) => {
            const chore = choreMap.get(id);
            if (chore) {
              return { ...chore, position: index };
            }
            return null;
          })
          .filter((chore): chore is typeof previousData.chores[0] => chore !== null);

        // Ajouter les chores qui ne sont pas dans la liste de réordonnancement (complétées, etc.)
        const otherChores = previousData.chores.filter(
          (chore) => !choreIds.includes(chore.id)
        );

        queryClient.setQueryData<ChoresResponse>(queryKeys.chores.list(), {
          ...previousData,
          chores: [...reorderedChores, ...otherChores],
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.chores.list(),
          context.previousData
        );
      }
    },
    onSuccess: () => {
      // Invalider pour synchroniser avec le serveur
      // L'état local dans SortableList maintient l'ordre visuel pendant le refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.list() });
    },
  });
}

