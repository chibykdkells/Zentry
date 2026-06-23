import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { resolveTenantSlugForRequest } from '@/lib/tenant-runtime';

function resolveApiBaseUrl() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return '/api/v1';
  }

  const configuredApiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return `${configuredApiUrl.replace(/\/$/, '')}/api/v1`;
}

const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // sends httpOnly refresh token cookie
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token from store
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;
  const tenantSlug = resolveTenantSlugForRequest();

  if (accessToken && config.headers) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (tenantSlug && config.headers && !config.headers['x-tenant-slug']) {
    config.headers['x-tenant-slug'] = tenantSlug;
  }

  return config;
});

// Response interceptor — silent token refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const authRecoveryBypassPaths = [
  '/auth/login',
  '/auth/register/individual',
  '/auth/register/cbt',
  '/auth/verify-email',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  failedQueue = [];
}

function buildLoginRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/access-required?reason=tenant-link';
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const tenantSlug = resolveTenantSlugForRequest();
  const loginUrl = new URL(
    window.location.pathname.startsWith('/admin')
      ? '/platform/login'
      : tenantSlug
        ? '/login'
        : '/access-required',
    window.location.origin,
  );

  loginUrl.searchParams.set('reason', 'session-expired');
  if (tenantSlug && loginUrl.pathname === '/login') {
    loginUrl.searchParams.set('tenant', tenantSlug);
  }

  if (
    loginUrl.pathname !== '/access-required' &&
    currentPath !== loginUrl.pathname
  ) {
    loginUrl.searchParams.set('next', currentPath);
  }

  return loginUrl.toString();
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
    const shouldBypassRecovery = authRecoveryBypassPaths.some((path) =>
      originalRequest?.url?.includes(path),
    );

    // Only attempt a silent token refresh when the original request actually
    // carried an Authorization header.  If there was no header, the request
    // was made before AuthBootstrap finished (accessToken was null).
    // Racing with AuthBootstrap here causes two concurrent refresh calls,
    // which leads to duplicate setAccessToken() calls and socket churn.
    // React Query's built-in retry will re-attempt the request once
    // AuthBootstrap has set a valid token (~1 refresh RTT later).
    const hadToken = Boolean(originalRequest.headers?.['Authorization']);

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !shouldBypassRecovery &&
      hadToken
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{
          data: { accessToken: string };
        }>('/auth/refresh');

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          useAuthStore.getState().clearAuth();
          window.location.href = buildLoginRedirectUrl();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
