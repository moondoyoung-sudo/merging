export type ChainId = 'A' | 'B' | 'C' | 'D';

export interface Item {
  chain: ChainId;
  /** 0부터 시작. 체인 안에서의 단계 (a=0, b=1 ...) */
  level: number;
}

export type Cell = Item | null;
export type Board = Cell[];

export interface GameState {
  board: Board;
  /** 현재 AP */
  ap: number;
  /** AP 충전 기준 시각(ms). 다음 충전까지 남은 시간 계산에 사용 */
  apUpdatedAt: number;
  merges: number;
}

export type Rng = () => number;
