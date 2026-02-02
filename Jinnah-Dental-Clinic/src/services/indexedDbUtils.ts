const DB_NAME = 'ClinicDB';
const DB_VERSION = 5; // Bumped to 5 to include all new stores
const ALL_STORES = [
    // Existing stores
    'bills',
    'sales',
    'expenses',
    'inventory',
    'salaryPayments',
    'patients',
    'appointments',
    'queue',
    'treatments',
    'clinicSettings',
    'backups',
    'users',
    'syncQueue',
    
    // New stores from requirements
    'staff',
    'attendance',
    'billing',
    'settings'
];

// Map of store names to their keyPath configurations
const STORE_CONFIGS: Record<string, { keyPath: string }> = {
    // Most stores use 'id' as keyPath
    'bills': { keyPath: 'id' },
    'sales': { keyPath: 'id' },
    'expenses': { keyPath: 'id' },
    'inventory': { keyPath: 'id' },
    'salaryPayments': { keyPath: 'id' },
    'patients': { keyPath: 'id' },
    'appointments': { keyPath: 'id' },
    'queue': { keyPath: 'id' },
    'treatments': { keyPath: 'id' },
    'clinicSettings': { keyPath: 'id' },
    'backups': { keyPath: 'id' },
    'syncQueue': { keyPath: 'id' },
    'staff': { keyPath: 'id' },
    'attendance': { keyPath: 'id' },
    'billing': { keyPath: 'id' },
    'settings': { keyPath: 'id' },
    
    // Special cases
    'users': { keyPath: 'role' } // Based on previous code, users uses 'role' as keyPath
};

let dbPromise: Promise<IDBDatabase> | null = null;
let isUpgrading = false;

export const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            console.log(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);
            isUpgrading = true;
            const db = (event.target as IDBOpenDBRequest).result;
            
            // For each required store, check if it exists and create if not
            ALL_STORES.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const config = STORE_CONFIGS[storeName] || { keyPath: 'id' };
                    console.log(`Creating object store: ${storeName} with keyPath: ${config.keyPath}`);
                    db.createObjectStore(storeName, { keyPath: config.keyPath });
                } else {
                    // Store exists, but we might need to upgrade it
                    // For now, just keep it as is
                    console.log(`Object store ${storeName} already exists`);
                }
            });
            
            // Optional: Handle migration from old versions
            if (event.oldVersion > 0 && event.oldVersion < DB_VERSION) {
                handleDatabaseMigration(db, event.oldVersion);
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Double-check all stores exist (for safety)
            if (isUpgrading) {
                const missingStores = ALL_STORES.filter(storeName => 
                    !db.objectStoreNames.contains(storeName)
                );
                
                if (missingStores.length > 0) {
                    console.warn('Some stores are missing after upgrade:', missingStores);
                    // Try to create missing stores in a new transaction
                    const tx = db.transaction([], 'versionchange');
                    missingStores.forEach(storeName => {
                        const config = STORE_CONFIGS[storeName] || { keyPath: 'id' };
                        console.log(`Creating missing store: ${storeName}`);
                        db.createObjectStore(storeName, { keyPath: config.keyPath });
                    });
                    tx.commit?.();
                }
            }
            
            isUpgrading = false;
            resolve(db);
        };
        
        request.onerror = (event) => {
            console.error('Error opening IndexedDB:', (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
        
        request.onblocked = () => {
            console.warn('IndexedDB blocked - waiting for other connections to close');
            // You could show a message to the user here
        };
    });

    return dbPromise;
};

// Helper function to handle database migrations
function handleDatabaseMigration(db: IDBDatabase, oldVersion: number) {
    console.log(`Migrating from version ${oldVersion} to ${DB_VERSION}`);
    
    // Migration from version 1 to 2, etc.
    // Add specific migration logic here if needed
    
    // Example migration:
    if (oldVersion < 3) {
        // Create any new stores added in version 3
        ['patients', 'appointments', 'treatments'].forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        });
    }
    
    if (oldVersion < 4) {
        // Create any new stores added in version 4
        ['staff', 'attendance'].forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        });
    }
    
    if (oldVersion < 5) {
        // Create any new stores added in version 5
        ['billing', 'settings'].forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        });
    }
}

