import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDrivingSession } from '../hooks/driving-session-context';
import { GpsWarningBanner } from '../hooks/gps-warning-banner';
import { OfflineBanner } from '../hooks/offline-banner';
import { formatElapsed, useSessionTimer } from '../hooks/use-session-timer';

export default function DrivingScreen() {
  const { status, error, start, stop } = useDrivingSession();
  const elapsed = useSessionTimer();
  const active = status === 'active';

  const onPress = async () => {
    if (active) {
      stop();
      return;
    }
    await start();
  };

  
    return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
        <GpsWarningBanner />
      <View style={styles.container}>
        <Text style={styles.status}>
          {active ? 'Session active' : 'No active session'}
        </Text>

        <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: active ? '#c0392b' : '#27ae60' },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.buttonText}>
            {active ? 'Stop Driving' : 'Start Driving'}
          </Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 24,
  },
  status: {
    fontSize: 18,
  },
  timer: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
    errorText: {
    color: '#c0392b',
    fontSize: 14,
    textAlign: 'center',
  },
});