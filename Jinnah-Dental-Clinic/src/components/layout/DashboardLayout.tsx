import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { SyncIndicator } from '@/components/common/SyncIndicator';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { LicenseModal } from '@/components/modals/LicenseModal';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function DashboardLayout() {
  const { user } = useAuth();
  const { licenseStatus } = useData();

  return (
    <SidebarProvider>
      {/* Blocking License Modal for Expired or Missing License */}
      <LicenseModal
        open={licenseStatus === 'expired' || licenseStatus === 'missing'}
        onOpenChange={() => { }} // No-op to prevent closing
      />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          {/* Top Header */}
          <header className="sticky top-0 z-40 h-16 flex items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-2" />
              <div className="hidden md:flex relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search patients, appointments..."
                  className="w-72 pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
              <SyncIndicator />
            </div>

            <div className="flex items-center gap-3">
              {/* <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center">
                  3
                </span>
              </Button> */}
              <div className="h-8 w-px bg-border" />
              <div className="text-right">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
