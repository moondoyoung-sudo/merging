import { createApiClient } from '../api/client';
import { LocalGameRepository } from './localRepository';
import { RemoteGameRepository } from './remoteRepository';
import type { GameRepository } from './repository';

/** .env 에 VITE_API_BASE_URL 이 있으면 서버 저장, 없으면 로컬 저장 */
export function createRepository(): GameRepository {
  const local = new LocalGameRepository();
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return baseUrl ? new RemoteGameRepository(createApiClient(baseUrl), local) : local;
}
