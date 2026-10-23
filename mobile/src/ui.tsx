import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from './api';
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
});
