import { COLS, ROWS } from './config';
import type { Dir, PuzzleDef, WordDef } from './puzzle';
import type { BankWord } from './words';
import type { Rng } from './types';

/**
 * 가로세로 퍼즐 자동 생성기.
 * 단어들을 이미 놓인 글자에 교차시키면서 하나씩 붙이는 방식이에요.
 * 같은 rng(시드)면 항상 같은 퍼즐이 나옵니다. (시간 제한 같은 비결정적 요소 없음)
 */
export interface GenSpec {
  /** 목표 단어 수 */
  targetWords: number;
  /** 글자가 퍼진 범위(가로/세로)가 최소 이만큼 되길 선호 */
  minSpan: number;
  /** 시도 횟수 (많을수록 좋은 배치를 찾지만 느려짐) */
  attempts: number;
}

interface Placed {
  answer: string;
  row: number;
  col: number;
  dir: Dir;
}
interface Layout {
  placed: Placed[];
  complete: boolean;
  crosses: number;
  rowSpan: number;
  colSpan: number;
  across: number;
  down: number;
}
interface Grid {
  letters: (string | null)[];
  /** 칸마다 어떤 방향 단어가 지나가는지 (1=가로, 2=세로) */
  dirs: number[];
}

const BIT: Record<Dir, number> = { across: 1, down: 2 };

/** 한 번 시도할 때 단어장에서 무작위로 뽑아 쓰는 후보 수. 줄이면 훨씬 빨라지고 시도마다 단어 구성도 달라져 다양해짐 */
const SAMPLE_WORDS = 60;

const at = (g: Grid, r: number, c: number): string | null =>
  r >= 0 && r < ROWS && c >= 0 && c < COLS ? g.letters[r * COLS + c]! : null;

/** 단어를 (r,c,dir)에 놓을 수 있으면 "기존 글자와 겹치는 칸 수", 불가능하면 -1 */
function fits(g: Grid, w: string, r: number, c: number, dir: Dir): number {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  const er = r + dr * (w.length - 1);
  const ec = c + dc * (w.length - 1);
  if (r < 0 || c < 0 || er >= ROWS || ec >= COLS) return -1;
  if (at(g, r - dr, c - dc) || at(g, er + dr, ec + dc)) return -1; // 앞뒤가 붙으면 안 됨

  let cross = 0;
  for (let i = 0; i < w.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const idx = rr * COLS + cc;
    const cur = g.letters[idx];
    if (cur) {
      if (cur !== w[i] || (g.dirs[idx]! & BIT[dir])) return -1; // 글자 불일치 / 같은 방향 겹침
      cross++;
    } else if (at(g, rr + dc, cc + dr) || at(g, rr - dc, cc - dr)) {
      return -1; // 새 칸의 옆(수직 방향)에 다른 글자가 붙으면 안 됨
    }
  }
  return cross;
}

function place(g: Grid, p: Placed): void {
  const dr = p.dir === 'down' ? 1 : 0;
  const dc = p.dir === 'across' ? 1 : 0;
  for (let i = 0; i < p.answer.length; i++) {
    const idx = (p.row + dr * i) * COLS + (p.col + dc * i);
    g.letters[idx] = p.answer[i]!;
    g.dirs[idx] = g.dirs[idx]! | BIT[p.dir];
  }
}

/** 판 위의 2칸 이상 연속 글자 줄이 모두 배치한 단어와 정확히 일치하는지 */
export function verifyRuns(letters: readonly (string | null)[], placed: readonly Placed[]): boolean {
  const defined = new Set(placed.map((p) => `${p.answer}@${p.row},${p.col},${p.dir}`));
  const cell = (r: number, c: number) => letters[r * COLS + c] ?? null;
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!cell(r, c)) { c++; continue; }
      const s = c;
      let str = '';
      while (c < COLS && cell(r, c)) str += cell(r, c++);
      if (str.length >= 2 && !defined.has(`${str}@${r},${s},across`)) return false;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!cell(r, c)) { r++; continue; }
      const s = r;
      let str = '';
      while (r < ROWS && cell(r, c)) str += cell(r++, c);
      if (str.length >= 2 && !defined.has(`${str}@${s},${c},down`)) return false;
    }
  }
  return true;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** 한 번의 배치 시도. 단어를 더 이을 수 없으면 거기까지의 결과(complete=false)를 돌려줌 */
