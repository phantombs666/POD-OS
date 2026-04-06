import { openDB, IDBPDatabase } from 'idb';
import { Design } from '../types';

const DB_NAME = 'POD_OS_DB';
const STORE_NAME = 'designs';
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const dbService = {
  async saveDesign(design: Design) {
    const db = await getDB();
    return db.put(STORE_NAME, design);
  },

  async getAllDesigns(): Promise<Design[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async deleteDesign(id: string) {
    const db = await getDB();
    return db.delete(STORE_NAME, id);
  },

  async clearAll() {
    const db = await getDB();
    return db.clear(STORE_NAME);
  }
};
