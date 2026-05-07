import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface JellyfinPlayerState {
  itemId: string | null;
  isOpen: boolean;
  play: (itemId: string) => void;
  close: () => void;
}

const JellyfinPlayerContext = createContext<JellyfinPlayerState>({
  itemId: null,
  isOpen: false,
  play: () => {},
  close: () => {},
});

export function JellyfinPlayerProvider({ children }: { children: ReactNode }) {
  const [itemId, setItemId] = useState<string | null>(null);

  const play = useCallback((id: string) => {
    if (!id) return;
    setItemId(id);
  }, []);

  const close = useCallback(() => {
    setItemId(null);
  }, []);

  const value = useMemo<JellyfinPlayerState>(
    () => ({ itemId, isOpen: itemId !== null, play, close }),
    [itemId, play, close],
  );

  return (
    <JellyfinPlayerContext.Provider value={value}>
      {children}
    </JellyfinPlayerContext.Provider>
  );
}

export function useJellyfinPlayer() {
  return useContext(JellyfinPlayerContext);
}
