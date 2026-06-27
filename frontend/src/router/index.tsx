import { createBrowserRouter, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { FullscreenLoader } from '@shared/components/FullscreenLoader'
import { AuthLayout } from '@shared/layouts/AuthLayout'
import { AppLayout } from '@shared/layouts/AppLayout'
import { POSLayout } from '@shared/layouts/POSLayout'
import { RequireAuth } from '@shared/components/RequireAuth'
import { RequirePermission } from '@shared/components/RequirePermission'
import { RequirePlatformRole } from '@shared/components/RequirePlatformRole'
import { useAuthStore } from '@store/auth.store'

// -- Lazy pages -----------------------------------------------

const LoginPage        = lazy(() => import('@modules/auth/pages/LoginPage'))
const RegisterPage     = lazy(() => import('@modules/auth/pages/RegisterPage'))
const ForgotPage       = lazy(() => import('@modules/auth/pages/ForgotPage'))
const MFAPage          = lazy(() => import('@modules/auth/pages/MFAPage'))

const DashboardPage    = lazy(() => import('@modules/dashboard/pages/DashboardPage'))
const SaaSDashboard    = lazy(() => import('@modules/dashboard/pages/SaaSDashboardPage'))

// Platform (SUPER_ADMIN)
const PlatformDashboard = lazy(() => import('@modules/platform/pages/PlatformDashboardPage'))
const PlatformTenants   = lazy(() => import('@modules/platform/pages/TenantsPage'))
const PlatformUsers     = lazy(() => import('@modules/platform/pages/PlatformUsersPage'))
const PlatformPlans     = lazy(() => import('@modules/platform/pages/PlatformPlansPage'))

const POSPage          = lazy(() => import('@modules/pos/pages/POSPage'))

const ProductsPage     = lazy(() => import('@modules/products/pages/ProductsPage'))
const ProductFormPage  = lazy(() => import('@modules/products/pages/ProductFormPage'))
const CategoriesPage   = lazy(() => import('@modules/products/pages/CategoriesPage'))

const InventoryPage    = lazy(() => import('@modules/inventory/pages/InventoryPage'))
const AlertsPage       = lazy(() => import('@modules/inventory/pages/AlertsPage'))
const ValuationPage    = lazy(() => import('@modules/inventory/pages/ValuationPage'))
const StockMovements   = lazy(() => import('@modules/inventory/pages/StockMovementsPage'))
const TransfersPage    = lazy(() => import('@modules/inventory/pages/TransfersPage'))

const CustomersPage    = lazy(() => import('@modules/customers/pages/CustomersPage'))

const ReportsPage      = lazy(() => import('@modules/reports/pages/ReportsPage'))
const SalesReport      = lazy(() => import('@modules/reports/pages/SalesReportPage'))

const SettingsPage     = lazy(() => import('@modules/settings/pages/SettingsPage'))

const RestaurantPage   = lazy(() => import('@modules/restaurant/pages/RestaurantPage'))
const TablesPage       = lazy(() => import('@modules/restaurant/pages/TablesPage'))
const KDSPage          = lazy(() => import('@modules/restaurant/pages/KDSPage'))

const SubscriptionsPage = lazy(() => import('@modules/subscriptions/pages/SubscriptionsPage'))
const MarketplacePage   = lazy(() => import('@modules/marketplace/pages/MarketplacePage'))
const EmployeesPage     = lazy(() => import('@modules/employees/pages/EmployeesPage'))

const NotFoundPage = lazy(() => import('@shared/pages/NotFoundPage'))

// -- Suspense wrapper -----------------------------------------

const Page = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullscreenLoader />}>{children}</Suspense>
)

// -- Smart home redirect --------------------------------------
// SUPER_ADMIN -> /admin  |  todos los demas -> /dashboard
function SmartHome() {
  const profile   = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)
  const navigate  = useNavigate()

  useEffect(() => {
    if (isLoading) return
    const dest = profile?.platformRole === 'SUPER_ADMIN' ? '/admin' : '/dashboard'
    navigate(dest, { replace: true })
  }, [profile, isLoading, navigate])

  return <FullscreenLoader />
}

