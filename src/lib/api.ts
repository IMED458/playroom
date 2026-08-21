import { handleRequest } from '../core/app';

const TOKEN_KEY = 'playroom_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * მოთხოვნა მუშავდება ბრაუზერშივე — სერვერი არ არსებობს.
 * ხელმოწერა შენარჩუნებულია, რომ კომპონენტების კოდი უცვლელი დარჩეს.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  let body: any = undefined;
  if (typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = options.body;
    }
  } else if (options.body) {
    body = options.body;
  }

  const { status, data } = await handleRequest(method, endpoint, body, getToken());

  if (status < 200 || status >= 300) {
    if (status === 401) {
      removeToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new Error(data?.error || data?.message || `მოთხოვნის შეცდომა (${status})`);
  }

  return data as T;
}
