'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Calendar, CheckCircle, XCircle, Clock, CalendarDays,
  ChevronLeft, ChevronRight, TrendingUp, AlertCircle, Edit2, Save, Trash2,
  CheckCircle2,
  RefreshCw
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
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  existingAttendance: Attendance[];
  onSubmit: (staff: Staff, data: { 
    date: string; 
    status: string; 
    notes: string; 
    id?: string;
    time?: string;
    timestamp?: string;
  }) => void;
  onDelete?: (attendanceId: string) => Promise<void>;
}

interface AttendanceWithTime extends Attendance {
  time?: string;
  timestamp?: string;
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
  onSubmit,
  onDelete
}: AttendanceModalProps) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    status: 'present' as 'present' | 'absent' | 'leave',
    notes: '',
    id: undefined as string | undefined,
    timestamp: undefined as string | undefined
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const canEdit = isAdmin || isOperator; // Both can edit

  // Get all attendance records for this staff (grouped by date - only one per day)
  const staffAttendance = existingAttendance
    .filter(a => a.staffId === staff?.id)
    .reduce((map, att) => {
      // Keep only the latest record for each date
      const existing = map.get(att.date);
      if (!existing || new Date(att.updatedAt || '').getTime() > new Date(existing.updatedAt || '').getTime()) {
        map.set(att.date, {
          ...att,
          time: (att as any).time || '',
          timestamp: (att as any).timestamp || ''
        });
      }
      return map;
    }, new Map<string, AttendanceWithTime>());

  const uniqueAttendance = Array.from(staffAttendance.values()).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Check if attendance exists for a specific date
  const getAttendanceForDate = (dateStr: string): AttendanceWithTime | undefined => {
    return uniqueAttendance.find(a => a.date === dateStr);
  };

  // Check if staff is inactive
  const isStaffInactive = staff?.status !== 'Active';

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

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(dateStr);
      const attendance = getAttendanceForDate(dateStr);

      days.push({
        day,
        date: dateStr,
        attendance,
        status: attendance?.status,
        time: attendance?.time,
        isToday: dateStr === todayStr,
        isFuture: dateObj > today,
        canEdit: !isStaffInactive || !!attendance, // Can edit if active OR editing existing
        hasAttendance: !!attendance
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  const handleDayClick = (dayInfo: any) => {
    if (!dayInfo || dayInfo.isFuture) return;

    // Check if staff is inactive and no existing attendance
    if (isStaffInactive && !dayInfo.hasAttendance) {
      toast.error(`Cannot mark attendance for ${staff?.name} as they are ${staff?.status}.`);
      return;
    }

    if (dayInfo.hasAttendance) {
      // Edit existing attendance
      const att = dayInfo.attendance;
      setFormData({
        date: dayInfo.date,
        time: att.time || currentTime,
        status: att.status,
        notes: att.notes || '',
        id: att.id,
        timestamp: att.timestamp
      });
      toast.info(`Editing attendance for ${dayInfo.date}`);
    } else {
      // Create new attendance
      setFormData({
        date: dayInfo.date,
        time: currentTime,
        status: 'present',
        notes: '',
        id: undefined,
        timestamp: undefined
      });
    }
  };

  const handleDeleteAttendance = async () => {
    if (!formData.id) {
      toast.error("No attendance record to delete");
      return;
    }

    if (!confirm(`Are you sure you want to delete the attendance record for ${formData.date}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      if (onDelete) {
        await onDelete(formData.id);
        toast.success(`Attendance record for ${formData.date} deleted successfully`);
        setFormData({
          date: '',
          time: '',
          status: 'present',
          notes: '',
          id: undefined,
          timestamp: undefined
        });
        onClose();
      } else {
        toast.error("Delete function not available");
      }
    } catch (error) {
      console.error("Failed to delete attendance:", error);
      toast.error("Failed to delete attendance record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!staff) return;
    
    // Check if staff is inactive and creating new
    if (isStaffInactive && !formData.id) {
      toast.error(`Cannot mark attendance for ${staff.name} as they are ${staff.status}.`);
      return;
    }

    // Check if date is in future
    if (formData.date > todayStr) {
      toast.error("Cannot mark attendance for future dates");
      return;
    }

    // Validate time
    if (!formData.time) {
      toast.error("Please select attendance time");
      return;
    }

    // Check for duplicate - ensure only one per day
    const existingForDate = getAttendanceForDate(formData.date);
    if (existingForDate && existingForDate.id !== formData.id) {
      toast.error(`Attendance already exists for ${formData.date}. Please edit the existing record instead.`);
      return;
    }

    // Create timestamp
    const timestamp = `${formData.date}T${formData.time}`;

    onSubmit(staff, {
      date: formData.date,
      status: formData.status,
      notes: formData.notes,
      id: formData.id,
      time: formData.time,
      timestamp: timestamp
    });

    // Reset form
    setFormData({
      date: '',
      time: '',
      status: 'present',
      notes: '',
      id: undefined,
      timestamp: undefined
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'absent': return 'bg-red-500';
      case 'leave': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700 border-green-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'leave': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!open || !staff) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isStaffInactive ? 'bg-red-50' : 'bg-gradient-to-r from-indigo-50 to-blue-50'} shrink-0`}>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">{staff.name} - Attendance</h2>
              {isStaffInactive && (
                <Badge variant="destructive" className="text-xs">
                  {staff.status}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {canEdit ? 'Editable' : 'Read Only'}
              </Badge>
            </div>
            <p className="text-xs text-gray-600">
              Join Date: {new Date(staff.joinDate).toLocaleDateString()}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              One attendance per day only
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-2 border-b bg-gray-50 shrink-0">
              <TabsList className="grid w-full max-w-xs grid-cols-2 h-9">
                <TabsTrigger value="calendar" className="text-sm">Calendar View</TabsTrigger>
                <TabsTrigger value="mark" className="text-sm">Mark / Edit</TabsTrigger>
              </TabsList>
            </div>

            {/* Calendar View */}
            <TabsContent value="calendar" className="flex-1 p-4 overflow-y-auto outline-none">
              <div className="space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between px-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')} className="h-8 px-3">
                    <ChevronLeft className="mr-1.5 h-4 w-4" /> Prev
                  </Button>
                  <h3 className="text-lg font-bold">
                    {monthNames[currentMonth]} {currentYear}
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} className="h-8 px-3">
                    Next <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>

                {/* Calendar Grid */}
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-7 bg-gray-100">
                    {dayNames.map(day => (
                      <div key={day} className="py-2 text-center text-xs font-semibold text-gray-600">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarDays.map((day, idx) => (
                      <div
                        key={idx}
                        onClick={() => day && day.canEdit && handleDayClick(day)}
                        className={`
                          aspect-square sm:aspect-auto sm:min-h-[100px] p-2 border-r border-b relative
                          ${!day ? 'bg-gray-50' : day.canEdit ? 'cursor-pointer hover:bg-gray-50 transition-colors' : 'cursor-not-allowed opacity-60'}
                          ${day?.isToday ? 'bg-blue-50' : ''}
                          ${day?.isFuture ? 'bg-gray-100 opacity-60 cursor-not-allowed' : ''}
                          ${isStaffInactive && !day?.hasAttendance ? 'bg-gray-100 cursor-not-allowed' : ''}
                        `}
                      >
                        {day && (
                          <>
                            <div className="flex justify-between items-start">
                              <span className={`
                                text-sm sm:text-base font-semibold
                                ${day.isToday ? 'text-blue-600' : 'text-gray-800'}
                              `}>
                                {day.day}
                              </span>
                              {day.hasAttendance && (
                                <div className={`w-2.5 h-2.5 rounded-full mt-1 ${getStatusColor(day.status || '')}`} />
                              )}
                            </div>

                            {day.hasAttendance && (
                              <>
                                <div className="mt-1 hidden sm:block">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px] font-medium px-1.5 py-0 h-4", getStatusBadgeColor(day.status || ''))}
                                  >
                                    {day.status?.toUpperCase()}
                                  </Badge>
                                </div>
                                {day.time && (
                                  <div className="mt-1 hidden sm:block">
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{day.time}</span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {day.canEdit && day.hasAttendance && (
                              <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-600 pt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div> Present
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div> Absent
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div> Leave
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div> Today
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Edit2 className="w-3 h-3 text-gray-400" />
                    <span>Click to edit</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Mark/Edit Tab */}
            <TabsContent value="mark" className="flex-1 flex flex-col overflow-hidden outline-none">
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-2xl mx-auto space-y-4">
                    <Card className="border-none shadow-none bg-gray-50/50">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Date</Label>
                            <Input
                              type="date"
                              value={formData.date}
                              onChange={e => setFormData({ ...formData, date: e.target.value })}
                              max={todayStr}
                              disabled={!canEdit || (isStaffInactive && !formData.id)}
                              className="h-10 text-sm"
                            />
                            {getAttendanceForDate(formData.date) && getAttendanceForDate(formData.date)?.id !== formData.id && (
                              <p className="text-[10px] text-red-600">Attendance already exists for this date</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Time</Label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input
                                type="time"
                                step="1"
                                value={formData.time}
                                onChange={e => setFormData({ ...formData, time: e.target.value })}
                                className="pl-9 h-10 text-sm"
                                disabled={!canEdit}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Status</Label>
                            <Select
                              value={formData.status}
                              onValueChange={v => setFormData({ ...formData, status: v as any })}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">✅ Present</SelectItem>
                                <SelectItem value="absent">❌ Absent</SelectItem>
                                <SelectItem value="leave">🌴 Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-sm font-semibold">Notes (optional)</Label>
                            <Textarea
                              value={formData.notes}
                              onChange={e => setFormData({ ...formData, notes: e.target.value })}
                              placeholder="Any remarks or reason..."
                              className="min-h-[100px] text-sm resize-none"
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex gap-2">
                    {formData.id && canEdit && onDelete && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDeleteAttendance}
                        disabled={isDeleting}
                        className="h-9 px-4 text-sm font-semibold"
                      >
                        {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Delete
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClose}
                      className="h-9 px-4 text-sm"
                    >
                      Cancel
                    </Button>
                    {canEdit && (
                      <Button
                        type="submit"
                        disabled={!formData.date || !formData.time || !!getAttendanceForDate(formData.date) && getAttendanceForDate(formData.date)?.id !== formData.id}
                        className="h-9 px-6 text-sm font-semibold shadow-sm gap-2"
                      >
                        {formData.id ? <Save className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                        {formData.id ? 'Save Changes' : 'Mark Attendance'}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}