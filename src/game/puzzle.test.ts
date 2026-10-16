import { describe, expect, it } from 'vitest';
import { CHAINS, CHAIN_IDS, COLS, ROWS, START_ITEMS, STAGE_COUNT } from './config';
import type { Puzzle } from './puzzle';
import { advanceStage, createBoard, createInitialState, isLockedAt, itemForLetter, startStage } from './rules';
import { generateStageDef, getPuzzle, stageSpec } from './stages';
import { WORD_BANK } from './words';

const LETTERS = new Set(CHAIN_IDS.flatMap((c) => [...CHAINS[c]]));
const SEEDS = [1, 2, 3, 12345];

/** 판 위의 2칸 이상 연속 글자 줄을 "WORD@row,col,dir" 집합으로 */
function foundRuns(p: Puzzle): Set<string> {
  const found = new Set<string>();
  const at = (r: number, c: number) => p.answers[r * COLS + c];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!at(r, c)) { c++; continue; }
      const s = c; let str = '';
      while (c < COLS && at(r, c)) str += at(r, c++);
      if (str.length >= 2) found.add(`${str}@${r},${s},across`);
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!at(r, c)) { r++; continue; }
      const s = r; let str = '';
      while (r < ROWS && at(r, c)) str += at(r++, c);
      if (str.length >= 2) found.add(`${str}@${s},${c},down`);
    }
  }
  return found;
}

describe('단어장', () => {
  it('A-Z 대문자 3~7글자, 중복 없음, 모든 글자를 체인으로 만들 수 있음', () => {
    const seen = new Set<string>();
    for (const w of WORD_BANK) {
      expect(w.answer).toMatch(/^[A-Z]{3,7}$/);
      expect(seen.has(w.answer)).toBe(false);
      seen.add(w.answer);
      expect(w.clue.length).toBeGreaterThan(3);
      expect(w.ko.length).toBeGreaterThan(0);
      for (const ch of w.answer) expect(LETTERS.has(ch)).toBe(true);
    }
  });
});

describe('스테이지 퍼즐 자동 생성', () => {
  it('스테이지 1~30 × 여러 시드: 유효한 퍼즐이고 난이도 조건을 만족', () => {
    for (const seed of SEEDS) {
      for (let stage = 1; stage <= STAGE_COUNT; stage++) {
        const spec = stageSpec(stage);
        const p = getPuzzle(stage, seed);

        // 판 위 글자 줄이 정의된 단어와 정확히 일치 (우연히 붙은 가짜 단어 없음)
        expect(foundRuns(p)).toEqual(new Set(p.words.map((w) => `${w.answer}@${w.row},${w.col},${w.dir}`)));

        // 단어 수: 목표에 근접 (못 맞춰도 2개 이내)
        expect(p.words.length, `stage ${stage} seed ${seed}`).toBeGreaterThanOrEqual(spec.targetWords - 2);
        expect(p.words.length).toBeLessThanOrEqual(spec.targetWords);
        expect(p.words.some((w) => w.dir === 'across')).toBe(true);
        expect(p.words.some((w) => w.dir === 'down')).toBe(true);

        // 글자 수 / 사용 글자 범위
        for (const w of p.words) {
          expect(w.answer.length).toBeGreaterThanOrEqual(spec.minLen);
          expect(w.answer.length).toBeLessThanOrEqual(spec.maxLen);
          for (const ch of w.answer) expect(ch <= spec.maxLetter).toBe(true);
        }

        // 번호 연속, id 유일
        const nums = p.numbers.filter((n): n is number => n !== null);
        expect(nums).toEqual(nums.map((_, i) => i + 1));
        expect(new Set(p.words.map((w) => w.id)).size).toBe(p.words.length);
      }
    }
  }, 60_000);

  it('같은 (시드, 스테이지)면 항상 같은 퍼즐, 시드가 다르면 대체로 다른 퍼즐', () => {
    expect(generateStageDef(7, 99)).toEqual(generateStageDef(7, 99));
    const a = JSON.stringify(generateStageDef(15, 1));
    const b = JSON.stringify(generateStageDef(15, 2));
    expect(a).not.toEqual(b);
    // 스테이지가 다르면 같은 시드여도 다른 퍼즐
    expect(JSON.stringify(generateStageDef(3, 5))).not.toEqual(JSON.stringify(generateStageDef(4, 5)));
  });

  it('스테이지가 올라갈수록 목표 단어 수가 늘어난다 (5 → 13)', () => {
    expect(stageSpec(1).targetWords).toBe(5);
    expect(stageSpec(STAGE_COUNT).targetWords).toBe(13);
    for (let s = 2; s <= STAGE_COUNT; s++) {
      expect(stageSpec(s).targetWords).toBeGreaterThanOrEqual(stageSpec(s - 1).targetWords);
    }
  });

  it('생성 속도: 30스테이지 전체를 만드는 데 합쳐서 수 초 이내', () => {
    const t0 = performance.now();
    for (let stage = 1; stage <= STAGE_COUNT; stage++) generateStageDef(stage, 777);
    const ms = performance.now() - t0;
    console.log(`30 stages generated in ${Math.round(ms)}ms (avg ${Math.round(ms / 30)}ms)`);
    expect(ms).toBeLessThan(6_000);
  }, 30_000);
});

