import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { supabase } from './supabase'

const BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000'

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      'x-app-version': '1.0.0',
    },
  })

  // ── Request interceptor — inject JWT + tenant ────────────
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    // Prioridad: token propio del backend → sesión de Supabase
    const jwtToken = localStorage.getItem('regx:access_token')
    if (jwtToken) {
      config.headers.Authorization = `Bearer ${jwtToken}`
    } else {
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`
      }
    }

    const tenantId = localStorage.getItem('regx:tenant_id')
    if (tenantId) config.headers['x-tenant-id'] = tenantId

    const branchId = localStorage.getItem('regx:branch_id')
    if (branchId) config.headers['x-branch-id'] = branchId

    return config
  })

  // ── Response interceptor — handle 401 ───────────────────
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        const refreshToken = localStorage.getItem('regx:refresh_token')
        if (refreshToken) {
          try {
            const { data } = await client.post<{ data: { tokens: { accessToken: string; refreshToken: string } } }>(
              '/auth/refresh',
              { refreshToken },
            )
            const { accessToken, refreshToken: newRefresh } = data.data.tokens
            localStorage.setItem('regx:access_token',  accessToken)
            localStorage.setItem('regx:refresh_token', newRefresh)
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`
            }
            return client(originalRequest)
          } catch {
            // refresh falló → forzar logout
          }
        }

        localStorage.removeItem('regx:access_token')
        localStorage.removeItem('regx:refresh_token')
        window.location.href = '/auth/login'
        return Promise.reject(error)
      }

      return Promise.reject(error)
    },
  )

  return client
}

export const api = createApiClient()

// ── Typed request helpers ────────────────────────────────────

export const get = <T>(url: string, config?: AxiosRequestConfig) =>
  api.get<T>(url, config).then((r) => r.data)

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.post<T>(url, data, config).then((r) => r.data)

export const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.put<T>(url, data, config).then((r) => r.data)

export const patch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.patch<T>(url, data, config).then((r) => r.data)

export const del = <T>(url: string, config?: AxiosRequestConfig) =>
  api.delete<T>(url, config).then((r) => r.data)
