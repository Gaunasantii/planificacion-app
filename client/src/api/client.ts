import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retriedFallback?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;

    // Fallback transparently to port 4000 if port 3000 is unreachable and server runs on its default 4000 port
    if (
      !error.response &&
      error.code === 'ERR_NETWORK' &&
      config &&
      !config._retriedFallback &&
      apiClient.defaults.baseURL?.includes('localhost:3000')
    ) {
      config._retriedFallback = true;
      const fallbackBaseUrl = 'http://localhost:4000/api';
      apiClient.defaults.baseURL = fallbackBaseUrl;
      config.baseURL = fallbackBaseUrl;
      return apiClient.request(config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(
  err: unknown,
  fallback = 'Ocurrió un error al procesar la solicitud'
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | {
          error?: string;
          message?: string;
          details?: Array<{ path?: string; message?: string }>;
        }
      | undefined;

    if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
      const detailMessages = data.details
        .map((d) => d.message)
        .filter(Boolean)
        .join('. ');
      if (detailMessages) {
        return detailMessages;
      }
    }

    if (data?.error) {
      return data.error;
    }

    if (data?.message) {
      return data.message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}

export default apiClient;
