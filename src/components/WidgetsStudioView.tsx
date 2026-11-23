import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BatteryFull,
  CalendarCheck,
  Eye,
  EyeOff,
  Pin,
  Plus,
  RefreshCw,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { MemoryItem, UserSettings, WidgetConfig, WidgetStyle } from '../types/memory';
import { toPersianDigits } from '../utils/dateFa';
import { isNativeAndroidApp, refreshNativeHomeWidgets } from '../utils/nativeBridge';
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
  onNavigateTab?: (tab: 'today' | 'vault') => void;
  onShowToast?: (msg: string) => void;
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
  onNavigateTab,
  onShowToast,
}) => {
  const [wallpaperError, setWallpaperError] = useState(false);
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);
  const enabledWidgets = sortedWidgets.filter((w) => w.enabled);

  const nowTimeLabel = useMemo(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return toPersianDigits(`${hh}:${mm}`);
  }, []);

  const handleSyncHomeWidgets = async () => {
    const ok = await refreshNativeHomeWidgets(items);
    if (ok) {
      onShowToast?.('ویجت‌های صفحه اول گوشی همگام‌سازی شدند');
    } else {
      onShowToast?.('در نسخه نصب‌شده APK اندروید، ویجت صفحه اول گوشی بلافاصله بروزرسانی می‌شود');
    }
  };

  const toggleEnabled = (id: string) => {
    onUpdateWidgets(
      widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const setWidgetSize = (id: string, size: '2x2' | '3x2' | '4x2') => {
    onUpdateWidgets(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
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
      {/* Header + Home Screen & Floating Widget Actions */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
            ویجت‌های صفحه اول گوشی اندروید
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            چیدمان و عرض افقی ویجت‌های صفحه اصلی گوشی خود را شخصی‌سازی و با لانچر بومی اندروید همگام کنید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSyncHomeWidgets}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-4 text-xs sm:text-sm font-semibold hover:opacity-90 transition-all cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 text-[var(--accent)]" />
            <span>همگام‌سازی ویجت صفحه اول</span>
          </button>

          <button
            type="button"
            onClick={onToggleFloatingWidget}
            className={`min-h-[46px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-xs sm:text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
              settings.showFloatingWidget
                ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            <Pin className="w-4 h-4" />
            <span>
              {settings.showFloatingWidget ? 'ویجت شناور فعال است' : 'ویجت شناور روی صفحه'}
            </span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Phone Home-Screen Launcher Canvas */}
        <section className="lg:col-span-8 space-y-4">
          <div className="relative rounded-[36px] overflow-hidden border-4 border-slate-900/15 dark:border-white/15 shadow-xl min-h-[600px] flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/35 via-slate-900/25 to-slate-800/45">
              {!wallpaperError && (
                <img
                  src={wallpaperSrc}
                  alt="پس‌زمینه صفحه اصلی گوشی"
                  referrerPolicy="no-referrer"
                  onError={() => setWallpaperError(true)}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black/15 dark:bg-black/30" />
            </div>

            {/* Phone Status Bar */}
            <div className="relative z-10 px-6 pt-4 pb-2 flex items-center justify-between text-xs font-bold text-white drop-shadow">
              <span className="font-mono-tabular">{nowTimeLabel}</span>
              <span className="opacity-90">صفحه اصلی گوشی · Material You</span>
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5" />
                <BatteryFull className="w-4 h-4" />
              </div>
            </div>

            {/* Widgets Grid (4-column horizontal grid) */}
            <div className="relative z-10 px-5 sm:px-7 py-3 flex-1">
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

            {/* Phone Home Screen App Shortcuts Dock */}
            <div className="relative z-10 px-5 pb-5 pt-3">
              <div className="mx-auto max-w-md rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-white/10 px-4 py-2.5 flex items-center justify-around gap-2 shadow-lg">
                <button
                  type="button"
                  onClick={onOpenCaptureModal}
                  className="flex flex-col items-center gap-1 min-w-[68px] py-1 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-2xl bg-[var(--accent)] text-[var(--accent-on)] flex items-center justify-center shadow-sm">
                    <Plus className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">ثبت فوری</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('today')}
                  className="flex flex-col items-center gap-1 min-w-[68px] py-1 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">برنامه امروز</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('vault')}
                  className="flex flex-col items-center gap-1 min-w-[68px] py-1 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-2xl bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] flex items-center justify-center">
                    <Archive className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">صندوق ذهن</span>
                </button>
              </div>
            </div>
          </div>

          {/* Native Android Anywhere-Capture Guide (Widgets, Shortcuts & Quick Settings Tile) */}
          <div className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-soft-text)] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </span>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                ثبت از هر جای گوشی (ویجت، میان‌بر صفحه اصلی و کاشی نوار بالا)
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                ۱) <strong>ویجت صفحه اول:</strong> روی فضای خالی صفحه اصلی لمس طولانی کنید و ویجت «برنامه امروز» یا «ثبت فوری» را قرار دهید (امکان تغییر عرض افقی تا تمام عرض وجود دارد).
                <br />
                ۲) <strong>کاشی نوار ابزار (Quick Settings):</strong> نوار اعلان‌های بالای گوشی را پایین بکشید، گزینه ویرایش کاشی‌ها را بزنید و کاشی «یادبان — ثبت فوری» را اضافه کنید تا بدون باز کردن کامل برنامه یادآور ثبت شود.
                <br />
                ۳) <strong>میان‌بر آیکون:</strong> با لمس طولانی آیکون یادبان، میان‌برهای «ثبت فوری»، «ضبط صوتی» و «صندوق ذهن» باز می‌شوند.
                {isNativeAndroidApp() ? ' همگام‌سازی بومی هم‌اکنون فعال است.' : ''}
              </p>
            </div>
          </div>
        </section>

        {/* Widget Customizer Panel */}
        <aside className="lg:col-span-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            شخصی‌سازی چیدمان و عرض ویجت‌ها
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: '2x2', label: 'نصف عرض (۲×۲)' },
                          { id: '3x2', label: 'متوسط (۳×۲)' },
                          { id: '4x2', label: 'تمام عرض (۴×۲)' },
                        ] as const
                      ).map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setWidgetSize(w.id, sz.id)}
                          className={`flex-1 min-h-[34px] rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                            w.size === sz.id
                              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                              : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>

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
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                              : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-transparent'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
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
