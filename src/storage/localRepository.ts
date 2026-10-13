import { sanitizeState } from '../game/rules';
import type { GameState } from '../game/types';
import type { GameRepository } from './repository';

const KEY = 'crossword-merge-save-v1';

export class LocalGameRepository implements GameRepository {
  async load(): Promise<GameState | null> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? sanitizeState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  async save(state: GameState): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 저장 공간 부족/사생활 보호 모드 등: 무시 */
    }
  }
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
