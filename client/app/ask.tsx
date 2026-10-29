import { Redirect, useLocalSearchParams } from 'expo-router';

// The chat lives in the Ask AI tab; older links (and "Ask about this") land there.
export default function AskScreen() {
  const { about } = useLocalSearchParams<{ about?: string }>();
  return <Redirect href={about ? { pathname: '/ask-ai', params: { about } } : '/ask-ai'} />;
}
