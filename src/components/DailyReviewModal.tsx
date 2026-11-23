import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Moon, Sun, X } from 'lucide-react';
import { MemoryItem } from '../types/memory';
import { addDaysToDateKey, getLocalDateKey, toPersianDigits } from '../utils/dateFa';

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

  const todayPending = useMemo(() => {
    return items
      .filter((item) => {
        const forToday = item.repeatDaily || item.dateStr === todayKey;
        if (!forToday) return false;
        const done = item.repeatDaily ? item.completedDates.includes(todayKey) : item.completed;
        return !done;
      })
      .sort((a, b) => {
        const impA = a.priority === 'important' ? 0 : 1;
        const impB = b.priority === 'important' ? 0 : 1;
        if (impA !== impB) return impA - impB;
        return (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99');
      });
  }, [items, todayKey]);

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
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                موارد انجام‌نشده امروز که می‌توانید با یک ضربه به فردا منتقل کنید:
              </p>

              {movableUnfinished.length === 0 ? (
                <div className="rounded-[var(--radius-control)] bg-[var(--sem-done-soft)] p-5 text-center text-sm font-semibold text-[var(--sem-done)]">
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
                          className="w-full flex items-center justify-between gap-3 p-3.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-tonal)]/50 text-right cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {item.timeStr
                                ? `ساعت ${toPersianDigits(item.timeStr)} ← انتقال به فردا`
                                : `انتقال به برنامه فردا (${tomorrowKey})`}
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
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-sm font-bold disabled:opacity-45 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>
                      انتقال {toPersianDigits(selectedMoveIds.length)} مورد به فردا
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
