const USER_AGENT =
  'jobbradar/1.0 (personal job tracker; +https://github.com/leonc67/jobbradar)';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

/** fetch med timeout, enkel retry og en User-Agent som sier hvem vi er. */
export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', headers = {}, body, timeoutMs = 20_000, retries = 2 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      // 5xx og 429 er verdt å prøve igjen, alt annet returneres som det er
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`${res.status} ${res.statusText} fra ${url}`);
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(1000 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function getJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fra ${url}`);
  return (await res.json()) as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
