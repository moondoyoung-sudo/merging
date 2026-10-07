import type { GameState } from '../game/types';

/**
 * 게임 저장소 인터페이스.
 * 로컬 저장 / 서버 저장 / (앱에서) Capacitor Preferences 등을
 * 이 인터페이스만 맞춰서 갈아끼울 수 있습니다. UI·게임 로직은 바뀌지 않아요.
 */
export interface GameRepository {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
}
