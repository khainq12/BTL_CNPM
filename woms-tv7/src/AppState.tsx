import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';

interface AppCtx {
  /** Tăng sau mỗi thay đổi dữ liệu để các trang tải lại. */
  version: number;
  refresh: () => void;
  /** Giờ hệ thống mẫu (chỉ có ý nghĩa với bản mock). Bản HTTP dùng giờ thật. */
  now: number;
  setNow: (t: number) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [now, setNowState] = useState(() => api.dev?.getNow() ?? Date.now());
  const value: AppCtx = {
    version, now,
    refresh: () => setVersion((v) => v + 1),
    setNow: (t) => { api.dev?.setNow(t); setNowState(t); setVersion((v) => v + 1); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp phải nằm trong AppProvider');
  return c;
}
