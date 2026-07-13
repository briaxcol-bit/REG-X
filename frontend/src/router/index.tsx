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
const PlatformModules   = lazy(() => import('@modules/platform/pages/PlatformModulesPage'))
const PlatformModuleMap = lazy(() => import('@modules/platform/pages/PlatformModuleMapPage'))
const PlatformPayments  = lazy(() => import('@modules/platform/pages/PlatformPaymentsPage'))

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
const SuppliersPage     = lazy(() => import('@modules/suppliers/pages/SuppliersPage'))
const ExpensesPage      = lazy(() => import('@modules/expenses/pages/ExpensesPage'))
const PurchaseOrdersPage = lazy(() => import('@modules/purchasing/pages/PurchaseOrdersPage'))
const PriceListsPage     = lazy(() => import('@modules/pricelists/pages/PriceListsPage'))
const GiftCardsPage      = lazy(() => import('@modules/giftcards/pages/GiftCardsPage'))
const LayawaysPage       = lazy(() => import('@modules/layaways/pages/LayawaysPage'))
const DrugCatalogPage    = lazy(() => import('@modules/pharmacy/pages/DrugCatalogPage'))
const BatchTrackingPage  = lazy(() => import('@modules/pharmacy/pages/BatchTrackingPage'))
const ExpiryControlPage  = lazy(() => import('@modules/pharmacy/pages/ExpiryControlPage'))
const PrescriptionsPage  = lazy(() => import('@modules/pharmacy/pages/PrescriptionsPage'))
const QuotesPage         = lazy(() => import('@modules/hardware/pages/QuotesPage'))
const WorkOrdersPage     = lazy(() => import('@modules/hardware/pages/WorkOrdersPage'))
const AssembliesPage     = lazy(() => import('@modules/hardware/pages/AssembliesPage'))
const UnitConversionPage = lazy(() => import('@modules/hardware/pages/UnitConversionPage'))
const SerialTrackingPage = lazy(() => import('@modules/hardware/pages/SerialTrackingPage'))
const AccountingPage     = lazy(() => import('@modules/finance/pages/AccountingPage'))
const ReceivablesPage    = lazy(() => import('@modules/finance/pages/ReceivablesPage'))
const PayablesPage       = lazy(() => import('@modules/finance/pages/PayablesPage'))
const TaxReportsPage     = lazy(() => import('@modules/finance/pages/TaxReportsPage'))
const PayrollPage        = lazy(() => import('@modules/finance/pages/PayrollPage'))
const BranchesPage       = lazy(() => import('@modules/advanced/pages/BranchesPage'))
const EcommercePage      = lazy(() => import('@modules/advanced/pages/EcommercePage'))
const WebhooksPage       = lazy(() => import('@modules/advanced/pages/WebhooksPage'))
const AuditPage          = lazy(() => import('@modules/advanced/pages/AuditPage'))
const AttendancePage    = lazy(() => import('@modules/attendance/pages/AttendancePage'))
const CommissionsPage   = lazy(() => import('@modules/commissions/pages/CommissionsPage'))
const TipsPage          = lazy(() => import('@modules/tips/pages/TipsPage'))
const ReservationsPage  = lazy(() => import('@modules/reservations/pages/ReservationsPage'))
const BarTabsPage       = lazy(() => import('@modules/bartabs/pages/BarTabsPage'))
const DeliveryPage      = lazy(() => import('@modules/delivery/pages/DeliveryPage'))
const MenuQRPage        = lazy(() => import('@modules/menu/pages/MenuQRPage'))
const PublicMenuPage    = lazy(() => import('@modules/menu/pages/PublicMenuPage'))
const SplitBillPage     = lazy(() => import('@modules/splitbill/pages/SplitBillPage'))
const PromotionsPage    = lazy(() => import('@modules/promotions/pages/PromotionsPage'))
const LoyaltyPage       = lazy(() => import('@modules/loyalty/pages/LoyaltyPage'))
const LabelPrinterPage  = lazy(() => import('@modules/labels/pages/LabelPrinterPage'))

const NotFoundPage = lazy(() => import('@shared/pages/NotFoundPage'))

// -- Suspense wrapper -----------------------------------------

const Page = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullscreenLoader />}>{children}</Suspense>
)

// -- Guard: bloquea acceso de cajeros a rutas de gestión ------
function NoCashier({ children }: { children: React.ReactNode }) {
  const profile   = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) return <FullscreenLoader />
  if (profile?.businessRole === 'CASHIER') return <Navigate to="/pos" replace />
  return <>{children}</>
}

