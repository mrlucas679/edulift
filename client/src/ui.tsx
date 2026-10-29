import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
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

import { ApiError } from './api';
import type { Source } from './reference';
import { font, lineHeight, radius, space, text, touchTarget, useColors } from './theme';

// A page: header bar, scrolling body, and an optional action pinned to the bottom.
export function Screen({ children, title, back = true, footer }: {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  footer?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.paper }]}>
      {title !== undefined && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
          )}
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, { color: colors.ink }]}>
            {title}
          </Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>}
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

export function Body({ children, muted, small }: { children: React.ReactNode; muted?: boolean; small?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[small ? styles.small : styles.body, { color: muted ? colors.inkMuted : colors.ink }]}>
      {children}
    </Text>
  );
}

// Small capitals above a group, e.g. "EVERY CHECK".
export function Section({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.inkMuted }]}>{children}</Text>;
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

type ButtonProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'dashed' | 'link';
  // A second, smaller line, e.g. the site a button opens.
  sub?: string;
};

export function Button({ label, onPress, busy, disabled, variant = 'primary', sub }: ButtonProps) {
  const colors = useColors();
  const off = disabled || busy;
  const filled = variant === 'primary';
  const fg = filled ? colors.onAccent : colors.ink;
  if (variant === 'link') {
    return (
      <Pressable accessibilityRole="link" disabled={off} onPress={onPress} style={styles.link}>
        <Text style={[styles.linkLabel, { color: colors.ink, opacity: off ? 0.6 : 1 }]}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled
          ? { backgroundColor: colors.accent }
          : {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: variant === 'dashed' ? colors.inkMuted : colors.ink,
              borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
            },
        { opacity: off ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
          {sub && <Text style={[styles.tiny, { color: fg }]}>{sub}</Text>}
        </>
      )}
    </Pressable>
  );
}

// A small rounded tag: filled for good news, outlined for everything else.
export function Pill({ label, filled }: { label: string; filled?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        filled
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.ink },
      ]}
    >
      <Text style={[styles.pillLabel, { color: filled ? colors.onAccent : colors.ink }]}>{label}</Text>
    </View>
  );
}

// A row of choices; the chosen one is filled. Scrolls sideways when it runs out of room.
export function Chips<T extends string>({ options, value, onChange, wrap }: {
  options: { id: T; label: string }[];
  value: T | T[] | null;
  onChange: (id: T) => void;
  wrap?: boolean;
}) {
  const colors = useColors();
  const chosen = (id: T) => (Array.isArray(value) ? value.includes(id) : value === id);
  const chips = options.map((o) => {
    const on = chosen(o.id);
    return (
      <Pressable
        key={o.id}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onChange(o.id)}
        style={[
          styles.chip,
          on
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.chipLabel, { color: on ? colors.onAccent : colors.ink }]}>{o.label}</Text>
      </Pressable>
    );
  });
  if (wrap) return <View style={styles.chipsWrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {chips}
    </ScrollView>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const colors = useColors();
  if (!error) return null;
  // A plain string is a message we wrote, e.g. a form hint.
  const known = error instanceof ApiError;
  const message = typeof error === 'string' ? error : known ? error.message : 'Something went wrong. Please try again.';
  const reference = known && error.requestId ? ` (Reference: ${error.requestId.slice(0, 8)})` : '';
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
      {message}
      {reference}
    </Text>
  );
}

// White and outlined, or grey ("muted") for notes and warnings.
export function Card({ children, onPress, label, muted }: {
  children: React.ReactNode;
  onPress?: () => void;
  label?: string;
  muted?: boolean;
}) {
  const colors = useColors();
  const style = [
    styles.card,
    muted
      ? { backgroundColor: colors.muted, borderColor: colors.muted }
      : { backgroundColor: colors.surface, borderColor: colors.border },
  ];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {children}
    </Pressable>
  );
}

