import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { getIranDateDetails } from '../data/iranCalendarEvents';
import { MemoryCategory, MemoryItem } from '../types/memory';
import {
  getJalaliDayParts,
  getJalaliMonthInfo,
  getLocalDateKey,
  shiftJalaliMonthKey,
  toPersianDigits,
} from '../utils/dateFa';

interface MonthlyCalendarWidgetProps {
  items: MemoryItem[];
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
}

const WEEKDAY_HEADERS = ['شنبه', '۱شنبه', '۲شنبه', '۳شنبه', '۴شنبه', '۵شنبه', 'جمعه'];

const CATEGORY_DOT_CLASS: Record<MemoryCategory, string> = {
  work: 'bg-sky-500',
  fitness: 'bg-emerald-500',
  health: 'bg-rose-500',
  phone: 'bg-amber-500',
  errand: 'bg-teal-500',
  anchor: 'bg-indigo-500',
  idea: 'bg-violet-500',
};

const LEGEND_ITEMS: { cat: MemoryCategory; label: string }[] = [
  { cat: 'work', label: 'کاری' },
  { cat: 'fitness', label: 'ورزشی' },
  { cat: 'health', label: 'سلامت' },
  { cat: 'phone', label: 'تماس' },
  { cat: 'errand', label: 'خرید' },
];

