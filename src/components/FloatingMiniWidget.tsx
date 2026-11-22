import React, { useEffect, useState } from 'react';
import { Check, Maximize2, Minimize2, Plus, Send, X } from 'lucide-react';
import { MemoryItem } from '../types/memory';
import { formatClockFa, getLocalDateKey, toPersianDigits } from '../utils/dateFa';

interface FloatingMiniWidgetProps {
  items: MemoryItem[];
  onQuickAdd: (text: string) => void;
  onToggleComplete: (id: string, dateKey: string) => void;
  onClose: () => void;
  onOpenModal: () => void;
}

export const FloatingMiniWidget: React.FC<FloatingMiniWidgetProps> = ({
  items,
  onQuickAdd,
  onToggleComplete,
  onClose,
  onOpenModal,
}) => {
  const [text, setText] = useState('');
  const [clock, setClock] = useState(() => formatClockFa(new Date()));
  const [wideMode, setWideMode] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(formatClockFa(new Date())), 15000);
    return () => clearInterval(t);
  }, []);

  const todayKey = getLocalDateKey(new Date());
  const nextItem = items
    .filter((i) => {
      const active = i.repeatDaily || i.dateStr === todayKey;
      const done = i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed;
      return active && !done;
    })
    .sort((a, b) => (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99'))[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onQuickAdd(text.trim());
    setText('');
  };

  return (
    <aside
      aria-label="ویجت شناور یادبان"
      className={`fixed bottom-20 md:bottom-6 left-4 z-40 transition-all rounded-[26px] bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] shadow-2xl p-4 space-y-3 ${
        wideMode ? 'w-[min(92vw,440px)]' : 'w-[280px] sm:w-[320px]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono-tabular text-base font-extrabold text-[var(--accent)]">
            {clock}
          </span>
          <span className="text-xs font-bold text-[var(--text-secondary)]">ویجت سریع یادبان</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWideMode((v) => !v)}
            className="min-w-[34px] min-h-[34px] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer"
            title={wideMode ? 'عرض معمولی' : 'افزایش عرض ویجت'}
            aria-label="تغییر عرض ویجت شناور"
          >
            {wideMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="min-w-[34px] min-h-[34px] rounded-xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] flex items-center justify-center cursor-pointer"
            aria-label="ثبت با جزئیات"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[34px] min-h-[34px] rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)] flex items-center justify-center cursor-pointer"
            aria-label="بستن ویجت شناور"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {nextItem ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface-tonal)] px-3 py-2.5">
          <button
            type="button"
            onClick={() => onToggleComplete(nextItem.id, todayKey)}
            className="min-w-[32px] min-h-[32px] rounded-xl border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-on)] transition-colors cursor-pointer shrink-0"
            aria-label="انجام کار بعدی"
          >
            <Check className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{nextItem.title}</p>
            {nextItem.timeStr && (
              <p className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                ساعت {toPersianDigits(nextItem.timeStr)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)] px-1">همه کارهای امروز انجام شده‌اند.</p>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ثبت شماره یا کار فوری..."
          className="flex-1 min-h-[40px] rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          className="min-w-[40px] min-h-[40px] rounded-xl bg-[var(--accent)] text-[var(--accent-on)] flex items-center justify-center cursor-pointer shrink-0"
          aria-label="ارسال"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
