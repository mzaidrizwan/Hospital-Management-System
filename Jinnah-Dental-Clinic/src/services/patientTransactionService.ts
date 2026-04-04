import { PatientTransaction, Patient, Bill } from '@/types';
import { dbManager } from '@/lib/indexedDB';
import { addItem } from '@/context/DataContext'; // Adjust import as needed

export const patientTransactionService = {
  /**
   * Create a payment transaction
   */
  async createPayment(
    patient: Patient,
    bill: Bill,
    amount: number,
    method: 'cash' | 'online' | 'bank',
    notes?: string
  ): Promise<PatientTransaction> {
    const transaction: PatientTransaction = {
      id: `ptxn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      type: 'payment',
      amount: amount,
      paymentMethod: method,
      billId: bill.id,
      queueItemId: bill.queueItemId,
      date: new Date().toISOString(),
      notes: notes || `Payment for treatment via ${method}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addItem('patientTransactions', transaction);
    console.log('✅ Payment transaction created:', transaction);
    return transaction;
  },

  /**
   * Create opening balance transaction
   */
  async createOpeningBalance(
    patient: Patient,
    amount: number,
    notes?: string
  ): Promise<PatientTransaction> {
    const transaction: PatientTransaction = {
      id: `ptxn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      type: 'opening_balance',
      amount: amount,
      date: new Date().toISOString(),
      notes: notes || `Opening balance from previous system: Rs.${amount}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addItem('patientTransactions', transaction);
    console.log('✅ Opening balance transaction created:', transaction);
    return transaction;
  },

  /**
   * Create discount transaction
   */
  async createDiscount(
    patient: Patient,
    bill: Bill,
    amount: number,
    reason?: string
  ): Promise<PatientTransaction> {
    const transaction: PatientTransaction = {
      id: `ptxn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      type: 'discount',
      amount: -amount, // Negative amount for discount
      billId: bill.id,
      queueItemId: bill.queueItemId,
      date: new Date().toISOString(),
      notes: reason || `Discount applied: Rs.${amount}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addItem('patientTransactions', transaction);
    console.log('✅ Discount transaction created:', transaction);
    return transaction;
  },

  /**
   * Create pre-receive (advance payment) transaction
   */
  async createPreReceive(
    patient: Patient,
    amount: number,
    notes?: string
  ): Promise<PatientTransaction> {
    const transaction: PatientTransaction = {
      id: `ptxn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      type: 'pre_receive',
      amount: amount,
      paymentMethod: 'cash',
      date: new Date().toISOString(),
      notes: notes || `Advance payment received: Rs.${amount}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addItem('patientTransactions', transaction);
    console.log('✅ Pre-receive transaction created:', transaction);
    return transaction;
  },

  /**
   * Calculate patient's current pending balance from transactions
   */
  async calculatePatientPendingBalance(patientId: string): Promise<number> {
    const transactions = await dbManager.getFromLocal('patientTransactions') || [];
    const patientTxns = transactions.filter(t => t.patientId === patientId);
    
    // Get patient to get opening balance
    const patients = await dbManager.getFromLocal('patients') || [];
    const patient = patients.find(p => p.id === patientId);
    const openingBalance = patient?.openingBalance || 0;
    
    // Calculate: Opening Balance + Payments - Discounts - Pre-receives
    let total = openingBalance;
    
    for (const txn of patientTxns) {
      if (txn.type === 'payment') {
        total -= txn.amount; // Payment reduces balance
      } else if (txn.type === 'discount') {
        total += txn.amount; // Discount is negative amount
      } else if (txn.type === 'pre_receive') {
        total -= txn.amount; // Pre-receive reduces balance
      } else if (txn.type === 'opening_balance') {
        // Already added, skip
      }
    }
    
    return Math.max(0, total);
  }
};