import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Suppliers from './pages/Suppliers'
import Customers from './pages/Customers'
import Warehouses from './pages/Warehouses'
import Transfers from './pages/Transfers'
import Purchasing from './pages/Purchasing'
import Sales from './pages/Sales'
import Receiving from './pages/Receiving'
import Putaway from './pages/Putaway'
import Picking from './pages/Picking'
import Packing from './pages/Packing'
import Shipping from './pages/Shipping'
import Returns from './pages/Returns'
import StockCount from './pages/StockCount'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'
import Locations from './pages/Locations'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Assistant from './pages/Assistant'
import { RequirePermission } from './components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequirePermission permission={'dashboard.view'}><Dashboard /></RequirePermission>} />
        <Route path="/inventory" element={<RequirePermission permission={'stock.view'}><Inventory /></RequirePermission>} />
        <Route path="/products" element={<RequirePermission permission={'products.view'}><Products /></RequirePermission>} />
        <Route path="/suppliers" element={<RequirePermission permission={'suppliers.view'}><Suppliers /></RequirePermission>} />
        <Route path="/customers" element={<RequirePermission permission={'customers.view'}><Customers /></RequirePermission>} />
        <Route path="/warehouses" element={<RequirePermission permission={'warehouses.view'}><Warehouses /></RequirePermission>} />
        <Route path="/transfers" element={<RequirePermission permission={'transfers.view'}><Transfers /></RequirePermission>} />
        <Route path="/purchasing" element={<RequirePermission permission={'purchase-orders.view'}><Purchasing /></RequirePermission>} />
        <Route path="/sales" element={<RequirePermission permission={'sales-orders.view'}><Sales /></RequirePermission>} />
        <Route path="/receiving" element={<RequirePermission permission={['purchase-orders.receive', 'purchase-orders.view']}><Receiving /></RequirePermission>} />
        <Route path="/putaway" element={<RequirePermission permission={'putaway.view'}><Putaway /></RequirePermission>} />
        <Route path="/packing" element={<RequirePermission permission={'packing.view'}><Packing /></RequirePermission>} />
        <Route path="/shipping" element={<RequirePermission permission={'shipping.view'}><Shipping /></RequirePermission>} />
        <Route path="/returns" element={<RequirePermission permission={'returns.view'}><Returns /></RequirePermission>} />
        <Route path="/stock-counts" element={<RequirePermission permission={'stock-counts.view'}><StockCount /></RequirePermission>} />
        <Route path="/reports" element={<RequirePermission permission={'reports.view'}><Reports /></RequirePermission>} />
        <Route path="/audit-logs" element={<RequirePermission permission={'audit-logs.view'}><AuditLogs /></RequirePermission>} />
        <Route path="/locations" element={<RequirePermission permission={'locations.view'}><Locations /></RequirePermission>} />
        <Route path="/users" element={<RequirePermission permission={'users.view'}><Users /></RequirePermission>} />
        <Route path="/picking" element={<RequirePermission permission={'picking.view'}><Picking /></RequirePermission>} />
        <Route path="/assistant" element={<RequirePermission permission="dashboard.view"><Assistant /></RequirePermission>} />
        <Route path="/settings" element={<RequirePermission permission={'settings.view'}><Settings /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}