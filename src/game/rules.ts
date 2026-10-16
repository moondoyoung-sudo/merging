import { rollGeneratorLetter } from './generators';
import {
  BASE_ITEM,
  CHAINS,
  CHAIN_IDS,
  COLS,
  CONSUME_SOURCE,
  ROWS,
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
 * 정답 칸에 그 칸의 정답 글자가 놓이면 블록은 사라지고(소모), 칸은 "맞춤(solved)"이 돼요.
 * 맞춘 칸은 홀로그램 바닥으로 표시되고, 블록을 놓을 수 없어요. */
export const emptySolved = (): boolean[] => Array<boolean>(COLS * ROWS).fill(false);

/** 정답 칸에 정답 글자 블록이 있으면 블록을 없애고 맞춤 처리. 바뀐 게 없으면 같은 객체를 돌려줌 */
export function settle(state: GameState, puzzle: Puzzle): GameState {
  let board = state.board;
  let solved = state.solved;
  for (const i of puzzle.answerCells) {
    const item = board[i];
    if (!solved[i] && item && labelOf(item) === puzzle.answers[i]) {
      if (board === state.board) board = board.slice();
      if (solved === state.solved) solved = solved.slice();
      board[i] = null;
      solved[i] = true;
    }
  }
  return board === state.board ? state : { ...state, board, solved };
}

export const isSolved = (puzzle: Puzzle, solved: readonly boolean[]): boolean =>
  puzzle.answerCells.every((i) => solved[i]);

export const completedWordIds = (puzzle: Puzzle, solved: readonly boolean[]): string[] =>
  puzzle.words.filter((w) => w.cells.every((i) => solved[i])).map((w) => w.id);

/* ---------- 초기 상태 / 검증 ---------- */
export function createBoard(puzzle: Puzzle, rng: Rng = Math.random): Board {
  const board: Board = Array<Cell>(COLS * ROWS).fill(null);
  const free = [...board.keys()].filter((i) => puzzle.answers[i] === null);
  for (const i of shuffle(free, rng).slice(0, START_ITEMS)) board[i] = { ...BASE_ITEM };
  return board;
}

const newSeed = (rng: Rng): number => Math.floor(rng() * 0x7fffffff) + 1;

/** 새 게임: 새 시드로 스테이지 1부터 */
export function createInitialState(rng: Rng = Math.random): GameState {
  const seed = newSeed(rng);
  return {
    stage: 1,
    seed,
    board: createBoard(getPuzzle(1, seed), rng),
    solved: emptySolved(),
    merges: 0,
  };
}

/** 해당 스테이지를 '새 판'(시작 글자만 있는 상태)으로 시작. '다시' 버튼에서 사용 */
export function startStage(state: GameState, stage: number, rng: Rng = Math.random): GameState {
  return {
    ...state,
    stage,
    board: createBoard(getPuzzle(stage, state.seed), rng),
    solved: emptySolved(),
  };
}

/**
 * 다음 스테이지. 판 위에 남은 글자는 초기화하지 않고 그대로 이어가요.
 * (맞춘 단어에 쓰인 블록은 이미 사라졌고, 새 퍼즐의 정답 칸에 맞는 글자가 이미 놓여 있으면 바로 맞춤 처리)
 * 마지막 스테이지를 깼다면 새 시드로 스테이지 1부터 다시 시작하고, 이때도 판의 글자는 유지.
 */
export function advanceStage(state: GameState, rng: Rng = Math.random): GameState {
  const wrapped = state.stage >= STAGE_COUNT;
  const stage = wrapped ? 1 : state.stage + 1;
  const seed = wrapped ? newSeed(rng) : state.seed;
  return settle({ ...state, stage, seed, solved: emptySolved() }, getPuzzle(stage, seed));
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
  const puzzle = getPuzzle(s.stage, s.seed);
  const solved =
    Array.isArray(s.solved) && s.solved.length === COLS * ROWS
      ? (s.solved as unknown[]).map((v, i) => v === true && puzzle.answers[i] !== null)
      : emptySolved();
  // 예전 저장 데이터(정답 칸에 고정된 블록)도 새 방식(블록 제거 + 맞춤 표시)으로 바꿔서 불러옴
  return settle(
    { stage: s.stage, seed: s.seed, board, solved, merges: typeof s.merges === 'number' ? s.merges : 0 },
    puzzle,
  );
}

/* ---------- 보드 조작 ---------- */
/**
 * index에서 맨해튼 거리가 가장 가까운 빈 칸 (동거리면 무작위). 없으면 -1.
 * avoid(i)가 true인 칸(=정답 칸)은 다른 빈 칸이 없을 때만 사용, forbid(i)가 true인 칸(=맞춘 칸)은 절대 사용 안 함.
 */
export function findEmptyNear(
  board: Board,
  index: number,
  rng: Rng = Math.random,
  avoid?: (i: number) => boolean,
  forbid?: (i: number) => boolean,
): number {
  const r0 = Math.floor(index / COLS);
  const c0 = index % COLS;
  const search = (skipAvoided: boolean): number => {
    let best = -1;
    let bestScore = Infinity;
    board.forEach((cell, j) => {
      if (cell || forbid?.(j) || (skipAvoided && avoid?.(j))) return;
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

/** from 아이템을 to 칸에 놓았을 때의 결과 (이동 / 머지 / 교환). 맞춘 칸에는 놓을 수 없음. 정답이 되면 블록은 사라짐 */
export function applyDrop(
  state: GameState,
  puzzle: Puzzle,
  from: number,
  to: number,
): { state: GameState; result: DropResult } {
  const a = state.board[from];
  const b = state.board[to];
  if (from === to || !a) return { state, result: 'noop' };
  if (state.solved[to]) return { state, result: 'blocked' };

  const board = state.board.slice();

  if (!b) {
    board[to] = a;
    board[from] = null;
    return { state: settle({ ...state, board }, puzzle), result: 'moved' };
  }
  if (isSameItem(a, b) && !isMaxLevel(a)) {
    board[from] = null;
    board[to] = { chain: a.chain, level: a.level + 1 };
    return { state: settle({ ...state, board, merges: state.merges + 1 }, puzzle), result: 'merged' };
  }
  board[from] = b;
  board[to] = a;
  return { state: settle({ ...state, board }, puzzle), result: isSameItem(a, b) ? 'maxed' : 'swapped' };
}

/* ---------- 생성 액션 ---------- */
export type ActionFail = 'no-space' | 'not-spawnable';
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

/** 생성기 버튼: 구간 안에서 확률대로 뽑은 글자 1개를 판에 생성 (횟수 제한 없음) */
export function applyGenerate(
  state: GameState,
  puzzle: Puzzle,
  generator: GeneratorDef,
  rng: Rng = Math.random,
): ActionResult {
  const avoid = (i: number) => puzzle.answers[i] !== null;
  const forbid = (i: number) => state.solved[i] === true;
  const dest = findEmptyNear(state.board, Math.floor((COLS * ROWS) / 2), rng, avoid, forbid);
  if (dest < 0) return { ok: false, reason: 'no-space' };
  const item = itemForLetter(rollGeneratorLetter(generator, rng));
  if (!item) return { ok: false, reason: 'not-spawnable' };
  const board = state.board.slice();
  board[dest] = item;
  return { ok: true, state: settle({ ...state, board }, puzzle), placedAt: dest };
}

/** 더블클릭: index의 아이템에서 새 아이템 생성 (SPAWN_RULES가 비어 있으면 동작 안 함) */
export function applySpawn(
  state: GameState,
  puzzle: Puzzle,
  index: number,
  rng: Rng = Math.random,
): ActionResult {
  const item = state.board[index];
  const drops = item ? getSpawnDrops(item) : null;
  if (!item || !drops) return { ok: false, reason: 'not-spawnable' };

  const avoid = (i: number) => puzzle.answers[i] !== null;
  const forbid = (i: number) => state.solved[i] === true;
  const dest = findEmptyNear(state.board, index, rng, avoid, forbid);
  if (dest < 0) return { ok: false, reason: 'no-space' };

  const drop = drops[Math.floor(rng() * drops.length)]!;
  const board = state.board.slice();
  if (CONSUME_SOURCE) board[index] = null;
  board[dest] = { ...drop };
  return { ok: true, state: settle({ ...state, board }, puzzle), placedAt: dest };
}
