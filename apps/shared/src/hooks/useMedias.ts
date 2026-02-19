import { useQuery } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { MEDIAS_ENDPOINTS } from '../endpoints';
import type { MediasResponse } from '../types';

export function useMedias() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.list(),
    queryFn: () => fetcher<MediasResponse>(MEDIAS_ENDPOINTS.LIST),
  });
}
