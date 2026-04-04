// src/scripts/migrateAttendance.ts
import { dbManager } from '@/lib/indexedDB';
import { Attendance } from '@/types';

export const migrateAttendanceRecords = async () => {
    console.log('🚀 Starting attendance migration...');
    
    try {
        const allAttendance = await dbManager.getFromLocal('attendance');
        
        if (!allAttendance || allAttendance.length === 0) {
            console.log('📭 No attendance records to migrate');
            return;
        }
        
        console.log(`📊 Found ${allAttendance.length} attendance records to process`);
        
        let migratedCount = 0;
        let skippedCount = 0;
        let duplicateCount = 0;
        
        // Track used timestamps to avoid duplicates during migration
        const usedTimestamps = new Map<string, string[]>(); // staffId -> array of timestamps
        
        for (const record of allAttendance) {
            let needsUpdate = false;
            const updatedRecord = { ...record };
            
            // Initialize tracking for this staff member if not exists
            if (!usedTimestamps.has(record.staffId)) {
                usedTimestamps.set(record.staffId, []);
            }
            const staffTimestamps = usedTimestamps.get(record.staffId)!;
            
            // Add time if missing
            if (!record.time) {
                // Generate unique time based on record ID to avoid duplicates
                const uniqueMinutes = (parseInt(record.id.split('-').pop() || '0') % 60).toString().padStart(2, '0');
                const uniqueSeconds = (parseInt(record.id.split('-').pop() || '0') % 60).toString().padStart(2, '0');
                updatedRecord.time = `09:${uniqueMinutes}:${uniqueSeconds}`;
                needsUpdate = true;
                console.log(`⏰ Adding unique time to ${record.id} (${record.date}): ${updatedRecord.time}`);
            }
            
            // Add timestamp if missing
            if (!record.timestamp && record.date) {
                let baseTimestamp = `${record.date}T${updatedRecord.time}`;
                let finalTimestamp = baseTimestamp;
                let counter = 1;
                
                // Check for duplicate timestamp for this staff member
                while (staffTimestamps.includes(finalTimestamp)) {
                    // Add milliseconds to make it unique
                    const ms = counter.toString().padStart(3, '0');
                    finalTimestamp = `${baseTimestamp}.${ms}`;
                    counter++;
                }
                
                updatedRecord.timestamp = finalTimestamp;
                staffTimestamps.push(finalTimestamp);
                needsUpdate = true;
                console.log(`📅 Adding unique timestamp to ${record.id}: ${finalTimestamp}`);
                
                if (finalTimestamp !== baseTimestamp) {
                    duplicateCount++;
                    console.log(`⚠️ Duplicate detected, using unique timestamp: ${finalTimestamp}`);
                }
            }
            
            // Add synced flag if missing
            if (record.synced === undefined) {
                updatedRecord.synced = false;
                needsUpdate = true;
            }
            
            // Add updatedAt if missing
            if (!record.updatedAt) {
                updatedRecord.updatedAt = record.createdAt || new Date().toISOString();
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                try {
                    await dbManager.saveToLocal('attendance', updatedRecord);
                    migratedCount++;
                } catch (saveError: any) {
                    console.error(`❌ Failed to save record ${record.id}:`, saveError);
                    if (saveError.name === 'ConstraintError') {
                        console.log(`   Attempting to save without timestamp...`);
                        // If still failing, save without timestamp and let the sync handle it
                        const { timestamp, ...recordWithoutTimestamp } = updatedRecord;
                        await dbManager.saveToLocal('attendance', recordWithoutTimestamp);
                        migratedCount++;
                    } else {
                        throw saveError;
                    }
                }
            } else {
                skippedCount++;
            }
        }
        
        console.log(`
✅ Migration Complete!
   - Migrated: ${migratedCount} records
   - Skipped: ${skippedCount} records
   - Duplicates resolved: ${duplicateCount} records
   - Total processed: ${allAttendance.length} records
        `);
        
        // Verify the migration
        const verifyAttendance = await dbManager.getFromLocal('attendance');
        const timestampIssues = verifyAttendance.filter((a: Attendance) => {
            if (!a.timestamp) return false;
            // Check for duplicates for same staff
            const sameStaff = verifyAttendance.filter((b: Attendance) => 
                b.staffId === a.staffId && b.timestamp === a.timestamp
            );
            return sameStaff.length > 1;
        });
        
        if (timestampIssues.length > 0) {
            console.warn(`⚠️ Found ${timestampIssues.length} records with duplicate timestamps after migration`);
            console.warn('Duplicate records:', timestampIssues);
        } else {
            console.log('✅ No timestamp duplicates found after migration');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

// Helper function to clear all attendance data if needed (use with caution)
export const clearAttendanceData = async () => {
    if (confirm('⚠️ WARNING: This will delete ALL attendance records. Are you sure?')) {
        await dbManager.clearStore('attendance');
        console.log('🗑️ All attendance records cleared');
    }
};