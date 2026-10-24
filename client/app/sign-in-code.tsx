import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ApiError } from '../src/api';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, ErrorNote, Heading, Screen } from '../src/ui';

const RESEND_SECONDS = 30;

// Masks the email as on the wireframe: first letter, then dots, then the domain.
function mask(email: string) {
  return email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
}

export default function SignInCode() {
  const { pendingEmail, checkCode, sendCode } = useSession();
  const colors = useColors();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // Session lost on reload: start over.
  if (!pendingEmail) return <Redirect href="/sign-in" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await checkCode(code);
      router.replace('/onboarding');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'code_expired') {
        router.replace('/sign-in');
        return;
      }
      setError(e);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await sendCode(pendingEmail as string);
      setWait(RESEND_SECONDS);
    } catch (e) {
      setError(e);
    }
  }

  const digits = code.split('');
  return (
    <Screen>
      <Heading>Enter your code</Heading>
      <Body muted>We sent a 6-digit code to {mask(pendingEmail)}. Check spam if you can’t see it.</Body>
      <Pressable accessibilityLabel="6-digit code" onPress={() => undefined} style={{ flexDirection: 'row', gap: space.sm }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              minHeight: touchTarget,
              borderWidth: 1,
              borderRadius: 8,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: text.h3, color: colors.ink }}>{digits[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        accessibilityLabel="Type the 6-digit code"
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        onSubmitEditing={submit}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        autoFocus
      />
      <ErrorNote error={error} />
      <Button label="Continue" onPress={submit} busy={busy} disabled={code.length !== 6} />
      <Pressable accessibilityRole="button" onPress={resend} disabled={wait > 0} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>
          {wait > 0 ? `Resend code in 0:${String(wait).padStart(2, '0')}` : 'Resend code'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.replace('/sign-in')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>Use a different email</Text>
      </Pressable>
    </Screen>
  );
}
