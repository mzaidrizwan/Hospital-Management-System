// // src/lib/indexedDB.ts
// export class IndexedDBManager {
//   private static instance: IndexedDBManager;
//   private db: IDBDatabase | null = null;
//   private initialized = false;
//   private initPromise: Promise<void> | null = null;
//   private readonly DB_VERSION = 12;

//   private constructor() {}

//   static getInstance(): IndexedDBManager {
//     if (!IndexedDBManager.instance) {
//       IndexedDBManager.instance = new IndexedDBManager();
//     }
//     return IndexedDBManager.instance;
//   }

//   async initialize(): Promise<void> {
//     if (this.initialized) return;
//     if (this.initPromise) return this.initPromise;

//     this.initPromise = new Promise((resolve, reject) => {
//       const request = indexedDB.open('ClinicDB', this.DB_VERSION);

//       request.onupgradeneeded = (event) => {
//         console.log(`IndexedDB upgrade: ${event.oldVersion} → ${this.DB_VERSION}`);
//         const db = (event.target as IDBOpenDBRequest).result;

//         const stores = [
//           'users', 'staff', 'salaryPayments', 'attendance',
//           'inventory', 'sales', 'queueItems', 'patients', 'bills',
//           'roles', 'expenses', 'purchases', 'settings', 'queue', 'clinicSettings',
//           'treatments', 'appointments', 'transactions', 'syncQueue'
//         ];

//         stores.forEach(name => {
//           if (!db.objectStoreNames.contains(name)) {
//             console.log(`Creating store: ${name}`);
//             const keyPath = name === 'users' ? 'role' : 'id';
//             db.createObjectStore(name, { keyPath });
//           }
//         });
//       };

//       request.onsuccess = () => {
//         this.db = request.result;
//         this.initialized = true;
//         console.log('✅ IndexedDB ready. Stores:', Array.from(this.db.objectStoreNames));
//         resolve();
//       };

//       request.onerror = () => {
//         console.error('❌ IndexedDB open failed:', request.error);
//         reject(request.error);
//       };
//     });

//     return this.initPromise;
//   }

//   // ====================== MAIN FUNCTIONS (Same names as before) ======================

//   async putItem(storeName: string, item: any): Promise<void> {
//     await this.initialize();
//     if (!this.db?.objectStoreNames.contains(storeName)) {
//       throw new Error(`Store "${storeName}" not found. Clear IndexedDB and reload.`);
//     }
//     return new Promise((resolve, reject) => {
//       const tx = this.db!.transaction(storeName, 'readwrite');
//       const store = tx.objectStore(storeName);
//       const req = store.put(item);
//       req.onsuccess = () => resolve();
//       req.onerror = () => reject(req.error);
//     });
//   }

//   async getFromLocal(storeName: string, id?: string): Promise<any> {
//     await this.initialize();
//     if (!this.db?.objectStoreNames.contains(storeName)) {
//       return id ? null : [];
//     }

//     return new Promise((resolve, reject) => {
//       const tx = this.db!.transaction(storeName, 'readonly');
//       const store = tx.objectStore(storeName);

//       if (id) {
//         const req = store.get(id);
//         req.onsuccess = () => resolve(req.result);
//         req.onerror = () => reject(req.error);
//       } else {
//         const req = store.getAll();
//         req.onsuccess = () => resolve(req.result || []);
//         req.onerror = () => reject(req.error);
//       }
//     });
//   }

//   async saveToLocal(storeName: string, data: any): Promise<void> {
//     return this.putItem(storeName, data);
//   }

//   async deleteFromLocal(storeName: string, id: string): Promise<void> {
//     await this.initialize();
//     if (!this.db?.objectStoreNames.contains(storeName)) return;

//     return new Promise((resolve, reject) => {
//       const tx = this.db!.transaction(storeName, 'readwrite');
//       const store = tx.objectStore(storeName);
//       const req = store.delete(id);
//       req.onsuccess = () => resolve();
//       req.onerror = () => reject(req.error);
//     });
//   }

//   async clearStore(storeName: string): Promise<void> {
//     await this.initialize();
//     if (!this.db?.objectStoreNames.contains(storeName)) return;

//     return new Promise((resolve, reject) => {
//       const tx = this.db!.transaction(storeName, 'readwrite');
//       const store = tx.objectStore(storeName);
//       const req = store.clear();
//       req.onsuccess = () => resolve();
//       req.onerror = () => reject(req.error);
//     });
//   }

