import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Edit3, Target, X } from 'lucide-react';
import { MemoryItem } from '../types/memory';
import { CATEGORY_META, toPersianDigits } from '../utils/dateFa';
import { PhotoThumbnail } from './PhotoThumbnail';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface FocusModeOverlayProps {
  isOpen: boolean;
  items: MemoryItem[];
  dateKey: string;
  onClose: () => void;
  onComplete: (id: string, dateKey: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onEdit: (item: MemoryItem) => void;
}

export const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({
  isOpen,
  items,
  dateKey,
  onClose,
  onComplete,
  onSnooze,
  onEdit,
}) => {
  const [cursor, setCursor] = useState(0);

  const pendingQueue = useMemo(() => {
    return items
      .filter((item) => {
        const matchesDate = item.repeatDaily || item.dateStr === dateKey;
        if (!matchesDate) return false;
        const done = item.repeatDaily ? item.completedDates.includes(dateKey) : item.completed;
        return !done;
      })
      .sort((a, b) => {
        const impA = a.priority === 'important' ? 0 : 1;
        const impB = b.priority === 'important' ? 0 : 1;
        if (impA !== impB) return impA - impB;
        return (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99');
      });
  }, [items, dateKey]);

  if (!isOpen) return null;

  const safeIndex = pendingQueue.length > 0 ? cursor % pendingQueue.length : 0;
  const current = pendingQueue[safeIndex];

  const handleSkipLater = () => {
    if (!current) return;
    if (current.timeStr) {
      onSnooze(current.id, 15);
    }
    if (pendingQueue.length > 1) {
      setCursor((c) => (c + 1) % pendingQueue.length);
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="حالت تمرکز"
      className="fixed inset-0 z-50 bg-[var(--bg-canvas)]/98 backdrop-blur-md flex flex-col justify-between p-5 sm:p-8"
    >
      {/* Top Bar */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
          <Target className="w-5 h-5" />
          <span>حالت تمرکز (یک کار در لحظه)</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>خروج</span>
        </button>
      </div>

      {/* Single Focused Card */}
      <div className="max-w-2xl w-full mx-auto my-auto">
        {!current ? (
          <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center space-y-4">
            <p className="text-xl font-extrabold text-[var(--text-primary)]">
              همه کارهای امروز انجام شده‌اند
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              کار باقی‌مانده‌ای برای امروز وجود ندارد. می‌توانید استراحت کنید یا کار جدیدی ثبت کنید.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-6 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-sm font-bold cursor-pointer"
            >
              بازگشت به برنامه امروز
            </button>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 sm:p-8 shadow-xl space-y-6 animate-task-enter">
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--accent)]">
                  {CATEGORY_META[current.category].shortLabel}
                </span>
                {current.timeStr && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                      ساعت {toPersianDigits(current.timeStr)}
                    </span>
                  </>
                )}
                {current.priority === 'important' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-[var(--sem-warning)]">مهم</span>
                  </>
                )}
              </div>

              <span className="tabular-nums font-medium">
                {toPersianDigits(safeIndex + 1)} از {toPersianDigits(pendingQueue.length)}
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] leading-snug">
                {current.title}
              </h2>

              {(current.notes || current.locationHint || current.dosage || current.phoneNumber) && (
                <p className="text-base text-[var(--text-secondary)] leading-relaxed">
                  {current.phoneNumber
                    ? `شماره تماس: ${toPersianDigits(current.phoneNumber)}`
                    : current.locationHint ||
                      (current.dosage ? `مقدار: ${current.dosage} · ` : '') +
                        (current.notes || '')}
                </p>
              )}

              {current.voiceNoteId && (
                <VoiceNotePlayer
                  voiceNoteId={current.voiceNoteId}
                  durationSec={current.voiceDurationSec}
                />
              )}

              {current.photoId && (
                <PhotoThumbnail
                  photoId={current.photoId}
                  photoText={current.photoText}
                  title={current.title}
                />
              )}
            </div>

            {/* Large Ergonomic Focus Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={() => onComplete(current.id, dateKey)}
                className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--sem-done)] text-white px-5 text-base font-bold hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>انجام شد</span>
              </button>

              <button
                type="button"
                onClick={handleSkipLater}
                className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-5 text-base font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
              >
                <Clock className="w-5 h-5 text-[var(--sem-warning)]" />
                <span>بعداً</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(current);
                }}
                className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-5 text-base font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
              >
                <Edit3 className="w-5 h-5" />
                <span>ویرایش</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stepper Footer */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={pendingQueue.length <= 1}
          onClick={() =>
            setCursor((c) => (c - 1 + pendingQueue.length) % Math.max(1, pendingQueue.length))
          }
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-35 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          <span>کار قبلی</span>
        </button>

        <button
          type="button"
          disabled={pendingQueue.length <= 1}
          onClick={() => setCursor((c) => (c + 1) % Math.max(1, pendingQueue.length))}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-35 cursor-pointer"
        >
          <span>کار بعدی</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
