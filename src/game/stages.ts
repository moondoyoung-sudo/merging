import { STAGE_COUNT } from './config';
import { generatePuzzleDef } from './crosswordGen';
import type { GenSpec } from './crosswordGen';
import { compilePuzzle } from './puzzle';
import type { Puzzle, PuzzleDef } from './puzzle';
import { hashSeed, mulberry32 } from './random';
import { WORD_BANK } from './words';

export interface StageSpec extends GenSpec {
  minLen: number;
  maxLen: number;
  /** 이 알파벳 이후 글자가 들어간 단어는 제외 (뒤쪽 스테이지에서 어려운 글자 등장) */
  maxLetter: string;
}

/** 스테이지가 오를수록 단어가 늘고, 길어지고, 어려운 글자가 등장 */
export function stageSpec(stage: number): StageSpec {
  const s = Math.min(STAGE_COUNT, Math.max(1, stage));
  const t = (s - 1) / (STAGE_COUNT - 1); // 0 → 1
  return {
    targetWords: 5 + Math.round(t * 8), // 5 → 13단어
    minLen: 3,
    maxLen: s <= 4 ? 4 : s <= 12 ? 5 : s <= 24 ? 6 : 7,
    maxLetter: s <= 8 ? 'T' : s <= 18 ? 'X' : 'Z',
    minSpan: 4 + Math.round(t * 4), // 판을 4칸 → 8칸 이상 넓게 쓰기
    attempts: 24,
  };
}

/** (런 시드, 스테이지)로 퍼즐 정의를 생성. 같은 입력이면 항상 같은 결과. */
export function generateStageDef(stage: number, seed: number): PuzzleDef {
  const spec = stageSpec(stage);
  const pool = WORD_BANK.filter(
    (w) =>
      w.answer.length >= spec.minLen &&
      w.answer.length <= spec.maxLen &&
      [...w.answer].every((ch) => ch <= spec.maxLetter),
  );
  const rng = mulberry32(hashSeed(seed, stage));
  return generatePuzzleDef(`s${stage}-${seed}`, `Stage ${stage}`, pool, spec, rng);
}

/* 생성은 수십 ms 걸릴 수 있어서 같은 스테이지를 다시 그릴 때 재생성하지 않도록 캐시 */
const cache = new Map<string, Puzzle>();
export function getPuzzle(stage: number, seed: number): Puzzle {
  const key = `${seed}:${stage}`;
  let puzzle = cache.get(key);
  if (!puzzle) {
    puzzle = compilePuzzle(generateStageDef(stage, seed));
    cache.set(key, puzzle);
    if (cache.size > 6) cache.delete(cache.keys().next().value!);
  }
  return puzzle;
}
