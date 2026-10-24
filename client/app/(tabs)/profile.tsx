import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '../../src/account';
import { usePlan } from '../../src/plan';
import { useSession } from '../../src/session';
import { useSaved, useApplications } from '../../src/tracking';
import { latestMarks, useSavedMarks } from '../../src/saved-marks';
import { font, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, Heading, Loading, Screen } from '../../src/ui';

function Row({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <Text style={{ fontFamily: font.regular, fontSize: text.body, color: colors.ink }}>{label}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>
        {detail ? `${detail} ›` : '›'}
      </Text>
    </Pressable>
  );
}

export default function Profile() {
  const { status, signOut, accessToken } = useSession();
  const me = useMe();
  const plan = usePlan(status === 'signed-in' ? accessToken : null);
  const saved = useSaved(status === 'signed-in' ? accessToken : null);
  const applications = useApplications(status === 'signed-in' ? accessToken : null);
  const marksData = useSavedMarks();
  const marks = Object.keys(latestMarks(marksData.data) ?? {}).length;
  const colors = useColors();

  if (status === 'restoring') return <Loading />;

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>Your profile</Heading>
        <Body muted>
          Sign in to keep your plan, applications and reminders on any phone. Under 18? A parent or guardian approves by
          email.
        </Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Button label="Create a free account" onPress={() => router.push('/sign-in')} />
        <Button label="Manage my data" onPress={() => router.push('/my-data')} />
        <Button label="Settings" onPress={() => router.push('/settings')} />
        <Button label="Help" onPress={() => router.push('/help')} />
      </Screen>
    );
  }

  const name = me.data?.first_name ?? 'You';
  const routes = plan.data?.targets.length ?? 0;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={[styles.avatar, { borderColor: colors.border }]}>
          <Text style={{ fontFamily: font.bold, fontSize: text.h3, color: colors.ink }}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Heading>{name}</Heading>
          <Body muted>Gauteng · NSC · marks from Grade 12 June</Body>
        </View>
      </View>

      <Body muted>MY PLAN</Body>
      <Row label="My marks" detail={marks ? `${marks} subjects` : undefined} onPress={() => router.push('/my-marks')} />
      <Row label="My scores" onPress={() => router.push('/scores')} />
      <Row label="My plan A and B" detail={`${routes} routes`} onPress={() => router.push('/plan')} />
      <Row
        label="My applications"
        detail={applications.data ? `${applications.data.length} tracked` : undefined}
        onPress={() => router.push('/applications')}
      />
      <Row label="Saved" detail={saved.data ? `${saved.data.length} items` : undefined} onPress={() => router.push('/saved')} />

      <Body muted>ACCOUNT</Body>
      <Row label="Settings and choices" onPress={() => router.push('/settings')} />
      <Row label="My data" onPress={() => router.push('/my-data')} />
      <Row label="Help and talk to a person" onPress={() => router.push('/help')} />
      <Button label="Sign out" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget,
    borderBottomWidth: 1,
    paddingVertical: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
