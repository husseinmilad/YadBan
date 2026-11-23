import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarCheck,
  LayoutGrid,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { AndroidWidgetRenderer } from './components/AndroidWidgetRenderer';
import { BrainDumpBatchModal } from './components/BrainDumpBatchModal';
import { BrainDumpVaultView } from './components/BrainDumpVaultView';
import { DailyReviewModal } from './components/DailyReviewModal';
import { FloatingMiniWidget } from './components/FloatingMiniWidget';
import { FocusModeOverlay } from './components/FocusModeOverlay';
import { HeadsUpReminderBanner } from './components/HeadsUpReminderBanner';
import { PersonalizationSettingsView } from './components/PersonalizationSettingsView';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { TodayPlannerView } from './components/TodayPlannerView';
import { WidgetsStudioView } from './components/WidgetsStudioView';
import {
  createSeedItems,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGETS,
} from './data/seedData';
import {
  ActiveReminderAlert,
  ActiveTab,
  MemoryCategory,
  MemoryItem,
  UserSettings,
  WidgetConfig,
} from './types/memory';
import { playChime, sendBrowserNotification } from './utils/audioAndVoice';
import {
  addDaysToDateKey,
  getLocalDateKey,
  parseQuickCapture,
  toPersianDigits,
} from './utils/dateFa';
import { deletePhotoBlob } from './utils/mediaStorage';
import {
  getNativePermissionsStatus,
  isNativeAndroidApp,
  loadNativeOfflineData,
  syncOfflineStateAndAlarms,
  triggerNativeAlertNotification,
} from './utils/nativeBridge';
import { deleteVoiceBlob } from './utils/voiceStorage';

const STORAGE_ITEMS_KEY = 'yadban_memory_items_v1';
const STORAGE_SETTINGS_KEY = 'yadban_user_settings_v1';
const STORAGE_WIDGETS_KEY = 'yadban_widgets_v1';

