import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider, useData } from "@/context/DataContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Operator Pages
import OperatorDashboard from "@/pages/operator/OperatorDashboard";
import ExpensesPage from "@/pages/ExpensesPage";
import OperatorQueue from "@/pages/operator/OperatorQueue";
import OperatorPatients from "@/pages/operator/OperatorPatients";
import SharedInventory from "@/pages/shared/Inventory";
import OperatorSettings from "@/pages/operator/Settings";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminPatients from "@/pages/admin/AdminPatients";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminFinances from "@/pages/admin/AdminFinances";
import AdminReports from "@/pages/admin/AdminReports";
import AdminSettings from "@/pages/admin/AdminSettings";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { isAuthenticated, user } = useAuth();
  const { isShutdown } = useData();

  console.log("🔍 AuthenticatedApp - isShutdown:", isShutdown);
  console.log("🔍 localStorage force_shutdown:", localStorage.getItem('force_shutdown'));

  if (isShutdown) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">System Temporarily Offline</h1>
          <p className="text-slate-600 mb-6">The application has been locked by the administrator. Please contact support or check back later.</p>
          <div className="text-xs text-slate-400 font-mono">ERR_SYSTEM_SHUTDOWN_ACTIVE</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  const defaultRoute = user?.role === 'admin' ? '/admin' : '/operator';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />

      {/* Operator Routes */}
      <Route path="/operator" element={<DashboardLayout />}>
        <Route index element={<OperatorDashboard />} />
        <Route path="dashboard" element={<OperatorDashboard />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="queue" element={<OperatorQueue />} />
        <Route path="inventory" element={<SharedInventory />} />
        <Route path="patients" element={<OperatorPatients />} />
        <Route path="settings" element={<OperatorSettings />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="patients" element={<AdminPatients />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="finances" element={<AdminFinances />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DataProvider>
            <Toaster />
            <Sonner />
            <AuthenticatedApp />
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
