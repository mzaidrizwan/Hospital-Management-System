// =============================================
// AUTHENTICATION & USER MANAGEMENT TYPES
// =============================================

export type UserRole = 'operator' | 'admin' | 'doctor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
}

// =============================================
// PATIENT MANAGEMENT TYPES
// =============================================

export interface Patient {
  id: string;
  patientNumber: string; // 4-digit unique ID
  name: string;
  openingBalance: number;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  address: string;
  email?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  allergies?: string;
  medicalHistory?: string;
  notes?: string;
  registrationDate: string;
  lastVisit?: string;
  totalVisits?: number;
  totalPaid: number;
  pendingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;     // Timestamp ko string ya Date mein convert kar sakte ho
  [key: string]: any;
  totalBilled?: number;
}

export interface PatientVital {
  id: string;
  patientId: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  recordedAt: string;
  notes?: string;
}

// =============================================
// PAYMENT & BILLING TYPES
// =============================================

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online' | 'wallet';

export interface Payment {
  id: string;
  patientId: string;
  patientName: string;
  amount: number;
  date: string;
  treatment: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  billId?: string;
  notes?: string;
  collectedBy: string;
  createdAt: string;
}

// export interface Bill {
//   id: string;
//   billNumber: string;
//   patientId: string;
//   patientName: string;
//   patientPhone: string;
//   queueId?: string;
//   appointmentId?: string;
//   date: string;
//   dueDate?: string;
//   items: BillItem[];
//   subTotal: number;
//   discount: number;
//   taxRate: number;
//   taxAmount: number;
//   totalAmount: number;
//   amountPaid: number;
//   balance: number;
//   paymentStatus: PaymentStatus;
//   paymentMethod?: PaymentMethod;
//   notes?: string;
//   createdBy: string;
//   createdAt: string;
//   updatedAt?: string;
// }


// types/index.ts - Bill interface update karein
export interface Bill {
  id: string;
  billNumber: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  patientPhone?: string; // Add optional
  queueItemId?: string;
  treatment?: string;
  
  // Financial fields
  fee?: number;
  amountPaid?: number;
  discount?: number;
  tax?: number;
  totalAmount?: number;
  
  // Payment info
  paymentStatus?: 'pending' | 'partial' | 'paid';
  paymentMethod?: string;
  
  // Dates
  createdDate?: string;
  date?: string; // Add if needed
  updatedAt?: string;
  
  // Additional optional fields
  items?: BillItem[];
  subTotal?: number; // Add if needed
  taxRate?: number; // Add if needed
  
  // For filtering/sorting
  doctor?: string;
  status?: string;
}

export interface BillItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
  taxRate?: number;
}

export interface Invoice extends Bill {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail: string;
  doctorName?: string;
}

// =============================================
// TREATMENT & APPOINTMENT TYPES
// =============================================

