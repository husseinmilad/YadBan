import React, { useEffect, useState } from 'react';
import { Check, Mic, Sparkles, X } from 'lucide-react';
import { MemoryCategory, MemoryItem } from '../types/memory';
import {
  CATEGORY_META,
  getLocalDateKey,
  parseBrainDumpLines,
  toPersianDigits,
} from '../utils/dateFa';
import { dictatePersianText } from '../utils/nativeBridge';

interface BrainDumpBatchModalProps {
  isOpen: boolean;
  defaultDateKey: string;
  onClose: () => void;
  onSaveBatch: (items: Omit<MemoryItem, 'id' | 'createdAt'>[]) => void;
}

type LineRole = 'reminder' | 'daily' | 'phone' | 'anchor' | 'note';

interface EditableDumpLine {
  id: string;
  title: string;
  role: LineRole;
  category: MemoryCategory;
  dateStr: string;
  timeStr: string;
  phoneNumber?: string;
  contactName?: string;
  locationHint?: string;
}

const ROLE_OPTIONS: { id: LineRole; label: string }[] = [
  { id: 'reminder', label: 'یادآور' },
  { id: 'daily', label: 'کار روزانه' },
  { id: 'phone', label: 'تماس' },
  { id: 'anchor', label: 'کجا گذاشتم' },
  { id: 'note', label: 'یادداشت' },
];

export const BrainDumpBatchModal: React.FC<BrainDumpBatchModalProps> = ({
  isOpen,
  defaultDateKey,
  onClose,
  onSaveBatch,
}) => {
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<EditableDumpLine[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [dictateErr, setDictateErr] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setRawText('');
    setRows([]);
    setDictateErr('');
  }, [isOpen]);

  useEffect(() => {
    if (!rawText.trim()) {
      setRows([]);
      return;
    }
    const candidates = parseBrainDumpLines(rawText, defaultDateKey || getLocalDateKey(new Date()));
    setRows(
      candidates.map((c) => {
        const role: LineRole =
          c.kindLabel === 'تماس'
            ? 'phone'
            : c.kindLabel === 'مکان شیء'
              ? 'anchor'
              : c.kindLabel === 'یادآور زمان‌دار'
                ? 'reminder'
                : c.kindLabel === 'کار روزانه'
                  ? 'daily'
                  : 'note';
        return {
          id: c.id,
          title: c.parsed.title,
          role,
          category: c.parsed.category,
          dateStr: c.parsed.dateStr,
          timeStr: c.parsed.timeStr,
          phoneNumber: c.parsed.phoneNumber,
          contactName: c.parsed.contactName,
          locationHint: c.parsed.locationHint,
        };
      })
    );
  }, [rawText, defaultDateKey]);

  if (!isOpen) return null;

  const updateRowRole = (id: string, role: LineRole) => {
    const today = defaultDateKey || getLocalDateKey(new Date());
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const nextCategory: MemoryCategory =
          role === 'phone'
            ? 'phone'
            : role === 'anchor'
              ? 'anchor'
              : role === 'note'
                ? 'idea'
                : r.category === 'idea' || r.category === 'anchor'
                  ? 'work'
                  : r.category;
        return {
          ...r,
          role,
          category: nextCategory,
          dateStr: role === 'note' || role === 'anchor' ? '' : r.dateStr || today,
          timeStr: role === 'reminder' && !r.timeStr ? '09:00' : r.timeStr,
        };
      })
    );
  };

  const handleDictate = async () => {
    if (isDictating) return;
    setDictateErr('');
    setIsDictating(true);
    try {
      const res = await dictatePersianText();
      if (res.ok && res.text) {
        setRawText((prev) => (prev.trim() ? `${prev.trim()}\n${res.text}` : res.text || ''));
      } else if (res.error) {
        setDictateErr(res.error);
      }
    } finally {
      setIsDictating(false);
    }
  };

  const handleSaveAll = () => {
    if (rows.length === 0) return;
    const payload: Omit<MemoryItem, 'id' | 'createdAt'>[] = rows.map((r) => ({
      title: r.title,
      category: r.category,
      dateStr: r.role === 'note' || r.role === 'anchor' ? '' : r.dateStr,
      timeStr: r.timeStr,
      timeBlock: r.timeStr
        ? Number(r.timeStr.split(':')[0]) < 12
          ? 'morning'
          : Number(r.timeStr.split(':')[0]) < 16
            ? 'noon'
            : Number(r.timeStr.split(':')[0]) < 20
              ? 'evening'
              : 'night'
        : 'anytime',
      repeatDaily: false,
      completed: false,
      completedDates: [],
      preReminderMinutes: r.timeStr ? 10 : 0,
      phoneNumber: r.phoneNumber,
      contactName: r.contactName,
      locationHint: r.locationHint,
      pinnedToWidget: r.role === 'phone' || r.role === 'anchor',
    }));
    onSaveBatch(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ذهن‌خالی‌کن"
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
              ذهن‌خالی‌کن سریع
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              هر چه در ذهن دارید پشت سر هم در خط‌های جداگانه بنویسید تا بعداً به کار، یادآور، تماس یا یادداشت تبدیل شود.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer shrink-0"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                هر خط یک فکر، کار، شماره یا محل وسیله:
              </label>
              <button
                type="button"
                onClick={handleDictate}
                disabled={isDictating}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-3 text-xs font-bold cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isDictating ? 'در حال شنیدن...' : 'افزودن خط با صدا'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              autoFocus
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'مثال:\nفردا ساعت ۸ قبض برق را پرداخت کنم\nشماره لوله کش ۰۹۱۲۳۴۵۶۷۸۹\nعینک آفتابی را گذاشتم داخل داشبورد ماشین\nخرید نان و ماست'}
              className="w-full rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {dictateErr && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{dictateErr}</p>
            )}
          </div>

          {rows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
                <Sparkles className="w-4 h-4" />
                <span>
                  تفکیک خودکار {toPersianDigits(rows.length)} مورد (می‌توانید نوع هر خط را تغییر دهید):
                </span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden">
                {rows.map((row) => (
                  <div key={row.id} className="p-3 bg-[var(--bg-surface)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {row.title}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">
                        {CATEGORY_META[row.category].shortLabel}
                        {row.timeStr ? ` · ${toPersianDigits(row.timeStr)}` : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateRowRole(row.id, opt.id)}
                          className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            row.role === opt.id
                              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                              : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-transparent'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={handleSaveAll}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] px-5 text-sm font-bold disabled:opacity-45 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                ثبت {toPersianDigits(rows.length)} مورد به صورت یکجا
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] text-sm font-semibold text-[var(--text-secondary)] cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
