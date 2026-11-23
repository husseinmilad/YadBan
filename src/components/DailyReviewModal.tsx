import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Lightbulb,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { MemoryItem } from '../types/memory';
import {
  addDaysToDateKey,
  CATEGORY_META,
  formatJalaliShortLabel,
  getLocalDateKey,
  toPersianDigits,
} from '../utils/dateFa';

interface DailyReviewModalProps {
  isOpen: boolean;
  initialMode?: 'morning' | 'evening';
  items: MemoryItem[];
  onClose: () => void;
  onToggleComplete: (id: string, dateKey: string) => void;
  onMoveTasksToTomorrow: (ids: string[]) => void;
}

export const DailyReviewModal: React.FC<DailyReviewModalProps> = ({
  isOpen,
  initialMode,
  items,
  onClose,
  onToggleComplete,
  onMoveTasksToTomorrow,
}) => {
  const defaultMode = initialMode || (new Date().getHours() >= 18 ? 'evening' : 'morning');
  const [mode, setMode] = useState<'morning' | 'evening'>(defaultMode);
  const [selectedMoveIds, setSelectedMoveIds] = useState<string[]>([]);

  const todayKey = getLocalDateKey(new Date());
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const todayAll = useMemo(() => {
    return items.filter((item) => item.repeatDaily || item.dateStr === todayKey);
  }, [items, todayKey]);

  const todayCompleted = useMemo(() => {
    return todayAll
      .filter((item) =>
        item.repeatDaily ? item.completedDates.includes(todayKey) : item.completed
      )
      .sort((a, b) => (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99'));
  }, [todayAll, todayKey]);

  const todayPending = useMemo(() => {
    return todayAll
      .filter((item) => {
        const done = item.repeatDaily ? item.completedDates.includes(todayKey) : item.completed;
        return !done;
      })
      .sort((a, b) => {
        const impA = a.priority === 'important' ? 0 : 1;
        const impB = b.priority === 'important' ? 0 : 1;
        if (impA !== impB) return impA - impB;
        return (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99');
      });
  }, [todayAll, todayKey]);

  const tomorrowItems = useMemo(() => {
    return items
      .filter((item) => item.repeatDaily || item.dateStr === tomorrowKey)
      .sort((a, b) => (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99'));
  }, [items, tomorrowKey]);

  const eveningAdvice = useMemo(() => {
    const advice: string[] = [];
    const total = todayAll.length;
    const doneCount = todayCompleted.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    if (total === 0) {
      advice.push('امروز کار ثبت‌شده‌ای نداشتید؛ می‌توانید الان برنامه‌های مهم فردا را وارد کنید تا با ذهن آرام بخوابید.');
    } else if (pct >= 80) {
      advice.push(
        `عملکرد عالی! امروز ${toPersianDigits(pct)}٪ از برنامه‌هایتان (${toPersianDigits(doneCount)} مورد) را به پایان رساندید.`
      );
    } else if (doneCount > 0) {
      advice.push(
        `امروز ${toPersianDigits(doneCount)} کار را تکمیل کردید؛ برای جلوگیری از خستگی ذهنی، موارد باقی‌مانده را به فردا منتقل کنید.`
      );
    } else {
      advice.push(
        'گاهی روزها پرمشغله می‌شوند؛ همین که امشب برنامه را مرور می‌کنید، قدم بزرگی برای نظم فرداست.'
      );
    }

    const pendingHealth = todayPending.find((i) => i.category === 'health');
    if (pendingHealth) {
      advice.push(`مورد سلامت «${pendingHealth.title}» هنوز تیک نخورده؛ پیش از استراحت آن را بررسی کنید.`);
    }

    const pendingImportant = todayPending.filter((i) => i.priority === 'important');
    if (pendingImportant.length > 0) {
      advice.push(
        `پیشنهاد برای فردا صبح: کار مهم «${pendingImportant[0].title}» را در اولویت اول روز قرار دهید.`
      );
    }

    if (tomorrowItems.length > 0) {
      const firstTomorrow = tomorrowItems[0];
      advice.push(
        `فردا ${toPersianDigits(tomorrowItems.length)} برنامه دارید${
          firstTomorrow.timeStr
            ? ` و اولین کار ساعت ${toPersianDigits(firstTomorrow.timeStr)} («${firstTomorrow.title}») است`
            : ` از جمله «${firstTomorrow.title}»`
        }؛ وسایل لازم را امشب آماده کنید.`
      );
    }

    return advice;
  }, [todayAll.length, todayCompleted.length, todayPending, tomorrowItems]);

  const morningTopItems = useMemo(() => todayPending.slice(0, 4), [todayPending]);
  const movableUnfinished = useMemo(
    () => todayPending.filter((item) => !item.repeatDaily),
    [todayPending]
  );

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode || (new Date().getHours() >= 18 ? 'evening' : 'morning'));
    setSelectedMoveIds(movableUnfinished.map((i) => i.id));
  }, [isOpen, initialMode, movableUnfinished]);

  if (!isOpen) return null;

  const toggleMoveId = (id: string) => {
    setSelectedMoveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="مرور کوتاه روزانه"
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
            مرور کوتاه روزانه
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

        <div className="p-5 space-y-4">
          {/* Morning / Evening Segmented Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]">
            <button
              type="button"
              onClick={() => setMode('morning')}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                mode === 'morning'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Sun className="w-4 h-4 text-[var(--sem-warning)]" />
              <span>مرور صبحگاهی</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('evening')}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                mode === 'evening'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Moon className="w-4 h-4 text-[var(--accent)]" />
              <span>جمع‌بندی شبانه</span>
            </button>
          </div>

          {mode === 'morning' ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                فقط چند مورد مهم امروز برای شروع آرام و بدون شلوغی ذهنی:
              </p>

              {morningTopItems.length === 0 ? (
                <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] p-5 text-center text-sm text-[var(--text-secondary)]">
                  کار باقی‌مانده‌ای برای امروز نیست؛ روز آرامی داشته باشید.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden">
                  {morningTopItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3.5 bg-[var(--bg-surface)]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {item.timeStr ? `ساعت ${toPersianDigits(item.timeStr)}` : 'بدون ساعت مشخص'}
                          {item.priority === 'important' ? ' · مهم' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleComplete(item.id, todayKey)}
                        className="min-h-[38px] px-3 rounded-xl bg-[var(--sem-done-soft)] text-[var(--sem-done)] text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>انجام شد</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. کارهای انجام‌شده امروز */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--sem-done)]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>کارهایی که امروز انجام دادید ({toPersianDigits(todayCompleted.length)} مورد)</span>
                  </h3>
                </div>

                {todayCompleted.length === 0 ? (
                  <p className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] p-3 text-xs text-[var(--text-muted)]">
                    هنوز موردی به‌عنوان انجام‌شده تیک نخورده است.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--sem-done-soft)]/30 overflow-hidden">
                    {todayCompleted.map((item) => (
                      <div key={item.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 font-bold text-[var(--text-primary)] min-w-0">
                          <Check className="w-3.5 h-3.5 text-[var(--sem-done)] shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap shrink-0">
                          {CATEGORY_META[item.category].shortLabel}
                          {item.timeStr ? ` · ${toPersianDigits(item.timeStr)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. توصیه‌های هوشمند شبانه */}
              <div className="rounded-[var(--radius-control)] bg-[var(--accent-soft)]/55 border border-[var(--accent)]/25 p-3.5 space-y-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--accent-soft-text)]">
                  <Lightbulb className="w-4 h-4 shrink-0" />
                  <span>توصیه‌های امشب برای شما</span>
                </p>
                <ul className="space-y-1.5 text-xs text-[var(--text-primary)] leading-relaxed list-disc pr-4">
                  {eveningAdvice.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>

              {/* 3. موارد انجام‌نشده برای انتقال به فردا */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--text-secondary)]">
                  موارد انجام‌نشده امروز برای انتقال به {formatJalaliShortLabel(tomorrowKey)}:
                </p>

                {movableUnfinished.length === 0 ? (
                  <div className="rounded-[var(--radius-control)] bg-[var(--sem-done-soft)] p-4 text-center text-xs font-semibold text-[var(--sem-done)]">
                    آفرین! تمام کارهای قابل انتقال امروز تکمیل شده‌اند.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden">
                      {movableUnfinished.map((item) => {
                        const checked = selectedMoveIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleMoveId(item.id)}
                            className="w-full flex items-center justify-between gap-3 p-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-tonal)]/50 text-right cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                {item.timeStr
                                  ? `ساعت ${toPersianDigits(item.timeStr)} ← انتقال به فردا`
                                  : `انتقال به برنامه ${formatJalaliShortLabel(tomorrowKey)}`}
                              </p>
                            </div>
                            <span
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                                checked
                                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-on)]'
                                  : 'border-[var(--border-subtle)]'
                              }`}
                            >
                              {checked && <Check className="w-4 h-4" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={selectedMoveIds.length === 0}
                      onClick={() => {
                        onMoveTasksToTomorrow(selectedMoveIds);
                        onClose();
                      }}
                      className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-sm font-bold disabled:opacity-45 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>
                        انتقال {toPersianDigits(selectedMoveIds.length)} مورد به فردا
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
