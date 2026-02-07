
const DB_NAME = 'CircuitDB';
const DB_VERSION = 1;

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

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('threads')) {
        db.createObjectStore('threads', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('threadId', 'threadId', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      console.log('IndexedDB opened successfully');
      db = event.target.result;
      resolve(db as IDBDatabase);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB open error', event.target.error);
      reject('IndexedDB error: ' + event.target.errorCode);
    };
  });
};

const saveThread = async (thread: ChatThread): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['threads'], 'readwrite');
    const store = transaction.objectStore('threads');
    const request = store.put(thread);
    request.onsuccess = () => {
      console.log('Thread saved successfully', thread);
      resolve();
    };
    request.onerror = () => {
      console.error('Thread save error', request.error);
      reject(request.error);
    };
  });
};

const getThreads = async (): Promise<ChatThread[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['threads'], 'readonly');
    const store = transaction.objectStore('threads');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

const saveMessage = async (message: ChatMessage): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    const request = store.put(message);
    request.onsuccess = () => {
      console.log('Message saved successfully', message);
      resolve();
    };
    request.onerror = () => {
      console.error('Message save error', request.error);
      reject(request.error);
    };
  });
};

const getMessages = async (threadId: string): Promise<ChatMessage[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('threadId');
    const request = index.getAll(IDBKeyRange.only(threadId));
    request.onsuccess = () => {
      const result = request.result || [];
      // Sort messages by createdAt
      result.sort((a, b) => a.createdAt - b.createdAt);
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteThread = async (threadId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['threads', 'messages'], 'readwrite');
    
    // Delete thread
    const threadStore = transaction.objectStore('threads');
    threadStore.delete(threadId);

    // Delete associated messages
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
  });
};

export const CircuitStorageService = {
  saveThread,
  getThreads,
  saveMessage,
  getMessages,
  deleteThread
};
