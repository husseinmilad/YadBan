const PHOTO_DB_NAME = 'yadban_offline_photos_v1';
const PHOTO_STORE_NAME = 'photo_notes';
const PHOTO_DB_VERSION = 1;

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

export async function compressImageFile(file: File, maxDim = 1200): Promise<Blob> {
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
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
    );
    return compressed || file;
  } catch {
    return file;
  }
}

/**
 * Attempts offline on-device text detection if browser/WebView supports Shape Detection TextDetector.
 * Gracefully returns empty string on unsupported WebViews so photo capture never fails or requires network.
 */
export async function tryOnDeviceTextDetection(source: Blob): Promise<string> {
  try {
    const win = window as unknown as {
      TextDetector?: new () => { detect: (img: ImageBitmap) => Promise<Array<{ rawValue?: string }>> };
    };
    if (!win.TextDetector || typeof createImageBitmap === 'undefined') {
      return '';
    }
    const detector = new win.TextDetector();
    const bitmap = await createImageBitmap(source);
    const blocks = await detector.detect(bitmap);
    bitmap.close();
    const lines = blocks
      .map((b) => (b.rawValue || '').trim())
      .filter(Boolean);
    return lines.join('\n');
  } catch {
    return '';
  }
}
