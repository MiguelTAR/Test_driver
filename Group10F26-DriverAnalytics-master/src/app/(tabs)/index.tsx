import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDrivingSession } from '../../hooks/driving-session-context';
import { formatElapsed, useSessionTimer } from '../../hooks/use-session-timer';
function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { status, start, stop } = useDrivingSession();
  const elapsed = useSessionTimer();
  const [completedTime, setCompletedTime] = useState<number | null>(null);
  const router = useRouter();

  const active = status === 'active';

  const handleToggleSession = async () => {
    if (active) {
      setCompletedTime(elapsed);
      stop();
      return;
    }

    setCompletedTime(null);
    const started = await start();

    if (!started) {
      alert('Cannot start session: required sensors are unavailable.');
    }
  };
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Driver Analytics
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          Session: {active ? 'Active' : 'Inactive'}
        </ThemedText>

        {active && (
          <ThemedText style={styles.timerDisplay}>
            {formatElapsed(elapsed)}
          </ThemedText>
        )}

        {!active && completedTime !== null && (
          <ThemedView style={styles.summaryBox}>
            <ThemedText type="small" style={{ color: '#8e8e93' }}>
              Total Session Duration
            </ThemedText>
            <ThemedText style={styles.summaryText}>
              {formatElapsed(completedTime)}
            </ThemedText>
          </ThemedView>
        )}

        <Button
          title={active ? 'End Session' : 'Start Session'}
          onPress={handleToggleSession}
          color={active ? '#c0392b' : undefined}
        />

<Button
  title="Create Account"
  onPress={() => router.push('/register')}
/>
        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginVertical: Spacing.two,
  },
  summaryBox: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginVertical: Spacing.two,
  },
  summaryText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginTop: 4,
  },
});