//   async saveMultipleToLocal(storeName: string, items: any[]): Promise<void> {
//     await this.initialize();
//     if (!this.db?.objectStoreNames.contains(storeName)) {
//       throw new Error(`Store "${storeName}" not found`);
//     }

//     return new Promise((resolve, reject) => {
//       const tx = this.db!.transaction(storeName, 'readwrite');
//       const store = tx.objectStore(storeName);
//       items.forEach(item => store.put(item));
//       tx.oncomplete = () => resolve();
//       tx.onerror = () => reject(tx.error);
//     });
//   }

//   async getAllStores(): Promise<string[]> {
//     await this.initialize();
//     return this.db ? Array.from(this.db.objectStoreNames) : [];
//   }

//   // Extra helpers
//   async putMultiple(storeName: string, items: any[]): Promise<void> {
//     return this.saveMultipleToLocal(storeName, items);
//   }

//   async getItem(storeName: string, id: string): Promise<any> {
//     return this.getFromLocal(storeName, id);
//   }
// }

// export const STORE_CONFIGS: Record<string, { keyPath: string }> = {
//     'users': { keyPath: 'role' },
//     'clinicSettings': { keyPath: 'id' },
//     // Default for all other stores
//     'patients': { keyPath: 'id' },
//     'queue': { keyPath: 'id' },
//     'appointments': { keyPath: 'id' },
//     'staff': { keyPath: 'id' },
//     'salaryPayments': { keyPath: 'id' },
//     'attendance': { keyPath: 'id' },
//     'inventory': { keyPath: 'id' },
//     'sales': { keyPath: 'id' },
//     'expenses': { keyPath: 'id' },
//     'bills': { keyPath: 'id' },
//     'treatments': { keyPath: 'id' },
//     'transactions': { keyPath: 'id' },
//     'purchases': { keyPath: 'id' },
//     'roles': { keyPath: 'id' },
//     'settings': { keyPath: 'id' },
//     'syncQueue': { keyPath: 'id' },
//     'queueItems': { keyPath: 'id' },
// };

// // Default keyPath getter helper
// export function getKeyPath(storeName: string): string {
//     return STORE_CONFIGS[storeName]?.keyPath || 'id';
// }



// export const dbManager = IndexedDBManager.getInstance();



// src/lib/indexedDB.ts
export class IndexedDBManager {
  private static instance: IndexedDBManager;
  private db: IDBDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly DB_VERSION = 13; // INCREASE VERSION to 13 for schema update

