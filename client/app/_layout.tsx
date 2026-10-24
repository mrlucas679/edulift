import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MarksProvider } from '../src/marks';
import { SessionProvider } from '../src/session';
import { useColors } from '../src/theme';
import { Loading } from '../src/ui';
import { Maintenance } from '../src/maintenance';
import { OfflineBanner } from '../src/offline-banner';

// Set EXPO_PUBLIC_MAINTENANCE=1 for a build during a planned outage.
const MAINTENANCE = process.env.EXPO_PUBLIC_MAINTENANCE === '1';

// The logo screen opens first. It moves on by itself, or on Start.
export const unstable_settings = { initialRouteName: 'splash' };

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const colors = useColors();
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  if (!fontsLoaded) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MarksProvider>
        <StatusBar style="auto" />
        <OfflineBanner />
        {MAINTENANCE ? (
          <Maintenance />
        ) : (
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
          />
        )}
        </MarksProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
