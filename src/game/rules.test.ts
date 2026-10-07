import { describe, expect, it } from 'vitest';
import { AP_MAX, AP_REGEN_MS, COLS, ROWS } from './config';
import { msUntilNextAp, regenAp, spendAp } from './ap';
import {
  applyDrop,
  applyGenerate,
  applySpawn,
  createInitialState,
  getSpawnDrops,
  sanitizeState,
} from './rules';
import type { GameState, Item } from './types';

const T0 = 1_000_000;
const empty = (): GameState => ({
  board: Array(COLS * ROWS).fill(null),
  ap: AP_MAX,
  apUpdatedAt: T0,
  merges: 0,
});
const put = (s: GameState, i: number, item: Item): GameState => {
  const board = s.board.slice();
  board[i] = item;
  return { ...s, board };
};

describe('머지', () => {
  it('같은 글자끼리 합치면 한 단계 올라간다', () => {
    let s = put(empty(), 0, { chain: 'A', level: 0 });
    s = put(s, 1, { chain: 'A', level: 0 });
    const r = applyDrop(s, 0, 1);
    expect(r.result).toBe('merged');
    expect(r.state.board[0]).toBeNull();
    expect(r.state.board[1]).toEqual({ chain: 'A', level: 1 });
  });
  it('체인 마지막 단계는 합쳐지지 않고 자리만 바뀐다', () => {
    let s = put(empty(), 0, { chain: 'D', level: 5 });
    s = put(s, 1, { chain: 'D', level: 5 });
    expect(applyDrop(s, 0, 1).result).toBe('maxed');
  });
  it('다른 글자끼리는 교환, 빈 칸은 이동', () => {
    let s = put(empty(), 0, { chain: 'A', level: 0 });
    s = put(s, 1, { chain: 'B', level: 0 });
    expect(applyDrop(s, 0, 1).result).toBe('swapped');
    expect(applyDrop(s, 0, 2).result).toBe('moved');
  });
});

describe('더블클릭 생성', () => {
  it('c 이상은 ㄱ 또는 ㅏ', () => {
    for (const level of [2, 3, 4, 5, 6]) {
      const d = getSpawnDrops({ chain: 'A', level });
      expect(d?.map((x) => `${x.chain}${x.level}`).sort()).toEqual(['B0', 'C0']);
    }
    expect(getSpawnDrops({ chain: 'A', level: 1 })).toBeNull();
  });
  it('ㅕ 이상은 1', () => {
    for (const level of [3, 4, 5]) {
      expect(getSpawnDrops({ chain: 'C', level })).toEqual([{ chain: 'D', level: 0 }]);
    }
    expect(getSpawnDrops({ chain: 'C', level: 2 })).toBeNull();
  });
  it('AP를 1 쓰고 원본은 남는다', () => {
    const s = put(empty(), 10, { chain: 'A', level: 2 });
    const r = applySpawn(s, 10, T0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.ap).toBe(AP_MAX - 1);
      expect(r.state.board[10]).toEqual({ chain: 'A', level: 2 });
      expect(r.state.board.filter(Boolean)).toHaveLength(2);
    }
  });
  it('AP가 없으면 실패', () => {
    const s = { ...put(empty(), 10, { chain: 'A', level: 2 }), ap: 0 };
    expect(applySpawn(s, 10, T0)).toEqual({ ok: false, reason: 'no-ap' });
  });
  it('빈 칸이 없으면 실패', () => {
    const s = createInitialState(T0);
    const full = { ...s, board: s.board.map(() => ({ chain: 'A', level: 2 }) as Item) };
    expect(applySpawn(full, 0, T0)).toEqual({ ok: false, reason: 'no-space' });
    expect(applyGenerate(full, T0)).toEqual({ ok: false, reason: 'no-space' });
  });
});

describe('AP', () => {
  it('1분에 1개 충전, 최대 100', () => {
    const s = { ...empty(), ap: 10 };
    expect(regenAp(s, T0 + AP_REGEN_MS * 5 + 1000).ap).toBe(15);
    expect(regenAp(s, T0 + AP_REGEN_MS * 500).ap).toBe(AP_MAX);
  });
  it('가득 찬 상태에서 쓰면 그 시점부터 충전 시작', () => {
    const s = spendAp(empty(), 1, T0 + 30_000)!;
    expect(s.ap).toBe(99);
    expect(msUntilNextAp(s, T0 + 30_000)).toBe(AP_REGEN_MS);
  });
  it('남은 시간 계산', () => {
    const s = { ...empty(), ap: 50, apUpdatedAt: T0 };
    expect(msUntilNextAp(s, T0 + 20_000)).toBe(40_000);
    expect(msUntilNextAp(empty(), T0)).toBeNull();
  });
});

describe('저장 데이터 검증', () => {
  it('정상 데이터는 통과, 깨진 데이터는 null', () => {
    expect(sanitizeState(createInitialState(T0))).not.toBeNull();
    expect(sanitizeState({ board: [], ap: 1, apUpdatedAt: 1 })).toBeNull();
    const bad = empty();
    bad.board[0] = { chain: 'A', level: 99 };
    expect(sanitizeState(bad)).toBeNull();
  });
});
