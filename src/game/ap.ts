import { AP_MAX, AP_REGEN_MS } from './config';
import type { GameState } from './types';

/** 경과 시간만큼 AP를 충전. 변화가 없으면 같은 객체를 돌려줌(불필요한 렌더 방지). */
export function regenAp(state: GameState, now: number): GameState {
  if (state.ap >= AP_MAX) return state;
  const n = Math.floor((now - state.apUpdatedAt) / AP_REGEN_MS);
  if (n <= 0) return state;
  const ap = Math.min(AP_MAX, state.ap + n);
  return {
    ...state,
    ap,
    apUpdatedAt: ap >= AP_MAX ? now : state.apUpdatedAt + n * AP_REGEN_MS,
  };
}

/** AP 소모 (총 사용량에도 누적). 부족하면 null. 가득 찬 상태에서 처음 쓰면 그 시점부터 충전이 시작됨. */
export function spendAp(state: GameState, cost: number, now: number): GameState | null {
  const s = regenAp(state, now);
  if (s.ap < cost) return null;
  return {
    ...s,
    ap: s.ap - cost,
    apUsed: s.apUsed + cost,
    apUpdatedAt: s.ap >= AP_MAX ? now : s.apUpdatedAt,
  };
}

/** AP 충전 버튼: 대가 없이 즉시 가득 채움 (총 사용량은 그대로). 이미 가득이면 같은 객체. */
export function refillAp(state: GameState, now: number): GameState {
  if (state.ap >= AP_MAX) return state;
  return { ...state, ap: AP_MAX, apUpdatedAt: now };
}

/** 다음 AP 충전까지 남은 ms. 가득 차 있으면 null. */
export function msUntilNextAp(state: GameState, now: number): number | null {
  if (state.ap >= AP_MAX) return null;
  return Math.max(0, AP_REGEN_MS - (now - state.apUpdatedAt));
}
