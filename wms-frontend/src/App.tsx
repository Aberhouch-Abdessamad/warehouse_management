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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/products" element={<Products />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/warehouses" element={<Warehouses />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/purchasing" element={<Purchasing />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/receiving" element={<Receiving />} />
        <Route path="/putaway" element={<Putaway />} />
        <Route path="/packing" element={<Packing />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/stock-counts" element={<StockCount />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/users" element={<Users />} />
        <Route path="/picking" element={<Picking />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}