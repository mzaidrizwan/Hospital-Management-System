import React from 'react';
import { User, Phone, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Patient } from '@/types';

import { useData } from '@/context/DataContext';

export function RecentPatients() {
  const { patients, loading } = useData();

  const latestPatients = [...patients]
    .sort((a, b) => {
      const dateA = new Date(a.registrationDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.registrationDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Recent Patients</h3>
        <Button variant="ghost" size="sm" className="text-primary gap-1">
          View All
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="divide-y divide-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading patients...</div>
        ) : latestPatients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No patients found</div>
        ) : (
          latestPatients.map((patient) => (
            <div
              key={patient.id}
              className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{patient.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {patient.phone}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(patient.registrationDate || patient.createdAt).toLocaleDateString()}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
