import { PAUSE_LABEL, PAUSE_OPTIONS } from '../constants';
import type { PauseKind, SlaInstance, WarrantyCase } from '../types';

const patchLatest = (c: WarrantyCase, fn: (s: SlaInstance) => SlaInstance): WarrantyCase => {
  if (c.sla.length === 0) return c;
  const sla = [...c.sla];
  sla[sla.length - 1] = fn(sla[sla.length - 1]);
  return { ...c, sla };
};

const closeOpen = (s: SlaInstance, now: number): SlaInstance => ({ ...s, pauses: s.pauses.map((p) => (p.to === null ? { ...p, to: now } : p)) });

/** Tạm dừng SLA hiện tại. Không làm gì nếu đã hoàn tất hoặc đang tạm dừng. Lý do không hợp lệ thì dùng lý do mặc định của mốc. */
export function pauseLatest(c: WarrantyCase, kind: PauseKind | undefined, now: number): WarrantyCase {
  return patchLatest(c, (s) => {
    if (s.end !== null || s.pauses.some((p) => p.to === null)) return s;
    const k = kind && PAUSE_OPTIONS[s.code].includes(kind) ? kind : PAUSE_OPTIONS[s.code][0];
    return { ...s, pauses: [...s.pauses, { from: now, to: null, kind: k, reason: PAUSE_LABEL[k] }] };
  });
}

export const resumeLatest = (c: WarrantyCase, now: number): WarrantyCase => patchLatest(c, (s) => closeOpen(s, now));

export const finishLatest = (c: WarrantyCase, now: number): WarrantyCase =>
  patchLatest(c, (s) => (s.end !== null ? s : { ...closeOpen(s, now), end: now }));
