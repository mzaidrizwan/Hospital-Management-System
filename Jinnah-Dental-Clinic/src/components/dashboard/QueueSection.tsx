'use client';

import React from 'react';
import {
  User,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Printer,
  Edit,
  Trash2,
  Play,
  CheckSquare,
  Phone,
  Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueueItem } from '@/types';
import { format } from 'date-fns';

interface QueueSectionProps {
  title: string;
  items: QueueItem[];
  status: 'waiting' | 'in_treatment' | 'completed' | 'cancelled';
  onAction: (item: QueueItem, action: string) => void;
  onPayment?: (item: QueueItem) => void;
  onPrint?: (item: QueueItem) => void;
  onDoubleClick?: (item: QueueItem) => void;
  showPending?: boolean;
  showBackButton?: boolean;
  showPatientId?: boolean;
  getPendingAmount?: (patientId: string) => number;
}

export default function QueueSection({
  title,
  items,
  status,
  onAction,
  onPayment,
  onPrint,
  onDoubleClick,
  showPending = false,
  showBackButton = false,
  getPendingAmount = () => 0
}: QueueSectionProps) {

  // Status ke hisaab se icon select karna
  const getStatusIcon = () => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'in_treatment':
        return <Activity className="w-5 h-5 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'waiting': return 'border-blue-200 bg-blue-50';
      case 'in_treatment': return 'border-yellow-200 bg-yellow-50';
      case 'completed': return 'border-green-200 bg-green-50';
      case 'cancelled': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      normal: 'bg-gray-100 text-gray-800',
      urgent: 'bg-yellow-100 text-yellow-800',
      emergency: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority as keyof typeof colors] || colors.normal}`}>
        {priority}
      </span>
    );
  };

  const getPaymentBadge = (paymentStatus: string) => {
    const colors = {
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[paymentStatus as keyof typeof colors] || colors.pending}`}>
        {paymentStatus}
      </span>
    );
  };



  const getActionButtons = (item: QueueItem) => {
    switch (status) {
      case 'waiting':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(item, 'start-treatment')}
              className="gap-1"
            >
              <Play className="w-3 h-3" />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(item, 'edit')}
              className="gap-1"
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(item, 'cancel')}
              className="gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        );

      case 'in_treatment':
        return (
          <>
            {/* ← Yeh naya Back button */}
            {showBackButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(item, 'back-to-waiting')}
                className="gap-1 text-orange-600 hover:text-orange-700"
              >

                Back
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(item, 'complete')}
              className="gap-1"
            >
              <CheckSquare className="w-3 h-3" />
              Complete
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(item, 'edit')}
              className="gap-1"
            >
              <Edit className="w-3 h-3" />
            </Button>
          </>
        );

      case 'completed':
        return (
          <>
            {/* ← Completed se bhi wapas ja sakte hain (In Treatment ya Waiting) */}
            {showBackButton && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction(item, 'back-to-treatment')}
                  className="gap-1 text-yellow-600 hover:text-yellow-700"
                >

                  Back
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction(item, 'edit')}
                  className="gap-1"
                >
                  <Edit className="w-3 h-3" />
                </Button>

                {/* Optional: Direct Waiting mein bhejna */}
                {/* <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(item, 'back-to-waiting')}
                className="gap-1 text-orange-600"
              >
                <Clock className="w-3 h-3" />
                Back to Wait
              </Button> */}
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => onPayment && onPayment(item)}
              className="gap-1"
            >
              <DollarSign className="w-3 h-3" />
              Payment
            </Button>

            {onPrint && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPrint(item)}
                className="gap-1"
              >
                <Printer className="w-3 h-3" />
                Print
              </Button>
            )}
          </>
        );

      default:
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(item, 'delete')}
            className="gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </Button>
        );
    }
  };



  if (items.length === 0) {
    return (
      <div className={`border rounded-lg p-4 h-fit ${getStatusColor()}`}>
        <div className="flex items-center gap-2 mb-4">
          {getStatusIcon()}
          <h3 className="font-semibold">{title}</h3>
          <span className="ml-auto text-sm text-gray-500">{items.length} patients</span>
        </div>

        <div className="text-center py-8 text-gray-500">
          <p>No patients in {title.toLowerCase()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 h-fit ${getStatusColor()}`}>
      <div className="flex items-center gap-2 mb-4">
        {getStatusIcon()}
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto text-sm text-gray-500">{items.length} patients</span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`bg-white border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer ${item.priority === 'emergency' ? 'border-red-300' : ''}`}
            onDoubleClick={() => onDoubleClick && onDoubleClick(item)}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="font-medium">{item.patientName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {item.patientPhone || 'No phone'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-lg">#{item.tokenNumber}</div>
                <div className="text-xs text-gray-500">
                  {format(new Date(item.checkInTime), 'hh:mm a')}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Id:</span>
                {getPriorityBadge(item.priority)}
              </div>

              {item.treatment && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Treatment:</span>
                  <span className="text-sm font-medium">{item.treatment}</span>
                </div>
              )}

              {item.doctor && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Doctor:</span>
                  <span className="text-sm">{item.doctor}</span>
                </div>
              )}

              {item.fee && item.fee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Fee:</span>
                  <span className="text-sm font-bold text-green-600">
                    ${item.fee.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Payment:</span>
                {getPaymentBadge(item.paymentStatus)}
              </div>

              {showPending && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending:</span>
                  <span className="text-sm font-bold text-red-600">
                    ${getPendingAmount(item.patientId).toFixed(2)}
                  </span>
                </div>
              )}

              {item.notes && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <div className="font-medium">Notes:</div>
                  {item.notes}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {getActionButtons(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}