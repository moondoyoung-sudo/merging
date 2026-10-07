/**
 * REST API 클라이언트 (서버 붙일 때 사용).
 * Firebase/Supabase든 직접 만든 서버든 fetch로 호출하는 구조는 동일합니다.
 */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export function createApiClient(baseUrl: string, getToken?: () => string | null): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = getToken?.();
    const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    get: (path) => request('GET', path),
    put: (path, body) => request('PUT', path, body),
    post: (path, body) => request('POST', path, body),
  };
}
