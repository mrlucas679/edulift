import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';

import { useAsk, type Answer } from '../../src/assist';
import { t } from '../../src/i18n';
import { useSession } from '../../src/session';
import { font, radius, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, Chips, ErrorNote, Screen } from '../../src/ui';

type Message =
  | { id: number; from: 'you'; text: string }
  | { id: number; from: 'ai'; answer: Answer }
  | { id: number; from: 'ai'; error: unknown };

const STARTERS = [
  'Which bursaries are open for IT?',
  'How do I apply for NSFAS?',
  'Can I study IT with maths literacy?',
].map((q) => ({ id: q, label: q }));

function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

function Bubble({ mine, children }: { mine?: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        gap: space.xs,
        padding: space.md,
        borderRadius: radius.card * 2,
        backgroundColor: mine ? colors.accent : colors.muted,
      }}
    >
      {children}
    </View>
  );
}

function Reply({ answer }: { answer: Answer }) {
  return (
    <Bubble>
      <Body>{answer.answer}</Body>
      {answer.cited.map((c) => {
        const host = safeHost(c.url);
        return host && c.url ? (
          <Button key={c.id} label={c.title} sub={host} variant="link" onPress={() => Linking.openURL(c.url as string)} />
        ) : null;
      })}
      <Body muted small>
        {answer.provider === 'bedrock' ? 'Written by AI from our records. Check with the institution.' : 'Standard answer from our records.'}
      </Body>
    </Bubble>
  );
}

// One question per message; each answer comes from our records, so earlier messages aren't sent along.
export default function AskAiScreen() {
  const colors = useColors();
  const { status, accessToken } = useSession();
  const { about } = useLocalSearchParams<{ about?: string }>();
  const ask = useAsk(accessToken);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const nextId = useRef(0);
  const signedIn = status === 'signed-in';

  const send = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || ask.isPending) return;
    setDraft('');
    setMessages((m) => [...m, { id: nextId.current++, from: 'you', text: q }]);
    try {
      const answer = await ask.mutateAsync(q);
      setMessages((m) => [...m, { id: nextId.current++, from: 'ai', answer }]);
    } catch (error) {
      setMessages((m) => [...m, { id: nextId.current++, from: 'ai', error }]);
    }
  };

  // Opened from a course: ask about it straight away, once per course.
  const askedAbout = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!about || !signedIn || askedAbout.current === about) return;
    askedAbout.current = about;
    send(`Tell me about ${about.slice(0, 200)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, signedIn]);

  if (!signedIn) {
    return (
      <Screen title="Ask AI" back={false} footer={<Button label="Sign in or try the demo" onPress={() => router.push('/sign-in')} />}>
        <Body muted>Sign in to chat about courses, funding and work.</Body>
      </Screen>
    );
  }

  const canSend = draft.trim().length >= 3 && !ask.isPending;
  return (
    <Screen
      title="Ask AI"
      back={false}
      stickToBottom
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
          <TextInput
            accessibilityLabel="Your question"
            placeholder="Ask about courses, funding or work"
            placeholderTextColor={colors.inkMuted}
            value={draft}
            onChangeText={setDraft}
            onKeyPress={(e) => {
              // Enter sends on a keyboard; Shift+Enter adds a new line.
              const key = e.nativeEvent as { key: string; shiftKey?: boolean };
              if (key.key === 'Enter' && !key.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            returnKeyType="send"
            maxLength={300}
            multiline
            style={{
              flex: 1,
              minHeight: touchTarget,
              maxHeight: 120,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderWidth: 1,
              borderRadius: radius.card * 2,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.ink,
              fontFamily: font.regular,
              fontSize: text.body,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => send(draft)}
            style={{
              width: touchTarget,
              height: touchTarget,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? colors.accent : colors.muted,
            }}
          >
            <Ionicons name="arrow-up" size={22} color={canSend ? colors.onAccent : colors.inkMuted} />
          </Pressable>
        </View>
      }
    >
      <Body muted small>{t('askDisclaimer')}</Body>
      {messages.length === 0 && (
        <>
          <Body>Ask anything about courses, bursaries, NSFAS or work. Try one of these:</Body>
          <Chips options={STARTERS} value={null} onChange={(q) => send(q)} wrap />
        </>
      )}
      {messages.map((m) =>
        m.from === 'you' ? (
          <Bubble key={m.id} mine>
            <Text style={{ color: colors.onAccent, fontFamily: font.regular, fontSize: text.body }}>{m.text}</Text>
          </Bubble>
        ) : 'answer' in m ? (
          <Reply key={m.id} answer={m.answer} />
        ) : (
          <Bubble key={m.id}>
            <ErrorNote error={m.error} />
          </Bubble>
        ),
      )}
      {ask.isPending && (
        <Bubble>
          <Body muted>Thinking…</Body>
        </Bubble>
      )}
    </Screen>
  );
}
