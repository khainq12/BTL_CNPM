import { useEffect, useState } from 'react';

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Tải dữ liệu bất đồng bộ, tải lại khi deps đổi. Giữ dữ liệu cũ trong lúc tải để không nháy trang. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], initial: T | null = null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: initial, error: null });
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => { if (alive) setState({ data, error: null }); },
      (e: unknown) => { if (alive) setState((s) => ({ data: s.data, error: errorMessage(e) })); },
    );
    return () => { alive = false; };
  }, deps);
  return state;
}
