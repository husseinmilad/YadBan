import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  Edit3,
  Eye,
  Flag,
  Link2,
  Mic,
  Phone,
  Pin,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { getIranDateDetails } from '../data/iranCalendarEvents';
import {
  MemoryCategory,
  MemoryItem,
  TimeBlock,
  UserSettings,
} from '../types/memory';
import {
  CATEGORY_META,
  formatJalaliShortLabel,
  get7DayWindow,
  getJalaliDayParts,
  getJalaliFullDate,
  getLocalDateKey,
  parseQuickCapture,
  TIME_BLOCK_LABELS,
  toPersianDigits,
} from '../utils/dateFa';
import { dictatePersianText } from '../utils/nativeBridge';
import { CategoryIcon } from './CategoryIcon';
import { MonthlyCalendarWidget } from './MonthlyCalendarWidget';
import { PhotoThumbnail } from './PhotoThumbnail';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface TodayPlannerViewProps {
  items: MemoryItem[];
  settings: UserSettings;
  selectedDateKey: string;
  needsPermissionAttention?: boolean;
  onSelectDateKey: (dateKey: string) => void;
  onToggleComplete: (id: string, dateKey: string) => void;
  onQuickAdd: (rawText: string) => void;
  onOpenModalForNew: (prefillText?: string, category?: MemoryCategory) => void;
  onEditItem: (item: MemoryItem) => void;
  onDeleteItem: (id: string) => void;
  onSnoozeItem: (id: string, mins: number) => void;
  onOpenFocusMode: (startItemId?: string) => void;
  onOpenDailyReview: () => void;
  onGoToSettings: () => void;
}

const TIME_GROUP_ORDER: TimeBlock[] = ['morning', 'noon', 'evening', 'night'];

function getGreetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  if (h < 20) return 'عصر بخیر';
  return 'شب بخیر';
}

