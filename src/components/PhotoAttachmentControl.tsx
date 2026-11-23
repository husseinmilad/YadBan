import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Mic,
  ScanText,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CATEGORY_META, toPersianDigits } from '../utils/dateFa';
import {
  AiImageAnalysisResult,
  analyzeImageWithAi,
  compressImageFile,
  deletePhotoBlob,
  getPhotoBlob,
  savePhotoBlob,
} from '../utils/mediaStorage';
import { dictatePersianText } from '../utils/nativeBridge';

interface PhotoAttachmentControlProps {
  photoId?: string;
  photoText?: string;
  enableOcrByDefault?: boolean;
  onChange: (nextPhotoId: string | undefined, nextPhotoText: string | undefined) => void;
  onAiExtracted?: (analysis: AiImageAnalysisResult) => void;
  onQuickSaveExtracted?: (analysis: AiImageAnalysisResult, nextPhotoId: string) => void;
}

export const PhotoAttachmentControl: React.FC<PhotoAttachmentControlProps> = ({
  photoId,
  photoText,
  enableOcrByDefault = true,
  onChange,
  onAiExtracted,
  onQuickSaveExtracted,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [aiEnabled, setAiEnabled] = useState(enableOcrByDefault);
  const [processing, setProcessing] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [dictatingOcr, setDictatingOcr] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [errorNote, setErrorNote] = useState('');
  const [aiResult, setAiResult] = useState<AiImageAnalysisResult | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const latestBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl = '';

    if (!photoId) {
      setPreviewUrl('');
      latestBlobRef.current = null;
      return;
    }

    void (async () => {
      const blob = await getPhotoBlob(photoId);
      if (!active || !blob) return;
      latestBlobRef.current = blob;
      objUrl = URL.createObjectURL(blob);
      setPreviewUrl(objUrl);
    })();

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [photoId]);

  const runAiExtraction = async (
    blob: Blob,
    targetPhotoId: string,
    existingText?: string
  ) => {
    setAnalyzingAi(true);
    setErrorNote('');
    setStatusNote('در حال خواندن تصویر و استخراج متن با هوش مصنوعی...');
    try {
      const analysis = await analyzeImageWithAi(blob);
      setAiResult(analysis);
      const nextText = analysis.extractedText?.trim() || existingText || '';
      onChange(targetPhotoId, nextText || undefined);
      onAiExtracted?.(analysis);

      if (analysis.extractedText?.trim() || analysis.title?.trim()) {
        setStatusNote(
          'متن و اطلاعات تصویر با هوش مصنوعی استخراج شد و در فیلدهای فرم قرار گرفت.'
        );
      } else {
        setStatusNote(
          'تصویر بررسی شد اما متن خوانایی در آن تشخیص داده نشد؛ می‌توانید متن را دستی وارد کنید.'
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'خطا در ارتباط با سرویس هوش مصنوعی برای خواندن تصویر.';
      setErrorNote(msg);
      setStatusNote('');
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setProcessing(true);
    setStatusNote('');
    setErrorNote('');
    setAiResult(null);

    try {
      const compressed = await compressImageFile(file);
      const nextId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await savePhotoBlob(nextId, compressed);
      latestBlobRef.current = compressed;

      if (photoId && photoId !== nextId) {
        void deletePhotoBlob(photoId);
      }

      onChange(nextId, photoText || undefined);
      setProcessing(false);

      if (aiEnabled) {
        await runAiExtraction(compressed, nextId, photoText);
      } else {
        setStatusNote('تصویر ذخیره شد. برای خواندن خودکار متن، دکمه هوش مصنوعی را بزنید.');
      }
    } catch {
      setErrorNote('خطا در آماده‌سازی تصویر انتخاب‌شده.');
      setProcessing(false);
    } finally {
      input.value = '';
    }
  };

  const handleRetryAiRead = async () => {
    if (!photoId || analyzingAi) return;
    const blob = latestBlobRef.current || (await getPhotoBlob(photoId));
    if (!blob) {
      setErrorNote('فایل تصویر در دسترس نیست؛ لطفاً تصویر را دوباره انتخاب کنید.');
      return;
    }
    await runAiExtraction(blob, photoId, photoText);
  };

  const handleRemovePhoto = () => {
    if (photoId) {
      void deletePhotoBlob(photoId);
    }
    latestBlobRef.current = null;
    setPreviewUrl('');
    setStatusNote('');
    setErrorNote('');
    setAiResult(null);
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
        setErrorNote(res.error);
      }
    } finally {
      setDictatingOcr(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/75 border border-[var(--border-subtle)] p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-primary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>خوانش متن و استخراج کار از تصویر (هوش مصنوعی)</span>
          </span>
          <p className="text-[11px] text-[var(--text-muted)]">
            عکس برگه، کارت، قبض، نسخه دارو یا محل وسیله را بدهید تا هوش مصنوعی متن را بخواند و کار بسازد.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAiEnabled((v) => !v)}
          className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
            aiEnabled
              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
          }`}
        >
          <ScanText className="w-3.5 h-3.5" />
          <span>خوانش هوش مصنوعی: {aiEnabled ? 'روشن' : 'خاموش'}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={processing || analyzingAi}
          onClick={() => cameraInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-4 h-4 text-[var(--accent)]" />
          <span>{processing ? 'در حال آماده‌سازی...' : 'گرفتن عکس با دوربین'}</span>
        </button>

        <button
          type="button"
          disabled={processing || analyzingAi}
          onClick={() => galleryInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <ImagePlus className="w-4 h-4 text-[var(--accent)]" />
          <span>انتخاب تصویر از گالری</span>
        </button>

        {photoId && (
          <button
            type="button"
            disabled={analyzingAi}
            onClick={handleRetryAiRead}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-3.5 text-xs font-bold hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {analyzingAi ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{analyzingAi ? 'در حال خواندن...' : 'خواندن متن با هوش مصنوعی'}</span>
          </button>
        )}

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

      {analyzingAi && (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--accent-soft)]/70 border border-[var(--accent)]/25 px-3 py-2 text-xs font-semibold text-[var(--accent-soft-text)]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>هوش مصنوعی در حال خواندن متن تصویر و تشخیص کار، تاریخ، شماره یا دارو است...</span>
        </div>
      )}

      {previewUrl && (
        <div className="flex items-start gap-3 pt-1">
          <img
            src={previewUrl}
            alt="پیش‌نمایش تصویر انتخاب‌شده"
            className="w-24 h-24 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                تصویر پیوست شد
              </span>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف تصویر</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                  متن استخراج‌شده از تصویر (قابل ویرایش و جست‌وجو)
                </label>
                <button
                  type="button"
                  onClick={handleDictatePhotoText}
                  disabled={dictatingOcr}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] cursor-pointer whitespace-nowrap"
                >
                  <Mic className="w-3 h-3" />
                  <span>{dictatingOcr ? 'گوش می‌دهم...' : 'خواندن با صدا'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={photoText || ''}
                onChange={(e) => onChange(photoId, e.target.value)}
                placeholder="متن خوانده‌شده از تصویر اینجا قرار می‌گیرد..."
                className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
        </div>
      )}

      {aiResult && photoId && (aiResult.title || aiResult.extractedText) && (
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--accent)]/35 p-3 space-y-2 animate-task-enter">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[var(--accent)]">
              خلاصه استخراج‌شده از تصویر:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAiExtracted?.(aiResult)}
                className="min-h-[32px] px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
              >
                بازاعمال در فرم
              </button>
              {onQuickSaveExtracted && (
                <button
                  type="button"
                  onClick={() => onQuickSaveExtracted(aiResult, photoId)}
                  className="min-h-[32px] inline-flex items-center gap-1 px-3 rounded-lg bg-[var(--sem-done)] text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ثبت فوری همین مورد</span>
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
            <strong>{aiResult.title || 'مورد استخراج‌شده'}</strong>
            <span aria-hidden="true"> · </span>
            <span>دسته: {CATEGORY_META[aiResult.category]?.shortLabel || 'کار'}</span>
            {aiResult.timeStr && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">ساعت {toPersianDigits(aiResult.timeStr)}</span>
              </>
            )}
            {aiResult.phoneNumber && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">شماره {toPersianDigits(aiResult.phoneNumber)}</span>
              </>
            )}
            {aiResult.dosage && (
              <>
                <span aria-hidden="true"> · </span>
                <span>مقدار: {aiResult.dosage}</span>
              </>
            )}
          </p>
        </div>
      )}

      {errorNote && (
        <p className="text-xs font-semibold text-[var(--sem-danger)] leading-relaxed">
          {errorNote}
        </p>
      )}

      {statusNote && !errorNote && !analyzingAi && (
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{statusNote}</p>
      )}
    </div>
  );
};
