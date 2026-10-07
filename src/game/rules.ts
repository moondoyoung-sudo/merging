import { spendAp } from './ap';
import {
  AP_MAX,
  BASE_ITEM,
  CHAINS,
  CHAIN_IDS,
  COLS,
  CONSUME_SOURCE,
  GEN_COST,
  ROWS,
  SPAWN_COST,
  SPAWN_RULES,
  START_ITEMS,
} from './config';
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

/* ---------- 초기 상태 / 검증 ---------- */
export function createInitialState(now: number, rng: Rng = Math.random): GameState {
  const board: Board = Array<Cell>(COLS * ROWS).fill(null);
  const idx = shuffle([...board.keys()], rng).slice(0, START_ITEMS);
  for (const i of idx) board[i] = { ...BASE_ITEM };
  return { board, ap: AP_MAX, apUpdatedAt: now, merges: 0 };
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
    board,
    ap: Math.min(AP_MAX, Math.max(0, Math.floor(s.ap))),
    apUpdatedAt: s.apUpdatedAt,
    merges: typeof s.merges === 'number' ? s.merges : 0,
  };
}

/* ---------- 보드 조작 ---------- */
/** index에서 맨해튼 거리가 가장 가까운 빈 칸 (동거리면 무작위). 없으면 -1 */
export function findEmptyNear(board: Board, index: number, rng: Rng = Math.random): number {
  const r0 = Math.floor(index / COLS);
  const c0 = index % COLS;
  let best = -1;
  let bestScore = Infinity;
  board.forEach((cell, j) => {
    if (cell) return;
    const score = Math.abs(Math.floor(j / COLS) - r0) + Math.abs((j % COLS) - c0) + rng() * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = j;
    }
  });
  return best;
}

export type DropResult = 'noop' | 'moved' | 'merged' | 'swapped' | 'maxed';

/** from 아이템을 to 칸에 놓았을 때의 결과 (이동 / 머지 / 교환) */
export function applyDrop(
  state: GameState,
  from: number,
  to: number,
): { state: GameState; result: DropResult } {
  const a = state.board[from];
  const b = state.board[to];
  if (from === to || !a) return { state, result: 'noop' };

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
  return {
    state: { ...state, board },
    result: isSameItem(a, b) ? 'maxed' : 'swapped',
  };
}

/* ---------- AP를 쓰는 액션 ---------- */
export type ActionFail = 'no-ap' | 'no-space' | 'not-spawnable';
export type ActionResult =
  | { ok: true; state: GameState; placedAt: number }
  | { ok: false; reason: ActionFail };

/** 'a 생성' 버튼 */
export function applyGenerate(state: GameState, now: number, rng: Rng = Math.random): ActionResult {
  const dest = findEmptyNear(state.board, Math.floor((COLS * ROWS) / 2), rng);
  if (dest < 0) return { ok: false, reason: 'no-space' };
  const paid = spendAp(state, GEN_COST, now);
  if (!paid) return { ok: false, reason: 'no-ap' };
  const board = paid.board.slice();
  board[dest] = { ...BASE_ITEM };
  return { ok: true, state: { ...paid, board }, placedAt: dest };
}

/** 더블클릭: index의 아이템에서 새 아이템 생성 */
export function applySpawn(
  state: GameState,
  index: number,
  now: number,
  rng: Rng = Math.random,
): ActionResult {
  const item = state.board[index];
  const drops = item ? getSpawnDrops(item) : null;
  if (!item || !drops) return { ok: false, reason: 'not-spawnable' };

  const dest = findEmptyNear(state.board, index, rng);
  if (dest < 0) return { ok: false, reason: 'no-space' };

  const paid = spendAp(state, SPAWN_COST, now);
  if (!paid) return { ok: false, reason: 'no-ap' };

  const drop = drops[Math.floor(rng() * drops.length)]!;
  const board = paid.board.slice();
  if (CONSUME_SOURCE) board[index] = null;
  board[dest] = { ...drop };
  return { ok: true, state: { ...paid, board }, placedAt: dest };
}
