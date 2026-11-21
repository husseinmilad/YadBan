import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock,
  Edit3,
  Phone,
  Pin,
  Plus,
  Repeat,
  Send,
  Trash2,
} from 'lucide-react';
import { getIranDateDetails } from '../data/iranCalendarEvents';
import { MemoryCategory, MemoryItem, TimeBlock, UserSettings } from '../types/memory';
import {
  CATEGORY_META,
  get7DayWindow,
  getJalaliDayParts,
  getJalaliFullDate,
  getLocalDateKey,
  parseQuickCapture,
  TIME_BLOCK_LABELS,
  toPersianDigits,
} from '../utils/dateFa';
import { CategoryIcon } from './CategoryIcon';
import { MonthlyCalendarWidget } from './MonthlyCalendarWidget';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface TodayPlannerViewProps {
  items: MemoryItem[];
  settings: UserSettings;
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  onToggleComplete: (id: string, dateKey: string) => void;
  onQuickAdd: (rawText: string) => void;
  onOpenModalForNew: (prefillText?: string) => void;
  onEditItem: (item: MemoryItem) => void;
  onDeleteItem: (id: string) => void;
  onSnoozeItem: (id: string, mins: number) => void;
}

export const TodayPlannerView: React.FC<TodayPlannerViewProps> = ({
  items,
  settings,
  selectedDateKey,
  onSelectDateKey,
  onToggleComplete,
  onQuickAdd,
  onOpenModalForNew,
  onEditItem,
  onDeleteItem,
  onSnoozeItem,
}) => {
  const [quickText, setQuickText] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeBlock | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
  const [emblemError, setEmblemError] = useState(false);

  const weekDays = useMemo(() => get7DayWindow(selectedDateKey), [selectedDateKey]);

  const dateItems = useMemo(() => {
    return items
      .filter((item) => {
        if (item.repeatDaily) return true;
        return item.dateStr === selectedDateKey;
      })
      .sort((a, b) => {
        const aDone = a.repeatDaily ? a.completedDates.includes(selectedDateKey) : a.completed;
        const bDone = b.repeatDaily ? b.completedDates.includes(selectedDateKey) : b.completed;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99');
      });
  }, [items, selectedDateKey]);

  const filteredItems = useMemo(() => {
    return dateItems.filter((item) => {
      if (timeFilter !== 'all' && item.timeBlock !== timeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [dateItems, timeFilter, categoryFilter]);

  const completedCount = dateItems.filter((item) =>
    item.repeatDaily ? item.completedDates.includes(selectedDateKey) : item.completed
  ).length;
  const totalCount = dateItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const parsedHint = useMemo(() => {
    if (!quickText.trim()) return null;
    return parseQuickCapture(quickText, selectedDateKey);
  }, [quickText, selectedDateKey]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    onQuickAdd(quickText.trim());
    setQuickText('');
  };

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Hero Summary */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center">
              {!emblemError ? (
                <img
                  src="/src/assets/images/memory_companion_emblem_1795292130281.jpg"
                  alt="نشان دستیار حافظه یادبان"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <CalendarClock className="w-7 h-7 text-[var(--accent)]" />
              )}
            </div>

            <div>
              {(() => {
                const todayDetails = getIranDateDetails(getLocalDateKey(new Date()));
                return (
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    <span>{getJalaliFullDate(new Date())}</span>
                    {todayDetails.hijriLabel && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{todayDetails.hijriLabel}</span>
                      </>
                    )}
                    {todayDetails.events.length > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className={todayDetails.isOfficialHoliday ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-[var(--accent)] font-semibold'}>
                          {todayDetails.events.map((e) => e.title).join('، ')}
                          {todayDetails.isOfficialHoliday ? ' (تعطیل رسمی)' : ''}
                        </span>
                      </>
                    )}
                  </p>
                );
              })()}
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {settings.userName
                  ? `سلام ${settings.userName}، برنامه امروزت آماده است`
                  : 'برنامه و یادآورهای امروز'}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)] tabular-nums">
                {toPersianDigits(completedCount)} از {toPersianDigits(totalCount)} کار انجام شده
                {totalCount > 0 && ` · ${toPersianDigits(totalCount - completedCount)} مورد باقی‌مانده`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4">
            <div className="relative w-18 h-18 flex items-center justify-center shrink-0">
              <svg className="w-18 h-18 -rotate-90" viewBox="0 0 72 72">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke="var(--bg-surface-tonal)"
                  strokeWidth="7"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute text-sm font-extrabold tabular-nums text-[var(--text-primary)]">
                {toPersianDigits(pct)}٪
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenModalForNew()}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>برنامه جدید</span>
            </button>
          </div>
        </div>

        {/* Instant Brain Dump Bar */}
        <form onSubmit={handleQuickSubmit} className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder="هر چه به ذهنتان رسید همین الان بنویسید (شماره تلفن، دارو، ورزش، محل کلید...)"
                className="w-full min-h-[48px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!quickText.trim()}
                className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-4 text-sm font-bold hover:opacity-90 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>ثبت فوری</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenModalForNew(quickText)}
                className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer whitespace-nowrap"
                title="تنظیم زمان دقیق و جزئیات بیشتر"
              >
                <CalendarClock className="w-4 h-4 text-[var(--accent)]" />
                <span className="hidden sm:inline">زمان دقیق</span>
              </button>
            </div>
          </div>

          {parsedHint && parsedHint.detectedHints.length > 0 && (
            <p className="mt-2 text-xs text-[var(--accent)] font-medium">
              تشخیص خودکار: {parsedHint.detectedHints.join(' · ')}
            </p>
          )}
        </form>
      </section>

      {/* Horizontal 7-Day Jalali Scroller */}
      <section aria-label="انتخاب روز">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {weekDays.map((dayKey) => {
            const parts = getJalaliDayParts(dayKey);
            const dayDetails = getIranDateDetails(dayKey);
            const active = dayKey === selectedDateKey;
            const countForDay = items.filter(
              (i) =>
                (i.repeatDaily || i.dateStr === dayKey) &&
                !(i.repeatDaily ? i.completedDates.includes(dayKey) : i.completed)
            ).length;

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => onSelectDateKey(dayKey)}
                className={`min-w-[84px] flex-1 min-h-[72px] rounded-[var(--radius-control)] border px-3 py-2.5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                    : dayDetails.isOfficialHoliday
                      ? 'bg-rose-500/8 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/15'
                      : dayDetails.isFriday
                        ? 'bg-[var(--bg-surface)] text-rose-600 dark:text-rose-400 border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                }`}
              >
                <span className={`text-[11px] font-medium ${active ? 'opacity-90' : dayDetails.isOfficialHoliday || dayDetails.isFriday ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--text-muted)]'}`}>
                  {parts.isToday ? 'امروز' : parts.weekdayLong}
                </span>
                <span className="text-base font-extrabold tabular-nums">
                  {parts.dayNum} {parts.monthName}
                </span>
                {countForDay > 0 && (
                  <span
                    className={`text-[11px] tabular-nums ${
                      active ? 'opacity-90' : 'text-[var(--accent)]'
                    }`}
                  >
                    {toPersianDigits(countForDay)} کار
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Monthly Calendar Widget */}
      <MonthlyCalendarWidget
        items={items}
        selectedDateKey={selectedDateKey}
        onSelectDateKey={onSelectDateKey}
      />

      {/* Filter Controls */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] overflow-x-auto no-scrollbar">
          {(['all', 'morning', 'noon', 'evening', 'night'] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTimeFilter(slot)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeFilter === slot
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {slot === 'all' ? 'همه زمان‌ها' : TIME_BLOCK_LABELS[slot]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['all', 'work', 'fitness', 'health', 'phone', 'errand'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              {cat === 'all' ? 'همه دسته‌ها' : CATEGORY_META[cat].shortLabel}
            </button>
          ))}
        </div>
      </section>

      {/* Daily Agenda List */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)]/35">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            {(() => {
              const selParts = getJalaliDayParts(selectedDateKey);
              const selDetails = getIranDateDetails(selectedDateKey);
              return (
                <>
                  <span>
                    {selParts.isToday
                      ? 'برنامه‌های امروز'
                      : `برنامه‌های ${selParts.weekdayLong} ${selParts.dayNum} ${selParts.monthName}`}
                  </span>
                  {selDetails.events.length > 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        selDetails.isOfficialHoliday
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-[var(--accent)]'
                      }`}
                    >
                      · {selDetails.events.map((e) => e.title).join('، ')}
                      {selDetails.isOfficialHoliday ? ' (تعطیل رسمی)' : ''}
                    </span>
                  )}
                </>
              );
            })()}
            <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
              ({toPersianDigits(filteredItems.length)} مورد)
            </span>
          </div>

          {selectedDateKey !== getLocalDateKey(new Date()) && (
            <button
              type="button"
              onClick={() => onSelectDateKey(getLocalDateKey(new Date()))}
              className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
            >
              بازگشت به امروز
            </button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <p className="text-base font-bold text-[var(--text-primary)]">
              برای این بازه برنامه‌ای ثبت نشده است
            </p>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              می‌توانید کارهای کاری، ورزشی، مصرف دارو یا هر یادداشت لحظه‌ای را با یادآور زمان‌بندی‌شده اضافه کنید.
            </p>
            <button
              type="button"
              onClick={() => onOpenModalForNew()}
              className="mt-2 min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-on)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن اولین برنامه</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredItems.map((item) => {
              const isDone = item.repeatDaily
                ? item.completedDates.includes(selectedDateKey)
                : item.completed;
              const cat = CATEGORY_META[item.category];

              return (
                <div
                  key={item.id}
                  className={`flex items-start sm:items-center justify-between gap-3 p-4 sm:px-6 transition-colors ${
                    isDone ? 'opacity-65 bg-[var(--bg-surface-tonal)]/40' : 'hover:bg-[var(--bg-surface-tonal)]/35'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleComplete(item.id, selectedDateKey)}
                      aria-label={isDone ? `لغو انجام ${item.title}` : `انجام شد: ${item.title}`}
                      className={`min-w-[44px] min-h-[44px] rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                        isDone
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-on)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <CategoryIcon category={item.category} className="w-5 h-5 text-[var(--text-secondary)]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className={`font-semibold ${cat.colorClass}`}>{cat.shortLabel}</span>
                        {item.timeStr && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                              {toPersianDigits(item.timeStr)}
                            </span>
                          </>
                        )}
                        {item.repeatDaily && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              روزانه
                            </span>
                          </>
                        )}
                        {item.pinnedToWidget && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 text-[var(--accent)]">
                              <Pin className="w-3 h-3" />
                              ویجت
                            </span>
                          </>
                        )}
                      </div>

                      <h3
                        className={`mt-1 text-base font-bold text-[var(--text-primary)] leading-snug ${
                          isDone ? 'line-through' : ''
                        }`}
                      >
                        {item.title}
                      </h3>

                      {(item.notes || item.phoneNumber || item.locationHint) && (
                        <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                          {item.phoneNumber && (
                            <span className="font-mono-tabular font-semibold text-[var(--accent)] ml-2">
                              {toPersianDigits(item.phoneNumber)}
                            </span>
                          )}
                          {item.locationHint || item.notes}
                        </p>
                      )}

                      {item.voiceNoteId && (
                        <VoiceNotePlayer
                          voiceNoteId={item.voiceNoteId}
                          durationSec={item.voiceDurationSec}
                        />
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.phoneNumber && (
                      <a
                        href={`tel:${item.phoneNumber}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        title="شماره‌گیری"
                        aria-label={`تماس با ${item.title}`}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}

                    {!isDone && item.timeStr && (
                      <button
                        type="button"
                        onClick={() => onSnoozeItem(item.id, 15)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
                        title="تعویق ۱۵ دقیقه‌ای"
                        aria-label="تعویق ۱۵ دقیقه"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
                      title="ویرایش"
                      aria-label={`ویرایش ${item.title}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title="حذف"
                      aria-label={`حذف ${item.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
