import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { MarksProvider } from '../src/marks';
import { SessionProvider, useSession } from '../src/session';
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

// Screens wait until a saved sign-in is restored, so a reload never shows "Sign in" (or
// redirects to it) for someone who is signed in. A slow network waits 8 seconds at most.
function AfterRestore({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  if (status === 'restoring' && !waited) return <Loading />;
  return children;
}

export default function RootLayout() {
  const colors = useColors();
  const [fontsLoaded, fontError] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  // On a slow phone the fonts can take long or fail; open with system fonts instead of spinning.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  if (!fontsLoaded && !fontError && !gaveUp) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MarksProvider>
        <StatusBar style="auto" />
        <OfflineBanner />
        {MAINTENANCE ? (
          <Maintenance />
        ) : (
          <AfterRestore>
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
            />
          </AfterRestore>
        )}
        </MarksProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