function loadFromStorage<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export default function App() {
  const [items, setItems] = useState<MemoryItem[]>(() =>
    loadFromStorage(STORAGE_ITEMS_KEY, createSeedItems)
  );
  const [settings, setSettings] = useState<UserSettings>(() => {
    const loaded = loadFromStorage(STORAGE_SETTINGS_KEY, () => DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      customCategories: loaded.customCategories || DEFAULT_SETTINGS.customCategories,
      templates: loaded.templates || DEFAULT_SETTINGS.templates,
    };
  });
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() =>
    loadFromStorage(STORAGE_WIDGETS_KEY, () => DEFAULT_WIDGETS)
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    getLocalDateKey(new Date())
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [prefillText, setPrefillText] = useState('');
  const [modalInitialCategory, setModalInitialCategory] = useState<MemoryCategory | undefined>(
    undefined
  );

  const [focusOpen, setFocusOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);

  const [activeAlert, setActiveAlert] = useState<ActiveReminderAlert | null>(null);
  const [needsPermissionAttention, setNeedsPermissionAttention] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const firedKeysRef = useRef<Set<string>>(new Set());
  const lastNotifiedItemMsRef = useRef<Map<string, number>>(new Map());
  const nativeBootLoadedRef = useRef(false);

  const refreshPermissionSummary = useCallback(async () => {
    const st = await getNativePermissionsStatus();
    if (st.isNativeAndroid) {
      setNeedsPermissionAttention(
        st.notifications !== 'granted' || st.exactAlarm !== 'granted'
      );
    } else {
      setNeedsPermissionAttention(false);
    }
  }, []);

  // Hydrate from Android native SQLite database on launch & resume (syncs widget/notification actions)
  const pullFromNativeDb = useCallback(async () => {
    void refreshPermissionSummary();
    if (!isNativeAndroidApp()) return;
    const { items: nativeItems, settings: nativeSettings } = await loadNativeOfflineData();
    if (nativeItems && Array.isArray(nativeItems)) {
      setItems(nativeItems);
    }
    if (nativeSettings) {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        ...prev,
        ...nativeSettings,
        customCategories:
          nativeSettings.customCategories || prev.customCategories || DEFAULT_SETTINGS.customCategories,
        templates: nativeSettings.templates || prev.templates || DEFAULT_SETTINGS.templates,
      }));
    }
    nativeBootLoadedRef.current = true;
  }, [refreshPermissionSummary]);

  useEffect(() => {
    void pullFromNativeDb();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pullFromNativeDb();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pullFromNativeDb]);

  // Handle native Android deep links / widget tap actions (?action=quick-add, ?tab=...)
  useEffect(() => {
    const applyActionAndTab = (actionParam?: string | null, tabParam?: string | null) => {
      if (actionParam === 'quick-add' || actionParam === 'voice-add') {
        setEditingItem(null);
        setPrefillText('');
        setModalInitialCategory(undefined);
        setModalOpen(true);
      } else if (actionParam === 'brain-dump') {
        setBrainDumpOpen(true);
      }
      if (
        tabParam === 'today' ||
        tabParam === 'vault' ||
        tabParam === 'widgets' ||
        tabParam === 'settings'
      ) {
        setActiveTab(tabParam);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const actionParam = params.get('action');
    const tabParam = params.get('tab');
    applyActionAndTab(actionParam, tabParam);

    if (actionParam || tabParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const handleNativeIntent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ action?: string; tab?: string }>).detail;
      if (detail) {
        applyActionAndTab(detail.action, detail.tab);
      }
    };

    window.addEventListener('yadban-native-intent', handleNativeIntent);
    return () => window.removeEventListener('yadban-native-intent', handleNativeIntent);
  }, []);

  // Persist offline to localStorage + Android SQLite / AlarmManager / Home Widgets
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDGETS_KEY, JSON.stringify(widgets));
    } catch {
      // ignore
    }
  }, [widgets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void syncOfflineStateAndAlarms(items, settings);
    }, 300);
    return () => clearTimeout(timer);
  }, [items, settings]);

  // Apply Material You palette, dark mode, font scale, and corner tokens to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-palette', settings.palette);
    root.setAttribute('data-font-scale', settings.fontScale);
    root.setAttribute('data-corners', settings.cornerStyle);
  }, [settings.themeMode, settings.palette, settings.fontScale, settings.cornerStyle]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const triggerAlert = useCallback(
    async (
      item: MemoryItem,
      isPreReminder: boolean,
      stageLabel: string,
      skipNativeNotification = false
    ) => {
      const now = Date.now();
      const lastMs = lastNotifiedItemMsRef.current.get(item.id) || 0;
      if (!skipNativeNotification && item.id !== 'test' && now - lastMs < 90000) {
        return;
      }
      lastNotifiedItemMsRef.current.set(item.id, now);

      const alertObj: ActiveReminderAlert = {
        item,
        triggeredAt: now,
        isPreReminder,
        stageLabel,
      };
      setActiveAlert(alertObj);
      void playChime(settings.chimeType);

      if (skipNativeNotification) return;

      const notifTitle = isPreReminder
        ? `پیش‌یادآوری (${toPersianDigits(item.preReminderMinutes)} دقیقه مانده)`
        : stageLabel || 'یادآور هوشمند یادبان';

      const sentNative = await triggerNativeAlertNotification(
        item.id,
        notifTitle,
        item.title,
        settings.chimeType
      );
      if (!sentNative) {
        sendBrowserNotification(notifTitle, item.title, item.id);
      }
    },
    [settings.chimeType]
  );

  // Foreground In-App Offline Scheduler (deduplicated staged reminders + repeatUntilDone)
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      const nowMs = now.getTime();
      const curMinOfDay = now.getHours() * 60 + now.getMinutes();
      const onNativeAndroid = isNativeAndroidApp();

      for (const item of items) {
        const isDone = item.repeatDaily
          ? item.completedDates.includes(todayKey)
          : item.completed;
        if (isDone) continue;

        if (item.snoozedUntil && nowMs >= item.snoozedUntil) {
          const snoozeKey = `${item.id}-snooze-${item.snoozedUntil}`;
          if (!firedKeysRef.current.has(snoozeKey)) {
            firedKeysRef.current.add(snoozeKey);
            setItems((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, snoozedUntil: undefined } : x))
            );
            void triggerAlert(item, false, 'یادآور تعویقی', onNativeAndroid);
            break;
          }
        }

        if (!item.timeStr) continue;
        if (!item.repeatDaily && item.dateStr !== todayKey) continue;

        const [hh, mm] = item.timeStr.split(':').map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
        const targetMin = hh * 60 + mm;

        if (curMinOfDay === targetMin) {
          const key = `${item.id}-exact-${todayKey}-${item.timeStr}`;
          if (!firedKeysRef.current.has(key)) {
            firedKeysRef.current.add(key);
            void triggerAlert(item, false, 'موعد یادآور', onNativeAndroid);
            break;
          }
        }

        if (item.preReminderMinutes > 0 && curMinOfDay === targetMin - item.preReminderMinutes) {
          const preKey = `${item.id}-pre-${todayKey}-${item.timeStr}`;
          if (!firedKeysRef.current.has(preKey)) {
            firedKeysRef.current.add(preKey);
            void triggerAlert(item, true, 'پیش‌یادآوری مرحله‌ای', onNativeAndroid);
            break;
          }
        }

        const shouldRepeat = item.repeatUntilDone || settings.autoRepeatNudge;
        const maxFollowupWindow = item.repeatUntilDone ? 180 : 45;
        if (
          shouldRepeat &&
          curMinOfDay > targetMin &&
          (curMinOfDay - targetMin) % settings.nudgeIntervalMin === 0 &&
          curMinOfDay - targetMin <= maxFollowupWindow
        ) {
          const nudgeKey = `${item.id}-nudge-${todayKey}-${curMinOfDay}`;
          if (!firedKeysRef.current.has(nudgeKey)) {
            firedKeysRef.current.add(nudgeKey);
            void triggerAlert(item, false, 'پیگیری تا زمان انجام', onNativeAndroid);
            break;
          }
        }
      }
    };

    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, [items, settings.autoRepeatNudge, settings.nudgeIntervalMin, triggerAlert]);

  const handleSaveItem = (
    data: Omit<MemoryItem, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setItems((prev) =>
        prev.map((item) => (item.id === existingId ? { ...item, ...data } : item))
      );
      showToast('تغییرات ذخیره شد');
    } else {
      const created: MemoryItem = {
        ...data,
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      };
      setItems((prev) => [created, ...prev]);
      showToast('در حافظه آفلاین یادبان ثبت شد');
    }
  };

  const handleQuickAdd = (rawText: string) => {
    const parsed = parseQuickCapture(rawText, selectedDateKey);
    const created: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: parsed.title,
      category: parsed.category,
      dateStr: parsed.dateStr,
      timeStr: parsed.timeStr,
      timeBlock: parsed.timeBlock,
      repeatDaily: false,
      completed: false,
      completedDates: [],
      preReminderMinutes: parsed.timeStr ? 10 : 0,
      phoneNumber: parsed.phoneNumber,
      contactName: parsed.contactName,
      locationHint: parsed.locationHint,
      priority: parsed.priority,
      nextStepTitle: parsed.nextStepTitle,
      pinnedToWidget: parsed.pinnedToWidget,
      createdAt: Date.now(),
    };
    setItems((prev) => [created, ...prev]);
    if (parsed.phoneNumber) {
      showToast('شماره تلفن در صندوق ذهن و ویجت ثبت شد');
    } else if (parsed.locationHint) {
      showToast('محل وسیله در دفترچه «کجا گذاشتم؟» ثبت شد');
    } else if (parsed.nextStepTitle) {
      showToast('یادآور به همراه مرحله بعدی ثبت شد');
    } else {
      showToast('مورد جدید با تشخیص هوشمند ثبت شد');
    }
  };

  const handleQuickSaveObjectLocation = (objectName: string, locationHint: string) => {
    const created: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: objectName,
      category: 'anchor',
      dateStr: '',
      timeStr: '',
      timeBlock: 'morning',
      repeatDaily: false,
      completed: false,
      completedDates: [],
      preReminderMinutes: 0,
      locationHint,
      pinnedToWidget: true,
      createdAt: Date.now(),
    };
    setItems((prev) => [created, ...prev]);
    showToast(`محل «${objectName}» در دفترچه ثبت شد`);
  };

  const handleSaveBatch = (batchItems: Omit<MemoryItem, 'id' | 'createdAt'>[]) => {
    const baseTs = Date.now();
    const createdList: MemoryItem[] = batchItems.map((data, idx) => ({
      ...data,
      id: `mem-${baseTs + idx}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: baseTs + idx,
    }));
    setItems((prev) => [...createdList, ...prev]);
    showToast(`${toPersianDigits(createdList.length)} مورد از ذهن‌خالی‌کن ثبت و دسته‌بندی شد`);
  };

  const handleToggleComplete = (id: string, dateKey: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const wasDone = target.repeatDaily
      ? target.completedDates.includes(dateKey)
      : target.completed;
    const nowBecomesDone = !wasDone;

    let autoNextStep: MemoryItem | null = null;
    if (nowBecomesDone && target.nextStepTitle?.trim()) {
      const nextDateKey = dateKey || getLocalDateKey(new Date());
      autoNextStep = {
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: target.nextStepTitle.trim(),
        category: target.category,
        dateStr: nextDateKey,
        timeStr: '',
        timeBlock: target.timeBlock,
        repeatDaily: false,
        completed: false,
        completedDates: [],
        preReminderMinutes: 0,
        dependsOnId: target.id,
        pinnedToWidget: false,
        createdAt: Date.now(),
      };
    }

    const dependentWaiting = nowBecomesDone
      ? items.find((x) => x.dependsOnId === id && !x.completed)
      : undefined;

    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== id) return item;
        if (item.repeatDaily) {
          const exists = item.completedDates.includes(dateKey);
          return {
            ...item,
            completedDates: exists
              ? item.completedDates.filter((d) => d !== dateKey)
              : [...item.completedDates, dateKey],
          };
        }
        return { ...item, completed: !item.completed, snoozedUntil: undefined };
      });
      return autoNextStep ? [autoNextStep, ...updated] : updated;
    });

    if (activeAlert?.item.id === id) {
      setActiveAlert(null);
    }

    if (autoNextStep) {
      showToast(`مرحله بعدی فعال شد: ${autoNextStep.title}`);
    } else if (dependentWaiting) {
      showToast(`مرحله بعدی آماده است: ${dependentWaiting.title}`);
    }
  };

  const handleSnooze = (id: string, minutes: number) => {
    const until = Date.now() + minutes * 60000;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, snoozedUntil: until } : item))
    );
    setActiveAlert(null);
    if (minutes >= 60) {
      const hours = Math.round(minutes / 60);
      showToast(`آلارم برای حدود ${toPersianDigits(hours)} ساعت بعد تعویق شد`);
    } else {
      showToast(`آلارم برای ${toPersianDigits(minutes)} دقیقه بعد تنظیم شد`);
    }
  };

  const handleMoveTasksToTomorrow = (ids: string[]) => {
    const tomorrowKey = addDaysToDateKey(getLocalDateKey(new Date()), 1);
    const idSet = new Set(ids);
    setItems((prev) =>
      prev.map((item) =>
        idSet.has(item.id)
          ? { ...item, dateStr: tomorrowKey, snoozedUntil: undefined }
          : item
      )
    );
    showToast(`${toPersianDigits(ids.length)} کار انجام‌نشده به فردا منتقل شد`);
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target?.voiceNoteId) {
      void deleteVoiceBlob(target.voiceNoteId);
    }
    if (target?.photoId) {
      void deletePhotoBlob(target.photoId);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast('مورد حذف شد');
  };

  const handleTogglePin = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pinnedToWidget: !item.pinnedToWidget } : item
      )
    );
  };

  const handleScheduleToday = (id: string) => {
    const todayKey = getLocalDateKey(new Date());
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, dateStr: todayKey } : item))
    );
    showToast('به برنامه امروز اضافه شد');
  };

  const handleTriggerTestReminder = () => {
    const sample =
      items.find((i) => !i.completed) ||
      items[0] || {
        id: 'test',
        title: 'تست آلارم هوشمند یادبان',
        category: 'health',
        dateStr: getLocalDateKey(new Date()),
        timeStr: '12:00',
        timeBlock: 'noon',
        repeatDaily: false,
        completed: false,
        completedDates: [],
        preReminderMinutes: 5,
        pinnedToWidget: false,
        createdAt: Date.now(),
      };
    void triggerAlert(sample, false, 'تست هشدار یادبان', false);
  };

  const handleResetTasks = (mode: 'clear_all' | 'uncheck_done') => {
    if (mode === 'clear_all') {
      items.forEach((item) => {
        if (item.voiceNoteId) {
          void deleteVoiceBlob(item.voiceNoteId);
        }
        if (item.photoId) {
          void deletePhotoBlob(item.photoId);
        }
      });
      setItems([]);
      setActiveAlert(null);
      showToast('همه کارها و یادآورها پاک‌سازی شدند');
      return;
    }

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        completed: false,
        completedDates: [],
        snoozedUntil: undefined,
      }))
    );
    setActiveAlert(null);
    showToast('تیک همه کارهای انجام‌شده بازنشانی شد');
  };

  const dockWidgets = useMemo(
    () =>
      [...widgets]
        .filter((w) => w.enabled)
        .sort((a, b) => a.order - b.order)
        .slice(0, 3),
    [widgets]
  );

  const navLinks: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'امروز', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'vault', label: 'صندوق ذهن', icon: <Archive className="w-5 h-5" /> },
    { id: 'widgets', label: 'ویجت‌ها', icon: <LayoutGrid className="w-5 h-5" /> },
    { id: 'settings', label: 'تنظیمات', icon: <SlidersHorizontal className="w-5 h-5" /> },
  ];

  const reviewPeriod = new Date().getHours() >= 17 ? 'evening' : 'morning';

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24 md:pb-10">
      {/* Live Heads-Up Reminder Banner */}
      <HeadsUpReminderBanner
        alert={activeAlert}
        onComplete={(id) => handleToggleComplete(id, getLocalDateKey(new Date()))}
        onSnooze={handleSnooze}
        onDismiss={() => setActiveAlert(null)}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            یادبان
          </button>

          <nav
            aria-label="ناوبری اصلی"
            className="hidden md:flex items-center gap-7 text-sm font-semibold text-[var(--text-secondary)]"
          >
            {navLinks.map((link) => {
              const active = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveTab(link.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-[var(--accent)] border-[var(--accent)]'
                      : 'border-transparent hover:text-[var(--text-primary)]'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setBrainDumpOpen(true)}
              className="hidden sm:inline-flex min-h-[40px] md:min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-tonal)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              ذهن‌خالی‌کن
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setPrefillText('');
                setModalInitialCategory(undefined);
                setModalOpen(true);
              }}
              className="min-h-[40px] md:min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت فوری</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {activeTab === 'today' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <TodayPlannerView
                items={items}
                settings={settings}
                selectedDateKey={selectedDateKey}
                needsPermissionAttention={needsPermissionAttention}
                onSelectDateKey={setSelectedDateKey}
                onToggleComplete={handleToggleComplete}
                onQuickAdd={handleQuickAdd}
                onOpenModalForNew={(prefill = '', category) => {
                  setEditingItem(null);
                  setPrefillText(prefill);
                  setModalInitialCategory(category);
                  setModalOpen(true);
                }}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setPrefillText('');
                  setModalInitialCategory(undefined);
                  setModalOpen(true);
                }}
                onDeleteItem={handleDeleteItem}
                onSnoozeItem={handleSnooze}
                onOpenFocusMode={() => {
                  setFocusOpen(true);
                }}
                onOpenDailyReview={() => setReviewOpen(true)}
                onGoToSettings={() => setActiveTab('settings')}
              />
            </div>

            {/* Live Pinned Widget Dock on Desktop */}
            <aside
              aria-label="ویجت‌های زنده کنار صفحه"
              className="lg:col-span-4 space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-[var(--text-secondary)]">
                  ویجت‌های اختصاصی شما
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('widgets')}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  تنظیم ویجت‌ها
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {dockWidgets.map((w) => (
                  <AndroidWidgetRenderer
                    key={w.id}
                    widget={{ ...w, size: '2x2' }}
                    items={items}
                    onToggleComplete={handleToggleComplete}
                    onQuickAdd={handleQuickAdd}
                    onOpenCaptureModal={() => {
                      setEditingItem(null);
                      setPrefillText('');
                      setModalInitialCategory(undefined);
                      setModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </aside>
          </div>
        ) : activeTab === 'vault' ? (
          <BrainDumpVaultView
            items={items}
            onOpenModalForNew={(prefill = '', category) => {
              setEditingItem(null);
              setPrefillText(prefill);
              setModalInitialCategory(category);
              setModalOpen(true);
            }}
            onOpenBrainDump={() => setBrainDumpOpen(true)}
            onQuickSaveObjectLocation={handleQuickSaveObjectLocation}
            onEditItem={(item) => {
              setEditingItem(item);
              setPrefillText('');
              setModalInitialCategory(undefined);
              setModalOpen(true);
            }}
            onDeleteItem={handleDeleteItem}
            onTogglePin={handleTogglePin}
            onScheduleToday={handleScheduleToday}
          />
        ) : activeTab === 'widgets' ? (
          <WidgetsStudioView
            widgets={widgets}
            items={items}
            settings={settings}
            onUpdateWidgets={setWidgets}
            onToggleFloatingWidget={() =>
              setSettings((prev) => ({
                ...prev,
                showFloatingWidget: !prev.showFloatingWidget,
              }))
            }
            onToggleComplete={handleToggleComplete}
            onQuickAdd={handleQuickAdd}
            onOpenCaptureModal={() => {
              setEditingItem(null);
              setPrefillText('');
              setModalInitialCategory(undefined);
              setModalOpen(true);
            }}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onShowToast={showToast}
          />
        ) : (
          <PersonalizationSettingsView
            settings={settings}
            items={items}
            widgets={widgets}
            onUpdateSettings={(partial) =>
              setSettings((prev) => ({ ...prev, ...partial }))
            }
            onImportItems={(imported) => setItems(imported)}
            onImportWidgets={(importedWidgets) => setWidgets(importedWidgets)}
            onResetTasks={handleResetTasks}
            onResetDemo={() => {
              setItems(createSeedItems());
              setWidgets(DEFAULT_WIDGETS);
              showToast('داده‌های نمونه بازیابی شدند');
            }}
            onTriggerTestReminder={handleTriggerTestReminder}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="منوی پایین موبایل"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-4 items-center px-2"
      >
        {navLinks.map((link) => {
          const active = activeTab === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveTab(link.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors cursor-pointer ${
                active
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--text-muted)] font-medium'
              }`}
            >
              {link.icon}
              <span className="text-[11px] leading-none whitespace-nowrap">{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Optional Floating Always-On Mini-Widget */}
      {settings.showFloatingWidget && (
        <FloatingMiniWidget
          items={items}
          onQuickAdd={handleQuickAdd}
          onToggleComplete={handleToggleComplete}
          onClose={() => setSettings((prev) => ({ ...prev, showFloatingWidget: false }))}
          onOpenModal={() => {
            setEditingItem(null);
            setPrefillText('');
            setModalInitialCategory(undefined);
            setModalOpen(true);
          }}
        />
      )}

      {/* Quick Capture & Full Editor Modal */}
      <QuickCaptureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveItem}
        initialItem={editingItem}
        defaultDateKey={selectedDateKey}
        initialRawText={prefillText}
        initialCategory={modalInitialCategory}
        customCategories={settings.customCategories}
        templates={settings.templates}
        existingItems={items}
        enablePhotoOcr={settings.enablePhotoOcr}
      />

      {/* Distraction-Free Focus Mode Overlay */}
      <FocusModeOverlay
        isOpen={focusOpen}
        items={items}
        dateKey={selectedDateKey}
        onClose={() => setFocusOpen(false)}
        onComplete={(id) => handleToggleComplete(id, selectedDateKey)}
        onSnooze={handleSnooze}
        onEdit={(item) => {
          setFocusOpen(false);
          setEditingItem(item);
          setPrefillText('');
          setModalInitialCategory(undefined);
          setModalOpen(true);
        }}
      />

      {/* Daily Brief & Evening Carryover Modal */}
      <DailyReviewModal
        isOpen={reviewOpen}
        initialMode={reviewPeriod}
        items={items}
        onClose={() => setReviewOpen(false)}
        onToggleComplete={handleToggleComplete}
        onMoveTasksToTomorrow={handleMoveTasksToTomorrow}
      />

      {/* Brain Dump Multi-Line Batcher Modal */}
      <BrainDumpBatchModal
        isOpen={brainDumpOpen}
        onClose={() => setBrainDumpOpen(false)}
        defaultDateKey={selectedDateKey}
        onSaveBatch={handleSaveBatch}
      />

      {/* Subtle Action Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-1/2 translate-x-1/2 z-50 rounded-[var(--radius-control)] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-xl whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
