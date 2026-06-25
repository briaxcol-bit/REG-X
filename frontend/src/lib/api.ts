import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Inject tenant from localStorage (set on login)
    const tenantId = localStorage.getItem('regx:tenant_id')
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId
    }

    const branchId = localStorage.getItem('regx:branch_id')
    if (branchId) {
      config.headers['x-branch-id'] = branchId
    }

    return config
  })

  // ── Response interceptor — handle 401 ───────────────────
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        const { data, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !data.session) {
          await supabase.auth.signOut()
          window.location.href = '/auth/login'
          return Promise.reject(error)
        }

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${data.session.access_token}`
        }

        return client(originalRequest)
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
