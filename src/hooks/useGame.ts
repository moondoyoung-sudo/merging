import { useCallback, useEffect, useRef, useState } from 'react';
import { msUntilNextAp, refillAp, regenAp } from '../game/ap';
import type { GeneratorDef } from '../game/config';
import { getPuzzle } from '../game/stages';
import {
  advanceStage,
  applyDrop,
  applyGenerate,
  applySpawn,
  completedWordIds,
  createInitialState,
  isSolved,
  lockedMask,
  startStage,
} from '../game/rules';
import type { ActionFail } from '../game/rules';
import type { GameState } from '../game/types';
import type { GameRepository } from '../storage/repository';

export interface Fx {
  kind: 'pop' | 'spawn' | 'lock';
  id: number;
}

const FAIL_MESSAGE: Record<Exclude<ActionFail, 'not-spawnable'>, string> = {
  'no-ap': 'AP가 부족해요',
  'no-space': '빈 칸이 없어요',
};

export function useGame(repo: GameRepository) {
  const [state, setState] = useState<GameState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fx, setFx] = useState<Record<number, Fx>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const fxId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const puzzle = state ? getPuzzle(state.stage, state.seed) : null;

  /* 불러오기 / 저장 */
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
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /** 상태를 바꾸고, 효과(애니메이션)·고정/단어 완성 안내를 한 번에 처리 */
  const commit = useCallback(
    (prev: GameState, next: GameState, base?: { index: number; kind: 'pop' | 'spawn' }) => {
      setState(next);
      const pz = getPuzzle(next.stage, next.seed);

      const before = lockedMask(pz, prev.board);
      const after = lockedMask(pz, next.board);
      const fresh = after.flatMap((locked, i) => (locked && !before[i] ? [i] : []));

      const effects: Record<number, Fx> = {};
      if (base) effects[base.index] = { kind: base.kind, id: ++fxId.current };
      for (const i of fresh) effects[i] = { kind: 'lock', id: ++fxId.current };
      setFx(effects);
      clearTimeout(fxTimer.current);
      fxTimer.current = setTimeout(() => setFx({}), 600);

      const doneBefore = new Set(completedWordIds(pz, prev.board));
      const newlyDone = pz.words.filter(
        (w) => completedWordIds(pz, next.board).includes(w.id) && !doneBefore.has(w.id),
      );
      if (isSolved(pz, next.board)) return; // 클리어 모달이 대신 안내
      if (newlyDone.length) showToast(`${newlyDone.map((w) => w.answer).join(', ')} 완성!`);
      else if (fresh.length) showToast('정답! 칸에 고정됐어요');
    },
    [showToast],
  );

  const generate = useCallback(
    (generator: GeneratorDef) => {
      if (!state || !puzzle) return;
      const r = applyGenerate(state, puzzle, generator, Date.now(), Math.random);
      if (!r.ok) {
        if (r.reason !== 'not-spawnable') showToast(FAIL_MESSAGE[r.reason]);
        return;
      }
      commit(state, r.state, { index: r.placedAt, kind: 'spawn' });
    },
    [state, puzzle, commit, showToast],
  );

  /** AP 충전 버튼: 대가 없이 100까지 */
  const refill = useCallback(() => {
    if (!state) return;
    const next = refillAp(state, Date.now());
    if (next === state) return showToast('AP가 이미 가득 차 있어요');
    setState(next);
    showToast('AP가 가득 찼어요');
  }, [state, showToast]);

  const activate = useCallback(
    (index: number) => {
      if (!state || !puzzle) return;
      const r = applySpawn(state, puzzle, index, Date.now(), Math.random);
      if (!r.ok) {
        if (r.reason !== 'not-spawnable') showToast(FAIL_MESSAGE[r.reason]);
        return;
      }
      commit(state, r.state, { index: r.placedAt, kind: 'spawn' });
    },
    [state, puzzle, commit, showToast],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (!state || !puzzle) return;
      const { state: next, result } = applyDrop(state, puzzle, from, to);
      if (result === 'blocked') return showToast('고정된 칸에는 놓을 수 없어요');
      if (result === 'maxed') showToast('더 이상 합칠 수 없는 최종 글자예요');
      if (next !== state) commit(state, next, result === 'merged' ? { index: to, kind: 'pop' } : undefined);
    },
    [state, puzzle, commit, showToast],
  );

  /** 현재 스테이지를 새 판으로 다시 시작 (AP는 그대로, 퍼즐은 그대로) */
  const restartStage = useCallback(() => {
    if (!state) return;
    setSelectedWordId(null);
    setState(startStage(state, state.stage));
  }, [state]);

  /** 다음 스테이지 (30을 깼다면 새 퍼즐로 처음부터) */
  const nextStage = useCallback(() => {
    if (!state) return;
    setSelectedWordId(null);
    setState(advanceStage(state));
  }, [state]);

  const selectWord = useCallback(
    (id: string) => setSelectedWordId((cur) => (cur === id ? null : id)),
    [],
  );

  return {
    state,
    puzzle,
    fx,
    toast,
    selectedWordId,
    solved: state && puzzle ? isSolved(puzzle, state.board) : false,
    msUntilNext: state ? msUntilNextAp(state, now) : null,
    generate,
    refill,
    activate,
    move,
    restartStage,
    nextStage,
    selectWord,
  };
}
