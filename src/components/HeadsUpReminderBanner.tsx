import React from 'react';
import { BellRing, Check, Clock, X } from 'lucide-react';
import { ActiveReminderAlert } from '../types/memory';
import { CATEGORY_META, toPersianDigits } from '../utils/dateFa';

interface HeadsUpReminderBannerProps {
  alert: ActiveReminderAlert | null;
  onComplete: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onDismiss: () => void;
}

export const HeadsUpReminderBanner: React.FC<HeadsUpReminderBannerProps> = ({
  alert,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  if (!alert) return null;
  const { item, isPreReminder } = alert;
  const cat = CATEGORY_META[item.category];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-4 sm:p-5 transition-transform duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--accent)]">
                {isPreReminder ? 'پیش‌یادآوری هوشمند' : 'زمان یادآور'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{cat.shortLabel}</span>
              {item.timeStr && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{toPersianDigits(item.timeStr)}</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base font-bold text-[var(--text-primary)] leading-snug">
              {item.title}
            </h3>
            {(item.notes || item.locationHint || item.phoneNumber) && (
              <p className="mt-1 text-sm text-[var(--text-secondary)] truncate">
                {item.phoneNumber
                  ? `شماره: ${toPersianDigits(item.phoneNumber)}`
                  : item.locationHint || item.notes}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer shrink-0"
          aria-label="بستن اعلان"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onComplete(item.id)}
          className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)] hover:opacity-95 cursor-pointer whitespace-nowrap"
        >
          <Check className="w-4 h-4" />
          <span>انجام شد</span>
        </button>

        <button
          type="button"
          onClick={() => onSnooze(item.id, 10)}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90 cursor-pointer whitespace-nowrap"
        >
          <Clock className="w-4 h-4" />
          <span>۱۰ دقیقه بعد</span>
        </button>
      </div>
    </div>
  );
};
