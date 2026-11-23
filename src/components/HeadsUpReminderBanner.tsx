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
  const { item, isPreReminder, stageLabel } = alert;
  const cat = CATEGORY_META[item.category];

  const getMinutesUntilTonightOrTomorrow = () => {
    const now = new Date();
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() > now.getTime() + 10 * 60000) {
      return {
        label: 'امشب ۲۰:۰۰',
        minutes: Math.round((tonight.getTime() - now.getTime()) / 60000),
      };
    }
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(9, 0, 0, 0);
    return {
      label: 'فردا ۰۹:۰۰',
      minutes: Math.round((tomorrowMorning.getTime() - now.getTime()) / 60000),
    };
  };

  const smartLater = getMinutesUntilTonightOrTomorrow();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-4 sm:p-5 animate-task-enter"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[var(--sem-warning-soft)] text-[var(--sem-warning)] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="font-bold text-[var(--sem-warning)]">
                {stageLabel || (isPreReminder ? 'پیش‌یادآوری مرحله‌ای' : 'زمان یادآور')}
              </span>
              <span aria-hidden="true">·</span>
              <span>{cat.shortLabel}</span>
              {item.timeStr && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{toPersianDigits(item.timeStr)}</span>
                </>
              )}
              {item.priority === 'important' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-[var(--accent)]">مهم</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base font-bold text-[var(--text-primary)] leading-snug">
              {item.title}
            </h3>
            {(item.notes || item.locationHint || item.phoneNumber || item.nextStepTitle) && (
              <p className="mt-1 text-sm text-[var(--text-secondary)] truncate">
                {item.phoneNumber
                  ? `شماره: ${toPersianDigits(item.phoneNumber)}`
                  : item.nextStepTitle
                    ? `مرحله بعدی پس از انجام: ${item.nextStepTitle}`
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

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => onComplete(item.id)}
          className="w-full min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--sem-done)] px-4 py-2 text-sm font-bold text-white hover:opacity-95 cursor-pointer whitespace-nowrap"
        >
          <Check className="w-4 h-4" />
          <span>انجام شد</span>
        </button>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: '۵ دقیقه', mins: 5 },
            { label: '۱۵ دقیقه', mins: 15 },
            { label: '۱ ساعت', mins: 60 },
            { label: smartLater.label, mins: smartLater.minutes },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSnooze(item.id, opt.mins)}
              className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--bg-surface-tonal)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <Clock className="w-3 h-3 text-[var(--sem-warning)] shrink-0" />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
