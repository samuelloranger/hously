import { useEffect, useState } from 'react';

type UseEventSourceStateOptions<T> = {
  url: string;
  initialData: T | null | undefined;
  enabled?: boolean;
  onParseError?: (error: unknown) => void;
};

type UseEventSourceStateResult<T> = {
  data: T | null;
  streamConnected: boolean;
};

export function useEventSourceState<T>({
  url,
  initialData,
  enabled = true,
  onParseError,
}: UseEventSourceStateOptions<T>): UseEventSourceStateResult<T> {
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    setData(initialData ?? null);
  }, [initialData]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => setStreamConnected(true);
    source.onmessage = event => {
      try {
        setData(JSON.parse(event.data) as T);
      } catch (error) {
        onParseError?.(error);
      }
    };
    source.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      source.close();
      setStreamConnected(false);
    };
  }, [enabled, onParseError, url]);

  return { data, streamConnected };
}
