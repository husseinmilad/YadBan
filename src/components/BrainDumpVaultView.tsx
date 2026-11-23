import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Camera,
  Check,
  Copy,
  Edit3,
  Layers,
  Link2,
  MapPin,
  Phone,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { MemoryCategory, MemoryItem } from '../types/memory';
import { CATEGORY_META, getLocalDateKey, toPersianDigits } from '../utils/dateFa';
import { CategoryIcon } from './CategoryIcon';
import { PhotoThumbnail } from './PhotoThumbnail';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface BrainDumpVaultViewProps {
  items: MemoryItem[];
  onOpenModalForNew: (prefillText?: string, category?: MemoryCategory) => void;
  onOpenBrainDump: () => void;
  onQuickSaveObjectLocation: (objectName: string, locationHint: string) => void;
  onEditItem: (item: MemoryItem) => void;
  onDeleteItem: (id: string) => void;
  onTogglePin: (id: string) => void;
  onScheduleToday: (id: string) => void;
}

type VaultFilter = 'all' | 'anchor' | 'phone' | 'idea';

export const BrainDumpVaultView: React.FC<BrainDumpVaultViewProps> = ({
  items,
  onOpenModalForNew,
  onOpenBrainDump,
  onQuickSaveObjectLocation,
  onEditItem,
  onDeleteItem,
  onTogglePin,
  onScheduleToday,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VaultFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [objName, setObjName] = useState('');
  const [objPlace, setObjPlace] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filter === 'phone' && !item.phoneNumber && item.category !== 'phone') return false;
        if (filter === 'anchor' && item.category !== 'anchor') return false;
        if (filter === 'idea' && item.category !== 'idea' && item.dateStr !== '') return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q) ||
          (item.photoText || '').toLowerCase().includes(q) ||
          (item.phoneNumber || '').includes(q) ||
          (item.contactName || '').toLowerCase().includes(q) ||
          (item.locationHint || '').toLowerCase().includes(q) ||
          (item.subType || '').toLowerCase().includes(q) ||
          (item.dosage || '').toLowerCase().includes(q) ||
          (item.personOrPlace || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.pinnedToWidget) - Number(a.pinnedToWidget) || b.createdAt - a.createdAt);
  }, [items, search, filter]);

  const phoneCount = items.filter((i) => i.phoneNumber || i.category === 'phone').length;
  const anchorCount = items.filter((i) => i.category === 'anchor').length;

  const handleCopy = (id: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleQuickLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objName.trim() || !objPlace.trim()) return;
    onQuickSaveObjectLocation(objName.trim(), objPlace.trim());
    setObjName('');
    setObjPlace('');
  };

  return (
    <div className="space-y-5">
      {/* Header + Search */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
              صندوق ذهن و دفترچهٔ «کجا گذاشتم؟»
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
              جست‌وجوی سریع مکان اشیا، شماره‌های ضروری، عکس برگه‌ها و ایده‌های ثبت‌شده
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="tabular-nums">{toPersianDigits(anchorCount)} محل وسیله</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="tabular-nums">{toPersianDigits(phoneCount)} شماره تماس</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenBrainDump}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-4 text-xs sm:text-sm font-bold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-4 h-4" />
              <span>ذهن‌خالی‌کن (چندخطی)</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenModalForNew('', filter === 'anchor' ? 'anchor' : undefined)}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-xs sm:text-sm font-semibold text-[var(--accent-on)] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مورد جدید</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی فوری: عینک، کلید، شماره تلفن، برگه، دارو..."
              className="w-full min-h-[46px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] pr-10 pl-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] overflow-x-auto no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'همه موارد' },
                { id: 'anchor', label: 'کجا گذاشتم؟' },
                { id: 'phone', label: 'شماره تلفن‌ها' },
                { id: 'idea', label: 'یادداشت‌های آزاد' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Quick "Where Did I Put It?" Notebook Bar */}
        {filter === 'anchor' && (
          <form
            onSubmit={handleQuickLocationSubmit}
            className="pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-task-enter"
          >
            <input
              type="text"
              value={objName}
              onChange={(e) => setObjName(e.target.value)}
              placeholder="نام وسیله (مثلاً: عینک مطالعه، دسته کلید زاپاس، پاسپورت)"
              className="flex-1 min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 text-xs sm:text-sm text-[var(--text-primary)]"
            />
            <input
              type="text"
              value={objPlace}
              onChange={(e) => setObjPlace(e.target.value)}
              placeholder="کجا گذاشتید؟ (مثلاً: کشوی اول میز، داخل کیف مشکی)"
              className="flex-1 min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 text-xs sm:text-sm text-[var(--text-primary)]"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={!objName.trim() || !objPlace.trim()}
                className="min-h-[44px] px-4 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                ثبت در دفترچه
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenModalForNew(
                    objName.trim()
                      ? `${objName.trim()}${objPlace.trim() ? ` — ${objPlace.trim()}` : ''}`
                      : '',
                    'anchor'
                  )
                }
                className="min-h-[44px] px-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="ثبت مکان وسیله همراه با عکس"
              >
                <Camera className="w-4 h-4 text-[var(--accent)]" />
                <span>با عکس</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Grid of Memory Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
          <p className="text-base font-bold text-[var(--text-primary)]">موردی یافت نشد</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            عبارت جست‌وجو را تغییر دهید یا با «ذهن‌خالی‌کن» و «ثبت مورد جدید» موارد تازه اضافه کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const cat = CATEGORY_META[item.category];
            const isToday = item.dateStr === getLocalDateKey(new Date());
            const metaLine = [
              item.subType,
              item.dosage ? `مقدار: ${item.dosage}` : undefined,
              item.mealTiming,
              item.durationOrQty,
              item.personOrPlace,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <article
                key={item.id}
                className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 flex flex-col justify-between gap-4 animate-task-enter"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <CategoryIcon category={item.category} className="w-4 h-4 text-[var(--accent)]" />
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {item.category === 'anchor' ? 'کجا گذاشتم؟' : cat.shortLabel}
                      </span>
                      {item.timeStr && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{toPersianDigits(item.timeStr)}</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onTogglePin(item.id)}
                      className={`min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center cursor-pointer ${
                        item.pinnedToWidget
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)]'
                      }`}
                      title={item.pinnedToWidget ? 'حذف سنجاق از ویجت' : 'سنجاق به ویجت اختصاصی'}
                      aria-label="سنجاق به ویجت"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="mt-2.5 text-base font-bold text-[var(--text-primary)] leading-snug">
                    {item.contactName ? `${item.contactName} — ${item.title}` : item.title}
                  </h3>

                  {item.phoneNumber && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface-tonal)] px-3.5 py-2.5">
                      <span className="text-base font-bold font-mono-tabular text-[var(--text-primary)]" dir="ltr">
                        {toPersianDigits(item.phoneNumber)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.id, item.phoneNumber!)}
                          className="min-w-[38px] min-h-[38px] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)] border border-[var(--border-subtle)] cursor-pointer"
                          aria-label="کپی شماره تلفن"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-4 h-4 text-[var(--sem-done)]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={`tel:${item.phoneNumber}`}
                          className="min-w-[38px] min-h-[38px] rounded-xl bg-[var(--accent)] text-[var(--accent-on)] flex items-center justify-center"
                          aria-label="شماره‌گیری"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}

                  {metaLine && (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">{metaLine}</p>
                  )}

                  {item.locationHint && (
                    <div className="mt-2.5 flex items-center gap-2 text-sm text-[var(--accent)] font-semibold">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>{item.locationHint}</span>
                    </div>
                  )}

                  {item.notes && (
                    <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {item.notes}
                    </p>
                  )}

                  {item.nextStepTitle && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Link2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      <span>مرحله بعد: {item.nextStepTitle}</span>
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

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
                      aria-label="ویرایش"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[var(--sem-danger)] hover:bg-rose-500/10 cursor-pointer"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {!isToday && !item.repeatDaily && (
                    <button
                      type="button"
                      onClick={() => onScheduleToday(item.id)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface-tonal)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 cursor-pointer whitespace-nowrap"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>افزودن به امروز</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
