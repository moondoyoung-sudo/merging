import { describe, expect, it } from 'vitest';
import { msUntilNextAp, refillAp, regenAp, spendAp } from './ap';
import { AP_MAX, AP_REGEN_MS, CHAINS, CHAIN_IDS, COLS, GENERATORS, ROWS, SPAWN_RULES } from './config';
import { generatorLabel, generatorLetters, generatorProbabilities, rollGeneratorLetter } from './generators';
import { compilePuzzle } from './puzzle';
import { mulberry32 } from './random';
import {
  applyDrop,
  applyGenerate,
  applySpawn,
  completedWordIds,
  getSpawnDrops,
  itemForLetter,
  isLockedAt,
  isSolved,
  sanitizeState,
  createInitialState,
  labelOf,
} from './rules';
import type { GameState, Item } from './types';

const T0 = 1_000_000;

/*  0 1 2      C A B
 *  . 11 .     . D .   (AD: 세로, (0,1)에서 시작) */
const puzzle = compilePuzzle({
  id: 't',
  title: 'test',
  words: [
    { answer: 'CAB', row: 0, col: 0, dir: 'across', clue: '', ko: '' },
    { answer: 'AD', row: 0, col: 1, dir: 'down', clue: '', ko: '' },
  ],
});
const A = (level: number): Item => ({ chain: 'A', level }); // A=0 B=1 C=2 D=3

const empty = (): GameState => ({
  stage: 1,
  seed: 1,
  board: Array(COLS * ROWS).fill(null),
  ap: AP_MAX,
  apUpdatedAt: T0,
  apUsed: 0,
  merges: 0,
});
const put = (s: GameState, i: number, item: Item): GameState => {
  const board = s.board.slice();
  board[i] = item;
  return { ...s, board };
};

describe('고정(정답) 규칙', () => {
  it('정답 글자가 정답 칸에 있으면 고정, 틀린 글자는 고정 안 됨', () => {
    expect(isLockedAt(puzzle, put(empty(), 1, A(0)).board, 1)).toBe(true); // 칸1 정답 A
    expect(isLockedAt(puzzle, put(empty(), 1, A(1)).board, 1)).toBe(false); // B는 오답
    expect(isLockedAt(puzzle, put(empty(), 50, A(0)).board, 50)).toBe(false); // 정답 칸 아님
  });

  it('고정된 글자는 옮길 수 없고, 고정된 칸에는 놓을 수 없다', () => {
    const s = put(put(empty(), 1, A(0)), 30, A(1));
    expect(applyDrop(s, puzzle, 1, 40).result).toBe('noop'); // 고정 글자 이동 불가
    expect(applyDrop(s, puzzle, 30, 1).result).toBe('blocked'); // 고정 칸에 놓기 불가
    expect(applyDrop(s, puzzle, 30, 1).state).toBe(s);
  });

  it('이동해서 정답 칸에 맞는 글자가 들어가면 고정된다', () => {
    const s = put(empty(), 30, A(2)); // C
    const r = applyDrop(s, puzzle, 30, 0); // 칸0 정답 C
    expect(r.result).toBe('moved');
    expect(isLockedAt(puzzle, r.state.board, 0)).toBe(true);
  });

  it('머지 결과가 정답이면 고정된다', () => {
    let s = put(empty(), 2, A(0)); // 칸2 정답은 B인데 A가 있음 (오답, 이동 가능)
    s = put(s, 30, A(0));
    const r = applyDrop(s, puzzle, 30, 2); // A+A=B
    expect(r.result).toBe('merged');
    expect(labelOf(r.state.board[2]!)).toBe('B');
    expect(isLockedAt(puzzle, r.state.board, 2)).toBe(true);
  });

  it('오답 글자는 정답 칸에서도 자유롭게 움직인다', () => {
    const s = put(empty(), 2, A(0));
    expect(applyDrop(s, puzzle, 2, 40).result).toBe('moved');
  });

  it('모든 정답 칸이 고정되면 퍼즐 클리어, 단어별 완성도 계산', () => {
    let s = empty();
    s = put(s, 0, A(2)); // C
    s = put(s, 1, A(0)); // A
    s = put(s, 2, A(1)); // B
    expect(completedWordIds(puzzle, s.board)).toEqual(['1-across']);
    expect(isSolved(puzzle, s.board)).toBe(false);
    s = put(s, 11, A(3)); // D
    expect(isSolved(puzzle, s.board)).toBe(true);
  });
});

