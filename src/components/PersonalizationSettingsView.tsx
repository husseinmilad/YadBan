import React, { useRef, useState } from 'react';
import {
  Bell,
  Download,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Upload,
} from 'lucide-react';
import { MemoryItem, PaletteId, UserSettings } from '../types/memory';
import { playChime } from '../utils/audioAndVoice';
import { toPersianDigits } from '../utils/dateFa';
import { PWAInstallButton } from './PWAInstallButton';

interface PersonalizationSettingsViewProps {
  settings: UserSettings;
  items: MemoryItem[];
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onImportItems: (imported: MemoryItem[]) => void;
  onResetDemo: () => void;
  onTriggerTestReminder: () => void;
}

const PALETTES: { id: PaletteId; label: string; swatch: string }[] = [
  { id: 'ocean', label: 'اقیانوسی آرام', swatch: '#0F766E' },
  { id: 'coral', label: 'یاقوتی گرم', swatch: '#C2410C' },
  { id: 'indigo', label: 'لاجوردی تمرکز', swatch: '#3730A3' },
  { id: 'emerald', label: 'زمردی طبیعت', swatch: '#15803D' },
  { id: 'contrast', label: 'کنتراست بالا', swatch: '#0F172A' },
];

export const PersonalizationSettingsView: React.FC<PersonalizationSettingsViewProps> = ({
  settings,
  items,
  onUpdateSettings,
  onImportItems,
  onResetDemo,
  onTriggerTestReminder,
}) => {
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setFeedbackMsg('مرورگر شما از اعلان سیستمی پشتیبانی نمی‌کند؛ اعلان هوشمند داخل برنامه فعال است.');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
      onUpdateSettings({ notificationsEnabled: result === 'granted' });
      if (result === 'granted') {
        setFeedbackMsg('اعلان‌های هوشمند مرورگر با موفقیت فعال شدند.');
      } else {
        setFeedbackMsg('دسترسی اعلان سیستمی داده نشد؛ از بنر اعلان داخل برنامه استفاده می‌شود.');
      }
    } catch {
      setFeedbackMsg('خطا در دریافت مجوز اعلان.');
    }
  };

  const handleExportBackup = () => {
    const payload = JSON.stringify({ settings, items, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yadban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.items)) {
          onImportItems(parsed.items);
          if (parsed.settings) onUpdateSettings(parsed.settings);
          setFeedbackMsg('فایل پشتیبان با موفقیت بازیابی شد.');
        }
      } catch {
        setFeedbackMsg('ساختار فایل پشتیبان معتبر نیست.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
          شخصی‌سازی کامل و تنظیمات یادآور
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          ظاهر برنامه، اندازه نوشته‌ها، رنگ‌بندی، آهنگ زنگ اعلان و نحوه تکرار هشدارها را مطابق سلیقه خودتان تنظیم کنید.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme & Visual Personalization */}
        <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">ظاهر و خوانایی رابط کاربری</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              نام شما (برای خوش‌آمدگویی)
            </label>
            <input
              type="text"
              value={settings.userName}
              onChange={(e) => onUpdateSettings({ userName: e.target.value })}
              placeholder="نام خود را بنویسید..."
              className="w-full min-h-[46px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-4 text-sm text-[var(--text-primary)]"
            />
          </div>

          {/* Light / Dark Mode */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">حالت روشنایی صفحه</span>
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]">
              <button
                type="button"
                onClick={() => onUpdateSettings({ themeMode: 'light' })}
                className={`min-h-[40px] px-4 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  settings.themeMode === 'light'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>روز (روشن)</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ themeMode: 'dark' })}
                className={`min-h-[40px] px-4 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  settings.themeMode === 'dark'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>شب (تاریک)</span>
              </button>
            </div>
          </div>

          {/* Material You Palettes */}
          <div>
            <span className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
              پالت رنگ پویا (Material You)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PALETTES.map((pal) => {
                const active = settings.palette === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => onUpdateSettings({ palette: pal.id })}
                    className={`min-h-[46px] flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 border text-xs font-semibold cursor-pointer ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full shrink-0 border border-black/15"
                      style={{ backgroundColor: pal.swatch }}
                    />
                    <span className="truncate">{pal.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accessible Font Scale */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">اندازه نوشته‌ها</span>
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]">
              {(
                [
                  { id: 'normal', label: 'معمولی' },
                  { id: 'large', label: 'بزرگ' },
                  { id: 'xlarge', label: 'خیلی بزرگ' },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => onUpdateSettings({ fontScale: sz.id })}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    settings.fontScale === sz.id
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Corner Roundness */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">فرم کارت‌ها و دکمه‌ها</span>
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]">
              <button
                type="button"
                onClick={() => onUpdateSettings({ cornerStyle: 'soft' })}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  settings.cornerStyle === 'soft'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                گرد و نرم
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ cornerStyle: 'compact' })}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  settings.cornerStyle === 'compact'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                کلاسیک جمع‌وجور
              </button>
            </div>
          </div>
        </section>

        {/* Smart Notifications & Chime Settings */}
        <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              اعلان هوشمند و آهنگ زنگ
            </h2>
          </div>

          {/* Browser Notification Permission + Test */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">اعلان‌های سیستمی دستگاه</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  وضعیت فعلی:{' '}
                  {notifStatus === 'granted'
                    ? 'فعال'
                    : notifStatus === 'denied'
                      ? 'مسدود شده در مرورگر'
                      : 'در انتظار تایید شما'}
                </p>
              </div>
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="min-h-[42px] px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-on)] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {notifStatus === 'granted' ? 'فعال است' : 'فعال‌سازی اعلان'}
              </button>
            </div>

            <button
              type="button"
              onClick={onTriggerTestReminder}
              className="w-full min-h-[42px] px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
            >
              تست اعلان و زنگ یادآور همین الان
            </button>
          </div>

          {/* Chime Selection */}
          <div>
            <span className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              آهنگ زنگ اعلان یادآور
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'gentle', label: 'ملودی ملایم' },
                  { id: 'bell', label: 'زنگ شفاف' },
                  { id: 'marimba', label: 'ماریمبا' },
                  { id: 'none', label: 'بی‌صدا' },
                ] as const
              ).map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ chimeType: ch.id });
                    playChime(ch.id);
                  }}
                  className={`min-h-[42px] rounded-xl text-xs font-semibold border cursor-pointer ${
                    settings.chimeType === ch.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-transparent'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Repeat Nudge for Weak Memory */}
          <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  یادآوری مجدد برای کارهای فراموش‌شده
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  اگر یادآوری را تیک نزنید، برنامه دوباره به آرامی به شما یادآوری می‌کند.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ autoRepeatNudge: !settings.autoRepeatNudge })}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold cursor-pointer ${
                  settings.autoRepeatNudge
                    ? 'bg-[var(--accent)] text-[var(--accent-on)]'
                    : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)]'
                }`}
              >
                {settings.autoRepeatNudge ? 'روشن' : 'خاموش'}
              </button>
            </div>

            {settings.autoRepeatNudge && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-secondary)]">فاصله تکرار هوشمند:</span>
                <div className="flex items-center gap-1.5">
                  {([5, 10, 15] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onUpdateSettings({ nudgeIntervalMin: m })}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                        settings.nudgeIntervalMin === m
                          ? 'bg-[var(--accent)] text-[var(--accent-on)]'
                          : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)]'
                      }`}
                    >
                      هر {toPersianDigits(m)} دقیقه
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* PWA Installation & Data Backup */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            نصب برنامه و پشتیبان‌گیری اطلاعات
          </h2>
          <PWAInstallButton />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportBackup}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>خروجی فایل پشتیبان</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>بازیابی نسخه پشتیبان</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={onResetDemo}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>بازگردانی داده‌های نمونه</span>
          </button>
        </div>
      </section>

      {feedbackMsg && (
        <div className="rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-4 py-3 text-sm font-medium">
          {feedbackMsg}
        </div>
      )}
    </div>
  );
};
