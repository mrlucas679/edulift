import { useState } from 'react';
import { Switch, View } from 'react-native';

import { saveText } from './download';
import { space } from './theme';
import { Body, Button, Card, Heading, Title } from './ui';

// Shown once, right after the codes are made. The API keeps only their hashes.
export function RecoveryCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const [saved, setSaved] = useState(false);
  const text = ['EduLift recovery codes. Each works once.', '', ...codes].join('\n');
  return (
    <>
      <Heading>Save your recovery codes</Heading>
      <Body muted>If you forget your password, one of these codes lets you set a new one. Each works once. We can’t show them again, and there is no email reset.</Body>
      <Card>
        <Title>Your 10 codes</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }} accessibilityLabel="Recovery codes">
          {codes.map((code) => (
            <Body key={code}>{code}</Body>
          ))}
        </View>
      </Card>
      <Button label="Save the codes as a file" variant="secondary" onPress={() => saveText('edulift-recovery-codes', text)} />
      <Body muted small>Or write them down. Keep them somewhere only you can reach, not in a shared chat.</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Switch accessibilityLabel="I saved my recovery codes" value={saved} onValueChange={setSaved} />
        <Body>I saved my recovery codes</Body>
      </View>
      <Button label={doneLabel} onPress={onDone} disabled={!saved} />
    </>
  );
}