describe('생성기 버튼 (구간 + 확률)', () => {
  const gen = GENERATORS[0]!; // A~G
  const range = (g: (typeof GENERATORS)[number]) => generatorLetters(g).join('');

  it('버튼은 5개: A~G, H~K, L~P, Q~V, W~Z 이고 A~Z를 빠짐없이 한 번씩 덮는다', () => {
    expect(GENERATORS.map(generatorLabel)).toEqual(['A~G', 'H~K', 'L~P', 'Q~V', 'W~Z']);
    expect(GENERATORS.map(range).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('확률은 합이 1이고, 앞글자가 가장 높으며 뒤로 갈수록 줄어든다 (마지막 글자는 거의 안 나옴)', () => {
    for (const g of GENERATORS) {
      const p = generatorProbabilities(g);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      for (let i = 1; i < p.length; i++) expect(p[i]!).toBeLessThan(p[i - 1]!);
      expect(p[0]!).toBeGreaterThan(0.5);
      expect(p[p.length - 1]!).toBeLessThan(0.05);
    }
  });

  it('W~Z: 실제로 많이 뽑아 보면 W > X > Y > Z 순이고 Z는 드물다', () => {
    const wz = GENERATORS[4]!;
    const rng = mulberry32(12345);
    const count: Record<string, number> = { W: 0, X: 0, Y: 0, Z: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) count[rollGeneratorLetter(wz, rng)]!++;
    expect(count.W!).toBeGreaterThan(count.X!);
    expect(count.X!).toBeGreaterThan(count.Y!);
    expect(count.Y!).toBeGreaterThan(count.Z!);
    expect(count.Z!).toBeGreaterThan(0); // 아주 가끔은 나옴
    expect(count.Z! / N).toBeLessThan(0.06);
    expect(count.W! / N).toBeGreaterThan(0.55);
  });

  it('어떤 난수가 와도 구간 밖 글자는 나오지 않는다', () => {
    for (const g of GENERATORS) {
      const letters = new Set(generatorLetters(g));
      for (const r of [0, 0.25, 0.5, 0.75, 0.999999, 0.9999999999]) {
        expect(letters.has(rollGeneratorLetter(g, () => r))).toBe(true);
      }
    }
  });

  it('누르면 구간 안의 글자 1개가 나오고 AP가 소모·누적된다', () => {
    const rng = mulberry32(7);
    for (const g of GENERATORS) {
      const r = applyGenerate(empty(), puzzle, g, T0, rng);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(generatorLetters(g)).toContain(labelOf(r.state.board[r.placedAt]!));
        expect(r.state.ap).toBe(AP_MAX - g.cost);
        expect(r.state.apUsed).toBe(g.cost);
      }
    }
  });

  it('새 아이템은 정답 칸이 아닌 빈 칸을 우선 사용', () => {
    let s = empty();
    s = { ...s, board: s.board.map(() => A(1)) };
    s = { ...s, board: s.board.map((c, i) => (i === 0 || i === 3 ? null : c)) }; // 0=정답칸, 3=일반칸
    const r = applyGenerate(s, puzzle, gen, T0);
    expect(r.ok && r.placedAt).toBe(3);
  });

  it('정답 칸밖에 빈 칸이 없으면 정답 칸도 사용', () => {
    let s = empty();
    s = { ...s, board: s.board.map((_, i) => (i === 0 ? null : A(1))) };
    const r = applyGenerate(s, puzzle, gen, T0);
    expect(r.ok && r.placedAt).toBe(0);
  });

  it('AP가 부족하면 실패, 빈 칸이 없어도 실패', () => {
    expect(applyGenerate({ ...empty(), ap: 0 }, puzzle, gen, T0)).toEqual({ ok: false, reason: 'no-ap' });
    const full = { ...empty(), board: empty().board.map(() => A(1)) };
    expect(applyGenerate(full, puzzle, gen, T0)).toEqual({ ok: false, reason: 'no-space' });
  });

  it('더블클릭 생성 규칙은 꺼져 있다 (생성은 생성기 버튼으로만)', () => {
    expect(SPAWN_RULES).toHaveLength(0);
    expect(getSpawnDrops(A(2))).toBeNull();
    expect(applySpawn(put(empty(), 40, A(2)), puzzle, 40, T0)).toEqual({ ok: false, reason: 'not-spawnable' });
  });
});

describe('알파벳 체인 (A~Z 한 줄)', () => {
  it('체인은 하나이고 A~Z 26글자가 순서대로 들어있다', () => {
    expect(CHAIN_IDS).toEqual(['A']);
    expect(CHAINS.A.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('중간에 막히지 않고 Y+Y=Z까지 계속 머지되며, Z는 마지막', () => {
    for (let level = 0; level < 25; level++) {
      const s = put(put(empty(), 50, A(level)), 51, A(level)); // 정답 칸이 아닌 곳에서
      const r = applyDrop(s, puzzle, 51, 50);
      expect(r.result, `level ${level}`).toBe('merged');
      expect(r.state.board[50]).toEqual(A(level + 1));
    }
    const z = put(put(empty(), 30, A(25)), 31, A(25));
    expect(applyDrop(z, puzzle, 30, 31).result).toBe('maxed');
  });

  it('생성기 글자는 모두 체인 안에 있다', () => {
    for (const g of GENERATORS) for (const l of generatorLetters(g)) expect(itemForLetter(l)).not.toBeNull();
    expect(itemForLetter('H')).toEqual({ chain: 'A', level: 7 });
    expect(itemForLetter('1')).toBeNull();
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
  it('총 사용량은 쓸 때마다 누적되고, 충전해도 줄지 않는다', () => {
    let s: GameState = empty();
    s = spendAp(s, 3, T0)!;
    s = spendAp(s, 2, T0)!;
    expect(s.apUsed).toBe(5);
    s = refillAp(s, T0 + 1000);
    expect(s.apUsed).toBe(5);
    s = spendAp(s, 1, T0 + 2000)!;
    expect(s.apUsed).toBe(6);
    expect(spendAp({ ...s, ap: 0 }, 1, T0 + 2000)).toBeNull(); // 실패하면 누적 안 됨
  });
  it('충전 버튼: 대가 없이 100까지 채움, 이미 가득이면 그대로', () => {
    const low = { ...empty(), ap: 7, apUpdatedAt: T0 - 5000 };
    const r = refillAp(low, T0);
    expect(r.ap).toBe(AP_MAX);
    expect(r.apUsed).toBe(low.apUsed);
    expect(msUntilNextAp(r, T0)).toBeNull();
    expect(refillAp(r, T0)).toBe(r);
  });
});

describe('저장 데이터 검증', () => {
  it('정상 데이터는 통과, 깨진 데이터는 null', () => {
    expect(sanitizeState(createInitialState(T0))).not.toBeNull();
    expect(sanitizeState(createInitialState(T0))?.apUsed).toBe(0);
    expect(sanitizeState({ ...empty(), stage: 99 })).toBeNull();
    const bad = empty();
    bad.board[0] = { chain: 'A', level: 99 };
    expect(sanitizeState(bad)).toBeNull();
  });
});
