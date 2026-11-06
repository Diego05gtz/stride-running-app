import { useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (!active) return;
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          const wakeLockApi = (navigator as unknown as {
            wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
          }).wakeLock;
          const sentinel = await wakeLockApi.request('screen');
          if (isMounted) {
            sentinelRef.current = sentinel;
            setIsWakeLockActive(true);
          } else {
            await sentinel.release();
          }
        } catch {
          if (isMounted) setIsWakeLockActive(false);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
        } catch {
          // Ignore release errors
        }
        sentinelRef.current = null;
      }
      if (isMounted) setIsWakeLockActive(false);
    };

    if (active) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [active]);

  return { isWakeLockActive };
}
