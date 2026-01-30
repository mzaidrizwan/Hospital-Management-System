
const DB_NAME = 'ClinicDB';
const DB_VERSION = 3; // Bumped to 3 to ensure all new stores are created
const STORES = [
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
    'syncQueue'
];

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            STORES.forEach(store => {
                if (!db.objectStoreNames.contains(store)) {
                    // Most stores use 'id', but 'users' used 'role' in some places.
                    // Let's use 'id' as default and handle special cases if needed.
                    // Based on the code seen, 'users' uses 'role' as keyPath in some implementations.
                    const keyPath = store === 'users' ? 'role' : 'id';
                    db.createObjectStore(store, { keyPath });
                }
            });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
            console.warn('IndexedDB blocked');
            // On blocked, we might want to reject or handle it.
        };
    });

    return dbPromise;
};

export async function saveToLocal(storeName: string, data: any): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getFromLocal(storeName: string, id?: string): Promise<any> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = id ? store.get(id) : store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteFromLocal(storeName: string, id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function clearStore(storeName: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
