---
description: TanStack Query patterns for data fetching and mutations
paths: ["apps/web/**/*.tsx"]
---

# TanStack Query Patterns

## Where hooks live

- **Web-only hooks** — defined under domain folders in `apps/web/src/hooks/<domain>/` (e.g. `hooks/medias/useMedias.ts`, `hooks/board/useBoardTasks.ts`). Never define TanStack Query hooks directly in web components.
- **Cross-app hooks** — defined in `apps/shared/src/hooks/` and imported via `@hously/shared` (e.g. `useChores`, `useCreateChore`). Any hook needed by more than one app must live here.

## Query hook pattern

```typescript
export function useFeature() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.feature.list(),
    queryFn: () => fetcher<FeatureResponse>(FEATURE_ENDPOINTS.LIST),
  });
}
```

## Mutation hook pattern

```typescript
export function useCreateFeature() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeatureRequest) =>
      fetcher<ApiResult<{ id: number }>>(FEATURE_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feature.all });
    },
  });
}
```

## Cross-feature invalidation

When a mutation affects data shown on the dashboard or other features, invalidate those query keys too:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
},
```
