import React, { useEffect, useRef, useState } from 'react';
import {
  BatteryCharging,
  Bell,
  BellRing,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mic,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sun,
  Tag,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  CustomCategory,
  MemoryCategory,
  MemoryItem,
  NativePermissionsStatus,
  PaletteId,
  TaskTemplate,
  UserSettings,
  WidgetConfig,
} from '../types/memory';
import {
  isAlertAudioUnlocked,
  playChime,
  unlockAlertSoundAndVibration,
} from '../utils/audioAndVoice';
import { CATEGORY_META, toPersianDigits } from '../utils/dateFa';
import {
  exportYadbanBackup,
  getNativePermissionsStatus,
  requestNativeBatteryOptimizationExemption,
  requestNativeExactAlarmPermission,
  requestNativeMicrophonePermission,
  requestNativeNotificationPermission,
  scheduleNativeDelayedTestAlarm,
  shareYadbanBackup,
  syncOfflineStateAndAlarms,
} from '../utils/nativeBridge';

interface PersonalizationSettingsViewProps {
  settings: UserSettings;
  items: MemoryItem[];
  widgets?: WidgetConfig[];
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onImportItems: (imported: MemoryItem[]) => void;
  onImportWidgets?: (imported: WidgetConfig[]) => void;
  onResetTasks: (mode: 'clear_all' | 'uncheck_done') => void;
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
  widgets,
  onUpdateSettings,
  onImportItems,
  onImportWidgets,
  onResetTasks,
  onResetDemo,
  onTriggerTestReminder,
}) => {
  const [permState, setPermState] = useState<NativePermissionsStatus>({
    isNativeAndroid: false,
    notifications: 'prompt',
    exactAlarm: 'granted',
    microphone: 'prompt',
    batteryIgnored: true,
  });
  const [alertAudioUnlocked, setAlertAudioUnlocked] = useState<boolean>(() =>
    isAlertAudioUnlocked()
  );
  const [schedulingDelayedTest, setSchedulingDelayedTest] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [showResetTasksConfirm, setShowResetTasksConfirm] = useState(false);
  const [showPasteRestore, setShowPasteRestore] = useState(false);
  const [pasteBackupText, setPasteBackupText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatBase, setNewCatBase] = useState<MemoryCategory>('work');
  const [newTplName, setNewTplName] = useState('');
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplCat, setNewTplCat] = useState<MemoryCategory>('errand');
  const [newTplTime, setNewTplTime] = useState('');
  const [newTplImportant, setNewTplImportant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshPermissions = async () => {
    const status = await getNativePermissionsStatus();
    setPermState(status);
  };

  useEffect(() => {
    void refreshPermissions();
  }, []);

  const handleRequestNotifications = async () => {
    const result = await requestNativeNotificationPermission();
    setPermState((prev) => ({ ...prev, notifications: result }));
    onUpdateSettings({ notificationsEnabled: result === 'granted' });
    if (result === 'granted') {
      await syncOfflineStateAndAlarms(items, { ...settings, notificationsEnabled: true });
      setFeedbackMsg('مجوز اعلان بومی فعال شد و آلارم‌های آفلاین همگام‌سازی شدند.');
    } else {
      setFeedbackMsg('دسترسی اعلان داده نشد؛ از بنر هشدار داخل برنامه استفاده می‌شود.');
    }
  };

  const handleRequestAlertAndAlarm = async () => {
    const exactRes = await requestNativeExactAlarmPermission();
    const audioReady = await unlockAlertSoundAndVibration(settings.chimeType);
    setAlertAudioUnlocked(audioReady || settings.chimeType !== 'none');
    setPermState((prev) => ({ ...prev, exactAlarm: exactRes }));

    if (settings.chimeType === 'none') {
      onUpdateSettings({ chimeType: 'gentle', autoRepeatNudge: true });
    } else {
      onUpdateSettings({ autoRepeatNudge: true });
    }

    if (exactRes === 'granted') {
      await syncOfflineStateAndAlarms(items, settings);
      setFeedbackMsg('مجوز هشدار، آلارم دقیق پس‌زمینه، پخش زنگ و ویبره فعال و آزمایش شد.');
    } else {
      setFeedbackMsg('لطفاً در تنظیمات سیستم دسترسی Alarms & Reminders را برای یادبان روشن کنید.');
    }
  };

  const handleRequestMicrophone = async () => {
    const micRes = await requestNativeMicrophonePermission();
    setPermState((prev) => ({ ...prev, microphone: micRes }));
    if (micRes === 'granted') {
      setFeedbackMsg('مجوز میکروفن تایید شد؛ اکنون می‌توانید یادداشت‌های صوتی آفلاین ضبط کنید.');
    } else if (micRes === 'denied') {
      setFeedbackMsg('دسترسی میکروفن مسدود شده است؛ لطفاً از تنظیمات برنامه مجوز میکروفن را صادر کنید.');
    } else {
      setFeedbackMsg('میکروفن در این دستگاه در دسترس نیست.');
    }
  };

  const handleRequestBatteryExemption = async () => {
    const ignored = await requestNativeBatteryOptimizationExemption();
    setPermState((prev) => ({ ...prev, batteryIgnored: ignored }));
    setFeedbackMsg(
      ignored
        ? 'اجرای پایدار آلارم‌ها در پس‌زمینه بدون محدودیت باتری تایید شد.'
        : 'لطفاً حالت باتری برنامه را روی بدون محدودیت (Unrestricted) قرار دهید.'
    );
  };

  const handleRequestAllPermissions = async () => {
    await handleRequestNotifications();
    await handleRequestAlertAndAlarm();
    await handleRequestMicrophone();
    if (permState.isNativeAndroid && !permState.batteryIgnored) {
      await handleRequestBatteryExemption();
    }
  };

  const handleDelayedLocalAlarmTest = async () => {
    setSchedulingDelayedTest(true);
    try {
      if (permState.notifications !== 'granted') {
        const perm = await requestNativeNotificationPermission();
        setPermState((prev) => ({ ...prev, notifications: perm }));
        onUpdateSettings({ notificationsEnabled: perm === 'granted' });
      }

      const scheduledNative = await scheduleNativeDelayedTestAlarm(
        5,
        'تست آلارم آفلاین یادبان',
        'این هشدار به‌صورت کاملاً آفلاین توسط سیستم آلارم گوشی اجرا شد.'
      );

      if (scheduledNative) {
        setFeedbackMsg(
          'آلارم بومی برای ۵ ثانیه دیگر تنظیم شد! می‌توانید برنامه را ببندید تا زنگ و اعلان را ببینید.'
        );
      } else {
        setFeedbackMsg('شمارشگر آفلاین ۵ ثانیه‌ای تست هشدار فعال شد...');
        setTimeout(() => {
          onTriggerTestReminder();
        }, 5000);
      }
    } finally {
      setSchedulingDelayedTest(false);
    }
  };

  const buildBackupPayload = () => {
    const fileName = `yadban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings,
        items,
        widgets: widgets || [],
      },
      null,
      2
    );
    return { fileName, payload };
  };

  const applyParsedBackup = (rawJson: string): boolean => {
    try {
      const parsed = JSON.parse(rawJson) as {
        items?: MemoryItem[];
        settings?: Partial<UserSettings>;
        widgets?: WidgetConfig[];
      };
      if (!Array.isArray(parsed.items)) {
        setFeedbackMsg('ساختار فایل پشتیبان معتبر نیست (لیست کارها یافت نشد).');
        return false;
      }
      onImportItems(parsed.items);
      if (parsed.settings && typeof parsed.settings === 'object') {
        onUpdateSettings(parsed.settings);
      }
      if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0 && onImportWidgets) {
        onImportWidgets(parsed.widgets);
      }
      setFeedbackMsg('نسخه پشتیبان با موفقیت بازیابی و در حافظه آفلاین ذخیره شد.');
      return true;
    } catch {
      setFeedbackMsg('متن یا ساختار فایل پشتیبان معتبر نیست.');
      return false;
    }
  };

  const copyTextSafely = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to textarea copy fallback
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(ta);
      return copied;
    } catch {
      return false;
    }
  };

  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      const { fileName, payload } = buildBackupPayload();
      const res = await exportYadbanBackup(fileName, payload);
      if (res.ok) {
        if (res.method === 'android_document') {
          setFeedbackMsg('فایل پشتیبان با موفقیت در مسیر انتخاب‌شده حافظه گوشی ذخیره شد.');
        } else if (res.method === 'android_share_fallback') {
          setFeedbackMsg('پنجره ذخیره و اشتراک‌گذاری فایل پشتیبان باز شد.');
        } else {
          setFeedbackMsg(
            'فایل پشتیبان برای دانلود آماده شد؛ اگر محیط مرورگر دانلود را مسدود کرد از «کپی متن پشتیبان» استفاده کنید.'
          );
        }
      } else if (res.cancelled) {
        setFeedbackMsg('ذخیره فایل پشتیبان لغو شد.');
      } else {
        const copied = await copyTextSafely(payload);
        setFeedbackMsg(
          copied
            ? `${res.error || 'خروجی مستقیم فایل انجام نشد.'} متن پشتیبان در حافظه موقت (کلیپ‌بورد) کپی شد.`
            : res.error || 'خروجی فایل پشتیبان با خطا مواجه شد؛ از دکمه کپی یا اشتراک‌گذاری استفاده کنید.'
        );
      }
    } finally {
      setExportingBackup(false);
    }
  };

  const handleShareBackup = async () => {
    const { fileName, payload } = buildBackupPayload();
    const res = await shareYadbanBackup(fileName, payload);
    if (res.ok) {
      setFeedbackMsg('فایل پشتیبان برای ارسال یا ذخیره در برنامه‌های دیگر آماده شد.');
    } else {
      const copied = await copyTextSafely(payload);
      setFeedbackMsg(
        copied
          ? 'اشتراک‌گذاری مستقیم در دسترس نبود؛ متن پشتیبان در کلیپ‌بورد کپی شد.'
          : res.error || 'امکان اشتراک‌گذاری در این دستگاه وجود ندارد.'
      );
    }
  };

  const handleCopyBackupText = async () => {
    const { payload } = buildBackupPayload();
    const copied = await copyTextSafely(payload);
    setFeedbackMsg(
      copied
        ? 'متن کامل پشتیبان در کلیپ‌بورد کپی شد؛ می‌توانید آن را در فایل یا یادداشت ذخیره کنید.'
        : 'امکان کپی خودکار وجود نداشت؛ از خروجی یا اشتراک‌گذاری فایل استفاده کنید.'
    );
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyParsedBackup(String(reader.result));
      inputEl.value = '';
    };
    reader.onerror = () => {
      setFeedbackMsg('خواندن فایل انتخاب‌شده با خطا مواجه شد.');
      inputEl.value = '';
    };
    reader.readAsText(file);
  };

  const handleRestoreFromPastedText = () => {
    if (!pasteBackupText.trim()) {
      setFeedbackMsg('ابتدا متن JSON پشتیبان را در کادر وارد کنید.');
      return;
    }
    if (applyParsedBackup(pasteBackupText.trim())) {
      setPasteBackupText('');
      setShowPasteRestore(false);
    }
  };

  const alertsReady =
    permState.exactAlarm === 'granted' && (alertAudioUnlocked || settings.chimeType !== 'none');

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
          شخصی‌سازی، مجوزهای بومی و تنظیمات یادآور
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          مجوزهای اندرویدی برنامه، ظاهر Material You، اندازه نوشته‌ها، آهنگ زنگ آلارم و یادآوری مجدد کاملاً آفلاین را تنظیم کنید.
        </p>
      </section>

      {/* Native Android App Permissions Section */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">مجوزهای برنامه</h2>
              <p className="text-xs text-[var(--text-muted)]">
                برای کارکرد دقیق آلارم در زمان بسته‌بودن اپ، ویجت صفحه اول و ضبط صوت آفلاین، این مجوزها را تایید کنید.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestAllPermissions}
            className="min-h-[44px] px-4 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold hover:opacity-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            فعال‌سازی همه مجوزها
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* 1. Notification Permission */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <Bell className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>مجوز اعلان</span>
                </span>
                {permState.notifications === 'granted' && (
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                نمایش نوتیفیکیشن یادآور روی صفحه قفل و نوار اعلان گوشی با دکمه‌های انجام شد و تعویق.
              </p>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                وضعیت:{' '}
                {permState.notifications === 'granted'
                  ? 'فعال و مجاز'
                  : permState.notifications === 'denied'
                    ? 'مسدود در تنظیمات دستگاه'
                    : 'در انتظار تایید'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequestNotifications}
              className={`w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                permState.notifications === 'granted'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                  : 'bg-[var(--accent)] text-[var(--accent-on)]'
              }`}
            >
              {permState.notifications === 'granted' ? 'اعلان فعال است' : 'تایید مجوز اعلان'}
            </button>
          </div>

          {/* 2. Exact Alarm + Alert Sound & Vibration Permission */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <Volume2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>مجوز هشدار و آلارم</span>
                </span>
                {alertsReady && (
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                زمان‌بندی دقیق آلارم بومی (AlarmManager)، پخش زنگ هشدار و لرزش حتی پس از بستن برنامه.
              </p>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                وضعیت:{' '}
                {permState.exactAlarm !== 'granted'
                  ? 'نیاز به تایید آلارم دقیق در تنظیمات'
                  : alertAudioUnlocked
                    ? 'آلارم دقیق، زنگ و لرزش فعال'
                    : 'آماده · برای تست صدا ضربه بزنید'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequestAlertAndAlarm}
              className={`w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                alertsReady
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                  : 'bg-[var(--accent)] text-[var(--accent-on)]'
              }`}
            >
              {alertsReady ? 'تست و تایید مجدد هشدار' : 'فعال‌سازی مجوز هشدار'}
            </button>
          </div>

          {/* 3. Microphone Permission */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <Mic className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span>مجوز میکروفن</span>
                </span>
                {permState.microphone === 'granted' && (
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                ضبط یادداشت صوتی آفلاین و تایپ با صدا (تبدیل گفتار به متن فارسی) در ثبت سریع.
              </p>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                وضعیت:{' '}
                {permState.microphone === 'granted'
                  ? 'فعال و مجاز'
                  : permState.microphone === 'denied'
                    ? 'مسدود در تنظیمات دستگاه'
                    : permState.microphone === 'unsupported'
                      ? 'در این دستگاه پشتیبانی نمی‌شود'
                      : 'در انتظار تایید'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequestMicrophone}
              className={`w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                permState.microphone === 'granted'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                  : 'bg-[var(--accent)] text-[var(--accent-on)]'
              }`}
            >
              {permState.microphone === 'granted' ? 'میکروفن فعال است' : 'تایید مجوز میکروفن'}
            </button>
          </div>
        </div>

        {/* Battery Optimization Exemption Row for reliable background alarms */}
        <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BatteryCharging className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                اجرای آزاد در پس‌زمینه (معافیت بهینه‌سازی باتری)
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                جلوگیری از توقف آلارم‌ها توسط سیستم مدیریت مصرف باتری اندروید
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestBatteryExemption}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
              permState.batteryIgnored
                ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]'
                : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
            }`}
          >
            {permState.batteryIgnored ? 'تنظیم شده' : 'فعال‌سازی اجرای پس‌زمینه'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme & Visual Personalization */}
        <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              ظاهر و خوانایی رابط کاربری
            </h2>
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
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              حالت روشنایی صفحه
            </span>
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
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              فرم کارت‌ها و دکمه‌ها
            </span>
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

        {/* Offline Alarms & Chime Settings */}
        <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              آلارم آفلاین و آهنگ زنگ
            </h2>
          </div>

          {/* Local Offline Alarm Test Buttons */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] p-4 space-y-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              تست عملکرد آلارم آفلاین (روی نسخه APK اندروید با زمان‌بند بومی AlarmManager حتی در صورت بسته‌بودن کامل برنامه اجرا می‌شود):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onTriggerTestReminder}
                className="min-h-[42px] px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
              >
                تست هشدار و زنگ همین الان
              </button>
              <button
                type="button"
                disabled={schedulingDelayedTest}
                onClick={handleDelayedLocalAlarmTest}
                className="min-h-[42px] px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent)] hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {schedulingDelayedTest ? 'در حال تنظیم...' : 'تست آلارم ۵ ثانیه دیگر'}
                </span>
              </button>
            </div>
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
                    void playChime(ch.id);
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-secondary)]">فاصله تکرار هوشمند:</span>
                <div className="flex items-center gap-1.5">
                  {([5, 10, 15] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onUpdateSettings({ nudgeIntervalMin: m })}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        settings.nudgeIntervalMin === m
                          ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                          : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      هر {toPersianDigits(m)} دقیقه
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo OCR Recognition Toggle */}
          <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Camera className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  تشخیص متن روی عکس برگه‌ها و کارت‌ها
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  هنگام پیوست عکس به‌صورت آفلاین متن را استخراج و قابل جست‌وجو می‌کند.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ enablePhotoOcr: !settings.enablePhotoOcr })}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold cursor-pointer shrink-0 ${
                settings.enablePhotoOcr
                  ? 'bg-[var(--accent)] text-[var(--accent-on)]'
                  : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)]'
              }`}
            >
              {settings.enablePhotoOcr ? 'فعال' : 'غیرفعال'}
            </button>
          </div>
        </section>
      </div>

      {/* Custom Categories & Ready Templates Manager */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            دسته‌های شخصی و الگوهای آماده
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            دسته‌های اختصاصی بسازید و برای کارهای پرتکرار مثل خرید، کار اداری، تماس، دارو یا وسایل سفر الگوی آماده تعریف کنید.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custom Categories */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/60 border border-[var(--border-subtle)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Tag className="w-4 h-4 text-[var(--accent)]" />
              <span>دسته‌های شخصی شما</span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3">
              {(settings.customCategories || []).map((cat) => (
                <div key={cat.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{cat.label}</span>
                    <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">·</span>
                    <span className="text-[var(--text-muted)]">
                      پایه: {CATEGORY_META[cat.baseCategory].shortLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        customCategories: (settings.customCategories || []).filter(
                          (c) => c.id !== cat.id
                        ),
                      })
                    }
                    className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-[var(--sem-danger)] hover:bg-rose-500/10 cursor-pointer"
                    aria-label={`حذف دسته ${cat.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                placeholder="نام دسته جدید (مثلاً: پروژه خانه، خانواده)"
                className="flex-1 min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)]"
              />
              <select
                value={newCatBase}
                onChange={(e) => setNewCatBase(e.target.value as MemoryCategory)}
                className="min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-primary)]"
              >
                {(['work', 'errand', 'health', 'phone', 'fitness', 'anchor', 'idea'] as MemoryCategory[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].shortLabel}
                    </option>
                  )
                )}
              </select>
              <button
                type="button"
                disabled={!newCatLabel.trim()}
                onClick={() => {
                  const nextCat: CustomCategory = {
                    id: `cat-${Date.now()}`,
                    label: newCatLabel.trim(),
                    baseCategory: newCatBase,
                    tone: 'important',
                  };
                  onUpdateSettings({
                    customCategories: [...(settings.customCategories || []), nextCat],
                  });
                  setNewCatLabel('');
                  setFeedbackMsg(`دسته شخصی «${nextCat.label}» اضافه شد.`);
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
            </div>
          </div>

          {/* Ready Templates */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/60 border border-[var(--border-subtle)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span>الگوهای آماده</span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 max-h-56 overflow-y-auto">
              {(settings.templates || []).map((tpl) => (
                <div key={tpl.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--text-primary)] truncate">{tpl.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {tpl.defaultTitle}
                      {tpl.defaultTimeStr ? ` · ساعت ${toPersianDigits(tpl.defaultTimeStr)}` : ''}
                      {tpl.isImportant ? ' · مهم' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        templates: (settings.templates || []).filter((t) => t.id !== tpl.id),
                      })
                    }
                    className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-[var(--sem-danger)] hover:bg-rose-500/10 cursor-pointer shrink-0"
                    aria-label={`حذف الگوی ${tpl.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="نام الگو (مثلاً: وسایل سفر)"
                  className="min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  value={newTplTitle}
                  onChange={(e) => setNewTplTitle(e.target.value)}
                  placeholder="عنوان پیش‌فرض کار..."
                  className="min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={newTplCat}
                  onChange={(e) => setNewTplCat(e.target.value as MemoryCategory)}
                  className="min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-primary)]"
                >
                  {(['work', 'errand', 'health', 'phone', 'fitness', 'anchor', 'idea'] as MemoryCategory[]).map(
                    (c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].shortLabel}
                      </option>
                    )
                  )}
                </select>
                <input
                  type="time"
                  dir="ltr"
                  value={newTplTime}
                  onChange={(e) => setNewTplTime(e.target.value)}
                  className="min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-primary)] font-mono-tabular"
                />
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={newTplImportant}
                    onChange={(e) => setNewTplImportant(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>مهم</span>
                </label>
                <button
                  type="button"
                  disabled={!newTplName.trim() || !newTplTitle.trim()}
                  onClick={() => {
                    const tpl: TaskTemplate = {
                      id: `tpl-${Date.now()}`,
                      name: newTplName.trim(),
                      category: newTplCat,
                      defaultTitle: newTplTitle.trim(),
                      defaultTimeStr: newTplTime,
                      preReminderMinutes: newTplTime ? 10 : 0,
                      isImportant: newTplImportant,
                    };
                    onUpdateSettings({
                      templates: [...(settings.templates || []), tpl],
                    });
                    setNewTplName('');
                    setNewTplTitle('');
                    setNewTplTime('');
                    setNewTplImportant(false);
                    setFeedbackMsg(`الگوی آماده «${tpl.name}» ذخیره شد.`);
                  }}
                  className="mr-auto min-h-[40px] px-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ساخت الگو</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Offline Local Data Backup & Tasks Reset */}
      <section className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              پشتیبان‌گیری آفلاین و مدیریت داده‌های کارها
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              تمامی برنامه‌ها و یادآورها به‌صورت محلی روی گوشی نگهداری می‌شوند. می‌توانید فایل پشتیبان بگیرید، آن را اشتراک بگذارید یا لیست کارها را ریست کنید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={exportingBackup}
              onClick={handleExportBackup}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-on)] hover:opacity-95 disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{exportingBackup ? 'در حال آماده‌سازی...' : 'خروجی فایل پشتیبان'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareBackup}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>اشتراک‌گذاری پشتیبان</span>
            </button>

            <button
              type="button"
              onClick={handleCopyBackupText}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>کپی متن پشتیبان</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>بازیابی از فایل</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json,text/plain"
              onChange={handleImportFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setShowPasteRestore((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
            >
              <span>بازیابی از متن</span>
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>بازگردانی داده‌های نمونه</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetTasksConfirm((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-rose-500/35 bg-rose-500/10 px-4 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>ریست شدن کارها</span>
            </button>
          </div>
        </div>

        {showPasteRestore && (
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-4 space-y-3">
            <label className="block text-xs font-bold text-[var(--text-primary)]">
              بازیابی با جای‌گذاری متن JSON پشتیبان
            </label>
            <textarea
              rows={4}
              dir="ltr"
              value={pasteBackupText}
              onChange={(e) => setPasteBackupText(e.target.value)}
              placeholder='{"version": 1, "items": [...]}'
              className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 text-xs text-[var(--text-primary)] font-mono"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreFromPastedText}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-on)] text-xs font-bold cursor-pointer"
              >
                اعمال و بازیابی داده‌ها
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasteRestore(false);
                  setPasteBackupText('');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        )}

        {showResetTasksConfirm && (
          <div
            role="region"
            aria-label="تایید ریست کارها"
            className="rounded-[var(--radius-control)] border border-rose-500/35 bg-rose-500/8 p-4 space-y-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                نحوه ریست شدن کارها را انتخاب کنید ({toPersianDigits(items.length)} مورد ثبت‌شده):
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                می‌توانید فقط تیک کارهای انجام‌شده را بردارید تا دوباره از نو انجام شوند، یا کل لیست کارها را برای شروع از صفر پاک کنید.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onResetTasks('clear_all');
                  setShowResetTasksConfirm(false);
                  setFeedbackMsg('تمامی کارها و یادآورهای ثبت‌شده پاک‌سازی و ریست شدند.');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                حذف کامل همه کارها (شروع از صفر)
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetTasks('uncheck_done');
                  setShowResetTasksConfirm(false);
                  setFeedbackMsg('تیک تمامی کارهای انجام‌شده بازنشانی شد.');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
              >
                برداشتن تیک کارهای انجام‌شده
              </button>
              <button
                type="button"
                onClick={() => setShowResetTasksConfirm(false)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </section>

      {feedbackMsg && (
        <div className="rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)] px-4 py-3 text-sm font-medium">
          {feedbackMsg}
        </div>
      )}
    </div>
  );
};
