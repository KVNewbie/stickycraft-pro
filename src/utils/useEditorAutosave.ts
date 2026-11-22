import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type EditorExitRef = React.RefObject<(() => void) | null>;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// The caller memoizes just editable content. Opening an editor or moving the pointer
// across its canvas should neither create a note nor enqueue another disk write.
export function useEditorAutosave<T>(
  snapshot: T | null,
  write: (value: T) => Promise<void>,
  onClose: () => void,
  exitRef?: EditorExitRef
) {
  const latest = useRef(snapshot);
  const saved = useRef(snapshot);
  const writer = useRef(write);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const flush = useCallback((): Promise<boolean> => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return inFlight.current;
    if (latest.current === null || latest.current === saved.current) return Promise.resolve(true);

    const run = async () => {
      try {
        while (latest.current !== null && latest.current !== saved.current) {
          const next = latest.current;
          await writer.current(next);
          saved.current = next;
        }
        if (mounted.current) setStatus('saved');
        return true;
      } catch {
        if (mounted.current) setStatus('error');
        return false;
      } finally {
        inFlight.current = null;
      }
    };
    if (mounted.current) setStatus('saving');
    inFlight.current = run();
    return inFlight.current;
  }, []);

  useLayoutEffect(() => {
    writer.current = write;
    latest.current = snapshot;
    if (snapshot === null || snapshot === saved.current) return;
    setStatus('saving');
    // Keep a bounded interval even when the user types continuously.
    if (timer.current === null) timer.current = setTimeout(flush, 400);
  }, [snapshot, write, flush]);

  const close = async () => {
    if (await flush()) onClose();
  };
  useLayoutEffect(() => {
    if (!exitRef) return;
    exitRef.current = close;
    return () => { exitRef.current = null; };
  });

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush();
    });
    const onHide = () => { void flush(); };
    const onVisibility = () => { if (document.hidden) onHide(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', onHide);
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      mounted.current = false;
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('visibilitychange', onVisibility);
      }
      void flush();
    };
  }, [flush]);

  const label = { idle: '', saving: '저장 중…', saved: '저장됨', error: '저장 실패 · 다시 시도' }[status];
  return { flush, close, label, status };
}
