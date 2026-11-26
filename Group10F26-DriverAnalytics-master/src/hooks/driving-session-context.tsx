import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, createSession, uploadSamples } from '@/services/api';
import { useAuth } from '@/context/auth-context';
import { enqueue, flush, withClientIds } from './offline-queue';
import { useConnectionStatus } from './use-connection-status';

type SessionStatus = 'inactive' | 'starting' | 'active' | 'paused' | 'ending';

type AccelerationReading = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

type DrivingSessionContextValue = {
  status: SessionStatus;
  sessionId: string | null;
  startedAtMs: number | null;
  pausedAtMs: number | null;
  pausedDurationMs: number;
  latestLocation: Location.LocationObject | null;
  latestAcceleration: AccelerationReading | null;
  error: string | null;
  gpsAvailable: boolean;
  start: () => Promise<boolean>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  endSession: () => Promise<boolean>;
};

const DrivingSessionContext =
  createContext<DrivingSessionContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
};

export function DrivingSessionProvider({ children }: ProviderProps) {
  const { user } = useAuth();
  const isConnected = useConnectionStatus();
  const [status, setStatus] = useState<SessionStatus>('inactive');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [pausedAtMs, setPausedAtMs] = useState<number | null>(null);
  const [pausedDurationMs, setPausedDurationMs] = useState(0);
  const [latestLocation, setLatestLocation] =
    useState<Location.LocationObject | null>(null);
  const [latestAcceleration, setLatestAcceleration] =
    useState<AccelerationReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState(true);

  const statusRef = useRef<SessionStatus>('inactive');
  const sessionIdRef = useRef<string | null>(null);
  const isConnectedRef = useRef(isConnected);
  const startInProgress = useRef(false);
  const wasGpsAvailable = useRef(true);
  const queueWork = useRef<Promise<boolean>>(Promise.resolve(true));
  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);
  const accelerometerSubscription =
    useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);

  const changeStatus = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopSensors = useCallback(() => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    accelerometerSubscription.current?.remove();
    accelerometerSubscription.current = null;
  }, []);

  const startSensors = useCallback(async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      setLatestLocation
    );

    Accelerometer.setUpdateInterval(1000);
    accelerometerSubscription.current = Accelerometer.addListener((reading) => {
      setLatestAcceleration({ ...reading, timestamp: Date.now() });
    });
  }, []);

  const queueAndFlush = useCallback(
    (items: unknown[]) => {
      const work = queueWork.current.catch(() => false).then(async () => {
        for (const item of items) {
          await enqueue(item);
        }
        if (!isConnected) return false;
        return flush(async (queuedItems) => {
          await uploadSamples(withClientIds(queuedItems));
        });
      });
      queueWork.current = work;
      return work;
    },
    [isConnected]
  );

  const start = useCallback(async () => {
    if (startInProgress.current) return false;
    if (statusRef.current === 'active') return true;
    if (statusRef.current !== 'inactive') return false;
    if (!user) {
      setError('Sign in before starting a driving session.');
      return false;
    }

    startInProgress.current = true;
    changeStatus('starting');
    setError(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Turn on location services to start a session.');
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Location permission is required to start a driving session.');
      }

      if (!(await Accelerometer.isAvailableAsync())) {
        throw new Error('An accelerometer is required but is not available on this device.');
      }

      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const now = Date.now();
      const localSessionId =
        `session-${now}-${Math.random().toString(36).slice(2, 10)}`;
      let actualSessionId = localSessionId;
      try {
        const created = await createSession(localSessionId, now);
        actualSessionId = created.id;
      } catch (caught) {
        if (caught instanceof ApiError) throw caught;
        await queueAndFlush([
          {
            sessionId: localSessionId,
            timestamp: now,
            type: 'session_started',
          },
        ]);
      }
      sessionIdRef.current = actualSessionId;
      await startSensors();

      setSessionId(actualSessionId);
      setStartedAtMs(now);
      setPausedAtMs(null);
      setPausedDurationMs(0);
      setLatestLocation(initialLocation);
      setLatestAcceleration(null);
      setGpsAvailable(true);
      wasGpsAvailable.current = true;
      changeStatus('active');
      return true;
    } catch (caught) {
      stopSensors();
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        try {
          await queueAndFlush([
            {
              sessionId: activeSessionId,
              timestamp: Date.now(),
              type: 'session_ended',
            },
          ]);
        } catch {
          // Keep the original startup error visible; session completion remains queued if storage is available.
        }
      }
      sessionIdRef.current = null;
      setSessionId(null);
      setStartedAtMs(null);
      changeStatus('inactive');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to start a driving session.'
      );
      return false;
    } finally {
      startInProgress.current = false;
    }
  }, [changeStatus, queueAndFlush, startSensors, stopSensors, user]);

  const pause = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    if (statusRef.current !== 'active' || !activeSessionId) return false;

    stopSensors();
    setPausedAtMs(Date.now());
    changeStatus('paused');
    try {
      await queueAndFlush([
        {
          sessionId: activeSessionId,
          timestamp: Date.now(),
          type: 'session_paused',
        },
      ]);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save session pause.');
      return false;
    }
  }, [changeStatus, queueAndFlush, stopSensors]);

  const resume = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    if (statusRef.current !== 'paused' || !activeSessionId) return false;

    changeStatus('starting');
    try {
      await startSensors();
      const resumedAt = Date.now();
      await queueAndFlush([
        {
          sessionId: activeSessionId,
          timestamp: resumedAt,
          type: 'session_resumed',
        },
      ]);
      if (pausedAtMs !== null) {
        setPausedDurationMs((previous) => previous + resumedAt - pausedAtMs);
      }
      setPausedAtMs(null);
      setError(null);
      changeStatus('active');
      return true;
    } catch (caught) {
      stopSensors();
      changeStatus('paused');
      setError(caught instanceof Error ? caught.message : 'Unable to resume the session.');
      return false;
    }
  }, [changeStatus, pausedAtMs, queueAndFlush, startSensors, stopSensors]);

  const endSession = useCallback(async () => {
    const currentStatus = statusRef.current;
    const activeSessionId = sessionIdRef.current;
    if (!['active', 'paused'].includes(currentStatus) || !activeSessionId) {
      return false;
    }

    stopSensors();
    changeStatus('ending');
    try {
      await queueWork.current.catch(() => false);
      const synced = await queueAndFlush([
        {
          sessionId: activeSessionId,
          timestamp: Date.now(),
          type: 'session_ended',
        },
      ]);
      sessionIdRef.current = null;
      setSessionId(null);
      setStartedAtMs(null);
      setPausedAtMs(null);
      setPausedDurationMs(0);
      setLatestLocation(null);
      setLatestAcceleration(null);
      setGpsAvailable(true);
      wasGpsAvailable.current = true;
      changeStatus('inactive');
      setError(
        synced
          ? null
          : 'Session ended on this device; its completion and any queued data will sync when the API is reachable.'
      );
      return synced;
    } catch (caught) {
      changeStatus('paused');
      setError(
        caught instanceof Error
          ? `Sensors stopped, but the session could not be saved: ${caught.message}`
          : 'Sensors stopped, but the session could not be saved.'
      );
      return false;
    }
  }, [changeStatus, queueAndFlush, stopSensors]);

  useEffect(() => {
    return stopSensors;
  }, [stopSensors]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (
      status !== 'active' ||
      !sessionId ||
      !latestLocation ||
      !gpsAvailable
    ) {
      return;
    }

    queueAndFlush([
      {
        sessionId,
        timestamp: latestLocation.timestamp,
        coords: latestLocation.coords,
        acceleration: latestAcceleration,
      },
    ]).then((synced) => {
      if (!synced && isConnectedRef.current) {
        setError('Driving data is queued locally and could not reach the API yet.');
      }
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Unable to queue driving data.');
    });
    // Samples are captured for each location update; status/session changes take effect on the next location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestLocation]);

  useEffect(() => {
    if (!isConnected) return;
    queueAndFlush([]).then((synced) => {
      if (synced && statusRef.current === 'inactive') setError(null);
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Unable to sync queued data.');
    });
  }, [isConnected, queueAndFlush]);

  useEffect(() => {
    if (status !== 'active') return;
    let cancelled = false;

    const check = async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        const permission = await Location.getForegroundPermissionsAsync();
        if (!cancelled) {
          setGpsAvailable(enabled && permission.status === 'granted');
        }
      } catch {
        if (!cancelled) setGpsAvailable(false);
      }
    };

    check();
    const timer = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status]);

  useEffect(() => {
    const previous = wasGpsAvailable.current;
    wasGpsAvailable.current = gpsAvailable;
    const activeSessionId = sessionIdRef.current;
    if (status !== 'active' || !activeSessionId || previous === gpsAvailable) return;

    queueAndFlush([
      {
        sessionId: activeSessionId,
        timestamp: Date.now(),
        type: gpsAvailable ? 'gps_restored' : 'gps_lost',
      },
    ]).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Unable to queue GPS status.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsAvailable]);

  return (
    <DrivingSessionContext.Provider
      value={{
        status,
        sessionId,
        startedAtMs,
        pausedAtMs,
        pausedDurationMs,
        latestLocation,
        latestAcceleration,
        error,
        gpsAvailable,
        start,
        pause,
        resume,
        endSession,
      }}
    >
      {children}
    </DrivingSessionContext.Provider>
  );
}

export function useDrivingSession() {
  const context = useContext(DrivingSessionContext);
  if (!context) {
    throw new Error('useDrivingSession must be used within DrivingSessionProvider.');
  }
  return context;
}
