import { router } from 'expo-router';

import { isOpen, shortDate } from './dates';
import type { Matched, Opportunity } from './opportunities';
import { KIND_LABELS } from './opportunities';
import { Body, Card, CardTop, Check, Chips, Title } from './ui';

export const VERDICT_TEXT = {
  qualifies: 'Meets the criteria we could check',
  may_qualify: 'You may qualify. Confirm with the provider.',
} as const;

export function KindChips({
  kinds,
  value,
  onChange,
  labels = KIND_LABELS,
}: {
  kinds: string[];
  value: string | null;
  onChange: (kind: string | null) => void;
  labels?: Record<string, string>;
}) {
  const options = [{ id: 'all', label: 'All' }, ...kinds.map((k) => ({ id: k, label: labels[k] ?? k }))];
  return <Chips options={options} value={value ?? 'all'} onChange={(id) => onChange(id === 'all' ? null : id)} />;
}

export const checkResult = (status: 'met' | 'not_met' | 'unknown') =>
  status === 'met' ? 'pass' : status === 'not_met' ? 'fail' : 'unknown';

export const checkName = (check: string) => check.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// The tag on a card: how well it matches, or whether it's open.
function tagFor(item: Opportunity, matched?: Matched): { label: string; filled: boolean } {
  if (!isOpen(item.closes_on)) return { label: 'Closed', filled: false };
  if (matched?.verdict === 'qualifies') return { label: 'Likely match', filled: true };
  if (matched?.verdict === 'may_qualify') return { label: 'May qualify', filled: false };
  if (item.kind === 'loan') return { label: 'Loan', filled: false };
  return { label: item.closes_on ? 'Open' : 'Check dates', filled: false };
}

export function OpportunityCard({ item, matched }: { item: Opportunity | Matched; matched?: Matched }) {
  const tag = tagFor(item, matched);
  return (
    <Card onPress={() => router.push(`/opportunity/${item.id}`)} label={`Open ${item.name}`}>
      <CardTop title={item.name} pill={tag.label} filled={tag.filled} />
      <Body muted small>
        {item.provider} · {item.closes_on ? `closes ${shortDate(item.closes_on)}` : 'closing date not published'}
      </Body>
      {matched?.checks.slice(0, 2).map((c) => (
        <Check key={c.check} result={checkResult(c.status)} label={checkName(c.check)} />
      ))}
    </Card>
  );
}

export const scamNotice = 'Real bursaries and jobs are free to apply for. Never pay anyone to apply, and never share banking details.';

export function ScamNotice({ title = 'Never pay to apply', body = scamNotice }: { title?: string; body?: string }) {
  return (
    <Card muted>
      <Title>{title}</Title>
      <Body muted small>{body}</Body>
    </Card>
  );
}
