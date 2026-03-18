---
description: TanStack Query patterns for data fetching and mutations
globs: ["apps/web/**/*.tsx", "apps/shared/src/hooks/**"]
---

# TanStack Query Patterns

## Hooks live in `@hously/shared`

All query/mutation hooks are defined in `apps/shared/src/hooks/` and imported via `@hously/shared`. Never define TanStack Query hooks directly in web components.

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
        method: 'POST',
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
