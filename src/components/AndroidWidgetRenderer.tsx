import React, { useEffect, useState } from 'react';
import { Check, Copy, MapPin, Phone, Plus, Send } from 'lucide-react';
import { getIranDateDetails } from '../data/iranCalendarEvents';
import { MemoryItem, WidgetConfig } from '../types/memory';
import {
  formatSecondsClockFa,
  getJalaliFullDate,
  getLocalDateKey,
  parseQuickCapture,
  toPersianDigits,
} from '../utils/dateFa';

interface AndroidWidgetRendererProps {
  widget: WidgetConfig;
  items: MemoryItem[];
  onToggleComplete: (id: string, dateKey: string) => void;
  onQuickAdd: (rawText: string) => void;
  onOpenCaptureModal: () => void;
}

export const AndroidWidgetRenderer: React.FC<AndroidWidgetRendererProps> = ({
  widget,
  items,
  onToggleComplete,
  onQuickAdd,
  onOpenCaptureModal,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [quickInput, setQuickInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (widget.type !== 'clock_next') return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [widget.type]);

  const todayKey = getLocalDateKey(now);

  const todaysItems = items.filter((i) => i.repeatDaily || i.dateStr === todayKey);
  const completedCount = todaysItems.filter((i) =>
    i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed
  ).length;
  const totalCount = todaysItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextUpcoming = todaysItems
    .filter((i) => {
      const done = i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed;
      return !done && i.timeStr;
    })
    .sort((a, b) => a.timeStr.localeCompare(b.timeStr))[0];

  const pinnedContactsAndAnchors = items
    .filter((i) => i.pinnedToWidget && (i.phoneNumber || i.category === 'anchor'))
    .slice(0, 4);

  const styleClasses =
    widget.style === 'contrast'
      ? 'bg-slate-900 text-white border-slate-700'
      : widget.style === 'glass'
        ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl text-[var(--text-primary)] border-white/40 dark:border-white/10'
        : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border-[var(--border-subtle)]';

  const mutedTextClass =
    widget.style === 'contrast' ? 'text-slate-300' : 'text-[var(--text-muted)]';

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onQuickAdd(quickInput.trim());
    setQuickInput('');
  };

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard?.writeText(phone).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const spanClass =
    widget.size === '4x2'
      ? 'col-span-1 sm:col-span-4'
      : widget.size === '3x2'
        ? 'col-span-1 sm:col-span-3'
        : 'col-span-1 sm:col-span-2';

  if (widget.type === 'clock_next') {
    const { hm, sec } = formatSecondsClockFa(now);
    const todayDetails = getIranDateDetails(todayKey);
    return (
      <div
        className={`${spanClass} rounded-[28px] border p-5 flex flex-col justify-between gap-4 shadow-sm ${styleClasses}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-medium ${mutedTextClass}`}>
              {getJalaliFullDate(now)}
              {todayDetails.hijriLabel ? ` · ${todayDetails.hijriLabel}` : ''}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5 font-mono-tabular" dir="ltr">
              <span className="text-4xl font-bold tracking-tight">{hm}</span>
              <span className={`text-base font-medium ${mutedTextClass}`}>{sec}</span>
            </div>
            {todayDetails.events.length > 0 && (
              <p
                className={`mt-1 text-xs font-semibold ${
                  todayDetails.isOfficialHoliday
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-[var(--accent)]'
                }`}
              >
                {todayDetails.events.map((e) => e.title).join('، ')}
                {todayDetails.isOfficialHoliday ? ' (تعطیل رسمی)' : ''}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCaptureModal}
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-[var(--accent)] text-[var(--accent-on)] flex items-center justify-center hover:opacity-95 active:scale-95 transition-transform cursor-pointer"
            aria-label="ثبت سریع در ویجت"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-3 border-t border-current/10 flex items-center justify-between gap-3">
          {nextUpcoming ? (
            <div className="min-w-0">
              <p className={`text-xs ${mutedTextClass}`}>
                برنامه بعدی · ساعت{' '}
                <span className="font-mono-tabular font-semibold">
                  {toPersianDigits(nextUpcoming.timeStr)}
                </span>
              </p>
              <p className="text-sm font-bold truncate mt-0.5">{nextUpcoming.title}</p>
            </div>
          ) : (
            <p className={`text-sm ${mutedTextClass}`}>
              برنامه زمان‌بندی‌شده دیگری برای امروز باقی نمانده است.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (widget.type === 'quick_capture') {
    const preview = quickInput.trim() ? parseQuickCapture(quickInput, todayKey) : null;
    return (
      <div
        className={`${spanClass} rounded-[28px] border p-5 flex flex-col justify-between gap-3 shadow-sm ${styleClasses}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold">ثبت فوری ذهن و شماره</h4>
          <span className={`text-xs ${mutedTextClass}`}>تشخیص خودکار شماره و زمان</span>
        </div>

        <form onSubmit={handleQuickSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="مثلاً: ۰۹۱۲۱۱۱۲۲۳۳ تعمیرکار یا ۱۵ دقیقه دیگه آب بخورم"
            className={`flex-1 min-h-[44px] rounded-2xl px-3.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
              widget.style === 'contrast'
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-400'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]'
            }`}
          />
          <button
            type="submit"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-[var(--accent)] text-[var(--accent-on)] flex items-center justify-center hover:opacity-95 cursor-pointer shrink-0"
            aria-label="ثبت سریع"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <p className={`text-xs truncate ${mutedTextClass}`}>
          {preview && preview.detectedHints.length > 0
            ? preview.detectedHints.join(' · ')
            : 'هر شماره‌ای بنویسید خودکار در دفترچه فوری ذخیره می‌شود'}
        </p>
      </div>
    );
  }

  if (widget.type === 'progress_routine') {
    const r = 24;
    const c = 2 * Math.PI * r;
    const dashOffset = c - (progressPct / 100) * c;
    const topTasks = todaysItems.slice(0, 3);

    return (
      <div
        className={`${spanClass} rounded-[28px] border p-5 flex flex-col justify-between gap-3 shadow-sm ${styleClasses}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold">پیشرفت امروز</h4>
            <p className={`text-xs mt-0.5 tabular-nums ${mutedTextClass}`}>
              {toPersianDigits(completedCount)} از {toPersianDigits(totalCount)} مورد انجام شد
            </p>
          </div>
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
              <circle
                cx="30"
                cy="30"
                r={r}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.15"
                strokeWidth="6"
              />
              <circle
                cx="30"
                cy="30"
                r={r}
                fill="none"
                stroke={widget.style === 'contrast' ? '#2DD4BF' : 'var(--accent)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="absolute text-xs font-bold tabular-nums">
              {toPersianDigits(progressPct)}٪
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {topTasks.map((item) => {
            const done = item.repeatDaily ? item.completedDates.includes(todayKey) : item.completed;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleComplete(item.id, todayKey)}
                className="w-full min-h-[40px] flex items-center gap-2.5 text-right rounded-xl px-2 py-1 hover:bg-current/5 transition-colors cursor-pointer"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    done
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-on)]'
                      : 'border-current/30'
                  }`}
                >
                  {done && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className={`text-xs truncate ${done ? 'line-through opacity-60' : 'font-medium'}`}>
                  {item.title}
                </span>
              </button>
            );
          })}
          {topTasks.length === 0 && (
            <p className={`text-xs ${mutedTextClass}`}>امروز هنوز برنامه‌ای ثبت نشده است.</p>
          )}
        </div>
      </div>
    );
  }

  // pinned_phones
  return (
    <div
      className={`${spanClass} rounded-[28px] border p-5 flex flex-col justify-between gap-3 shadow-sm ${styleClasses}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">شماره‌ها و لنگرهای فوری</h4>
        <span className={`text-xs tabular-nums ${mutedTextClass}`}>
          {toPersianDigits(pinnedContactsAndAnchors.length)} مورد
        </span>
      </div>

      <div className="space-y-2">
        {pinnedContactsAndAnchors.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-2xl bg-current/5 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.phoneNumber ? (
                <Phone className="w-4 h-4 shrink-0 text-[var(--accent)]" />
              ) : (
                <MapPin className="w-4 h-4 shrink-0 text-[var(--accent)]" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {item.contactName || item.title}
                </p>
                <p className={`text-xs truncate font-mono-tabular ${mutedTextClass}`}>
                  {item.phoneNumber
                    ? toPersianDigits(item.phoneNumber)
                    : item.locationHint || 'سنجاق‌شده'}
                </p>
              </div>
            </div>

            {item.phoneNumber && (
              <button
                type="button"
                onClick={() => handleCopyPhone(item.id, item.phoneNumber!)}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-current/10 flex items-center justify-center hover:bg-current/15 cursor-pointer shrink-0"
                aria-label="کپی شماره"
              >
                {copiedId === item.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        ))}

        {pinnedContactsAndAnchors.length === 0 && (
          <p className={`text-xs ${mutedTextClass}`}>
            شماره تلفن‌ها یا محل اشیا مهم را با دکمه سنجاق به اینجا بیاورید.
          </p>
        )}
      </div>
    </div>
  );
};
