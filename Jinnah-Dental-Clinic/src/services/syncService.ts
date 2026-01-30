import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { saveToLocal, getFromLocal, deleteFromLocal } from '@/services/indexedDbUtils';
import { toast } from 'sonner';

/**
 * smartSync
 * Saves data locally immediately, then attempts to sync to Firebase.
 * If offline, adds to a sync queue for future reconciliation.
 */
export const smartSync = async (collectionName: string, data: any) => {
  const docId = data.id || data.role;
  if (!docId) {
    console.error('smartSync error: No ID or Role provided', data);
    return;
  }

  const enrichedData = {
    ...data,
    lastUpdated: Date.now(),
    needsSync: false
  };

  // 1. Save to IndexedDB (Always first, local source of truth)
  try {
    await saveToLocal(collectionName, enrichedData);
    console.log(`Local save success: ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`Local save failed for ${collectionName}:`, err);
    throw err; // Critical failure if we can't save locally
  }

  // 2. Attempt Firebase Sync
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, enrichedData);
    console.log(`Firebase sync success: ${collectionName}/${docId}`);

    // If successfully synced, ensure it's removed from syncQueue if it was there
    await deleteFromLocal('syncQueue', `${collectionName}_${docId}`).catch(() => { });
  } catch (err: any) {
    // 3. Handle Offline/Connectivity failure
    console.warn(`Firebase sync failed for ${collectionName}. Adding to queue.`, err);

    // Update local record with needsSync flag
    await saveToLocal(collectionName, {
      ...enrichedData,
      needsSync: true
    });

    // Add to specific syncQueue store
    await saveToLocal('syncQueue', {
      id: `${collectionName}_${docId}`,
      collectionName,
      docId,
      timestamp: Date.now()
    });

    // Notify user of offline status if not already notified
    toast.error("Offline Mode: Data saved locally.", {
      id: "offline-sync-toast",
      description: "It will be synced automatically when you're back online."
    });
  }
};

/**
 * processSyncQueue
 * Called when connection is restored. Loops through the queue and syncs data to Firebase.
 */
export const processSyncQueue = async () => {
  try {
    const queue = await getFromLocal('syncQueue') as any[];
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} items from sync queue...`);
    toast.info(`Syncing ${queue.length} offline changes...`, { id: 're-sync-info' });

    for (const task of queue) {
      try {
        const { collectionName, docId } = task;
        const localData = await getFromLocal(collectionName, docId);

        if (localData) {
          const docRef = doc(db, collectionName, docId);
          await setDoc(docRef, { ...localData, needsSync: false });

          // Clear from local as synced
          await saveToLocal(collectionName, { ...localData, needsSync: false });
          await deleteFromLocal('syncQueue', task.id);
          console.log(`Re-sync success: ${collectionName}/${docId}`);
        } else {
          // Item missing locally, just remove from queue
          await deleteFromLocal('syncQueue', task.id);
        }
      } catch (err) {
        console.error(`Re-sync failed for ${task.id}:`, err);
        // Continue to next item
      }
    }

    toast.success("Synchronized successfully!", { id: 're-sync-info' });
  } catch (err) {
    console.error('Error processing sync queue:', err);
  }
};

export const syncPatientAfterTreatment = async (patientNumber: string) => {
  try {
    console.log(`Syncing patient ${patientNumber}...`);

    // 1. Find patient
    const patientsRef = collection(db, 'patients');
    const patientQuery = query(patientsRef, where('patientNumber', '==', patientNumber));
    const patientSnapshot = await getDocs(patientQuery);

    if (patientSnapshot.empty) {
      console.warn(`Patient ${patientNumber} not found`);
      return null;
    }

    const patientDoc = patientSnapshot.docs[0];
    const patientId = patientDoc.id;
    const currentPatient = patientDoc.data();

    console.log('Current patient data:', currentPatient);

    // 2. Get ALL queue items for this patient (including completed, cancelled, etc.)
    const queueRef = collection(db, 'queue');
    const queueQuery = query(queueRef, where('patientNumber', '==', patientNumber));
    const queueSnapshot = await getDocs(queueQuery);

    // 3. Get ALL bills for this patient
    const billsRef = collection(db, 'bills');
    const billsQuery = query(billsRef, where('patientId', '==', patientNumber));
    const billsSnapshot = await getDocs(billsQuery);

    // 4. DEBUG: Log all data
    const queueItems = queueSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`Queue item ${doc.id}:`, {
        fee: data.fee,
        previousPending: data.previousPending,
        amountPaid: data.amountPaid,
        status: data.status
      });
      return data;
    });

    const bills = billsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`Bill ${doc.id}:`, {
        amountPaid: data.amountPaid,
        totalAmount: data.totalAmount
      });
      return data;
    });

    // 5. CALCULATE CORRECT STATS

    // Get opening balance from patient record (or use 0 if not set)
    const openingBalance = currentPatient.openingBalance || 0;
    console.log(`Opening balance: ${openingBalance}`);

    // Calculate total treatment fees (only from completed treatments)
    const completedTreatments = queueItems.filter((item: any) =>
      item.status === 'completed' || item.status === 'in_treatment'
    );

    const totalTreatmentFees = completedTreatments.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.fee) || 0),
      0
    );
    console.log(`Total treatment fees: ${totalTreatmentFees}`);

    // Calculate total paid from ALL sources
    // First from queue items (amountPaid field)
    const totalPaidFromQueue = queueItems.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.amountPaid) || 0),
      0
    );

    // Then from bills
    const totalPaidFromBills = bills.reduce(
      (sum: number, bill: any) => sum + (parseFloat(bill.amountPaid) || 0),
      0
    );

    const totalPaid = totalPaidFromQueue + totalPaidFromBills;
    console.log(`Total paid: ${totalPaid} (queue: ${totalPaidFromQueue}, bills: ${totalPaidFromBills})`);

    // Calculate total due and pending balance
    const totalDue = openingBalance + totalTreatmentFees;
    const pendingBalance = totalDue - totalPaid;

    console.log('CALCULATION SUMMARY:');
    console.log(`- Opening Balance: ${openingBalance}`);
    console.log(`- Total Treatments: ${totalTreatmentFees}`);
    console.log(`- Total Due: ${totalDue}`);
    console.log(`- Total Paid: ${totalPaid}`);
    console.log(`- Pending Balance: ${pendingBalance}`);

    // Count total visits (completed treatments)
    const totalVisits = completedTreatments.length;

    // Find most recent visit
    const lastVisit = completedTreatments.length > 0
      ? completedTreatments.sort((a: any, b: any) => {
        const dateA = new Date(a.treatmentEndTime || a.checkInTime || 0).getTime();
        const dateB = new Date(b.treatmentEndTime || b.checkInTime || 0).getTime();
        return dateB - dateA;
      })[0]?.treatmentEndTime || completedTreatments[0]?.checkInTime
      : undefined;

    // 6. Update patient with CORRECT values
    const updateData = {
      totalVisits,
      totalPaid,
      pendingBalance,
      ...(lastVisit && { lastVisit }),
      updatedAt: serverTimestamp()
    };

    console.log('Updating patient with:', updateData);

    await updateDoc(doc(db, 'patients', patientId), updateData);

    return {
      ...updateData,
      openingBalance,
      totalTreatmentFees,
      totalDue
    };
  } catch (error) {
    console.error('Error syncing patient:', error);
    throw error;
  }
};