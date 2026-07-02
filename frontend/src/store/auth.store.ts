import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User, Session } from '@supabase/supabase-js'

// -- Types ----------------------------------------------------

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
  primaryColor?: string
  secondaryColor?: string
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

// -- Role -> permission map -----------------------------------
// Define que puede hacer cada rol de negocio.
// '*' significa acceso total al negocio.

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER:             ['*'],
  ADMIN:             ['sales.create', 'products.view', 'inventory.view', 'reports.view', 'kitchen.view', 'restaurant.view', 'restaurant.order.create', 'restaurant.tables.manage'],
  CASHIER:           ['sales.create', 'products.view', 'inventory.view', 'restaurant.view', 'restaurant.order.create'],
  // Mesero: SOLO ve el mapa de mesas y crea cuentas nuevas. Nada más.
  WAITER:            ['restaurant.view', 'restaurant.order.create'],
  CHEF:              ['kitchen.view'],
  BARTENDER:         ['sales.create', 'kitchen.view', 'restaurant.view', 'restaurant.order.create'],
  ACCOUNTANT:        ['reports.view', 'inventory.view'],
  INVENTORY_MANAGER: ['inventory.view', 'products.view'],
}

// -- Store types ----------------------------------------------

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

// -- Store ----------------------------------------------------

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
          localStorage.removeItem('regx:access_token')
          localStorage.removeItem('regx:refresh_token')
        }),

      hasPermission: (permission: string) => {
        const { profile } = get()
        if (!profile) return false
        // SUPER_ADMIN tiene acceso total a todo
        if (profile.platformRole === 'SUPER_ADMIN') return true
        // Permisos por rol de negocio
        const rolePerms = ROLE_PERMISSIONS[profile.businessRole ?? ''] ?? []
        if (rolePerms.includes('*')) return true
        if (rolePerms.includes(permission)) return true
        // Permisos adicionales explícitos
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
