import { AiImageProvider, MemoryCategory } from '../types/memory';

const PHOTO_DB_NAME = 'yadban_offline_photos_v1';
const PHOTO_STORE_NAME = 'photo_notes';
const PHOTO_DB_VERSION = 1;

export interface AiImageAnalysisResult {
  extractedText: string;
  title: string;
  category: MemoryCategory;
  timeStr: string;
  dateHint: string;
  phoneNumber: string;
  contactName: string;
  locationHint: string;
  dosage: string;
  notes: string;
  providerUsed?: 'chatgpt' | 'deepseek';
}

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        db.createObjectStore(PHOTO_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open photo DB'));
  });
}

export async function savePhotoBlob(id: string, blob: Blob): Promise<void> {
  const db = await openPhotoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
    tx.objectStore(PHOTO_STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save photo'));
  });
  db.close();
}

export async function getPhotoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openPhotoDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readonly');
      const req = tx.objectStore(PHOTO_STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deletePhotoBlob(id: string): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTO_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore cleanup failures
  }
}

export async function compressImageFile(file: File, maxDim = 1400): Promise<Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86)
    );
    return compressed || file;
  } catch {
    return file;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('خطا در آماده‌سازی تصویر'));
    reader.readAsDataURL(blob);
  });
}

function getAiEndpointUrl(apiPath: string): string {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configuredBase) {
    return `${configuredBase}${apiPath}`;
  }
  return apiPath;
}

export async function analyzeImageWithAi(
  source: Blob,
  provider: AiImageProvider = 'auto'
): Promise<AiImageAnalysisResult> {
  const imageBase64 = await blobToBase64(source);
  const endpoint = getAiEndpointUrl('/api/ai/read-image');

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: source.type || 'image/jpeg',
        provider,
      }),
    });
  } catch {
    throw new Error(
      'ارتباط با سرور هوش مصنوعی برقرار نشد. برای خواندن متن از روی تصویر، اتصال اینترنت یا سرور فعال لازم است.'
    );
  }

  let data: Partial<AiImageAnalysisResult> & { error?: string } = {};
  try {
    data = (await res.json()) as Partial<AiImageAnalysisResult> & { error?: string };
  } catch {
    // fallback message below
  }

  if (!res.ok) {
    throw new Error(
      data.error || 'خطا در تحلیل تصویر توسط هوش مصنوعی. لطفاً دوباره امتحان کنید.'
    );
  }

  return {
    extractedText: data.extractedText || '',
    title: data.title || '',
    category: data.category || 'work',
    timeStr: data.timeStr || '',
    dateHint: data.dateHint || '',
    phoneNumber: data.phoneNumber || '',
    contactName: data.contactName || '',
    locationHint: data.locationHint || '',
    dosage: data.dosage || '',
    notes: data.notes || '',
    providerUsed: data.providerUsed,
  };
}