export const MonthlyCalendarWidget: React.FC<MonthlyCalendarWidgetProps> = ({
  items,
  selectedDateKey,
  onSelectDateKey,
}) => {
  const [viewMonthKey, setViewMonthKey] = useState(selectedDateKey);
  const todayKey = getLocalDateKey(new Date());

  useEffect(() => {
    const currentMonth = getJalaliMonthInfo(viewMonthKey);
    if (
      selectedDateKey < currentMonth.firstDayKey ||
      selectedDateKey > currentMonth.lastDayKey
    ) {
      setViewMonthKey(selectedDateKey);
    }
  }, [selectedDateKey]);

  const monthInfo = useMemo(() => getJalaliMonthInfo(viewMonthKey), [viewMonthKey]);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, MemoryCategory[]>();
    for (const item of items) {
      if (!item.dateStr) continue;
      const existing = map.get(item.dateStr) || [];
      if (!existing.includes(item.category)) {
        existing.push(item.category);
        map.set(item.dateStr, existing);
      }
    }
    return map;
  }, [items]);

  // Compute Iranian holidays & occasions for every day in the viewed month
  const dayEventsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getIranDateDetails>>();
    for (const day of monthInfo.days) {
      map.set(day.dateKey, getIranDateDetails(day.dateKey));
    }
    return map;
  }, [monthInfo.days]);

  const monthOccasionsList = useMemo(() => {
    return monthInfo.days
      .map((day) => ({
        day,
        details: dayEventsMap.get(day.dateKey)!,
      }))
      .filter((entry) => entry.details && entry.details.events.length > 0);
  }, [monthInfo.days, dayEventsMap]);

  const selectedDetails = useMemo(
    () => dayEventsMap.get(selectedDateKey) || getIranDateDetails(selectedDateKey),
    [dayEventsMap, selectedDateKey]
  );
  const selectedParts = useMemo(() => getJalaliDayParts(selectedDateKey), [selectedDateKey]);

  const handleGoToday = () => {
    setViewMonthKey(todayKey);
    onSelectDateKey(todayKey);
  };

  return (
    <section
      aria-label="ویجت تقویم ماهانه ایران"
      className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4"
    >
      {/* Header: Month Title + Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">
              {monthInfo.monthTitle} {monthInfo.yearFa}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              تقویم رسمی ایران · تعطیلات، مناسبت‌ها و برنامه‌های شما
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(selectedDateKey !== todayKey ||
            todayKey < monthInfo.firstDayKey ||
            todayKey > monthInfo.lastDayKey) && (
            <button
              type="button"
              onClick={handleGoToday}
              className="min-h-[38px] px-3 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] text-xs font-bold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              امروز
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMonthKey((k) => shiftJalaliMonthKey(k, -1))}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] flex items-center justify-center hover:opacity-85 cursor-pointer"
            aria-label="ماه قبل"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMonthKey((k) => shiftJalaliMonthKey(k, 1))}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] flex items-center justify-center hover:opacity-85 cursor-pointer"
            aria-label="ماه بعد"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((wd, idx) => (
          <div
            key={wd}
            className={`py-1.5 text-[11px] font-semibold truncate ${
              idx === 6 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-muted)]'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: monthInfo.leadingEmptyCells }).map((_, idx) => (
          <div key={`empty-${idx}`} className="min-h-[54px]" aria-hidden="true" />
        ))}

        {monthInfo.days.map((day) => {
          const isSelected = day.dateKey === selectedDateKey;
          const cats = dotsByDate.get(day.dateKey) || [];
          const visibleDots = cats.slice(0, 3);
          const details = dayEventsMap.get(day.dateKey);
          const isHolidayOrFriday = Boolean(details?.isOfficialHoliday || details?.isFriday);
          const hasOccasion = Boolean(details && details.events.length > 0);

          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => onSelectDateKey(day.dateKey)}
              aria-label={`${day.dayNumFa} ${monthInfo.monthTitle}${
                details?.isOfficialHoliday ? '، تعطیل رسمی' : ''
              }${
                details?.events.length
                  ? `، ${details.events.map((e) => e.title).join(' و ')}`
                  : ''
              }${cats.length > 0 ? `، ${toPersianDigits(cats.length)} دسته برنامه` : ''}`}
              className={`min-h-[54px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border relative ${
                isSelected
                  ? details?.isOfficialHoliday
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                  : details?.isOfficialHoliday
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/15'
                    : day.isToday
                      ? 'bg-[var(--accent-soft)]/60 text-[var(--text-primary)] border-[var(--accent)] font-bold'
                      : isHolidayOrFriday
                        ? 'bg-[var(--bg-surface-tonal)]/50 text-rose-600 dark:text-rose-400 border-transparent hover:bg-[var(--bg-surface-tonal)]'
                        : 'bg-[var(--bg-surface-tonal)]/50 text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-surface-tonal)]'
              }`}
            >
              <span className="text-sm font-bold tabular-nums leading-none">
                {day.dayNumFa}
              </span>

              <div className="h-2 flex items-center justify-center gap-1">
                {visibleDots.map((cat) => (
                  <span
                    key={cat}
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white ring-1 ring-black/15' : CATEGORY_DOT_CLASS[cat]
                    }`}
                  />
                ))}
                {hasOccasion && visibleDots.length === 0 && (
                  <span
                    className={`w-3 h-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/80'
                        : details?.isOfficialHoliday
                          ? 'bg-rose-500'
                          : 'bg-[var(--text-muted)]/60'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Date Multi-Calendar & Iranian Occasions Strip */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
            <span>
              {selectedParts.weekdayLong} {selectedParts.dayNum} {selectedParts.monthName}
            </span>
            {selectedDetails.hijriLabel && (
              <>
                <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)]">{selectedDetails.hijriLabel}</span>
              </>
            )}
            <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
            <span className="font-mono-tabular text-[var(--text-muted)]" dir="ltr">
              {selectedDetails.gregorianLabel}
            </span>
          </div>

          {(selectedDetails.isOfficialHoliday || selectedDetails.isFriday) && (
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {selectedDetails.isOfficialHoliday ? 'تعطیل رسمی' : 'جمعه (تعطیل هفتگی)'}
            </span>
          )}
        </div>

        {selectedDetails.events.length > 0 && (
          <ul className="space-y-1">
            {selectedDetails.events.map((ev, i) => (
              <li
                key={`${ev.title}-${i}`}
                className={`flex items-center gap-2 text-xs font-medium ${
                  ev.isHoliday
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {ev.title}
                  {ev.isHoliday ? ' (تعطیل رسمی)' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clickable Month Holidays & Occasions Directory */}
      {monthOccasionsList.length > 0 && (
        <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)]">
            مناسبت‌ها و تعطیلات {monthInfo.monthTitle}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {monthOccasionsList.map(({ day, details }) => {
              const active = day.dateKey === selectedDateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => onSelectDateKey(day.dateKey)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors text-right cursor-pointer ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                      : details.isOfficialHoliday
                        ? 'bg-rose-500/8 text-rose-700 dark:text-rose-300 border-rose-500/20 hover:bg-rose-500/15'
                        : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <span className="font-bold tabular-nums">{day.dayNumFa} {monthInfo.monthTitle}: </span>
                  <span>{details.events.map((e) => e.title).join('، ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Explicit Text + Color Legend */}
      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.cat} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${CATEGORY_DOT_CLASS[item.cat]}`} />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>رنگ قرمز: تعطیل رسمی و جمعه</span>
        </span>
      </div>
    </section>
  );
};