export interface Treatment {
  id: string;
  name: string;
  description?: string;
  fee: number;
  category: string;
  duration: number; // in minutes
  isActive: boolean;
  colorCode?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentPriority = 'normal' | 'urgent' | 'follow_up' | 'new';

export interface Appointment {
  id: string;
  appointmentNumber: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId?: string;
  doctorName?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  treatment?: string;
  treatmentId?: string;
  notes?: string;
  tokenNumber?: number;
  checkInTime?: string;
  checkOutTime?: string;
  fee?: number;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface TimeSlot {
  id: string;
  doctorId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'available' | 'booked' | 'blocked' | 'break';
  appointmentId?: string;
}

// =============================================
// QUEUE MANAGEMENT TYPES
// =============================================

export type QueueStatus = 'waiting' | 'in_treatment' | 'completed' | 'cancelled';
export type QueuePriority = 'normal' | 'urgent' | 'emergency';

// export interface QueueItem {
//   id: string;
//   queueNumber: string;
//   patientId: string;
//   patientName: string;
//   patientPhone: string;
//   tokenNumber: number;
//   status: QueueStatus;
//   priority: QueuePriority;
//   checkInTime: string;
//   checkOutTime?: string;
//   waitDuration?: number; // in minutes
//   treatmentStartTime?: string;
//   treatmentEndTime?: string;
//   treatment: string;
//   treatmentId?: string;
//   doctorId?: string;
//   doctorName?: string;
//   notes?: string;
//   fee?: number;
//   paymentStatus?: PaymentStatus;
//   amountPaid?: number;
//   previousBalance?: number;
//   appointmentId?: string;
//   createdBy: string;
//   createdAt: string;
//   updatedAt?: string;
//   cancelledAt?: string;
//   cancellationReason?: string;
//   doctor?: string;
//   previousPending?: number;
// }


export interface QueueItem {
  id: string;
  patientId: string;
  patientNumber?: string;
  patientName: string;
  patientPhone?: string;
  tokenNumber: number;
  status: 'waiting' | 'in_treatment' | 'completed' | 'cancelled';
  checkInTime: string;
  treatmentStartTime?: string | null;
  treatmentEndTime?: string | null;
  treatment?: string;
  doctor?: string;
  priority: 'normal' | 'urgent';
  notes?: string;
  fee?: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  amountPaid?: number;
  previousPending?: number;
  discount?: number;
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FirebaseQueueItem extends Omit<QueueItem, 'id'> {
  id?: string;
}

// =============================================
// CLINIC SETTINGS & CONFIGURATION TYPES
// =============================================

export interface ClinicSettings {
  id: string;
  clinicName: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  taxId?: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  businessHours: {
    monday: { open: string; close: string; isOpen: boolean };
    tuesday: { open: string; close: string; isOpen: boolean };
    wednesday: { open: string; close: string; isOpen: boolean };
    thursday: { open: string; close: string; isOpen: boolean };
    friday: { open: string; close: string; isOpen: boolean };
    saturday: { open: string; close: string; isOpen: boolean };
    sunday: { open: string; close: string; isOpen: boolean };
  };
  appointmentDuration: number;
  bufferTime: number;
  slotInterval: number;
  maxAppointmentsPerDay: number;
  reminderSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    reminderTime: number; // hours before appointment
    confirmationTime: number; // hours after booking
  };
  invoiceSettings: {
    prefix: string;
    nextNumber: number;
    footerText?: string;
    termsAndConditions?: string;
    clinicLogo?: string;
  };
  smsSettings?: {
    provider: string;
    apiKey?: string;
    senderId?: string;
    enabled: boolean;
  };
  emailSettings?: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    enabled: boolean;
  };
  backupSettings: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    backupTime: string;
    keepBackups: number; // days
    cloudStorage?: boolean;
    lastBackup?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// EXPENSE MANAGEMENT TYPES
// =============================================

export type ExpenseCategory = 
  | 'rent' 
  | 'salary' 
  | 'supplies' 
  | 'utilities' 
  | 'equipment' 
  | 'medication' 
  | 'maintenance' 
  | 'marketing'
  | 'insurance'
  | 'professional_fees'
  | 'travel'
  | 'office_supplies'
  | 'software'
  | 'other';

export interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  date: string;
  vendor?: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  status: 'paid' | 'pending' | 'cancelled';
  paidBy?: string;
  approvedBy?: string;
  attachment?: string;
  notes?: string;
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExpenseReport {
  id: string;
  period: string; // "January 2024", "Q1 2024", etc.
  startDate: string;
  endDate: string;
  totalExpenses: number;
  categoryBreakdown: Record<ExpenseCategory, number>;
  paymentMethodBreakdown: Record<PaymentMethod, number>;
  month: number;
  year: number;
  generatedAt: string;
  generatedBy: string;
}

// =============================================
// STAFF & SALARY MANAGEMENT TYPES
// =============================================

export interface Staff {
  id: string;
  name: string;
  role: string;
  experience: string;
  phone: string;
  joinDate: string;
  status: string;
  salary: number;
  salaryDuration: 'daily' | 'weekly' | 'monthly';
  workingDaysPerWeek: number;
  pendingSalary: number;
  totalPaid: number;
  lastSalaryDate?: string;
  nextSalaryDate?: string;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  date: string;
  period: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  status: 'paid';
  paymentMethod: string;
  notes: string;
  startDate: string;
  endDate: string;
}

export interface Attendance {
  id: string;
  staffId: string;
  date: string;
  status: 'present' | 'absent' | 'leave';
  notes?: string;
}

// =============================================
// INVENTORY & SUPPLY MANAGEMENT TYPES
// =============================================

export type InventoryCategory = 
  | 'medicine' 
  | 'disposable' 
  | 'equipment' 
  | 'dental_material' 
  | 'lab_supply' 
  | 'office_supply' 
  | 'cleaning' 
  | 'other';

export type UnitType = 'pieces' | 'boxes' | 'packs' | 'bottles' | 'tubes' | 'ml' | 'gm' | 'kg' | 'liters';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  unit: UnitType;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  purchaseRate: number;
  sellingRate?: number;
  supplierId?: string;
  supplierName?: string;
  expiryDate?: string;
  batchNumber?: string;
  location?: string;
  isActive: boolean;
  reorderPoint: number;
  lastRestocked?: string;
  totalValue: number;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryTransaction {
  id: string;
  transactionNumber: string;
  itemId: string;
  itemName: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'wastage';
  quantity: number;
  unit: UnitType;
  rate: number;
  total: number;
  previousQuantity: number;
  newQuantity: number;
  reference?: string; // Bill ID, Purchase Order, etc.
  notes?: string;
  performedBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  rating?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// BACKUP & DATA MANAGEMENT TYPES
// =============================================

export type BackupType = 'full' | 'partial' | 'incremental';
export type BackupStatus = 'success' | 'failed' | 'in_progress';

export interface BackupHistory {
  id: string;
  backupNumber: string;
  type: BackupType;
  size: string; // e.g., "45 MB"
  collections: string[];
  status: BackupStatus;
  path?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  restorePoint?: boolean;
}

export interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string;
  backupType: BackupType;
  keepBackups: number; // days
  cloudStorage: boolean;
  cloudProvider?: 'google_drive' | 'dropbox' | 'aws';
  lastBackup?: string;
  nextBackup?: string;
}

// =============================================
// ANALYTICS & REPORTING TYPES
// =============================================

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  waitingPatients: number;
  inTreatment: number;
  completedToday: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalExpenses: number;
  monthlyExpenses: number;
  netProfit: number;
  outstandingDues: number;
  collectionRate: number; // percentage
  patientGrowth: number; // percentage
  revenueGrowth: number; // percentage
  popularTreatments: Array<{name: string; count: number; revenue: number}>;
  doctorPerformance: Array<{doctorName: string; patients: number; revenue: number}>;
  updatedAt: string;
}

export interface FinancialReport {
  period: string;
  startDate: string;
  endDate: string;
  revenue: {
    total: number;
    byTreatment: Record<string, number>;
    byDoctor: Record<string, number>;
    byPaymentMethod: Record<PaymentMethod, number>;
    daily: Array<{date: string; amount: number}>;
  };
  expenses: {
    total: number;
    byCategory: Record<ExpenseCategory, number>;
    daily: Array<{date: string; amount: number}>;
  };
  profit: number;
  profitMargin: number; // percentage
  outstanding: number;
  collectionEfficiency: number; // percentage
}

export interface PatientReport {
  period: string;
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  byGender: {male: number; female: number; other: number};
  byAgeGroup: Record<string, number>;
  topTreatments: Array<{treatment: string; count: number}>;
  patientRetentionRate: number; // percentage
  averageRevenuePerPatient: number;
}

// =============================================
// NOTIFICATION & AUDIT TYPES
// =============================================

export type NotificationType = 
  | 'appointment_reminder' 
  | 'payment_received' 
  | 'inventory_low' 
  | 'backup_completed' 
  | 'salary_paid' 
  | 'expense_added'
  | 'system_alert';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  recipientId?: string;
  recipientRole?: UserRole;
  read: boolean;
  actionUrl?: string;
  data?: any;
  createdAt: string;
  expiresAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// =============================================
// FIREBASE SPECIFIC TYPES
// =============================================

// Base interface for all Firebase documents
export interface FirebaseDocument {
  id?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  createdBy?: string;
  updatedBy?: string;
}

// Generic type for Firebase operations
export interface FirebaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Pagination interface
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// =============================================
// FORM & VALIDATION TYPES
// =============================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox' | 'radio';
  required: boolean;
  placeholder?: string;
  options?: Array<{value: string; label: string}>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
  };
}

