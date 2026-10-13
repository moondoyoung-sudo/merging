/** A~Z 26글자가 하나의 체인이라 체인 id는 하나뿐 (구조는 유지해서 나중에 체인을 늘릴 수 있게 함) */
export type ChainId = 'A';

export interface Item {
  chain: ChainId;
  /** 0부터 시작. 체인 안에서의 단계 (A=0, B=1 ... Z=25) */
  level: number;
}

export type Cell = Item | null;
export type Board = Cell[];

export interface GameState {
  /** 현재 스테이지 (1 ~ STAGE_COUNT) */
  stage: number;
  /** 이번 플레이(런)의 시드. (시드, 스테이지)로 퍼즐이 결정됨 → 저장/멀티플레이 때 시드만 공유하면 같은 퍼즐 */
  seed: number;
  board: Board;
  ap: number;
  apUpdatedAt: number;
  /** AP 총 사용량 (누적, 충전해도 줄지 않음) */
  apUsed: number;
  merges: number;
}

export type Rng = () => number;
