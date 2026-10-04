import { DiagnosisRecord, QuestionnaireRecord, SyncQueueItem } from './types';

const DB_NAME = 'LeafLensDB';
const DB_VERSION = 1;

export class LeafLensStorage {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Diagnoses store
        if (!db.objectStoreNames.contains('diagnoses')) {
          const diagStore = db.createObjectStore('diagnoses', { keyPath: 'id' });
          diagStore.createIndex('timestamp', 'timestamp', { unique: false });
          diagStore.createIndex('crop', 'crop', { unique: false });
          diagStore.createIndex('needsExpertReview', 'needsExpertReview', { unique: false });
          diagStore.createIndex('synced', 'synced', { unique: false });
        }

        // Questionnaires store
        if (!db.objectStoreNames.contains('questionnaires')) {
          const qStore = db.createObjectStore('questionnaires', { keyPath: 'id' });
          qStore.createIndex('diagnosisId', 'diagnosisId', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('diagnosisId', 'diagnosisId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- DIAGNOSES ---
  async getAllDiagnoses(): Promise<DiagnosisRecord[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('diagnoses', 'readonly');
      const store = tx.objectStore('diagnoses');
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as DiagnosisRecord[]) || [];
        // Sort newest first
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getDiagnosis(id: string): Promise<DiagnosisRecord | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('diagnoses', 'readonly');
      const store = tx.objectStore('diagnoses');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveDiagnosis(diagnosis: DiagnosisRecord): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['diagnoses', 'syncQueue'], 'readwrite');
      const diagStore = tx.objectStore('diagnoses');
      const syncStore = tx.objectStore('syncQueue');

      diagStore.put(diagnosis);

      // Add to sync queue if not synced
      if (!diagnosis.synced) {
        const queueItem: SyncQueueItem = {
          id: 'sync_' + diagnosis.id,
          diagnosisId: diagnosis.id,
          status: 'pending',
          retries: 0,
          queuedAt: Date.now(),
        };
        syncStore.put(queueItem);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateDiagnosis(diagnosis: DiagnosisRecord): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('diagnoses', 'readwrite');
      const store = tx.objectStore('diagnoses');
      store.put(diagnosis);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteDiagnosis(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['diagnoses', 'syncQueue', 'questionnaires'], 'readwrite');
      tx.objectStore('diagnoses').delete(id);
      tx.objectStore('syncQueue').delete('sync_' + id);

      // Delete associated questionnaire if any
      const qStore = tx.objectStore('questionnaires');
      const qIndex = qStore.index('diagnosisId');
      const req = qIndex.getAllKeys(id);
      req.onsuccess = () => {
        req.result.forEach(k => qStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- QUESTIONNAIRES ---
  async saveQuestionnaire(record: QuestionnaireRecord): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questionnaires', 'readwrite');
      tx.objectStore('questionnaires').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQuestionnaire(diagnosisId: string): Promise<QuestionnaireRecord | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questionnaires', 'readonly');
      const index = tx.objectStore('questionnaires').index('diagnosisId');
      const req = index.get(diagnosisId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- SYNC QUEUE ---
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingSyncCount(): Promise<number> {
    const queue = await this.getSyncQueue();
    return queue.filter(item => item.status === 'pending' || item.status === 'failed').length;
  }

  async processSyncSimulation(onProgress?: (syncedCount: number, total: number) => void): Promise<number> {
    const db = await this.dbPromise;
    const items = await this.getSyncQueue();
    const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'failed');

    if (pendingItems.length === 0) return 0;

    let processed = 0;
    for (const item of pendingItems) {
      // Simulate network request latency per item
      await new Promise(r => setTimeout(r, 450));

      // Update sync queue item & diagnosis
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['diagnoses', 'syncQueue'], 'readwrite');
        const diagStore = tx.objectStore('diagnoses');
        const syncStore = tx.objectStore('syncQueue');

        const getDiag = diagStore.get(item.diagnosisId);
        getDiag.onsuccess = () => {
          if (getDiag.result) {
            const diag = getDiag.result as DiagnosisRecord;
            diag.synced = true;
            diagStore.put(diag);
          }
          item.status = 'synced';
          item.lastAttemptAt = Date.now();
          syncStore.put(item);
        };

        tx.oncomplete = () => {
          processed++;
          if (onProgress) onProgress(processed, pendingItems.length);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    }

    return processed;
  }

  // Seed sample initial data if database is empty
  async seedInitialDataIfEmpty(generateLeafDataUrl: (type: string) => string): Promise<void> {
    const existing = await this.getAllDiagnoses();
    if (existing.length > 0) return;

    const sample1: DiagnosisRecord = {
      id: 'diag_init_1',
      crop: 'tomato',
      primaryDiagnosis: 'tomato_early_blight',
      diseaseDisplayName: 'Tomato Early Blight',
      confidence: 0.91,
      combinedConfidence: 0.91,
      timestamp: Date.now() - 3600000 * 5, // 5 hours ago
      photoDataUrl: generateLeafDataUrl('tomato_early_blight'),
      notes: 'Noticed dark concentric rings on lower leaves after rain.',
      needsExpertReview: false,
      synced: true,
      questionnaireAnswers: {
        crop: 'tomato',
        cropAge: '1-2_months',
        leafSymptoms: 'brown_lesions',
        fieldSpread: 'moderate_10-50%',
      },
    };

    const sample2: DiagnosisRecord = {
      id: 'diag_init_2',
      crop: 'maize',
      primaryDiagnosis: 'maize_late_blight',
      diseaseDisplayName: 'Maize Late Blight',
      confidence: 0.71,
      combinedConfidence: 0.68,
      timestamp: Date.now() - 3600000 * 22, // 22 hours ago
      photoDataUrl: generateLeafDataUrl('maize_late_blight'),
      notes: 'Water-soaked lesions on upper foliage. Weather has been foggy.',
      needsExpertReview: true,
      synced: false,
      questionnaireAnswers: {
        crop: 'maize',
        cropAge: '>2_months',
        leafSymptoms: 'brown_lesions',
        fieldSpread: 'isolated_<10%',
      },
    };

    const sample3: DiagnosisRecord = {
      id: 'diag_init_3',
      crop: 'rice',
      primaryDiagnosis: 'rice_blast',
      diseaseDisplayName: 'Rice Blast',
      confidence: 0.69,
      combinedConfidence: 0.72,
      timestamp: Date.now() - 3600000 * 48, // 2 days ago
      photoDataUrl: generateLeafDataUrl('rice_blast'),
      notes: 'Spindle-shaped lesions with gray centers in lowland paddy.',
      needsExpertReview: false,
      synced: true,
      expertFeedback: {
        verifiedBy: 'Dr. Ramesh Patel (Senior Plant Pathologist, ICAR)',
        verifiedAt: Date.now() - 3600000 * 24,
        confirmedDiagnosis: 'rice_blast',
        advisoryNotes: 'Confirmed Rice Blast (Magnaporthe oryzae). Immediate application of Tricyclazole 75 WP @ 0.6g/L recommended before panicle emergence.',
        actionPlan: 'Drain field water temporarily for 48 hours to aerate the root zone, avoid excess nitrogenous top-dressing.',
      },
    };

    await this.saveDiagnosis(sample1);
    await this.saveDiagnosis(sample2);
    await this.saveDiagnosis(sample3);
  }
}

export const dbService = new LeafLensStorage();
