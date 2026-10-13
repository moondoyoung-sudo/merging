import { COLS, ROWS } from './config';

export type Dir = 'across' | 'down';

/** 퍼즐 정의: 단어와 위치만 적으면 됨 (번호·칸은 자동 계산) */
export interface WordDef {
  answer: string; // 대문자 A-Z
  row: number; // 첫 글자 위치 (0부터)
  col: number;
  dir: Dir;
  clue: string; // 영어 힌트
  ko: string; // 한글 뜻
}
export interface PuzzleDef {
  id: string;
  title: string;
  words: WordDef[];
}

export interface PuzzleWord extends WordDef {
  id: string; // 예: '3-across'
  number: number;
  /** 단어가 차지하는 판 칸 인덱스 (순서대로) */
  cells: number[];
}

export interface Puzzle {
  id: string;
  title: string;
  words: PuzzleWord[];
  /** 칸별 정답 글자 (정답 칸이 아니면 null) */
  answers: (string | null)[];
  /** 칸별 단어 시작 번호 */
  numbers: (number | null)[];
  answerCells: number[];
}

export function compilePuzzle(def: PuzzleDef): Puzzle {
  const answers: (string | null)[] = Array(COLS * ROWS).fill(null);
  const startKey = (r: number, c: number) => r * COLS + c;
  const starts = new Set<number>();
  const cellsOf = new Map<WordDef, number[]>();

  for (const w of def.words) {
    const cells: number[] = [];
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.row + (w.dir === 'down' ? i : 0);
      const c = w.col + (w.dir === 'across' ? i : 0);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
        throw new Error(`[${def.id}] ${w.answer}: 판 밖으로 나갑니다`);
      }
      const idx = startKey(r, c);
      const ch = w.answer[i]!;
      if (answers[idx] !== null && answers[idx] !== ch) {
        throw new Error(`[${def.id}] ${w.answer}: (${r},${c}) 글자 충돌 ${answers[idx]} ≠ ${ch}`);
      }
      answers[idx] = ch;
      cells.push(idx);
    }
    starts.add(startKey(w.row, w.col));
    cellsOf.set(w, cells);
  }

  // 표준 크로스워드 번호: 왼쪽 위부터 읽는 순서로 시작 칸에 1,2,3…
  const numbers: (number | null)[] = Array(COLS * ROWS).fill(null);
  [...starts].sort((a, b) => a - b).forEach((idx, n) => (numbers[idx] = n + 1));

  const words: PuzzleWord[] = def.words
    .map((w) => {
      const number = numbers[startKey(w.row, w.col)]!;
      return { ...w, number, id: `${number}-${w.dir}`, cells: cellsOf.get(w)! };
    })
    .sort((a, b) => a.number - b.number);

  return {
    id: def.id,
    title: def.title,
    words,
    answers,
    numbers,
    answerCells: answers.flatMap((a, i) => (a ? [i] : [])),
  };
}
