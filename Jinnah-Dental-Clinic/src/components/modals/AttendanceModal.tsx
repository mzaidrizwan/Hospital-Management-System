'use client';

import React, { useState } from 'react';
import { 
  X, Calendar, CheckCircle, XCircle, Clock, CalendarDays,
  ChevronLeft, ChevronRight, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Staff, Attendance } from '@/types';

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  existingAttendance: Attendance[];
  onSubmit: (staff: Staff, data: { date: string; status: string; notes: string; id?: string }) => void; // id for edit
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AttendanceModal({
  open,
  onClose,
  staff,
  existingAttendance,
  onSubmit
}: AttendanceModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    date: '',
    status: 'present' as 'present' | 'absent' | 'leave',
    notes: '',
    id: undefined as string | undefined
  });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // All attendance records for this staff
  const staffAttendance = existingAttendance.filter(a => a.staffId === staff?.id);

  // Navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    let newMonth = currentMonth;
    let newYear = currentYear;

    if (direction === 'prev') {
      newMonth = currentMonth - 1;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
    } else {
      newMonth = currentMonth + 1;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  // Generate calendar days with status
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const days = [];
    // Empty slots
    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(dateStr);
      const attendance = staffAttendance.find(a => a.date === dateStr);

      let displayStatus = attendance?.status;
      
      // Past unmarked days → consider Absent
      if (!attendance && dateObj < today && dateObj >= new Date(staff?.joinDate || '1970-01-01')) {
        displayStatus = 'absent';
      }

      days.push({
        day,
        date: dateStr,
        attendance,
        displayStatus,
        isToday: dateStr === todayStr,
        isFuture: dateObj > today,
        isPastUnmarked: !attendance && dateObj < today
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  const handleDayClick = (dayInfo: any) => {
    if (!dayInfo || dayInfo.isFuture) return;

    if (dayInfo.attendance) {
      // Edit mode
      setFormData({
        date: dayInfo.date,
        status: dayInfo.attendance.status,
        notes: dayInfo.attendance.notes || '',
        id: dayInfo.attendance.id
      });
      toast.info(`Editing attendance for ${dayInfo.date}`);
    } else {
      // New entry
      setFormData({
        date: dayInfo.date,
        status: 'present',
        notes: '',
        id: undefined
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    if (formData.date > todayStr) {
      toast.error("Cannot mark attendance for future dates");
      return;
    }

    onSubmit(staff, {
      date: formData.date,
      status: formData.status,
      notes: formData.notes,
      id: formData.id // for edit
    });

    // Reset form
    setFormData({
      date: '',
      status: 'present',
      notes: '',
      id: undefined
    });
  };

  if (!open || !staff) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{staff.name} - Attendance</h2>
            <p className="text-sm text-gray-600 mt-1">
              Join Date: {new Date(staff.joinDate).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col">
            <div className="px-6 pt-4 border-b bg-gray-50">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="mark">Mark / Edit</TabsTrigger>
              </TabsList>
            </div>

            {/* Calendar View */}
            <TabsContent value="calendar" className="flex-1 p-6 overflow-auto">
              <div className="space-y-6">
                {/* Month Navigation */}
                <div className="flex items-center justify-between px-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Prev
                  </Button>
                  
                  <h3 className="text-xl font-bold">
                    {monthNames[currentMonth]} {currentYear}
                  </h3>
                  
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {/* Calendar */}
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  {/* Week days */}
                  <div className="grid grid-cols-7 bg-gray-100">
                    {dayNames.map(day => (
                      <div key={day} className="py-3 text-center text-sm font-medium text-gray-600">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarDays.map((day, idx) => (
                      <div
                        key={idx}
                        onClick={() => day && handleDayClick(day)}
                        className={`
                          min-h-[90px] p-2 border-r border-b relative
                          ${!day ? 'bg-gray-50' : 'cursor-pointer hover:bg-gray-50 transition-colors'}
                          ${day?.isToday ? 'bg-blue-50' : ''}
                          ${day?.isFuture ? 'bg-gray-100 opacity-60 cursor-not-allowed' : ''}
                        `}
                      >
                        {day && (
                          <>
                            <div className="flex justify-between items-start">
                              <span className={`
                                text-lg font-semibold
                                ${day.isToday ? 'text-blue-600' : 'text-gray-800'}
                              `}>
                                {day.day}
                              </span>
                              
                              {day.displayStatus && (
                                <div className={`
                                  w-3 h-3 rounded-full mt-1
                                  ${day.displayStatus === 'present' ? 'bg-green-500' :
                                    day.displayStatus === 'absent' ? 'bg-red-500' :
                                    'bg-yellow-500'}
                                `} />
                              )}
                            </div>

                            {day.displayStatus && (
                              <div className="mt-2">
                                <Badge
                                  variant="outline"
                                  className={`
                                    text-xs font-medium px-2 py-0 h-5
                                    ${day.displayStatus === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                                      day.displayStatus === 'absent' ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-yellow-50 text-yellow-700 border-yellow-200'}
                                  `}
                                >
                                  {day.displayStatus.toUpperCase()}
                                </Badge>
                              </div>
                            )}

                            {day.attendance?.notes && (
                              <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={day.attendance.notes}>
                                {day.attendance.notes}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-6 justify-center text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div> Present
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full"></div> Absent
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full"></div> Leave
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-50 rounded"></div> Today
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Mark/Edit Tab */}
            <TabsContent value="mark" className="flex-1 p-6 overflow-auto">
              <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-8">
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-base">Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        max={todayStr}
                        disabled={!!formData.id} // Optional: prevent date change on edit
                        className="text-lg"
                      />
                      {formData.date && formData.date > todayStr && (
                        <p className="text-sm text-red-600">Future dates are not allowed</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={v => setFormData({...formData, status: v as any})}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="leave">Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base">Notes (optional)</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        placeholder="Any remarks or reason..."
                        className="min-h-[120px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!formData.date || formData.date > todayStr}
                    className="px-8"
                  >
                    {formData.id ? 'Update Attendance' : 'Mark Attendance'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}