export async function saveToLocal(storeName: string, data: any): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            // Check if store exists before transaction
            if (!db.objectStoreNames.contains(storeName)) {
                console.error(`Object store "${storeName}" does not exist`);
                reject(new Error(`Object store "${storeName}" does not exist`));
                return;
            }
            
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            
            // Ensure data has the correct key based on store configuration
            const config = STORE_CONFIGS[storeName] || { keyPath: 'id' };
            if (!data[config.keyPath]) {
                console.error(`Data missing keyPath "${config.keyPath}" for store "${storeName}"`);
                reject(new Error(`Data missing keyPath "${config.keyPath}" for store "${storeName}"`));
                return;
            }
            
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            
            // Ensure transaction completes
            tx.oncomplete = () => {
                // Transaction completed successfully
            };
            tx.onerror = (event) => {
                console.error(`Transaction error for store "${storeName}":`, event);
            };
        });
    } catch (error) {
        console.error(`Error saving to store "${storeName}":`, error);
        throw error;
    }
}

export async function getFromLocal(storeName: string, id?: string): Promise<any> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            // Check if store exists before transaction
            if (!db.objectStoreNames.contains(storeName)) {
                console.warn(`Object store "${storeName}" does not exist, returning empty result`);
                resolve(id ? undefined : []);
                return;
            }
            
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            
            if (id) {
                const config = STORE_CONFIGS[storeName] || { keyPath: 'id' };
                // If the provided id doesn't match the keyPath type, handle it
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            }
            
            // Ensure transaction completes
            tx.oncomplete = () => {
                // Transaction completed successfully
            };
            tx.onerror = (event) => {
                console.error(`Transaction error for store "${storeName}":`, event);
            };
        });
    } catch (error) {
        console.error(`Error getting from store "${storeName}":`, error);
        // Return empty result instead of throwing for better UX
        return id ? undefined : [];
    }
}

export async function deleteFromLocal(storeName: string, id: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            // Check if store exists before transaction
            if (!db.objectStoreNames.contains(storeName)) {
                console.error(`Object store "${storeName}" does not exist`);
                reject(new Error(`Object store "${storeName}" does not exist`));
                return;
            }
            
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            
            // Ensure transaction completes
            tx.oncomplete = () => {
                // Transaction completed successfully
            };
            tx.onerror = (event) => {
                console.error(`Transaction error for store "${storeName}":`, event);
            };
        });
    } catch (error) {
        console.error(`Error deleting from store "${storeName}":`, error);
        throw error;
    }
}

export async function clearStore(storeName: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            // Check if store exists before transaction
            if (!db.objectStoreNames.contains(storeName)) {
                console.error(`Object store "${storeName}" does not exist`);
                reject(new Error(`Object store "${storeName}" does not exist`));
                return;
            }
            
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            
            // Ensure transaction completes
            tx.oncomplete = () => {
                // Transaction completed successfully
            };
            tx.onerror = (event) => {
                console.error(`Transaction error for store "${storeName}":`, event);
            };
        });
    } catch (error) {
        console.error(`Error clearing store "${storeName}":`, error);
        throw error;
    }
}

// Additional utility functions

export async function getAllStores(): Promise<string[]> {
    const db = await openDB();
    return Array.from(db.objectStoreNames);
}

export async function storeExists(storeName: string): Promise<boolean> {
    const db = await openDB();
    return db.objectStoreNames.contains(storeName);
}

export async function getStoreCount(storeName: string): Promise<number> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                resolve(0);
                return;
            }
            
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Error getting count for store "${storeName}":`, error);
        return 0;
    }
}

// Bulk operations
export async function saveMultipleToLocal(storeName: string, items: any[]): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) {
                console.error(`Object store "${storeName}" does not exist`);
                reject(new Error(`Object store "${storeName}" does not exist`));
                return;
            }
            
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            
            const config = STORE_CONFIGS[storeName] || { keyPath: 'id' };
            
            // Validate all items have the required key
            const invalidItems = items.filter(item => !item[config.keyPath]);
            if (invalidItems.length > 0) {
                reject(new Error(`${invalidItems.length} items missing keyPath "${config.keyPath}"`));
                return;
            }
            
            items.forEach(item => store.put(item));
            
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject((event.target as IDBTransaction).error);
        });
    } catch (error) {
        console.error(`Error saving multiple items to store "${storeName}":`, error);
        throw error;
    }
}

// Initialize database on module load (optional)
export async function initializeDatabase(): Promise<void> {
    try {
        await openDB();
        console.log('IndexedDB initialized successfully');
    } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        throw error;
    }
}

// Export constants for use in other modules
export { DB_NAME, DB_VERSION, ALL_STORES as STORES };