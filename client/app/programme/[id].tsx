import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { useAlternatives } from '../../src/alternatives';
import { checkLabel } from '../../src/check-labels';
import { usePlan, useSavePlan } from '../../src/plan';
import { checkProgramme, useInstitutions, useProgramme, useSubjectNames } from '../../src/reference';
import { useCurrentMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { space } from '../../src/theme';
import { useSaved, useStartApplication, useToggleSaved } from '../../src/tracking';
import {
  Body,
  Button,
  Card,
  Check,
  ErrorNote,
  Heading,
  Pill,
  QueryState,
  Screen,
  Section,
  SourceLine,
  Title,
} from '../../src/ui';
import { BANNER, isGood, OUTCOMES } from '../../src/verdicts';

const LEVELS: Record<string, string> = {
  degree: 'degree',
  diploma: 'diploma',
  higher_certificate: 'higher certificate',
  nc_v: 'NC(V)',
};

// Plan B for this one course, loaded with one tap.
function PlanB({ id, accessToken }: { id: string; accessToken: string | null }) {
  const alternatives = useAlternatives(id, accessToken);
  if (!alternatives.data) {
    return (
      <>
        <Button label="See Plan B" busy={alternatives.isPending} onPress={() => alternatives.mutate()} />
        <ErrorNote error={alternatives.error} />
      </>
    );
  }
  return (
    <>
      <Section>Plan B</Section>
      {alternatives.data.routes.map((route) => (
        <Card key={route.key}>
          <Title>{route.title}</Title>
          {route.items.length === 0 && <Body muted small>{route.empty_reason}</Body>}
          {route.items.map((item) => (
            <Button
              key={item.id}
              label={item.window === 'closed' ? `${item.name} (closed this year)` : item.name}
              variant="link"
              onPress={() => router.push(`/programme/${item.id}`)}
            />
          ))}
        </Card>
      ))}
      {(['funding', 'work'] as const).map((group) => (
        <Card key={group}>
          <Title>{group === 'funding' ? 'Funding' : 'Work and skills'}</Title>
          {alternatives.data[group].length === 0 && <Body muted small>Nothing matched what we hold. Check the official sites.</Body>}
          {alternatives.data[group].map((item) => (
            <Button key={item.id} label={item.name} variant="link" onPress={() => router.push(`/opportunity/${item.id}`)} />
          ))}
        </Card>
      ))}
    </>
  );
}

export default function ProgrammeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const programme = useProgramme(id);
  const institutions = useInstitutions();
  const names = useSubjectNames();
  const marks = useCurrentMarks();
  const hasMarks = Object.keys(marks).length > 0;
  // The result shows as soon as the page opens; no "check" tap.
  const check = useQuery({
    queryKey: ['check', id, marks],
    queryFn: () => checkProgramme(id, marks, signedIn ? accessToken : null),
    // Course results are for signed-in learners; guests see the requirements.
    enabled: hasMarks && signedIn,
  });
  const saved = useSaved(signedIn ? accessToken : null);
  const toggleSaved = useToggleSaved(accessToken);
  const startApplication = useStartApplication(accessToken);
  const plan = usePlan(signedIn ? accessToken : null);
  const savePlan = useSavePlan(accessToken);

  const p = programme.data;
  const institution = institutions.data?.find((i) => i.id === p?.institution_id);
  const isSaved = saved.data?.some((s) => s.target_id === id) ?? false;
  const planIds = plan.data?.targets.map((t) => t.programme_id) ?? [];
  const onPlan = planIds.includes(id);
  const planFull = planIds.length >= (plan.data?.limit ?? 3);
  const verdict = check.data;
  const subject = (sid: string) => names.data?.get(sid) ?? sid;

  return (
    <Screen title="Course">
      <QueryState query={programme}>
        {p && (
          <>
            <Heading>{p.name}</Heading>
            <Body muted small>
              {institution?.name ?? p.institution_id.toUpperCase()} · {LEVELS[p.qualification] ?? p.qualification}
            </Body>

            {!signedIn && (
              <Card muted>
                <Title>See if you qualify</Title>
                <Body muted small>Sign in, or tap Try the demo, to check your marks against every requirement.</Body>
                <Button label="Sign in or try the demo" onPress={() => router.push('/sign-in')} />
              </Card>
            )}
            {signedIn && !hasMarks && (
              <Card muted>
                <Title>See if you qualify</Title>
                <Body muted small>Add your marks once and every course shows your result straight away.</Body>
                <Button label="Add my marks" onPress={() => router.push('/my-marks')} />
              </Card>
            )}
            {signedIn && hasMarks && <QueryState query={check}>{null}</QueryState>}

            {verdict && (
              <>
                <Card muted>
                  <Pill label={BANNER[verdict.outcome] ?? verdict.outcome} filled={isGood(verdict.outcome)} />
                  <Body small>{OUTCOMES[verdict.outcome] ?? verdict.outcome}</Body>
                </Card>
                <Section>Every check</Section>
                {verdict.checks.map((c) => (
                  <Check
                    key={c.name}
                    result={c.result}
                    label={`${checkLabel(c.name, verdict.scheme)}: ${c.required}`}
                    note={`Yours: ${c.yours}`}
                    onPress={() => Linking.openURL(c.source_url)}
                  />
                ))}
                <Body muted small>
                  Based on your marks and published minimums. {institution?.name ?? 'The institution'} decides who gets a place.
                </Body>
              </>
            )}

            {!verdict && (
              <>
                <Section>Subject requirements</Section>
                <Body small>Minimum APS: {p.min_aps ?? 'check with the institution'}</Body>
                {p.requirement_groups.map((group, i) => (
                  <Body key={i} small>
                    {group.map((o) => `${subject(o.subject_id)} ${o.min_percent}%`).join(' or ')}
                  </Body>
                ))}
              </>
            )}
            {!p.verified && <Body muted small>These requirements haven’t been double-checked yet.</Body>}

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Ask about this"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/ask', params: { about: `${p.name} at ${institution?.name ?? p.institution_id.toUpperCase()}` } })}
                />
              </View>
              {verdict && (
                <View style={{ flex: 1 }}>
                  <Button label="Why this result" variant="secondary" onPress={() => router.push(`/why/${id}`)} />
                </View>
              )}
            </View>

            {verdict && !isGood(verdict.outcome) && <PlanB id={id} accessToken={signedIn ? accessToken : null} />}

            {signedIn ? (
              <>
                {!onPlan && !planFull && (
                  <Button label="Add to my plan" busy={savePlan.isPending} onPress={() => savePlan.mutate([...planIds, id])} />
                )}
                {onPlan && <Body muted small>This course is on your plan.</Body>}
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={isSaved ? 'Saved ✓' : 'Save'}
                      variant="secondary"
                      busy={toggleSaved.isPending}
                      onPress={() => toggleSaved.mutate({ kind: 'programme', id, on: !isSaved })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Track application"
                      variant="secondary"
                      busy={startApplication.isPending}
                      onPress={() =>
                        startApplication.mutate(
                          { target_kind: 'programme', target_id: id },
                          { onSuccess: (app) => router.push(`/application/${app.id}`) },
                        )
                      }
                    />
                  </View>
                </View>
                <ErrorNote error={savePlan.error ?? toggleSaved.error ?? startApplication.error} />
              </>
            ) : null}
            <SourceLine source={p.source} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
