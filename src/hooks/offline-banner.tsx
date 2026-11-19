import { StyleSheet, Text, View } from 'react-native';

import { useConnectionStatus } from '../hooks/use-connection-status';

export function OfflineBanner() {
  const isConnected = useConnectionStatus();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        No internet connection. Your drive data is being saved on this device and will upload when
        you are back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 13,
  },
});