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
import { enqueue, flush } from './offline-queue';
import { useConnectionStatus } from './use-connection-status';


type SessionStatus = 'inactive' | 'starting' | 'active';

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
  latestLocation: Location.LocationObject | null;
  latestAcceleration: AccelerationReading | null;
  error: string | null;
  gpsAvailable: boolean;
  start: () => Promise<boolean>;
  stop: () => void;
};

const DrivingSessionContext =
  createContext<DrivingSessionContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
};

export function DrivingSessionProvider({ children }: ProviderProps) {
  const [status, setStatus] = useState<SessionStatus>('inactive');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [latestLocation, setLatestLocation] =
    useState<Location.LocationObject | null>(null);
  const [latestAcceleration, setLatestAcceleration] =
    useState<AccelerationReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startInProgress = useRef(false);
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const wasGpsAvailable = useRef(true);
  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);
  const accelerometerSubscription =
    useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);
    
  const isConnected = useConnectionStatus();
  const stop = useCallback(() => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;

    accelerometerSubscription.current?.remove();
    accelerometerSubscription.current = null;

    setStatus('inactive');
    setSessionId(null);
    setStartedAtMs(null);
    setLatestLocation(null);
    setLatestAcceleration(null);
    setGpsAvailable(true);
    wasGpsAvailable.current = true;
  }, []);

  const start = useCallback(async () => {
    if (startInProgress.current) return false;
    if (status === 'active') return true;

    startInProgress.current = true;
    setStatus('starting');
    setError(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Turn on location services to start a session.');
      }

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        throw new Error(
          'Location permission is required to start a driving session.'
        );
      }

      const accelerometerAvailable =
        await Accelerometer.isAvailableAsync();

      if (!accelerometerAvailable) {
        throw new Error(
          'An accelerometer is required but is not available on this device.'
        );
      }

      const initialLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      locationSubscription.current =
        await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 5,
          },
          setLatestLocation
        );

      Accelerometer.setUpdateInterval(1000);
      accelerometerSubscription.current = Accelerometer.addListener(
        (reading) => {
          setLatestAcceleration({
            ...reading,
            timestamp: Date.now(),
          });
        }
      );

      const now = Date.now();
      setSessionId(`session-${now}`);
      setStartedAtMs(now);
      setLatestLocation(initialLocation);
      setStatus('active');

      return true;
    } catch (caught) {
      locationSubscription.current?.remove();
      locationSubscription.current = null;

      accelerometerSubscription.current?.remove();
      accelerometerSubscription.current = null;

      setStatus('inactive');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to start a driving session.'
      );

      return false;
    } finally {
      startInProgress.current = false;
    }
  }, [status]);

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
      accelerometerSubscription.current?.remove();
    };
  }, []);
  
  useEffect(() => {
      if (status !== 'active' || !sessionId || !latestLocation || !gpsAvailable) return;

      const sample = {
        sessionId,
        timestamp: latestLocation.timestamp,
        coords: latestLocation.coords,
        acceleration: latestAcceleration,
      };

      if (isConnected) {
        uploadSamples([sample]).catch(() => enqueue(sample));
      } else {
        enqueue(sample);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latestLocation]);

  // Upload everything that was queued when the connection comes back
  useEffect(() => {
    if (isConnected) {
      flush((items) => uploadSamples(items.map((item) => item.payload)));
    }
  }, [isConnected]);

  // Detect GPS loss while a session is active
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

  // Record a marker in the data when GPS drops or comes back
  useEffect(() => {
    const previous = wasGpsAvailable.current;
    wasGpsAvailable.current = gpsAvailable;
    if (status !== 'active' || !sessionId || previous === gpsAvailable) return;

    const event = {
      sessionId,
      timestamp: Date.now(),
      type: gpsAvailable ? 'gps_restored' : 'gps_lost',
    };

    if (isConnected) {
      uploadSamples([event]).catch(() => enqueue(event));
    } else {
      enqueue(event);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsAvailable]);

  return (
    <DrivingSessionContext.Provider
      value={{
        status,
        sessionId,
        startedAtMs,
        latestLocation,
        latestAcceleration,
        error,
        gpsAvailable,
        start,
        stop,
      }}
    >
      {children}
    </DrivingSessionContext.Provider>
  );
}
async function uploadSamples(samples: unknown[]) {
  console.log('Uploading', samples.length, 'samples');
  
}

export function useDrivingSession() {
  const context = useContext(DrivingSessionContext);

  if (!context) {
    throw new Error(
      'useDrivingSession must be used within DrivingSessionProvider.'
    );
  }

  return context;
}