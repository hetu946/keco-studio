/**
 * 战斗技能配表 — IndexedDB 持久化（与资源库 Yjs IndexeddbPersistence 同类存储，重启后仍可读）
 */

import { BATTLE_SKILLS_STORAGE_KEY } from './battleSkillsPersistenceKeys';

const DB_NAME = 'keco-studio-simulation';
const DB_VERSION = 1;
const STORE_NAME = 'battleSimulationKv';

let dbPromise: Promise<IDBDatabase> | null = null;

function resetDbPromise(): void {
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      resetDbPromise();
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
  return dbPromise;
}

export async function idbReadBattleSkillsJson(): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(BATTLE_SKILLS_STORAGE_KEY);
    getReq.onerror = () => reject(getReq.error ?? new Error('IndexedDB get failed'));
    getReq.onsuccess = () => {
      const v = getReq.result;
      if (v === undefined || v === null) {
        resolve(null);
        return;
      }
      if (typeof v === 'string') {
        resolve(v);
        return;
      }
      resolve(null);
    };
  });
}

export async function idbWriteBattleSkillsJson(json: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(json, BATTLE_SKILLS_STORAGE_KEY);
    putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

export async function idbRemoveBattleSkills(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const delReq = store.delete(BATTLE_SKILLS_STORAGE_KEY);
    delReq.onerror = () => reject(delReq.error ?? new Error('IndexedDB delete failed'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}