function build(words: readonly string[], target: number, rng: Rng): Layout | null {
  const grid: Grid = { letters: Array(ROWS * COLS).fill(null), dirs: Array(ROWS * COLS).fill(0) };
  const shuffled = shuffle([...words], rng).slice(0, SAMPLE_WORDS);
  let first = shuffled[0]!;
  for (const w of shuffled.slice(0, 6)) if (w.length > first.length) first = w;

  const dir: Dir = rng() < 0.5 ? 'across' : 'down';
  const L = first.length;
  const start: Placed =
    dir === 'across'
      ? { answer: first, dir, row: randInt(rng, 0, ROWS - 1), col: randInt(rng, 0, COLS - L) }
      : { answer: first, dir, row: randInt(rng, 0, ROWS - L), col: randInt(rng, 0, COLS - 1) };
  place(grid, start);

  const placed: Placed[] = [start];
  let remaining = shuffled.filter((w) => w !== first);
  let crosses = 0;

  while (placed.length < target) {
    // 글자 → (단어, 그 글자의 위치) 색인으로 "교차 가능한 후보"만 빠르게 찾기
    const byLetter = new Map<string, Array<[string, number]>>();
    for (const w of remaining) {
      for (let i = 0; i < w.length; i++) {
        const list = byLetter.get(w[i]!);
        if (list) list.push([w, i]);
        else byLetter.set(w[i]!, [[w, i]]);
      }
    }
    const cands: Array<{ k: number; p: Placed }> = [];
    const seen = new Set<string>();
    for (let idx = 0; idx < grid.letters.length; idx++) {
      const ch = grid.letters[idx];
      if (!ch) continue;
      const r0 = Math.floor(idx / COLS);
      const c0 = idx % COLS;
      for (const [w, i] of byLetter.get(ch) ?? []) {
        for (const d of ['across', 'down'] as const) {
          const row = d === 'across' ? r0 : r0 - i;
          const col = d === 'across' ? c0 - i : c0;
          const key = `${w}|${row}|${col}|${d}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const k = fits(grid, w, row, col, d);
          if (k >= 1) cands.push({ k, p: { answer: w, row, col, dir: d } });
        }
      }
    }
    if (!cands.length) break;

    const best = Math.max(...cands.map((c) => c.k));
    const pool = rng() < 0.5 ? cands.filter((c) => c.k >= Math.max(1, best - 1)) : cands;
    const pick = pool[Math.floor(rng() * pool.length)]!;
    place(grid, pick.p);
    placed.push(pick.p);
    crosses += pick.k;
    remaining = remaining.filter((w) => w !== pick.p.answer);
  }

  if (!verifyRuns(grid.letters, placed)) return null;

  let rMin = ROWS, rMax = -1, cMin = COLS, cMax = -1;
  grid.letters.forEach((ch, idx) => {
    if (!ch) return;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    cMin = Math.min(cMin, c); cMax = Math.max(cMax, c);
  });
  const across = placed.filter((p) => p.dir === 'across').length;
  return {
    placed,
    complete: placed.length >= target,
    crosses,
    rowSpan: rMax - rMin + 1,
    colSpan: cMax - cMin + 1,
    across,
    down: placed.length - across,
  };
}

/**
 * 단어 후보(bank) 중에서 spec에 맞는 퍼즐을 생성.
 * 조건(목표 단어 수·퍼진 범위·가로/세로 균형)을 모두 만족하는 배치 중 교차가 가장 많은 것을 고르고,
 * 만족하는 게 없으면 가장 단어가 많은 배치로 대체해서 항상 결과를 돌려줘요.
 */
export function generatePuzzleDef(
  id: string,
  title: string,
  bank: readonly BankWord[],
  spec: GenSpec,
  rng: Rng,
): PuzzleDef {
  const info = new Map(bank.map((b) => [b.answer, b]));
  const answers = bank.map((b) => b.answer);
  const minEach = Math.max(2, Math.floor(spec.targetWords / 3));

  let best: Layout | null = null; // 조건을 모두 만족
  let fallback: Layout | null = null; // 조건은 못 맞췄지만 가장 나은 것
  for (let t = 0; t < spec.attempts; t++) {
    const layout = build(answers, spec.targetWords, rng);
    if (!layout) continue;
    const ok =
      layout.complete &&
      layout.rowSpan >= spec.minSpan &&
      layout.colSpan >= spec.minSpan &&
      Math.min(layout.across, layout.down) >= minEach;
    if (ok && (!best || layout.crosses > best.crosses)) best = layout;
    if (
      !fallback ||
      layout.placed.length > fallback.placed.length ||
      (layout.placed.length === fallback.placed.length && layout.crosses > fallback.crosses)
    ) {
      fallback = layout;
    }
  }

  const chosen = best ?? fallback;
  if (!chosen) throw new Error(`[${id}] 퍼즐을 만들지 못했어요 (단어 후보가 너무 적어요)`);

  const words: WordDef[] = chosen.placed.map((p) => {
    const w = info.get(p.answer)!;
    return { answer: p.answer, row: p.row, col: p.col, dir: p.dir, clue: w.clue, ko: w.ko };
  });
  return { id, title, words };
}