  private constructor() {}

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager();
    }
    return IndexedDBManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('ClinicDB', this.DB_VERSION);

      request.onupgradeneeded = (event) => {
    console.log(`IndexedDB upgrade: ${event.oldVersion} → ${this.DB_VERSION}`);
    const db = (event.target as IDBOpenDBRequest).result;
    
    // Get the transaction from the event
    const transaction = (event.target as IDBOpenDBRequest).transaction;
    
    const stores = [
        'users', 'staff', 'salaryPayments', 'attendance',
        'inventory', 'sales', 'queueItems', 'patients', 'bills',
        'roles', 'expenses', 'purchases', 'settings', 'queue', 'clinicSettings',
        'treatments', 'appointments', 'transactions', 'syncQueue'
    ];

    stores.forEach(name => {
        let objectStore;
        if (!db.objectStoreNames.contains(name)) {
            console.log(`Creating store: ${name}`);
            const keyPath = name === 'users' ? 'role' : 'id';
            objectStore = db.createObjectStore(name, { keyPath });
            
            if (name === 'attendance') {
                console.log('Creating indexes for attendance store...');
                objectStore.createIndex('staffId', 'staffId', { unique: false });
                objectStore.createIndex('date', 'date', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false }); // Change to false
                objectStore.createIndex('staffId_date', ['staffId', 'date'], { unique: false });
                // Remove staffId_timestamp index or set to false
                // objectStore.createIndex('staffId_timestamp', ['staffId', 'timestamp'], { unique: false });
            }
            
            if (name === 'staff') {
                objectStore.createIndex('status', 'status', { unique: false });
                objectStore.createIndex('role', 'role', { unique: false });
            }
            
            if (name === 'salaryPayments') {
                objectStore.createIndex('staffId', 'staffId', { unique: false });
                objectStore.createIndex('date', 'date', { unique: false });
            }
            
            if (name === 'transactions') {
                objectStore.createIndex('staffId', 'staffId', { unique: false });
                objectStore.createIndex('type', 'type', { unique: false });
            }
        } else {
            // For existing stores, we need to use transaction
            if (transaction) {
                const objectStore = transaction.objectStore(name);
                if (name === 'attendance' && objectStore && !objectStore.indexNames.contains('timestamp')) {
                    console.log('Adding missing indexes to attendance store...');
                    try {
                        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                        // objectStore.createIndex('staffId_timestamp', ['staffId', 'timestamp'], { unique: false });
                    } catch (e) {
                        console.log('Index already exists or error:', e);
                    }
                }
            }
        }
    });
};

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('✅ IndexedDB ready. Stores:', Array.from(this.db.objectStoreNames));
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB open failed:', request.error);
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  // ====================== MAIN FUNCTIONS ======================

  async putItem(storeName: string, item: any): Promise<void> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains(storeName)) {
      throw new Error(`Store "${storeName}" not found. Clear IndexedDB and reload.`);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getFromLocal(storeName: string, id?: string): Promise<any> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains(storeName)) {
      return id ? null : [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      if (id) {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }
    });
  }

  async saveToLocal(storeName: string, data: any): Promise<void> {
    return this.putItem(storeName, data);
  }

  async deleteFromLocal(storeName: string, id: string): Promise<void> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains(storeName)) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName: string): Promise<void> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains(storeName)) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveMultipleToLocal(storeName: string, items: any[]): Promise<void> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains(storeName)) {
      throw new Error(`Store "${storeName}" not found`);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllStores(): Promise<string[]> {
    await this.initialize();
    return this.db ? Array.from(this.db.objectStoreNames) : [];
  }

  // NEW: Query attendance by time range
  async getAttendanceByTimeRange(staffId: string, startDate: string, endDate: string): Promise<any[]> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains('attendance')) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('attendance', 'readonly');
      const store = tx.objectStore('attendance');
      const index = store.index('staffId');
      const range = IDBKeyRange.only(staffId);
      const request = index.getAll(range);
      
      request.onsuccess = () => {
        const allAttendance = request.result || [];
        const filtered = allAttendance.filter(att => 
          att.date >= startDate && att.date <= endDate
        );
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // NEW: Check for duplicate attendance at same time
  async checkDuplicateAttendance(staffId: string, timestamp: string): Promise<boolean> {
    await this.initialize();
    if (!this.db?.objectStoreNames.contains('attendance')) return false;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('attendance', 'readonly');
      const store = tx.objectStore('attendance');
      const index = store.index('staffId_timestamp');
      const range = IDBKeyRange.only([staffId, timestamp]);
      const request = index.get(range);
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Extra helpers
  async putMultiple(storeName: string, items: any[]): Promise<void> {
    return this.saveMultipleToLocal(storeName, items);
  }

  async getItem(storeName: string, id: string): Promise<any> {
    return this.getFromLocal(storeName, id);
  }
}

export const STORE_CONFIGS: Record<string, { keyPath: string }> = {
    'users': { keyPath: 'role' },
    'clinicSettings': { keyPath: 'id' },
    // Default for all other stores
    'patients': { keyPath: 'id' },
    'queue': { keyPath: 'id' },
    'appointments': { keyPath: 'id' },
    'staff': { keyPath: 'id' },
    'salaryPayments': { keyPath: 'id' },
    'attendance': { keyPath: 'id' },
    'inventory': { keyPath: 'id' },
    'sales': { keyPath: 'id' },
    'expenses': { keyPath: 'id' },
    'bills': { keyPath: 'id' },
    'treatments': { keyPath: 'id' },
    'transactions': { keyPath: 'id' },
    'purchases': { keyPath: 'id' },
    'roles': { keyPath: 'id' },
    'settings': { keyPath: 'id' },
    'syncQueue': { keyPath: 'id' },
    'queueItems': { keyPath: 'id' },
};

// Default keyPath getter helper
export function getKeyPath(storeName: string): string {
    return STORE_CONFIGS[storeName]?.keyPath || 'id';
}

export const dbManager = IndexedDBManager.getInstance();