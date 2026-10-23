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
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
        />
        </MarksProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
