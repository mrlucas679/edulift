import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { ApiError } from './api';
import type { Source } from './reference';
import { font, lineHeight, radius, space, text, touchTarget, useColors } from './theme';

export function Screen({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.body, { color: muted ? colors.inkMuted : colors.ink }]}>{children}</Text>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        style={[
          styles.input,
          { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        {...input}
      />
    </View>
  );
}

type ButtonProps = { label: string; onPress: () => void; busy?: boolean; disabled?: boolean };

export function Button({ label, onPress, busy, disabled }: ButtonProps) {
  const colors = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.accent, opacity: off ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const colors = useColors();
  if (!error) return null;
  const known = error instanceof ApiError;
  const message = known ? error.message : 'Something went wrong. Please try again.';
  const reference = known && error.requestId ? ` (Reference: ${error.requestId.slice(0, 8)})` : '';
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
      {message}
      {reference}
    </Text>
  );
}

export function Card({ children, onPress, label }: {
  children: React.ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  const colors = useColors();
  const style = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {children}
    </Pressable>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.title, { color: colors.ink }]}>{children}</Text>;
}

// Where a fact came from, and whether anyone has checked it yet.
export function SourceLine({ source }: { source: Source }) {
  const colors = useColors();
  const checked = source.checked_on ? `checked ${source.checked_on}` : 'not checked yet';
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(source.url)}>
      <Text style={[styles.small, { color: colors.inkMuted }]}>
        Source: {source.publisher} · {checked}
      </Text>
    </Pressable>
  );
}

// Names the site before you leave the app, so a bad link can't pass as ours.
export function ExternalLink({ url }: { url: string }) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return <Button label={`Apply on ${host}`} onPress={() => Linking.openURL(url)} />;
}

export function Empty({ message }: { message: string }) {
  return <Body muted>{message}</Body>;
}

// Loading, error and empty, so every screen handles all three the same way.
export function QueryState({ query, empty, children }: {
  query: { isPending: boolean; fetchStatus?: string; error: unknown; refetch: () => unknown };
  empty?: boolean;
  children: React.ReactNode;
}) {
  // A disabled query (for example, saved marks for a guest) is pending but never fetches: do not spin for it.
  if (query.isPending && query.fetchStatus !== 'idle') return <ActivityIndicator accessibilityLabel="Loading" />;
  if (query.error) {
    // Not set up yet: send the learner back to onboarding, where they finish.
    const unfinished = query.error instanceof ApiError && query.error.code === 'consent_required';
    return (
      <>
        <ErrorNote error={query.error} />
        {unfinished ? (
          <Button label="Finish setting up" onPress={() => router.push('/onboarding')} />
        ) : (
          <Button label="Try again" onPress={() => query.refetch()} />
        )}
      </>
    );
  }
  if (empty) return null;
  return <>{children}</>;
}

export function Loading() {
  const colors = useColors();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.paper }]}>
      <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  screen: { padding: space.xl, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  heading: { fontFamily: font.bold, fontSize: text.h1, lineHeight: text.h1 * lineHeight },
  body: { fontFamily: font.regular, fontSize: text.body, lineHeight: text.body * lineHeight },
  field: { gap: space.xs },
  label: { fontFamily: font.bold, fontSize: text.small },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    fontFamily: font.regular,
    fontSize: text.body,
  },
  button: {
    minHeight: touchTarget,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontFamily: font.bold, fontSize: text.body },
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.xs },
  title: { fontFamily: font.bold, fontSize: text.h3, lineHeight: text.h3 * lineHeight },
  small: { fontFamily: font.regular, fontSize: text.small, lineHeight: text.small * lineHeight },
});
