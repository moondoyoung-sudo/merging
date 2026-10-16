import { useCallback, useEffect, useRef, useState } from 'react';
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
  startStage,
} from '../game/rules';
import type { GameState } from '../game/types';
import type { GameRepository } from '../storage/repository';

export interface Fx {
  kind: 'pop' | 'spawn' | 'lock';
  id: number;
}

export function useGame(repo: GameRepository) {
  const [state, setState] = useState<GameState | null>(null);
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
      setState(saved ?? createInitialState());
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  useEffect(() => {
    if (state) void repo.save(state);
  }, [state, repo]);

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

      // 이번 동작으로 새로 "맞춘" 칸들 (블록이 사라지고 홀로그램 바닥이 됨)
      const fresh = next.solved.flatMap((done, i) => (done && !prev.solved[i] ? [i] : []));

      const effects: Record<number, Fx> = {};
      if (base) effects[base.index] = { kind: base.kind, id: ++fxId.current };
      for (const i of fresh) effects[i] = { kind: 'lock', id: ++fxId.current };
      setFx(effects);
      clearTimeout(fxTimer.current);
      fxTimer.current = setTimeout(() => setFx({}), 600);

      const doneBefore = new Set(completedWordIds(pz, prev.solved));
      const doneNow = completedWordIds(pz, next.solved);
      const newlyDone = pz.words.filter((w) => doneNow.includes(w.id) && !doneBefore.has(w.id));
      if (isSolved(pz, next.solved)) return; // 클리어 모달이 대신 안내
      if (newlyDone.length) showToast(`${newlyDone.map((w) => w.answer).join(', ')} 완성!`);
      else if (fresh.length) showToast('정답! 블록이 칸에 채워졌어요');
    },
    [showToast],
  );

  const generate = useCallback(
    (generator: GeneratorDef) => {
      if (!state || !puzzle) return;
      const r = applyGenerate(state, puzzle, generator, Math.random);
      if (!r.ok) {
        if (r.reason === 'no-space') showToast('빈 칸이 없어요');
        return;
      }
      commit(state, r.state, { index: r.placedAt, kind: 'spawn' });
    },
    [state, puzzle, commit, showToast],
  );

  const activate = useCallback(
    (index: number) => {
      if (!state || !puzzle) return;
      const r = applySpawn(state, puzzle, index, Math.random);
      if (!r.ok) {
        if (r.reason === 'no-space') showToast('빈 칸이 없어요');
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
      if (result === 'blocked') return showToast('이미 맞춘 칸이에요');
      if (result === 'maxed') showToast('더 이상 합칠 수 없는 최종 글자예요');
      if (next !== state) commit(state, next, result === 'merged' ? { index: to, kind: 'pop' } : undefined);
    },
    [state, puzzle, commit, showToast],
  );

  /** 현재 스테이지를 새 판(시작 글자만 있는 상태)으로 다시 시작. 만든 글자는 사라져요 */
  const restartStage = useCallback(() => {
    if (!state) return;
    setSelectedWordId(null);
    setState(startStage(state, state.stage));
  }, [state]);

  /** 다음 스테이지: 새 퍼즐이 만들어지고 판의 글자는 그대로 이어짐 */
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
    solved: state && puzzle ? isSolved(puzzle, state.solved) : false,
    generate,
    activate,
    move,
    restartStage,
    nextStage,
    selectWord,
  };
}