export const TodayPlannerView: React.FC<TodayPlannerViewProps> = ({
  items,
  settings,
  selectedDateKey,
  needsPermissionAttention = false,
  onSelectDateKey,
  onToggleComplete,
  onQuickAdd,
  onOpenModalForNew,
  onEditItem,
  onDeleteItem,
  onSnoozeItem,
  onOpenFocusMode,
  onOpenDailyReview,
  onGoToSettings,
}) => {
  const [quickText, setQuickText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [dictateErr, setDictateErr] = useState('');
  const [showCalendarAndFilters, setShowCalendarAndFilters] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeBlock | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
  const [recentlyPoppedId, setRecentlyPoppedId] = useState<string | null>(null);

  const todayKey = getLocalDateKey(new Date());
  const isViewingToday = selectedDateKey === todayKey;
  const weekDays = useMemo(() => get7DayWindow(selectedDateKey), [selectedDateKey]);

  const itemById = useMemo(() => {
    const map = new Map<string, MemoryItem>();
    items.forEach((i) => map.set(i.id, i));
    return map;
  }, [items]);

  const customCatById = useMemo(() => {
    const map = new Map<string, string>();
    (settings.customCategories || []).forEach((c) => map.set(c.id, c.label));
    return map;
  }, [settings.customCategories]);

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
        const aImp = a.priority === 'important' ? 0 : 1;
        const bImp = b.priority === 'important' ? 0 : 1;
        if (aImp !== bImp && !a.timeStr && !b.timeStr) return aImp - bImp;
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

  // Next actionable pending task for Card #3
  const nextTask = useMemo(() => {
    const pending = dateItems.filter((item) => {
      const done = item.repeatDaily ? item.completedDates.includes(selectedDateKey) : item.completed;
      return !done;
    });
    if (pending.length === 0) return null;
    // Prefer timed tasks first, then important tasks
    const timed = pending.find((i) => Boolean(i.timeStr));
    if (timed) return timed;
    const important = pending.find((i) => i.priority === 'important');
    return important || pending[0];
  }, [dateItems, selectedDateKey]);

  // Grouped agenda list with gentle time-of-day separation
  const timeGroupedSections = useMemo(() => {
    const groups: { key: string; label: string; list: MemoryItem[] }[] = [];
    const timedByBlock: Record<TimeBlock, MemoryItem[]> = {
      morning: [],
      noon: [],
      evening: [],
      night: [],
      anytime: [],
    };
    const untimed: MemoryItem[] = [];

    for (const item of filteredItems) {
      if (!item.timeStr || item.timeBlock === 'anytime') {
        untimed.push(item);
      } else {
        timedByBlock[item.timeBlock].push(item);
      }
    }

    for (const block of TIME_GROUP_ORDER) {
      if (timedByBlock[block].length > 0) {
        groups.push({
          key: block,
          label: TIME_BLOCK_LABELS[block],
          list: timedByBlock[block],
        });
      }
    }
    if (untimed.length > 0) {
      groups.push({
        key: 'untimed',
        label: 'بدون زمان مشخص',
        list: untimed,
      });
    }
    return groups;
  }, [filteredItems]);

  const parsedPreview = useMemo(() => {
    if (!quickText.trim()) return null;
    return parseQuickCapture(quickText, selectedDateKey);
  }, [quickText, selectedDateKey]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    onQuickAdd(quickText.trim());
    setQuickText('');
  };

  const handleQuickDictate = async () => {
    if (isDictating) return;
    setDictateErr('');
    setIsDictating(true);
    try {
      const res = await dictatePersianText();
      if (res.ok && res.text) {
        setQuickText((prev) => (prev.trim() ? `${prev.trim()} ${res.text}` : res.text || ''));
      } else if (res.error) {
        setDictateErr(res.error);
      }
    } finally {
      setIsDictating(false);
    }
  };

  const handleToggleWithPop = (id: string) => {
    setRecentlyPoppedId(id);
    setTimeout(() => setRecentlyPoppedId((cur) => (cur === id ? null : cur)), 240);
    onToggleComplete(id, selectedDateKey);
  };

  const nowHHMM = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const todayDetails = getIranDateDetails(todayKey);
  const greeting = getGreetingByHour();

  return (
    <div className="space-y-5">
      {/* 1. تاریخ شمسی و خوشامدگویی کوتاه */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
        <div>
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
                <span
                  className={
                    todayDetails.isOfficialHoliday
                      ? 'text-[var(--sem-danger)] font-bold'
                      : 'text-[var(--accent)] font-semibold'
                  }
                >
                  {todayDetails.events.map((e) => e.title).join('، ')}
                  {todayDetails.isOfficialHoliday ? ' (تعطیل)' : ''}
                </span>
              </>
            )}
          </p>

          <h1 className="mt-1 text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {settings.userName ? `${greeting} ${settings.userName}` : `${greeting}، برنامه امروز`}
          </h1>

          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)] tabular-nums">
            {totalCount === 0
              ? 'امروز هنوز کاری ثبت نشده است'
              : `${toPersianDigits(completedCount)} از ${toPersianDigits(totalCount)} کار انجام شد`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenDailyReview}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer whitespace-nowrap"
          >
            <Sun className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>مرور روزانه</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFocusMode(nextTask?.id)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3.5 text-xs font-bold text-[var(--accent-soft-text)] hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>حالت تمرکز</span>
          </button>
        </div>
      </section>

      {/* Quiet Semantic Permission Warning (only if an essential permission needs attention) */}
      {needsPermissionAttention && (
        <button
          type="button"
          onClick={onGoToSettings}
          className="w-full flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--sem-warning-soft)] border border-[var(--sem-warning)]/25 px-4 py-2.5 text-xs font-semibold text-[var(--sem-warning)] cursor-pointer text-right"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>برخی مجوزهای اعلان یا آلارم دقیق فعال نیستند — برای اطمینان از هشدارها تنظیم کنید</span>
          </span>
          <span className="underline whitespace-nowrap shrink-0">بررسی مجوزها</span>
        </button>
      )}

      {/* 2. کادر بزرگ و واضح برای «چه چیزی را نباید فراموش کنم؟» */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5">
        <form onSubmit={handleQuickSubmit} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="yadban-quick-input"
              className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]"
            >
              چه چیزی را نباید فراموش کنم؟
            </label>
            <button
              type="button"
              onClick={() => onOpenModalForNew(quickText)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت با جزئیات، الگو یا عکس</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              id="yadban-quick-input"
              type="text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="مثلاً: فردا ساعت ۸ قبض برق را پرداخت کنم، یا عینک روی میز مطالعه است..."
              className="flex-1 min-h-[52px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-4 text-sm sm:text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleQuickDictate}
                disabled={isDictating}
                className={`min-h-[52px] min-w-[52px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isDictating
                    ? 'bg-[var(--sem-danger)] text-white border-[var(--sem-danger)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] text-[var(--accent)] hover:opacity-90'
                }`}
                title="تایپ صوتی فارسی"
                aria-label="تایپ صوتی فارسی"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">{isDictating ? 'در حال گوش دادن...' : 'صوت'}</span>
              </button>

              <button
                type="submit"
                disabled={!quickText.trim()}
                className="min-h-[52px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-on)] hover:opacity-95 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>ثبت فوری</span>
              </button>
            </div>
          </div>

          {dictateErr && (
            <p className="text-xs text-[var(--sem-danger)] font-medium">{dictateErr}</p>
          )}

          {/* Live Natural Language Preview BEFORE saving */}
          {parsedPreview && (
            <div className="rounded-[var(--radius-control)] bg-[var(--accent-soft)]/65 border border-[var(--accent)]/25 px-3.5 py-2.5 text-xs space-y-1 animate-task-enter">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[var(--accent-soft-text)]">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>پیش‌نمایش تشخیص هوشمند قبل از ثبت:</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenModalForNew(quickText)}
                  className="text-[11px] font-bold text-[var(--accent)] underline cursor-pointer whitespace-nowrap"
                >
                  ویرایش قبل از ثبت
                </button>
              </div>
              <p className="text-[var(--text-primary)] leading-relaxed">
                <strong className="font-bold">{parsedPreview.title}</strong>
                {parsedPreview.dateStr && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>تاریخ: {formatJalaliShortLabel(parsedPreview.dateStr)}</span>
                  </>
                )}
                {parsedPreview.timeStr && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">ساعت: {toPersianDigits(parsedPreview.timeStr)}</span>
                  </>
                )}
                <span aria-hidden="true"> · </span>
                <span>دسته: {CATEGORY_META[parsedPreview.category].shortLabel}</span>
                {parsedPreview.priority === 'important' && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="text-[var(--accent)] font-bold">مهم</span>
                  </>
                )}
                {parsedPreview.nextStepTitle && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-semibold">مرحله بعد: {parsedPreview.nextStepTitle}</span>
                  </>
                )}
              </p>
            </div>
          )}
        </form>
      </section>

      {/* 3. کارت جمع‌وجورِ کار بعدی، با ساعت و اقدام مستقیم */}
      <section
        aria-label="کار بعدی"
        className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
      >
        {nextTask ? (
          <>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-[var(--accent)]">کار بعدی</span>
                {nextTask.timeStr ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                      ساعت {toPersianDigits(nextTask.timeStr)}
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--text-muted)]">بدون ساعت مشخص</span>
                  </>
                )}
                {nextTask.priority === 'important' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-bold text-[var(--accent)]">
                      <Flag className="w-3 h-3" />
                      مهم
                    </span>
                  </>
                )}
              </div>
              <p className="text-base font-extrabold text-[var(--text-primary)] truncate">
                {nextTask.title}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleWithPop(nextTask.id)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--sem-done)] px-4 text-xs font-bold text-white hover:opacity-95 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>انجام شد</span>
              </button>

              {nextTask.timeStr && (
                <button
                  type="button"
                  onClick={() => onSnoozeItem(nextTask.id, 15)}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>۱۵ دقیقه بعد</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenFocusMode(nextTask.id)}
                className="min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer whitespace-nowrap"
              >
                تمرکز
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--sem-done)]">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {totalCount > 0
                  ? 'تمام کارهای این روز با موفقیت انجام شده‌اند'
                  : 'برنامه این روز خالی است — از کادر بالا مورد جدید بنویسید'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenModalForNew()}
              className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              افزودن کار
            </button>
          </div>
        )}
      </section>

      {/* Collapsible Calendar & Filters Drawer Toggle (keeps Today clean by default) */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setShowCalendarAndFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>
            {showCalendarAndFilters
              ? 'بستن تقویم شمسی و فیلترها'
              : `تقویم شمسی و فیلتر زمان (${formatJalaliShortLabel(selectedDateKey)})`}
          </span>
        </button>

        {!isViewingToday && (
          <button
            type="button"
            onClick={() => onSelectDateKey(todayKey)}
            className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
          >
            بازگشت به امروز
          </button>
        )}
      </div>

      {showCalendarAndFilters && (
        <div className="space-y-4 animate-task-enter">
          {/* 7-Day Jalali Scroller */}
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
                  className={`min-w-[82px] flex-1 min-h-[68px] rounded-[var(--radius-control)] border px-3 py-2 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer shrink-0 ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                      : dayDetails.isOfficialHoliday || dayDetails.isFriday
                        ? 'bg-[var(--bg-surface)] text-[var(--sem-danger)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                  }`}
                >
                  <span className="text-[11px] font-medium opacity-85">
                    {parts.isToday ? 'امروز' : parts.weekdayLong}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums">
                    {parts.dayNum} {parts.monthName}
                  </span>
                  {countForDay > 0 && (
                    <span className="text-[11px] tabular-nums opacity-85">
                      {toPersianDigits(countForDay)} کار
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <MonthlyCalendarWidget
            items={items}
            selectedDateKey={selectedDateKey}
            onSelectDateKey={onSelectDateKey}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] overflow-x-auto no-scrollbar">
              {(['all', 'morning', 'noon', 'evening', 'night'] as const).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeFilter(slot)}
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                    timeFilter === slot
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
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
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {cat === 'all' ? 'همه دسته‌ها' : CATEGORY_META[cat].shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. فهرست کارهای امروز، با تفکیک زمانی ملایم */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
            {isViewingToday
              ? 'فهرست کارهای امروز'
              : `فهرست کارهای ${formatJalaliShortLabel(selectedDateKey)}`}
            <span className="mr-1.5 text-xs font-medium text-[var(--text-muted)] tabular-nums">
              ({toPersianDigits(filteredItems.length)})
            </span>
          </h2>

          <button
            type="button"
            onClick={() => onOpenModalForNew()}
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>برنامه جدید</span>
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              برای این بخش کاری ثبت نشده است
            </p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              می‌توانید از کادر بالای صفحه با زبان طبیعی یادآور ثبت کنید یا با دکمه زیر برنامه جدید بسازید.
            </p>
            <button
              type="button"
              onClick={() => onOpenModalForNew()}
              className="mt-1 min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-xs font-bold text-[var(--accent-on)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن برنامه</span>
            </button>
          </div>
        ) : (
          <div>
            {timeGroupedSections.map((group) => (
              <div key={group.key}>
                {/* Gentle time-of-day separator */}
                <div className="px-4 sm:px-6 py-2 bg-[var(--bg-surface-tonal)]/45 border-y border-[var(--border-subtle)] first:border-t-0 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                    {group.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {toPersianDigits(group.list.length)} مورد
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {group.list.map((item) => {
                    const isDone = item.repeatDaily
                      ? item.completedDates.includes(selectedDateKey)
                      : item.completed;
                    const cat = CATEGORY_META[item.category];
                    const customCatLabel = item.customCategoryId
                      ? customCatById.get(item.customCategoryId)
                      : undefined;
                    const prereqItem = item.dependsOnId ? itemById.get(item.dependsOnId) : undefined;
                    const prereqDone = prereqItem
                      ? prereqItem.repeatDaily
                        ? prereqItem.completedDates.includes(selectedDateKey)
                        : prereqItem.completed
                      : true;
                    const isOverdue =
                      !isDone &&
                      isViewingToday &&
                      Boolean(item.timeStr) &&
                      (item.timeStr || '') < nowHHMM;

                    const metaDetails = [
                      item.subType,
                      item.dosage ? `مقدار: ${item.dosage}` : undefined,
                      item.mealTiming,
                      item.durationOrQty,
                      item.personOrPlace,
                    ].filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-start sm:items-center justify-between gap-3 p-4 sm:px-6 transition-colors animate-task-enter ${
                          isDone
                            ? 'bg-[var(--sem-done-soft)]/35 opacity-75'
                            : 'hover:bg-[var(--bg-surface-tonal)]/30'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleWithPop(item.id)}
                            aria-label={isDone ? `لغو انجام ${item.title}` : `انجام شد: ${item.title}`}
                            className={`min-w-[44px] min-h-[44px] rounded-2xl border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                              recentlyPoppedId === item.id ? 'animate-check-pop' : ''
                            } ${
                              isDone
                                ? 'bg-[var(--sem-done)] border-[var(--sem-done)] text-white'
                                : item.priority === 'important'
                                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50 text-[var(--accent)]'
                                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] hover:border-[var(--accent)]'
                            }`}
                          >
                            {isDone ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <CategoryIcon
                                category={item.category}
                                className={`w-5 h-5 ${
                                  item.priority === 'important'
                                    ? 'text-[var(--accent)]'
                                    : 'text-[var(--text-secondary)]'
                                }`}
                              />
                            )}
                          </button>

                          <div className="min-w-0 flex-1 pt-0.5">
                            {/* Metadata row: clean inline text with · separators (NO static pill clutter) */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                              <span className="font-semibold text-[var(--text-secondary)]">
                                {customCatLabel || cat.shortLabel}
                              </span>

                              {item.timeStr && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`font-mono-tabular font-bold ${
                                      isOverdue
                                        ? 'text-[var(--sem-warning)]'
                                        : 'text-[var(--text-primary)]'
                                    }`}
                                  >
                                    {toPersianDigits(item.timeStr)}
                                    {isOverdue ? ' (گذشته)' : ''}
                                  </span>
                                </>
                              )}

                              {item.priority === 'important' && !isDone && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent)]">
                                    <Flag className="w-3 h-3" />
                                    مهم
                                  </span>
                                </>
                              )}

                              {item.repeatUntilDone && !isDone && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--sem-warning)]">
                                    <BellRing className="w-3 h-3" />
                                    تکرار تا انجام
                                  </span>
                                </>
                              )}

                              {isDone && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-bold text-[var(--sem-done)]">انجام‌شده</span>
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

                            {metaDetails.length > 0 && (
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                {metaDetails.join(' · ')}
                              </p>
                            )}

                            {(item.notes || item.phoneNumber || item.locationHint) && (
                              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                                {item.phoneNumber && (
                                  <span className="font-mono-tabular font-semibold text-[var(--accent)] ml-2">
                                    {toPersianDigits(item.phoneNumber)}
                                  </span>
                                )}
                                {item.locationHint || item.notes}
                              </p>
                            )}

                            {prereqItem && (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <Link2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                                <span>
                                  {prereqDone
                                    ? `پس از «${prereqItem.title}» (آماده انجام)`
                                    : `وابسته به انجام: «${prereqItem.title}»`}
                                </span>
                              </p>
                            )}

                            {!prereqItem && item.nextStepTitle && (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <Link2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                                <span>مرحله بعد پس از انجام: {item.nextStepTitle}</span>
                              </p>
                            )}

                            {item.photoId && (
                              <PhotoThumbnail photoId={item.photoId} photoText={item.photoText} />
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
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--sem-done)] hover:bg-[var(--sem-done-soft)]"
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
                              title="تعویق ۱۵ دقیقه"
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
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--sem-danger)] hover:bg-rose-500/10 cursor-pointer"
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
