import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pin, Repeat, X } from 'lucide-react';
import { MemoryCategory, MemoryItem, TimeBlock } from '../types/memory';
import {
  addDaysToDateKey,
  CATEGORY_META,
  getLocalDateKey,
  getTimeBlockFromTime,
  parseQuickCapture,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/dateFa';
import { CategoryIcon } from './CategoryIcon';
import { VoiceRecorderControl } from './VoiceRecorderControl';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<MemoryItem, 'id' | 'createdAt'>, existingId?: string) => void;
  initialItem?: MemoryItem | null;
  defaultDateKey: string;
  initialRawText?: string;
}

const CATEGORIES: MemoryCategory[] = [
  'work',
  'fitness',
  'health',
  'phone',
  'errand',
  'anchor',
  'idea',
];

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  defaultDateKey,
  initialRawText = '',
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('work');
  const [dateStr, setDateStr] = useState(defaultDateKey);
  const [timeStr, setTimeStr] = useState('');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [preReminderMinutes, setPreReminderMinutes] = useState<0 | 5 | 10 | 15>(10);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [pinnedToWidget, setPinnedToWidget] = useState(false);
  const [voiceNoteId, setVoiceNoteId] = useState<string | undefined>(undefined);
  const [voiceDurationSec, setVoiceDurationSec] = useState<number | undefined>(undefined);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialItem) {
      setTitle(initialItem.title);
      setNotes(initialItem.notes || '');
      setCategory(initialItem.category);
      setDateStr(initialItem.dateStr);
      setTimeStr(initialItem.timeStr);
      setRepeatDaily(initialItem.repeatDaily);
      setPreReminderMinutes(initialItem.preReminderMinutes);
      setPhoneNumber(initialItem.phoneNumber || '');
      setContactName(initialItem.contactName || '');
      setLocationHint(initialItem.locationHint || '');
      setPinnedToWidget(initialItem.pinnedToWidget);
      setVoiceNoteId(initialItem.voiceNoteId);
      setVoiceDurationSec(initialItem.voiceDurationSec);
      setUserTouchedCategory(true);
    } else {
      setTitle(initialRawText);
      setNotes('');
      setCategory('work');
      setDateStr(defaultDateKey);
      setTimeStr('');
      setRepeatDaily(false);
      setPreReminderMinutes(10);
      setPhoneNumber('');
      setContactName('');
      setLocationHint('');
      setPinnedToWidget(false);
      setVoiceNoteId(undefined);
      setVoiceDurationSec(undefined);
      setUserTouchedCategory(false);
    }
  }, [isOpen, initialItem, defaultDateKey, initialRawText]);

  const parsedPreview = useMemo(() => {
    if (!title.trim() || initialItem) return null;
    return parseQuickCapture(title, defaultDateKey);
  }, [title, defaultDateKey, initialItem]);

  useEffect(() => {
    if (!parsedPreview || userTouchedCategory || initialItem) return;
    setCategory(parsedPreview.category);
    if (parsedPreview.phoneNumber && !phoneNumber) {
      setPhoneNumber(parsedPreview.phoneNumber);
    }
    if (parsedPreview.contactName && !contactName) {
      setContactName(parsedPreview.contactName);
    }
    if (parsedPreview.timeStr && !timeStr) {
      setTimeStr(parsedPreview.timeStr);
    }
    if (parsedPreview.dateStr !== dateStr && parsedPreview.detectedHints.includes('برای فردا')) {
      setDateStr(parsedPreview.dateStr);
    }
    if (parsedPreview.pinnedToWidget) {
      setPinnedToWidget(true);
    }
  }, [parsedPreview, userTouchedCategory, initialItem]);

  if (!isOpen) return null;

  const applyQuickTimeOffset = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60000);
    setDateStr(getLocalDateKey(target));
    setTimeStr(
      `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`
    );
  };

  const applyPresetSlot = (tomorrow: boolean, time: string) => {
    const base = getLocalDateKey(new Date());
    setDateStr(tomorrow ? addDaysToDateKey(base, 1) : base);
    setTimeStr(time);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle && !phoneNumber.trim() && !voiceNoteId) return;

    const finalTitle =
      trimmedTitle ||
      (phoneNumber.trim()
        ? `تماس با ${contactName.trim() || toPersianDigits(phoneNumber.trim())}`
        : 'یادداشت صوتی آفلاین');
    const cleanPhone = toEnglishDigits(phoneNumber).replace(/[^\d+]/g, '');
    const timeBlock: TimeBlock = timeStr ? getTimeBlockFromTime(timeStr) : 'anytime';

    onSave(
      {
        title: finalTitle,
        notes: notes.trim() || undefined,
        category,
        dateStr: category === 'anchor' && !timeStr ? '' : dateStr,
        timeStr,
        timeBlock,
        repeatDaily,
        completed: initialItem?.completed ?? false,
        completedDates: initialItem?.completedDates ?? [],
        preReminderMinutes,
        phoneNumber: cleanPhone || undefined,
        contactName: contactName.trim() || undefined,
        locationHint: locationHint.trim() || undefined,
        pinnedToWidget,
        voiceNoteId,
        voiceDurationSec,
      },
      initialItem?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl"
      >
        {/* Drag affordance on mobile */}
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--border-subtle)] mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 id="quick-capture-title" className="text-lg font-bold text-[var(--text-primary)]">
            {initialItem ? 'ویرایش یادآور و یادداشت' : 'ثبت سریع هرچه در ذهن دارید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Primary input */}
          <div>
            <label htmlFor="memory-title-input" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              متن، شماره تلفن یا کار لحظه‌ای
            </label>
            <input
              id="memory-title-input"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: شماره ۰۹۱۲۳۴۵۶۷۸۹ مهندس کریمی یا ۱۵ دقیقه دیگه قرص"
              className="w-full min-h-[48px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            {parsedPreview && parsedPreview.detectedHints.length > 0 && (
              <p className="mt-2 text-xs text-[var(--accent)] font-medium">
                تشخیص هوشمند: {parsedPreview.detectedHints.join(' · ')}
              </p>
            )}
          </div>

          {/* Category segmented selector */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              دسته‌بندی
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setUserTouchedCategory(true);
                    }}
                    className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                    }`}
                  >
                    <CategoryIcon category={cat} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{CATEGORY_META[cat].shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Phone or Anchor fields */}
          {category === 'phone' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  شماره تلفن
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0912..."
                  className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 text-sm font-mono-tabular text-left text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  نام شخص یا مرکز
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="مثلاً: تعمیرکار پکیج"
                  className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>
          )}

          {category === 'anchor' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                نشانی دقیق یا محل قرارگیری شیء
              </label>
              <input
                type="text"
                value={locationHint}
                onChange={(e) => setLocationHint(e.target.value)}
                placeholder="مثلاً: پارکینگ منفی ۱، روبه‌روی آسانسور یا کشوی سمت چپ میز"
                className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          )}

          {/* Fast time presets + Date & Time pickers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                زمان‌بندی و یادآور
              </span>
              {timeStr && (
                <button
                  type="button"
                  onClick={() => setTimeStr('')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  حذف ساعت
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyQuickTimeOffset(15)}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-medium text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
              >
                ۱۵ دقیقه دیگه
              </button>
              <button
                type="button"
                onClick={() => applyQuickTimeOffset(60)}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-medium text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
              >
                ۱ ساعت دیگه
              </button>
              <button
                type="button"
                onClick={() => applyPresetSlot(false, '18:00')}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-medium text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
              >
                امروز عصر ۱۸:۰۰
              </button>
              <button
                type="button"
                onClick={() => applyPresetSlot(true, '09:00')}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-medium text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
              >
                فردا صبح ۰۹:۰۰
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">تاریخ</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3 text-sm font-mono-tabular text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">ساعت دقیق</label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3 text-sm font-mono-tabular text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Repeat & Pin options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRepeatDaily((v) => !v)}
              className={`min-h-[44px] flex items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-semibold cursor-pointer ${
                repeatDaily
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span>تکرار روزانه</span>
            </button>

            <button
              type="button"
              onClick={() => setPinnedToWidget((v) => !v)}
              className={`min-h-[44px] flex items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-semibold cursor-pointer ${
                pinnedToWidget
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Pin className="w-4 h-4" />
              <span>سنجاق به ویجت</span>
            </button>
          </div>

          {timeStr && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                پیش‌هشدار هوشمند قبل از موعد:
              </span>
              <div className="flex items-center gap-1.5">
                {([0, 5, 10, 15] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPreReminderMinutes(mins)}
                    className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                      preReminderMinutes === mins
                        ? 'bg-[var(--accent)] text-[var(--accent-on)]'
                        : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {mins === 0 ? 'خاموش' : `${toPersianDigits(mins)} د`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Offline Voice Memo Attachment */}
          <VoiceRecorderControl
            voiceNoteId={voiceNoteId}
            voiceDurationSec={voiceDurationSec}
            onChange={(id, dur) => {
              setVoiceNoteId(id);
              setVoiceDurationSec(dur);
            }}
          />

          {/* Optional extra details */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              توضیح تکمیلی (اختیاری)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نکته‌ای که دوست ندارید فراموش شود..."
              className="w-full rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialItem ? 'ذخیره تغییرات' : 'ثبت در حافظه یادبان'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] text-sm font-semibold text-[var(--text-secondary)] hover:opacity-90 cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
