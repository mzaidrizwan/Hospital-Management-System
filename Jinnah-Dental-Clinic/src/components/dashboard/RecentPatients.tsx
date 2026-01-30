import React from 'react';
import { User, Phone, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Patient } from '@/types';

// Demo patients
const demoPatients: Partial<Patient>[] = [
  { id: '1', name: 'Sarah Johnson', phone: '+1 234-567-8901', createdAt: '2024-01-15' },
  { id: '2', name: 'Michael Chen', phone: '+1 234-567-8902', createdAt: '2024-01-14' },
  { id: '3', name: 'Emily Davis', phone: '+1 234-567-8903', createdAt: '2024-01-14' },
  { id: '4', name: 'James Wilson', phone: '+1 234-567-8904', createdAt: '2024-01-13' },
  { id: '5', name: 'Maria Garcia', phone: '+1 234-567-8905', createdAt: '2024-01-12' },
];

export function RecentPatients() {
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
        {demoPatients.map((patient) => (
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
              {new Date(patient.createdAt!).toLocaleDateString()}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
