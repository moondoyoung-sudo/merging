import type { ChainId, Item } from './types';

/* ===== 밸런스 / 규칙 설정: 여기만 고치면 됩니다 ===== */
export const COLS = 7;
export const ROWS = 9;

export const AP_MAX = 100;
export const AP_REGEN_MS = 60_000; // 1분에 1개

export const GEN_COST = 1; // 'a 생성' 버튼 비용
export const SPAWN_COST = 1; // 더블클릭 생성 비용
export const CONSUME_SOURCE = false; // true면 더블클릭한 아이템이 사라짐
export const START_ITEMS = 8; // 시작 시 깔리는 a 개수

export const BASE_ITEM: Item = { chain: 'A', level: 0 };

export const CHAINS: Record<ChainId, readonly string[]> = {
  A: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  B: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'],
  C: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ'],
  D: ['1', '2', '3', '4', '5', '6'],
};
export const CHAIN_IDS = Object.keys(CHAINS) as ChainId[];

/**
 * 더블클릭 시 나오는 아이템.
 * chain의 fromLevel(이상) ~ toLevel(이하, 생략하면 끝까지)에 적용.
 * drops가 여러 개면 균등 확률로 하나가 나옴.
 */
export interface SpawnRule {
  chain: ChainId;
  fromLevel: number;
  toLevel?: number;
  drops: readonly Item[];
}

export const SPAWN_RULES: readonly SpawnRule[] = [
  // c 이상(c,d,e,f,g) → ㄱ 또는 ㅏ
  {
    chain: 'A',
    fromLevel: 2,
    drops: [
      { chain: 'B', level: 0 },
      { chain: 'C', level: 0 },
    ],
  },
  // ㅕ 이상(ㅕ,ㅗ,ㅛ) → 1
  { chain: 'C', fromLevel: 3, drops: [{ chain: 'D', level: 0 }] },
];
