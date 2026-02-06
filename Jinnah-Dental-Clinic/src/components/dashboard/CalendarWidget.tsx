import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TimeSlot } from '@/types';

// Demo time slots
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const statuses: Array<'available' | 'booked' | 'in_treatment'> = [
    'available', 'booked', 'available', 'in_treatment', 'booked',
    'available', 'available', 'booked', 'available', 'available'
  ];

  for (let hour = 9; hour <= 18; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    const status = statuses[hour - 9] || 'available';
    slots.push({
      id: `slot-${hour}`,
      time,
      status,
    });
  }
  return slots;
};

export function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const slots = generateTimeSlots();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const slotCounts = {
    available: slots.filter(s => s.status === 'available').length,
    booked: slots.filter(s => s.status === 'booked').length,
    inTreatment: slots.filter(s => s.status === 'in_treatment').length,
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold">{formatDate(currentDate)}</h3>
          <Button variant="ghost" size="icon" onClick={() => navigateDate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Appointment
        </Button>
      </div>

      {/* Slot Summary */}
      <div className="p-4 border-b border-border flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">
            Available ({slotCounts.available})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-sm text-muted-foreground">
            Booked ({slotCounts.booked})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">
            In Treatment ({slotCounts.inTreatment})
          </span>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
        {slots.map((slot) => (
          <button
            key={slot.id}
            className={cn(
              "calendar-slot text-center",
              slot.status === 'available' && "calendar-slot-available",
              slot.status === 'booked' && "calendar-slot-booked",
              slot.status === 'in_treatment' && "calendar-slot-in_treatment",
            )}
          >
            <span className="font-medium">{slot.time}</span>
            <span className="block text-xs capitalize mt-0.5 opacity-80">
              {slot.status.replace('-', ' ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
