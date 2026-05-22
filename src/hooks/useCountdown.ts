import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns remaining seconds until `endsAt` (ms epoch), corrected by the
 * server/client clock offset (offsetMs = serverTime - clientTime).
 */
export function useCountdown(endsAt: number | null, offsetMs: number) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!endsAt) return () => {};
      const id = setInterval(onChange, 200);
      return () => clearInterval(id);
    },
    [endsAt],
  );
  const getSnapshot = useCallback(() => {
    if (!endsAt) return 0;
    const remain = endsAt - (Date.now() + offsetMs);
    return Math.max(0, Math.ceil(remain / 1000));
  }, [endsAt, offsetMs]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
