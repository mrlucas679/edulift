import { createContext, useContext, useEffect, useState } from 'react';

// Marks typed into the calculator. Memory only: gone when the app closes.
export type Row = { subject: string; percent: string };

const MarksContext = createContext<[Row[], React.Dispatch<React.SetStateAction<Row[]>>] | null>(null);

// Set by MarksProvider; sign-out calls it so the next person on this phone starts clean.
let forget: () => void = () => undefined;
export const forgetTypedMarks = () => forget();

export function MarksProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    forget = () => setRows([]);
  }, []);
  return <MarksContext.Provider value={[rows, setRows]}>{children}</MarksContext.Provider>;
}

export function useMarks() {
  const ctx = useContext(MarksContext);
  if (!ctx) throw new Error('useMarks must be used inside MarksProvider');
  return ctx;
}

// Learners type a subject's name ("English Home Language"); the API keys marks by id.
// Names match case-insensitively. Anything else is sent as typed, so the server can say which one is unknown.
export function resolveSubjects(rows: Row[], names: Map<string, string>): Row[] {
  const byName = new Map([...names].map(([id, name]) => [name.toLowerCase(), id]));
  return rows.map((r) => {
    const key = r.subject.trim().toLowerCase();
    return { ...r, subject: names.has(key) ? key : (byName.get(key) ?? r.subject.trim()) };
  });
}

export function toMarks(rows: Row[]): Record<string, number> {
  return Object.fromEntries(rows.filter((r) => r.percent !== '').map((r) => [r.subject, Number(r.percent)]));
}
