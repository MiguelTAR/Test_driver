import { useDrivingSession } from '@/hooks/driving-session-context';
import { useEffect, useState } from 'react';

export function useSessionTimer() {
  const { status, startedAtMs } = useDrivingSession();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'active' || startedAtMs === null) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(
        Math.floor((Date.now() - startedAtMs) / 1000)
      );
    };

    updateElapsed();

    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, [status, startedAtMs]);

  return elapsedSeconds;
}

export function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}