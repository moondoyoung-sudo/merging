import { spendAp } from './ap';
import {
  AP_MAX,
  BASE_ITEM,
  CHAINS,
  CHAIN_IDS,
  COLS,
  CONSUME_SOURCE,
  ROWS,
  SPAWN_COST,
  SPAWN_RULES,
  STAGE_COUNT,
  START_ITEMS,
} from './config';
import type { Puzzle } from './puzzle';
import { getPuzzle } from './stages';
import type { GeneratorDef } from './config';
import type { Board, Cell, ChainId, GameState, Item, Rng } from './types';

/* ---------- 아이템 헬퍼 ---------- */
export const chainLength = (chain: ChainId): number => CHAINS[chain].length;
export const labelOf = (item: Item): string => CHAINS[item.chain][item.level] ?? '?';
export const isMaxLevel = (item: Item): boolean => item.level >= chainLength(item.chain) - 1;
export const isSameItem = (a: Cell, b: Cell): boolean =>
  !!a && !!b && a.chain === b.chain && a.level === b.level;

/** 더블클릭으로 나올 수 있는 후보. 생성 불가 아이템이면 null */
export function getSpawnDrops(item: Item): readonly Item[] | null {
  const rule = SPAWN_RULES.find(
    (r) =>
      r.chain === item.chain &&
      item.level >= r.fromLevel &&
      (r.toLevel === undefined || item.level <= r.toLevel),
  );
  return rule ? rule.drops : null;
}

/* ---------- 퍼즐 판정 ----------
 * "고정"은 따로 저장하지 않고 판 상태에서 계산합니다:
 * 정답 칸에 그 칸의 정답 글자가 놓여 있으면 고정(이동·머지 불가). */
export function isLockedAt(puzzle: Puzzle, board: Board, i: number): boolean {
  const item = board[i];
  const answer = puzzle.answers[i];
  return !!item && !!answer && labelOf(item) === answer;
}
export const lockedMask = (puzzle: Puzzle, board: Board): boolean[] =>
  board.map((_, i) => isLockedAt(puzzle, board, i));

export const isSolved = (puzzle: Puzzle, board: Board): boolean =>
  puzzle.answerCells.every((i) => isLockedAt(puzzle, board, i));

export const completedWordIds = (puzzle: Puzzle, board: Board): string[] =>
  puzzle.words.filter((w) => w.cells.every((i) => isLockedAt(puzzle, board, i))).map((w) => w.id);

/* ---------- 초기 상태 / 검증 ---------- */
export function createBoard(puzzle: Puzzle, rng: Rng = Math.random): Board {
  const board: Board = Array<Cell>(COLS * ROWS).fill(null);
  const free = [...board.keys()].filter((i) => puzzle.answers[i] === null);
  for (const i of shuffle(free, rng).slice(0, START_ITEMS)) board[i] = { ...BASE_ITEM };
  return board;
}

const newSeed = (rng: Rng): number => Math.floor(rng() * 0x7fffffff) + 1;

/** 새 게임: 새 시드로 스테이지 1부터 */
export function createInitialState(now: number, rng: Rng = Math.random): GameState {
  const seed = newSeed(rng);
  return {
    stage: 1,
    seed,
    board: createBoard(getPuzzle(1, seed), rng),
    ap: AP_MAX,
    apUpdatedAt: now,
    apUsed: 0,
    merges: 0,
  };
}

/** 같은 AP를 유지한 채 해당 스테이지의 새 판으로 시작 */
export function startStage(state: GameState, stage: number, rng: Rng = Math.random): GameState {
  return { ...state, stage, board: createBoard(getPuzzle(stage, state.seed), rng) };
}

/** 다음 스테이지. 마지막 스테이지를 깼다면 새 시드로 처음부터 다시 */
export function advanceStage(state: GameState, rng: Rng = Math.random): GameState {
  if (state.stage >= STAGE_COUNT) {
    const seed = newSeed(rng);
    return { ...state, stage: 1, seed, board: createBoard(getPuzzle(1, seed), rng) };
  }
  return startStage(state, state.stage + 1, rng);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** 저장소/서버에서 읽은 값을 검증. 규격이 안 맞으면 null (→ 새 게임) */
export function sanitizeState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (!Array.isArray(s.board) || s.board.length !== COLS * ROWS) return null;
  if (typeof s.ap !== 'number' || typeof s.apUpdatedAt !== 'number') return null;
  if (typeof s.seed !== 'number' || !Number.isFinite(s.seed)) return null;
  if (typeof s.stage !== 'number' || !Number.isInteger(s.stage) || s.stage < 1 || s.stage > STAGE_COUNT) {
    return null;
  }

  const board: Board = [];
  for (const c of s.board as unknown[]) {
    if (c === null) {
      board.push(null);
      continue;
    }
    const it = c as Partial<Item>;
    if (
      !it ||
      typeof it.level !== 'number' ||
      !CHAIN_IDS.includes(it.chain as ChainId) ||
      it.level < 0 ||
      it.level >= chainLength(it.chain as ChainId)
    ) {
      return null;
    }
    board.push({ chain: it.chain as ChainId, level: it.level });
  }
  return {
    stage: s.stage,
    seed: s.seed,
    board,
    ap: Math.min(AP_MAX, Math.max(0, Math.floor(s.ap))),
    apUpdatedAt: s.apUpdatedAt,
    apUsed: typeof s.apUsed === 'number' && s.apUsed > 0 ? Math.floor(s.apUsed) : 0,
    merges: typeof s.merges === 'number' ? s.merges : 0,
  };
}