// -- Guard: el mesero solo puede estar en el mapa de mesas -----
// Cualquier ruta que no sea de restaurante lo devuelve a /restaurant/tables.
function NoWaiter({ children }: { children: React.ReactNode }) {
  const profile   = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) return <FullscreenLoader />
  if (profile?.businessRole === 'WAITER') return <Navigate to="/restaurant/tables" replace />
  return <>{children}</>
}

// -- Guard: el chef/cocinero SOLO puede acceder al KDS ----------
// Cualquier intento de entrar al AppLayout lo devuelve a /kds.
function NoChef({ children }: { children: React.ReactNode }) {
  const profile   = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) return <FullscreenLoader />
  if (profile?.businessRole === 'CHEF') return <Navigate to="/kds" replace />
  return <>{children}</>
}

// -- Smart home redirect --------------------------------------
// SUPER_ADMIN -> /admin  |  CASHIER -> /pos  |  WAITER -> /restaurant/tables
// CHEF -> /kds           |  todos los demás  -> /dashboard
function SmartHome() {
  const profile   = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)
  const navigate  = useNavigate()

  useEffect(() => {
    if (isLoading) return
    let dest = '/dashboard'
    if (profile?.platformRole === 'SUPER_ADMIN') dest = '/admin'
    else if (profile?.businessRole === 'CASHIER') dest = '/pos'
    else if (profile?.businessRole === 'WAITER')  dest = '/restaurant/tables'
    else if (profile?.businessRole === 'CHEF')    dest = '/kds'
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

  // Menú público (sin login) — destino del código QR
  { path: '/m/:slug', element: <Page><PublicMenuPage /></Page> },

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

  // Main App (CHEF is blocked here — redirected to /kds)
  {
    path: '/',
    element: (
      <RequireAuth>
        <NoChef>
          <AppLayout><Outlet /></AppLayout>
        </NoChef>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <SmartHome /> },

      // Regular dashboard — OWNER/ADMIN. Cajero redirige al POS, mesero al mapa de mesas.
      { path: 'dashboard', element: <NoWaiter><NoCashier><Page><DashboardPage /></Page></NoCashier></NoWaiter> },
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
          { path: 'modules',  element: <Page><PlatformModules /></Page> },
          { path: 'module-map', element: <Page><PlatformModuleMap /></Page> },
          { path: 'payments',   element: <Page><PlatformPayments /></Page> },
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
      { path: 'customers', element: <NoWaiter><Page><CustomersPage /></Page></NoWaiter> },

      // Employees
      { path: 'employees', element: <NoWaiter><Page><EmployeesPage /></Page></NoWaiter> },

      // Suppliers (módulo)
      { path: 'suppliers', element: <NoWaiter><NoCashier><Page><SuppliersPage /></Page></NoCashier></NoWaiter> },

      // Expenses (módulo)
      { path: 'expenses', element: <NoWaiter><NoCashier><Page><ExpensesPage /></Page></NoCashier></NoWaiter> },

      // Retail
      { path: 'purchase-orders', element: <NoWaiter><NoCashier><Page><PurchaseOrdersPage /></Page></NoCashier></NoWaiter> },
      { path: 'price-lists',     element: <NoWaiter><NoCashier><Page><PriceListsPage /></Page></NoCashier></NoWaiter> },
      { path: 'gift-cards',      element: <NoWaiter><NoCashier><Page><GiftCardsPage /></Page></NoCashier></NoWaiter> },
      { path: 'layaways',        element: <NoWaiter><NoCashier><Page><LayawaysPage /></Page></NoCashier></NoWaiter> },

      // Farmacia
      { path: 'drug-catalog',    element: <NoWaiter><NoCashier><Page><DrugCatalogPage /></Page></NoCashier></NoWaiter> },
      { path: 'batches',         element: <NoWaiter><NoCashier><Page><BatchTrackingPage /></Page></NoCashier></NoWaiter> },
      { path: 'expiry-control',  element: <NoWaiter><NoCashier><Page><ExpiryControlPage /></Page></NoCashier></NoWaiter> },
      { path: 'prescriptions',   element: <NoWaiter><NoCashier><Page><PrescriptionsPage /></Page></NoCashier></NoWaiter> },

      // Ferretería / Industrial
      { path: 'quotes',          element: <NoWaiter><NoCashier><Page><QuotesPage /></Page></NoCashier></NoWaiter> },
      { path: 'work-orders',     element: <NoWaiter><NoCashier><Page><WorkOrdersPage /></Page></NoCashier></NoWaiter> },
      { path: 'assemblies',      element: <NoWaiter><NoCashier><Page><AssembliesPage /></Page></NoCashier></NoWaiter> },
      { path: 'unit-conversion', element: <NoWaiter><NoCashier><Page><UnitConversionPage /></Page></NoCashier></NoWaiter> },
      { path: 'serials',         element: <NoWaiter><NoCashier><Page><SerialTrackingPage /></Page></NoCashier></NoWaiter> },

      // Finanzas
      { path: 'accounting',      element: <NoWaiter><NoCashier><Page><AccountingPage /></Page></NoCashier></NoWaiter> },
      { path: 'receivables',     element: <NoWaiter><NoCashier><Page><ReceivablesPage /></Page></NoCashier></NoWaiter> },
      { path: 'payables',        element: <NoWaiter><NoCashier><Page><PayablesPage /></Page></NoCashier></NoWaiter> },
      { path: 'tax-reports',     element: <NoWaiter><NoCashier><Page><TaxReportsPage /></Page></NoCashier></NoWaiter> },
      { path: 'payroll',         element: <NoWaiter><NoCashier><Page><PayrollPage /></Page></NoCashier></NoWaiter> },

      // Avanzado
      { path: 'branches',        element: <NoWaiter><NoCashier><Page><BranchesPage /></Page></NoCashier></NoWaiter> },
      { path: 'ecommerce',       element: <NoWaiter><NoCashier><Page><EcommercePage /></Page></NoCashier></NoWaiter> },
      { path: 'webhooks',        element: <NoWaiter><NoCashier><Page><WebhooksPage /></Page></NoCashier></NoWaiter> },
      { path: 'audit',           element: <NoWaiter><NoCashier><Page><AuditPage /></Page></NoCashier></NoWaiter> },

      // Attendance (módulo)
      { path: 'attendance', element: <NoWaiter><NoCashier><Page><AttendancePage /></Page></NoCashier></NoWaiter> },

      // Commissions (módulo)
      { path: 'commissions', element: <NoWaiter><NoCashier><Page><CommissionsPage /></Page></NoCashier></NoWaiter> },

      // Tips (módulo)
      { path: 'tips', element: <NoWaiter><NoCashier><Page><TipsPage /></Page></NoCashier></NoWaiter> },

      // Reservations (módulo)
      { path: 'reservations', element: <NoWaiter><Page><ReservationsPage /></Page></NoWaiter> },

      // Bar tabs (módulo)
      { path: 'bar-tabs', element: <NoWaiter><Page><BarTabsPage /></Page></NoWaiter> },

      // Delivery (módulo)
      { path: 'delivery', element: <NoWaiter><Page><DeliveryPage /></Page></NoWaiter> },

      // Menú Digital QR (módulo)
      { path: 'menu-qr', element: <NoWaiter><NoCashier><Page><MenuQRPage /></Page></NoCashier></NoWaiter> },

      // Split bill (módulo)
      { path: 'split-bill', element: <NoWaiter><Page><SplitBillPage /></Page></NoWaiter> },

      // Promotions (módulo)
      { path: 'promotions', element: <NoWaiter><NoCashier><Page><PromotionsPage /></Page></NoCashier></NoWaiter> },

      // Loyalty (módulo)
      { path: 'loyalty', element: <NoWaiter><Page><LoyaltyPage /></Page></NoWaiter> },

      // Label printer (módulo)
      { path: 'labels', element: <NoWaiter><NoCashier><Page><LabelPrinterPage /></Page></NoCashier></NoWaiter> },

      // Restaurant
      {
        path: 'restaurant',
        element: <RequirePermission permission="restaurant.view"><Outlet /></RequirePermission>,
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
      { path: 'settings/*', element: <NoWaiter><Page><SettingsPage /></Page></NoWaiter> },

      // Subscriptions
      { path: 'subscriptions', element: <NoWaiter><Page><SubscriptionsPage /></Page></NoWaiter> },

      // Marketplace
      { path: 'marketplace', element: <NoWaiter><Page><MarketplacePage /></Page></NoWaiter> },
    ],
  },

  // 404
  { path: '*', element: <Page><NotFoundPage /></Page> },
])
