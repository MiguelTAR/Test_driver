import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDrivingSession } from '../hooks/driving-session-context';
import { GpsWarningBanner } from '../hooks/gps-warning-banner';
import { OfflineBanner } from '../hooks/offline-banner';
import { formatElapsed, useSessionTimer } from '../hooks/use-session-timer';

export default function DrivingScreen() {
  const { status, error, start, pause, resume, endSession } = useDrivingSession();
  const elapsed = useSessionTimer();
  const active = status === 'active';
  const paused = status === 'paused';
  const busy = status === 'starting' || status === 'ending';

  const onPress = async () => {
    if (active || paused) {
      await endSession();
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
          {active ? 'Session active' : paused ? 'Session paused' : 'No active session'}
        </Text>

        {(active || paused) && <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>}

        {active && <Pressable onPress={pause} style={[styles.button, styles.pauseButton]}><Text style={styles.buttonText}>Pause Session</Text></Pressable>}
        {paused && <Pressable onPress={resume} style={[styles.button, styles.resumeButton]}><Text style={styles.buttonText}>Resume Session</Text></Pressable>}
        <Pressable
          onPress={onPress}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: active || paused ? '#c0392b' : '#27ae60' },
            busy && { opacity: 0.6 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.buttonText}>
            {active || paused ? 'End Session' : busy ? 'Please wait...' : 'Start Driving'}
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
  pauseButton: { backgroundColor: '#B26A00' },
  resumeButton: { backgroundColor: '#2F5BD9' },
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