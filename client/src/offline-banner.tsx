import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { subscribeOffline } from './connectivity';
import { font, space, text, useColors } from './theme';

// Shown at the top when the last request could not reach the server.
export function OfflineBanner() {
  const colors = useColors();
  const [offline, setOffline] = useState(false);
  useEffect(() => subscribeOffline(setOffline), []);
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, padding: space.sm }}>
      <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink }}>
        You’re offline. Showing what was saved on this phone.
      </Text>
    </View>
  );
}
