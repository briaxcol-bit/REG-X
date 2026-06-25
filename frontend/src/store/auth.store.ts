import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User, Session } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────

export type PlatformRole = 'SUPER_ADMIN' | 'SUPPORT' | 'SALES_MANAGER'
export type BusinessRole =
  | 'OWNER' | 'ADMIN' | 'CASHIER' | 'WAITER'
  | 'CHEF' | 'BARTENDER' | 'ACCOUNTANT' | 'INVENTORY_MANAGER'

export interface TenantContext {
  tenantId: string
  tenantName: string
  tenantSlug: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  businessType: string
  logoUrl?: string
}

export interface BranchContext {
  branchId: string
  branchName: string
  branchCode: string
  currency: string
  timezone: string
  country: string
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  avatarUrl?: string
  platformRole?: PlatformRole
  businessRole?: BusinessRole
  permissions: string[]
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  tenant: TenantContext | null
  branch: BranchContext | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setTenant: (tenant: TenantContext | null) => void
  setBranch: (branch: BranchContext | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: BusinessRole | PlatformRole) => boolean
}

type AuthStore = AuthState & AuthActions

// ── Store ────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    immer((set, get) => ({
      // State
      user: null,
      session: null,
      profile: null,
      tenant: null,
      branch: null,
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,

      // Actions
      setUser: (user) =>
        set((state) => {
          state.user = user
          state.isAuthenticated = !!user
        }),

      setSession: (session) =>
        set((state) => {
          state.session = session
        }),

      setProfile: (profile) =>
        set((state) => {
          state.profile = profile
        }),

      setTenant: (tenant) => {
        set((state) => { state.tenant = tenant })
        if (tenant) {
          localStorage.setItem('regx:tenant_id', tenant.tenantId)
        } else {
          localStorage.removeItem('regx:tenant_id')
        }
      },

      setBranch: (branch) => {
        set((state) => { state.branch = branch })
        if (branch) {
          localStorage.setItem('regx:branch_id', branch.branchId)
        } else {
          localStorage.removeItem('regx:branch_id')
        }
      },

      setLoading: (loading) =>
        set((state) => { state.isLoading = loading }),

      setInitialized: (initialized) =>
        set((state) => { state.isInitialized = initialized }),

      logout: () =>
        set((state) => {
          state.user = null
          state.session = null
          state.profile = null
          state.tenant = null
          state.branch = null
          state.isAuthenticated = false
          localStorage.removeItem('regx:tenant_id')
          localStorage.removeItem('regx:branch_id')
        }),

      hasPermission: (permission: string) => {
        const { profile } = get()
        if (!profile) return false
        if (profile.platformRole === 'SUPER_ADMIN') return true
        return profile.permissions.includes(permission)
      },

      hasRole: (role: BusinessRole | PlatformRole) => {
        const { profile } = get()
        if (!profile) return false
        return profile.platformRole === role || profile.businessRole === role
      },
    })),
    {
      name: 'regx:auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        tenant: state.tenant,
        branch: state.branch,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
