import { CHAINS } from './config';
import type { GeneratorDef } from './config';
import type { Rng } from './types';

const ALPHABET = CHAINS.A;

/** 버튼에 표시되는 이름 (예: "A~G") */
export const generatorLabel = (g: GeneratorDef): string => `${g.from}~${g.to}`;

/** 생성기가 만들 수 있는 글자들 (from ~ to, 앞에서부터) */
export function generatorLetters(g: GeneratorDef): string[] {
  const lo = ALPHABET.indexOf(g.from);
  const hi = ALPHABET.indexOf(g.to);
  if (lo < 0 || hi < lo) throw new Error(`생성기 구간이 잘못됐어요: ${g.from}~${g.to}`);
  return ALPHABET.slice(lo, hi + 1) as string[];
}

/** 글자별 확률 (합계 1). 첫 글자가 가장 높고 decay 배씩 줄어듦 */
export function generatorProbabilities(g: GeneratorDef): number[] {
  const raw = generatorLetters(g).map((_, i) => g.decay ** i);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** 확률대로 글자 하나를 뽑음 */
export function rollGeneratorLetter(g: GeneratorDef, rng: Rng): string {
  const letters = generatorLetters(g);
  const probs = generatorProbabilities(g);
  let r = rng();
  for (let i = 0; i < letters.length; i++) {
    r -= probs[i]!;
    if (r < 0) return letters[i]!;
  }
  return letters[letters.length - 1]!;
}
