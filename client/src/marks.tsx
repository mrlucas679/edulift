import { createContext, useContext, useState } from 'react';

// Marks typed into the calculator. Memory only: gone when the app closes.
export type Row = { subject: string; percent: string };

const MarksContext = createContext<[Row[], React.Dispatch<React.SetStateAction<Row[]>>] | null>(null);

export function MarksProvider({ children }: { children: React.ReactNode }) {
  const state = useState<Row[]>([]);
  return <MarksContext.Provider value={state}>{children}</MarksContext.Provider>;
}

export function useMarks() {
  const ctx = useContext(MarksContext);
  if (!ctx) throw new Error('useMarks must be used inside MarksProvider');
  return ctx;
}

export function toMarks(rows: Row[]): Record<string, number> {
  return Object.fromEntries(rows.filter((r) => r.percent !== '').map((r) => [r.subject, Number(r.percent)]));
}
