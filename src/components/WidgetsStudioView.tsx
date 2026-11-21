import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pin,
} from 'lucide-react';
import { MemoryItem, UserSettings, WidgetConfig, WidgetStyle } from '../types/memory';
import { AndroidWidgetRenderer } from './AndroidWidgetRenderer';

interface WidgetsStudioViewProps {
  widgets: WidgetConfig[];
  items: MemoryItem[];
  settings: UserSettings;
  onUpdateWidgets: (next: WidgetConfig[]) => void;
  onToggleFloatingWidget: () => void;
  onToggleComplete: (id: string, dateKey: string) => void;
  onQuickAdd: (rawText: string) => void;
  onOpenCaptureModal: () => void;
}

export const WidgetsStudioView: React.FC<WidgetsStudioViewProps> = ({
  widgets,
  items,
  settings,
  onUpdateWidgets,
  onToggleFloatingWidget,
  onToggleComplete,
  onQuickAdd,
  onOpenCaptureModal,
}) => {
  const [wallpaperError, setWallpaperError] = useState(false);
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);
  const enabledWidgets = sortedWidgets.filter((w) => w.enabled);

  const toggleEnabled = (id: string) => {
    onUpdateWidgets(
      widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const toggleSize = (id: string) => {
    onUpdateWidgets(
      widgets.map((w) =>
        w.id === id ? { ...w, size: w.size === '4x2' ? '2x2' : '4x2' } : w
      )
    );
  };

  const setStyle = (id: string, style: WidgetStyle) => {
    onUpdateWidgets(widgets.map((w) => (w.id === id ? { ...w, style } : w)));
  };

  const moveOrder = (id: string, direction: -1 | 1) => {
    const idx = sortedWidgets.findIndex((w) => w.id === id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sortedWidgets.length) return;
    const copy = [...sortedWidgets];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdateWidgets(copy.map((w, i) => ({ ...w, order: i })));
  };

  const wallpaperSrc =
    settings.themeMode === 'dark'
      ? '/src/assets/images/material_wallpaper_dark_1795292130789.jpg'
      : '/src/assets/images/material_wallpaper_light_1795292130906.jpg';

  return (
    <div className="space-y-6">
      {/* Header + Floating Mini-Widget Toggle */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
            استودیوی ویجت اختصاصی
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            ویجت‌های زنده را بچینید، اندازه و سبک ظاهری آن‌ها را تغییر دهید و مستقیم با آن‌ها کار کنید.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleFloatingWidget}
          className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            settings.showFloatingWidget
              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
              : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border-[var(--border-subtle)]'
          }`}
        >
          <Pin className="w-4 h-4" />
          <span>
            {settings.showFloatingWidget ? 'ویجت شناور روی صفحه فعال است' : 'نمایش ویجت شناور در همه صفحات'}
          </span>
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Widget Board */}
        <section className="lg:col-span-8 relative rounded-[32px] overflow-hidden border border-[var(--border-subtle)] shadow-lg min-h-[540px]">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900/30 via-slate-900/20 to-slate-800/40">
            {!wallpaperError && (
              <img
                src={wallpaperSrc}
                alt="پس‌زمینه متریال"
                referrerPolicy="no-referrer"
                onError={() => setWallpaperError(true)}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/10 dark:bg-black/25" />
          </div>

          <div className="relative z-10 p-5 sm:p-7 space-y-5">
            <div className="flex items-center justify-between text-xs font-semibold text-white drop-shadow">
              <span className="inline-flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                چیدمان زنده ویجت‌ها
              </span>
              <span>Material You</span>
            </div>

            {enabledWidgets.length === 0 ? (
              <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 text-center">
                <p className="text-base font-bold text-[var(--text-primary)]">
                  همه ویجت‌ها مخفی هستند
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  از پنل تنظیمات ویجت‌ها حداقل یک ویجت را فعال کنید.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {enabledWidgets.map((widget) => (
                  <AndroidWidgetRenderer
                    key={widget.id}
                    widget={widget}
                    items={items}
                    onToggleComplete={onToggleComplete}
                    onQuickAdd={onQuickAdd}
                    onOpenCaptureModal={onOpenCaptureModal}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Widget Customizer Panel */}
        <aside className="lg:col-span-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            شخصی‌سازی چیدمان ویجت‌ها
          </h2>

          <div className="divide-y divide-[var(--border-subtle)]">
            {sortedWidgets.map((w, idx) => (
              <div key={w.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">{w.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveOrder(w.id, -1)}
                      className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-30 cursor-pointer"
                      aria-label="انتقال به بالا"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedWidgets.length - 1}
                      onClick={() => moveOrder(w.id, 1)}
                      className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] disabled:opacity-30 cursor-pointer"
                      aria-label="انتقال به پایین"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSize(w.id)}
                      className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
                      title={w.size === '4x2' ? 'تغییر به سایز ۲×۲' : 'تغییر به سایز عریض ۴×۲'}
                      aria-label="تغییر اندازه ویجت"
                    >
                      {w.size === '4x2' ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEnabled(w.id)}
                      className={`min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center cursor-pointer ${
                        w.enabled
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)]'
                      }`}
                      aria-label={w.enabled ? 'مخفی کردن ویجت' : 'نمایش ویجت'}
                    >
                      {w.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {w.enabled && (
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'tonal', label: 'متریال رنگی' },
                        { id: 'glass', label: 'شیشه‌ای' },
                        { id: 'contrast', label: 'تیره کنتراست' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStyle(w.id, st.id)}
                        className={`flex-1 min-h-[34px] rounded-xl text-xs font-medium border cursor-pointer ${
                          w.style === st.id
                            ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                            : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-transparent'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
