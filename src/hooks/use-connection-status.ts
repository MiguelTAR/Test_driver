import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';


export function useConnectionStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable is null until NetInfo has checked, so only treat an explicit false as offline.
      setIsConnected(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return isConnected;
}