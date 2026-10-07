import type { ApiClient } from '../api/client';
import { sanitizeState } from '../game/rules';
import type { GameState } from '../game/types';
import type { GameRepository } from './repository';

/**
 * 서버 저장 예시 (GET/PUT /game). 서버 스펙에 맞춰 수정해서 쓰세요.
 * - 로컬에도 항상 저장해서 오프라인/서버 장애에 대비
 * - AP 충전·생성 같은 규칙은 결국 서버에서도 검증해야 치팅을 막을 수 있어요
 *   (game/ 폴더가 순수 TS라 서버(Node)에서 그대로 import 가능)
 */
export class RemoteGameRepository implements GameRepository {
  constructor(
    private readonly api: ApiClient,
    private readonly local: GameRepository,
  ) {}

  async load(): Promise<GameState | null> {
    try {
      const remote = sanitizeState(await this.api.get<unknown>('/game'));
      if (remote) return remote;
    } catch {
      /* 서버 실패 → 로컬 사용 */
    }
    return this.local.load();
  }
  async save(state: GameState): Promise<void> {
    await this.local.save(state);
    try {
      await this.api.put('/game', state);
    } catch {
      /* 다음 저장 때 재시도 */
    }
  }
  async clear(): Promise<void> {
    await this.local.clear();
  }
}
