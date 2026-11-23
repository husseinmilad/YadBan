import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, ScanText, Trash2 } from 'lucide-react';
import {
  compressImageFile,
  deletePhotoBlob,
  getPhotoBlob,
  savePhotoBlob,
  tryOnDeviceTextDetection,
} from '../utils/mediaStorage';
import { dictatePersianText } from '../utils/nativeBridge';

interface PhotoAttachmentControlProps {
  photoId?: string;
  photoText?: string;
  enableOcrByDefault?: boolean;
  onChange: (nextPhotoId: string | undefined, nextPhotoText: string | undefined) => void;
}

export const PhotoAttachmentControl: React.FC<PhotoAttachmentControlProps> = ({
  photoId,
  photoText,
  enableOcrByDefault = true,
  onChange,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [ocrEnabled, setOcrEnabled] = useState(enableOcrByDefault);
  const [processing, setProcessing] = useState(false);
  const [dictatingOcr, setDictatingOcr] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl = '';

    if (!photoId) {
      setPreviewUrl('');
      return;
    }

    void (async () => {
      const blob = await getPhotoBlob(photoId);
      if (!active || !blob) return;
      objUrl = URL.createObjectURL(blob);
      setPreviewUrl(objUrl);
    })();

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [photoId]);

  const handleSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setProcessing(true);
    setStatusNote('');
    try {
      const compressed = await compressImageFile(file);
      const nextId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await savePhotoBlob(nextId, compressed);

      if (photoId && photoId !== nextId) {
        void deletePhotoBlob(photoId);
      }

      let extracted = photoText || '';
      if (ocrEnabled) {
        const autoText = await tryOnDeviceTextDetection(compressed);
        if (autoText) {
          extracted = extracted ? `${extracted}\n${autoText}` : autoText;
          setStatusNote('متن داخل تصویر استخراج شد و قابل جستجو است.');
        } else {
          setStatusNote(
            'عکس در حافظه آفلاین ذخیره شد؛ برای جستجوی سریع‌تر می‌توانید متن مهم برگه یا کارت را پایین بنویسید یا با صدا وارد کنید.'
          );
        }
      }

      onChange(nextId, extracted || undefined);
    } catch {
      setStatusNote('خطا در ذخیره‌سازی عکس در حافظه آفلاین.');
    } finally {
      setProcessing(false);
      input.value = '';
    }
  };

  const handleRemovePhoto = () => {
    if (photoId) {
      void deletePhotoBlob(photoId);
    }
    setPreviewUrl('');
    setStatusNote('');
    onChange(undefined, undefined);
  };

  const handleDictatePhotoText = async () => {
    if (dictatingOcr) return;
    setDictatingOcr(true);
    try {
      const res = await dictatePersianText();
      if (res.ok && res.text) {
        const merged = photoText?.trim()
          ? `${photoText.trim()} ${res.text}`
          : res.text;
        onChange(photoId, merged);
      } else if (res.error) {
        setStatusNote(res.error);
      }
    } finally {
      setDictatingOcr(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/75 border border-[var(--border-subtle)] p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          ثبت عکس از برگه، کارت یا محل وسیله (آفلاین)
        </span>

        <button
          type="button"
          onClick={() => setOcrEnabled((v) => !v)}
          className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border cursor-pointer transition-colors ${
            ocrEnabled
              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
          }`}
        >
          <ScanText className="w-3.5 h-3.5" />
          <span>تشخیص متن: {ocrEnabled ? 'روشن' : 'خاموش'}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={processing}
          onClick={() => cameraInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-60 cursor-pointer"
        >
          <Camera className="w-4 h-4 text-[var(--accent)]" />
          <span>{processing ? 'در حال ذخیره...' : 'گرفتن عکس با دوربین'}</span>
        </button>

        <button
          type="button"
          disabled={processing}
          onClick={() => galleryInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-60 cursor-pointer"
        >
          <ImagePlus className="w-4 h-4 text-[var(--accent)]" />
          <span>انتخاب از گالری</span>
        </button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleSelectedFile}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectedFile}
          className="hidden"
        />
      </div>

      {previewUrl && (
        <div className="flex items-start gap-3 pt-1">
          <img
            src={previewUrl}
            alt="پیش‌نمایش عکس پیوست‌شده"
            className="w-24 h-24 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                عکس در حافظه آفلاین گوشی پیوست شد
              </span>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف عکس</span>
              </button>
            </div>

            {ocrEnabled && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                    متن قابل جستجوی تصویر (نسخه، کارت، شماره یا توضیح)
                  </label>
                  <button
                    type="button"
                    onClick={handleDictatePhotoText}
                    disabled={dictatingOcr}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] cursor-pointer"
                  >
                    <Mic className="w-3 h-3" />
                    <span>{dictatingOcr ? 'گوش می‌دهم...' : 'خواندن با صدا'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={photoText || ''}
                  onChange={(e) => onChange(photoId, e.target.value)}
                  placeholder="متن داخل برگه یا کارت را برای پیدا کردن سریع در جستجو وارد کنید..."
                  className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {statusNote && (
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{statusNote}</p>
      )}
    </div>
  );
};
