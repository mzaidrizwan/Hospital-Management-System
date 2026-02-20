'use client';
import React, { useState, useMemo } from 'react';
import {
  X, Calendar, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, User, Briefcase,
  DollarSign, CalendarClock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Staff, SalaryPayment, Attendance } from '@/types';
import { useSalaryLogic } from '@/hooks/useSalaryLogic';

interface StaffDetailsModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  salaryPayments: SalaryPayment[];
  attendance: Attendance[];
  onEdit: () => void;
  onDelete: (staff: Staff) => void;
  onPaySalary: () => void;
}

export default function StaffDetailsModal({
  open,
  onClose,
  staff,
  salaryPayments,
  attendance,
  onEdit,
  onDelete,
  onPaySalary
}: StaffDetailsModalProps) {
  if (!open || !staff) return null;

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));

  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  const staffAttendance = attendance.filter(a => a.staffId === staff.id);
  const attendanceMap = new Map(staffAttendance.map(a => [a.date, a]));

  const joinDate = new Date(staff.joinDate);
  const today = new Date();

  const currentMonthNum = parseInt(selectedMonth);
  const currentYearNum = parseInt(selectedYear);
  const firstDayOfMonth = new Date(currentYearNum, currentMonthNum - 1, 1);
  const daysInMonth = new Date(currentYearNum, currentMonthNum, 0).getDate();
  const startingWeekday = firstDayOfMonth.getDay();

  // Status styles
  const statusStyles = {
    present: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    absent: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    leave: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    unmarked_absent: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' } // lighter for auto-absent
  };

  // Enhanced month statistics (with join date & unmarked past days as absent)
  const monthStats = useMemo(() => {
    let present = 0;
    let markedAbsent = 0;
    let leave = 0;
    let autoAbsent = 0;   // unmarked past days
    let futureDays = 0;
    let totalWorkingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYearNum}-${selectedMonth}-${day.toString().padStart(2, '0')}`;
      const dateObj = new Date(dateStr);

      // Skip if before join date
      if (dateObj < joinDate) continue;

      // Skip future dates in working days count
      if (dateObj > today) {
        futureDays++;
        continue;
      }

      // Skip non-working days (Sunday off)
      if (dateObj.getDay() === 0) continue;

      totalWorkingDays++;

      const record = attendanceMap.get(dateStr);

      if (record) {
        if (record.status === 'present') present++;
        else if (record.status === 'absent') markedAbsent++;
        else if (record.status === 'leave') leave++;
      }
      // Past unmarked days → considered absent
      else if (dateObj <= today) {
        autoAbsent++;
      }
    }

    const totalAbsent = markedAbsent + autoAbsent;
    const attendanceRate = totalWorkingDays > 0
      ? Math.round((present / totalWorkingDays) * 100)
      : 0;

    return {
      present,
      absent: totalAbsent,
      leave,
      autoAbsent,
      markedAbsent,
      totalWorkingDays,
      attendanceRate
    };
  }, [staffAttendance, selectedMonth, selectedYear, staff.joinDate]);

  const monthName = new Date(currentYearNum, currentMonthNum - 1).toLocaleString('default', { month: 'long' });

  const { getSalaryStatus } = useSalaryLogic();
  const { amountDue, status: salStatus } = getSalaryStatus(staff);

  return (
    <div
      className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-full">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{staff.name}</h2>
                <p className="text-indigo-100 mt-1 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {staff.role} • Joined: {new Date(staff.joinDate).toLocaleDateString('en-PK')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<CalendarClock />} label="Join Date" value={new Date(staff.joinDate).toLocaleDateString('en-PK')} />
            <StatCard icon={<DollarSign />} label="Pending Salary" value={`Rs. ${amountDue.toLocaleString()}`} valueClass="text-red-600 font-bold" />
            <StatCard icon={<CheckCircle />} label="Attendance Rate" value={`${monthStats.attendanceRate}%`} valueClass="text-indigo-600 font-bold" />
            <StatCard
              icon={staff.status === 'Active' ? <CheckCircle /> : <Clock />}
              label="Status"
              custom={
                <div className="flex flex-col items-center gap-1">
                  <Badge className={staff.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {staff.status}
                  </Badge>
                  <Badge variant="outline" className={amountDue > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}>
                    Salary: {salStatus}
                  </Badge>
                </div>
              }
            />
          </div>

          {/* Attendance Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Attendance Overview - {monthName} {currentYearNum}
              </h3>

              <div className="flex items-center gap-3 flex-wrap">
                <Select value={viewMode} onValueChange={(v: 'list' | 'calendar') => setViewMode(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="View mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Calendar View</SelectItem>
                    <SelectItem value="list">List View</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => {
                    const d = new Date(currentYearNum, currentMonthNum - 2, 1);
                    setSelectedMonth((d.getMonth() + 1).toString().padStart(2, '0'));
                    setSelectedYear(d.getFullYear().toString());
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = (i + 1).toString().padStart(2, '0');
                        return <SelectItem key={m} value={m}>
                          {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                        </SelectItem>;
                      })}
                    </SelectContent>
                  </Select>

                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="icon" onClick={() => {
                    const d = new Date(currentYearNum, currentMonthNum, 1);
                    setSelectedMonth((d.getMonth() + 1).toString().padStart(2, '0'));
                    setSelectedYear(d.getFullYear().toString());
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <div className="bg-gray-50 p-5 rounded-xl border">
                <div className="grid grid-cols-7 gap-2 text-center mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-sm font-medium text-gray-500">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: startingWeekday }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-24"></div>
                  ))}

                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentYearNum}-${selectedMonth}-${day.toString().padStart(2, '0')}`;
                    const dateObj = new Date(dateStr);
                    const record = attendanceMap.get(dateStr);

                    let status = record?.status || null;
                    let isAutoAbsent = false;

                    if (!record) {
                      if (dateObj > today) {
                        // Future
                      } else if (dateObj < joinDate) {
                        // Before joining - no status
                      } else {
                        // Past unmarked → auto absent
                        isAutoAbsent = true;
                        status = 'unmarked_absent';
                      }
                    }

                    const isToday = dateStr === today.toISOString().split('T')[0];
                    const isFuture = dateObj > today;
                    const isBeforeJoin = dateObj < joinDate;

                    return (
                      <div
                        key={day}
                        className={`h-24 rounded-lg flex flex-col items-center justify-center text-sm relative transition-all
                          ${status ? statusStyles[status as keyof typeof statusStyles]?.bg : 'bg-white border border-gray-200'}
                          ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                          ${isFuture ? 'opacity-40 bg-gray-100 cursor-not-allowed' : ''}
                          ${isBeforeJoin ? 'bg-gray-100 opacity-50' : ''}
                        `}
                      >
                        <span className={`font-medium absolute top-2 left-2
                          ${isFuture || isBeforeJoin ? 'text-gray-400' : 'text-gray-800'}`}>
                          {day}
                        </span>

                        {status && (
                          <div className={`mt-2 flex flex-col items-center ${statusStyles[status as keyof typeof statusStyles]?.text}`}>
                            <div className={`w-5 h-5 rounded-full ${statusStyles[status as keyof typeof statusStyles]?.dot}`} />
                            <span className="text-xs font-semibold mt-1">
                              {status === 'unmarked_absent' ? 'A*' : status.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}

                        {record?.notes && (
                          <div className="absolute bottom-2 right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                            N
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-5 justify-center mt-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 rounded border border-green-300"></div>
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded border border-red-300"></div>
                    <span>Absent (marked)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-50 rounded border border-red-200"></div>
                    <span>Absent (auto)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-100 rounded border border-amber-300"></div>
                    <span>Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300"></div>
                    <span>Future / Before Join</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                List view coming soon...
              </div>
            )}

            {/* Month Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
              <MiniStat label="Present" value={monthStats.present} color="text-green-600" />
              <MiniStat label="Marked Absent" value={monthStats.markedAbsent} color="text-red-600" />
              <MiniStat label="Auto Absent" value={monthStats.autoAbsent} color="text-red-500" />
              <MiniStat label="Leave" value={monthStats.leave} color="text-amber-600" />
              <MiniStat label="Working Days" value={monthStats.totalWorkingDays} color="text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex gap-4 bg-gray-50">
          <Button onClick={onEdit} className="flex-1">Edit Details</Button>
          <Button
            onClick={onPaySalary}
            disabled={staff.pendingSalary <= 0}
            variant="outline"
            className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
          >
            Pay Salary
          </Button>
          <Button variant="destructive" onClick={() => onDelete(staff)} className="flex-1">
            Delete Staff
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper Components (same as before)
function StatCard({ icon, label, value, valueClass = "", custom }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  custom?: React.ReactNode
}) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardContent className="p-4 text-center">
        <div className="text-indigo-600 mb-1">{icon}</div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {custom || <p className={`text-xl font-bold ${valueClass}`}>{value}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-4 rounded-lg border text-center shadow-sm">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}