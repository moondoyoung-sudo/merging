import type { ChainId, Item } from './types';

/* ===== 밸런스 / 규칙 설정: 여기만 고치면 됩니다 ===== */
export const COLS = 10;
export const ROWS = 10;

export const AP_MAX = 100;
export const AP_REGEN_MS = 60_000; // 1분에 1개 (충전 버튼은 즉시 가득 채움)

export const START_ITEMS = 10; // 스테이지 시작 시 깔리는 A 개수 (정답 칸이 아닌 곳에)
export const STAGE_COUNT = 30; // 총 스테이지 수

export const BASE_ITEM: Item = { chain: 'A', level: 0 };

/** A부터 Z까지 한 체인. 같은 글자 둘을 합치면 다음 글자 (Z는 마지막) */
export const CHAINS: Record<ChainId, readonly string[]> = {
  A: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
};
export const CHAIN_IDS = Object.keys(CHAINS) as ChainId[];

/**
 * 생성기 버튼: 누르면 해당 글자 1개가 판에 나옴 (AP cost 소모).
 * letter를 바꾸거나 추가/삭제하면 버튼이 그대로 따라 바뀝니다.
 */
export interface GeneratorDef {
  letter: string;
  cost: number;
}
export const GENERATORS: readonly GeneratorDef[] = [
  { letter: 'A', cost: 1 },
  { letter: 'H', cost: 1 },
  { letter: 'L', cost: 1 },
  { letter: 'W', cost: 1 },
];

/**
 * 더블클릭 생성 규칙 (지금은 비어 있음 = 더블클릭 기능 꺼짐. 생성은 위 생성기 버튼으로).
 * 필요하면 { chain, fromLevel, drops } 를 추가해서 다시 켤 수 있어요.
 */
export interface SpawnRule {
  chain: ChainId;
  fromLevel: number;
  toLevel?: number;
  drops: readonly Item[];
}
export const SPAWN_COST = 1;
export const CONSUME_SOURCE = false;
export const SPAWN_RULES: readonly SpawnRule[] = [];