describe('시작 판 / 스테이지 진행', () => {
  it('시작 판의 글자는 정답 칸이 아닌 곳에 놓인다', () => {
    const p = getPuzzle(5, 42);
    const board = createBoard(p);
    expect(board.filter(Boolean)).toHaveLength(START_ITEMS);
    board.forEach((c, i) => { if (c) expect(p.answers[i]).toBeNull(); });
  });

  it('다음 스테이지로 넘어가면 같은 시드로 스테이지+1, 30에서는 새 시드로 1부터', () => {
    let s = createInitialState();
    const seed = s.seed;
    s = advanceStage(s);
    expect(s).toMatchObject({ stage: 2, seed });
    s = { ...s, stage: STAGE_COUNT };
    const wrapped = advanceStage(s, () => 0.5);
    expect(wrapped.stage).toBe(1);
    expect(wrapped.seed).not.toBe(seed);
  });

  it('스테이지가 넘어가도 판의 글자(머지한 것)는 초기화되지 않고 그대로 남는다', () => {
    let s = createInitialState();
    const board = s.board.slice();
    board[0] = itemForLetter('K')!; // 머지로 만든 글자라고 가정
    board[99] = itemForLetter('Z')!;
    s = { ...s, board, merges: 12, apUsed: 34 };

    const next = advanceStage(s);
    expect(next.board).toEqual(board); // 판 그대로
    expect(next.merges).toBe(12);
    expect(next.apUsed).toBe(34);

    // 마지막 스테이지를 깨고 처음으로 돌아갈 때도 판은 유지
    const wrapped = advanceStage({ ...s, stage: STAGE_COUNT }, () => 0.3);
    expect(wrapped.stage).toBe(1);
    expect(wrapped.board).toEqual(board);
  });

  it('이어받은 글자가 새 퍼즐의 정답 칸에 맞으면 자동으로 고정된다', () => {
    const s = createInitialState();
    const nextPuzzle = getPuzzle(2, s.seed);
    const i = nextPuzzle.answerCells[0]!;
    const board = s.board.map((c) => c);
    board[i] = itemForLetter(nextPuzzle.answers[i]!)!;
    const next = advanceStage({ ...s, board });
    expect(isLockedAt(nextPuzzle, next.board, i)).toBe(true);
  });

  it("'다시'(startStage)는 판을 시작 상태로 되돌린다", () => {
    const s = createInitialState();
    const board = s.board.map(() => itemForLetter('Q')!);
    const reset = startStage({ ...s, board }, 1);
    expect(reset.board.filter(Boolean)).toHaveLength(START_ITEMS);
  });
});
