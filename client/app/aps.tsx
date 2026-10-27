import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { saveMarks, useMe } from '../src/account';
import { useMarks } from '../src/marks';
import { ApsSummary, blankRows, MarksEditor, MIN_SUBJECTS, useResolvedMarks } from '../src/marks-editor';
import { PERIODS } from '../src/saved-marks';
import { useSession } from '../src/session';
import { Body, Button, Card, Chips, ErrorNote, Screen, Title } from '../src/ui';

export default function ApsCalculator() {
  const [typed, setTyped] = useMarks();
  const rows = typed.length ? typed : blankRows();
  const marks = useResolvedMarks(rows);
  const ready = Object.keys(marks).length >= MIN_SUBJECTS;
  const { accessToken } = useSession();
  const me = useMe();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('gr12_june');
  const save = useMutation({
    mutationFn: () => saveMarks(accessToken, period, marks),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-marks'] }),
  });
  const active = me.data?.status === 'active';

  return (
    <Screen
      title="APS calculator"
      footer={
        <>
          <Button label="See courses I qualify for" disabled={!ready} onPress={() => router.push('/study')} />
          <Button label="How APS works" variant="link" onPress={() => router.push('/help')} />
        </>
      }
    >
      <Body muted small>{active ? 'Work out your score, then save it to your account.' : 'No account needed. Nothing you type is saved.'}</Body>
      <MarksEditor rows={rows} setRows={setTyped} />
      <ApsSummary marks={marks} full />
      {active && ready && (
        <Card>
          <Title>Save to my account</Title>
          <Chips options={[...PERIODS]} value={period} onChange={setPeriod} />
          <Button label={save.isSuccess ? 'Saved ✓' : 'Save these marks'} variant="secondary" busy={save.isPending} onPress={() => save.mutate()} />
          <ErrorNote error={save.error} />
        </Card>
      )}
      <Body muted small>Each university counts marks differently. A score is a guide; the institution decides.</Body>
    </Screen>
  );
}
