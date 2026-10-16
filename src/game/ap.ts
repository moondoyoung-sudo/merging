import type { GameState } from './types';

/**
 * AP 충전/제한은 없어요. 생성기를 쓸 때마다 사용한 AP만 "총 사용량"에 누적합니다.
 * (나중에 시간제한·점수 등을 붙일 때 이 값을 쓸 수 있어요)
 */
export function spendAp(state: GameState, cost: number): GameState {
  return { ...state, apUsed: state.apUsed + cost };
}
