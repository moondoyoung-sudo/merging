import { useCallback, useEffect, useRef, useState } from 'react';
import { msUntilNextAp, regenAp } from '../game/ap';
import { applyDrop, applyGenerate, applySpawn, createInitialState } from '../game/rules';
import type { ActionFail } from '../game/rules';
import type { GameState } from '../game/types';
import type { GameRepository } from '../storage/repository';

export interface Fx {
  index: number;
  kind: 'pop' | 'spawn';
  id: number;
}

const FAIL_MESSAGE: Record<Exclude<ActionFail, 'not-spawnable'>, string> = {
  'no-ap': 'AP가 부족해요',
  'no-space': '빈 칸이 없어요',
};

export function useGame(repo: GameRepository) {
  const [state, setState] = useState<GameState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fx, setFx] = useState<Fx | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fxId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* 불러오기 */
  useEffect(() => {
    let alive = true;
    void repo.load().then((saved) => {
      if (!alive) return;
      const t = Date.now();
      setState(regenAp(saved ?? createInitialState(t), t));
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  /* 저장 */
  useEffect(() => {
    if (state) void repo.save(state);
  }, [state, repo]);

  /* 1초마다 시계 + AP 충전, 탭 복귀 시에도 즉시 갱신 */
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setState((prev) => (prev ? regenAp(prev, t) : prev));
    };
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const flash = (index: number, kind: Fx['kind']) =>
    setFx({ index, kind, id: ++fxId.current });

  const generate = useCallback(() => {
    if (!state) return;
    const r = applyGenerate(state, Date.now(), Math.random);
    if (!r.ok) {
      if (r.reason !== 'not-spawnable') showToast(FAIL_MESSAGE[r.reason]);
      return;
    }
    setState(r.state);
    flash(r.placedAt, 'spawn');
  }, [state, showToast]);

  const activate = useCallback(
    (index: number) => {
      if (!state) return;
      const r = applySpawn(state, index, Date.now(), Math.random);
      if (!r.ok) {
        if (r.reason !== 'not-spawnable') showToast(FAIL_MESSAGE[r.reason]);
        return;
      }
      setState(r.state);
      flash(r.placedAt, 'spawn');
    },
    [state, showToast],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (!state) return;
      const { state: next, result } = applyDrop(state, from, to);
      if (next !== state) setState(next);
      if (result === 'merged') flash(to, 'pop');
      if (result === 'maxed') showToast('더 이상 합칠 수 없는 최종 단계예요');
    },
    [state, showToast],
  );

  const reset = useCallback(() => {
    setState(createInitialState(Date.now()));
  }, []);

  return {
    state,
    fx,
    toast,
    msUntilNext: state ? msUntilNextAp(state, now) : null,
    generate,
    activate,
    move,
    reset,
  };
}
