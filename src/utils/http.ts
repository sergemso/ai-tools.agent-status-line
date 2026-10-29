// HTTP fetch with timeout

export interface FetchOptions {
  timeout?: number; // milliseconds
  headers?: Record<string, string>;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  const { timeout = 20000, headers = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "claude-code-status-line/1.0",
        ...headers,
      },
    });

    clearTimeout(timeoutId);

    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
      json: () => response.json(),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}