// -- Router ---------------------------------------------------

export const router = createBrowserRouter([
  // Auth (unauthenticated)
  {
    path: '/auth',
    element: <AuthLayout><Outlet /></AuthLayout>,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login',    element: <Page><LoginPage /></Page> },
      { path: 'register', element: <Page><RegisterPage /></Page> },
      { path: 'forgot',   element: <Page><ForgotPage /></Page> },
      { path: 'mfa',      element: <Page><MFAPage /></Page> },
    ],
  },

  // POS (touch UI - minimal chrome)
  {
    path: '/pos',
    element: (
      <RequireAuth>
        <RequirePermission permission="sales.create">
          <POSLayout><Outlet /></POSLayout>
        </RequirePermission>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Page><POSPage /></Page> },
    ],
  },

  // Kitchen Display System
  {
    path: '/kds',
    element: (
      <RequireAuth>
        <RequirePermission permission="kitchen.view">
          <Outlet />
        </RequirePermission>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Page><KDSPage /></Page> },
    ],
  },

  // Main App
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout><Outlet /></AppLayout>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <SmartHome /> },

      // Regular dashboard
      { path: 'dashboard', element: <Page><DashboardPage /></Page> },
      { path: 'saas',      element: <Page><SaaSDashboard /></Page> },

      // Platform Admin (SUPER_ADMIN only)
      {
        path: 'admin',
        element: <RequirePlatformRole role="SUPER_ADMIN"><Outlet /></RequirePlatformRole>,
        children: [
          { index: true,      element: <Page><PlatformDashboard /></Page> },
          { path: 'tenants',  element: <Page><PlatformTenants /></Page> },
          { path: 'users',    element: <Page><PlatformUsers /></Page> },
          { path: 'plans',    element: <Page><PlatformPlans /></Page> },
        ],
      },

      // Products
      {
        path: 'products',
        element: <RequirePermission permission="products.view"><Outlet /></RequirePermission>,
        children: [
          { index: true,        element: <Page><ProductsPage /></Page> },
          { path: 'new',        element: <Page><ProductFormPage /></Page> },
          { path: ':id/edit',   element: <Page><ProductFormPage /></Page> },
          { path: 'categories', element: <Page><CategoriesPage /></Page> },
        ],
      },

      // Inventory
      {
        path: 'inventory',
        element: <RequirePermission permission="inventory.view"><Outlet /></RequirePermission>,
        children: [
          { index: true,       element: <Page><InventoryPage /></Page> },
          { path: 'alerts',    element: <Page><AlertsPage /></Page> },
          { path: 'valuation', element: <Page><ValuationPage /></Page> },
          { path: 'movements', element: <Page><StockMovements /></Page> },
          { path: 'transfers', element: <Page><TransfersPage /></Page> },
        ],
      },

      // Customers
      { path: 'customers', element: <Page><CustomersPage /></Page> },

      // Employees
      { path: 'employees', element: <Page><EmployeesPage /></Page> },

      // Restaurant
      {
        path: 'restaurant',
        children: [
          { index: true,    element: <Page><RestaurantPage /></Page> },
          { path: 'tables', element: <Page><TablesPage /></Page> },
        ],
      },

      // Reports
      {
        path: 'reports',
        element: <RequirePermission permission="reports.view"><Outlet /></RequirePermission>,
        children: [
          { index: true,   element: <Page><ReportsPage /></Page> },
          { path: 'sales', element: <Page><SalesReport /></Page> },
        ],
      },

      // Settings
      { path: 'settings/*', element: <Page><SettingsPage /></Page> },

      // Subscriptions
      { path: 'subscriptions', element: <Page><SubscriptionsPage /></Page> },

      // Marketplace
      { path: 'marketplace', element: <Page><MarketplacePage /></Page> },
    ],
  },

  // 404
  { path: '*', element: <Page><NotFoundPage /></Page> },
])