export interface FormError {
  field: string;
  message: string;
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: FormError[];
  timestamp: string;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: FormError[];
  timestamp: string;
}

// =============================================
// SEARCH & FILTER TYPES
// =============================================

export interface SearchFilters {
  searchTerm?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string | string[];
  category?: string;
  doctorId?: string;
  paymentStatus?: PaymentStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// CALENDAR & SCHEDULING TYPES
// =============================================

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    type: 'appointment' | 'block' | 'holiday' | 'meeting';
    patientId?: string;
    patientName?: string;
    doctorId?: string;
    status?: AppointmentStatus;
    notes?: string;
  };
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctorName: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isWorking: boolean;
  breakStart?: string;
  breakEnd?: string;
  maxPatients?: number;
  createdAt: string;
  updatedAt?: string;
}

// =============================================
// EXPORT ALL TYPES
// =============================================

// export type {
//   UserRole,
//   PaymentStatus,
//   PaymentMethod,
//   AppointmentStatus,
//   AppointmentPriority,
//   QueueStatus,
//   QueuePriority,
//   ExpenseCategory,
//   StaffRole,
//   StaffStatus,
//   SalaryDuration,
//   InventoryCategory,
//   UnitType,
//   BackupType,
//   BackupStatus,
//   NotificationType,
//   NotificationPriority,
// };
