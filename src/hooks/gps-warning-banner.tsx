import { StyleSheet, Text, View } from 'react-native';
import { useDrivingSession } from './driving-session-context';

export function GpsWarningBanner() {
  const { status, gpsAvailable } = useDrivingSession();

  if (status !== 'active' || gpsAvailable) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        GPS signal lost. Location is not being recorded. Check that location
        services are turned on.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 13,
  },
});