import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Batches from '@/pages/Batches'
import BatchDetail from '@/pages/BatchDetail'
import PendataanList from '@/pages/PendataanList'
import PendataanDetail from '@/pages/PendataanDetail'
import PendataanForm from '@/pages/PendataanForm'
import DryingList from '@/pages/DryingList'
import DryingDetail from '@/pages/DryingDetail'
import InventoryList from '@/pages/InventoryList'
import InventoryDetail from '@/pages/InventoryDetail'
import Processes from '@/pages/Processes'
import ProcessDetail from '@/pages/ProcessDetail'
import ActivityLogs from '@/pages/ActivityLogs'
import Logistics from '@/pages/Logistics'
import LinkManagement from '@/pages/admin/LinkManagement'
import PurchaseForm from '@/pages/form/PurchaseForm'
import DryingForm from '@/pages/form/DryingForm'
import MySubmissions from '@/pages/form/MySubmissions'
import CustomerList from '@/pages/CustomerList'
import PriceListPage from '@/pages/PriceList'
import SalesList from '@/pages/SalesList'
import SalesDetail from '@/pages/SalesDetail'
import FinanceDashboard from '@/pages/FinanceDashboard'
import COAList from '@/pages/COAList'
import OverheadList from '@/pages/OverheadList'
import DebtManager from '@/pages/DebtManager'
import Settings from '@/pages/Settings'
import FinanceLedger from '@/pages/FinanceLedger'
import FinanceAccounts from '@/pages/FinanceAccounts'

import ApprovalManager from '@/pages/ApprovalManager'
import AIAnalysis from '@/pages/AIAnalysis'
import Community from '@/pages/community/Community'
import { Toaster } from 'react-hot-toast'

import MillingForm from '@/pages/form/MillingForm'
import MasterPage from '@/pages/admin/MasterPage'
import MasterAccount from '@/pages/admin/MasterAccount'
import ColorsPreview from '@/pages/ColorsPreview'
import SystemMonitoring from '@/pages/admin/SystemMonitoring'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="spinner"></div>
                <p className="text-slate-400">Loading...</p>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <>
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#fff' } }} containerStyle={{ zIndex: 99999 }} />
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Employee Form Routes (requires auth) */}
                <Route path="/form/batch/:linkCode" element={
                    <ProtectedRoute>
                        <PurchaseForm />
                    </ProtectedRoute>
                } />
                <Route path="/drying-form/:linkCode" element={
                    <ProtectedRoute>
                        <DryingForm />
                    </ProtectedRoute>
                } />
                <Route path="/milling-form/:code" element={
                    <ProtectedRoute>
                        <MillingForm />
                    </ProtectedRoute>
                } />
                <Route path="/form/my-submissions" element={
                    <ProtectedRoute>
                        <MySubmissions />
                    </ProtectedRoute>
                } />

                {/* Standalone Community Route */}
                <Route path="/community" element={
                    <ProtectedRoute>
                        <Community />
                    </ProtectedRoute>
                } />
                <Route path="/colors" element={<ColorsPreview />} />

                {/* Admin Dashboard Routes */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="batches" element={<Batches />} />
                    <Route path="batches/:id" element={<BatchDetail />} />
                    <Route path="batches/:id/links" element={<LinkManagement />} />
                    <Route path="pendataan" element={<PendataanList />} />
                    <Route path="pendataan/new" element={<PendataanForm />} />
                    <Route path="pendataan/edit/:id" element={<PendataanForm />} />
                    <Route path="pendataan/:id" element={<PendataanDetail />} />
                    <Route path="drying" element={<DryingList />} />
                    <Route path="drying/:id" element={<DryingDetail />} />
                    <Route path="inventory" element={<InventoryList />} />
                    <Route path="inventory/:id" element={<InventoryDetail />} />
                    <Route path="processes" element={<Processes />} />
                    <Route path="processes/:id" element={<ProcessDetail />} />
                    <Route path="customers" element={<CustomerList />} />
                    <Route path="price-list" element={<PriceListPage />} />
                    <Route path="sales" element={<SalesList />} />
                    <Route path="sales/:id" element={<SalesDetail />} />
                    <Route path="finance" element={<FinanceDashboard />} />
                    <Route path="finance/coa" element={<COAList />} />
                    <Route path="finance/overhead" element={<OverheadList />} />
                    <Route path="finance/debt" element={<DebtManager />} />
                    <Route path="finance/ledger" element={<FinanceLedger />} />
                    <Route path="finance/accounts" element={<FinanceAccounts />} />

                    <Route path="finance/approvals" element={<ApprovalManager />} />
                    <Route path="ai-analysis" element={<AIAnalysis />} />
                    <Route path="logistics" element={<Logistics />} />
                    <Route path="logs" element={<ActivityLogs />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="master-page" element={<MasterPage />} />
                    <Route path="master-account" element={<MasterAccount />} />
                    <Route path="system-monitoring" element={<SystemMonitoring />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </>
    )
}

export default App


