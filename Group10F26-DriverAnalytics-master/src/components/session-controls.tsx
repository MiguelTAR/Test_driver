import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { SessionStatus } from '@/utils/session-state';
import { Pressable, StyleSheet } from 'react-native';
import { useDrivingSession } from '@/hooks/driving-session-context';

const PRIMARY = '#2F5BD9';
const DANGER = '#D93025';
const ACTIVE_COLOR = '#1E8E3E';
const PAUSED_COLOR = '#B26A00';

const STATUS_COLOR: Record<SessionStatus, string | undefined> = {
    inactive: undefined,
    active: ACTIVE_COLOR,
    paused:  PAUSED_COLOR,
};

function ActionButton({
    title,
    color,
    onPress,
}: {
    title: string;
    color: string;
    onPress: () => void;
}) {
    return (
        <Pressable
        onPress={onPress}
        accessibilityRole='button'
        style= {({pressed}) => [styles.button, {backgroundColor: color}, pressed && styles.dimmed]}>
            <ThemedText style = {styles.buttonText}> {title}</ThemedText>
        </Pressable>
    );    
}

export function SessionControls() {
  const { status, start, pause, resume, endSession, error } = useDrivingSession();
  const currentStatus =
    status === 'active' || status === 'paused' ? status : 'inactive';
  const label =
    status === 'starting' ? 'Starting...' :
    status === 'ending' ? 'Saving...' :
    currentStatus[0].toUpperCase() + currentStatus.slice(1);

  return (
    <ThemedView style={styles.container}>
      <ThemedText
        type="code"
        accessibilityLiveRegion="polite"
        style={{ color: STATUS_COLOR[currentStatus] }}>
        Session: {label}
      </ThemedText>

      {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
      {status === 'inactive' && (
        <ActionButton title="Start Session" color={PRIMARY} onPress={() => { void start(); }} />
      )}
      {currentStatus === 'active' && (
        <> 
        <ActionButton title ="Pause Session"color={PAUSED_COLOR} onPress={() => { void pause(); }}/>
        <ActionButton title ="End Session" color ={DANGER} onPress={() => { void endSession(); }} />
        </>
      )}
      {currentStatus === 'paused' && (
        <>
        <ActionButton title="Resume Session" color={PRIMARY} onPress={() => { void resume(); }} />
        <ActionButton title="End Session" color={DANGER} onPress={() => { void endSession(); }} />
        </>
      )}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', gap: Spacing.two},
    button: {
        minHeight: 48,
        minWidth: 200,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.four,
    },
    dimmed: {opacity: 0.7},
    buttonText: {color: '#ffffff', fontWeight: '600'},
});
