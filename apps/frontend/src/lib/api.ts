import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor : ajoute le Bearer token ───────────────────────
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor : rafraîchit le token si 401 ─────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(toAppError(error));
    }

    const refreshToken = Cookies.get('refreshToken');
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(toAppError(error));
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          if (original && original.headers) {
            original.headers.Authorization = `Bearer ${token}`;
          }
          resolve(api(original!));
        });
      });
    }

    isRefreshing = true;
    original!._retry = true;

    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/v1/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = data.data ?? data;

      setTokens(accessToken, newRefresh);
      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];

      if (original && original.headers) {
        original.headers.Authorization = `Bearer ${accessToken}`;
      }
      return api(original!);
    } catch {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(toAppError(error));
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Helpers ───────────────────────────────────────────────────────────
export function setTokens(accessToken: string, refreshToken: string) {
  Cookies.set('accessToken', accessToken, { secure: false, sameSite: 'strict' });
  Cookies.set('refreshToken', refreshToken, { secure: false, sameSite: 'strict', expires: 7 });
}

export function clearTokens() {
  Cookies.remove('accessToken');
  Cookies.remove('refreshToken');
}

function toAppError(error: AxiosError): Error {
  const data = error.response?.data as Record<string, unknown> | undefined;
  const message = data?.error ?? data?.message ?? error.message ?? 'Erreur réseau';
  return new Error(Array.isArray(message) ? String(message[0]) : String(message));
}
