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
 * 생성기 버튼: 누르면 from~to 구간의 글자 1개가 무작위로 나옴 (AP cost 소모).
 * 구간의 첫 글자가 가장 잘 나오고 뒤로 갈수록 확률이 decay 배씩 줄어요.
 *   예) decay 0.4, W~Z → W 약 62% · X 25% · Y 10% · Z 4%
 * decay가 작을수록 앞글자 쏠림이 심하고(0.2면 뒷글자는 거의 안 나옴), 클수록(0.7이면) 고르게 나와요.
 * 구간/개수/비용을 바꾸면 버튼이 그대로 따라 바뀝니다. (구간은 서로 겹쳐도 되고 빠지는 글자가 있어도 돼요)
 */
export interface GeneratorDef {
  from: string;
  to: string;
  cost: number;
  decay: number;
}
export const GENERATOR_DECAY = 0.4;
export const GENERATORS: readonly GeneratorDef[] = [
  { from: 'A', to: 'G', cost: 1, decay: GENERATOR_DECAY },
  { from: 'H', to: 'K', cost: 1, decay: GENERATOR_DECAY },
  { from: 'L', to: 'P', cost: 1, decay: GENERATOR_DECAY },
  { from: 'Q', to: 'V', cost: 1, decay: GENERATOR_DECAY },
  { from: 'W', to: 'Z', cost: 1, decay: GENERATOR_DECAY },
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
