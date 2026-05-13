
const DB_NAME = 'CircuitDB';
const DB_VERSION = 2;

export interface ChatThread {
  id: string;
  name: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'circuit';
  content: string;
  createdAt: number;
}

export interface DraftFeedbackRecord {
  id: string;
  threadId: string;
  type: 'approved' | 'revision_requested' | 'rejected';
  userFeedback: string;
  sourcePrompt: string;
  proposalSummary: string;
  operations: any[];
  unansweredQuestions: string[];
  createdAt: number;
}

let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    console.log('Opening IndexedDB:', DB_NAME, 'Version:', DB_VERSION);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      console.log('IndexedDB upgrade needed');
      const db = event.target.result;
      if (!db.objectStoreNames.contains('threads')) {
        db.createObjectStore('threads', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('threadId', 'threadId', { unique: false });
      }
      if (!db.objectStoreNames.contains('draftFeedback')) {
        const feedbackStore = db.createObjectStore('draftFeedback', { keyPath: 'id' });
        feedbackStore.createIndex('threadId', 'threadId', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      console.log('IndexedDB opened successfully');
      db = event.target.result as IDBDatabase;
      
      db.onversionchange = () => {
        console.warn('Closing database connection due to upgrade request from another tab');
        db?.close();
        db = null;
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB open error', event.target.error);
      dbPromise = null;
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn('IndexedDB open blocked. Please close other tabs of this app.');
    };
  });

  return dbPromise;
};

const saveThread = async (thread: ChatThread): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['threads'], 'readwrite');
    const store = transaction.objectStore('threads');
    const request = store.put(thread);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
    request.onerror = () => reject(request.error);
  });
};

const getThreads = async (): Promise<ChatThread[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['threads'], 'readonly');
    const store = transaction.objectStore('threads');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

const saveMessage = async (message: ChatMessage): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    const request = store.put(message);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
    request.onerror = () => reject(request.error);
  });
};

const getMessages = async (threadId: string): Promise<ChatMessage[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('threadId');
    const request = index.getAll(IDBKeyRange.only(threadId));
    
    request.onsuccess = () => {
      const result = request.result || [];
      result.sort((a, b) => a.createdAt - b.createdAt);
      resolve(result);
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
};

const deleteMessages = async (threadId: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['messages'], 'readwrite');
    const messageStore = transaction.objectStore('messages');
    const index = messageStore.index('threadId');
    const request = index.openCursor(IDBKeyRange.only(threadId));

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
};

const deleteThread = async (threadId: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['threads', 'messages'], 'readwrite');
    
    const threadStore = transaction.objectStore('threads');
    threadStore.delete(threadId);

    const messageStore = transaction.objectStore('messages');
    const index = messageStore.index('threadId');
    const request = index.openCursor(IDBKeyRange.only(threadId));
    
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
};

const saveDraftFeedback = async (record: DraftFeedbackRecord): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['draftFeedback'], 'readwrite');
    const store = transaction.objectStore('draftFeedback');
    const request = store.put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
    request.onerror = () => reject(request.error);
  });
};

export const CircuitStorageService = {
  saveThread,
  getThreads,
  saveMessage,
  getMessages,
  deleteMessages,
  deleteThread,
  saveDraftFeedback
};
