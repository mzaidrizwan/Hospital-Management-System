'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, MapPin, Activity, DollarSign, FileText, Edit, Trash2, Clock, UserCheck, AlertCircle, TrendingUp, CreditCard, History, ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Patient, QueueItem, Bill } from '@/types';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';

interface PatientDetailsModalProps {
  patient: Patient;
  patientInfo?: Patient | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showActions?: boolean;
  // Optional: Pass history data directly if not fetching in modal
  queueHistory?: QueueItem[];
  bills?: Bill[];
}

export default function PatientDetailsModal({
  patient,
  patientInfo,
  onClose,
  onEdit,
  onDelete,
  showActions = true,
  queueHistory = [],
  bills = []
}: PatientDetailsModalProps) {
  const { updateLocal, patients } = useData();
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'bills'>('overview');
  const [loading, setLoading] = useState(false);

  // Use live data from context to ensure updates are reflected immediately
  const displayPatient = patients?.find(p => p.id === patient.id) || patient;

  // Payment State
  const [isPaymentMode, setIsPaymentMode] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const [history, setHistory] = useState<{
    queueHistory: QueueItem[];
    bills: Bill[];
  }>({
    queueHistory: [],
    bills: []
  });

  const handlePaymentSubmit = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsPaymentSubmitting(true);
      const now = new Date();

      // 1. Create Bill Record
      const newBill: Bill = {
        id: `BILL-${Date.now()}`,
        billNumber: `PAY-${Date.now()}`,
        patientId: displayPatient.patientNumber,
        patientNumber: displayPatient.patientNumber,
        patientName: displayPatient.name,
        treatment: 'Balance Payment / Credit Update',
        totalAmount: 0,
        amountPaid: amount,
        discount: 0,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        createdDate: now.toISOString(),
        notes: paymentNotes || 'Manual balance update via Patient Details',
      };

      // 2. Calculate New Balance
      const currentPending = displayPatient.pendingBalance || 0;
      const currentTotalPaid = displayPatient.totalPaid || 0;

      const newPendingBalance = currentPending - amount;
      const newTotalPaid = currentTotalPaid + amount;

      // 3. Update Patient Record
      const updatedPatient = {
        ...displayPatient,
        pendingBalance: newPendingBalance,
        totalPaid: newTotalPaid,
        lastVisit: now.toISOString()
      };

      // 4. Save Changes
      await updateLocal('bills', newBill);
      await updateLocal('patients', updatedPatient);

      // 5. Update Local State to reflect changes immediately
      setHistory(prev => ({
        ...prev,
        bills: [newBill, ...prev.bills]
      }));

      // We can't easily update 'patient' prop locally since it comes from parent
      // But since parent uses context and updateLocal updates context, it should reflect automatically via props

      toast.success(`Payment of Rs. ${amount} recorded successfully`);
      setIsPaymentMode(false);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to record payment");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  // Use props if provided, otherwise fetch
  useEffect(() => {
    // Safer condition: check if props were actually passed
    if (queueHistory !== undefined || bills !== undefined) {
      setHistory({
        queueHistory: queueHistory || [],
        bills: bills || []
      });
    } else {
      // Fallback: fetch data (for backward compatibility)
      fetchPatientHistory();
    }
  }, [queueHistory, bills]);

  const fetchPatientHistory = async () => {
    try {
      setLoading(true);
      // You can keep your fetch logic here if needed
      // For now, we'll use empty arrays since data is passed via props
      setHistory({
        queueHistory: [],
        bills: []
      });
    } catch (error) {
      console.error('Error fetching patient history:', error);
      toast.error('Failed to load patient history');
    } finally {
      setLoading(false);
    }
  };

  // Use patient document data directly for financial overview
  const totalTreatments = displayPatient.totalVisits || 0;
  const totalBilled = displayPatient.totalTreatmentFees || 0;
  const totalPaid = displayPatient.totalPaid || 0;
  const pendingBalance = displayPatient.pendingBalance || 0;
  const openingBalance = displayPatient.openingBalance || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_treatment': return 'bg-yellow-100 text-yellow-800';
      case 'waiting': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    const numAmount = amount || 0;
    return 'Rs. ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  const safeFormatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';

    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM dd, yyyy hh:mm a');
    } catch {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return format(date, 'MMM dd, yyyy hh:mm a');
      } catch {
        return 'N/A';
      }
    }
  };

  if (!patient) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-full">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{displayPatient.name || 'N/A'}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>ID: <strong>{displayPatient.patientNumber || displayPatient.id || 'N/A'}</strong></span>
                <span>•</span>
                <span>Since {safeFormatDate(displayPatient.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showActions && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 h-8 px-3">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1.5 h-8 px-3 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-semibold flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-primary" />
              Financial Overview
            </h3>
            <Button
              size="sm"
              onClick={() => setIsPaymentMode(!isPaymentMode)}
              variant={isPaymentMode ? "secondary" : "default"}
            >
              {isPaymentMode ? "Cancel Payment" : "Receive Payment / Add Credit"}
            </Button>
          </div>

          {isPaymentMode ? (
            <div className="bg-white p-4 rounded-lg border shadow-sm mb-4 animate-in fade-in slide-in-from-top-2">
              <h4 className="font-semibold mb-3 text-sm">Record Payment / Balance Update</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (Rs)</Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online Transfer</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Reason for payment (optional)"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setIsPaymentMode(false)}>Cancel</Button>
                <Button size="sm" onClick={handlePaymentSubmit} disabled={isPaymentSubmitting || !paymentAmount}>
                  {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm Payment
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Total Treatments</div>
                <div className="text-2xl font-bold text-purple-700">
                  {displayPatient.totalVisits || 0}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Total Paid</div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(history.bills.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Pending Balance</div>
                <div className={`text-2xl font-bold ${(displayPatient.pendingBalance || 0) > 0 ? 'text-red-600' :
                  (displayPatient.pendingBalance || 0) < 0 ? 'text-blue-600' : 'text-gray-800'
                  }`}>
                  {formatCurrency(Math.abs(displayPatient.pendingBalance || 0))}
                </div>
                <div className="text-xs mt-0.5">
                  {(displayPatient.pendingBalance || 0) > 0 ? 'Due' :
                    (displayPatient.pendingBalance || 0) < 0 ? 'Credit' : 'Settled'}
                </div>
              </div>
            </div>
          )}
          {!isPaymentMode && (
            <div className="mt-2 text-xs text-gray-600 text-center">
              Opening Balance: {formatCurrency(displayPatient.openingBalance || 0)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b px-4">
          <div className="flex space-x-4">
            <button
              className={`py-2 px-1 font-medium text-xs border-b-2 transition-colors ${activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`py-2 px-1 font-medium text-xs border-b-2 transition-colors ${activeTab === 'queue'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('queue')}
            >
              Queue History ({history?.queueHistory?.length || 0})
            </button>
            <button
              className={`py-2 px-1 font-medium text-xs border-b-2 transition-colors ${activeTab === 'bills'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              onClick={() => setActiveTab('bills')}
            >
              Bills ({history?.bills?.length || 0})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm">Loading patient history...</span>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold flex items-center gap-1.5">
                      <User className="w-4 h-4" /> Personal Information
                    </h3>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-600">Phone</div>
                          <div className="font-medium text-sm">{patient.phone || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-600">Age / Gender</div>
                          <div className="font-medium text-sm">{patient.age || 'N/A'} years / {patient.gender || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-600">Address</div>
                          <div className="font-medium text-sm">{patient.address || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold flex items-center gap-1.5">
                      <History className="w-4 h-4" /> Recent Activity
                    </h3>
                    {history?.queueHistory?.length > 0 ? (
                      <div className="space-y-2">
                        {history.queueHistory.slice(0, 3).map(item => (
                          <div key={item.id} className="bg-gray-50 p-3 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm">{item.treatment || 'Treatment'}</div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {safeFormatDate(item.checkInTime)}
                                </div>
                              </div>
                              <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
                                {item.status?.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="mt-2 flex justify-between text-xs">
                              <span>Fee: {formatCurrency(item.fee)}</span>
                              <span>Doctor: {item.doctor || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border text-sm">
                        No recent activity
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Queue History Tab */}
              {activeTab === 'queue' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Queue History</h3>
                  {history?.queueHistory?.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left text-xs font-medium">Date</th>
                              <th className="p-3 text-left text-xs font-medium">Token</th>
                              <th className="p-3 text-left text-xs font-medium">Treatment</th>
                              <th className="p-3 text-left text-xs font-medium">Status</th>
                              <th className="p-3 text-left text-xs font-medium">Fee</th>
                              <th className="p-3 text-left text-xs font-medium">Doctor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {history.queueHistory.map(item => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-3 text-xs">{safeFormatDate(item.checkInTime)}</td>
                                <td className="p-3 text-xs font-medium">#{item.tokenNumber || '—'}</td>
                                <td className="p-3 text-xs">{item.treatment || '—'}</td>
                                <td className="p-3">
                                  <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
                                    {(item.status || '').replace('_', ' ').toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="p-3 text-xs">{formatCurrency(item.fee)}</td>
                                <td className="p-3 text-xs">{item.doctor || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border text-sm">
                      No queue history found
                    </div>
                  )}
                </div>
              )}

              {/* Bills Tab */}
              {activeTab === 'bills' && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Bill History</h3>
                  {history?.bills?.length > 0 ? (
                    <div className="space-y-3">
                      {history.bills.map(bill => (
                        <div key={bill.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-sm flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-gray-600" />
                                Bill #{bill.billNumber || '—'}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {safeFormatDate(bill.createdDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-700">
                                {formatCurrency(bill.totalAmount)}
                              </div>
                              <Badge className={`mt-1 text-xs ${getPaymentStatusColor(bill.paymentStatus || '')}`}>
                                {bill.paymentStatus?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="font-medium">{bill.treatment || 'General Treatment'}</div>
                            {bill.notes && <div className="text-gray-600 mt-0.5">{bill.notes}</div>}
                          </div>
                          <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                            <div>
                              <span className="text-gray-600">Paid:</span>{' '}
                              <span className="font-medium text-green-600">{formatCurrency(bill.amountPaid)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Method:</span>{' '}
                              <span className="font-medium">{bill.paymentMethod || '—'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border text-sm">
                      No bills generated yet
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-600">
            Last updated: {displayPatient.updatedAt ? safeFormatDate(displayPatient.updatedAt) : 'Never'}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-3">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}