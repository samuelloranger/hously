import { useEffect, useRef } from 'react';

interface UseJsonEventSourceOptions<T> {
  enabled?: boolean;
  url: string | null;
  onMessage: (data: T) => void;
  onOpen?: () => void;
  onError?: () => void;
  onReset?: () => void;
  onCleanup?: () => void;
  withCredentials?: boolean;
  logLabel: string;
}

export function useJsonEventSource<T>({
  enabled = true,
  url,
  onMessage,
  onOpen,
  onError,
  onReset,
  onCleanup,
  withCredentials = true,
  logLabel,
}: UseJsonEventSourceOptions<T>) {
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onErrorRef = useRef(onError);
  const onResetRef = useRef(onReset);
  const onCleanupRef = useRef(onCleanup);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onErrorRef.current = onError;
    onResetRef.current = onReset;
    onCleanupRef.current = onCleanup;
  }, [onCleanup, onError, onMessage, onOpen, onReset]);

  useEffect(() => {
    onResetRef.current?.();

    if (!enabled || !url) return;
    if (typeof globalThis.EventSource === 'undefined') return;

    const source = new (globalThis.EventSource as any)(url, { withCredentials });

    source.onopen = () => {
      onOpenRef.current?.();
    };

    source.onmessage = (event: { data: string }) => {
      try {
        onMessageRef.current(JSON.parse(event.data) as T);
      } catch (error) {
        console.error(`Failed to parse ${logLabel} payload`, error);
      }
    };

    source.onerror = () => {
      onErrorRef.current?.();
    };

    return () => {
      source.close();
      onCleanupRef.current?.();
    };
  }, [enabled, logLabel, url, withCredentials]);
}
