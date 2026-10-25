import { Pressable, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from './theme';

type Subject = { id: string; name: string; aliases?: string[] };

// Subjects that match what the learner typed, so they can pick the right name.
export function matchingSubjects(all: Subject[] | undefined, typed: string, limit = 5): Subject[] {
  const q = typed.trim().toLowerCase();
  if (!all || q.length < 2) return [];
  const exact = all.find((s) => s.name.toLowerCase() === q || s.id === q);
  if (exact) return [];
  return all
    .filter((s) => s.name.toLowerCase().includes(q) || (s.aliases ?? []).some((a) => a.toLowerCase().includes(q)))
    .slice(0, limit);
}

export function SubjectSuggestions({ all, typed, onPick }: {
  all: Subject[] | undefined;
  typed: string;
  onPick: (name: string) => void;
}) {
  const colors = useColors();
  const matches = matchingSubjects(all, typed);
  if (matches.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
      {matches.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          onPress={() => onPick(s.name)}
          style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink }}>{s.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}
