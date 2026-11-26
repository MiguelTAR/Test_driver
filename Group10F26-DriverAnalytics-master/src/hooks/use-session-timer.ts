import { useDrivingSession } from '@/hooks/driving-session-context';
import { useEffect, useState } from 'react';

export function useSessionTimer() {
  const { status, startedAtMs, pausedAtMs, pausedDurationMs } = useDrivingSession();
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (status !== 'active') return;
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [status]);

  if (startedAtMs === null || !['active', 'paused'].includes(status)) return 0;
  const endTime = status === 'paused' && pausedAtMs !== null ? pausedAtMs : now;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((endTime - startedAtMs - pausedDurationMs) / 1000)
  );

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