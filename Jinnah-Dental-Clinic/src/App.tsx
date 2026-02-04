import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
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
        <Route path="inventory" element={<SharedInventory />} />
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