// Title on the left, a tag on the right: the top line of most list cards.
export function CardTop({ title, pill, filled }: { title: string; pill?: string; filled?: boolean }) {
  return (
    <View style={styles.cardTop}>
      <View style={styles.fill}>
        <Title>{title}</Title>
      </View>
      {pill && <Pill label={pill} filled={filled} />}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.title, { color: colors.ink }]}>{children}</Text>;
}

// A tappable line in a list: label, value, chevron.
export function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.body, styles.fill, { color: colors.ink }]}>{label}</Text>
      {value !== undefined && <Text style={[styles.small, { color: colors.inkMuted }]}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />}
    </Pressable>
  );
}

const MARK = { pass: 'checkmark', fail: 'close', unknown: 'help' } as const;

// One admission check: ✓ met, ✕ not met, ? can't tell.
export function Check({ result, label, note, onPress }: {
  result: 'pass' | 'fail' | 'unknown';
  label: string;
  note?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const pass = result === 'pass';
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={`${label}: ${result === 'pass' ? 'met' : result === 'fail' ? 'not met' : 'not known'}`}
      disabled={!onPress}
      onPress={onPress}
      style={styles.check}
    >
      <View
        style={[
          styles.checkIcon,
          pass
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.ink, borderStyle: result === 'fail' ? 'dashed' : 'solid' },
        ]}
      >
        <Ionicons name={MARK[result]} size={14} color={pass ? colors.onAccent : colors.ink} />
      </View>
      <View style={styles.fill}>
        <Body>{label}</Body>
        {note && <Body muted small>{note}</Body>}
      </View>
    </Pressable>
  );
}

// Thin segments across the top of a multi-step flow, filled up to the current step.
export function StepBar({ step, of = 3 }: { step: number; of?: number }) {
  const colors = useColors();
  return (
    <View style={styles.steps}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[styles.step, { backgroundColor: i < step ? colors.ink : colors.border }]} />
      ))}
    </View>
  );
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

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

// Names the site before you leave the app, so a bad link can't pass as ours.
export function ExternalLink({ url, label }: { url: string; label?: string }) {
  const host = hostOf(url);
  return <Button label={label ?? `Apply on ${host}`} sub={label ? host : undefined} onPress={() => Linking.openURL(url)} />;
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

// The EduLift mark and name, tinted to the theme so it reads in dark mode too.
export function Logo({ size = 40 }: { size?: number }) {
  const colors = useColors();
  return (
    <View accessibilityRole="image" accessibilityLabel="EduLift" style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <Image source={require('../assets/logo-mark.png')} style={{ width: size, height: size, tintColor: colors.accent }} />
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.6, color: colors.accent }}>EduLift</Text>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
  },
  back: { minWidth: touchTarget - 12, minHeight: touchTarget, justifyContent: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: text.body + 1, flex: 1 },
  screen: { padding: space.lg, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  heading: { fontFamily: font.bold, fontSize: text.h2, lineHeight: text.h2 * 1.25 },
  body: { fontFamily: font.regular, fontSize: text.body, lineHeight: text.body * lineHeight },
  small: { fontFamily: font.regular, fontSize: text.small, lineHeight: text.small * lineHeight },
  tiny: { fontFamily: font.regular, fontSize: text.tiny },
  section: {
    fontFamily: font.bold,
    fontSize: text.tiny,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: space.sm,
  },
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
    minHeight: touchTarget + 4,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontFamily: font.bold, fontSize: text.body },
  link: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontFamily: font.regular, fontSize: text.small, textDecorationLine: 'underline' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillLabel: { fontFamily: font.bold, fontSize: text.tiny },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: font.regular, fontSize: text.small },
  chipsRow: { gap: space.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.xs },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { fontFamily: font.bold, fontSize: text.body + 1, lineHeight: (text.body + 1) * lineHeight },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget + 4,
    borderBottomWidth: 1,
  },
  check: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.xs },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  steps: { flexDirection: 'row', gap: space.sm },
  step: { flex: 1, height: 4, borderRadius: 2 },
});
