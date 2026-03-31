import { useEffect, useRef, useState } from 'react';

type UseEventSourceStateOptions<T> = {
  url: string;
  initialData: T | null | undefined;
  enabled?: boolean;
  treatInitialDataAsConnected?: boolean;
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
  treatInitialDataAsConnected = false,
  onParseError,
}: UseEventSourceStateOptions<T>): UseEventSourceStateResult<T> {
  const [sseData, setSseData] = useState<T | null>(null);
  const data = sseData ?? initialData ?? null;
  const [streamConnected, setStreamConnected] = useState(() => treatInitialDataAsConnected && initialData != null);
  const parseErrorHandlerRef = useRef<typeof onParseError>(onParseError);

  useEffect(() => {
    parseErrorHandlerRef.current = onParseError;
  }, [onParseError]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => setStreamConnected(true);
    source.onmessage = event => {
      try {
        setSseData(JSON.parse(event.data) as T);
      } catch (error) {
        parseErrorHandlerRef.current?.(error);
      }
    };
    source.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      source.close();
      setStreamConnected(false);
      setSseData(null);
    };
  }, [enabled, url]);

  return { data, streamConnected };
}
