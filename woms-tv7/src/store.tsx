import { createContext, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_CALENDAR, DEFAULT_POLICY, PAUSE_REASON } from './constants';
import { SEED_CASES, DEMO_NOW } from './data/seed';
import { respondToQuote } from './services/portalService';
import { DEFAULT_WARN_RATIO } from './sla/engine';
import type { PolicyMap, SlaInstance, WarrantyCase, WorkCalendar } from './types';

interface Store {
  cases: WarrantyCase[];
  now: number;
  setNow: (t: number) => void;
  calendar: WorkCalendar;
  setCalendar: (fn: (c: WorkCalendar) => WorkCalendar) => void;
  policy: PolicyMap;
  setPolicyHours: (code: keyof PolicyMap, hours: number) => void;
  warnRatio: number;
  setWarnRatio: (r: number) => void;
  pauseSla: (caseCode: string) => void;
  resumeSla: (caseCode: string) => void;
  finishSla: (caseCode: string) => void;
  answerQuote: (caseCode: string, accept: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<WarrantyCase[]>(SEED_CASES);
  const [now, setNow] = useState(DEMO_NOW);
  const [calendar, setCalendarState] = useState<WorkCalendar>(DEFAULT_CALENDAR);
  const [policy, setPolicy] = useState<PolicyMap>(DEFAULT_POLICY);
  const [warnRatio, setWarnRatio] = useState(DEFAULT_WARN_RATIO);

  const patchLatest = (caseCode: string, fn: (s: SlaInstance) => SlaInstance) =>
    setCases((cs) => cs.map((c) => {
      if (c.code !== caseCode || c.sla.length === 0) return c;
      const sla = [...c.sla];
      sla[sla.length - 1] = fn(sla[sla.length - 1]);
      return { ...c, sla };
    }));

  const closeOpen = (s: SlaInstance): SlaInstance => ({ ...s, pauses: s.pauses.map((p) => (p.to === null ? { ...p, to: now } : p)) });

  const store: Store = {
    cases, now, setNow, calendar,
    setCalendar: (fn) => setCalendarState(fn),
    policy,
    setPolicyHours: (code, hours) => setPolicy((p) => ({ ...p, [code]: { ...p[code], hours } })),
    warnRatio, setWarnRatio,
    pauseSla: (code) => patchLatest(code, (s) =>
      s.end !== null || s.pauses.some((p) => p.to === null) ? s : { ...s, pauses: [...s.pauses, { from: now, to: null, reason: PAUSE_REASON[s.code] }] }),
    resumeSla: (code) => patchLatest(code, closeOpen),
    finishSla: (code) => patchLatest(code, (s) => (s.end !== null ? s : { ...closeOpen(s), end: now })),
    answerQuote: (code, accept) => setCases((cs) => cs.map((c) => (c.code === code ? respondToQuote(c, accept, now) : c))),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore phải nằm trong StoreProvider');
  return s;
}
