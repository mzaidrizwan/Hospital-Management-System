import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { LicenseModal } from '@/components/modals/LicenseModal';
import { useData } from '@/context/DataContext';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Users,
  ClipboardList,
  Package,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  UserCog,
  DollarSign,
  Info,
  ShoppingCart,
  FileText,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const operatorItems = [
  { title: 'Dashboard', url: '/operator', icon: Home },
  { title: 'Bill', url: '/operator/queue', icon: ClipboardList },
  { title: 'Patients details', url: '/operator/patients', icon: Users },
  { title: 'Staff', url: '/admin/staff', icon: UserCog },
  { title: 'Inventory', url: '/operator/inventory', icon: Package },
  { title: 'Expenses', url: '/operator/expenses', icon: DollarSign },
  { title: 'Settings', url: '/operator/settings', icon: Settings },
];

const adminItems = [
  { title: 'Dashboard', url: '/admin', icon: Home },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
  // { title: 'Patients', url: '/admin/patients', icon: Users },
  { title: 'Patients details', url: '/operator/patients', icon: Users },
  { title: 'Staff', url: '/admin/staff', icon: UserCog },
  { title: 'Inventory', url: '/admin/inventory', icon: Package },
  { title: 'Expenses', url: '/admin/expenses', icon: Receipt },
  { title: 'Finances', url: '/admin/finances', icon: DollarSign },
  { title: 'Reports', url: '/admin/reports', icon: FileText },
  { title: 'Settings', url: '/admin/settings', icon: Settings },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const { licenseStatus, licenseDaysLeft } = useData();
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const collapsed = state === 'collapsed';

  const isLicensed = licenseStatus === 'valid';

  const items = user?.role === 'admin' ? adminItems : operatorItems;
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className={cn(
          "flex items-center gap-3 transition-all",
          collapsed && "justify-center"
        )}>
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sidebar-foreground">Jinnah Dental</span>
              <span className="text-xs text-muted-foreground capitalize">
                {user?.role} Portal
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive(item.url)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* {!collapsed && (
        <div className="px-4 py-2">
          <button
            onClick={() => setShowLicenseModal(true)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
              isLicensed
                ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200"
                : "bg-amber-50/50 border-amber-100 hover:bg-amber-50 hover:border-amber-200"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg",
              isLicensed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
            )}>
              {isLicensed ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider",
                isLicensed ? "text-emerald-700" : "text-amber-700"
              )}>
                {isLicensed ? "License Active" : "License Expired"}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {isLicensed ? `${licenseDaysLeft} days remaining` : "Click to activate"}
              </span>
            </div>
          </button>
        </div>
      )} */}

      <LicenseModal open={showLicenseModal} onOpenChange={setShowLicenseModal} />

      <SidebarFooter className="p-4 pt-2 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3",
          collapsed && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.name.charAt(0)}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {user?.role}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
