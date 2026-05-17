import { useEffect, useState } from "react";

/**
 * Returns remaining seconds until `endsAt` (ms epoch), corrected by the
 * server/client clock offset (offsetMs = serverTime - clientTime).
 */
export function useCountdown(endsAt: number | null, offsetMs: number) {
  const compute = () => {
    if (!endsAt) return 0;
    const remain = endsAt - (Date.now() + offsetMs);
    return Math.max(0, Math.ceil(remain / 1000));
  };
  const [remaining, setRemaining] = useState(compute);
  useEffect(() => {
    setRemaining(compute);
    const id = setInterval(() => setRemaining(compute), 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, offsetMs]);
  return remaining;
}