/* ---------- 보드 조작 ---------- */
/**
 * index에서 맨해튼 거리가 가장 가까운 빈 칸 (동거리면 무작위). 없으면 -1.
 * avoid(i)가 true인 칸(=정답 칸)은 다른 빈 칸이 없을 때만 사용.
 */
export function findEmptyNear(
  board: Board,
  index: number,
  rng: Rng = Math.random,
  avoid?: (i: number) => boolean,
): number {
  const r0 = Math.floor(index / COLS);
  const c0 = index % COLS;
  const search = (skipAvoided: boolean): number => {
    let best = -1;
    let bestScore = Infinity;
    board.forEach((cell, j) => {
      if (cell || (skipAvoided && avoid?.(j))) return;
      const score = Math.abs(Math.floor(j / COLS) - r0) + Math.abs((j % COLS) - c0) + rng() * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    });
    return best;
  };
  const preferred = search(true);
  return preferred >= 0 ? preferred : search(false);
}

export type DropResult = 'noop' | 'moved' | 'merged' | 'swapped' | 'maxed' | 'blocked';

/** from 아이템을 to 칸에 놓았을 때의 결과 (이동 / 머지 / 교환). 고정된 칸은 건드릴 수 없음. */
export function applyDrop(
  state: GameState,
  puzzle: Puzzle,
  from: number,
  to: number,
): { state: GameState; result: DropResult } {
  const a = state.board[from];
  const b = state.board[to];
  if (from === to || !a || isLockedAt(puzzle, state.board, from)) return { state, result: 'noop' };
  if (isLockedAt(puzzle, state.board, to)) return { state, result: 'blocked' };

  const board = state.board.slice();

  if (!b) {
    board[to] = a;
    board[from] = null;
    return { state: { ...state, board }, result: 'moved' };
  }
  if (isSameItem(a, b) && !isMaxLevel(a)) {
    board[from] = null;
    board[to] = { chain: a.chain, level: a.level + 1 };
    return { state: { ...state, board, merges: state.merges + 1 }, result: 'merged' };
  }
  board[from] = b;
  board[to] = a;
  return { state: { ...state, board }, result: isSameItem(a, b) ? 'maxed' : 'swapped' };
}

/* ---------- AP를 쓰는 액션 ---------- */
export type ActionFail = 'no-ap' | 'no-space' | 'not-spawnable';
export type ActionResult =
  | { ok: true; state: GameState; placedAt: number }
  | { ok: false; reason: ActionFail };

/** 글자 → 체인 아이템 (예: 'H' → {chain:'A', level:7}). 체인에 없는 글자면 null */
export function itemForLetter(letter: string): Item | null {
  for (const chain of CHAIN_IDS) {
    const level = CHAINS[chain].indexOf(letter);
    if (level >= 0) return { chain, level };
  }
  return null;
}

/** 생성기 버튼: 해당 글자 1개를 판에 생성 (AP cost 소모) */
export function applyGenerate(
  state: GameState,
  puzzle: Puzzle,
  generator: GeneratorDef,
  now: number,
  rng: Rng = Math.random,
): ActionResult {
  const item = itemForLetter(generator.letter);
  if (!item) return { ok: false, reason: 'not-spawnable' };
  const avoid = (i: number) => puzzle.answers[i] !== null;
  const dest = findEmptyNear(state.board, Math.floor((COLS * ROWS) / 2), rng, avoid);
  if (dest < 0) return { ok: false, reason: 'no-space' };
  const paid = spendAp(state, generator.cost, now);
  if (!paid) return { ok: false, reason: 'no-ap' };
  const board = paid.board.slice();
  board[dest] = item;
  return { ok: true, state: { ...paid, board }, placedAt: dest };
}

/** 더블클릭: index의 아이템에서 새 아이템 생성 (고정된 글자도 생성은 가능) */
export function applySpawn(
  state: GameState,
  puzzle: Puzzle,
  index: number,
  now: number,
  rng: Rng = Math.random,
): ActionResult {
  const item = state.board[index];
  const drops = item ? getSpawnDrops(item) : null;
  if (!item || !drops) return { ok: false, reason: 'not-spawnable' };

  const avoid = (i: number) => puzzle.answers[i] !== null;
  const dest = findEmptyNear(state.board, index, rng, avoid);
  if (dest < 0) return { ok: false, reason: 'no-space' };

  const paid = spendAp(state, SPAWN_COST, now);
  if (!paid) return { ok: false, reason: 'no-ap' };

  const drop = drops[Math.floor(rng() * drops.length)]!;
  const board = paid.board.slice();
  // 고정된 글자는 사라지면 안 되므로 CONSUME_SOURCE여도 유지
  if (CONSUME_SOURCE && !isLockedAt(puzzle, board, index)) board[index] = null;
  board[dest] = { ...drop };
  return { ok: true, state: { ...paid, board }, placedAt: dest };
}
